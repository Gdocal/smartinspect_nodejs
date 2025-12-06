/**
 * Stream and Log load test - writes both streams and logs simultaneously
 * Streams: 10+ messages/sec with varied intervals
 * Logs: Regular log messages mixed in
 */

const si = require('./src/index');

// Config
const STREAM_TARGET_RATE = 15; // streams per second
const LOG_RATE = 3; // logs per second
const DURATION_SEC = 0; // 0 = run forever

const CHANNELS = ['metrics', 'events', 'performance', 'orders'];
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];

let streamCount = 0;
let logCount = 0;
let running = true;

async function main() {
    console.log('Connecting to SmartInspect...');

    try {
        await si.connect({
            host: 'localhost',
            port: 4229,
            appName: 'Stream Load Test'
        });
        console.log('Connected!\n');
    } catch (err) {
        console.error('Failed to connect:', err.message);
        process.exit(1);
    }

    const session = si.getSession();
    session.clearAll();

    console.log(`Starting load test for ${DURATION_SEC} seconds...`);
    console.log(`Target: ${STREAM_TARGET_RATE} streams/sec, ${LOG_RATE} logs/sec\n`);

    // Stream generator with variable intervals (50-150ms to average ~10+/sec)
    const streamLoop = async () => {
        while (running) {
            const channel = CHANNELS[Math.floor(Math.random() * CHANNELS.length)];
            const data = generateStreamData(channel);

            session.logStream(channel, JSON.stringify(data), 'json');
            streamCount++;

            // Variable delay: 30-100ms to get ~10-30 msgs/sec
            const delay = 30 + Math.floor(Math.random() * 70);
            await sleep(delay);
        }
    };

    // Log generator
    const logLoop = async () => {
        while (running) {
            const level = LOG_LEVELS[Math.floor(Math.random() * LOG_LEVELS.length)];
            const msg = generateLogMessage();

            switch (level) {
                case 'debug': session.logDebug(msg); break;
                case 'info': session.logMessage(msg); break;
                case 'warn': session.logWarning(msg); break;
                case 'error': session.logError(msg); break;
            }
            logCount++;

            // ~3 logs per second
            await sleep(300 + Math.floor(Math.random() * 100));
        }
    };

    // Stats reporter
    const statsLoop = async () => {
        const startTime = Date.now();
        let lastStreamCount = 0;
        let lastLogCount = 0;

        while (running) {
            await sleep(1000);
            const elapsed = (Date.now() - startTime) / 1000;
            const streamRate = streamCount - lastStreamCount;
            const logRate = logCount - lastLogCount;

            console.log(`[${elapsed.toFixed(0)}s] Streams: ${streamCount} (${streamRate}/s) | Logs: ${logCount} (${logRate}/s)`);

            lastStreamCount = streamCount;
            lastLogCount = logCount;
        }
    };

    // Start all loops
    streamLoop();
    logLoop();
    statsLoop();

    // Stop after duration (if set) or run forever
    if (DURATION_SEC > 0) {
        setTimeout(async () => {
            running = false;
            await sleep(500);

            const totalTime = DURATION_SEC;
            console.log('\n--- Test Complete ---');
            console.log(`Total streams: ${streamCount} (avg ${(streamCount/totalTime).toFixed(1)}/s)`);
            console.log(`Total logs: ${logCount} (avg ${(logCount/totalTime).toFixed(1)}/s)`);

            await si.disconnect();
            console.log('Disconnected.');
            process.exit(0);
        }, DURATION_SEC * 1000);
    } else {
        console.log('Running continuously... Press Ctrl+C to stop.\n');

        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\nStopping...');
            running = false;
            await sleep(500);
            await si.disconnect();
            console.log('Disconnected.');
            process.exit(0);
        });
    }
}

function generateStreamData(channel) {
    const now = Date.now();

    switch (channel) {
        case 'metrics':
            return {
                ts: now,
                cpu: (Math.random() * 100).toFixed(1),
                memory: (Math.random() * 8000).toFixed(0),
                requests: Math.floor(Math.random() * 1000),
                latency: (Math.random() * 200).toFixed(2)
            };
        case 'events':
            const events = ['user_login', 'page_view', 'button_click', 'form_submit', 'api_call'];
            return {
                ts: now,
                event: events[Math.floor(Math.random() * events.length)],
                userId: `user_${Math.floor(Math.random() * 1000)}`,
                sessionId: `sess_${Math.floor(Math.random() * 100)}`
            };
        case 'performance':
            return {
                ts: now,
                endpoint: `/api/v1/${['users', 'orders', 'products'][Math.floor(Math.random() * 3)]}`,
                duration: (Math.random() * 500).toFixed(2),
                status: [200, 200, 200, 201, 400, 500][Math.floor(Math.random() * 6)]
            };
        case 'orders':
            return {
                ts: now,
                orderId: `ORD-${Math.floor(Math.random() * 100000)}`,
                amount: (Math.random() * 1000).toFixed(2),
                currency: 'USD',
                status: ['pending', 'processing', 'completed', 'shipped'][Math.floor(Math.random() * 4)]
            };
        default:
            return { ts: now, value: Math.random() };
    }
}

function generateLogMessage() {
    const messages = [
        'Processing incoming request',
        'Database query executed successfully',
        'Cache hit for user session',
        'Validating user credentials',
        'Sending notification email',
        'Updating user preferences',
        'Generating report data',
        'Cleaning up expired sessions',
        'Syncing data with external service',
        'Checking system health status',
        'Retrying failed operation',
        'Rate limit check passed',
        'Authentication token refreshed',
        'File upload completed',
        'Background job scheduled'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
