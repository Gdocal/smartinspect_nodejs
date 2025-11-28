/**
 * SmartInspect for Node.js - TypeScript Definitions
 */

// ==================== Enums ====================

export enum Level {
    Debug = 0,
    Verbose = 1,
    Message = 2,
    Warning = 3,
    Error = 4,
    Fatal = 5,
    Control = 6
}

export enum PacketType {
    ControlCommand = 1,
    LogEntry = 4,
    Watch = 5,
    ProcessFlow = 6,
    LogHeader = 7
}

export enum LogEntryType {
    Separator = 0,
    EnterMethod = 1,
    LeaveMethod = 2,
    ResetCallstack = 3,
    Message = 100,
    Warning = 101,
    Error = 102,
    InternalError = 103,
    Comment = 104,
    VariableValue = 105,
    Checkpoint = 106,
    Debug = 107,
    Verbose = 108,
    Fatal = 109,
    Conditional = 110,
    Assert = 111,
    Text = 200,
    Binary = 201,
    Graphic = 202,
    Source = 203,
    Object = 204,
    WebContent = 205,
    System = 206,
    MemoryStatistic = 207,
    DatabaseResult = 208,
    DatabaseStructure = 209
}

export enum ViewerId {
    None = -1,
    Title = 0,
    Data = 1,
    List = 2,
    ValueList = 3,
    Inspector = 4,
    Table = 5,
    Web = 100,
    Binary = 200,
    HtmlSource = 300,
    JavaScriptSource = 301,
    VbScriptSource = 302,
    PerlSource = 303,
    SqlSource = 304,
    IniSource = 305,
    PythonSource = 306,
    XmlSource = 307,
    Bitmap = 400,
    Jpeg = 401,
    Icon = 402,
    Metafile = 403
}

export enum WatchType {
    Char = 0,
    String = 1,
    Integer = 2,
    Float = 3,
    Boolean = 4,
    Address = 5,
    Timestamp = 6,
    Object = 7
}

export enum ControlCommandType {
    ClearLog = 0,
    ClearWatches = 1,
    ClearAutoViews = 2,
    ClearAll = 3,
    ClearProcessFlow = 4
}

export enum ProcessFlowType {
    EnterMethod = 0,
    LeaveMethod = 1,
    EnterThread = 2,
    LeaveThread = 3,
    EnterProcess = 4,
    LeaveProcess = 5
}

export const SourceId: {
    Html: ViewerId;
    JavaScript: ViewerId;
    VbScript: ViewerId;
    Perl: ViewerId;
    Sql: ViewerId;
    Ini: ViewerId;
    Python: ViewerId;
    Xml: ViewerId;
};

export const GraphicId: {
    Bitmap: ViewerId;
    Jpeg: ViewerId;
    Icon: ViewerId;
    Metafile: ViewerId;
};

// ==================== Interfaces ====================

export interface Color {
    r: number;
    g: number;
    b: number;
    a: number;
}

export interface ConnectOptions {
    host?: string;
    port?: number;
    timeout?: number;
    appName?: string;
}

// ==================== Classes ====================

export class ViewerContext {
    viewerId: ViewerId;
    getViewerData(): Buffer;
    appendText(text: string): void;
    appendLine(line: string): void;
    reset(): void;
    loadFromText(text: string): void;
}

export class TextContext extends ViewerContext {
    constructor(viewerId?: ViewerId);
}

export class ListViewerContext extends TextContext {
    constructor(viewerId?: ViewerId);
}

export class ValueListViewerContext extends ListViewerContext {
    constructor(viewerId?: ViewerId);
    appendKeyValue(key: string, value: any): void;
}

export class InspectorViewerContext extends ValueListViewerContext {
    constructor();
    startGroup(group: string): void;
}

export class TableViewerContext extends ListViewerContext {
    constructor();
    appendHeader(header: string): void;
    beginRow(): void;
    endRow(): void;
    addRowEntry(entry: any): void;
}

export class DataViewerContext extends TextContext {
    constructor();
}

export class BinaryContext extends ViewerContext {
    constructor(viewerId?: ViewerId);
    appendBytes(buffer: Buffer, offset?: number, count?: number): void;
    loadFromBuffer(buffer: Buffer): void;
}

