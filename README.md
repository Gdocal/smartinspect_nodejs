# SmartInspect for Node.js

A complete port of the SmartInspect logging library for Node.js with console-compatible API.

## Installation

```bash
npm install git+https://github.com/Gdocal/smartinspect_nodejs.git
```

## Quick Start

```javascript
const si = require('smartinspect');

// Connect to SmartInspect Console
await si.connect({
    host: '172.17.64.1',  // Windows host IP (for WSL2)
    port: 4228,
    appName: 'My App'
});

// Console-style logging (outputs to console AND SmartInspect)
si.log('Hello World');
si.warn('Warning message');
si.error('Error message');
si.debug('Debug info');

// Disconnect when done
await si.disconnect();
```

## Features

### Console-Compatible Methods

Works like `console.*` but also sends to SmartInspect:

```javascript
si.log('message');           // Regular log
si.info('message');          // Info (alias for log)
si.debug('message');         // Debug level
si.warn('message');          // Warning
si.error('message');         // Error
si.table(data);              // Table view
si.time('label');            // Start timer
si.timeEnd('label');         // End timer
si.trace();                  // Stack trace
si.assert(condition, msg);   // Assertion
si.count('label');           // Counter
si.group('label');           // Group start
si.groupEnd('label');        // Group end
```

### Object Inspection

```javascript
si.logObject('User', { name: 'John', age: 30 });
si.logJson('Config', { debug: true, port: 3000 });
si.logArray('Items', ['a', 'b', 'c']);
si.logTable('Users', [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]);
```

### Source Code with Syntax Highlighting

```javascript
si.logSql('Query', 'SELECT * FROM users WHERE active = true');
si.logHtml('Template', '<div class="container">...</div>');
si.logJson('Data', { key: 'value' });
```

### Variable Watching

```javascript
si.watch('counter', 42);
si.watch('status', 'running');
si.logValue('config', { debug: true });
```

### Colored Logging

Use preset colors for important events (use sparingly):

```javascript
const { Colors } = require('smartinspect');

si.logColored(Colors.SUCCESS, 'Operation completed successfully');
si.logColored(Colors.WARNING, 'Rate limit approaching');
si.logColored('#FF6432', 'Custom hex color');
si.logColored([255, 100, 50], 'RGB array');
```

Available presets: `RED`, `GREEN`, `BLUE`, `YELLOW`, `ORANGE`, `PURPLE`, `CYAN`, `PINK`, `WHITE`, `BLACK`, `GRAY`, `SUCCESS`, `WARNING`, `ERROR`, `INFO`

### Stream Data (High-Frequency Channels)

For metrics, telemetry, and other high-frequency data:

```javascript
// Send data to a named stream channel
si.stream('metrics', { cpu: 45.2, memory: 2048 });
si.stream('events', 'User clicked button');
si.stream('telemetry', { lat: 51.5, lon: -0.1 });

// With optional type identifier (displayed in viewer)
si.stream('metrics', { cpu: 45.2, memory: 2048 }, 'json');
si.stream('events', 'User logged in', 'text');
si.stream('timeseries', { ts: Date.now(), value: 123.45 }, 'metric');
```

Streams are lightweight data channels ideal for:
- Real-time metrics and performance data
- Time-series data
- Event streams
- Telemetry data

The optional third parameter `type` is a string identifier displayed in the web viewer's Type column, useful for categorizing stream data (e.g., 'json', 'text', 'metric', 'error').

### Method Tracking

```javascript
si.enterMethod('processData');
// ... code ...
si.leaveMethod('processData');

// Or wrap a function
const trackedFn = si.wrapMethod('myFunction', originalFn);
```

### System Information

```javascript
si.logSystem();      // System info (OS, Node version, CPU, etc.)
si.logMemory();      // Memory usage
si.logEnvironment(); // Environment variables
```

### Multiple Sessions

```javascript
const inspector = si.getInstance();
const dbSession = inspector.getSession('Database');
const apiSession = inspector.getSession('API');

dbSession.logMessage('Query executed');
apiSession.logMessage('Request received');
```

## Full API (SmartInspect Class)

```javascript
const { SmartInspect } = require('smartinspect');

const inspector = new SmartInspect('My Application');
await inspector.connect({ host: '172.17.64.1', port: 4228 });

// All methods available on inspector and inspector.mainSession
inspector.logMessage('Hello');
inspector.logObject('Data', obj);
inspector.logTable('Results', data);
// ... etc
```

## Connection Options

### TCP Protocol (Default)

```javascript
await si.connect({
    host: '172.17.64.1',  // SmartInspect Console host
    port: 4228,           // TCP port (default: 4228)
    timeout: 30000,       // Connection timeout in ms
    appName: 'My App',    // Application name shown in console
    room: 'default'       // Room for log isolation (optional)
});
```

### Resilient Connection (Enabled by Default)

Backlog buffering and auto-reconnect are **enabled by default** with sensible settings:
- `backlog.enabled: true`, `backlog.keepOpen: true`, `backlog.queue: 2048KB`
- `reconnect: true`, `reconnectInterval: 3000ms`

For non-blocking logging, just add async:

```javascript
await si.connect({
    host: '172.17.64.1',

    // Non-blocking async logging (optional)
    async: {
        enabled: true,      // Enable background processing
        queue: 4096         // Max queue size in KB
    }

    // backlog and reconnect are enabled by default!
});
```

To customize or disable:

```javascript
await si.connect({
    host: '172.17.64.1',
    reconnect: false,               // Disable auto-reconnect
    reconnectInterval: 5000,        // Custom interval (default: 3000ms)
    backlog: { enabled: false }     // Disable buffering
});
```

### Connection String (C# Style)

```javascript
await si.connect('tcp(host=172.17.64.1,port=4228,async.enabled=true,backlog=2048,reconnect=true)');
```

### Pipe Protocol (Named Pipes / Unix Sockets)

For local connections, pipes provide faster IPC communication:

```javascript
// By name (auto-detects platform-specific path)
await si.connect({
    pipe: 'smartinspect',  // Windows: \\.\pipe\smartinspect, Linux: /tmp/smartinspect.pipe
    appName: 'My App'
});

// By explicit path (for custom socket locations)
await si.connect({
    pipePath: '/var/run/myapp/smartinspect.sock',
    appName: 'My App'
});
```

### Protocol Comparison

| Protocol | Use Case | Platform |
|----------|----------|----------|
| TCP | Remote connections, cross-platform, WSL | All |
| Pipe (name) | Local IPC, lower latency | Windows (Named Pipes), Linux/Unix (Unix sockets) |
| Pipe (path) | Custom socket location | All (explicit path) |

### WSL2 Note

When running in WSL2 and SmartInspect Console on Windows, use TCP with the WSL gateway IP:
- Usually `172.17.64.1` or check with `ip route | grep default`
- Named Pipes are not accessible from WSL

## TypeScript Support

TypeScript definitions are included:

```typescript
import * as si from 'smartinspect';
import { SmartInspect, Session, Level } from 'smartinspect';
```

## License

MIT
