/**
 * SmartInspect Named Pipe Client for WSL2
 *
 * In WSL2, Windows named pipes can be accessed via:
 * //./pipe/pipename -> \\.\pipe\pipename (Windows)
 *
 * However, direct access from WSL2 to Windows named pipes is limited.
 * The recommended approach is using npiperelay or socat with npiperelay.
 *
 * For simplicity, we'll document the pipe format but recommend TCP for WSL.
 */

const net = require('net');
const fs = require('fs');
const os = require('os');

// Pipe paths to try
const WINDOWS_PIPE_PATH = '\\\\.\\pipe\\smartinspect2';
const WSL_PIPE_PATH = '/mnt/wsl/.smartinspect2'; // Would need npiperelay setup

class SmartInspectPipeClient {
    constructor(pipeName = 'smartinspect2') {
        this.pipeName = pipeName;
        this.connected = false;
        this.socket = null;
        this.appName = 'NodeJS Pipe App';
        this.hostName = os.hostname();
    }

    /**
     * Try to connect via named pipe
     * Note: Direct WSL2 -> Windows named pipe access is not straightforward
     */
    async connect() {
        // On Windows, we'd use net.connect to the pipe path
        // On WSL2, we need npiperelay or similar tools

        console.log(`Attempting to connect to named pipe: ${this.pipeName}`);

        // Check if we're in WSL
        const isWSL = fs.existsSync('/proc/version') &&
            fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');

        if (isWSL) {
            console.log('Running in WSL2 - named pipes require npiperelay setup');
            console.log('');
            console.log('To use named pipes from WSL2 to Windows, you need:');
            console.log('1. Install npiperelay: https://github.com/jstarks/npiperelay');
            console.log('2. Set up socat relay');
            console.log('');
            console.log('For simplicity, use TCP connection instead (it works out of the box).');
            throw new Error('Named pipes not directly supported in WSL2');
        }

        // On Windows with Node.js, you could do:
        // this.socket = net.connect('\\\\.\\pipe\\' + this.pipeName);

        throw new Error('Named pipe support not implemented for this platform');
    }
}

// Export for testing
module.exports = { SmartInspectPipeClient };

// If run directly, show info
if (require.main === module) {
    console.log('SmartInspect Named Pipe Information');
    console.log('===================================');
    console.log('');
    console.log('Named pipes are Windows-specific IPC mechanisms.');
    console.log('From WSL2, direct access to Windows named pipes is not available.');
    console.log('');
    console.log('Options for using named pipes:');
    console.log('1. Use TCP connection instead (RECOMMENDED for WSL2)');
    console.log('2. Run Node.js natively on Windows');
    console.log('3. Set up npiperelay bridge (complex setup)');
    console.log('');
    console.log('TCP is the recommended approach for cross-platform compatibility.');

    // Test if npiperelay might be available
    const { execSync } = require('child_process');
    try {
        execSync('which npiperelay 2>/dev/null');
        console.log('\nnpiperelay detected! You could set up a pipe relay.');
    } catch {
        console.log('\nnpiperelay not found. Use TCP connection.');
    }
}
