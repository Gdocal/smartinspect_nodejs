/**
 * SmartInspect Protocol
 * Handles TCP connection and packet transmission
 */

const net = require('net');
const os = require('os');
const { BinaryFormatter } = require('./formatter');
const { PacketType } = require('./enums');

const CLIENT_BANNER = 'SmartInspect Node.js Library v1.0.0\n';
const DEFAULT_TIMEOUT = 30000;
const ANSWER_SIZE = 2;

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
        this.room = options.room || 'default'; // Room for log isolation

        this.socket = null;
        this.connected = false;
        this.formatter = new BinaryFormatter();

        // Event handlers
        this.onError = options.onError || null;
        this.onConnect = options.onConnect || null;
        this.onDisconnect = options.onDisconnect || null;
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
        this.writePacket(packet);
    }

    /**
     * Connect to SmartInspect Console
     */
    connect() {
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
                    // Read server banner until newline
                    serverBanner += data.toString('ascii');
                    if (serverBanner.includes('\n')) {
                        // Send client banner
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
                // After handshake, data is server acknowledgments (2 bytes per packet)
                // We just consume them
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
    disconnect() {
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
        if (!this.connected || !this.socket) {
            throw new Error('Not connected');
        }

        const buffer = this.formatter.format(packet);
        if (buffer.length > 0) {
            this.socket.write(buffer);
        }
    }

    /**
     * Check if connected
     */
    isConnected() {
        return this.connected;
    }

    /**
     * Reconnect (disconnect then connect)
     */
    async reconnect() {
        await this.disconnect();
        return this.connect();
    }
}

/**
 * Auto-detect Windows host IP when running in WSL
 */
async function detectWindowsHost() {
    const fs = require('fs');

    // Check if we're in WSL
    try {
        const version = fs.readFileSync('/proc/version', 'utf8');
        if (version.toLowerCase().includes('microsoft')) {
            // Try to get the gateway IP (Windows host)
            const { execSync } = require('child_process');
            try {
                const route = execSync('ip route | grep default', { encoding: 'utf8' });
                const match = route.match(/default via (\d+\.\d+\.\d+\.\d+)/);
                if (match) {
                    return match[1];
                }
            } catch (e) {
                // Fallback to common WSL2 gateway
            }
        }
    } catch (e) {
        // Not in WSL
    }

    return '127.0.0.1';
}

module.exports = { TcpProtocol, detectWindowsHost };