export class BinaryViewerContext extends BinaryContext {
    constructor();
}

export class SourceViewerContext extends TextContext {
    constructor(sourceId: ViewerId);
}

export class WebViewerContext extends TextContext {
    constructor();
}

export class Session {
    name: string;
    active: boolean;
    level: Level;
    color: Color;

    constructor(parent: SmartInspect, name?: string);

    isOn(level?: Level): boolean;

    // Basic logging
    logMessage(...args: any[]): void;
    logDebug(...args: any[]): void;
    logVerbose(...args: any[]): void;
    logWarning(...args: any[]): void;
    logError(...args: any[]): void;
    logFatal(...args: any[]): void;
    logSeparator(): void;
    logColored(color: Color, ...args: any[]): void;

    // Exception
    logException(error: Error, title?: string): void;

    // Variables
    logString(name: string, value: string): void;
    logInt(name: string, value: number, includeHex?: boolean): void;
    logNumber(name: string, value: number): void;
    logBool(name: string, value: boolean): void;
    logDateTime(name: string, value: Date): void;
    logValue(name: string, value: any): void;

    // Objects
    logObject(title: string, obj: object, includePrivate?: boolean): void;
    logArray(title: string, arr: any[]): void;
    logDictionary(title: string, dict: Map<any, any> | object): void;
    logTable(title: string, data: object[], columns?: string[]): void;

    // Text/Source
    logText(title: string, text: string): void;
    logSource(title: string, source: string, sourceId: ViewerId): void;
    logHtml(title: string, html: string): void;
    logJavaScript(title: string, code: string): void;
    logSql(title: string, sql: string): void;
    logJson(title: string, data: any): void;
    logXml(title: string, xml: string): void;

    // Binary
    logBinary(title: string, buffer: Buffer): void;
    logTextFile(filePath: string, title?: string): void;
    logBinaryFile(filePath: string, title?: string): void;

    // Checkpoint/Counter
    addCheckpoint(name?: string, details?: string): void;
    resetCheckpoint(name?: string): void;
    incCounter(name: string): void;
    decCounter(name: string): void;
    resetCounter(name: string): void;

    // Watch
    watch(name: string, value: any): void;
    watchString(name: string, value: string): void;
    watchInt(name: string, value: number): void;
    watchFloat(name: string, value: number): void;
    watchBool(name: string, value: boolean): void;

    // Method tracking
    enterMethod(methodName: string): void;
    leaveMethod(methodName: string): void;
    trackMethod(methodName: string): () => void;
    wrapMethod<T extends (...args: any[]) => any>(methodName: string, fn: T): T;

    // Process flow
    enterProcess(processName?: string): void;
    leaveProcess(processName?: string): void;
    enterThread(threadName: string): void;
    leaveThread(threadName: string): void;

    // Control
    clearAll(): void;
    clearLog(): void;
    clearWatches(): void;
    clearAutoViews(): void;
    clearProcessFlow(): void;

    // Assert/Conditional
    logAssert(condition: boolean, message: string): void;
    logConditional(condition: boolean, ...args: any[]): void;

    // System
    logSystem(title?: string): void;
    logMemory(title?: string): void;
    logStackTrace(title?: string): void;
    logEnvironment(title?: string): void;

    // Timing
    timeStart(name: string): void;
    timeEnd(name: string): void;
}

export class SmartInspect {
    appName: string;
    hostName: string;
    enabled: boolean;
    level: Level;
    defaultLevel: Level;
    mainSession: Session;

    constructor(appName?: string);

    connect(options?: ConnectOptions | string): Promise<SmartInspect>;
    disconnect(): Promise<void>;
    isConnected(): boolean;

    getSession(name: string): Session;
    addSession(name: string): Session;
    deleteSession(name: string): void;

    setLevel(level: Level | string): void;
    setEnabled(enabled: boolean): void;

