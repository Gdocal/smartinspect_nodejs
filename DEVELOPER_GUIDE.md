# SmartInspect for Node.js - Developer Guide

## Installation

```bash
npm install git+https://github.com/Gdocal/smartinspect_nodejs.git
```

## SmartInspect Console Setup

1. Open SmartInspect Console on Windows
2. Go to **File → Options → Connections**
3. Enable **TCP Server** on port **4228**
4. The console is now listening for connections

**Connection Details:**
- **Host:** `172.17.64.1` (for WSL2) or your Windows machine IP
- **Port:** `4228`
- **Protocol:** TCP

---

## Quick Start

### Basic Usage (Single File)

```javascript
const si = require('smartinspect');

async function main() {
    // Connect to SmartInspect Console
    await si.connect({
        host: '172.17.64.1',
        port: 4228,
        appName: 'My Application'
    });

    // Use like console.log
    si.log('Hello World');
    si.warn('Warning message');
    si.error('Error message');
    si.debug('Debug info');

    // Disconnect when app exits
    await si.disconnect();
}

main();
```

---

## Multi-File Project Setup (Recommended)

### Step 1: Create a Logger Configuration File

Create `lib/logger.js` in your project:

```javascript
// lib/logger.js
const si = require('smartinspect');

// Configuration
const config = {
    host: process.env.SMARTINSPECT_HOST || '172.17.64.1',
    port: parseInt(process.env.SMARTINSPECT_PORT) || 4228,
    appName: process.env.APP_NAME || 'My Application',
    enabled: process.env.SMARTINSPECT_ENABLED !== 'false'
};

let initialized = false;

/**
 * Initialize SmartInspect connection
 * Call this once at application startup
 */
async function init() {
    if (initialized || !config.enabled) return;

    try {
        await si.connect(config);
        initialized = true;
        console.log(`[SmartInspect] Connected to ${config.host}:${config.port}`);
    } catch (err) {
        console.warn(`[SmartInspect] Could not connect: ${err.message}`);
    }
}

/**
 * Shutdown SmartInspect connection
 * Call this when application exits
 */
async function shutdown() {
    if (initialized) {
        await si.disconnect();
        initialized = false;
    }
}

/**
 * Create a logger for a module
 * @param {string} name - Module name or __filename
 */
function createLogger(name) {
    return si.createLogger(name);
}

module.exports = {
    init,
    shutdown,
    createLogger,
    si  // Export raw si for advanced usage
};
```

### Step 2: Initialize in Your Main Entry Point

```javascript
// app.js or index.js
const express = require('express');
const logger = require('./lib/logger');

const app = express();

async function start() {
    // Initialize SmartInspect
    await logger.init();

    // Your app setup...
    app.listen(3000, () => {
        console.log('Server started on port 3000');
    });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    await logger.shutdown();
    process.exit(0);
});

start();
```

### Step 3: Use in Any Module

```javascript
// services/database.js
const { createLogger } = require('../lib/logger');
const log = createLogger('Database');

class DatabaseService {
    async connect() {
        log.info('Connecting to database...');
        try {
            // ... connection logic
            log.info('Connected successfully');
        } catch (err) {
            log.error('Connection failed:', err.message);
            log.exception(err);
            throw err;
        }
    }

    async query(sql, params) {
        log.debug('Executing query');
        log.sql('Query', sql);
        // ... query logic
    }
}

module.exports = new DatabaseService();
```

```javascript
// services/api.js
const { createLogger } = require('../lib/logger');
const log = createLogger('API');

function handleRequest(req, res) {
    log.info(`${req.method} ${req.path}`);

    log.time('request');
    // ... handle request
    log.timeEnd('request');

    log.json('Response', responseData);
}
```

```javascript
// services/auth.js
const { createLogger } = require('../lib/logger');
const log = createLogger('Authentication');

async function login(username, password) {
    log.info(`Login attempt: ${username}`);

    if (!valid) {
        log.warn(`Failed login: ${username}`);
        return false;
    }

    log.info(`User logged in: ${username}`);
    return true;
}
```

### Alternative: Use __filename for Auto-Naming

```javascript
// services/user-service.js
const { createLogger } = require('../lib/logger');
const log = createLogger(__filename);  // Session name: "User-service"

log.info('Service initialized');
```

---

## Logger API Reference

### Console-Compatible Methods

