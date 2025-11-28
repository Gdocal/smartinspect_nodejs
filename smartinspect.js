/**
 * SmartInspect Node.js Proof of Concept
 * Simple TCP connection to SmartInspect Console
 */

const net = require('net');
const os = require('os');

// SmartInspect packet types
const PacketType = {
    ControlCommand: 1,
    LogEntry: 4,
    Watch: 5,
    ProcessFlow: 6,
    LogHeader: 7
};

// Log entry types
const LogEntryType = {
    Separator: 0,
    EnterMethod: 1,
    LeaveMethod: 2,
    ResetCallstack: 3,
    Message: 100,
    Warning: 101,
    Error: 102,
    InternalError: 103,
    Comment: 104,
    Debug: 107,
    Verbose: 108,
    Fatal: 109
};

// Viewer IDs
const ViewerId = {
    None: -1,
    Title: 0,
    Data: 1,
    List: 2
};

// Constants for timestamp conversion (from C# ticks to SmartInspect format)
const TICKS_OFFSET = 0x89f7ff5f7b58000n; // .NET epoch offset
const MICROSECONDS_PER_DAY = 86400000000n;
const DAY_OFFSET = 25569; // Days between 1899-12-30 and 1970-01-01

class SmartInspectClient {
    constructor(options = {}) {
        this.host = options.host || '127.0.0.1';
        this.port = options.port || 4228;
        this.appName = options.appName || 'NodeJS App';
        this.hostName = options.hostName || os.hostname();
        this.socket = null;
        this.connected = false;
    }

    /**
     * Write a 16-bit integer (little endian)
     */
    writeInt16(value) {
        const buf = Buffer.alloc(2);
        buf.writeInt16LE(value, 0);
        return buf;
    }

    /**
     * Write a 32-bit integer (little endian)
     */
    writeInt32(value) {
        const buf = Buffer.alloc(4);
        buf.writeInt32LE(value, 0);
        return buf;
    }

    /**
     * Write a 64-bit double (little endian) - for timestamps
     */
    writeDouble(value) {
        const buf = Buffer.alloc(8);
        buf.writeDoubleLE(value, 0);
        return buf;
    }

    /**
     * Convert JavaScript Date to SmartInspect timestamp format
     * SmartInspect uses OLE Automation date format (days since 1899-12-30)
     */
    dateToTimestamp(date) {
        const ms = date.getTime();
        const days = ms / 86400000 + DAY_OFFSET;
        return days;
    }

    /**
     * Build LogHeader packet
     */
    buildLogHeader() {
        const content = `hostname=${this.hostName}\r\nappname=${this.appName}\r\n`;
        const contentBytes = Buffer.from(content, 'utf8');

        // LogHeader format: [length(4)] [content]
        const data = Buffer.concat([
            this.writeInt32(contentBytes.length),
            contentBytes
        ]);

        return this.buildPacket(PacketType.LogHeader, data);
    }

    /**
     * Build LogEntry packet
     */
    buildLogEntry(title, logEntryType = LogEntryType.Message, sessionName = 'Main') {
        const appNameBytes = Buffer.from(this.appName, 'utf8');
        const sessionNameBytes = Buffer.from(sessionName, 'utf8');
        const titleBytes = Buffer.from(title, 'utf8');
        const hostNameBytes = Buffer.from(this.hostName, 'utf8');

        const timestamp = this.dateToTimestamp(new Date());
        const processId = process.pid;
        const threadId = 0; // Node.js main thread

        // Color: transparent (ARGB format: 0x00000000)
        const color = 0x00000000;

        // LogEntry binary format from BinaryFormatter.CompileLogEntry:
        // [logEntryType(4)] [viewerId(4)]
        // [appNameLen(4)] [sessionNameLen(4)] [titleLen(4)] [hostNameLen(4)] [dataLen(4)]
        // [processId(4)] [threadId(4)] [timestamp(8)] [color(4)]
        // [appName] [sessionName] [title] [hostName] [data]

        const data = Buffer.concat([
            this.writeInt32(logEntryType),
            this.writeInt32(ViewerId.Title),
            this.writeInt32(appNameBytes.length),
            this.writeInt32(sessionNameBytes.length),
            this.writeInt32(titleBytes.length),
            this.writeInt32(hostNameBytes.length),
            this.writeInt32(0), // data length (no extra data)
            this.writeInt32(processId),
            this.writeInt32(threadId),
            this.writeDouble(timestamp),
            this.writeInt32(color),
            appNameBytes,
            sessionNameBytes,
            titleBytes,
            hostNameBytes
        ]);

        return this.buildPacket(PacketType.LogEntry, data);
    }

    /**
     * Build a complete packet with header
     * Format: [packetType(2)] [dataSize(4)] [data]
     */
    buildPacket(packetType, data) {
        return Buffer.concat([
            this.writeInt16(packetType),
            this.writeInt32(data.length),
            data
        ]);
    }

    /**
     * Connect to SmartInspect Console
     */
    connect() {
        return new Promise((resolve, reject) => {
            this.socket = new net.Socket();
            this.socket.setTimeout(30000);

            let serverBanner = '';
            let handshakeComplete = false;

            this.socket.on('data', (data) => {
                if (!handshakeComplete) {
                    // Read server banner until newline
                    serverBanner += data.toString('ascii');
                    if (serverBanner.includes('\n')) {
                        console.log('Server banner:', serverBanner.trim());

                        // Send client banner
                        const clientBanner = 'SmartInspect Node.js Library v1.0.0\n';
                        this.socket.write(clientBanner);

                        handshakeComplete = true;

                        // Send LogHeader
                        const logHeader = this.buildLogHeader();
                        this.socket.write(logHeader);

                        this.connected = true;
                        resolve();
                    }
                } else {
                    // Server acknowledgment (2 bytes per packet)
                    // Just consume it
                }
            });

            this.socket.on('error', (err) => {
                reject(err);
            });

            this.socket.on('timeout', () => {
                reject(new Error('Connection timeout'));
            });

            this.socket.on('close', () => {
                this.connected = false;
            });

            console.log(`Connecting to ${this.host}:${this.port}...`);
            this.socket.connect(this.port, this.host);
        });
    }

    /**
     * Send a log message
     */
    log(message, level = LogEntryType.Message) {
        if (!this.connected) {
            throw new Error('Not connected');
        }
        const packet = this.buildLogEntry(message, level);
        this.socket.write(packet);
    }

    /**
     * Convenience methods for different log levels
     */
    logMessage(message) { this.log(message, LogEntryType.Message); }
    logWarning(message) { this.log(message, LogEntryType.Warning); }
    logError(message) { this.log(message, LogEntryType.Error); }
    logDebug(message) { this.log(message, LogEntryType.Debug); }

    /**
     * Close the connection
     */
    close() {
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
            this.connected = false;
        }
    }
}

module.exports = { SmartInspectClient, LogEntryType, ViewerId, PacketType };
