/**
 * SmartInspect Protocol
 * Handles TCP and Named Pipe connections and packet transmission
 * With support for async scheduling, backlog buffering, and auto-reconnection
 */

const net = require('net');
const os = require('os');
const { BinaryFormatter } = require('./formatter');
const { PacketType, Level } = require('./enums');
const { PacketQueue } = require('./PacketQueue');
const { Scheduler } = require('./Scheduler');
const { SchedulerCommand } = require('./SchedulerCommand');
const { SchedulerAction } = require('./SchedulerAction');

const CLIENT_BANNER = 'SmartInspect Node.js Library v1.0.0\n';
const DEFAULT_TIMEOUT = 30000;
const ANSWER_SIZE = 2;
const DEFAULT_PIPE_NAME = 'smartinspect';

/**
 * TcpProtocol - handles TCP connection to SmartInspect Console
 */
class TcpProtocol {
    constructor(options = {}) {
        this.host = options.host || '127.0.0.1';
        this.port = options.port || 4228;
        this.timeout = options.timeout || DEFAULT_TIMEOUT;
        this.appName = options.appName || 'Node.js App';
        this.hostName = options.hostName || os.hostname();
        this.room = options.room || 'default';

        this.socket = null;
        this.connected = false;
        this.formatter = new BinaryFormatter();

        // Event handlers
        this.onError = options.onError || null;
        this.onConnect = options.onConnect || null;
        this.onDisconnect = options.onDisconnect || null;

        // Reconnection settings (like C# Protocol) - enabled by default
        this.reconnect = options.reconnect ?? true;
        this.reconnectInterval = options.reconnectInterval ?? 3000; // ms (default 3s)
        this._reconnectTickCount = 0;

        // Backlog settings (like C# Protocol) - enabled by default
        this.backlogEnabled = options.backlog?.enabled ?? true;
        this.backlogQueue = (options.backlog?.queue || 2048) * 1024; // KB to bytes
        this.backlogFlushOn = options.backlog?.flushOn ?? Level.Error;
        this.backlogKeepOpen = options.backlog?.keepOpen ?? true;

        // Async settings (like C# Protocol)
        this.asyncEnabled = options.async?.enabled || false;
        this.asyncQueue = (options.async?.queue || 2048) * 1024; // KB to bytes
        this.asyncThrottle = options.async?.throttle ?? false;
        this.asyncClearOnDisconnect = options.async?.clearOnDisconnect || false;

        // Internal state
        this._queue = new PacketQueue();
        this._queue.backlog = this.backlogQueue;
        this._keepOpen = !this.backlogEnabled || this.backlogKeepOpen;
        this._scheduler = null;
        this._failed = false;
    }

    /**
     * Whether the protocol is in failed state
     * @type {boolean}
     */
    get failed() {
        return this._failed;
    }

    /**
     * Build LogHeader content string
     */
    buildLogHeaderContent() {
        return `hostname=${this.hostName}\r\nappname=${this.appName}\r\nroom=${this.room}\r\n`;
    }

    /**
     * Send the initial LogHeader packet after connection
     */
    sendLogHeader() {
        const packet = {
            packetType: PacketType.LogHeader,
            content: this.buildLogHeaderContent()
        };
        this._internalWritePacket(packet);
    }

    /**
     * Connect to SmartInspect Console
     * Uses scheduler if async enabled
     */
    async connect() {
        if (this.asyncEnabled) {
            if (this._scheduler === null) {
                try {
                    this._startScheduler();
                    this._scheduleConnect();
                } catch (err) {
                    this._handleException(err.message);
                }
            }
            return;
        }

        // Synchronous connect
        await this.implConnect();
    }

    /**
     * Internal connect implementation (called by scheduler or directly)
     */
    async implConnect() {
        if (this.connected || !this._keepOpen) {
            return;
        }

        try {
            await this._internalConnect();
            this.connected = true;
            this._failed = false;
        } catch (err) {
            this._reset();
            this._handleException(err.message);
        }
    }