```javascript
const log = createLogger('MyModule');

log.log('message');           // Regular log
log.info('message');          // Info (same as log)
log.debug('message');         // Debug level
log.warn('message');          // Warning
log.error('message');         // Error
log.fatal('message');         // Fatal error
log.verbose('message');       // Verbose (only to SmartInspect)
```

### Object & Data Logging

```javascript
// Log object with property inspection
log.object('User', userObject);

// Log JSON (pretty-printed)
log.json('Config', { debug: true, port: 3000 });

// Log array
log.array('Items', ['a', 'b', 'c']);

// Log table (array of objects)
log.table('Users', [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
]);

// Log SQL with syntax highlighting
log.sql('Query', 'SELECT * FROM users WHERE active = true');

// Log HTML
log.html('Template', '<div class="container">...</div>');

// Log binary data (hex dump)
log.binary('Data', buffer);
```

### Variable Watching

```javascript
// Watch values (shows in Watches panel)
log.watch('counter', 42);
log.watch('status', 'running');
log.value('config', configObject);
```

### Method Tracking

```javascript
// Manual tracking
log.enterMethod('processOrder');
// ... code ...
log.leaveMethod('processOrder');

// Auto-tracking with callback
const done = log.trackMethod('processOrder');
// ... code ...
done();

// Wrap a function
const trackedFn = log.wrapMethod('myFunction', originalFn);
```

### Timing

```javascript
log.time('database-query');
await db.query(sql);
log.timeEnd('database-query');  // Logs duration
```

### Exception Logging

```javascript
try {
    await riskyOperation();
} catch (err) {
    log.exception(err);
    // or with custom title
    log.exception(err, 'Failed to process order');
}
```

### Checkpoints & Counters

```javascript
// Checkpoints (for tracking progress)
log.checkpoint('DataLoad', 'Starting');
log.checkpoint('DataLoad', 'Phase 1 complete');
log.checkpoint('DataLoad', 'Done');

// Counters
log.incCounter('requests');
log.incCounter('requests');
log.decCounter('requests');
```

### Assertions

```javascript
log.assert(user !== null, 'User should not be null');
```

---

## Project Structure Example

```
my-project/
├── lib/
│   └── logger.js           # Logger configuration
├── services/
│   ├── database.js         # createLogger('Database')
│   ├── api.js              # createLogger('API')
│   ├── auth.js             # createLogger('Authentication')
│   └── email.js            # createLogger('Email')
├── controllers/
│   ├── users.js            # createLogger('UsersController')
│   └── orders.js           # createLogger('OrdersController')
├── app.js                  # Initialize logger here
└── package.json
```

---

## Environment Variables

You can configure SmartInspect via environment variables:

```bash
# .env or environment
SMARTINSPECT_HOST=172.17.64.1
SMARTINSPECT_PORT=4228
SMARTINSPECT_ENABLED=true
APP_NAME=MyApplication
```

To disable SmartInspect in production:
```bash
SMARTINSPECT_ENABLED=false
```

---

## Advanced Features

### Async Scheduler (Non-Blocking Logging)

By default, logging is synchronous. For high-performance applications, enable the async scheduler to prevent logging from blocking your main thread:

```javascript
await si.connect({
    host: '127.0.0.1',
    async: {
        enabled: true,      // Enable background processing
        queue: 4096,        // Max queue size in KB (default: 2048)
        throttle: false,    // Set true to block when queue full
        clearOnDisconnect: false
    }
});

// Now log calls return immediately
si.log('This returns instantly');
si.logObject('Data', hugeObject);  // Won't block even for large objects
```

**Queue Statistics:**
```javascript
const stats = si.getQueueStats();
console.log(`Queued: ${stats.schedulerCount} packets, ${stats.schedulerSize} bytes`);
```

---

### Backlog Buffering (Server Unavailable Handling)

When the SmartInspect Console is not available, packets can be buffered and sent when connection is restored:

```javascript
await si.connect({
    host: '127.0.0.1',
    backlog: {
        enabled: true,           // Enable buffering
        queue: 2048,             // Max buffer in KB
        flushOn: si.Level.Error, // Flush on Error+ logs
        keepOpen: true           // Keep connection open
    },
    reconnect: true,             // Auto-reconnect when disconnected
    reconnectInterval: 5000      // Wait 5s between reconnect attempts
});

// If server goes down, logs are buffered
si.log('Buffered if server down');
si.log('Also buffered');

// Error-level logs trigger immediate flush attempt
si.error('This triggers reconnection and flushes all buffered logs');
```

**Behavior:**
1. Regular logs (Debug, Message, Warning) are buffered
2. Error/Fatal logs trigger immediate flush
3. Oldest packets are dropped when buffer is full (FIFO)
4. Auto-reconnection attempts happen in background

