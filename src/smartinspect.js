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

        // Create default session
        this.mainSession = new Session(this, 'Main');
        this.sessions.set('Main', this.mainSession);
    }

    /**
     * Connect to SmartInspect Console
     * @param {Object|string} options - Connection options or connection string
     */
    async connect(options = {}) {
        if (typeof options === 'string') {
            options = this.parseConnectionString(options);
        }

        // Set room if provided in options
        if (options.room) {
            this.room = options.room;
        }

        // Choose protocol based on options
        if (options.pipe || options.pipePath) {
            // Use Pipe protocol (Named Pipe on Windows, Unix socket on Linux)
            this.protocol = new PipeProtocol({
                pipe: options.pipe,
                pipePath: options.pipePath,  // Allow explicit path override
                timeout: options.timeout || 30000,
                appName: this.appName,
                hostName: this.hostName,
                room: this.room,
                onError: (err) => this.emit('error', err),
                onConnect: (banner) => this.emit('connect', banner),
                onDisconnect: () => this.emit('disconnect')
            });
        } else {
            // Use TCP protocol (default)
            // Auto-detect Windows host if in WSL and no host specified
            if (!options.host) {
                options.host = await detectWindowsHost();
            }

            this.protocol = new TcpProtocol({
                host: options.host || '127.0.0.1',
                port: options.port || 4228,
                timeout: options.timeout || 30000,
                appName: this.appName,
                hostName: this.hostName,
                room: this.room,
                onError: (err) => this.emit('error', err),
                onConnect: (banner) => this.emit('connect', banner),
                onDisconnect: () => this.emit('disconnect')
            });
        }

        await this.protocol.connect();
        this.enabled = true;

        return this;
    }

    /**
     * Parse a connection string like "tcp(host=localhost,port=4228,room=myproject)"
     * or "pipe(name=smartinspect)"
     */
    parseConnectionString(str) {
        const options = {};

        // Match tcp(options) format
        const tcpMatch = str.match(/tcp\(([^)]+)\)/i);
        if (tcpMatch) {
            const pairs = tcpMatch[1].split(',');
            for (const pair of pairs) {
                const [key, value] = pair.split('=').map(s => s.trim());
                if (key === 'host') options.host = value;
                else if (key === 'port') options.port = parseInt(value, 10);
                else if (key === 'timeout') options.timeout = parseInt(value, 10);
                else if (key === 'room') options.room = value;
            }
            return options;
        }

        // Match pipe(options) format
        const pipeMatch = str.match(/pipe\(([^)]+)\)/i);
        if (pipeMatch) {
            const pairs = pipeMatch[1].split(',');
            for (const pair of pairs) {
                const [key, value] = pair.split('=').map(s => s.trim());
                if (key === 'name' || key === 'pipe') options.pipe = value;
                else if (key === 'timeout') options.timeout = parseInt(value, 10);
                else if (key === 'room') options.room = value;
            }
            return options;
        }

        return options;
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
     */
    sendPacket(packet) {
        if (this.enabled && this.protocol && this.protocol.isConnected()) {
            try {
                this.protocol.writePacket(packet);
            } catch (err) {
                this.emit('error', err);
            }
        }
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
     * Enable/disable logging
     */
    setEnabled(enabled) {
        this.enabled = enabled;
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
