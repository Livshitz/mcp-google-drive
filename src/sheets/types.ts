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
