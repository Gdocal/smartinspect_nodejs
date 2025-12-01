/**
 * SmartInspect Session
 * Main logging class with all logging methods
 */

const {
    Level,
    PacketType,
    LogEntryType,
    ViewerId,
    WatchType,
    ControlCommandType,
    ProcessFlowType,
    SourceId,
    GraphicId,
    DEFAULT_COLOR
} = require('./enums');

const {
    InspectorViewerContext,
    TableViewerContext,
    ListViewerContext,
    ValueListViewerContext,
    DataViewerContext,
    BinaryViewerContext,
    TextContext,
    SourceViewerContext,
    WebViewerContext
} = require('./contexts');

const util = require('util');
const fs = require('fs');
const path = require('path');

/**
 * Session class - provides all logging methods
 */
class Session {
    constructor(parent, name = 'Main') {
        this.parent = parent;
        this.name = name;
        this.active = true;
        this.level = Level.Debug;
        this.color = { ...DEFAULT_COLOR };
        this.checkpointCounter = 0;
        this.counters = new Map();
        this.checkpoints = new Map();
    }

    /**
     * Check if logging is enabled at the given level
     */
    isOn(level = null) {
        if (!this.active || !this.parent.enabled) return false;
        if (level == null) return true;
        return level >= this.level && level >= this.parent.level;
    }

    /**
     * Get current process ID
     */
    getProcessId() {
        return process.pid;
    }

    /**
     * Get current thread ID (main thread in Node.js)
     */
    getThreadId() {
        // In Node.js we use 0 for main thread
        // Could use worker_threads.threadId if in a worker
        try {
            const { threadId } = require('worker_threads');
            return threadId || 0;
        } catch {
            return 0;
        }
    }

    /**
     * Send a log entry packet
     */
    sendLogEntry(level, title, logEntryType, viewerId, color = null, data = null) {
        if (!this.isOn(level)) return;

        const packet = {
            packetType: PacketType.LogEntry,
            logEntryType,
            viewerId,
            title,
            appName: this.parent.appName,
            sessionName: this.name,
            hostName: this.parent.hostName,
            processId: this.getProcessId(),
            threadId: this.getThreadId(),
            timestamp: new Date(),
            color: color || this.color,
            data: data
        };

        this.parent.sendPacket(packet);
    }

    /**
     * Send a context with data
     */
    sendContext(level, title, logEntryType, ctx) {
        if (!this.isOn(level)) return;

        const data = ctx.getViewerData();
        this.sendLogEntry(level, title, logEntryType, ctx.viewerId, null, data);
    }

    /**
     * Send a watch packet
     */
    sendWatch(level, name, value, watchType) {
        if (!this.isOn(level)) return;

        const packet = {
            packetType: PacketType.Watch,
            name,
            value,
            watchType,
            timestamp: new Date()
        };

        this.parent.sendPacket(packet);
    }

    /**
     * Send a process flow packet
     */
    sendProcessFlow(level, title, processFlowType) {
        if (!this.isOn(level)) return;

        const packet = {
            packetType: PacketType.ProcessFlow,
            processFlowType,
            title,
            hostName: this.parent.hostName,
            processId: this.getProcessId(),
            threadId: this.getThreadId(),
            timestamp: new Date()
        };

        this.parent.sendPacket(packet);
    }

    /**
     * Send a control command packet
     */
    sendControlCommand(controlCommandType, data = null) {
        const packet = {
            packetType: PacketType.ControlCommand,
            controlCommandType,
            data
        };

        this.parent.sendPacket(packet);
    }

    /**
     * Log internal error
     */
    logInternalError(title) {
        this.sendLogEntry(Level.Error, title, LogEntryType.InternalError, ViewerId.Title);
    }

    /**
     * Format arguments for logging (Node.js style)
     */
    formatArgs(...args) {
        if (args.length === 0) return '';
        if (args.length === 1) {
            return this.formatValue(args[0]);
        }

        // Check if first arg is a format string
        if (typeof args[0] === 'string' && args[0].includes('%')) {
            try {
                return util.format(...args);
            } catch {
                // Fall through to default formatting
            }
        }

        return args.map(arg => this.formatValue(arg)).join(' ');
    }

    /**
     * Format a single value
     */
    formatValue(value) {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        if (typeof value === 'string') return value;
        if (value instanceof Error) {
            return `${value.name}: ${value.message}\n${value.stack}`;
        }
        if (typeof value === 'object') {
            try {
                return util.inspect(value, { depth: 4, colors: false });
            } catch {
                return String(value);
            }
        }
        return String(value);
    }

