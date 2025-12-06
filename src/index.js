/**
 * SmartInspect for Node.js
 *
 * A complete port of the SmartInspect logging library with Node.js-compatible API.
 *
 * Features:
 * - Console-compatible logging (log, warn, error, debug, info)
 * - Full SmartInspect protocol support
 * - Object inspection, tables, source code, binary data
 * - Method tracking, watches, process flow
 * - Multiple sessions support
 *
 * Usage:
 *
 *   // Quick start (console-like)
 *   const si = require('smartinspect');
 *   await si.connect({ host: '172.17.64.1' });
 *   si.log('Hello World');
 *   si.warn('Warning!');
 *   si.error('Error!');
 *
 *   // Full API
 *   const { SmartInspect } = require('smartinspect');
 *   const inspector = new SmartInspect('My App');
 *   await inspector.connect({ host: '172.17.64.1', port: 4228 });
 *   inspector.logObject('User', { name: 'John', age: 30 });
 *   inspector.logTable('Data', [...]);
 */

const { SmartInspect, getDefault, getMainSession } = require('./smartinspect');
const { Session } = require('./session');
const { TcpProtocol, PipeProtocol, detectWindowsHost } = require('./protocol');
const {
    Level,
    PacketType,
    LogEntryType,
    ViewerId,
    WatchType,
    ControlCommandType,
    ProcessFlowType,
    SourceId,
    GraphicId
} = require('./enums');

// New scheduler/queue classes
const { PacketQueue } = require('./PacketQueue');
const { Scheduler } = require('./Scheduler');
const { SchedulerCommand } = require('./SchedulerCommand');
const { SchedulerAction } = require('./SchedulerAction');
const { SchedulerQueue } = require('./SchedulerQueue');
const {
    ViewerContext,
    TextContext,
    ListViewerContext,
    ValueListViewerContext,
    InspectorViewerContext,
    TableViewerContext,
    DataViewerContext,
    BinaryContext,
    BinaryViewerContext,
    SourceViewerContext,
    WebViewerContext
} = require('./contexts');

// ==================== Console-Compatible API ====================

/**
 * Default instance for quick usage
 */
let _instance = null;
let _connected = false;
let _connecting = null;
let _options = null;

/**
 * Get or create the singleton instance
 */
function getInstance() {
    if (!_instance) {
        _instance = new SmartInspect('Node.js App');
    }
    return _instance;
}

/**
 * Connect to SmartInspect Console
 * @param {Object} options - Connection options
 * @param {string} options.host - SmartInspect Console host
 * @param {number} options.port - SmartInspect Console port (default: 4228)
 * @param {string} options.appName - Application name
 * @returns {Promise<SmartInspect>}
 */
async function connect(options = {}) {
    _options = options;
    const instance = getInstance();

    if (options.appName) {
        instance.appName = options.appName;
    }

    // Set _connected immediately to allow backlog buffering
    // Messages sent before connection completes will be buffered by the protocol
    _connected = true;
    _connecting = instance.connect(options);
    await _connecting;
    _connecting = null;

    return instance;
}

/**
 * Disconnect from SmartInspect Console
 */
async function disconnect() {
    if (_instance) {
        await _instance.disconnect();
        _connected = false;
    }
}

/**
 * Check if connected
 */
function isConnected() {
    return _connected && _instance && _instance.isConnected();
}

/**
 * Ensure connected before logging
 * If connect() was called but not awaited, wait for it
 */
async function ensureConnected() {
    if (_connecting) {
        await _connecting;
    }
}

// ==================== Console-Style Methods ====================
// These mirror console.log/warn/error/debug/info behavior
// but also send to SmartInspect Console

/**
 * Log a message (like console.log)
 */
function log(...args) {
    console.log(...args);
    if (_connected) {
        getInstance().logMessage(...args);
    }
}

/**
 * Log info (like console.info, alias for log)
 */
function info(...args) {
    console.info(...args);
    if (_connected) {
        getInstance().logMessage(...args);
    }
}

