#!/usr/bin/env node
/**
 * Test: Fire-and-forget connect with backlog buffering
 */

async function main() {
  console.log('[TEST] Testing backlog buffering');
  console.log('');

  const si = require('./src/index.js');

  // Connect WITHOUT waiting
  console.log('[TEST] Calling si.connect() - fire and forget...');
  si.connect({
    host: 'localhost',
    port: 4229,
    appName: 'BacklogTest',
  }); // NO AWAIT!

  const protocol = si.getInstance().protocol;
  console.log('[TEST] protocol.connected:', protocol.connected);
  console.log('[TEST] protocol.reconnect:', protocol.reconnect);
  console.log('[TEST] protocol.backlogEnabled:', protocol.backlogEnabled);
  console.log('[TEST] protocol._keepOpen:', protocol._keepOpen);

  const log = si.createLogger('BacklogTest');

  console.log('[TEST] Sending messages BEFORE socket is connected...');
  log.info('Message 1 - sent before connect');

  // Check queue immediately
  console.log('[TEST] Immediately after log: queue count:', protocol._queue?.count);

  // Give microtask a chance to run
  await Promise.resolve();
  console.log('[TEST] After microtask: queue count:', protocol._queue?.count);

  log.info('Message 2 - sent before connect');
  log.info('Message 3 - sent before connect');

  await Promise.resolve();
  console.log('[TEST] After more logs: queue count:', protocol._queue?.count);

  // Wait for connection
  await new Promise(r => setTimeout(r, 500));

  console.log('[TEST] After 500ms: protocol.connected:', protocol.connected);
  console.log('[TEST] Queue count:', protocol._queue?.count);

  log.info('Message 4 - after connect');
  log.info('Message 5 - after connect');

  await fetch('https://www.google.com', { method: 'HEAD' });

  log.info('Message 6 - after fetch');
  log.info('Message 7 - after fetch');

  await new Promise(r => setTimeout(r, 500));
  await si.disconnect();
  console.log('[TEST] Done');
}

main().catch(console.error);