    // ==================== Basic Logging Methods ====================

    /**
     * Log a message
     */
    logMessage(...args) {
        const title = this.formatArgs(...args);
        this.sendLogEntry(Level.Message, title, LogEntryType.Message, ViewerId.Title);
    }

    /**
     * Log a debug message
     */
    logDebug(...args) {
        const title = this.formatArgs(...args);
        this.sendLogEntry(Level.Debug, title, LogEntryType.Debug, ViewerId.Title);
    }

    /**
     * Log a verbose message
     */
    logVerbose(...args) {
        const title = this.formatArgs(...args);
        this.sendLogEntry(Level.Verbose, title, LogEntryType.Verbose, ViewerId.Title);
    }

    /**
     * Log a warning
     */
    logWarning(...args) {
        const title = this.formatArgs(...args);
        this.sendLogEntry(Level.Warning, title, LogEntryType.Warning, ViewerId.Title);
    }

    /**
     * Log an error
     */
    logError(...args) {
        const title = this.formatArgs(...args);
        this.sendLogEntry(Level.Error, title, LogEntryType.Error, ViewerId.Title);
    }

    /**
     * Log a fatal error
     */
    logFatal(...args) {
        const title = this.formatArgs(...args);
        this.sendLogEntry(Level.Fatal, title, LogEntryType.Fatal, ViewerId.Title);
    }

    /**
     * Log a separator
     */
    logSeparator() {
        this.sendLogEntry(this.parent.defaultLevel, '', LogEntryType.Separator, ViewerId.Title);
    }

    // ==================== Colored Logging ====================

    /**
     * Log a colored message
     */
    logColored(color, ...args) {
        const title = this.formatArgs(...args);
        this.sendLogEntry(this.parent.defaultLevel, title, LogEntryType.Message, ViewerId.Title, color);
    }

    // ==================== Exception Logging ====================

    /**
     * Log an exception/error
     */
    logException(error, title = null) {
        if (!this.isOn(Level.Error)) return;

        if (!error) {
            this.logInternalError('logException: error argument is null');
            return;
        }

        const errorTitle = title || error.message || 'Error';
        const ctx = new DataViewerContext();
        ctx.loadFromText(error.stack || error.toString());
        this.sendContext(Level.Error, errorTitle, LogEntryType.Error, ctx);
    }

    // ==================== Variable Logging ====================

    /**
     * Log a string variable
     */
    logString(name, value) {
        const title = `${name} = "${value}"`;
        this.sendLogEntry(this.parent.defaultLevel, title, LogEntryType.VariableValue, ViewerId.Title);
    }

    /**
     * Log an integer variable
     */
    logInt(name, value, includeHex = false) {
        let title = `${name} = ${value}`;
        if (includeHex) {
            title += ` (0x${value.toString(16).padStart(8, '0')})`;
        }
        this.sendLogEntry(this.parent.defaultLevel, title, LogEntryType.VariableValue, ViewerId.Title);
    }

    /**
     * Log a number variable
     */
    logNumber(name, value) {
        const title = `${name} = ${value}`;
        this.sendLogEntry(this.parent.defaultLevel, title, LogEntryType.VariableValue, ViewerId.Title);
    }

    /**
     * Log a boolean variable
     */
    logBool(name, value) {
        const title = `${name} = ${value ? 'True' : 'False'}`;
        this.sendLogEntry(this.parent.defaultLevel, title, LogEntryType.VariableValue, ViewerId.Title);
    }

    /**
     * Log a date/time value
     */
    logDateTime(name, value) {
        const title = `${name} = ${value.toISOString()}`;
        this.sendLogEntry(this.parent.defaultLevel, title, LogEntryType.VariableValue, ViewerId.Title);
    }

    /**
     * Log any value with its type
     */
    logValue(name, value) {
        const type = typeof value;
        let formattedValue;

        if (value === null) {
            formattedValue = 'null';
        } else if (value === undefined) {
            formattedValue = 'undefined';
        } else if (type === 'string') {
            formattedValue = `"${value}"`;
        } else if (type === 'boolean') {
            formattedValue = value ? 'True' : 'False';
        } else if (value instanceof Date) {
            formattedValue = value.toISOString();
        } else if (type === 'object') {
            formattedValue = util.inspect(value, { depth: 2, colors: false });
        } else {
            formattedValue = String(value);
        }

        const title = `${name} = ${formattedValue}`;
        this.sendLogEntry(this.parent.defaultLevel, title, LogEntryType.VariableValue, ViewerId.Title);
    }

