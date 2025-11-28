/**
 * SmartInspect Logger - Node.js console-compatible interface
 *
 * Usage:
 *   const logger = require('./logger');
 *   await logger.connect({ host: '172.17.64.1', port: 4228 });
 *   logger.log('Hello World');
 *   logger.warn('Warning message');
 *   logger.error('Error message');
 *   logger.debug('Debug info');
 */

const { SmartInspectClient, LogEntryType } = require('./smartinspect');

// Global client instance
let client = null;
let connected = false;

/**
 * Connect to SmartInspect Console
 * @param {Object} options - Connection options
 * @param {string} options.host - Host IP (default: auto-detect WSL gateway)
 * @param {number} options.port - Port number (default: 4228)
 * @param {string} options.appName - Application name shown in console
 */
async function connect(options = {}) {
    // Default to WSL gateway if not specified
    const host = options.host || process.env.SMARTINSPECT_HOST || '172.17.64.1';
    const port = options.port || parseInt(process.env.SMARTINSPECT_PORT) || 4228;
    const appName = options.appName || process.env.SMARTINSPECT_APP || 'Node.js App';

    client = new SmartInspectClient({ host, port, appName });

    try {
        await client.connect();
        connected = true;
        console.log(`[SmartInspect] Connected to ${host}:${port}`);
    } catch (err) {
        console.error(`[SmartInspect] Connection failed: ${err.message}`);
        connected = false;
        throw err;
    }
}

/**
 * Disconnect from SmartInspect Console
 */
function disconnect() {
    if (client) {
        client.close();
        connected = false;
        console.log('[SmartInspect] Disconnected');
    }
}

/**
 * Check if connected
 */
function isConnected() {
    return connected;
}

// Standard logging methods (console-compatible)

function log(...args) {
    const message = args.map(formatArg).join(' ');
    if (connected) {
        client.logMessage(message);
    }
    console.log(...args);
}

function info(...args) {
    const message = args.map(formatArg).join(' ');
    if (connected) {
        client.logMessage(message);
    }
    console.info(...args);
}

function warn(...args) {
    const message = args.map(formatArg).join(' ');
    if (connected) {
        client.logWarning(message);
    }
    console.warn(...args);
}

function error(...args) {
    const message = args.map(formatArg).join(' ');
    if (connected) {
        client.logError(message);
    }
    console.error(...args);
}

function debug(...args) {
    const message = args.map(formatArg).join(' ');
    if (connected) {
        client.logDebug(message);
    }
    console.debug(...args);
}

/**
 * Format argument for logging
 */
function formatArg(arg) {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;
    try {
        return JSON.stringify(arg, null, 2);
    } catch {
        return String(arg);
    }
}

// Export console-compatible interface
module.exports = {
    connect,
    disconnect,
    isConnected,
    log,
    info,
    warn,
    error,
    debug,
    // Also export raw client for advanced usage
    SmartInspectClient,
    LogEntryType
};
