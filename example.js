/**
 * Example: Using SmartInspect Logger with Node.js
 */

const logger = require('./logger');

async function main() {
    // Connect to SmartInspect Console
    // For WSL2 -> Windows, use the gateway IP
    await logger.connect({
        host: '172.17.64.1',
        port: 4228,
        appName: 'Node.js Example App'
    });

    // Use like console.log - messages go to both console AND SmartInspect
    logger.log('Application started');
    logger.info('This is an info message');
    logger.debug('Debug details here');
    logger.warn('This is a warning');
    logger.error('This is an error');

    // Can log objects too
    const user = { id: 1, name: 'John', email: 'john@example.com' };
    logger.log('User data:', user);

    // Can log errors
    try {
        throw new Error('Something went wrong!');
    } catch (err) {
        logger.error('Caught exception:', err);
    }

    // Wait a moment for messages to flush
    await new Promise(resolve => setTimeout(resolve, 500));

    logger.log('Application finished');

    // Disconnect
    logger.disconnect();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
