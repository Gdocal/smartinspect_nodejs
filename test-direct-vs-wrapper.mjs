#!/usr/bin/env node
/**
 * Test: Direct API vs Wrapper API
 */

const si = await import('./src/index.js');

console.log('[TEST] Testing Direct vs Wrapper');

si.connect({
  host: 'localhost',
  port: 4229,
  appName: 'DirectVsWrapper',
});

const log = si.createLogger('WrapperSession');
const instance = si.getInstance();
const directSession = instance.getSession('DirectSession');

// Wait for connection
await new Promise(r => setTimeout(r, 500));
console.log('[TEST] Connected:', instance.protocol.connected);
console.log('[TEST] instance.enabled:', instance.enabled);

// Test DIRECT API (should work)
console.log('[TEST] Sending via DIRECT session...');
directSession.logMessage('Direct Message 1');
directSession.logMessage('Direct Message 2');

// Test WRAPPER API (may fail)
console.log('[TEST] Sending via WRAPPER...');
log.info('Wrapper Message 1');
log.info('Wrapper Message 2');

// Check if _instance?.enabled works
console.log('[TEST] Checking _instance?.enabled...');
const _instance = si.getInstance();
console.log('[TEST] _instance:', !!_instance);
console.log('[TEST] _instance?.enabled:', _instance?.enabled);

await new Promise(r => setTimeout(r, 500));
await si.disconnect();
console.log('[TEST] Done');
process.exit(0);
