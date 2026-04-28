#!/usr/bin/env bun
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { RouterWrapper } from 'edge.libx.js';
import { createOAuthToken, getAccessToken } from '../auth/index.ts';
import { loadConfig } from '../config.ts';
import { SheetsClient } from '../sheets/client.ts';
import { FileCache } from './file-cache.ts';
import { registerMcpRoutes } from './routes.ts';

const repoRoot = resolve(import.meta.dir, '../..');
const envIdx = process.argv.indexOf('--env-path');
const envPath = envIdx !== -1 ? resolve(process.cwd(), process.argv[envIdx + 1]!) : resolve(repoRoot, '.env');
config({ path: envPath });

const cfg = loadConfig(process.env);

if (process.argv.includes('auth')) {
    const tokenPath = await createOAuthToken(cfg);
    console.log(`OAuth token stored at ${tokenPath}`);
    process.exit(0);
}

const client = new SheetsClient(() => getAccessToken(cfg));
const fileCache = new FileCache(process.env.MCP_CACHE_DIR || resolve(repoRoot, cfg.cacheDir));

const rw = RouterWrapper.getNew('/api');
registerMcpRoutes(rw, client, fileCache, cfg);

const pkgVersion = (JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8')) as {
    version: string;
}).version;

const mcp = rw.asMCP({
    name: 'mcp-google-sheets',
    version: pkgVersion,
    instructions: `You are connected to Google Sheets via the Sheets API.
${cfg.readOnly ? 'Write operations are DISABLED (MCP_READONLY=true).' : 'Write operations are enabled (set MCP_READONLY=true to make this server read-only).'}
${cfg.spreadsheetId ? `Default spreadsheetId: ${cfg.spreadsheetId}.` : 'No default spreadsheetId is configured; pass spreadsheetId to each tool.'}
Auth mode: ${cfg.authMode}.

IMPORTANT - all tools write data to a local file instead of returning full payloads inline.
Each response includes: { file, type, count/childCount, sizeBytes, preview }.
- "file" is the absolute path to the full JSON response on disk.
- Read that file when you need the full result.

Tools:
- get_values: read one or more ranges. Use ranges="Sheet1!A1:D20" or comma-separated ranges.
- get_meta: inspect sheet names, IDs, and spreadsheet properties.
- post_append: append rows to a target range. Body requires { range, values }.
- post_update: overwrite a specific range. Body requires { range, values }.
- post_batch_update: write multiple ranges in one request.

Best practices:
- Prefer a narrow range instead of reading an entire sheet.
- Use post_append for daily reporting rows such as ad spend snapshots.
- Use USER_ENTERED when you want spreadsheet formulas/dates to be interpreted; use RAW for exact values.`,
});

if (process.argv.includes('--stdio')) {
    mcp.serveStdio();
} else {
    const { createServer } = await import('http');
    rw.router.all('/mcp', mcp.httpHandler as any);
    rw.catchNotFound();

    const port = Number(process.env.PORT) || 3458;
    const server = createServer(rw.createServerAdapter());
    server.listen(port, () => {
        console.log(`mcp-google-sheets MCP running on http://localhost:${port}`);
        console.log(`  REST:  http://localhost:${port}/api/values`);
        console.log(`  MCP:   http://localhost:${port}/api/mcp`);
        console.log(`  Stdio: mcp-google-sheets --stdio`);
    });
}
