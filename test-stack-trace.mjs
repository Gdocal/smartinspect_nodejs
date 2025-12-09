#!/usr/bin/env node
/**
 * Test: Trace where LogHeader is being sent
 */

const si = await import('./src/index.js');

console.log('[TEST] Stack Trace Test');

si.connect({
    host: 'localhost',
    port: 4229,
    appName: 'StackTrace',
});

const instance = si.getInstance();
const protocol = instance.protocol;

// Patch sendLogHeader to show stack trace
const originalSendLogHeader = protocol.sendLogHeader.bind(protocol);
let logHeaderCount = 0;
protocol.sendLogHeader = function() {
    logHeaderCount++;
    console.log(`\n[LOGHEADER #${logHeaderCount}] Stack trace:`);
    console.log(new Error().stack);
    return originalSendLogHeader();
};

const log = si.createLogger('Test');

// BUFFERED
console.log('[TEST] Sending BUFFERED...');
log.info('BUFFERED-1');
log.info('BUFFERED-2');

// Wait for connection
console.log('[TEST] Waiting 500ms...');
await new Promise(r => setTimeout(r, 500));
console.log('[TEST] Connected:', protocol.connected);
console.log(`[TEST] Total LogHeaders sent: ${logHeaderCount}`);

// DIRECT
console.log('[TEST] Sending DIRECT...');
log.info('DIRECT-1');
log.info('DIRECT-2');

await new Promise(r => setTimeout(r, 500));

await si.disconnect();
console.log('[TEST] Done');
process.exit(0);
