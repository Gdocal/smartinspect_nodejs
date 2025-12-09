#!/usr/bin/env node
/**
 * Test: Write directly to socket
 */

const si = await import('./src/index.js');

si.connect({
  host: 'localhost',
  port: 4229,
  appName: 'SocketDirect',
});

await new Promise(r => setTimeout(r, 500));

const protocol = si.getInstance().protocol;
const socket = protocol.socket;

console.log('[TEST] Socket state after connect:');
console.log('  connected:', protocol.connected);
console.log('  socket:', !!socket);
console.log('  socket.writable:', socket?.writable);
console.log('  socket.destroyed:', socket?.destroyed);
console.log('  bytesWritten:', socket?.bytesWritten);

const log = si.createLogger('SocketDirect');

// Log and track bytes
const bytesBefore = socket.bytesWritten;
log.info('DIRECT-1');
const bytesAfter1 = socket.bytesWritten;
console.log('[TEST] After DIRECT-1: bytesWritten went from', bytesBefore, 'to', bytesAfter1);

log.info('DIRECT-2');
const bytesAfter2 = socket.bytesWritten;
console.log('[TEST] After DIRECT-2: bytesWritten is now', bytesAfter2);

// Wait and check
await new Promise(r => setTimeout(r, 100));
console.log('[TEST] After 100ms: bytesWritten is', socket.bytesWritten);

await si.disconnect();
console.log('[TEST] Done');
process.exit(0);
