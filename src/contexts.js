/**
 * SmartInspect Viewer Contexts
 * Different context types for formatting log data
 */

const { ViewerId } = require('./enums');

// UTF-8 BOM
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/**
 * Escape line for list/value viewers
 */
function escapeLine(line, toEscape = null) {
    if (!line || line.length === 0) return line;

    let result = '';
    let prevChar = '';

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];

        if (ch === '\r' || ch === '\n') {
            if (prevChar !== '\r' && prevChar !== '\n') {
                result += ' ';
            }
        } else if (toEscape && toEscape.includes(ch)) {
            result += '\\' + ch;
        } else {
            result += ch;
        }

        prevChar = ch;
    }

    return result;
}

/**
 * Escape CSV entry for table viewer
 */
function escapeCSVEntry(entry) {
    if (!entry || entry.length === 0) return entry;

    let result = '"';
    for (let i = 0; i < entry.length; i++) {
        const ch = entry[i];
        if (/\s/.test(ch)) {
            result += ' ';
        } else if (ch === '"') {
            result += '""';
        } else {
            result += ch;
        }
    }
    result += '"';
    return result;
}

/**
 * Base ViewerContext class
 */
class ViewerContext {
    constructor(viewerId) {
        this.viewerId = viewerId;
        this.data = '';
    }

    /**
     * Get viewer data as Buffer with UTF-8 BOM
     */
    getViewerData() {
        const content = Buffer.from(this.data, 'utf8');
        return Buffer.concat([BOM, content]);
    }

    /**
     * Append text to the context
     */
    appendText(text) {
        if (text != null) {
            this.data += text;
        }
    }

    /**
     * Append a line with CRLF
     */
    appendLine(line) {
        if (line != null) {
            this.data += this.escapeLine(line) + '\r\n';
        }
    }

    /**
     * Escape a line (override in subclasses)
     */
    escapeLine(line) {
        return line;
    }

    /**
     * Reset the data
     */
    reset() {
        this.data = '';
    }

    /**
     * Load from text
     */
    loadFromText(text) {
        this.reset();
        this.appendText(text);
    }
}

/**
 * TextContext - basic text viewer
 */
class TextContext extends ViewerContext {
    constructor(viewerId = ViewerId.Data) {
        super(viewerId);
    }
}

/**
 * ListViewerContext - list viewer with line escaping
 */
class ListViewerContext extends TextContext {
    constructor(viewerId = ViewerId.List) {
        super(viewerId);
    }

    escapeLine(line) {
        return escapeLine(line, null);
    }
}

/**
 * ValueListViewerContext - key=value pairs
 */
class ValueListViewerContext extends ListViewerContext {
    constructor(viewerId = ViewerId.ValueList) {
        super(viewerId);
    }

    escapeItem(item) {
        return escapeLine(item, '\\=');
    }

    /**
     * Append a key-value pair
     */
    appendKeyValue(key, value) {
        if (key != null) {
            this.appendText(this.escapeItem(key));
            this.appendText('=');
            if (value != null) {
                this.appendText(this.escapeItem(String(value)));
            }
            this.appendText('\r\n');
        }
    }
}

/**
 * InspectorViewerContext - grouped key-value pairs
 */
class InspectorViewerContext extends ValueListViewerContext {
    constructor() {
        super(ViewerId.Inspector);
    }

    escapeItem(item) {
        return escapeLine(item, '\\=[]');
    }

    /**
     * Start a new group
     */
    startGroup(group) {
        if (group != null) {
            this.appendText('[');
            this.appendText(this.escapeItem(group));
            this.appendText(']\r\n');
        }
    }
}

/**
 * TableViewerContext - CSV-like table data
 */
class TableViewerContext extends ListViewerContext {
    constructor() {
        super(ViewerId.Table);
        this.lineStart = true;
    }

    /**
     * Append header row
     */
    appendHeader(header) {
        this.appendLine(header);
        this.appendLine('');
    }

    /**
     * Begin a new row
     */
    beginRow() {
        this.lineStart = true;
    }

    /**
     * End current row
     */
    endRow() {
        this.appendLine('');
    }

    /**
     * Add entry to current row
     */
    addRowEntry(entry) {
        if (entry != null) {
            if (this.lineStart) {
                this.lineStart = false;
            } else {
                this.appendText(', ');
            }
            this.appendText(escapeCSVEntry(String(entry)));
        }
    }
}

/**
 * DataViewerContext - raw data viewer
 */
class DataViewerContext extends TextContext {
    constructor() {
        super(ViewerId.Data);
    }
}

/**
 * BinaryContext - binary data viewer
 */
class BinaryContext extends ViewerContext {
    constructor(viewerId = ViewerId.Binary) {
        super(viewerId);
        this.binaryData = Buffer.alloc(0);
    }

    /**
     * Get viewer data (no BOM for binary)
     */
    getViewerData() {
        return this.binaryData;
    }

    /**
     * Append bytes
     */
    appendBytes(buffer, offset = 0, count = null) {
        if (!buffer) return;

        const len = count != null ? count : buffer.length - offset;
        const slice = buffer.slice(offset, offset + len);

        this.binaryData = Buffer.concat([this.binaryData, slice]);
    }

    /**
     * Load from buffer
     */
    loadFromBuffer(buffer) {
        this.binaryData = Buffer.from(buffer);
    }

    /**
     * Reset
     */
    reset() {
        this.binaryData = Buffer.alloc(0);
    }
}

/**
 * BinaryViewerContext - hex dump viewer
 */
class BinaryViewerContext extends BinaryContext {
    constructor() {
        super(ViewerId.Binary);
    }
}

/**
 * SourceViewerContext - source code viewer with syntax highlighting
 */
class SourceViewerContext extends TextContext {
    constructor(sourceId) {
        super(sourceId);
    }
}

/**
 * WebViewerContext - HTML content viewer
 */
class WebViewerContext extends TextContext {
    constructor() {
        super(ViewerId.Web);
    }
}

/**
 * GraphicViewerContext - image viewer
 */
class GraphicViewerContext extends BinaryContext {
    constructor(graphicId) {
        super(graphicId);
    }
}

module.exports = {
    ViewerContext,
    TextContext,
    ListViewerContext,
    ValueListViewerContext,
    InspectorViewerContext,
    TableViewerContext,
    DataViewerContext,
    BinaryContext,
    BinaryViewerContext,
    SourceViewerContext,
    WebViewerContext,
    GraphicViewerContext,
    escapeLine,
    escapeCSVEntry
};