/**
 * Log debug (like console.debug)
 */
function debug(...args) {
    console.debug(...args);
    if (_connected) {
        getInstance().logDebug(...args);
    }
}

/**
 * Log warning (like console.warn)
 */
function warn(...args) {
    console.warn(...args);
    if (_connected) {
        getInstance().logWarning(...args);
    }
}

/**
 * Log error (like console.error)
 */
function error(...args) {
    console.error(...args);
    if (_connected) {
        getInstance().logError(...args);
    }
}

/**
 * Log a table (like console.table)
 */
function table(data, columns) {
    console.table(data, columns);
    if (_connected) {
        getInstance().logTable('Table', data, columns);
    }
}

/**
 * Start a timer (like console.time)
 */
function time(label) {
    console.time(label);
    if (_connected) {
        getInstance().timeStart(label);
    }
}

/**
 * End a timer (like console.timeEnd)
 */
function timeEnd(label) {
    console.timeEnd(label);
    if (_connected) {
        getInstance().timeEnd(label);
    }
}

/**
 * Log a stack trace (like console.trace)
 */
function trace(message) {
    console.trace(message);
    if (_connected) {
        getInstance().logStackTrace(message || 'Trace');
    }
}

/**
 * Assert a condition (like console.assert)
 */
function assert(condition, ...args) {
    console.assert(condition, ...args);
    if (_connected && !condition) {
        const message = args.length > 0 ? getInstance().mainSession.formatArgs(...args) : 'Assertion failed';
        getInstance().logAssert(condition, message);
    }
}

/**
 * Clear the console (like console.clear)
 */
function clear() {
    console.clear();
    if (_connected) {
        getInstance().clearLog();
    }
}

/**
 * Count calls (like console.count)
 */
const _counts = new Map();
function count(label = 'default') {
    const current = (_counts.get(label) || 0) + 1;
    _counts.set(label, current);
    console.count(label);
    if (_connected) {
        getInstance().incCounter(label);
    }
}

/**
 * Reset count (like console.countReset)
 */
function countReset(label = 'default') {
    _counts.delete(label);
    console.countReset(label);
    if (_connected) {
        getInstance().mainSession.resetCounter(label);
    }
}

/**
 * Group start (like console.group) - uses enterMethod
 */
function group(label) {
    console.group(label);
    if (_connected) {
        getInstance().enterMethod(label);
    }
}

/**
 * Group end (like console.groupEnd) - uses leaveMethod
 */
function groupEnd(label) {
    console.groupEnd();
    if (_connected && label) {
        getInstance().leaveMethod(label);
    }
}

// ==================== Extended SmartInspect Methods ====================
// Proxy to the singleton instance

/**
 * Log an object with detailed inspection
 */
function logObject(title, obj, includePrivate = false) {
    if (_connected) {
        getInstance().logObject(title, obj, includePrivate);
    }
}

/**
 * Log JSON data
 */
function logJson(title, data) {
    if (_connected) {
        getInstance().logJson(title, data);
    }
}

/**
 * Log an exception with stack trace
 */
function logException(err, title = null) {
    console.error(err);
    if (_connected) {
        getInstance().logException(err, title);
    }
}

/**
 * Log a value with its name
 */
function logValue(name, value) {
    if (_connected) {
        getInstance().logValue(name, value);
    }
}

/**
 * Watch a variable (shows in Watches panel)
 */
function watch(name, value) {
    if (_connected) {
        getInstance().watch(name, value);
    }
}

/**
 * Log binary data as hex dump
 */
function logBinary(title, buffer) {
    if (_connected) {
        getInstance().logBinary(title, buffer);
    }
}

/**
 * Log HTML content
 */
function logHtml(title, html) {
    if (_connected) {
        getInstance().logHtml(title, html);
    }
}

/**
 * Log SQL query
 */
function logSql(title, sql) {
    if (_connected) {
        getInstance().logSql(title, sql);
    }
}

/**
 * Log system information
 */
