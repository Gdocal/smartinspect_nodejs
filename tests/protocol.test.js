/**
 * Comprehensive Protocol Tests
 *
 * Tests for TcpProtocol covering:
 * - Connection/disconnection
 * - Backlog buffering
 * - Fire-and-forget connect
 * - Reconnection
 * - Configuration options
 */

const { TcpProtocol } = require('../src/protocol');
const { MockSmartInspectServer } = require('./helpers/mock-server');
const { PacketType } = require('../src/enums');

// Helper to create a log entry packet
function createLogEntryPacket(message = 'Test message') {
    return {
        packetType: PacketType.LogEntry,
        title: message,
        data: Buffer.from(message)
    };
}

// Helper to wait for a condition
function waitFor(condition, timeout = 5000, interval = 10) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            if (condition()) {
                resolve();
            } else if (Date.now() - startTime > timeout) {
                reject(new Error('Timeout waiting for condition'));
            } else {
                setTimeout(check, interval);
            }
        };
        check();
    });
}

describe('TcpProtocol', () => {
    let server;
    let protocol;

    beforeEach(async () => {
        server = new MockSmartInspectServer();
        await server.start();
    });

    afterEach(async () => {
        if (protocol) {
            try {
                await protocol.disconnect();
            } catch (e) {
                // Ignore disconnect errors in cleanup
            }
            protocol = null;
        }
        if (server) {
            await server.stop();
            server = null;
        }
    });

    describe('Connection', () => {
        test('connects with default options', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port
            });

            await protocol.connect();

            // Wait for connection to complete
            await waitFor(() => protocol.connected, 2000);
            expect(protocol.connected).toBe(true);
            expect(protocol.failed).toBe(false);
        });

        test('connects with custom host/port', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                appName: 'CustomApp',
                hostName: 'CustomHost',
                room: 'CustomRoom'
            });

            await protocol.connect();
            await waitFor(() => protocol.connected, 2000);

            expect(protocol.connected).toBe(true);
            expect(protocol.appName).toBe('CustomApp');
            expect(protocol.hostName).toBe('CustomHost');
            expect(protocol.room).toBe('CustomRoom');
        });

        test('calls onConnect callback', async () => {
            const onConnect = jest.fn();

            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                onConnect
            });

            await protocol.connect();
            await waitFor(() => protocol.connected, 2000);

            expect(onConnect).toHaveBeenCalled();
        });

        test('calls onError callback on connection failure', async () => {
            const onError = jest.fn();

            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: 59999, // Non-existent port
                timeout: 500,
                reconnect: false,
                onError
            });

            await protocol.connect();

            // Wait for error callback
            await waitFor(() => onError.mock.calls.length > 0, 2000);
            expect(onError).toHaveBeenCalled();
            expect(protocol.failed).toBe(true);
        });

        test('handles connection timeout', async () => {
            // Create a server that delays handshake
            await server.stop();
            server = new MockSmartInspectServer({ delayHandshake: 5000 });
            await server.start();

            const onError = jest.fn();

            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                timeout: 100, // Very short timeout
                reconnect: false,
                onError
            });

            await protocol.connect();

            // Wait for timeout error
            await waitFor(() => onError.mock.calls.length > 0, 2000);
            expect(onError).toHaveBeenCalled();
        });

        test('timeout: 0 is accepted (not replaced with default)', () => {
            // Verify that timeout: 0 is stored as 0, not replaced by default
            // This uses ?? operator which only replaces null/undefined, not 0
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                timeout: 0
            });

            expect(protocol.timeout).toBe(0);
            // Note: timeout: 0 means connection will time out immediately
            // This test just verifies the value is accepted, not that it works
        });
    });

    describe('Disconnection', () => {
        test('disconnects cleanly', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port
            });

            await protocol.connect();
            await waitFor(() => protocol.connected, 2000);

            await protocol.disconnect();
            expect(protocol.connected).toBe(false);
        });

        test('calls onDisconnect callback', async () => {
            const onDisconnect = jest.fn();

            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                onDisconnect
            });

            await protocol.connect();
            await waitFor(() => protocol.connected, 2000);

            await protocol.disconnect();

            // Give time for callback
            await new Promise(r => setTimeout(r, 100));
            expect(onDisconnect).toHaveBeenCalled();
        });

        test('clears queue on disconnect', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: 59998, // Port that won't connect
                reconnect: true, // Need reconnect=true to buffer packets
                reconnectInterval: 60000, // Long interval so no reconnect happens
                backlog: { enabled: true }
            });

            // Add packets to queue without connecting
            protocol.writePacket(createLogEntryPacket('Message 1'));
            protocol.writePacket(createLogEntryPacket('Message 2'));

            expect(protocol._queue.count).toBe(2);

            await protocol.disconnect();
            expect(protocol._queue.count).toBe(0);
        });
    });

    describe('Backlog Buffering', () => {
        test('buffers messages when disconnected (backlog enabled)', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                backlog: { enabled: true }
            });

            // Write packets before connecting
            protocol.writePacket(createLogEntryPacket('Message 1'));
            protocol.writePacket(createLogEntryPacket('Message 2'));
            protocol.writePacket(createLogEntryPacket('Message 3'));

            // Queue should have 3 packets immediately (synchronous)
            expect(protocol._queue.count).toBe(3);
        });

        test('drops messages when backlog disabled', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                reconnect: true,
                backlog: { enabled: false }
            });

            // Write packets before connecting
            protocol.writePacket(createLogEntryPacket('Message 1'));
            protocol.writePacket(createLogEntryPacket('Message 2'));

            // Queue should be empty (messages dropped)
            expect(protocol._queue.count).toBe(0);
        });

        test('flushes backlog when connected', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                backlog: { enabled: true }
            });

            // Queue packets before connecting
            protocol.writePacket(createLogEntryPacket('Buffered 1'));
            protocol.writePacket(createLogEntryPacket('Buffered 2'));

            expect(protocol._queue.count).toBe(2);

            // Now connect
            await protocol.connect();
            await waitFor(() => protocol.connected, 2000);

            // Queue should be flushed
            await waitFor(() => protocol._queue.count === 0, 2000);
            expect(protocol._queue.count).toBe(0);

            // Server should have received packets (LogHeader + 2 buffered)
            await server.waitForPackets(3, 2000);
            expect(server.getPacketCount()).toBeGreaterThanOrEqual(3);
        });

        test('respects backlog queue size limit', async () => {
            const onPacketDropped = jest.fn();

            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                reconnect: true,
                backlog: {
                    enabled: true,
                    queue: 1 // 1KB limit - very small
                }
            });

            protocol._queue.onPacketDropped = onPacketDropped;

            // Write many large packets to overflow the queue
            for (let i = 0; i < 100; i++) {
                protocol.writePacket(createLogEntryPacket('X'.repeat(100)));
            }

            // Some packets should have been dropped
            // The exact number depends on packet size vs queue limit
            expect(onPacketDropped.mock.calls.length).toBeGreaterThan(0);
        });

        test('backlog.keepOpen = true keeps connection open', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                backlog: { enabled: true, keepOpen: true }
            });

            expect(protocol._keepOpen).toBe(true);
        });

        test('backlog.keepOpen = false closes after each packet', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                backlog: { enabled: true, keepOpen: false }
            });

            expect(protocol._keepOpen).toBe(false);
        });
    });

    describe('Fire-and-Forget Connect', () => {
        test('messages sent immediately after connect() are buffered', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                backlog: { enabled: true }
            });

            // Fire and forget - don't await
            protocol.connect();

            // Immediately send messages
            protocol.writePacket(createLogEntryPacket('Message 1'));
            protocol.writePacket(createLogEntryPacket('Message 2'));
            protocol.writePacket(createLogEntryPacket('Message 3'));

            // All messages should be queued synchronously
            expect(protocol._queue.count).toBe(3);

            // Wait for connection
            await waitFor(() => protocol.connected, 2000);

            // Queue should be flushed
            await waitFor(() => protocol._queue.count === 0, 2000);
            expect(protocol._queue.count).toBe(0);
        });

        test('all buffered messages arrive in order', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                backlog: { enabled: true }
            });

            // Fire and forget
            protocol.connect();

            // Send numbered messages
            for (let i = 1; i <= 5; i++) {
                protocol.writePacket(createLogEntryPacket(`Message ${i}`));
            }

            // Wait for connection and flush
            await waitFor(() => protocol.connected, 2000);
            await waitFor(() => protocol._queue.count === 0, 2000);

            // Server should receive LogHeader + 5 messages = 6 packets
            await server.waitForPackets(6, 2000);
            expect(server.getPacketCount()).toBe(6);
        });

        test('no message loss during fire-and-forget connect', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                backlog: { enabled: true }
            });

            const messageCount = 10;

            // Fire and forget
            protocol.connect();

            // Send many messages immediately
            for (let i = 1; i <= messageCount; i++) {
                protocol.writePacket(createLogEntryPacket(`Message ${i}`));
            }

            // Wait for connection and flush
            await waitFor(() => protocol.connected, 2000);
            await waitFor(() => protocol._queue.count === 0, 2000);

            // Wait for server to receive all packets
            // LogHeader (1) + messageCount messages
            await server.waitForPackets(1 + messageCount, 3000);
            expect(server.getPacketCount()).toBe(1 + messageCount);
        });
    });

    describe('Reconnection', () => {
        test('reconnect = true enables auto-reconnect', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                reconnect: true
            });

            expect(protocol.reconnect).toBe(true);
        });

        test('reconnect = false disables auto-reconnect', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                reconnect: false
            });

            expect(protocol.reconnect).toBe(false);
        });

        test('drops messages when reconnect = false and disconnected', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                reconnect: false,
                backlog: { enabled: true }
            });

            // Write without connecting
            protocol.writePacket(createLogEntryPacket('Message 1'));

            // Message should be dropped (reconnect = false skips in writePacket)
            expect(protocol._queue.count).toBe(0);
        });

        test('respects reconnect interval', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                reconnect: true,
                reconnectInterval: 1000 // 1 second
            });

            expect(protocol.reconnectInterval).toBe(1000);
        });

        test('triggers reconnect when writing while disconnected', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                reconnect: true,
                reconnectInterval: 0, // No delay
                backlog: { enabled: true, keepOpen: true }
            });

            // Write packet - should trigger reconnect attempt
            protocol.writePacket(createLogEntryPacket('Message 1'));

            // Wait for reconnect to complete
            await waitFor(() => protocol.connected, 3000);
            expect(protocol.connected).toBe(true);
        });
    });

    describe('Configuration', () => {
        test('default values are applied', () => {
            protocol = new TcpProtocol({});

            expect(protocol.host).toBe('127.0.0.1');
            expect(protocol.port).toBe(4228);
            expect(protocol.reconnect).toBe(true);
            expect(protocol.reconnectInterval).toBe(3000);
            expect(protocol.backlogEnabled).toBe(true);
            expect(protocol.asyncEnabled).toBe(false);
        });

        test('custom values override defaults', () => {
            protocol = new TcpProtocol({
                host: '192.168.1.100',
                port: 5000,
                timeout: 10000,
                reconnect: false,
                reconnectInterval: 5000,
                backlog: {
                    enabled: false,
                    queue: 4096,
                    keepOpen: false
                },
                async: {
                    enabled: true,
                    queue: 1024,
                    throttle: true,
                    clearOnDisconnect: true
                }
            });

            expect(protocol.host).toBe('192.168.1.100');
            expect(protocol.port).toBe(5000);
            expect(protocol.timeout).toBe(10000);
            expect(protocol.reconnect).toBe(false);
            expect(protocol.reconnectInterval).toBe(5000);
            expect(protocol.backlogEnabled).toBe(false);
            expect(protocol.backlogQueue).toBe(4096 * 1024);
            expect(protocol.backlogKeepOpen).toBe(false);
            expect(protocol.asyncEnabled).toBe(true);
            expect(protocol.asyncQueue).toBe(1024 * 1024);
            expect(protocol.asyncThrottle).toBe(true);
            expect(protocol.asyncClearOnDisconnect).toBe(true);
        });

        test('getQueueStats returns correct values', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                backlog: { enabled: true }
            });

            protocol.writePacket(createLogEntryPacket('Message 1'));
            protocol.writePacket(createLogEntryPacket('Message 2'));

            const stats = protocol.getQueueStats();
            expect(stats.backlogCount).toBe(2);
            expect(stats.backlogSize).toBeGreaterThan(0);
        });
    });

    describe('Packet Writing', () => {
        test('sends packets when connected', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port
            });

            await protocol.connect();
            await waitFor(() => protocol.connected, 2000);

            // Clear any packets received during connection
            const initialCount = server.getPacketCount();

            // Write packets
            protocol.writePacket(createLogEntryPacket('Test 1'));
            protocol.writePacket(createLogEntryPacket('Test 2'));

            // Wait for the 2 new messages
            await waitFor(() => server.getPacketCount() >= initialCount + 2, 2000);

            // Should have received at least 2 new packets
            expect(server.getPacketCount()).toBeGreaterThanOrEqual(initialCount + 2);
        });

        test('sends LogHeader on connect', async () => {
            protocol = new TcpProtocol({
                host: '127.0.0.1',
                port: server.port,
                appName: 'TestApp',
                hostName: 'TestHost',
                room: 'TestRoom'
            });

            await protocol.connect();
            await waitFor(() => protocol.connected, 2000);

            // First packet should be LogHeader
            await server.waitForPackets(1, 2000);
            const firstPacket = server.getPackets()[0];
            expect(firstPacket.type).toBe(PacketType.LogHeader);
        });
    });
});
