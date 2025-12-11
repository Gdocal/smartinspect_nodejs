/**
 * SmartInspect Main Class
 * Central configuration and connection management
 */

const os = require('os');
const { EventEmitter } = require('events');
const { TcpProtocol, PipeProtocol, detectWindowsHost } = require('./protocol');
const { Session } = require('./session');
const { Level } = require('./enums');

/**
 * SmartInspect - main class for managing logging
 */
class SmartInspect extends EventEmitter {
    constructor(appName = 'Node.js App') {
        super();

        this.appName = appName;
        this.hostName = os.hostname();
        this.room = 'default'; // Room for log isolation (multi-project support)
        this.enabled = false;
        this.level = Level.Debug;
        this.defaultLevel = Level.Message;

        this.protocol = null;
        this.sessions = new Map();
        this._connectionOptions = null; // Store connection options for reconnect

        // Create default session
        this.mainSession = new Session(this, 'Main');
        this.sessions.set('Main', this.mainSession);
    }

    /**
     * Connect to SmartInspect Console
     * @param {Object|string} options - Connection options or connection string
     *
     * Options:
     * - host: TCP host (default: auto-detect for WSL, otherwise 127.0.0.1)
     * - port: TCP port (default: 4228)
     * - pipe: Named pipe name
     * - pipePath: Explicit pipe path
     * - timeout: Connection timeout in ms (default: 30000)
     * - room: Log room name (default: 'default')
     *
     * Async options:
     * - async.enabled: Enable async scheduler (default: false)
     * - async.queue: Max async queue size in KB (default: 2048)
     * - async.throttle: Block callers when queue full (default: false)
     * - async.clearOnDisconnect: Clear queue on disconnect (default: false)
     *
     * Backlog options:
     * - backlog.enabled: Enable packet buffering (default: false)
     * - backlog.queue: Max backlog size in KB (default: 2048)
     * - backlog.flushOn: Log level that triggers flush (default: Level.Error)
     * - backlog.keepOpen: Keep connection open (default: false)
     *
     * Reconnect options:
     * - reconnect: Enable auto-reconnect (default: false)
     * - reconnectInterval: Min time between reconnect attempts in ms (default: 0)
     */
    async connect(options = {}) {
        if (typeof options === 'string') {
            options = this.parseConnectionString(options);
        }

        // Store connection options for reconnect via setEnabled()
        this._connectionOptions = { ...options };

        // Set room if provided in options
        if (options.room) {
            this.room = options.room;
        }

        // Build common protocol options
        const protocolOptions = {
            timeout: options.timeout || 30000,
            appName: this.appName,
            hostName: this.hostName,
            room: this.room,
            // Only emit 'error' if there are listeners - prevents crash when server unavailable
            // This matches C# behavior where OnError silently ignores if no handler registered
            onError: (err) => {
                if (this.listenerCount('error') > 0) {
                    this.emit('error', err);
                }
                // Silently ignore if no listeners (like C#)
            },
            onConnect: (banner) => this.emit('connect', banner),
            onDisconnect: () => this.emit('disconnect'),
            // Async options
            async: options.async,
            // Backlog options
            backlog: options.backlog,
            // Reconnect options
            reconnect: options.reconnect,
            reconnectInterval: options.reconnectInterval
        };

        // Choose protocol based on options
        if (options.pipe || options.pipePath) {
            // Use Pipe protocol (Named Pipe on Windows, Unix socket on Linux)
            this.protocol = new PipeProtocol({
                ...protocolOptions,
                pipe: options.pipe,
                pipePath: options.pipePath
            });
        } else {
            // Use TCP protocol (default)
            // Auto-detect Windows host if in WSL and no host specified
            if (!options.host) {
                options.host = await detectWindowsHost();
            }

            this.protocol = new TcpProtocol({
                ...protocolOptions,
                host: options.host || '127.0.0.1',
                port: options.port || 4228
            });
        }

        // Enable BEFORE await to allow backlog buffering during fire-and-forget connect
        // The protocol will buffer messages until the connection is established
        this.enabled = true;

        await this.protocol.connect();

        return this;
    }

    /**
     * Parse a connection string like "tcp(host=localhost,port=4228,room=myproject)"
     * or "pipe(name=smartinspect)"
     * Supports new options: async.*, backlog.*, reconnect.*
     */
    parseConnectionString(str) {
        const options = {
            async: {},
            backlog: {}
        };

        // Match tcp(options) or pipe(options) format
        const protocolMatch = str.match(/(tcp|pipe)\(([^)]+)\)/i);
        if (!protocolMatch) {
            return options;
        }

        const protocol = protocolMatch[1].toLowerCase();
        const pairs = protocolMatch[2].split(',');