    /**
     * Low-level connect (creates socket and performs handshake)
     * @private
     */
    _internalConnect() {
        return new Promise((resolve, reject) => {
            if (this.connected) {
                resolve();
                return;
            }

            this.socket = new net.Socket();
            this.socket.setTimeout(this.timeout);

            let serverBanner = '';
            let handshakeComplete = false;
            let connectTimeout = null;

            const cleanup = () => {
                if (connectTimeout) {
                    clearTimeout(connectTimeout);
                    connectTimeout = null;
                }
            };

            // Set connection timeout
            connectTimeout = setTimeout(() => {
                cleanup();
                this.socket.destroy();
                reject(new Error(`Connection timeout after ${this.timeout}ms`));
            }, this.timeout);

            this.socket.on('data', (data) => {
                if (!handshakeComplete) {
                    serverBanner += data.toString('ascii');
                    if (serverBanner.includes('\n')) {
                        this.socket.write(CLIENT_BANNER);
                        handshakeComplete = true;
                        this.connected = true;

                        // Send LogHeader
                        this.sendLogHeader();

                        cleanup();
                        if (this.onConnect) {
                            this.onConnect(serverBanner.trim());
                        }
                        resolve(serverBanner.trim());
                    }
                }
            });

            this.socket.on('error', (err) => {
                cleanup();
                this.connected = false;
                if (this.onError) {
                    this.onError(err);
                }
                reject(err);
            });

            this.socket.on('timeout', () => {
                cleanup();
                const err = new Error('Socket timeout');
                if (this.onError) {
                    this.onError(err);
                }
                this.socket.destroy();
            });

            this.socket.on('close', () => {
                cleanup();
                this.connected = false;
                if (this.onDisconnect) {
                    this.onDisconnect();
                }
            });

            this.socket.connect(this.port, this.host);
        });
    }

    /**
     * Disconnect from SmartInspect Console
     */
    async disconnect() {
        if (this.asyncEnabled && this._scheduler !== null) {
            if (this.asyncClearOnDisconnect) {
                this._scheduler.clear();
            }
            this._scheduleDisconnect();
            await this._stopScheduler();
            return;
        }

        // Synchronous disconnect
        await this.implDisconnect();
    }

    /**
     * Internal disconnect implementation
     */
    async implDisconnect() {
        if (!this.connected) {
            this._queue.clear();
            return;
        }

        try {
            await this._reset();
        } catch (err) {
            this._handleException(err.message);
        }
    }

    /**
     * Low-level disconnect
     * @private
     */
    _internalDisconnect() {
        return new Promise((resolve) => {
            if (this.socket) {
                this.socket.once('close', () => {
                    this.socket = null;
                    this.connected = false;
                    resolve();
                });
                this.socket.destroy();
            } else {
                resolve();
            }
        });
    }

    /**
     * Write a packet to the connection
     * Uses scheduler if async enabled
     */
    writePacket(packet) {
        if (this.asyncEnabled && this._scheduler !== null) {
            this._scheduleWritePacket(packet);
            return;
        }

        // Synchronous write
        this.implWritePacket(packet);
    }

    /**
     * Write a packet with throttle support (async version)
     * @param {Object} packet
     * @returns {Promise<void>}
     */
    async writePacketAsync(packet) {
        if (this.asyncEnabled && this._scheduler !== null) {
            const cmd = new SchedulerCommand(SchedulerAction.WritePacket, packet);
            await this._scheduler.scheduleAsync(cmd);
            return;
        }

        this.implWritePacket(packet);
    }

    /**
     * Internal write packet implementation with backlog logic
     */
    async implWritePacket(packet) {
        // Skip if not connected and reconnect disabled and keepOpen true
        if (!this.connected && !this.reconnect && this._keepOpen) {
            return;
        }

        try {
            let queued = false;

            if (this.backlogEnabled) {
                const level = packet.level ?? Level.Message;

                if (level >= this.backlogFlushOn && level !== Level.Control) {
                    // High priority packet - flush queue first, then forward
                    await this._flushQueue();
                    await this._forwardPacket(packet, !this._keepOpen);
                } else {
                    // Normal packet - add to backlog queue
                    this._queue.push(packet);
                    queued = true;
                }
            }

            if (!queued) {
                await this._forwardPacket(packet, !this._keepOpen);
            }
        } catch (err) {
            this._reset();
            this._handleException(err.message);
        }
    }

