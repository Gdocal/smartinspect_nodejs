#!/usr/bin/env node
/**
 * Test: Mix of buffered and direct - matching the failing scenario
 */

const si = await import('./src/index.js');

console.log('[TEST] Mixed buffered + direct');

// Start connect (non-blocking)
si.connect({
  host: 'localhost',
  port: 4229,
  appName: 'MixedTest',
});

const log = si.createLogger('MixedTest');
const protocol = si.getInstance().protocol;

// BUFFERED - sent before connected
console.log('[TEST] Sending BUFFERED (connected:', protocol.connected, ')');
log.info('BUFFERED-1');
log.info('BUFFERED-2');
log.info('BUFFERED-3');

// Wait for connection
await new Promise(r => setTimeout(r, 500));
console.log('[TEST] After wait (connected:', protocol.connected, ')');
console.log('[TEST] bytesWritten:', protocol.socket?.bytesWritten);

// DIRECT - sent after connected
console.log('[TEST] Sending DIRECT...');
log.info('DIRECT-1');
console.log('[TEST] After DIRECT-1, bytesWritten:', protocol.socket?.bytesWritten);
log.info('DIRECT-2');
console.log('[TEST] After DIRECT-2, bytesWritten:', protocol.socket?.bytesWritten);
log.info('DIRECT-3');
console.log('[TEST] After DIRECT-3, bytesWritten:', protocol.socket?.bytesWritten);

// Wait before disconnect
await new Promise(r => setTimeout(r, 500));
console.log('[TEST] Before disconnect, bytesWritten:', protocol.socket?.bytesWritten);

await si.disconnect();
console.log('[TEST] Done');
process.exit(0);
