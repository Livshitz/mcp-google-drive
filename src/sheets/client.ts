import type {
    AddSheetOptions,
    BatchWriteValuesOptions,
    ClearValuesOptions,
    EnsureHeadersOptions,
    FindRowsOptions,
    GetValuesOptions,
    LastRowsOptions,
    StructuralBatchUpdateOptions,
    WriteValuesOptions,
} from './types.ts';

const API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export class SheetsClient {
    constructor(private readonly getAccessToken: () => Promise<string>) {}

    async getValues(options: GetValuesOptions) {
        const url = this.url(options.spreadsheetId, 'values:batchGet');
        for (const range of options.ranges) url.searchParams.append('ranges', range);
        return await this.request(url);
    }

    async getMeta(spreadsheetId: string) {
        const url = this.url(spreadsheetId);
        url.searchParams.set('includeGridData', 'false');
        return await this.request(url);
    }

    async updateValues(options: WriteValuesOptions) {
        const url = this.url(options.spreadsheetId, `values/${encodeURIComponent(options.range)}`);
        url.searchParams.set('valueInputOption', options.valueInputOption || 'USER_ENTERED');
        return await this.request(url, {
            method: 'PUT',
            body: {
                majorDimension: 'ROWS',
                range: options.range,
                values: options.values,
            },
        });
    }

    async appendValues(options: WriteValuesOptions) {
        const url = this.url(options.spreadsheetId, `values/${encodeURIComponent(options.range)}:append`);
        url.searchParams.set('valueInputOption', options.valueInputOption || 'USER_ENTERED');
        url.searchParams.set('insertDataOption', 'INSERT_ROWS');
        return await this.request(url, {
            method: 'POST',
            body: {
                majorDimension: 'ROWS',
                range: options.range,
                values: options.values,
            },
        });
    }

    async batchUpdateValues(options: BatchWriteValuesOptions) {
        const url = this.url(options.spreadsheetId, 'values:batchUpdate');
        return await this.request(url, {
            method: 'POST',
            body: {
                valueInputOption: options.valueInputOption || 'USER_ENTERED',
                data: options.data.map((item) => ({
                    majorDimension: item.majorDimension || 'ROWS',
                    range: item.range,
                    values: item.values,
                })),
            },
        });
    }

    async clearValues(options: ClearValuesOptions) {
        const url = this.url(options.spreadsheetId, `values/${encodeURIComponent(options.range)}:clear`);
        return await this.request(url, { method: 'POST', body: {} });
    }

    async structuralBatchUpdate(options: StructuralBatchUpdateOptions) {
        const url = this.url(options.spreadsheetId, ':batchUpdate');
        return await this.request(url, {
            method: 'POST',
            body: { requests: options.requests },
        });
    }

    async addSheet(options: AddSheetOptions) {
        return await this.structuralBatchUpdate({
            spreadsheetId: options.spreadsheetId,
            requests: [
                {
                    addSheet: {
                        properties: {
                            title: options.title,
                            gridProperties: {
                                rowCount: options.rowCount || 1000,
                                columnCount: options.columnCount || 26,
                            },
                        },
                    },
                },
            ],
        });
    }

    async ensureHeaders(options: EnsureHeadersOptions) {
        const range = `${quoteSheetName(options.sheetName)}!A1:${columnName(options.headers.length)}1`;
        const existing = await this.getValues({ spreadsheetId: options.spreadsheetId, ranges: [range] });
        const current = existing.valueRanges?.[0]?.values?.[0] || [];
        const matches = sameRow(current, options.headers);

        if (matches || (current.length > 0 && !options.overwrite)) {
            return {
                ok: true,
                changed: false,
                range,
                existing: current,
                expected: options.headers,
                reason: matches ? 'headers already match' : 'headers exist and overwrite is false',
            };
        }

        const update = await this.updateValues({
            spreadsheetId: options.spreadsheetId,
            range,
            values: [options.headers],
        });
        return { ok: true, changed: true, range, update };
    }

    async getLastRows(options: LastRowsOptions) {
        const values = await this.getValues({ spreadsheetId: options.spreadsheetId, ranges: [options.range] });
        const rows = values.valueRanges?.[0]?.values || [];
        return {
            spreadsheetId: options.spreadsheetId,
            range: options.range,
            totalRows: rows.length,
            limit: options.limit,
            rows: rows.slice(-options.limit),
        };
    }

    async findRows(options: FindRowsOptions) {
        const values = await this.getValues({ spreadsheetId: options.spreadsheetId, ranges: [options.range] });
        const rows: any[][] = values.valueRanges?.[0]?.values || [];
        const header = options.hasHeader === false ? null : rows[0] || null;
        const columnIndex = resolveColumnIndex(options, header);
        const start = header && options.hasHeader !== false ? 1 : 0;
        const matches = rows
            .slice(start)
            .map((row, idx) => ({ rowNumber: start + idx + 1, row }))
            .filter((item) => String(item.row[columnIndex] ?? '') === options.value)
            .slice(0, options.limit || 50);

        return {
            spreadsheetId: options.spreadsheetId,
            range: options.range,
            column: options.column,
            columnIndex,
            value: options.value,
            totalRows: rows.length,
            matchCount: matches.length,
            matches,
        };
    }

    private url(spreadsheetId: string, suffix = ''): URL {
        const base = `${API_BASE}/${encodeURIComponent(spreadsheetId)}`;
        return new URL(suffix ? `${base}/${suffix}` : base);
    }

    private async request(url: URL, options: { method?: string; body?: any } = {}) {
        const token = await this.getAccessToken();
        const res = await fetch(url, {
            method: options.method || 'GET',
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
            },
            body: options.body == null ? undefined : JSON.stringify(options.body),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const message = data?.error?.message || data?.error || `Google Sheets API failed (${res.status})`;
            throw Object.assign(new Error(message), { status: res.status, details: data });
        }
        return data;
    }
}

function quoteSheetName(name: string): string {
    return `'${name.replace(/'/g, "''")}'`;
}

function columnName(index: number): string {
    let n = index;
    let name = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        name = String.fromCharCode(65 + rem) + name;
        n = Math.floor((n - 1) / 26);
    }
    return name || 'A';
}

function sameRow(a: any[], b: any[]): boolean {
    return a.length === b.length && a.every((value, index) => String(value) === String(b[index]));
}

function resolveColumnIndex(options: FindRowsOptions, header: any[] | null): number {
    if (options.columnIndex != null) return options.columnIndex;
    if (!options.column) throw new Error('findRows requires column or columnIndex');
    if (!header) throw new Error('findRows column lookup requires a header row; pass columnIndex or hasHeader=false.');
    const index = header.findIndex((item) => String(item) === options.column);
    if (index === -1) throw new Error(`Column not found: ${options.column}`);
    return index;
}
