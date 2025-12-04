/**
 * Scheduler - Background async processor for SmartInspect
 * Port of C# Scheduler.cs using Node.js setImmediate
 */

const { SchedulerQueue } = require('./SchedulerQueue');
const { SchedulerAction } = require('./SchedulerAction');

const BUFFER_SIZE = 16; // Max commands per batch (like C#)

class Scheduler {
    /**
     * Create a new scheduler for a protocol
     * @param {Object} protocol - The protocol instance to schedule commands for
     */
    constructor(protocol) {
        this._protocol = protocol;
        this._queue = new SchedulerQueue();
        this._threshold = 2048 * 1024; // Default 2MB
        this._throttle = false;
        this._stopped = false;
        this._started = false;
        this._processing = false;
        this._processTimer = null;

        // Throttle waiters - promises waiting for queue space
        this._throttleWaiters = [];
    }

    /**
     * Maximum queue size in bytes
     * @type {number}
     */
    get threshold() {
        return this._threshold;
    }

    set threshold(value) {
        this._threshold = value;
    }

    /**
     * Whether to block callers when queue is full (true) or drop oldest packets (false)
     * @type {boolean}
     */
    get throttle() {
        return this._throttle;
    }

    set throttle(value) {
        this._throttle = value;
    }

    /**
     * Current queue size in bytes
     * @type {number}
     */
    get queueSize() {
        return this._queue.size;
    }

    /**
     * Current queue count
     * @type {number}
     */
    get queueCount() {
        return this._queue.count;
    }

    /**
     * Start the scheduler (begin processing commands)
     */
    start() {
        if (this._started) {
            return;
        }
        this._started = true;
        this._stopped = false;
        this._scheduleProcessing();
    }

    /**
     * Stop the scheduler and wait for pending commands to complete
     * @returns {Promise<void>}
     */
    async stop() {
        if (!this._started) {
            return;
        }

        this._stopped = true;
        this._started = false;

        // Cancel pending processing
        if (this._processTimer) {
            clearImmediate(this._processTimer);
            this._processTimer = null;
        }

        // Release any throttled waiters
        this._releaseWaiters();

        // Drain remaining disconnect commands
        await this._drain();
    }

    /**
     * Clear all commands from the queue
     */
    clear() {
        this._queue.clear();
        this._releaseWaiters();
    }

    /**
     * Schedule a command for execution (non-blocking)
     * @param {SchedulerCommand} command
     * @returns {boolean} True if scheduled successfully
     */
    schedule(command) {
        if (!this._started || this._stopped) {
            return false;
        }

        const size = command.size;
        if (size > this._threshold) {
            return false;
        }

        // If throttle is enabled but we're not blocking here,
        // just trim if needed (schedule is always non-blocking)
        if ((this._queue.size + size) > this._threshold) {
            this._queue.trim(size);
        }

        this._queue.enqueue(command);
        this._scheduleProcessing();
        return true;
    }

    /**
     * Schedule a command for execution (supports throttle blocking)
     * When throttle is enabled and queue is full, this will wait until space is available
     * @param {SchedulerCommand} command
     * @returns {Promise<boolean>} True if scheduled successfully
     */
    async scheduleAsync(command) {
        if (!this._started || this._stopped) {
            return false;
        }

        const size = command.size;
        if (size > this._threshold) {
            return false;
        }

        // If throttle enabled and protocol not failed, wait for space
        if (this._throttle && !this._protocol.failed) {
            while ((this._queue.size + size) > this._threshold && !this._stopped) {
                await new Promise(resolve => this._throttleWaiters.push(resolve));
            }

            if (this._stopped) {
                return false;
            }
        } else if ((this._queue.size + size) > this._threshold) {
            // Not throttling - trim oldest packets to make space
            this._queue.trim(size);
        }

        this._queue.enqueue(command);
        this._scheduleProcessing();
        return true;
    }

    /**
     * Release all throttle waiters
     * @private
     */
    _releaseWaiters() {
        const waiters = this._throttleWaiters;
        this._throttleWaiters = [];
        for (const resolve of waiters) {
            resolve();
        }
    }

    /**
     * Schedule processing on next tick using setImmediate
     * @private
     */
    _scheduleProcessing() {
        if (this._processing || !this._started || this._stopped) {
            return;
        }
        if (this._queue.count === 0) {
            return;
        }
        if (this._processTimer) {
            return; // Already scheduled
        }

        this._processTimer = setImmediate(() => {
            this._processTimer = null;
            this._processCommands();
        });
    }

    /**
     * Process commands in batches
     * @private
     */
    async _processCommands() {
        if (this._processing) {
            return;
        }
        this._processing = true;

        try {
            let processed = 0;

            while (this._queue.count > 0 && processed < BUFFER_SIZE) {
                const wasStopped = this._stopped;
                const command = this._queue.dequeue();

                if (command) {
                    try {
                        await this._runCommand(command);
                    } catch (err) {
                        // Command failed - protocol handles errors
                    }
                    processed++;
                }

                // If stop was called and protocol failed, clear remaining
                if (wasStopped && this._protocol.failed) {
                    this.clear();
                    break;
                }
            }

            // Release throttle waiters after processing
            this._releaseWaiters();

            // Schedule more processing if queue not empty
            if (this._queue.count > 0 && !this._stopped) {
                this._scheduleProcessing();
            }
        } finally {
            this._processing = false;
        }
    }

    /**
     * Run a single command
     * @private
     * @param {SchedulerCommand} command
     */
    async _runCommand(command) {
        switch (command.action) {
            case SchedulerAction.Connect:
                await this._protocol.implConnect();
                break;

            case SchedulerAction.WritePacket:
                await this._protocol.implWritePacket(command.state);
                break;

            case SchedulerAction.Disconnect:
                await this._protocol.implDisconnect();
                break;

            case SchedulerAction.Dispatch:
                await this._protocol.implDispatch(command.state);
                break;
        }
    }

    /**
     * Drain remaining disconnect commands when stopping
     * @private
     */
    async _drain() {
        while (this._queue.count > 0) {
            const command = this._queue.dequeue();
            if (command && command.action === SchedulerAction.Disconnect) {
                try {
                    await this._protocol.implDisconnect();
                } catch (err) {
                    // Ignore disconnect errors during drain
                }
            }
        }
    }
}

module.exports = { Scheduler };
