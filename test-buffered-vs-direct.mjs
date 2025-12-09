#!/usr/bin/env node
/**
 * Test: Buffered (before connect) vs Direct (after connect)
 */

const si = await import('./src/index.js');

console.log('[TEST] Buffered vs Direct');

si.connect({
  host: 'localhost',
  port: 4229,
  appName: 'BufferedVsDirect',
});

const log = si.createLogger('Test');

// These are BUFFERED
log.info('BUFFERED-1');
log.info('BUFFERED-2');
log.info('BUFFERED-3');

// Wait for connection - buffered messages are flushed here
await new Promise(r => setTimeout(r, 500));
console.log('[TEST] Connected:', si.getInstance().protocol.connected);

// These are DIRECT writes
log.info('DIRECT-1');
log.info('DIRECT-2');
log.info('DIRECT-3');
log.info('DIRECT-4');

// Give time for writes
await new Promise(r => setTimeout(r, 500));

await si.disconnect();
console.log('[TEST] Done');
process.exit(0);