function logSystem(title = 'System Information') {
    if (_connected) {
        getInstance().logSystem(title);
    }
}

/**
 * Log memory usage
 */
function logMemory(title = 'Memory Usage') {
    if (_connected) {
        getInstance().logMemory(title);
    }
}

/**
 * Log environment variables
 */
function logEnvironment(title = 'Environment') {
    if (_connected) {
        getInstance().logEnvironment(title);
    }
}

/**
 * Add a checkpoint marker
 */
function checkpoint(name = null, details = null) {
    if (_connected) {
        getInstance().addCheckpoint(name, details);
    }
}

/**
 * Enter a method (for method tracking)
 */
function enterMethod(name) {
    if (_connected) {
        getInstance().enterMethod(name);
    }
}

/**
 * Leave a method (for method tracking)
 */
function leaveMethod(name) {
    if (_connected) {
        getInstance().leaveMethod(name);
    }
}

/**
 * Wrap a function for automatic method tracking
 */
function wrapMethod(name, fn) {
    return getInstance().wrapMethod(name, fn);
}

/**
 * Get the main session for direct access
 */
function getSession(name = null) {
    return name ? getInstance().getSession(name) : getInstance().mainSession;
}

/**
 * Create a logger for a specific module/class/component
 *
 * Usage:
 *   // With custom name
 *   const log = si.createLogger('Database');
 *
 *   // With __filename (auto-extracts module name)
 *   const log = si.createLogger(__filename);
 *
 *   // Then use console-style methods
 *   log.info('Connected');
 *   log.warn('Slow query');
 *   log.error('Connection failed');
 *
 * @param {string} nameOrFilename - Session name or __filename
 * @returns {Object} Logger object with console-compatible methods
 */
function createLogger(nameOrFilename) {
    // Extract session name
    let sessionName;

    if (nameOrFilename.includes('/') || nameOrFilename.includes('\\')) {
        // It's a file path - extract filename without extension
        const path = require('path');
        sessionName = path.basename(nameOrFilename, path.extname(nameOrFilename));
        // Capitalize first letter
        sessionName = sessionName.charAt(0).toUpperCase() + sessionName.slice(1);
    } else {
        // It's already a name
        sessionName = nameOrFilename;
    }

    // Get or create session
    const session = getInstance().getSession(sessionName);

    // Return console-compatible logger object
    return {
        // Session name for reference
        name: sessionName,
        session: session,

        // Console-compatible methods
        log(...args) {
            console.log(`[${sessionName}]`, ...args);
            if (_connected) session.logMessage(...args);
        },
        info(...args) {
            console.info(`[${sessionName}]`, ...args);
            if (_connected) session.logMessage(...args);
        },
        debug(...args) {
            console.debug(`[${sessionName}]`, ...args);
            if (_connected) session.logDebug(...args);
        },
        warn(...args) {
            console.warn(`[${sessionName}]`, ...args);
            if (_connected) session.logWarning(...args);
        },
        error(...args) {
            console.error(`[${sessionName}]`, ...args);
            if (_connected) session.logError(...args);
        },
        verbose(...args) {
            if (_connected) session.logVerbose(...args);
        },
        fatal(...args) {
            console.error(`[${sessionName}] FATAL:`, ...args);
            if (_connected) session.logFatal(...args);
        },

        // Extended methods
        exception(err, title = null) {
            console.error(`[${sessionName}]`, err);
            if (_connected) session.logException(err, title);
        },
        object(title, obj, includePrivate = false) {
            if (_connected) session.logObject(title, obj, includePrivate);
        },
        json(title, data) {
            if (_connected) session.logJson(title, data);
        },
        table(title, data, columns = null) {
            if (_connected) session.logTable(title, data, columns);
        },
        array(title, arr) {
            if (_connected) session.logArray(title, arr);
        },
        sql(title, query) {
            if (_connected) session.logSql(title, query);
        },
        html(title, content) {
            if (_connected) session.logHtml(title, content);
        },
        xml(title, content) {
            if (_connected) session.logXml(title, content);
        },
        binary(title, buffer) {
            if (_connected) session.logBinary(title, buffer);
        },

        // Variables
        value(name, value) {
            if (_connected) session.logValue(name, value);
        },
        watch(name, value) {
            if (_connected) session.watch(name, value);
        },

        // Method tracking
        enterMethod(name) {
            if (_connected) session.enterMethod(name);
        },
        leaveMethod(name) {
            if (_connected) session.leaveMethod(name);
        },
        trackMethod(name) {
            if (_connected) return session.trackMethod(name);
            return () => {}; // No-op if not connected
        },
        wrapMethod(name, fn) {
            return session.wrapMethod(name, fn);
        },

        // Timing
        time(label) {
            console.time(`[${sessionName}] ${label}`);
            if (_connected) session.timeStart(label);
        },
        timeEnd(label) {
            console.timeEnd(`[${sessionName}] ${label}`);
            if (_connected) session.timeEnd(label);
        },

        // Checkpoints & counters
        checkpoint(name = null, details = null) {
            if (_connected) session.addCheckpoint(name, details);
        },
        incCounter(name) {
            if (_connected) session.incCounter(name);
        },
        decCounter(name) {
            if (_connected) session.decCounter(name);
        },

        // Control
        clear() {
            if (_connected) session.clearLog();
        },
        separator() {
            if (_connected) session.logSeparator();
        },

        // Assert
        assert(condition, message) {
            console.assert(condition, `[${sessionName}]`, message);
            if (_connected) session.logAssert(condition, message);
        },

        // Stream data
        stream(channel, data, type = null) {
            if (_connected) session.logStream(channel, data, type);
        }
    };
}

