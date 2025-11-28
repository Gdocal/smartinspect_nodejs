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
    LogHeader: 7
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
    DEFAULT_COLOR
};
