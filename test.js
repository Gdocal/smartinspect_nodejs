/**
 * Test script for SmartInspect Node.js PoC
 */

const { SmartInspectClient, LogEntryType } = require('./smartinspect');

// Configuration - try different hosts
const PORT = 4228;

async function testConnection(host, port, timeout = 5000) {
    console.log(`\n=== Testing connection to ${host}:${port} ===`);

    const client = new SmartInspectClient({
        host: host,
        port: port,
        appName: 'Node.js Test App'
    });

    try {
        // Add timeout wrapper
        const connectPromise = client.connect();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), timeout)
        );

        await Promise.race([connectPromise, timeoutPromise]);
        console.log('Connected successfully!');

        // Send test messages
        client.logMessage('Hello from Node.js!');
        client.logWarning('This is a warning message');
        client.logError('This is an error message');
        client.logDebug('Debug information');

        console.log('Sent test messages. Check SmartInspect Console!');

        // Wait a bit for messages to be sent
        await new Promise(resolve => setTimeout(resolve, 1000));

        client.close();
        console.log('Connection closed.');
        return true;
    } catch (err) {
        console.error('Connection failed:', err.message);
        client.close();
        return false;
    }
}

async function main() {
    console.log('SmartInspect Node.js PoC - Connection Test');
    console.log('==========================================');

    // Try different Windows host IPs (from WSL)
    // Priority: WSL gateway, nameserver, localhost
    const hosts = [
        '172.17.64.1',     // WSL default gateway (Windows host)
        '10.255.255.254',  // Nameserver IP
        '127.0.0.1',       // Localhost
    ];

    for (const host of hosts) {
        const success = await testConnection(host, PORT, 3000);
        if (success) {
            console.log(`\n*** SUCCESS: Connected via ${host}:${PORT} ***`);
            return;
        }
    }

    console.log('\n*** All connection attempts failed ***');
    console.log('\nPlease ensure SmartInspect Console is running on Windows');
    console.log('and listening on TCP port 4228.');
    console.log('\nIn SmartInspect Console, go to:');
    console.log('  File > Options > TCP Server');
    console.log('  Enable TCP server on port 4228');
}

main().catch(console.error);
