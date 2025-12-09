#!/usr/bin/env node
/**
 * Test: Debug flush race condition
 */

const si = await import('./src/index.js');

console.log('[TEST] Flush Race Test');

si.connect({
    host: 'localhost',
    port: 4229,
    appName: 'FlushRace',
});

// Get protocol after connect (it's created during connect)
const instance = si.getInstance();
const protocol = instance.protocol;

// Patch protocol to add debug logging
const originalFlushQueue = protocol._flushQueue.bind(protocol);
protocol._flushQueue = async function() {
    console.log('[PROTOCOL] _flushQueue START, queue count:', this._queue.count);
    const result = await originalFlushQueue();
    console.log('[PROTOCOL] _flushQueue END');
    return result;
};

const originalForwardPacket = protocol._forwardPacket.bind(protocol);
protocol._forwardPacket = async function(packet, disconnectAfter) {
    console.log('[PROTOCOL] _forwardPacket called, connected:', this.connected, 'packet title:', packet.title);
    return originalForwardPacket(packet, disconnectAfter);
};

const originalWritePacket = protocol.writePacket.bind(protocol);
protocol.writePacket = function(packet) {
    console.log('[PROTOCOL] writePacket called, connected:', this.connected, 'packet title:', packet.title);
    return originalWritePacket(packet);
};

const originalInternalWritePacket = protocol._internalWritePacket.bind(protocol);
protocol._internalWritePacket = function(packet) {
    console.log('[PROTOCOL] _internalWritePacket, socket:', !!this.socket, 'packet title:', packet.title);
    if (this.socket) {
        console.log('[PROTOCOL]   socket.writable:', this.socket.writable);
        console.log('[PROTOCOL]   socket.destroyed:', this.socket.destroyed);
    }
    return originalInternalWritePacket(packet);
};

const log = si.createLogger('Test');

// BUFFERED - sent before connected
console.log('[TEST] Sending BUFFERED messages...');
log.info('BUFFERED-1');
log.info('BUFFERED-2');

// Wait for connection and flush
console.log('[TEST] Waiting 500ms for connect/flush...');
await new Promise(r => setTimeout(r, 500));
console.log('[TEST] After wait, connected:', protocol.connected);

// DIRECT - sent after connected
console.log('[TEST] Sending DIRECT messages...');
log.info('DIRECT-1');
log.info('DIRECT-2');

await new Promise(r => setTimeout(r, 500));
console.log('[TEST] Before disconnect, bytesWritten:', protocol.socket?.bytesWritten);

await si.disconnect();
console.log('[TEST] Done');
process.exit(0);
