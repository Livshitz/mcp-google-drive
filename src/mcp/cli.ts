#!/usr/bin/env bun
import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { RouterWrapper } from 'edge.libx.js';
import { authContext } from '../auth/context.ts';
import { createOAuthToken, getAccessToken } from '../auth/index.ts';
import type { AuthMode } from '../config.ts';
import { loadConfig } from '../config.ts';
import { DriveClient } from '../drive/client.ts';
import { SheetsClient } from '../sheets/client.ts';
import { SlidesClient } from '../slides/client.ts';
import { registerDriveRoutes } from './drive-routes.ts';
import { FileCache } from './file-cache.ts';
import { registerMcpRoutes } from './routes.ts';
import { registerSlidesRoutes } from './slides-routes.ts';
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
const slidesClient = new SlidesClient(tokenProvider);
const fileCache = new FileCache(process.env.MCP_CACHE_DIR || resolve(repoRoot, cfg.cacheDir));

const rw = RouterWrapper.getNew('/api');
registerDriveRoutes(rw, driveClient, fileCache);
registerMcpRoutes(rw, sheetsClient, fileCache, cfg);
registerSlidesRoutes(rw, slidesClient, fileCache);

const pkgVersion = (JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8')) as {
    version: string;
}).version;

const hasBothAuthMethods = !!(cfg.serviceAccount && cfg.clientId);

const validAuthModes = new Set(['service_account', 'oauth']);

const mcp = rw.asMCP({
    name: 'mcp-google-drive',
    version: pkgVersion,
    instructions: `You are connected to Google Drive, Google Sheets, and Google Slides APIs.
${cfg.readOnly ? 'Write operations are DISABLED (MCP_READONLY=true).' : 'Write operations are enabled (set MCP_READONLY=true to make this server read-only).'}
${cfg.spreadsheetId ? `Default spreadsheetId: ${cfg.spreadsheetId}.` : 'No default spreadsheetId is configured; pass spreadsheetId to each tool.'}
Auth mode: ${cfg.authMode}.${hasBothAuthMethods ? '\nDual-auth enabled: pass auth="oauth" to access files shared with the OAuth user, or auth="service_account" (default) for service account access. Omit auth to use the default.' : ''}

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
- post_slides_create: create a new Google Slides presentation.
- get_slides_get: get presentation metadata and slide IDs.
- get_slides_content: read slide text content with formatting (bold, italic, strikethrough, links). Prefer over get_drive_export for formatted content.
- get_slides_thumbnail: get PNG thumbnail URLs for slides. Use to visually inspect what a slide looks like.
- post_slides_add_slide: add a slide with optional layout.
- post_slides_set_text: set text in a slide placeholder (TITLE, SUBTITLE, BODY).
- post_slides_insert_text_box: insert a positioned text box.
- post_slides_insert_image: insert an image by URL.
- post_slides_set_background: set slide background color.
- post_slides_set_speaker_notes: set speaker notes.
- post_slides_format_text: format text (bold, italic, font size, color, link).
- get_slides_masters: list master slides and available layouts.
- post_slides_apply_master: apply a master layout to a slide.
- post_slides_duplicate: duplicate an existing slide.
- post_slides_delete: delete a slide.

Best practices:
- Service accounts only see files explicitly shared with them (or in shared folders they can access).
- Use get_drive_search with mimeType=application/vnd.google-apps.spreadsheet to discover accessible sheets.
- Prefer a narrow range instead of reading an entire sheet.
- Use post_append for daily reporting rows such as ad spend snapshots.
- Use post_headers_ensure before the first report append.
- Use get_rows_find or get_rows_last before appending when dedupe matters.
- Use USER_ENTERED when you want spreadsheet formulas/dates to be interpreted; use RAW for exact values.
- For Slides: create presentation first, then add slides with layout, then set text/images on each.
- Slides layouts with placeholders: TITLE (has CENTERED_TITLE + SUBTITLE), TITLE_AND_BODY (has TITLE + BODY), SECTION_HEADER (has TITLE + BODY).
- Position/size units default to PT (points). Use { x, y } for position and { width, height } for size.

MCP skill resource URI: skill://mcp-google-drive/workflow (markdown; use resources/read).`,
    ...(hasBothAuthMethods && {
        globalParams: {
            auth: { description: 'Auth identity: "oauth" for OAuth user files, "service_account" for SA-shared files. Omit for default (service_account).' },
        },
        onToolCall: async (_name: string, args: Record<string, any>, next: () => Promise<any>) => {
            const mode = args.auth as string | undefined;
            if (mode && validAuthModes.has(mode)) {
                return authContext.run(mode as AuthMode, next);
            }
            return next();
        },
    }),
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
