# Changelog

## [1.1.0] - 2024-12-04

### Added

#### Async Scheduler (Non-Blocking Logging)
When enabled, log calls return immediately while packets are processed in the background via Node.js `setImmediate`. This prevents logging from blocking your application.

```javascript
await si.connect({
    host: '127.0.0.1',
    async: {
        enabled: true,      // Enable async scheduler
        queue: 4096,        // Max queue size in KB (default: 2048)
        throttle: false,    // Block callers when queue full (default: false)
        clearOnDisconnect: false  // Clear queue on disconnect
    }
});
```

#### Backlog Buffering (Server Unavailable Handling)
Packets are buffered when the server is unavailable and automatically sent when connection is restored. High-priority logs (Error level and above) trigger an immediate flush.

```javascript
await si.connect({
    host: '127.0.0.1',
    backlog: {
        enabled: true,      // Enable packet buffering
        queue: 2048,        // Max buffer size in KB (default: 2048)
        flushOn: Level.Error,  // Flush on Error+ logs (default)
        keepOpen: true      // Keep connection open between writes
    }
});
```

#### Auto-Reconnection
Automatic reconnection with configurable interval when connection is lost.

```javascript
await si.connect({
    host: '127.0.0.1',
    reconnect: true,           // Enable auto-reconnect
    reconnectInterval: 5000    // Min ms between attempts (default: 0)
});
```

#### Connection String Support (C# Style)
All new options can be specified via connection strings:

```javascript
// Full example with all options
await si.connect('tcp(host=127.0.0.1,port=4228,async.enabled=true,async.queue=4096,backlog=2048,reconnect=true,reconnect.interval=5000)');

// Shorthand backlog syntax
await si.connect('tcp(host=127.0.0.1,backlog=2048,backlog.flushon=error)');
```

#### Queue Statistics
Monitor buffer usage for async and backlog queues:

```javascript
const stats = si.getQueueStats();
console.log(stats);
// { backlogCount: 10, backlogSize: 1024, schedulerCount: 5, schedulerSize: 512 }
```

#### New Exports
- `PacketQueue` - FIFO queue class for custom buffering
- `Scheduler` - Background processor class
- `SchedulerCommand` - Command wrapper
- `SchedulerAction` - Action enum (Connect, WritePacket, Disconnect, Dispatch)
- `SchedulerQueue` - Queue for scheduler commands
- `PipeProtocol` - Now exported for direct use
- `getQueueStats()` - Function to get queue statistics

### Changed

- `sendPacket()` now delegates buffering to the protocol layer, allowing async mode to work correctly
- Protocols (TcpProtocol, PipeProtocol) now have internal `implConnect()`, `implDisconnect()`, `implWritePacket()` methods
- Connection errors are emitted via EventEmitter in async mode instead of throwing

### Configuration Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `async.enabled` | boolean | false | Enable async scheduler |
| `async.queue` | number (KB) | 2048 | Max async queue size |
| `async.throttle` | boolean | false | Block callers when queue full |
| `async.clearOnDisconnect` | boolean | false | Clear queue on disconnect |
| `backlog.enabled` | boolean | **true** | Enable packet buffering |
| `backlog.queue` | number (KB) | 2048 | Max backlog size |
| `backlog.flushOn` | Level | Error | Flush on this log level+ |
| `backlog.keepOpen` | boolean | **true** | Keep connection open |
| `reconnect` | boolean | **true** | Enable auto-reconnect |
| `reconnectInterval` | number (ms) | **3000** | Min time between reconnects |

### Behavior Changes

**When server is unavailable:**
1. Packets are buffered (if backlog enabled) or queued (if async enabled)
2. Auto-reconnection attempts start (if reconnect enabled)
3. High-priority logs (Error+) trigger immediate flush attempt
4. Oldest packets are dropped when buffer exceeds limit (FIFO eviction)
5. No silent log loss - packets are either delivered or explicitly dropped

**Throttle mode:**
When `async.throttle=true`, `writePacketAsync()` will wait if the queue is full, providing backpressure to the caller.

---

## [1.0.0] - Initial Release

- Console-compatible API (log, warn, error, debug, etc.)
- Full SmartInspect protocol support (TCP and Pipe)
- Object inspection, tables, source code highlighting
- Method tracking, watches, process flow
- Multiple sessions support
- TypeScript definitions included
