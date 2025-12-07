/**
 * SmartInspect Enums
 * Complete port of all C# enums
 */

/**
 * Log levels (matching C# Level enum)
 */
const Level = {
    Debug: 0,
    Verbose: 1,
    Message: 2,
    Warning: 3,
    Error: 4,
    Fatal: 5,
    Control: 6
};

/**
 * Packet types sent over the wire
 */
const PacketType = {
    ControlCommand: 1,
    LogEntry: 4,
    Watch: 5,
    ProcessFlow: 6,
    LogHeader: 7,
    Stream: 8
};

/**
 * Log entry types (matching C# LogEntryType enum)
 */
const LogEntryType = {
    Separator: 0,
    EnterMethod: 1,
    LeaveMethod: 2,
    ResetCallstack: 3,
    Message: 100,
    Warning: 101,      // 0x65
    Error: 102,        // 0x66
    InternalError: 103,// 0x67
    Comment: 104,      // 0x68
    VariableValue: 105,// 0x69
    Checkpoint: 106,   // 0x6a
    Debug: 107,        // 0x6b
    Verbose: 108,      // 0x6c
    Fatal: 109,        // 0x6d
    Conditional: 110,  // 0x6e
    Assert: 111,       // 0x6f
    Text: 200,         // 0xc8
    Binary: 201,       // 0xc9
    Graphic: 202,      // 0xca
    Source: 203,       // 0xcb
    Object: 204,       // 0xcc
    WebContent: 205,   // 0xcd
    System: 206,       // 0xce
    MemoryStatistic: 207, // 0xcf
    DatabaseResult: 208,  // 0xd0
    DatabaseStructure: 209 // 0xd1
};

/**
 * Viewer IDs for different visualization types
 */
const ViewerId = {
    None: -1,
    Title: 0,
    Data: 1,
    List: 2,
    ValueList: 3,
    Inspector: 4,
    Table: 5,
    Web: 100,
    Binary: 200,
    HtmlSource: 300,
    JavaScriptSource: 301,   // 0x12d
    VbScriptSource: 302,     // 0x12e
    PerlSource: 303,         // 0x12f
    SqlSource: 304,          // 0x130
    IniSource: 305,          // 0x131
    PythonSource: 306,       // 0x132
    XmlSource: 307,          // 0x133
    Bitmap: 400,
    Jpeg: 401,               // 0x191
    Icon: 402,               // 0x192
    Metafile: 403            // 0x193
};

/**
 * Watch variable types
 */
const WatchType = {
    Char: 0,
    String: 1,
    Integer: 2,
    Float: 3,
    Boolean: 4,
    Address: 5,
    Timestamp: 6,
    Object: 7
};

/**
 * Control command types
 */
const ControlCommandType = {
    ClearLog: 0,
    ClearWatches: 1,
    ClearAutoViews: 2,
    ClearAll: 3,
    ClearProcessFlow: 4
};

/**
 * Process flow types
 */
const ProcessFlowType = {
    EnterMethod: 0,
    LeaveMethod: 1,
    EnterThread: 2,
    LeaveThread: 3,
    EnterProcess: 4,
    LeaveProcess: 5
};

/**
 * Source ID for different languages (for syntax highlighting)
 */
const SourceId = {
    Html: ViewerId.HtmlSource,
    JavaScript: ViewerId.JavaScriptSource,
    VbScript: ViewerId.VbScriptSource,
    Perl: ViewerId.PerlSource,
    Sql: ViewerId.SqlSource,
    Ini: ViewerId.IniSource,
    Python: ViewerId.PythonSource,
    Xml: ViewerId.XmlSource
};

/**
 * Graphic ID for different image types
 */
const GraphicId = {
    Bitmap: ViewerId.Bitmap,
    Jpeg: ViewerId.Jpeg,
    Icon: ViewerId.Icon,
    Metafile: ViewerId.Metafile
};

/**
 * Default color (transparent)
 */
const DEFAULT_COLOR = { r: 5, g: 0, b: 0, a: 255 };

/**
 * Preset colors for logColored()
 *
 * These colors are designed to work well as row backgrounds in both
 * dark and light themes - muted, pleasant, and readable.
 */
const Colors = {
    // Basic colors - muted versions that work as row backgrounds
    RED: { r: 180, g: 80, b: 80, a: 255 },       // Muted coral red
    GREEN: { r: 80, g: 150, b: 100, a: 255 },    // Soft forest green
    BLUE: { r: 80, g: 120, b: 180, a: 255 },     // Soft steel blue
    YELLOW: { r: 200, g: 180, b: 100, a: 255 },  // Muted gold
    ORANGE: { r: 200, g: 130, b: 80, a: 255 },   // Muted terracotta
    PURPLE: { r: 140, g: 100, b: 160, a: 255 },  // Soft lavender purple
    CYAN: { r: 80, g: 160, b: 170, a: 255 },     // Muted teal
    PINK: { r: 180, g: 130, b: 150, a: 255 },    // Dusty rose
    WHITE: { r: 255, g: 255, b: 255, a: 255 },
    BLACK: { r: 0, g: 0, b: 0, a: 255 },
    GRAY: { r: 128, g: 128, b: 128, a: 255 },

    // Semantic colors - muted for readability
    SUCCESS: { r: 90, g: 150, b: 110, a: 255 },  // Muted green
    WARNING: { r: 190, g: 150, b: 80, a: 255 },  // Muted amber
    ERROR: { r: 170, g: 90, b: 90, a: 255 },     // Muted red
    INFO: { r: 90, g: 130, b: 160, a: 255 }      // Muted blue
};

/**
 * Parse color from various formats to { r, g, b, a } object.
 * Supports:
 * - Hex string: '#FF6432', '#FF6432FF', 'FF6432'
 * - RGB array: [255, 100, 50] or [255, 100, 50, 255]
 * - Object: { r, g, b, a }
 * @param {string|Array|Object} color - Color in any supported format
 * @returns {Object} Color object { r, g, b, a }
 */
function parseColor(color) {
    if (!color) return DEFAULT_COLOR;

    // Already an object with r, g, b
    if (typeof color === 'object' && !Array.isArray(color)) {
        return {
            r: color.r || 0,
            g: color.g || 0,
            b: color.b || 0,
            a: color.a !== undefined ? color.a : 255
        };
    }

    // Array: [r, g, b] or [r, g, b, a]
    if (Array.isArray(color)) {
        return {
            r: color[0] || 0,
            g: color[1] || 0,
            b: color[2] || 0,
            a: color[3] !== undefined ? color[3] : 255
        };
    }

    // Hex string: '#FF6432', '#FF6432FF', 'FF6432'
    if (typeof color === 'string') {
        let hex = color.replace(/^#/, '');

        // Handle short hex: #F00 -> #FF0000
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }

        // Parse 6 or 8 character hex
        if (hex.length >= 6) {
            return {
                r: parseInt(hex.substring(0, 2), 16) || 0,
                g: parseInt(hex.substring(2, 4), 16) || 0,
                b: parseInt(hex.substring(4, 6), 16) || 0,
                a: hex.length >= 8 ? parseInt(hex.substring(6, 8), 16) : 255
            };
        }
    }

    return DEFAULT_COLOR;
}

module.exports = {
    Level,
    PacketType,
    LogEntryType,
    ViewerId,
    WatchType,
    ControlCommandType,
    ProcessFlowType,
    SourceId,
    GraphicId,
    DEFAULT_COLOR,
    Colors,
    parseColor
};
