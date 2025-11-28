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
const { TcpProtocol, detectWindowsHost } = require('./protocol');
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

    _connecting = instance.connect(options);
    await _connecting;
    _connected = true;
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
 * Set the log level
 */
function setLevel(level) {
    getInstance().setLevel(level);
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
    setLevel,
    getInstance,

    // Classes for advanced usage
    SmartInspect,
    Session,
    TcpProtocol,

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
