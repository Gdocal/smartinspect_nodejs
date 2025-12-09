#!/usr/bin/env node
/**
 * Test: Check socket drain behavior
 */

const si = await import('./src/index.js');

console.log('[TEST] Drain Test');

si.connect({
    host: 'localhost',
    port: 4229,
    appName: 'DrainTest',
});

const instance = si.getInstance();
const protocol = instance.protocol;
const log = si.createLogger('Test');

// BUFFERED
log.info('BUFFERED-1');
log.info('BUFFERED-2');

// Wait for connection
await new Promise(r => setTimeout(r, 500));
console.log('[TEST] Connected:', protocol.connected);

// Patch socket.write to track drain
const socket = protocol.socket;
const originalWrite = socket.write.bind(socket);
socket.write = function(data, ...args) {
    const result = originalWrite(data, ...args);
    console.log('[SOCKET] write returned:', result, '(false = buffer full, need drain)');
    console.log('[SOCKET]   bytesWritten:', socket.bytesWritten);
    console.log('[SOCKET]   writableLength:', socket.writableLength);
    console.log('[SOCKET]   writableHighWaterMark:', socket.writableHighWaterMark);
    return result;
};

// DIRECT
console.log('[TEST] Sending DIRECT...');
log.info('DIRECT-1');
log.info('DIRECT-2');

// Check socket state immediately
console.log('[TEST] Immediately after writes:');
console.log('[TEST]   writableLength:', socket.writableLength);
console.log('[TEST]   writableFinished:', socket.writableFinished);

// Wait for drain if needed
console.log('[TEST] Waiting for drain event or 1s...');
await new Promise(r => {
    const timeout = setTimeout(r, 1000);
    socket.once('drain', () => {
        console.log('[SOCKET] DRAIN EVENT!');
        clearTimeout(timeout);
        r();
    });
});

console.log('[TEST] After wait:');
console.log('[TEST]   writableLength:', socket.writableLength);
console.log('[TEST]   bytesWritten:', socket.bytesWritten);

await si.disconnect();
console.log('[TEST] Done');
process.exit(0);
