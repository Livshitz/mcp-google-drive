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
}
