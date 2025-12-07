# SmartInspect Node.js Library - Bug Fixes Report

This document describes the series of bugs discovered and fixed in the SmartInspect Node.js library, primarily related to messages not being received by the server after `fetch()` calls or during fire-and-forget connection patterns.

## Summary

| Bug | Symptom | Root Cause | Fix |
|-----|---------|------------|-----|
| #1 Backlog Buffering Logic | Messages lost when disconnected | Buffering based on message level, not connection state | Rewrite to buffer when disconnected, send when connected |
| #2 Fire-and-Forget Race Condition | First messages lost during connect | Async queueing allowed flush before messages were queued | Make queueing synchronous when disconnected |
| #3 Wrapper API Stale Flag | Messages lost after `fetch()` | Module-level `_connected` flag became stale | Check `_instance?.enabled` instead |
| #4 Disconnect Hang | Process hangs on disconnect | `socket.destroy()` on already-destroyed socket doesn't emit 'close' | Check `socket.destroyed` first |
| #5 Duplicate LogHeader | Messages after buffered ones lost | Concurrent `_internalConnect()` calls created duplicate sockets | Add `_connectInProgress` promise guard |

---

## Bug #1: Backlog Buffering Based on Message Level

**Commit:** `5d1c1f9`

### Symptom
Messages were being lost or not buffered correctly when the connection was down.

### Root Cause
The original backlog implementation was based on the C# library's "level-triggered flush" design, where messages were buffered until a high-priority message (e.g., Error) triggered a flush. This design doesn't work well for "live logging" scenarios where you want all messages delivered as soon as connection is established.

The system was checking message levels instead of connection state to decide whether to buffer.

### Fix
Rewrote `implWritePacket()` to use connection state:
- **Disconnected**: Buffer the message in the backlog queue
- **Connected**: Send immediately to the socket

Added auto-flush on reconnection:
```javascript
async _reconnect() {
    await this._internalConnect();
    this.connected = true;

    // Auto-flush buffered packets after successful reconnection
    if (this.backlogEnabled && this._queue.count > 0) {
        await this._flushQueue();
    }
}
```

---

## Bug #2: Fire-and-Forget Connect Race Condition

**Commit:** `04403b4`

### Symptom
When using the fire-and-forget connection pattern (calling `connect()` without awaiting), the first few messages would be lost.

```javascript
// Fire-and-forget pattern
si.connect({ host: 'localhost', port: 4229 });
log.info('Message 1');  // LOST!
log.info('Message 2');  // LOST!
await new Promise(r => setTimeout(r, 500));
log.info('Message 3');  // Works
```

### Root Cause
The `writePacket()` method was calling `implWritePacket()` which returned a Promise immediately. This allowed the `_backgroundConnect().then(_flushQueue)` to run before the messages were queued.

Timeline:
1. `connect()` starts `_backgroundConnect()` (async)
2. `log.info('Message 1')` calls `writePacket()` → `implWritePacket()` returns Promise
3. `_backgroundConnect()` completes, calls `_flushQueue()` - **queue is empty!**
4. `implWritePacket()` Promise resolves, pushes to queue - **too late!**

### Fix
Made packet queueing **synchronous** when disconnected:

```javascript
writePacket(packet) {
    // Synchronous path for disconnected state - avoids race condition!
    if (!this.connected) {
        if (this.backlogEnabled) {
            this._queue.push(packet);  // Synchronous!
            if (this._keepOpen) {
                this._tryReconnect();  // Fire and forget
            }
        }
        return;
    }

    // Connected - forward immediately
    this._forwardPacket(packet, !this._keepOpen);
}
```

Also fixed `SmartInspect.enabled` timing to set `enabled = true` **before** awaiting `connect()`:
```javascript
async connect(options) {
    // Enable BEFORE await to allow backlog buffering during fire-and-forget connect
    this.enabled = true;
    await this.protocol.connect();
}
```

---

## Bug #3: Wrapper API Stale `_connected` Flag

**Commit:** `1edf395`

### Symptom
When using the wrapper API (`createLogger()`, module-level functions) with top-level dynamic imports, logging would stop working after `fetch()` calls.

```javascript
const si = await import('./src/index.js');
si.connect({ host: 'localhost', port: 4229 });
const log = si.createLogger('Test');

log.info('Before fetch');  // Works
await fetch('https://example.com');
log.info('After fetch');   // LOST!
```

### Root Cause
The wrapper in `src/index.js` used a module-level variable:

```javascript
let _connected = false;

export function createLogger(sessionName) {
    return {
        info(...args) {
            if (_connected) session.logMessage(...args);  // Stale reference!
        }
    };
}
```

With ESM/CJS interop during dynamic imports, the closure's reference to `_connected` could become stale after async operations like `fetch()`.

### Fix
Replaced all `if (_connected)` checks with `if (_instance?.enabled)`:

```javascript
export function createLogger(sessionName) {
    return {
        info(...args) {
            if (_instance?.enabled) session.logMessage(...args);  // Direct check!
        }
    };
}
```

This directly checks the SmartInspect instance state instead of relying on the module-level flag.

---

## Bug #4: Disconnect Hang When Socket Already Destroyed

**Commit:** `cf40396`

### Symptom
`await si.disconnect()` would hang forever if the socket had already been destroyed (e.g., server dropped connection).

### Root Cause
The `_internalDisconnect()` method was:
```javascript
_internalDisconnect() {
    return new Promise((resolve) => {
        this.socket.once('close', () => {
            resolve();
        });
        this.socket.destroy();  // Won't emit 'close' if already destroyed!
    });
}
```

