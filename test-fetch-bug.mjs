#!/usr/bin/env node
/**
 * Test: Original bug reproduction - fetch() causing messages to be lost
 * This tests the scenario from the bug report where messages after fetch() didn't arrive.
 */

const si = await import('./src/index.js');

console.log('[TEST] Fetch Bug Reproduction');

si.connect({
    host: 'localhost',
    port: 4229,
    appName: 'FetchBugTest',
});

const log = si.createLogger('Test');

// Messages BEFORE fetch (buffered during connection)
console.log('[TEST] Sending messages BEFORE fetch...');
log.info('BEFORE-FETCH-1');
log.info('BEFORE-FETCH-2');

// Wait for connection
await new Promise(r => setTimeout(r, 500));
console.log('[TEST] Connected:', si.getInstance().protocol.connected);

// Now do fetch() - this was causing issues in the original bug
console.log('[TEST] Making fetch() call...');
try {
    const response = await fetch('https://httpbin.org/get');
    const data = await response.json();
    console.log('[TEST] Fetch succeeded, origin:', data.origin);
} catch (err) {
    console.log('[TEST] Fetch failed (expected if no network):', err.message);
}

// Messages AFTER fetch - these were being lost in the original bug
console.log('[TEST] Sending messages AFTER fetch...');
log.info('AFTER-FETCH-1');
log.info('AFTER-FETCH-2');
log.info('AFTER-FETCH-3');

// Wait for writes to complete
await new Promise(r => setTimeout(r, 500));

await si.disconnect();
console.log('[TEST] Done - check if ALL 5 messages arrived');
process.exit(0);