/**
 * Set the log level
 */
function setLevel(level) {
    getInstance().setLevel(level);
}

/**
 * Get queue statistics (for monitoring async/backlog)
 * @returns {Object} { backlogCount, backlogSize, schedulerCount, schedulerSize }
 */
function getQueueStats() {
    return getInstance().getQueueStats();
}

/**
 * Create a colored log message
 */
function logColored(color, ...args) {
    if (_connected) {
        getInstance().logColored(color, ...args);
    }
}

/**
 * Log a separator line
 */
function separator() {
    if (_connected) {
        getInstance().logSeparator();
    }
}

// ==================== Module Exports ====================

module.exports = {
    // Console-compatible methods
    log,
    info,
    debug,
    warn,
    error,
    table,
    time,
    timeEnd,
    trace,
    assert,
    clear,
    count,
    countReset,
    group,
    groupEnd,

    // Connection management
    connect,
    disconnect,
    isConnected,

    // Extended logging
    logObject,
    logJson,
    logException,
    logValue,
    logBinary,
    logHtml,
    logSql,
    logSystem,
    logMemory,
    logEnvironment,
    watch,
    checkpoint,
    separator,
    logColored,

    // Method tracking
    enterMethod,
    leaveMethod,
    wrapMethod,

    // Session management
    getSession,
    createLogger,
    setLevel,
    getInstance,
    getQueueStats,

    // Classes for advanced usage
    SmartInspect,
    Session,
    TcpProtocol,
    PipeProtocol,

    // Scheduler/Queue classes (for advanced usage)
    PacketQueue,
    Scheduler,
    SchedulerCommand,
    SchedulerAction,
    SchedulerQueue,

    // Enums
    Level,
    PacketType,
    LogEntryType,
    ViewerId,
    WatchType,
    ControlCommandType,
    ProcessFlowType,
    SourceId,
    GraphicId,

    // Viewer contexts (for custom viewers)
    ViewerContext,
    TextContext,
    ListViewerContext,
    ValueListViewerContext,
    InspectorViewerContext,
    TableViewerContext,
    DataViewerContext,
    BinaryContext,
    BinaryViewerContext,
    SourceViewerContext,
    WebViewerContext,

    // Utilities
    detectWindowsHost
};