When `socket.destroy()` is called on an already-destroyed socket, it doesn't emit another 'close' event, so the Promise never resolves.

### Fix
Check `socket.destroyed` before waiting:

```javascript
_internalDisconnect() {
    return new Promise((resolve) => {
        if (this.socket.destroyed) {
            this.socket = null;
            this.connected = false;
            resolve();
            return;
        }
        // ... rest of disconnect logic
    });
}
```

---

## Bug #5: Duplicate LogHeader Causing Lost Messages (The "fetch bug")

**Commit:** `e2a2663`

### Symptom
When mixing buffered messages (sent before connect) with direct messages (sent after connect), only the buffered messages would arrive at the server. Direct messages were lost even though `socket.bytesWritten` showed they were written.

```javascript
si.connect({ host: 'localhost', port: 4229 });
log.info('BUFFERED-1');  // ✅ Arrives
log.info('BUFFERED-2');  // ✅ Arrives
await new Promise(r => setTimeout(r, 500));
log.info('DIRECT-1');    // ❌ LOST
log.info('DIRECT-2');    // ❌ LOST
```

### Root Cause (The Most Subtle Bug)
When `writePacket()` was called while connection was in progress, it triggered `_tryReconnect()` → `_reconnect()` → `_internalConnect()`. But `_internalConnect()` was already running from `_backgroundConnect()`.

The check at the start of `_internalConnect()` was:
```javascript
_internalConnect() {
    return new Promise((resolve, reject) => {
        if (this.connected) {  // Still false during handshake!
            resolve();
            return;
        }
        this.socket = new net.Socket();  // Creates SECOND socket!
        // ...
        this.sendLogHeader();  // Sends SECOND LogHeader!
    });
}
```

Since `this.connected` was still `false` during the TCP handshake, the second call created a **second socket** and sent a **second LogHeader packet**. This corrupted the server's binary parser state, causing all subsequent messages to be silently dropped.

**Packet sequence with bug:**
1. LogHeader (from first `_internalConnect`)
2. BUFFERED-1
3. BUFFERED-2
4. **LogHeader** (DUPLICATE from second `_internalConnect`) ← Corrupts parser!
5. DIRECT-1 ← Lost
6. DIRECT-2 ← Lost

### Fix
Added a `_connectInProgress` promise guard to prevent concurrent connections:

```javascript
_internalConnect() {
    // If already connected, resolve immediately
    if (this.connected) {
        return Promise.resolve();
    }

    // If a connection is already in progress, return that promise
    if (this._connectInProgress) {
        return this._connectInProgress;  // Wait for existing connection
    }

    this._connectInProgress = new Promise((resolve, reject) => {
        this.socket = new net.Socket();
        // ... connection logic
    }).finally(() => {
        this._connectInProgress = null;
    });

    return this._connectInProgress;
}
```

Now the second caller waits for the existing connection instead of starting a new one.

Also improved `_internalDisconnect()` to use graceful `socket.end()` with proper 'finish' event handling:

```javascript
_internalDisconnect() {
    return new Promise((resolve) => {
        // Wait for 'finish' event - all writes flushed to kernel
        socket.once('finish', () => {
            socket.destroy();
        });

        socket.once('close', cleanup);

        // Safety timeout
        const safetyTimeout = setTimeout(() => {
            if (!finished && !socket.destroyed) {
                socket.destroy();
            }
        }, 5000);
        safetyTimeout.unref();

        socket.end();  // Graceful close
    });
}
```

---

## Testing Methodology

We used several test patterns to isolate and verify the bugs:

### Test: Buffered vs Direct
```javascript
log.info('BUFFERED-1');  // Before connect
await new Promise(r => setTimeout(r, 500));  // Wait for connect
log.info('DIRECT-1');    // After connect
```

### Test: With fetch()
```javascript
log.info('BEFORE-FETCH-1');
await fetch('https://httpbin.org/get');
log.info('AFTER-FETCH-1');
```

### Test: Stack Trace for LogHeader
Patched `sendLogHeader()` to print stack traces, revealing it was called twice.

### Test: Packet Tracing
Patched `_internalWritePacket()` to log packet types and contents, revealing the duplicate LogHeader.

---

## Key Lessons Learned

1. **Async/await race conditions are subtle**: The fire-and-forget pattern creates timing issues between Promise resolution and queue flush.

2. **Module-level state is fragile in ESM**: With dynamic imports and ESM/CJS interop, closures over module-level variables can become stale.

3. **Always guard against concurrent operations**: Multiple callers to `_internalConnect()` needed protection via a shared Promise.

4. **Binary protocol corruption is silent**: The duplicate LogHeader didn't cause errors - it just made subsequent messages disappear.

5. **`socket.destroy()` behavior matters**: Already-destroyed sockets behave differently and need special handling.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/protocol.js` | Backlog logic, race condition fixes, disconnect improvements, connection guard |
| `src/index.js` | Replace `_connected` with `_instance?.enabled` |
| `src/smartinspect.js` | Enable before await connect |
| `src/PacketQueue.js` | Add `onPacketDropped` callback |

---

## Verification

All bugs were verified fixed with the test:

```javascript
const si = await import('./src/index.js');
si.connect({ host: 'localhost', port: 4229, appName: 'FetchBugTest' });
const log = si.createLogger('Test');

log.info('BEFORE-FETCH-1');
log.info('BEFORE-FETCH-2');
await new Promise(r => setTimeout(r, 500));

await fetch('https://httpbin.org/get');

log.info('AFTER-FETCH-1');
log.info('AFTER-FETCH-2');
log.info('AFTER-FETCH-3');

await si.disconnect();
```

**Result**: All 5 messages now arrive at the server correctly.
