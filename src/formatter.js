/**
 * SmartInspect Binary Formatter
 * Handles serialization of packets into binary format
 */

const { PacketType } = require('./enums');

// Constants for timestamp conversion
// .NET ticks epoch: January 1, 0001
// JavaScript epoch: January 1, 1970
// OLE Automation Date epoch: December 30, 1899
const TICKS_OFFSET = BigInt('0x89f7ff5f7b58000'); // .NET epoch to 1970
const MICROSECONDS_PER_DAY = BigInt('86400000000');
const DAY_OFFSET = 25569; // Days between 1899-12-30 and 1970-01-01

/**
 * BinaryFormatter - serializes packets to SmartInspect binary format
 */
class BinaryFormatter {
    constructor() {
        this.buffer = Buffer.alloc(8192);
        this.stream = null;
        this.size = 0;
    }

    /**
     * Write a 16-bit signed integer (little endian)
     */
    writeInt16(value) {
        const buf = Buffer.alloc(2);
        buf.writeInt16LE(value, 0);
        return buf;
    }

    /**
     * Write a 32-bit signed integer (little endian)
     */
    writeInt32(value) {
        const buf = Buffer.alloc(4);
        buf.writeInt32LE(value, 0);
        return buf;
    }

    /**
     * Write a 32-bit unsigned integer (little endian) - used for color
     */
    writeUInt32(value) {
        const buf = Buffer.alloc(4);
        buf.writeUInt32LE(value >>> 0, 0);
        return buf;
    }

    /**
     * Write a 64-bit double (little endian)
     */
    writeDouble(value) {
        const buf = Buffer.alloc(8);
        buf.writeDoubleLE(value, 0);
        return buf;
    }

    /**
     * Encode string to UTF-8 bytes
     */
    encodeString(value) {
        if (value == null) return null;
        return Buffer.from(value, 'utf8');
    }

    /**
     * Convert JavaScript Date to SmartInspect timestamp (OLE Automation Date)
     * OLE Automation Date is days since December 30, 1899 as a double
     */
    dateToTimestamp(date) {
        const ms = date.getTime();
        const days = ms / 86400000 + DAY_OFFSET;
        return days;
    }

    /**
     * Convert color object to 32-bit integer (ARGB format, little-endian storage)
     */
    colorToInt(color) {
        if (!color) return 0;
        return ((color.r || 0) |
                ((color.g || 0) << 8) |
                ((color.b || 0) << 16) |
                ((color.a || 0) << 24)) >>> 0;
    }

    /**
     * Compile a LogHeader packet
     */
    compileLogHeader(packet) {
        const contentBytes = this.encodeString(packet.content);
        const parts = [
            this.writeInt32(contentBytes ? contentBytes.length : 0)
        ];
        if (contentBytes) {
            parts.push(contentBytes);
        }
        return Buffer.concat(parts);
    }

    /**
     * Compile a LogEntry packet
     */
    compileLogEntry(packet) {
        const appNameBytes = this.encodeString(packet.appName);
        const sessionNameBytes = this.encodeString(packet.sessionName);
        const titleBytes = this.encodeString(packet.title);
        const hostNameBytes = this.encodeString(packet.hostName);
        const dataBytes = packet.data || null;

        const timestamp = this.dateToTimestamp(packet.timestamp || new Date());
        const colorInt = this.colorToInt(packet.color);

        // LogEntry binary format:
        // [logEntryType(4)] [viewerId(4)]
        // [appNameLen(4)] [sessionNameLen(4)] [titleLen(4)] [hostNameLen(4)] [dataLen(4)]
        // [processId(4)] [threadId(4)] [timestamp(8)] [color(4)]
        // [appName] [sessionName] [title] [hostName] [data]

        const parts = [
            this.writeInt32(packet.logEntryType),
            this.writeInt32(packet.viewerId),
            this.writeInt32(appNameBytes ? appNameBytes.length : 0),
            this.writeInt32(sessionNameBytes ? sessionNameBytes.length : 0),
            this.writeInt32(titleBytes ? titleBytes.length : 0),
            this.writeInt32(hostNameBytes ? hostNameBytes.length : 0),
            this.writeInt32(dataBytes ? dataBytes.length : 0),
            this.writeInt32(packet.processId || 0),
            this.writeInt32(packet.threadId || 0),
            this.writeDouble(timestamp),
            this.writeUInt32(colorInt)
        ];

        if (appNameBytes) parts.push(appNameBytes);
        if (sessionNameBytes) parts.push(sessionNameBytes);
        if (titleBytes) parts.push(titleBytes);
        if (hostNameBytes) parts.push(hostNameBytes);
        if (dataBytes) parts.push(dataBytes);

        return Buffer.concat(parts);
    }

