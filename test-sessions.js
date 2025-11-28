/**
 * Test session-based logging with createLogger
 */

const si = require('./src/index');

async function main() {
    await si.connect({
        host: '172.17.64.1',
        port: 4228,
        appName: 'Session Test App'
    });

    // Clear previous logs
    si.clear();

    // ==================== Method 1: Named logger ====================
    const dbLog = si.createLogger('Database');
    const apiLog = si.createLogger('API');
    const authLog = si.createLogger('Authentication');

    dbLog.info('Connecting to database...');
    dbLog.info('Connection established');
    dbLog.sql('Query', 'SELECT * FROM users WHERE active = true');
    dbLog.warn('Slow query detected');

    apiLog.info('Server started on port 3000');
    apiLog.info('GET /api/users');
    apiLog.json('Response', { users: [{ id: 1, name: 'John' }] });

    authLog.info('User login attempt');
    authLog.error('Invalid password');
    authLog.info('User logged in successfully');

    // ==================== Method 2: Use __filename ====================
    // Simulating what would happen in different files
    const log1 = si.createLogger('/app/services/user-service.js');
    const log2 = si.createLogger('/app/controllers/order-controller.js');

    log1.info('UserService initialized');  // Session: "User-service"
    log2.info('OrderController ready');    // Session: "Order-controller"

    // ==================== Extended features per session ====================
    dbLog.enterMethod('executeQuery');
    dbLog.debug('Preparing statement...');
    dbLog.debug('Executing...');
    dbLog.leaveMethod('executeQuery');

    apiLog.time('request');
    await new Promise(r => setTimeout(r, 50));
    apiLog.timeEnd('request');

    // Object/table logging
    dbLog.object('Connection Config', {
        host: 'localhost',
        port: 5432,
        database: 'myapp'
    });

    apiLog.table('Endpoints', [
        { method: 'GET', path: '/users', handler: 'getUsers' },
        { method: 'POST', path: '/users', handler: 'createUser' }
    ]);

    // Wait for flush
    await new Promise(r => setTimeout(r, 500));
    await si.disconnect();

    console.log('\nDone! Check SmartInspect Console.');
    console.log('You should see logs grouped by session: Database, API, Authentication, etc.');
}

main().catch(console.error);