        for (const pair of pairs) {
            const eqIndex = pair.indexOf('=');
            if (eqIndex === -1) continue;

            const key = pair.substring(0, eqIndex).trim().toLowerCase();
            const value = pair.substring(eqIndex + 1).trim();

            // Basic options
            if (key === 'host') options.host = value;
            else if (key === 'port') options.port = parseInt(value, 10);
            else if (key === 'timeout') options.timeout = parseInt(value, 10);
            else if (key === 'room') options.room = value;
            else if (key === 'name' || key === 'pipe') options.pipe = value;

            // Async options
            else if (key === 'async.enabled') options.async.enabled = this._parseBoolean(value);
            else if (key === 'async.queue') options.async.queue = parseInt(value, 10);
            else if (key === 'async.throttle') options.async.throttle = this._parseBoolean(value);
            else if (key === 'async.clearondisconnect') options.async.clearOnDisconnect = this._parseBoolean(value);

            // Backlog options
            else if (key === 'backlog.enabled') options.backlog.enabled = this._parseBoolean(value);
            else if (key === 'backlog.queue') options.backlog.queue = parseInt(value, 10);
            else if (key === 'backlog.flushon') options.backlog.flushOn = this._parseLevel(value);
            else if (key === 'backlog.keepopen') options.backlog.keepOpen = this._parseBoolean(value);

            // Shorthand backlog (like C#: backlog=2048 enables backlog with that size)
            else if (key === 'backlog') {
                const size = parseInt(value, 10);
                if (size > 0) {
                    options.backlog.enabled = true;
                    options.backlog.queue = size;
                } else {
                    options.backlog.enabled = false;
                }
            }

            // Reconnect options
            else if (key === 'reconnect') options.reconnect = this._parseBoolean(value);
            else if (key === 'reconnect.interval') options.reconnectInterval = parseInt(value, 10);
        }

        // Clean up empty nested objects
        if (Object.keys(options.async).length === 0) delete options.async;
        if (Object.keys(options.backlog).length === 0) delete options.backlog;

