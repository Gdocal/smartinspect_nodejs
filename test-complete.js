/**
 * Complete test of SmartInspect Node.js library
 */

const si = require('./src/index');

async function runTests() {
    console.log('='.repeat(60));
    console.log('SmartInspect Node.js Library - Complete Test');
    console.log('='.repeat(60));

    // Connect
    try {
        await si.connect({
            host: '172.17.64.1',
            port: 4228,
            appName: 'SmartInspect Node.js Test'
        });
        console.log('\n[OK] Connected to SmartInspect Console\n');
    } catch (err) {
        console.error('[FAIL] Could not connect:', err.message);
        console.error('Make sure SmartInspect Console is running and listening on TCP port 4228');
        process.exit(1);
    }

    const session = si.getSession();

    // Clear previous logs
    session.clearAll();
    await delay(100);

    // ==================== Basic Logging ====================
    console.log('\n--- Basic Logging ---');

    si.log('This is a regular log message');
    si.info('This is an info message');
    si.debug('This is a debug message');
    si.warn('This is a warning message');
    si.error('This is an error message');

    session.logVerbose('Verbose message');
    session.logFatal('Fatal error message');
    session.logSeparator();

    // ==================== Variable Logging ====================
    console.log('\n--- Variable Logging ---');

    session.logString('name', 'John Doe');
    session.logInt('count', 42);
    session.logInt('hexValue', 255, true);
    session.logNumber('pi', 3.14159);
    session.logBool('isActive', true);
    session.logDateTime('now', new Date());
    session.logValue('mixedValue', { nested: { value: 123 } });

    // ==================== Object Logging ====================
    console.log('\n--- Object Logging ---');

    const user = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        roles: ['admin', 'user'],
        metadata: {
            createdAt: new Date(),
            lastLogin: new Date()
        }
    };
    session.logObject('User Object', user);

    // ==================== Array/Collection Logging ====================
    console.log('\n--- Collection Logging ---');

    session.logArray('Fruits', ['Apple', 'Banana', 'Cherry', 'Date']);

    session.logDictionary('Config', {
        host: 'localhost',
        port: 3000,
        debug: true
    });

    const myMap = new Map([
        ['key1', 'value1'],
        ['key2', 'value2']
    ]);
    session.logDictionary('Map Data', myMap);

    // ==================== Table Logging ====================
    console.log('\n--- Table Logging ---');

    const tableData = [
        { id: 1, name: 'Alice', age: 30, city: 'New York' },
        { id: 2, name: 'Bob', age: 25, city: 'Los Angeles' },
        { id: 3, name: 'Charlie', age: 35, city: 'Chicago' }
    ];
    session.logTable('Users Table', tableData);

    // ==================== JSON Logging ====================
    console.log('\n--- JSON Logging ---');

    const jsonData = {
        api: 'v1',
        endpoints: [
            { path: '/users', method: 'GET' },
            { path: '/users', method: 'POST' }
        ]
    };
    session.logJson('API Config', jsonData);

    // ==================== Source Code Logging ====================
    console.log('\n--- Source Code Logging ---');

    session.logJavaScript('Sample Code', `
function hello(name) {
    console.log('Hello, ' + name + '!');
}

hello('World');
`);

    session.logSql('Sample Query', `
SELECT u.id, u.name, COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE u.active = true
GROUP BY u.id, u.name
ORDER BY order_count DESC
LIMIT 10;
`);

    session.logHtml('HTML Sample', `
<!DOCTYPE html>
<html>
<head>
    <title>Sample Page</title>
</head>
<body>
    <h1>Hello World</h1>
    <p>This is a sample HTML page.</p>
</body>
</html>
`);

    // ==================== Binary Logging ====================
    console.log('\n--- Binary Logging ---');

    const binaryData = Buffer.from('Hello World! This is binary data.', 'utf8');
    session.logBinary('Binary Data', binaryData);

    // ==================== Exception Logging ====================
    console.log('\n--- Exception Logging ---');

    try {
        throw new Error('Something went wrong!');
    } catch (err) {
        session.logException(err, 'Caught Exception');
    }

    // ==================== Watch Variables ====================
    console.log('\n--- Watch Variables ---');

    session.watchString('currentUser', 'admin');
    session.watchInt('requestCount', 42);
    session.watchFloat('cpuUsage', 45.7);
    session.watchBool('isConnected', true);
    session.watch('complexValue', { status: 'running', uptime: 3600 });

    // ==================== Counters ====================
    console.log('\n--- Counters ---');

    for (let i = 0; i < 5; i++) {
        session.incCounter('loopCounter');
    }
    session.decCounter('loopCounter');

    // ==================== Checkpoints ====================
    console.log('\n--- Checkpoints ---');

    session.addCheckpoint();
    session.addCheckpoint('DataLoad', 'Loading user data');
    session.addCheckpoint('DataLoad', 'Loading product data');
    session.addCheckpoint('DataLoad', 'Complete');

    // ==================== Method Tracking ====================
    console.log('\n--- Method Tracking ---');

    session.enterMethod('processData');
    session.logMessage('Processing data...');
    session.enterMethod('validateInput');
    session.logMessage('Validating...');
    session.leaveMethod('validateInput');
    session.enterMethod('saveToDatabase');
    session.logMessage('Saving...');
    session.leaveMethod('saveToDatabase');
    session.leaveMethod('processData');

    // Using trackMethod helper
    const done = session.trackMethod('quickOperation');
    session.logMessage('Doing something quick...');
    done();

    // ==================== Process Flow ====================
    console.log('\n--- Process Flow ---');

    session.enterProcess('Node.js Test App');
    session.enterThread('Worker Thread 1');
    session.logMessage('Worker 1 running...');
    session.leaveThread('Worker Thread 1');
    session.leaveProcess('Node.js Test App');

    // ==================== System Information ====================
    console.log('\n--- System Information ---');

    session.logSystem();
    session.logMemory();
    session.logEnvironment();
    session.logStackTrace();

    // ==================== Timing ====================
    console.log('\n--- Timing ---');

    session.timeStart('operation');
    await delay(100);
    session.timeEnd('operation');

    // ==================== Colored Logging ====================
    console.log('\n--- Colored Logging ---');

    session.logColored({ r: 255, g: 0, b: 0, a: 255 }, 'Red message');
    session.logColored({ r: 0, g: 255, b: 0, a: 255 }, 'Green message');
    session.logColored({ r: 0, g: 0, b: 255, a: 255 }, 'Blue message');

    // ==================== Assertions ====================
    console.log('\n--- Assertions ---');

    session.logAssert(true, 'This should NOT appear (condition is true)');
    session.logAssert(false, 'This SHOULD appear (assertion failed!)');

    // ==================== Conditional Logging ====================
    console.log('\n--- Conditional Logging ---');

    session.logConditional(true, 'This appears because condition is true');
    session.logConditional(false, 'This should NOT appear');

    // ==================== Multiple Sessions ====================
    console.log('\n--- Multiple Sessions ---');

    const inspector = si.getInstance();
    const dbSession = inspector.getSession('Database');
    const apiSession = inspector.getSession('API');

    dbSession.logMessage('Database connection established');
    dbSession.logMessage('Query executed successfully');

    apiSession.logMessage('API request received');
    apiSession.logMessage('Response sent');

    // ==================== Console-style API ====================
    console.log('\n--- Console-style API ---');

    si.count('apiCalls');
    si.count('apiCalls');
    si.count('apiCalls');

    si.group('Transaction');
    si.log('Starting transaction...');
    si.log('Committing...');
    si.groupEnd('Transaction');

    // Using table
    si.table([
        { method: 'GET', path: '/api/users', status: 200 },
        { method: 'POST', path: '/api/users', status: 201 }
    ]);

    // ==================== Final Message ====================
    console.log('\n--- Test Complete ---');
    session.logMessage('All tests completed successfully!');

    // Wait for messages to flush
    await delay(500);

    // Disconnect
    await si.disconnect();
    console.log('\n[OK] Disconnected from SmartInspect Console');
    console.log('\n' + '='.repeat(60));
    console.log('Check SmartInspect Console to see all the logged messages!');
    console.log('='.repeat(60));
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

runTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