---

### Auto-Reconnection

Enable automatic reconnection when connection is lost:

```javascript
await si.connect({
    host: '127.0.0.1',
    reconnect: true,           // Enable auto-reconnect
    reconnectInterval: 3000    // Minimum 3 seconds between attempts
});

// Listen for connection events
const inspector = si.getInstance();
inspector.on('disconnect', () => console.log('Disconnected, will retry...'));
inspector.on('connect', () => console.log('Reconnected!'));
inspector.on('error', (err) => console.log('Error:', err.message));
```

---

### Connection Strings (C# Style)

For compatibility with C# SmartInspect, you can use connection strings:

```javascript
// Basic connection
await si.connect('tcp(host=127.0.0.1,port=4228)');

// With all options
await si.connect('tcp(host=127.0.0.1,port=4228,async.enabled=true,async.queue=4096,backlog=2048,backlog.flushon=error,reconnect=true,reconnect.interval=5000)');

// Pipe protocol
await si.connect('pipe(name=smartinspect)');
```

**Connection String Options:**
| Option | Example | Description |
|--------|---------|-------------|
| host | host=127.0.0.1 | TCP host |
| port | port=4228 | TCP port |
| timeout | timeout=30000 | Connection timeout (ms) |
| room | room=myproject | Log room name |
| async.enabled | async.enabled=true | Enable async |
| async.queue | async.queue=4096 | Queue size (KB) |
| async.throttle | async.throttle=true | Throttle mode |
| backlog | backlog=2048 | Enable backlog with size |
| backlog.flushon | backlog.flushon=error | Flush level |
| reconnect | reconnect=true | Auto-reconnect |
| reconnect.interval | reconnect.interval=5000 | Reconnect interval (ms) |

---

### Recommended Production Configuration

**Note:** Backlog buffering and auto-reconnect are enabled by default with sensible settings:
- `backlog.enabled: true`, `backlog.keepOpen: true`
- `reconnect: true`, `reconnectInterval: 3000ms`

For most use cases, you only need to add async if you want non-blocking logging:

```javascript
// lib/logger.js - Production-ready setup
const si = require('smartinspect');

const config = {
    host: process.env.SMARTINSPECT_HOST || '127.0.0.1',
    port: parseInt(process.env.SMARTINSPECT_PORT) || 4228,
    appName: process.env.APP_NAME || 'My Application',

    // Enable async for non-blocking logging (optional)
    async: {
        enabled: true,
        queue: 4096         // 4MB queue
    }

    // backlog and reconnect are enabled by default!
};

async function init() {
    try {
        const inspector = await si.connect(config);

        // Monitor connection health
        inspector.on('disconnect', () => {
            console.log('[SmartInspect] Disconnected, buffering logs...');
        });
        inspector.on('connect', () => {
            console.log('[SmartInspect] Connected, flushing buffer...');
        });

        console.log('[SmartInspect] Initialized successfully');
    } catch (err) {
        console.warn('[SmartInspect] Initial connection failed, will retry:', err.message);
    }
}

module.exports = { init, si };
```

---

## Tips

1. **Use descriptive session names** - Makes filtering easier in SmartInspect Console
2. **One logger per module** - Create logger at top of file, reuse throughout
3. **Log method entry/exit** - Helps trace execution flow
4. **Use log.sql()** - Gets syntax highlighting in SmartInspect Console
5. **Use log.time()/timeEnd()** - Great for performance monitoring
6. **Use log.object()** - Better than JSON.stringify for complex objects
7. **Enable async in production** - Prevents logging from blocking your app
8. **Enable backlog + reconnect** - Never lose logs when server restarts

---

## Troubleshooting

### Cannot connect to SmartInspect Console

1. Ensure SmartInspect Console is running on Windows
2. Check TCP Server is enabled (File → Options → Connections)
3. Verify the host IP:
   ```bash
   # In WSL2, find Windows host IP:
   ip route | grep default
   # Usually 172.17.64.1
   ```
4. Check firewall isn't blocking port 4228

### Logs not appearing

1. Check `si.isConnected()` returns true
2. Ensure you called `await si.connect()` before logging
3. Check SmartInspect Console is set to "Auto Scroll" and not filtered

---

## Links

- **Repository:** https://github.com/Gdocal/smartinspect_nodejs
- **SmartInspect Console:** [Download from Gurock](https://www.gurock.com/smartinspect)
