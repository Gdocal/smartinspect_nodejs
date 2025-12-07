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
    GraphicId,
    Colors,
    parseColor
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
    return _instance?.enabled && _instance?.isConnected();
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
    if (_instance?.enabled) {
        getInstance().logMessage(...args);
    }
}

/**
 * Log info (like console.info, alias for log)
 */
function info(...args) {
    console.info(...args);
    if (_instance?.enabled) {
        getInstance().logMessage(...args);
    }
}

/**
 * Log debug (like console.debug)
 */
function debug(...args) {
    console.debug(...args);
    if (_instance?.enabled) {
        getInstance().logDebug(...args);
    }
}

/**
 * Log warning (like console.warn)
 */
function warn(...args) {
    console.warn(...args);
    if (_instance?.enabled) {
        getInstance().logWarning(...args);
    }
}

/**
 * Log error (like console.error)
 */
function error(...args) {
    console.error(...args);
    if (_instance?.enabled) {
        getInstance().logError(...args);
    }
}

/**
 * Log a table (like console.table)
 */
function table(data, columns) {
    console.table(data, columns);
    if (_instance?.enabled) {
        getInstance().logTable('Table', data, columns);
    }
}

/**
 * Start a timer (like console.time)
 */
function time(label) {
    console.time(label);
    if (_instance?.enabled) {
        getInstance().timeStart(label);
    }
}

/**
 * End a timer (like console.timeEnd)
 */
function timeEnd(label) {
    console.timeEnd(label);
    if (_instance?.enabled) {
        getInstance().timeEnd(label);
    }
}

/**
 * Log a stack trace (like console.trace)
 */
function trace(message) {
    console.trace(message);
    if (_instance?.enabled) {
        getInstance().logStackTrace(message || 'Trace');
    }
}

/**
 * Assert a condition (like console.assert)
 */
function assert(condition, ...args) {
    console.assert(condition, ...args);
    if (_instance?.enabled && !condition) {
        const message = args.length > 0 ? getInstance().mainSession.formatArgs(...args) : 'Assertion failed';
        getInstance().logAssert(condition, message);
    }
}

/**
 * Clear the console (like console.clear)
 */