    /**
     * Compile a Watch packet
     */
    compileWatch(packet) {
        const nameBytes = this.encodeString(packet.name);
        const valueBytes = this.encodeString(packet.value);
        const timestamp = this.dateToTimestamp(packet.timestamp || new Date());

        // Watch binary format:
        // [nameLen(4)] [valueLen(4)] [watchType(4)] [timestamp(8)]
        // [name] [value]

        const parts = [
            this.writeInt32(nameBytes ? nameBytes.length : 0),
            this.writeInt32(valueBytes ? valueBytes.length : 0),
            this.writeInt32(packet.watchType),
            this.writeDouble(timestamp)
        ];

        if (nameBytes) parts.push(nameBytes);
        if (valueBytes) parts.push(valueBytes);

        return Buffer.concat(parts);
    }

    /**
     * Compile a ProcessFlow packet
     */
    compileProcessFlow(packet) {
        const titleBytes = this.encodeString(packet.title);
        const hostNameBytes = this.encodeString(packet.hostName);
        const timestamp = this.dateToTimestamp(packet.timestamp || new Date());

        // ProcessFlow binary format:
        // [processFlowType(4)] [titleLen(4)] [hostNameLen(4)]
        // [processId(4)] [threadId(4)] [timestamp(8)]
        // [title] [hostName]

        const parts = [
            this.writeInt32(packet.processFlowType),
            this.writeInt32(titleBytes ? titleBytes.length : 0),
            this.writeInt32(hostNameBytes ? hostNameBytes.length : 0),
            this.writeInt32(packet.processId || 0),
            this.writeInt32(packet.threadId || 0),
            this.writeDouble(timestamp)
        ];

        if (titleBytes) parts.push(titleBytes);
        if (hostNameBytes) parts.push(hostNameBytes);

        return Buffer.concat(parts);
    }

    /**
     * Compile a ControlCommand packet
     */
    compileControlCommand(packet) {
        const dataBytes = packet.data || null;

        // ControlCommand binary format:
        // [controlCommandType(4)] [dataLen(4)] [data]

        const parts = [
            this.writeInt32(packet.controlCommandType),
            this.writeInt32(dataBytes ? dataBytes.length : 0)
        ];

        if (dataBytes) parts.push(dataBytes);

        return Buffer.concat(parts);
    }

    /**
     * Compile a Stream packet
     */
    compileStream(packet) {
        const channelBytes = this.encodeString(packet.channel);
        const dataBytes = this.encodeString(packet.data);
        const typeBytes = this.encodeString(packet.streamType || '');
        const timestamp = this.dateToTimestamp(packet.timestamp || new Date());

        // Stream binary format (v2 with type):
        // [channelLen(4)] [dataLen(4)] [typeLen(4)] [timestamp(8)]
        // [channel] [data] [type]

        const parts = [
            this.writeInt32(channelBytes ? channelBytes.length : 0),
            this.writeInt32(dataBytes ? dataBytes.length : 0),
            this.writeInt32(typeBytes ? typeBytes.length : 0),
            this.writeDouble(timestamp)
        ];

        if (channelBytes) parts.push(channelBytes);
        if (dataBytes) parts.push(dataBytes);
        if (typeBytes) parts.push(typeBytes);

        return Buffer.concat(parts);
    }

    /**
     * Compile a packet based on its type
     */
    compile(packet) {
        switch (packet.packetType) {
            case PacketType.LogHeader:
                this.stream = this.compileLogHeader(packet);
                break;
            case PacketType.LogEntry:
                this.stream = this.compileLogEntry(packet);
                break;
            case PacketType.Watch:
                this.stream = this.compileWatch(packet);
                break;
            case PacketType.ProcessFlow:
                this.stream = this.compileProcessFlow(packet);
                break;
            case PacketType.ControlCommand:
                this.stream = this.compileControlCommand(packet);
                break;
            case PacketType.Stream:
                this.stream = this.compileStream(packet);
                break;
            default:
                this.stream = Buffer.alloc(0);
        }
        this.size = this.stream.length;
        return this.size + 6; // +6 for packet header (2 bytes type + 4 bytes size)
    }

    /**
     * Format a packet into a complete binary buffer ready to send
     * Format: [packetType(2)] [dataSize(4)] [data]
     */
    format(packet) {
        this.compile(packet);

        if (this.size > 0) {
            return Buffer.concat([
                this.writeInt16(packet.packetType),
                this.writeInt32(this.size),
                this.stream
            ]);
        }
        return Buffer.alloc(0);
    }
}

module.exports = { BinaryFormatter };