    /**
     * Internal dispatch implementation (placeholder for protocol commands)
     */
    async implDispatch(command) {
        // Not implemented for TCP protocol
    }

    /**
     * Low-level packet write
     * @private
     */
    _internalWritePacket(packet) {
        const buffer = this.formatter.format(packet);
        if (buffer.length > 0 && this.socket) {
            this.socket.write(buffer);
        }
    }

    /**
     * Flush all packets from backlog queue
     * @private
     */
    async _flushQueue() {
        let packet = this._queue.pop();
        while (packet !== null) {
            await this._forwardPacket(packet, false);
            packet = this._queue.pop();
        }
    }

    /**
     * Forward a packet to the connection, optionally disconnecting after
     * @private
     */
    async _forwardPacket(packet, disconnectAfter) {
        if (!this.connected) {
            if (this._keepOpen) {
                await this._reconnect();
            } else {
                await this._internalConnect();
                this.connected = true;
                this._failed = false;
            }
        }

        if (this.connected) {
            this._internalWritePacket(packet);

            if (disconnectAfter) {
                this.connected = false;
                await this._internalDisconnect();
            }
        }
    }

    /**
     * Attempt reconnection with time-gating (like C# Protocol.Reconnect)
     * @private
     */
    async _reconnect() {
        const now = Date.now();

        // Check if enough time has passed since last attempt
        if (this.reconnectInterval > 0) {
            if ((now - this._reconnectTickCount) < this.reconnectInterval) {
                return; // Too soon to reconnect
            }
        }

        try {
            await this._internalConnect();
            this.connected = true;
            this._failed = false;
        } catch (err) {
            // Silent failure during reconnect (like C#)
            this._failed = true;
            try {
                await this._reset();
            } catch (e) {
                // Ignore reset errors
            }
        }

        this._reconnectTickCount = Date.now();
    }

    /**
     * Reset connection state
     * @private
     */
    async _reset() {
        this.connected = false;
        this._queue.clear();
        try {
            await this._internalDisconnect();
        } finally {
            this._reconnectTickCount = Date.now();
        }
    }

    /**
     * Handle exceptions - emit error in async mode, throw in sync mode
     * @private
     */
    _handleException(message) {
        this._failed = true;
        const err = new Error(message);

        if (this.asyncEnabled) {
            if (this.onError) {
                this.onError(err);
            }
        } else {
            throw err;
        }
    }

    /**
     * Start the scheduler for async processing
     * @private
     */
    _startScheduler() {
        this._scheduler = new Scheduler(this);
        this._scheduler.threshold = this.asyncQueue;
        this._scheduler.throttle = this.asyncThrottle;
        try {
            this._scheduler.start();
        } catch (err) {
            this._scheduler = null;
            throw err;
        }
    }

    /**
     * Stop the scheduler
     * @private
     */
    async _stopScheduler() {
        if (this._scheduler) {
            await this._scheduler.stop();
            this._scheduler = null;
        }
    }

    /**
     * Schedule a connect command
     * @private
     */
    _scheduleConnect() {
        const cmd = new SchedulerCommand(SchedulerAction.Connect);
        this._scheduler.schedule(cmd);
    }

    /**
     * Schedule a disconnect command
     * @private
     */
    _scheduleDisconnect() {
        const cmd = new SchedulerCommand(SchedulerAction.Disconnect);
        this._scheduler.schedule(cmd);
    }