        return options;
    }

    /**
     * Parse boolean from string
     * @private
     */
    _parseBoolean(value) {
        return value.toLowerCase() === 'true' || value === '1';
    }

    /**
     * Parse log level from string
     * @private
     */
    _parseLevel(value) {
        const levels = {
            'debug': Level.Debug,
            'verbose': Level.Verbose,
            'message': Level.Message,
            'warning': Level.Warning,
            'error': Level.Error,
            'fatal': Level.Fatal,
            'control': Level.Control
        };
        return levels[value.toLowerCase()] ?? Level.Error;
    }

    /**
     * Disconnect from SmartInspect Console
     */
    async disconnect() {
        if (this.protocol) {
            await this.protocol.disconnect();
            this.protocol = null;
        }
        this.enabled = false;
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.protocol && this.protocol.isConnected();
    }

    /**
     * Send a packet
     * In async/backlog mode, packets may be queued for later delivery
     */
    sendPacket(packet) {
        if (!this.enabled || !this.protocol) {
            return;
        }

        try {
            // Let the protocol handle buffering/queueing in async mode
            // Don't check isConnected() here - protocol handles that internally
            this.protocol.writePacket(packet);
        } catch (err) {
            // Only emit 'error' if there are listeners - prevents crash
            if (this.listenerCount('error') > 0) {
                this.emit('error', err);
            }
        }
    }

    /**
     * Get queue statistics (for monitoring)
     */
    getQueueStats() {
        if (this.protocol && typeof this.protocol.getQueueStats === 'function') {
            return this.protocol.getQueueStats();
        }
        return { backlogCount: 0, backlogSize: 0, schedulerCount: 0, schedulerSize: 0 };
    }

    /**
     * Get or create a session
     */
    getSession(name) {
        if (!this.sessions.has(name)) {
            const session = new Session(this, name);
            this.sessions.set(name, session);
        }
        return this.sessions.get(name);
    }

    /**
     * Add a new session
     */
    addSession(name) {
        return this.getSession(name);
    }

    /**
     * Delete a session
     */
    deleteSession(name) {
        if (name !== 'Main') {
            this.sessions.delete(name);
        }
    }

    /**
     * Set the global log level
     */
    setLevel(level) {
        if (typeof level === 'string') {
            const levelMap = {
                debug: Level.Debug,
                verbose: Level.Verbose,
                message: Level.Message,
                warning: Level.Warning,
                error: Level.Error,
                fatal: Level.Fatal
            };
            this.level = levelMap[level.toLowerCase()] ?? Level.Debug;
        } else {
            this.level = level;
        }
    }

    /**
     * Enable/disable logging (like C# SmartInspect.Enabled property)
     * - When disabled: disconnects from the server
     * - When enabled: reconnects using stored connection options
     */
    async setEnabled(enabled) {
        if (enabled === this.enabled) {
            return; // No change
        }

        if (enabled) {
            // Enable: reconnect if we have stored connection options
            this.enabled = true;
            if (this._connectionOptions && !this.isConnected()) {
                await this.connect(this._connectionOptions);
            }
        } else {
            // Disable: disconnect but keep connection options for later reconnect
            this.enabled = false;
            if (this.protocol) {
                await this.protocol.disconnect();
                this.protocol = null;
            }
        }
    }

    // ==================== Convenience proxy methods to main session ====================

    logMessage(...args) { this.mainSession.logMessage(...args); }
    logDebug(...args) { this.mainSession.logDebug(...args); }
    logVerbose(...args) { this.mainSession.logVerbose(...args); }
    logWarning(...args) { this.mainSession.logWarning(...args); }
    logError(...args) { this.mainSession.logError(...args); }
    logFatal(...args) { this.mainSession.logFatal(...args); }
    logException(...args) { this.mainSession.logException(...args); }

    logObject(...args) { this.mainSession.logObject(...args); }
    logArray(...args) { this.mainSession.logArray(...args); }
    logDictionary(...args) { this.mainSession.logDictionary(...args); }
    logTable(...args) { this.mainSession.logTable(...args); }

    logText(...args) { this.mainSession.logText(...args); }
    logJson(...args) { this.mainSession.logJson(...args); }
    logHtml(...args) { this.mainSession.logHtml(...args); }
    logXml(...args) { this.mainSession.logXml(...args); }
    logSql(...args) { this.mainSession.logSql(...args); }
    logJavaScript(...args) { this.mainSession.logJavaScript(...args); }
    logBinary(...args) { this.mainSession.logBinary(...args); }

    logValue(...args) { this.mainSession.logValue(...args); }
    logString(...args) { this.mainSession.logString(...args); }
    logInt(...args) { this.mainSession.logInt(...args); }
    logNumber(...args) { this.mainSession.logNumber(...args); }
    logBool(...args) { this.mainSession.logBool(...args); }
    logDateTime(...args) { this.mainSession.logDateTime(...args); }

    logSeparator() { this.mainSession.logSeparator(); }
    logColored(...args) { this.mainSession.logColored(...args); }

    addCheckpoint(...args) { this.mainSession.addCheckpoint(...args); }
    incCounter(...args) { this.mainSession.incCounter(...args); }
    decCounter(...args) { this.mainSession.decCounter(...args); }

    watch(...args) { this.mainSession.watch(...args); }
    watchString(...args) { this.mainSession.watchString(...args); }
    watchInt(...args) { this.mainSession.watchInt(...args); }
    watchFloat(...args) { this.mainSession.watchFloat(...args); }
    watchBool(...args) { this.mainSession.watchBool(...args); }

    enterMethod(...args) { this.mainSession.enterMethod(...args); }
    leaveMethod(...args) { this.mainSession.leaveMethod(...args); }
    trackMethod(...args) { return this.mainSession.trackMethod(...args); }
    wrapMethod(...args) { return this.mainSession.wrapMethod(...args); }

    enterProcess(...args) { this.mainSession.enterProcess(...args); }
    leaveProcess(...args) { this.mainSession.leaveProcess(...args); }
    enterThread(...args) { this.mainSession.enterThread(...args); }
    leaveThread(...args) { this.mainSession.leaveThread(...args); }

    clearAll() { this.mainSession.clearAll(); }
    clearLog() { this.mainSession.clearLog(); }
    clearWatches() { this.mainSession.clearWatches(); }
    clearAutoViews() { this.mainSession.clearAutoViews(); }
    clearProcessFlow() { this.mainSession.clearProcessFlow(); }

    logAssert(...args) { this.mainSession.logAssert(...args); }
    logConditional(...args) { this.mainSession.logConditional(...args); }

    logSystem(...args) { this.mainSession.logSystem(...args); }
    logMemory(...args) { this.mainSession.logMemory(...args); }
    logStackTrace(...args) { this.mainSession.logStackTrace(...args); }
    logEnvironment(...args) { this.mainSession.logEnvironment(...args); }

    timeStart(...args) { this.mainSession.timeStart(...args); }
    timeEnd(...args) { this.mainSession.timeEnd(...args); }
}

// Singleton instance (like SiAuto in C#)
let defaultInstance = null;

/**
 * Get the default SmartInspect instance
 */
function getDefault() {
    if (!defaultInstance) {
        defaultInstance = new SmartInspect('Node.js App');
    }
    return defaultInstance;
}

/**
 * Get the main session from the default instance
 */
function getMainSession() {
    return getDefault().mainSession;
}

module.exports = {
    SmartInspect,
    getDefault,
    getMainSession
};
