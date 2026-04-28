import type { BatchWriteValuesOptions, GetValuesOptions, WriteValuesOptions } from './types.ts';

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
