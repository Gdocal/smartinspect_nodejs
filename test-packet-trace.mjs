#!/usr/bin/env node
/**
 * Test: Trace every packet with full content
 */

const si = await import('./src/index.js');

console.log('[TEST] Packet Trace Test');

si.connect({
    host: 'localhost',
    port: 4229,
    appName: 'PacketTrace',
});

const instance = si.getInstance();
const protocol = instance.protocol;

// Patch _internalWritePacket to log packet details
const originalInternalWritePacket = protocol._internalWritePacket.bind(protocol);
let packetCounter = 0;
protocol._internalWritePacket = function(packet) {
    packetCounter++;
    console.log(`\n[PACKET ${packetCounter}] Type: ${packet.packetType}`);
    console.log(`  title: ${JSON.stringify(packet.title)}`);
    console.log(`  content: ${JSON.stringify(packet.content)}`);
    console.log(`  sessionName: ${JSON.stringify(packet.sessionName)}`);
    console.log(`  logEntryType: ${packet.logEntryType}`);
    console.log(`  viewerId: ${packet.viewerId}`);

    // Get the formatted buffer
    const buffer = this.formatter.format(packet);
    console.log(`  buffer size: ${buffer.length} bytes`);
    console.log(`  buffer hex (first 50): ${buffer.slice(0, 50).toString('hex')}`);

    return originalInternalWritePacket(packet);
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

// DIRECT
console.log('[TEST] Sending DIRECT...');
log.info('DIRECT-1');
log.info('DIRECT-2');

await new Promise(r => setTimeout(r, 500));

await si.disconnect();
console.log('[TEST] Done');
process.exit(0);
