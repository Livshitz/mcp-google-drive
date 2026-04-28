import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

export class FileCache {
    public dir: string;

    constructor(dir = '.mcp-google-sheets/cache') {
        this.dir = resolve(dir);
        mkdirSync(this.dir, { recursive: true });
    }

    write(toolName: string, label: string, data: any) {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const safe = label.replace(/[^a-z0-9]/gi, '_') || 'data';
        const filePath = join(this.dir, `${toolName}_${safe}_${ts}.json`);
        const json = JSON.stringify(data, null, 2);
        writeFileSync(filePath, json, 'utf-8');
        return {
            file: filePath,
            type: Array.isArray(data) ? 'array' : typeof data,
            ...(Array.isArray(data) && { count: data.length }),
            ...(data && typeof data === 'object' && !Array.isArray(data) && { childCount: Object.keys(data).length }),
            sizeBytes: json.length,
            preview: this.preview(data),
        };
    }

    private preview(data: any): any {
        if (Array.isArray(data)) return data.slice(0, 2);
        if (data && typeof data === 'object') {
            const entries = Object.entries(data).slice(0, 5);
            return Object.fromEntries(entries);
        }
        return data;
    }
}
