export interface ValueRange {
    range: string;
    majorDimension?: 'ROWS' | 'COLUMNS';
    values: any[][];
}

export interface GetValuesOptions {
    spreadsheetId: string;
    ranges: string[];
}

export interface WriteValuesOptions {
    spreadsheetId: string;
    range: string;
    values: any[][];
    valueInputOption?: 'RAW' | 'USER_ENTERED';
}

export interface BatchWriteValuesOptions {
    spreadsheetId: string;
    data: ValueRange[];
    valueInputOption?: 'RAW' | 'USER_ENTERED';
}

export interface ClearValuesOptions {
    spreadsheetId: string;
    range: string;
}

export interface StructuralBatchUpdateOptions {
    spreadsheetId: string;
    requests: any[];
}

export interface InsertCellCommentOptions {
    spreadsheetId: string;
    /** A1 cell, e.g. `Sheet1!B2` or `'My tab'!B2`; no tab = the first sheet. */
    cell: string;
    content: string;
    assigneeEmailAddress?: string;
}

export interface AddSheetOptions {
    spreadsheetId: string;
    title: string;
    rowCount?: number;
    columnCount?: number;
}

export interface EnsureHeadersOptions {
    spreadsheetId: string;
    sheetName: string;
    headers: string[];
    overwrite?: boolean;
}

export interface LastRowsOptions {
    spreadsheetId: string;
    range: string;
    limit: number;
}

export interface FindRowsOptions {
    spreadsheetId: string;
    range: string;
    column?: string;
    columnIndex?: number;
    value: string;
    hasHeader?: boolean;
    limit?: number;
}