    /**
     * Schedule a write packet command
     * @private
     */
    _scheduleWritePacket(packet) {
        const cmd = new SchedulerCommand(SchedulerAction.WritePacket, packet);
        this._scheduler.schedule(cmd);
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Get queue statistics
     */
    getQueueStats() {
        return {
            backlogCount: this._queue.count,
            backlogSize: this._queue.size,
            schedulerCount: this._scheduler?.queueCount || 0,
            schedulerSize: this._scheduler?.queueSize || 0
        };
    }

    /**
     * Reconnect (public API - disconnect then connect)
     */
    async reconnectNow() {
        await this.disconnect();
        return this.connect();
    }
}

/**
 * PipeProtocol - handles Named Pipe (Windows) or Unix Domain Socket (Linux/Unix) connection
 */
class PipeProtocol {
    constructor(options = {}) {
        this.pipeName = options.pipe || DEFAULT_PIPE_NAME;
        this.pipePath = options.pipePath || null;
        this.timeout = options.timeout || DEFAULT_TIMEOUT;
        this.appName = options.appName || 'Node.js App';
        this.hostName = options.hostName || os.hostname();
        this.room = options.room || 'default';

        this.socket = null;
        this.connected = false;
        this.formatter = new BinaryFormatter();

        // Event handlers
        this.onError = options.onError || null;
        this.onConnect = options.onConnect || null;
        this.onDisconnect = options.onDisconnect || null;

        // Reconnection settings (like C# Protocol) - enabled by default
        this.reconnect = options.reconnect ?? true;
        this.reconnectInterval = options.reconnectInterval ?? 3000; // ms (default 3s)
        this._reconnectTickCount = 0;

        // Backlog settings (like C# Protocol) - enabled by default
        this.backlogEnabled = options.backlog?.enabled ?? true;
        this.backlogQueue = (options.backlog?.queue || 2048) * 1024;
        this.backlogFlushOn = options.backlog?.flushOn ?? Level.Error;
        this.backlogKeepOpen = options.backlog?.keepOpen ?? true;

        // Async settings (like C# Protocol)
        this.asyncEnabled = options.async?.enabled || false;
        this.asyncQueue = (options.async?.queue || 2048) * 1024;
        this.asyncThrottle = options.async?.throttle ?? false;
        this.asyncClearOnDisconnect = options.async?.clearOnDisconnect || false;

        // Internal state
        this._queue = new PacketQueue();
        this._queue.backlog = this.backlogQueue;
        this._keepOpen = !this.backlogEnabled || this.backlogKeepOpen;
        this._scheduler = null;
        this._failed = false;
    }

    /**
     * Whether the protocol is in failed state
     * @type {boolean}
     */
    get failed() {
        return this._failed;
    }

    /**
     * Get the full pipe path based on platform
     */
    getPipePath() {
        if (this.pipePath) {
            return this.pipePath;
        }

        if (process.platform === 'win32') {
            return `\\\\.\\pipe\\${this.pipeName}`;
        } else {
            return `/tmp/${this.pipeName}.pipe`;
        }
    }

    /**
     * Build LogHeader content string
     */
    buildLogHeaderContent() {
        return `hostname=${this.hostName}\r\nappname=${this.appName}\r\nroom=${this.room}\r\n`;
    }

    /**
     * Send the initial LogHeader packet after connection
     */
    sendLogHeader() {
        const packet = {
            packetType: PacketType.LogHeader,
            content: this.buildLogHeaderContent()
        };
        this._internalWritePacket(packet);
    }

    /**
     * Connect to SmartInspect Console
     */
    async connect() {
        if (this.asyncEnabled) {
            if (this._scheduler === null) {
                try {
                    this._startScheduler();
                    this._scheduleConnect();
                } catch (err) {
                    this._handleException(err.message);
                }
            }
            return;
        }

        await this.implConnect();
    }

    /**
     * Internal connect implementation
     */
    async implConnect() {
        if (this.connected || !this._keepOpen) {
            return;
        }

        try {
            await this._internalConnect();
            this.connected = true;
            this._failed = false;
        } catch (err) {
            this._reset();
            this._handleException(err.message);
        }
    }

