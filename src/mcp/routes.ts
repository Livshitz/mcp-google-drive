import type { IRequest } from 'itty-router';
import type { RouterWrapper } from 'edge.libx.js';
import type { Config } from '../config.ts';
import type { SheetsClient } from '../sheets/client.ts';
import type { FileCache } from './file-cache.ts';

const q = (v: any, fallback = ''): string => (Array.isArray(v) ? v[0] : v) ?? fallback;

function required(value: string | undefined, name: string): string {
    if (!value) throw Object.assign(new Error(`${name} is required`), { status: 400 });
    return value;
}

function parseRanges(value: string): string[] {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function guardWrite(cfg: Config): void {
    if (cfg.readOnly) {
        throw Object.assign(new Error('Write operations are disabled. Set MCP_READONLY=false to enable.'), { status: 403 });
    }
}

export function registerMcpRoutes(rw: RouterWrapper, client: SheetsClient, fileCache: FileCache, cfg: Config) {
    rw.router.get('/values', async (req: IRequest) => {
        const spreadsheetId = required(q(req.query.spreadsheetId) || cfg.spreadsheetId, 'spreadsheetId');
        const ranges = parseRanges(required(q(req.query.ranges) || q(req.query.range), 'ranges'));
        const data = await client.getValues({ spreadsheetId, ranges });
        return fileCache.write('values', `${spreadsheetId}_${ranges.join('_')}`, data);
    });

    rw.router.get('/meta', async (req: IRequest) => {
        const spreadsheetId = required(q(req.query.spreadsheetId) || cfg.spreadsheetId, 'spreadsheetId');
        const data = await client.getMeta(spreadsheetId);
        return fileCache.write('meta', spreadsheetId, data);
    });

    rw.router.post('/append', async (req: IRequest) => {
        guardWrite(cfg);
        const body = await req.json();
        const spreadsheetId = body.spreadsheetId || cfg.spreadsheetId;
        const data = await client.appendValues({
            spreadsheetId: required(spreadsheetId, 'spreadsheetId'),
            range: required(body.range, 'range'),
            values: body.values,
            valueInputOption: body.valueInputOption,
        });
        return fileCache.write('append', `${spreadsheetId}_${body.range}`, data);
    });

    rw.router.post('/update', async (req: IRequest) => {
        guardWrite(cfg);
        const body = await req.json();
        const spreadsheetId = body.spreadsheetId || cfg.spreadsheetId;
        const data = await client.updateValues({
            spreadsheetId: required(spreadsheetId, 'spreadsheetId'),
            range: required(body.range, 'range'),
            values: body.values,
            valueInputOption: body.valueInputOption,
        });
        return fileCache.write('update', `${spreadsheetId}_${body.range}`, data);
    });

    rw.router.post('/batch_update', async (req: IRequest) => {
        guardWrite(cfg);
        const body = await req.json();
        const spreadsheetId = body.spreadsheetId || cfg.spreadsheetId;
        const data = await client.batchUpdateValues({
            spreadsheetId: required(spreadsheetId, 'spreadsheetId'),
            data: body.data,
            valueInputOption: body.valueInputOption,
        });
        return fileCache.write('batch_update', spreadsheetId, data);
    });

    rw.router.post('/clear', async (req: IRequest) => {
        guardWrite(cfg);
        const body = await req.json();
        const spreadsheetId = body.spreadsheetId || cfg.spreadsheetId;
        const data = await client.clearValues({
            spreadsheetId: required(spreadsheetId, 'spreadsheetId'),
            range: required(body.range, 'range'),
        });
        return fileCache.write('clear', `${spreadsheetId}_${body.range}`, data);
    });

    rw.router.post('/sheets/add', async (req: IRequest) => {
        guardWrite(cfg);
        const body = await req.json();
        const spreadsheetId = body.spreadsheetId || cfg.spreadsheetId;
        const data = await client.addSheet({
            spreadsheetId: required(spreadsheetId, 'spreadsheetId'),
            title: required(body.title, 'title'),
            rowCount: body.rowCount,
            columnCount: body.columnCount,
        });
        return fileCache.write('add_sheet', `${spreadsheetId}_${body.title}`, data);
    });

    rw.router.post('/batch', async (req: IRequest) => {
        guardWrite(cfg);
        const body = await req.json();
        const spreadsheetId = body.spreadsheetId || cfg.spreadsheetId;
        const data = await client.structuralBatchUpdate({
            spreadsheetId: required(spreadsheetId, 'spreadsheetId'),
            requests: body.requests,
        });
        return fileCache.write('batch', spreadsheetId, data);
    });

    rw.router.post('/headers/ensure', async (req: IRequest) => {
        guardWrite(cfg);
        const body = await req.json();
        const spreadsheetId = body.spreadsheetId || cfg.spreadsheetId;
        const data = await client.ensureHeaders({
            spreadsheetId: required(spreadsheetId, 'spreadsheetId'),
            sheetName: required(body.sheetName, 'sheetName'),
            headers: body.headers,
            overwrite: Boolean(body.overwrite),
        });
        return fileCache.write('ensure_headers', `${spreadsheetId}_${body.sheetName}`, data);
    });

    rw.router.get('/rows/last', async (req: IRequest) => {
        const spreadsheetId = required(q(req.query.spreadsheetId) || cfg.spreadsheetId, 'spreadsheetId');
        const range = required(q(req.query.range), 'range');
        const limit = Math.max(1, Math.min(Number(q(req.query.limit, '10')), 100));
        const data = await client.getLastRows({ spreadsheetId, range, limit });
        return fileCache.write('last_rows', `${spreadsheetId}_${range}_${limit}`, data);
    });

    rw.router.get('/rows/find', async (req: IRequest) => {
        const spreadsheetId = required(q(req.query.spreadsheetId) || cfg.spreadsheetId, 'spreadsheetId');
        const range = required(q(req.query.range), 'range');
        const data = await client.findRows({
            spreadsheetId,
            range,
            column: q(req.query.column) || undefined,
            columnIndex: q(req.query.columnIndex) ? Number(q(req.query.columnIndex)) : undefined,
            value: required(q(req.query.value), 'value'),
            hasHeader: q(req.query.hasHeader, 'true') !== 'false',
            limit: Math.max(1, Math.min(Number(q(req.query.limit, '50')), 500)),
        });
        return fileCache.write('find_rows', `${spreadsheetId}_${range}_${q(req.query.column) || q(req.query.columnIndex)}_${q(req.query.value)}`, data);
    });

    rw.router.get('/cache', async (req: IRequest) => {
        return fileCache.read(required(q(req.query.file), 'file'));
    });

    rw.describeMCP('/values', 'GET', {
        description: 'Read one or more ranges from a Google Sheet. The response writes the full result to a local JSON file and returns metadata plus file path.',
        params: {
            spreadsheetId: { description: 'Spreadsheet ID. Optional when GOOGLE_SPREADSHEET_ID is configured.' },
            ranges: { description: 'Comma-separated A1 ranges, e.g. Sheet1!A1:D20,Config!A:Z.' },
            range: { description: 'Alias for ranges when reading a single range.' },
        },
    });

    rw.describeMCP('/meta', 'GET', {
        description: 'Fetch spreadsheet metadata including sheet names, IDs, and properties. Data is written to a local JSON file.',
        params: {
            spreadsheetId: { description: 'Spreadsheet ID. Optional when GOOGLE_SPREADSHEET_ID is configured.' },
        },
    });

    rw.describeMCP('/append', 'POST', {
        description: 'Append rows to a Google Sheet range. Body: { spreadsheetId?, range, values, valueInputOption? }. Writes API response metadata to a local JSON file.',
        params: {
            body: { description: 'Object with spreadsheetId? (optional when configured), range (A1 target range), values (2D array), and valueInputOption? (USER_ENTERED or RAW).' },
        },
    });

    rw.describeMCP('/update', 'POST', {
        description: 'Update values in a specific Google Sheet range. Body: { spreadsheetId?, range, values, valueInputOption? }. Writes API response metadata to a local JSON file.',
        params: {
            body: { description: 'Object with spreadsheetId? (optional when configured), range (A1 range to update), values (2D array), and valueInputOption? (USER_ENTERED or RAW).' },
        },
    });

    rw.describeMCP('/batch_update', 'POST', {
        description: 'Update multiple Google Sheet ranges in one request. Body: { spreadsheetId?, data: [{ range, values }], valueInputOption? }. Writes API response metadata to a local JSON file.',
        params: {
            body: { description: 'Object with spreadsheetId? (optional when configured), data array of { range, values }, and valueInputOption? (USER_ENTERED or RAW).' },
        },
    });

    rw.describeMCP('/clear', 'POST', {
        description: 'Clear values from a Google Sheet range. Body: { spreadsheetId?, range }. Writes API response metadata to a local JSON file.',
        params: {
            body: { description: 'Object with spreadsheetId? (optional when configured) and range (A1 range to clear).' },
        },
    });

    rw.describeMCP('/sheets/add', 'POST', {
        description: 'Create a new sheet/tab in the spreadsheet. Body: { spreadsheetId?, title, rowCount?, columnCount? }. Writes API response metadata to a local JSON file.',
        params: {
            body: { description: 'Object with spreadsheetId? (optional when configured), title, optional rowCount, and optional columnCount.' },
        },
    });

    rw.describeMCP('/batch', 'POST', {
        description: 'Run raw Sheets spreadsheets.batchUpdate structural requests such as formatting, resizing, freezing rows, or adding sheets. Body: { spreadsheetId?, requests }.',
        params: {
            body: { description: 'Object with spreadsheetId? (optional when configured) and a Sheets API requests array.' },
        },
    });

    rw.describeMCP('/headers/ensure', 'POST', {
        description: 'Ensure a sheet has a first-row header set. Body: { spreadsheetId?, sheetName, headers, overwrite? }. Does not overwrite existing different headers unless overwrite=true.',
        params: {
            body: { description: 'Object with spreadsheetId? (optional when configured), sheetName, headers string array, and optional overwrite boolean.' },
        },
    });

    rw.describeMCP('/rows/last', 'GET', {
        description: 'Read a range and return only the last N rows in the cached result. Useful for dedupe checks before appending daily reports.',
        params: {
            spreadsheetId: { description: 'Spreadsheet ID. Optional when GOOGLE_SPREADSHEET_ID is configured.' },
            range: { description: 'A1 range to scan.' },
            limit: { description: 'Number of rows to return, capped at 100.' },
        },
    });

    rw.describeMCP('/rows/find', 'GET', {
        description: 'Read a range and find rows matching a value in a column. Useful for dedupe by date, campaign, or key.',
        params: {
            spreadsheetId: { description: 'Spreadsheet ID. Optional when GOOGLE_SPREADSHEET_ID is configured.' },
            range: { description: 'A1 range to scan.' },
            column: { description: 'Header name to match. Requires a header row unless columnIndex is provided.' },
            columnIndex: { description: 'Zero-based column index to match.' },
            value: { description: 'Exact string value to match.' },
            hasHeader: { description: 'false if the range does not include a header row.' },
            limit: { description: 'Maximum matches to return, capped at 500.' },
        },
    });

    rw.describeMCP('/cache', 'GET', {
        description: 'Read metadata and capped preview for a cached MCP result file. The file must be inside the MCP cache directory.',
        params: {
            file: { description: 'Absolute cached file path returned by another tool.' },
        },
    });
}