    // Proxy methods (delegate to mainSession)
    logMessage(...args: any[]): void;
    logDebug(...args: any[]): void;
    logVerbose(...args: any[]): void;
    logWarning(...args: any[]): void;
    logError(...args: any[]): void;
    logFatal(...args: any[]): void;
    logException(error: Error, title?: string): void;
    logObject(title: string, obj: object, includePrivate?: boolean): void;
    logArray(title: string, arr: any[]): void;
    logDictionary(title: string, dict: Map<any, any> | object): void;
    logTable(title: string, data: object[], columns?: string[]): void;
    logText(title: string, text: string): void;
    logJson(title: string, data: any): void;
    logHtml(title: string, html: string): void;
    logXml(title: string, xml: string): void;
    logSql(title: string, sql: string): void;
    logJavaScript(title: string, code: string): void;
    logBinary(title: string, buffer: Buffer): void;
    logValue(name: string, value: any): void;
    logString(name: string, value: string): void;
    logInt(name: string, value: number, includeHex?: boolean): void;
    logNumber(name: string, value: number): void;
    logBool(name: string, value: boolean): void;
    logDateTime(name: string, value: Date): void;
    logSeparator(): void;
    logColored(color: Color, ...args: any[]): void;
    addCheckpoint(name?: string, details?: string): void;
    incCounter(name: string): void;
    decCounter(name: string): void;
    watch(name: string, value: any): void;
    watchString(name: string, value: string): void;
    watchInt(name: string, value: number): void;
    watchFloat(name: string, value: number): void;
    watchBool(name: string, value: boolean): void;
    enterMethod(methodName: string): void;
    leaveMethod(methodName: string): void;
    trackMethod(methodName: string): () => void;
    wrapMethod<T extends (...args: any[]) => any>(methodName: string, fn: T): T;
    enterProcess(processName?: string): void;
    leaveProcess(processName?: string): void;
    enterThread(threadName: string): void;
    leaveThread(threadName: string): void;
    clearAll(): void;
    clearLog(): void;
    clearWatches(): void;
    clearAutoViews(): void;
    clearProcessFlow(): void;
    logAssert(condition: boolean, message: string): void;
    logConditional(condition: boolean, ...args: any[]): void;
    logSystem(title?: string): void;
    logMemory(title?: string): void;
    logStackTrace(title?: string): void;
    logEnvironment(title?: string): void;
    timeStart(name: string): void;
    timeEnd(name: string): void;

    // Events
    on(event: 'connect', listener: (banner: string) => void): this;
    on(event: 'disconnect', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
}

export class TcpProtocol {
    host: string;
    port: number;
    timeout: number;

    constructor(options?: ConnectOptions);

    connect(): Promise<string>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    reconnect(): Promise<string>;
}

// ==================== Console-Compatible Functions ====================

export function connect(options?: ConnectOptions): Promise<SmartInspect>;
export function disconnect(): Promise<void>;
export function isConnected(): boolean;

// Console-style methods
export function log(...args: any[]): void;
export function info(...args: any[]): void;
export function debug(...args: any[]): void;
export function warn(...args: any[]): void;
export function error(...args: any[]): void;
export function table(data: any, columns?: string[]): void;
export function time(label: string): void;
export function timeEnd(label: string): void;
export function trace(message?: string): void;
export function assert(condition: boolean, ...args: any[]): void;
export function clear(): void;
export function count(label?: string): void;
export function countReset(label?: string): void;
export function group(label: string): void;
export function groupEnd(label?: string): void;

// Extended methods
export function logObject(title: string, obj: object, includePrivate?: boolean): void;
export function logJson(title: string, data: any): void;
export function logException(error: Error, title?: string): void;
export function logValue(name: string, value: any): void;
export function logBinary(title: string, buffer: Buffer): void;
export function logHtml(title: string, html: string): void;
export function logSql(title: string, sql: string): void;
export function logSystem(title?: string): void;
export function logMemory(title?: string): void;
export function logEnvironment(title?: string): void;
export function watch(name: string, value: any): void;
export function checkpoint(name?: string, details?: string): void;
export function separator(): void;
export function logColored(color: Color, ...args: any[]): void;
export function enterMethod(name: string): void;
export function leaveMethod(name: string): void;
export function wrapMethod<T extends (...args: any[]) => any>(name: string, fn: T): T;
export function getSession(name?: string): Session;
export function setLevel(level: Level | string): void;
export function getInstance(): SmartInspect;

// Utilities
export function detectWindowsHost(): Promise<string>;
