/**
 * PacketQueue - FIFO queue for backlog buffering
 * Port of C# PacketQueue.cs
 */

const OVERHEAD = 0x18; // 24 bytes per queue item (memory overhead)

class PacketQueueItem {
    constructor(packet) {
        this.packet = packet;
        this.next = null;
        this.previous = null;
    }
}

class PacketQueue {
    constructor() {
        this._backlog = 2048 * 1024; // Default 2MB
        this._size = 0;
        this._count = 0;
        this._head = null;
        this._tail = null;
        this.onPacketDropped = null; // Callback: (droppedCount) => void
    }

    /**
     * Remove all packets from the queue
     */
    clear() {
        while (this.pop() !== null) {
            // Keep popping until empty
        }
    }

    /**
     * Remove and return the oldest packet (from head)
     * @returns {Object|null} The packet or null if empty
     */
    pop() {
        const head = this._head;
        if (head === null) {
            return null;
        }

        const packet = head.packet;
        this._head = head.next;

        if (this._head !== null) {
            this._head.previous = null;
        } else {
            this._tail = null;
        }

        this._count--;
        this._size -= this._getPacketSize(packet) + OVERHEAD;

        return packet;
    }

    /**
     * Add a packet to the queue (at tail)
     * Triggers auto-trim if backlog exceeded
     * @param {Object} packet - The packet to add
     */
    push(packet) {
        const item = new PacketQueueItem(packet);

        if (this._tail === null) {
            this._tail = item;
            this._head = item;
        } else {
            this._tail.next = item;
            item.previous = this._tail;
            this._tail = item;
        }

        this._count++;
        this._size += this._getPacketSize(packet) + OVERHEAD;
        this._resize();
    }

    /**
     * Trim oldest packets until size is within backlog limit
     * Notifies via onPacketDropped callback when packets are dropped
     * @private
     */
    _resize() {
        let droppedCount = 0;
        while (this._backlog < this._size) {
            if (this.pop() === null) {
                this._size = 0;
                break;
            }
            droppedCount++;
        }
        // Notify about dropped packets
        if (droppedCount > 0 && this.onPacketDropped) {
            this.onPacketDropped(droppedCount);
        }
    }

    /**
     * Estimate packet size in bytes
     * @private
     * @param {Object} packet
     * @returns {number}
     */
    _getPacketSize(packet) {
        if (!packet) return 0;

        let size = 64; // Base packet overhead

        if (packet.title) {
            size += Buffer.byteLength(packet.title, 'utf8');
        }
        if (packet.data && Buffer.isBuffer(packet.data)) {
            size += packet.data.length;
        }
        if (packet.content) {
            size += Buffer.byteLength(String(packet.content), 'utf8');
        }
        if (packet.appName) {
            size += Buffer.byteLength(packet.appName, 'utf8');
        }
        if (packet.sessionName) {
            size += Buffer.byteLength(packet.sessionName, 'utf8');
        }
        if (packet.hostName) {
            size += Buffer.byteLength(packet.hostName, 'utf8');
        }

        return size;
    }

    /**
     * Maximum queue size in bytes. When exceeded, oldest packets are trimmed.
     * @type {number}
     */
    get backlog() {
        return this._backlog;
    }

    set backlog(value) {
        this._backlog = value;
        this._resize();
    }

    /**
     * Current number of packets in queue
     * @type {number}
     */
    get count() {
        return this._count;
    }

    /**
     * Current size of queue in bytes
     * @type {number}
     */
    get size() {
        return this._size;
    }

    /**
     * Check if queue is empty
     * @type {boolean}
     */
    get isEmpty() {
        return this._count === 0;
    }
}

module.exports = { PacketQueue, OVERHEAD };
