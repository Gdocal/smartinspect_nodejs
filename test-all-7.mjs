#!/usr/bin/env node
/**
 * Test: All 7 messages must arrive
 */

const si = await import('./src/index.js');

console.log('[TEST] Testing all 7 messages');

si.connect({
  host: 'localhost',
  port: 4229,
  appName: 'All7Test',
});

const log = si.createLogger('All7Test');

// 3 before connect
log.info('Message 1 - before connect');
log.info('Message 2 - before connect');
log.info('Message 3 - before connect');

// Wait for connection
await new Promise(r => setTimeout(r, 500));
console.log('[TEST] Connected:', si.getInstance().protocol.connected);

// 2 after connect
log.info('Message 4 - after connect');
log.info('Message 5 - after connect');

// fetch
await fetch('https://www.google.com', { method: 'HEAD' });
console.log('[TEST] After fetch');

// 2 after fetch
log.info('Message 6 - after fetch');
log.info('Message 7 - after fetch');

// Wait for writes to complete
await new Promise(r => setTimeout(r, 200));

// Disconnect
await si.disconnect();
console.log('[TEST] Disconnected');

// Force exit
process.exit(0);