    /**
     * Low-level connect
     * @private
     */
    _internalConnect() {
        return new Promise((resolve, reject) => {
            if (this.connected) {
                resolve();
                return;
            }

            const pipePath = this.getPipePath();
            this.socket = net.connect(pipePath);
            this.socket.setTimeout(this.timeout);

            let serverBanner = '';
            let handshakeComplete = false;
            let connectTimeout = null;

            const cleanup = () => {
                if (connectTimeout) {
                    clearTimeout(connectTimeout);
                    connectTimeout = null;
                }
            };

            connectTimeout = setTimeout(() => {
                cleanup();
                this.socket.destroy();
                reject(new Error(`Connection timeout after ${this.timeout}ms`));
            }, this.timeout);

            this.socket.on('data', (data) => {
                if (!handshakeComplete) {
                    serverBanner += data.toString('ascii');
                    if (serverBanner.includes('\n')) {
                        this.socket.write(CLIENT_BANNER);
                        handshakeComplete = true;
                        this.connected = true;

                        this.sendLogHeader();

                        cleanup();
                        if (this.onConnect) {
                            this.onConnect(serverBanner.trim());
                        }
                        resolve(serverBanner.trim());
                    }
                }
            });

            this.socket.on('error', (err) => {
                cleanup();
                this.connected = false;
                if (this.onError) {
                    this.onError(err);
                }
                reject(err);
            });

            this.socket.on('timeout', () => {
                cleanup();
                const err = new Error('Socket timeout');
                if (this.onError) {
                    this.onError(err);
                }
                this.socket.destroy();
            });

            this.socket.on('close', () => {
                cleanup();
                this.connected = false;
                if (this.onDisconnect) {
                    this.onDisconnect();
                }
            });
        });
    }

    /**
     * Disconnect from SmartInspect Console
     */
    async disconnect() {
        if (this.asyncEnabled && this._scheduler !== null) {
            if (this.asyncClearOnDisconnect) {
                this._scheduler.clear();
            }
            this._scheduleDisconnect();
            await this._stopScheduler();
            return;
        }

        await this.implDisconnect();
    }

    /**
     * Internal disconnect implementation
     */
    async implDisconnect() {
        if (!this.connected) {
            this._queue.clear();
            return;
        }

        try {
            await this._reset();
        } catch (err) {
            this._handleException(err.message);
        }
    }

    /**
     * Low-level disconnect
     * @private
     */
    _internalDisconnect() {
        return new Promise((resolve) => {
            if (this.socket) {
                this.socket.once('close', () => {
                    this.socket = null;
                    this.connected = false;
                    resolve();
                });
                this.socket.destroy();
            } else {
                resolve();
            }
        });
    }

    /**
     * Write a packet to the connection
     */
    writePacket(packet) {
        if (this.asyncEnabled && this._scheduler !== null) {
            this._scheduleWritePacket(packet);
            return;
        }

        this.implWritePacket(packet);
    }

    /**
     * Write a packet with throttle support (async version)
     */
    async writePacketAsync(packet) {
        if (this.asyncEnabled && this._scheduler !== null) {
            const cmd = new SchedulerCommand(SchedulerAction.WritePacket, packet);
            await this._scheduler.scheduleAsync(cmd);
            return;
        }

        this.implWritePacket(packet);
    }

    /**
     * Internal write packet implementation with backlog logic
     */
    async implWritePacket(packet) {
        if (!this.connected && !this.reconnect && this._keepOpen) {
            return;
        }

        try {
            let queued = false;

            if (this.backlogEnabled) {
                const level = packet.level ?? Level.Message;

                if (level >= this.backlogFlushOn && level !== Level.Control) {
                    await this._flushQueue();
                    await this._forwardPacket(packet, !this._keepOpen);
                } else {
                    this._queue.push(packet);
                    queued = true;
                }
            }

            if (!queued) {
                await this._forwardPacket(packet, !this._keepOpen);
            }
        } catch (err) {
            this._reset();
            this._handleException(err.message);
        }
    }

    /**
     * Internal dispatch implementation
     */
    async implDispatch(command) {
        // Not implemented for Pipe protocol
    }

    /**
     * Low-level packet write
     * @private
     */
    _internalWritePacket(packet) {
        const buffer = this.formatter.format(packet);
        if (buffer.length > 0 && this.socket) {
            this.socket.write(buffer);
        }
    }

