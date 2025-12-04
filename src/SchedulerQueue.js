/**
 * SchedulerQueue - Queue for scheduler commands
 * Port of C# SchedulerQueue.cs
 */

const { SchedulerAction } = require('./SchedulerAction');

const OVERHEAD = 0x18; // 24 bytes per queue item

class SchedulerQueueItem {
    constructor(command) {
        this.command = command;
        this.next = null;
        this.previous = null;
    }
}

class SchedulerQueue {
    constructor() {
        this._size = 0;
        this._count = 0;
        this._head = null;
        this._tail = null;
    }

    /**
     * Add item to tail of queue
     * @private
     * @param {SchedulerQueueItem} item
     */
    _add(item) {
        if (this._tail === null) {
            this._tail = item;
            this._head = item;
        } else {
            this._tail.next = item;
            item.previous = this._tail;
            this._tail = item;
        }
        this._count++;
        this._size += item.command.size + OVERHEAD;
    }

    /**
     * Remove item from queue
     * @private
     * @param {SchedulerQueueItem} item
     */
    _remove(item) {
        if (item === this._head) {
            this._head = item.next;
            if (this._head !== null) {
                this._head.previous = null;
            } else {
                this._tail = null;
            }
        } else {
            item.previous.next = item.next;
            if (item.next === null) {
                this._tail = item.previous;
            } else {
                item.next.previous = item.previous;
            }
        }
        this._count--;
        this._size -= item.command.size + OVERHEAD;
    }

    /**
     * Clear all items from queue
     */
    clear() {
        while (this.dequeue() !== null) {
            // Keep dequeuing until empty
        }
    }

    /**
     * Remove and return oldest command (from head)
     * @returns {SchedulerCommand|null}
     */
    dequeue() {
        const head = this._head;
        if (head === null) {
            return null;
        }
        this._remove(head);
        return head.command;
    }

    /**
     * Add command to queue (at tail)
     * @param {SchedulerCommand} command
     */
    enqueue(command) {
        const item = new SchedulerQueueItem(command);
        this._add(item);
    }

    /**
     * Trim WritePacket commands from queue to free up specified size
     * Only removes WritePacket commands, preserves Connect/Disconnect/Dispatch
     * @param {number} size - Number of bytes to free
     * @returns {boolean} True if enough space was freed
     */
    trim(size) {
        if (size <= 0) {
            return true;
        }

        let freedSize = 0;
        let item = this._head;

        while (item !== null) {
            const next = item.next;

            // Only trim WritePacket commands
            if (item.command.action === SchedulerAction.WritePacket) {
                freedSize += item.command.size + OVERHEAD;
                this._remove(item);

                if (freedSize >= size) {
                    return true;
                }
            }

            item = next;
        }

        return false;
    }

    /**
     * Current number of commands in queue
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
}

module.exports = { SchedulerQueue, OVERHEAD };
