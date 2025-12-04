/**
 * SchedulerCommand - Command wrapper for scheduler queue
 * Port of C# SchedulerCommand.cs
 */

const { SchedulerAction } = require('./SchedulerAction');

class SchedulerCommand {
    constructor(action, state = null) {
        this._action = action;
        this._state = state;
    }

    get action() {
        return this._action;
    }

    set action(value) {
        this._action = value;
    }

    get state() {
        return this._state;
    }

    set state(value) {
        this._state = value;
    }

    /**
     * Get estimated size of command in bytes
     * Only WritePacket commands have meaningful size
     * @type {number}
     */
    get size() {
        if (this._action !== SchedulerAction.WritePacket) {
            return 0;
        }
        if (this._state === null) {
            return 0;
        }
        return this._getPacketSize(this._state);
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
}

module.exports = { SchedulerCommand };
