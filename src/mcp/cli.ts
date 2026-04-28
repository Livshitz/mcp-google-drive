#!/usr/bin/env bun
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { RouterWrapper } from 'edge.libx.js';
import { createOAuthToken, getAccessToken } from '../auth/index.ts';
import { loadConfig } from '../config.ts';
import { DriveClient } from '../drive/client.ts';
import { SheetsClient } from '../sheets/client.ts';
import { registerDriveRoutes } from './drive-routes.ts';
import { FileCache } from './file-cache.ts';
import { registerMcpRoutes } from './routes.ts';
import { augmentMcpWithSkillResource } from './with-skill-resource.ts';

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

const tokenProvider = () => getAccessToken(cfg);
const driveClient = new DriveClient(tokenProvider);
const sheetsClient = new SheetsClient(tokenProvider);
const fileCache = new FileCache(process.env.MCP_CACHE_DIR || resolve(repoRoot, cfg.cacheDir));

const rw = RouterWrapper.getNew('/api');
registerDriveRoutes(rw, driveClient, fileCache);
registerMcpRoutes(rw, sheetsClient, fileCache, cfg);

const pkgVersion = (JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8')) as {
    version: string;
}).version;

const mcp = rw.asMCP({
    name: 'mcp-google-drive',
    version: pkgVersion,
    instructions: `You are connected to Google Drive and Google Sheets APIs.
${cfg.readOnly ? 'Write operations are DISABLED (MCP_READONLY=true).' : 'Write operations are enabled (set MCP_READONLY=true to make this server read-only).'}
${cfg.spreadsheetId ? `Default spreadsheetId: ${cfg.spreadsheetId}.` : 'No default spreadsheetId is configured; pass spreadsheetId to each tool.'}
Auth mode: ${cfg.authMode}.

IMPORTANT - all tools write data to a local file instead of returning full payloads inline.
Each response includes: { file, type, count/childCount, sizeBytes, preview }.
- "file" is the absolute path to the full JSON response on disk.
- Read that file when you need the full result.

Tools:
- get_drive_search: search files visible to this Google identity.
- get_drive_file: inspect file metadata by fileId.
- get_drive_permissions: inspect visible file permissions.
- get_drive_export: export Google Docs/Slides/etc. to text or another export MIME type.
- get_values: read one or more ranges. Use ranges="Sheet1!A1:D20" or comma-separated ranges.
- get_meta: inspect sheet names, IDs, and spreadsheet properties.
- post_append: append rows to a target range. Body requires { range, values }.
- post_update: overwrite a specific range. Body requires { range, values }.
- post_batch_update: write multiple ranges in one request.
- post_clear: clear values from a range.
- post_sheets_add: create a new sheet/tab.
- post_batch: run raw structural spreadsheets.batchUpdate requests.
- post_headers_ensure: create or validate first-row headers.
- get_rows_last: read back the last N rows from a range for dedupe checks.
- get_rows_find: find exact row matches by header name or column index.
- get_cache: re-open metadata and capped preview for a cached result file.

Best practices:
- Service accounts only see files explicitly shared with them (or in shared folders they can access).
- Use get_drive_search with mimeType=application/vnd.google-apps.spreadsheet to discover accessible sheets.
- Prefer a narrow range instead of reading an entire sheet.
- Use post_append for daily reporting rows such as ad spend snapshots.
- Use post_headers_ensure before the first report append.
- Use get_rows_find or get_rows_last before appending when dedupe matters.
- Use USER_ENTERED when you want spreadsheet formulas/dates to be interpreted; use RAW for exact values.

MCP skill resource URI: skill://mcp-google-drive/workflow (markdown; use resources/read).`,
});

augmentMcpWithSkillResource(mcp, {
    serverName: 'mcp-google-drive',
    repoRootAbs: repoRoot,
    skillRelativePath: '.claude/skills/mcp-google-drive/SKILL.md',
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
        console.log(`mcp-google-drive MCP running on http://localhost:${port}`);
        console.log(`  REST:  http://localhost:${port}/api/drive/search`);
        console.log(`  MCP:   http://localhost:${port}/api/mcp`);
        console.log(`  Stdio: mcp-google-drive --stdio`);
    });
}