    /**
     * Flush all packets from backlog queue
     * @private
     */
    async _flushQueue() {
        let packet = this._queue.pop();
        while (packet !== null) {
            await this._forwardPacket(packet, false);
            packet = this._queue.pop();
        }
    }

    /**
     * Forward a packet to the connection
     * @private
     */
    async _forwardPacket(packet, disconnectAfter) {
        if (!this.connected) {
            if (this._keepOpen) {
                await this._reconnect();
            } else {
                await this._internalConnect();
                this.connected = true;
                this._failed = false;
            }
        }

        if (this.connected) {
            this._internalWritePacket(packet);

            if (disconnectAfter) {
                this.connected = false;
                await this._internalDisconnect();
            }
        }
    }

    /**
     * Attempt reconnection with time-gating
     * @private
     */
    async _reconnect() {
        const now = Date.now();

        if (this.reconnectInterval > 0) {
            if ((now - this._reconnectTickCount) < this.reconnectInterval) {
                return;
            }
        }

        try {
            await this._internalConnect();
            this.connected = true;
            this._failed = false;
        } catch (err) {
            this._failed = true;
            try {
                await this._reset();
            } catch (e) {
                // Ignore
            }
        }

        this._reconnectTickCount = Date.now();
    }

    /**
     * Reset connection state
     * @private
     */
    async _reset() {
        this.connected = false;
        this._queue.clear();
        try {
            await this._internalDisconnect();
        } finally {
            this._reconnectTickCount = Date.now();
        }
    }

    /**
     * Handle exceptions
     * @private
     */
    _handleException(message) {
        this._failed = true;
        const err = new Error(message);

        if (this.asyncEnabled) {
            if (this.onError) {
                this.onError(err);
            }
        } else {
            throw err;
        }
    }

    /**
     * Start scheduler
     * @private
     */
    _startScheduler() {
        this._scheduler = new Scheduler(this);
        this._scheduler.threshold = this.asyncQueue;
        this._scheduler.throttle = this.asyncThrottle;
        try {
            this._scheduler.start();
        } catch (err) {
            this._scheduler = null;
            throw err;
        }
    }

    /**
     * Stop scheduler
     * @private
     */
    async _stopScheduler() {
        if (this._scheduler) {
            await this._scheduler.stop();
            this._scheduler = null;
        }
    }

    /**
     * Schedule connect
     * @private
     */
    _scheduleConnect() {
        const cmd = new SchedulerCommand(SchedulerAction.Connect);
        this._scheduler.schedule(cmd);
    }

    /**
     * Schedule disconnect
     * @private
     */
    _scheduleDisconnect() {
        const cmd = new SchedulerCommand(SchedulerAction.Disconnect);
        this._scheduler.schedule(cmd);
    }

    /**
     * Schedule write packet
     * @private
     */
    _scheduleWritePacket(packet) {
        const cmd = new SchedulerCommand(SchedulerAction.WritePacket, packet);
        this._scheduler.schedule(cmd);
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Get queue statistics
     */
    getQueueStats() {
        return {
            backlogCount: this._queue.count,
            backlogSize: this._queue.size,
            schedulerCount: this._scheduler?.queueCount || 0,
            schedulerSize: this._scheduler?.queueSize || 0
        };
    }

    /**
     * Reconnect (public API)
     */
    async reconnectNow() {
        await this.disconnect();
        return this.connect();
    }
}

/**
 * Auto-detect Windows host IP when running in WSL
 */
async function detectWindowsHost() {
    const fs = require('fs');

    try {
        const version = fs.readFileSync('/proc/version', 'utf8');
        if (version.toLowerCase().includes('microsoft')) {
            const { execSync } = require('child_process');
            try {
                const route = execSync('ip route | grep default', { encoding: 'utf8' });
                const match = route.match(/default via (\d+\.\d+\.\d+\.\d+)/);
                if (match) {
                    return match[1];
                }
            } catch (e) {
                // Fallback
            }
        }
    } catch (e) {
        // Not in WSL
    }

    return '127.0.0.1';
}

module.exports = { TcpProtocol, PipeProtocol, detectWindowsHost };