    // ==================== Object Logging ====================

    /**
     * Log an object with its properties
     */
    logObject(title, obj, includePrivate = false) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        if (obj == null) {
            this.logInternalError('logObject: object argument is null');
            return;
        }

        const ctx = new InspectorViewerContext();

        try {
            const type = obj.constructor ? obj.constructor.name : typeof obj;
            ctx.startGroup('General');
            ctx.appendKeyValue('Type', type);

            ctx.startGroup('Properties');

            // Get all properties
            const props = Object.getOwnPropertyNames(obj);
            for (const prop of props.sort()) {
                if (!includePrivate && prop.startsWith('_')) continue;

                try {
                    const value = obj[prop];
                    if (typeof value === 'function') continue;
                    ctx.appendKeyValue(prop, this.formatValue(value));
                } catch (e) {
                    ctx.appendKeyValue(prop, `<error: ${e.message}>`);
                }
            }

            this.sendContext(this.parent.defaultLevel, title, LogEntryType.Object, ctx);
        } catch (e) {
            this.logInternalError(`logObject: ${e.message}`);
        }
    }

    // ==================== Collection Logging ====================

    /**
     * Log an array
     */
    logArray(title, arr) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        if (arr == null) {
            this.logInternalError('logArray: array argument is null');
            return;
        }

        const ctx = new ListViewerContext();
        for (const item of arr) {
            ctx.appendLine(this.formatValue(item));
        }
        this.sendContext(this.parent.defaultLevel, title, LogEntryType.Text, ctx);
    }

    /**
     * Log a Map or object as dictionary
     */
    logDictionary(title, dict) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        if (dict == null) {
            this.logInternalError('logDictionary: dict argument is null');
            return;
        }

        const ctx = new ValueListViewerContext();

        if (dict instanceof Map) {
            for (const [key, value] of dict) {
                ctx.appendKeyValue(this.formatValue(key), this.formatValue(value));
            }
        } else {
            for (const [key, value] of Object.entries(dict)) {
                ctx.appendKeyValue(key, this.formatValue(value));
            }
        }

        this.sendContext(this.parent.defaultLevel, title, LogEntryType.Text, ctx);
    }

    /**
     * Log a table (array of objects)
     */
    logTable(title, data, columns = null) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        if (!data || !Array.isArray(data) || data.length === 0) {
            this.logInternalError('logTable: data is empty or not an array');
            return;
        }

        const ctx = new TableViewerContext();

        // Determine columns
        if (!columns) {
            columns = Object.keys(data[0]);
        }

        // Header
        ctx.appendHeader(columns.map(c => `"${c}"`).join(', '));

        // Rows
        for (const row of data) {
            ctx.beginRow();
            for (const col of columns) {
                ctx.addRowEntry(row[col]);
            }
            ctx.endRow();
        }

        this.sendContext(this.parent.defaultLevel, title, LogEntryType.DatabaseResult, ctx);
    }

    // ==================== Text/Source Logging ====================

    /**
     * Log plain text
     */
    logText(title, text) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        const ctx = new TextContext(ViewerId.Data);
        ctx.loadFromText(text);
        this.sendContext(this.parent.defaultLevel, title, LogEntryType.Text, ctx);
    }

    /**
     * Log source code with syntax highlighting
     */
    logSource(title, source, sourceId) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        const ctx = new SourceViewerContext(sourceId);
        ctx.loadFromText(source);
        this.sendContext(this.parent.defaultLevel, title, LogEntryType.Source, ctx);
    }

    /**
     * Log HTML content
     */
    logHtml(title, html) {
        this.logSource(title, html, SourceId.Html);
    }

    /**
     * Log JavaScript source
     */
    logJavaScript(title, code) {
        this.logSource(title, code, SourceId.JavaScript);
    }

    /**
     * Log SQL source
     */
    logSql(title, sql) {
        this.logSource(title, sql, SourceId.Sql);
    }

    /**
     * Log JSON (pretty printed)
     */
    logJson(title, data) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        let jsonStr;
        if (typeof data === 'string') {
            try {
                // Parse and re-stringify for pretty printing
                jsonStr = JSON.stringify(JSON.parse(data), null, 2);
            } catch {
                jsonStr = data;
            }
        } else {
            jsonStr = JSON.stringify(data, null, 2);
        }

        this.logSource(title, jsonStr, SourceId.JavaScript);
    }

    /**
     * Log XML source
     */
    logXml(title, xml) {
        this.logSource(title, xml, SourceId.Xml);
    }

    // ==================== Binary Logging ====================

    /**
     * Log binary data (hex dump)
     */
    logBinary(title, buffer) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        if (!buffer) {
            this.logInternalError('logBinary: buffer argument is null');
            return;
        }

        const ctx = new BinaryViewerContext();
        ctx.appendBytes(Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer));
        this.sendContext(this.parent.defaultLevel, title, LogEntryType.Binary, ctx);
    }

    // ==================== File Logging ====================

    /**
     * Log a text file
     */
    logTextFile(filePath, title = null) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            this.logText(title || path.basename(filePath), content);
        } catch (e) {
            this.logInternalError(`logTextFile: ${e.message}`);
        }
    }

    /**
     * Log a binary file
     */
    logBinaryFile(filePath, title = null) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        try {
            const content = fs.readFileSync(filePath);
            this.logBinary(title || path.basename(filePath), content);
        } catch (e) {
            this.logInternalError(`logBinaryFile: ${e.message}`);
        }
    }

    // ==================== Checkpoint/Counter ====================

    /**
     * Add a checkpoint
     */
    addCheckpoint(name = null, details = null) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        let title;
        if (name) {
            let count = this.checkpoints.get(name) || 0;
            count++;
            this.checkpoints.set(name, count);
            title = `${name} #${count}`;
            if (details) {
                title += ` (${details})`;
            }
        } else {
            this.checkpointCounter++;
            title = `Checkpoint #${this.checkpointCounter}`;
        }

        this.sendLogEntry(this.parent.defaultLevel, title, LogEntryType.Checkpoint, ViewerId.Title);
    }

    /**
     * Reset checkpoint counter
     */
    resetCheckpoint(name = null) {
        if (name) {
            this.checkpoints.delete(name);
        } else {
            this.checkpointCounter = 0;
        }
    }

    /**
     * Increment a counter
     */
    incCounter(name) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        let value = this.counters.get(name) || 0;
        value++;
        this.counters.set(name, value);
        this.sendWatch(this.parent.defaultLevel, name, String(value), WatchType.Integer);
    }

    /**
     * Decrement a counter
     */
    decCounter(name) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        let value = this.counters.get(name) || 0;
        value--;
        this.counters.set(name, value);
        this.sendWatch(this.parent.defaultLevel, name, String(value), WatchType.Integer);
    }

    /**
     * Reset a counter
     */
    resetCounter(name) {
        this.counters.delete(name);
    }

    // ==================== Watch Variables ====================

    /**
     * Watch a string value
     */
    watchString(name, value) {
        this.sendWatch(this.parent.defaultLevel, name, value, WatchType.String);
    }

    /**
     * Watch an integer value
     */
    watchInt(name, value) {
        this.sendWatch(this.parent.defaultLevel, name, String(value), WatchType.Integer);
    }

    /**
     * Watch a float value
     */
    watchFloat(name, value) {
        this.sendWatch(this.parent.defaultLevel, name, String(value), WatchType.Float);
    }

    /**
     * Watch a boolean value
     */
    watchBool(name, value) {
        this.sendWatch(this.parent.defaultLevel, name, value ? 'True' : 'False', WatchType.Boolean);
    }

    /**
     * Watch any value
     */
    watch(name, value) {
        const type = typeof value;
        let watchType = WatchType.Object;
        let strValue;

        if (type === 'string') {
            watchType = WatchType.String;
            strValue = value;
        } else if (type === 'number') {
            watchType = Number.isInteger(value) ? WatchType.Integer : WatchType.Float;
            strValue = String(value);
        } else if (type === 'boolean') {
            watchType = WatchType.Boolean;
            strValue = value ? 'True' : 'False';
        } else if (value instanceof Date) {
            watchType = WatchType.Timestamp;
            strValue = value.toISOString();
        } else {
            strValue = this.formatValue(value);
        }

        this.sendWatch(this.parent.defaultLevel, name, strValue, watchType);
    }

    // ==================== Method Tracking ====================

    /**
     * Enter a method
     */
    enterMethod(methodName) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        this.sendLogEntry(this.parent.defaultLevel, methodName, LogEntryType.EnterMethod, ViewerId.Title);
        this.sendProcessFlow(this.parent.defaultLevel, methodName, ProcessFlowType.EnterMethod);
    }

    /**
     * Leave a method
     */
    leaveMethod(methodName) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        this.sendLogEntry(this.parent.defaultLevel, methodName, LogEntryType.LeaveMethod, ViewerId.Title);
        this.sendProcessFlow(this.parent.defaultLevel, methodName, ProcessFlowType.LeaveMethod);
    }

    /**
     * Track a method execution (returns a function to call when done)
     */
    trackMethod(methodName) {
        this.enterMethod(methodName);
        return () => this.leaveMethod(methodName);
    }

    /**
     * Wrap a function to track its execution
     */
    wrapMethod(methodName, fn) {
        const session = this;
        return function(...args) {
            session.enterMethod(methodName);
            try {
                const result = fn.apply(this, args);
                if (result && typeof result.then === 'function') {
                    // Promise
                    return result.finally(() => session.leaveMethod(methodName));
                }
                session.leaveMethod(methodName);
                return result;
            } catch (e) {
                session.leaveMethod(methodName);
                throw e;
            }
        };
    }

    // ==================== Process/Thread Flow ====================

    /**
     * Enter a process
     */
    enterProcess(processName = null) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        const name = processName || this.parent.appName;
        this.sendProcessFlow(this.parent.defaultLevel, name, ProcessFlowType.EnterProcess);
        this.sendProcessFlow(this.parent.defaultLevel, 'Main Thread', ProcessFlowType.EnterThread);
    }

    /**
     * Leave a process
     */
    leaveProcess(processName = null) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        const name = processName || this.parent.appName;
        this.sendProcessFlow(this.parent.defaultLevel, 'Main Thread', ProcessFlowType.LeaveThread);
        this.sendProcessFlow(this.parent.defaultLevel, name, ProcessFlowType.LeaveProcess);
    }

    /**
     * Enter a thread/worker
     */
    enterThread(threadName) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        this.sendProcessFlow(this.parent.defaultLevel, threadName, ProcessFlowType.EnterThread);
    }

    /**
     * Leave a thread/worker
     */
    leaveThread(threadName) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        this.sendProcessFlow(this.parent.defaultLevel, threadName, ProcessFlowType.LeaveThread);
    }

    // ==================== Control Commands ====================

    /**
     * Clear all logs
     */
    clearAll() {
        if (this.isOn()) {
            this.sendControlCommand(ControlCommandType.ClearAll);
        }
    }

    /**
     * Clear the log view
     */
    clearLog() {
        if (this.isOn()) {
            this.sendControlCommand(ControlCommandType.ClearLog);
        }
    }

    /**
     * Clear watches
     */
    clearWatches() {
        if (this.isOn()) {
            this.sendControlCommand(ControlCommandType.ClearWatches);
        }
    }

    /**
     * Clear auto views
     */
    clearAutoViews() {
        if (this.isOn()) {
            this.sendControlCommand(ControlCommandType.ClearAutoViews);
        }
    }

    /**
     * Clear process flow
     */
    clearProcessFlow() {
        if (this.isOn()) {
            this.sendControlCommand(ControlCommandType.ClearProcessFlow);
        }
    }

    // ==================== Stream Data ====================

    /**
     * Send stream data to a named channel
     * Streams are lightweight, high-frequency data channels for metrics, timeseries, etc.
     * @param {string} channel - Channel name (e.g., 'metrics', 'cpu', 'memory')
     * @param {any} data - Data to send (will be JSON stringified if object)
     */
    logStream(channel, data) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        const packet = {
            packetType: PacketType.Stream,
            channel,
            data: typeof data === 'string' ? data : JSON.stringify(data),
            timestamp: new Date()
        };

        this.parent.sendPacket(packet);
    }

    // ==================== Assert ====================

    /**
     * Log an assertion
     */
    logAssert(condition, message) {
        if (!this.isOn(Level.Error)) return;

        if (!condition) {
            this.sendLogEntry(Level.Error, message, LogEntryType.Assert, ViewerId.Title);
        }
    }

    // ==================== Conditional Logging ====================

    /**
     * Log conditionally
     */
    logConditional(condition, ...args) {
        if (!this.isOn(this.parent.defaultLevel)) return;

        if (condition) {
            const title = this.formatArgs(...args);
            this.sendLogEntry(this.parent.defaultLevel, title, LogEntryType.Conditional, ViewerId.Title);
        }
    }

    // ==================== System Info ====================

    /**
     * Log system information
     */
    logSystem(title = 'System Information') {
        if (!this.isOn(this.parent.defaultLevel)) return;

        const os = require('os');
        const ctx = new InspectorViewerContext();

        ctx.startGroup('System');
        ctx.appendKeyValue('Platform', os.platform());
        ctx.appendKeyValue('Architecture', os.arch());
        ctx.appendKeyValue('OS Type', os.type());
        ctx.appendKeyValue('OS Release', os.release());
        ctx.appendKeyValue('Hostname', os.hostname());

        ctx.startGroup('Node.js');
        ctx.appendKeyValue('Version', process.version);
        ctx.appendKeyValue('V8 Version', process.versions.v8);
        ctx.appendKeyValue('PID', process.pid);
        ctx.appendKeyValue('CWD', process.cwd());

        ctx.startGroup('Memory');
        const mem = process.memoryUsage();
        ctx.appendKeyValue('Heap Used', `${Math.round(mem.heapUsed / 1024 / 1024)} MB`);
        ctx.appendKeyValue('Heap Total', `${Math.round(mem.heapTotal / 1024 / 1024)} MB`);
        ctx.appendKeyValue('RSS', `${Math.round(mem.rss / 1024 / 1024)} MB`);

        ctx.startGroup('CPU');
        const cpus = os.cpus();
        ctx.appendKeyValue('Model', cpus[0]?.model || 'Unknown');
        ctx.appendKeyValue('Cores', cpus.length);
        ctx.appendKeyValue('Speed', `${cpus[0]?.speed || 0} MHz`);

        this.sendContext(this.parent.defaultLevel, title, LogEntryType.System, ctx);
    }

    /**
     * Log memory usage
     */
    logMemory(title = 'Memory Usage') {
        if (!this.isOn(this.parent.defaultLevel)) return;

        const mem = process.memoryUsage();
        const ctx = new InspectorViewerContext();

        ctx.startGroup('Heap');
        ctx.appendKeyValue('Used', `${Math.round(mem.heapUsed / 1024 / 1024)} MB`);
        ctx.appendKeyValue('Total', `${Math.round(mem.heapTotal / 1024 / 1024)} MB`);

        ctx.startGroup('Other');
        ctx.appendKeyValue('RSS', `${Math.round(mem.rss / 1024 / 1024)} MB`);
        ctx.appendKeyValue('External', `${Math.round(mem.external / 1024 / 1024)} MB`);
        if (mem.arrayBuffers) {
            ctx.appendKeyValue('Array Buffers', `${Math.round(mem.arrayBuffers / 1024 / 1024)} MB`);
        }

        this.sendContext(this.parent.defaultLevel, title, LogEntryType.MemoryStatistic, ctx);
    }

    /**
     * Log current stack trace
     */
    logStackTrace(title = 'Current Stack Trace') {
        if (!this.isOn(this.parent.defaultLevel)) return;

        const err = new Error();
        const stack = err.stack.split('\n').slice(2).join('\n'); // Remove Error and this method from stack

        const ctx = new TextContext(ViewerId.Data);
        ctx.loadFromText(stack);
        this.sendContext(this.parent.defaultLevel, title, LogEntryType.Text, ctx);
    }

    /**
     * Log environment variables
     */
    logEnvironment(title = 'Environment Variables') {
        if (!this.isOn(this.parent.defaultLevel)) return;

        const ctx = new ValueListViewerContext();
        const env = process.env;
        const keys = Object.keys(env).sort();

        for (const key of keys) {
            ctx.appendKeyValue(key, env[key]);
        }

        this.sendContext(this.parent.defaultLevel, title, LogEntryType.Text, ctx);
    }

    // ==================== Performance Timing ====================

    /**
     * Start a timer
     */
    timeStart(name) {
        if (!this._timers) this._timers = new Map();
        this._timers.set(name, process.hrtime.bigint());
        this.logMessage(`Timer "${name}" started`);
    }

    /**
     * End a timer and log the duration
     */
    timeEnd(name) {
        if (!this._timers || !this._timers.has(name)) {
            this.logWarning(`Timer "${name}" not found`);
            return;
        }

        const start = this._timers.get(name);
        const end = process.hrtime.bigint();
        const durationNs = end - start;
        const durationMs = Number(durationNs) / 1000000;

        this._timers.delete(name);
        this.watchFloat(name, durationMs);
        this.logMessage(`Timer "${name}": ${durationMs.toFixed(3)}ms`);
    }
}

module.exports = { Session };
