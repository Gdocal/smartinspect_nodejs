/**
 * Mock SmartInspect TCP Server for Testing
 *
 * Simulates the SmartInspect Console TCP server for unit testing
 * without requiring a real SmartInspect Console to be running.
 */

const net = require('net');

const SERVER_BANNER = 'SmartInspect Mock Server v1.0.0\n';

/**
 * MockSmartInspectServer - simulates SmartInspect Console for testing
 */
class MockSmartInspectServer {
    constructor(options = {}) {
        this.port = options.port || 0; // 0 = auto-assign
        this.server = null;
        this.clients = [];
        this.packets = [];
        this.onPacket = options.onPacket || null;
        this.onClientConnect = options.onClientConnect || null;
        this.onClientDisconnect = options.onClientDisconnect || null;
        this.delayHandshake = options.delayHandshake || 0;
        this.rejectConnection = options.rejectConnection || false;
        this.closeAfterPackets = options.closeAfterPackets || 0;
        this._packetCount = 0;
    }

    /**
     * Start the server
     * @returns {Promise<number>} The port the server is listening on
     */
    start() {
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => {
                this._handleClient(socket);
            });

            this.server.on('error', reject);

            this.server.listen(this.port, '127.0.0.1', () => {
                this.port = this.server.address().port;
                resolve(this.port);
            });
        });
    }

    /**
     * Stop the server
     */
    async stop() {
        // Close all client connections
        for (const client of this.clients) {
            client.destroy();
        }
        this.clients = [];

        // Close the server
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.server = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Handle a new client connection
     * @private
     */
    _handleClient(socket) {
        if (this.rejectConnection) {
            socket.destroy();
            return;
        }

        this.clients.push(socket);

        let handshakeComplete = false;
        let buffer = Buffer.alloc(0);

        // Send server banner (optionally delayed)
        const sendBanner = () => {
            socket.write(SERVER_BANNER);
        };

        if (this.delayHandshake > 0) {
            setTimeout(sendBanner, this.delayHandshake);
        } else {
            sendBanner();
        }

        socket.on('data', (data) => {
            if (!handshakeComplete) {
                // Wait for client banner
                const str = data.toString('ascii');
                if (str.includes('\n')) {
                    handshakeComplete = true;
                    if (this.onClientConnect) {
                        this.onClientConnect(socket);
                    }
                    // Any remaining data after banner is packet data
                    const newlineIndex = data.indexOf(0x0A);
                    if (newlineIndex < data.length - 1) {
                        buffer = data.slice(newlineIndex + 1);
                        this._processBuffer(socket, buffer);
                    }
                }
                return;
            }

            // Append to buffer and process
            buffer = Buffer.concat([buffer, data]);
            buffer = this._processBuffer(socket, buffer);
        });

        socket.on('close', () => {
            const index = this.clients.indexOf(socket);
            if (index >= 0) {
                this.clients.splice(index, 1);
            }
            if (this.onClientDisconnect) {
                this.onClientDisconnect(socket);
            }
        });

        socket.on('error', () => {
            // Ignore errors
        });
    }

    /**
     * Process buffer and extract packets
     * SmartInspect packet format: 2-byte type + 4-byte size + data
     * @private
     */
    _processBuffer(socket, buffer) {
        while (buffer.length >= 6) {
            const packetType = buffer.readUInt16LE(0);
            const dataSize = buffer.readUInt32LE(2);
            const totalSize = 6 + dataSize;

            if (buffer.length < totalSize) {
                break; // Wait for more data
            }

            const packetData = buffer.slice(6, totalSize);
            const packet = {
                type: packetType,
                size: dataSize,
                data: packetData,
                socket: socket
            };

            this.packets.push(packet);
            this._packetCount++;

            if (this.onPacket) {
                this.onPacket(packet);
            }

            // Optionally close after N packets (for testing disconnection)
            if (this.closeAfterPackets > 0 && this._packetCount >= this.closeAfterPackets) {
                socket.destroy();
            }

            buffer = buffer.slice(totalSize);
        }

        return buffer;
    }

    /**
     * Get all received packets
     */
    getPackets() {
        return this.packets;
    }

    /**
     * Clear received packets
     */
    clearPackets() {
        this.packets = [];
    }

    /**
     * Get packet count
     */
    getPacketCount() {
        return this.packets.length;
    }

    /**
     * Force disconnect all clients
     */
    disconnectAll() {
        for (const client of this.clients) {
            client.destroy();
        }
    }

    /**
     * Wait for a specific number of packets
     * @param {number} count - Number of packets to wait for
     * @param {number} timeout - Timeout in ms
     */
    waitForPackets(count, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const check = () => {
                if (this.packets.length >= count) {
                    resolve(this.packets.slice(0, count));
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error(`Timeout waiting for ${count} packets, got ${this.packets.length}`));
                } else {
                    setTimeout(check, 10);
                }
            };

            check();
        });
    }

    /**
     * Wait for client connection
     */
    waitForClient(timeout = 5000) {
        return new Promise((resolve, reject) => {
            if (this.clients.length > 0) {
                resolve(this.clients[0]);
                return;
            }

            const startTime = Date.now();
            const originalCallback = this.onClientConnect;

            this.onClientConnect = (socket) => {
                this.onClientConnect = originalCallback;
                if (originalCallback) originalCallback(socket);
                resolve(socket);
            };

            // Also set a timeout
            const timeoutId = setTimeout(() => {
                this.onClientConnect = originalCallback;
                reject(new Error('Timeout waiting for client connection'));
            }, timeout);

            // Clear timeout if resolved
            const origOnClientConnect = this.onClientConnect;
            this.onClientConnect = (socket) => {
                clearTimeout(timeoutId);
                origOnClientConnect(socket);
            };
        });
    }
}

module.exports = { MockSmartInspectServer };