function clear() {
    console.clear();
    if (_instance?.enabled) {
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
    if (_instance?.enabled) {
        getInstance().incCounter(label);
    }
}

/**
 * Reset count (like console.countReset)
 */
function countReset(label = 'default') {
    _counts.delete(label);
    console.countReset(label);
    if (_instance?.enabled) {
        getInstance().mainSession.resetCounter(label);
    }
}

/**
 * Group start (like console.group) - uses enterMethod
 */
function group(label) {
    console.group(label);
    if (_instance?.enabled) {
        getInstance().enterMethod(label);
    }
}

/**
 * Group end (like console.groupEnd) - uses leaveMethod
 */
function groupEnd(label) {
    console.groupEnd();
    if (_instance?.enabled && label) {
        getInstance().leaveMethod(label);
    }
}

// ==================== Extended SmartInspect Methods ====================
// Proxy to the singleton instance

/**
 * Log an object with detailed inspection
 */
function logObject(title, obj, includePrivate = false) {
    if (_instance?.enabled) {
        getInstance().logObject(title, obj, includePrivate);
    }
}

/**
 * Log JSON data
 */
function logJson(title, data) {
    if (_instance?.enabled) {
        getInstance().logJson(title, data);
    }
}

/**
 * Log an exception with stack trace
 */
function logException(err, title = null) {
    console.error(err);
    if (_instance?.enabled) {
        getInstance().logException(err, title);
    }
}

/**
 * Log a value with its name
 */
function logValue(name, value) {
    if (_instance?.enabled) {
        getInstance().logValue(name, value);
    }
}

/**
 * Watch a variable (shows in Watches panel)
 */
function watch(name, value) {
    if (_instance?.enabled) {
        getInstance().watch(name, value);
    }
}

/**
 * Log binary data as hex dump
 */
function logBinary(title, buffer) {
    if (_instance?.enabled) {
        getInstance().logBinary(title, buffer);
    }
}

/**
 * Log HTML content
 */
function logHtml(title, html) {
    if (_instance?.enabled) {
        getInstance().logHtml(title, html);
    }
}

/**
 * Log SQL query
 */
function logSql(title, sql) {
    if (_instance?.enabled) {
        getInstance().logSql(title, sql);
    }
}

/**
 * Log system information
 */
function logSystem(title = 'System Information') {
    if (_instance?.enabled) {
        getInstance().logSystem(title);
    }
}

/**
 * Log memory usage
 */
function logMemory(title = 'Memory Usage') {
    if (_instance?.enabled) {
        getInstance().logMemory(title);
    }
}

/**
 * Log environment variables
 */
function logEnvironment(title = 'Environment') {
    if (_instance?.enabled) {
        getInstance().logEnvironment(title);
    }
}

/**
 * Add a checkpoint marker
 */
function checkpoint(name = null, details = null) {
    if (_instance?.enabled) {
        getInstance().addCheckpoint(name, details);
    }
}

/**
 * Enter a method (for method tracking)
 */
function enterMethod(name) {
    if (_instance?.enabled) {
        getInstance().enterMethod(name);
    }
}

/**
 * Leave a method (for method tracking)
 */
function leaveMethod(name) {
    if (_instance?.enabled) {
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
            if (_instance?.enabled) session.logMessage(...args);
        },
        info(...args) {
            console.info(`[${sessionName}]`, ...args);
            if (_instance?.enabled) session.logMessage(...args);
        },
        debug(...args) {
            console.debug(`[${sessionName}]`, ...args);
            if (_instance?.enabled) session.logDebug(...args);
        },
        warn(...args) {
            console.warn(`[${sessionName}]`, ...args);
            if (_instance?.enabled) session.logWarning(...args);
        },
        error(...args) {
            console.error(`[${sessionName}]`, ...args);
            if (_instance?.enabled) session.logError(...args);
        },
        verbose(...args) {
            if (_instance?.enabled) session.logVerbose(...args);
        },
        fatal(...args) {
            console.error(`[${sessionName}] FATAL:`, ...args);
            if (_instance?.enabled) session.logFatal(...args);
        },

        // Extended methods
        exception(err, title = null) {
            console.error(`[${sessionName}]`, err);
            if (_instance?.enabled) session.logException(err, title);
        },
        object(title, obj, includePrivate = false) {
            if (_instance?.enabled) session.logObject(title, obj, includePrivate);
        },
        json(title, data) {
            if (_instance?.enabled) session.logJson(title, data);
        },
        table(title, data, columns = null) {
            if (_instance?.enabled) session.logTable(title, data, columns);
        },
        array(title, arr) {
            if (_instance?.enabled) session.logArray(title, arr);
        },
        sql(title, query) {
            if (_instance?.enabled) session.logSql(title, query);
        },
        html(title, content) {
            if (_instance?.enabled) session.logHtml(title, content);
        },
        xml(title, content) {
            if (_instance?.enabled) session.logXml(title, content);
        },
        binary(title, buffer) {
            if (_instance?.enabled) session.logBinary(title, buffer);
        },

        // Variables
        value(name, value) {
            if (_instance?.enabled) session.logValue(name, value);
        },
        watch(name, value) {
            if (_instance?.enabled) session.watch(name, value);
        },

        // Method tracking
        enterMethod(name) {
            if (_instance?.enabled) session.enterMethod(name);
        },
        leaveMethod(name) {
            if (_instance?.enabled) session.leaveMethod(name);
        },
        trackMethod(name) {
            if (_instance?.enabled) return session.trackMethod(name);
            return () => {}; // No-op if not connected
        },
        wrapMethod(name, fn) {
            return session.wrapMethod(name, fn);
        },

        // Timing
        time(label) {
            console.time(`[${sessionName}] ${label}`);
            if (_instance?.enabled) session.timeStart(label);
        },
        timeEnd(label) {
            console.timeEnd(`[${sessionName}] ${label}`);
            if (_instance?.enabled) session.timeEnd(label);
        },

        // Checkpoints & counters
        checkpoint(name = null, details = null) {
            if (_instance?.enabled) session.addCheckpoint(name, details);
        },
        incCounter(name) {
            if (_instance?.enabled) session.incCounter(name);
        },
        decCounter(name) {
            if (_instance?.enabled) session.decCounter(name);
        },

        // Control
        clear() {
            if (_instance?.enabled) session.clearLog();
        },
        separator() {
            if (_instance?.enabled) session.logSeparator();
        },

        // Assert
        assert(condition, message) {
            console.assert(condition, `[${sessionName}]`, message);
            if (_instance?.enabled) session.logAssert(condition, message);
        },

        // Stream data
        stream(channel, data, type = null) {
            if (_instance?.enabled) session.logStream(channel, data, type);
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
    if (_instance?.enabled) {
        getInstance().logColored(color, ...args);
    }
}

/**
 * Log a separator line
 */
function separator() {
    if (_instance?.enabled) {
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
    Colors,
    parseColor,

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
