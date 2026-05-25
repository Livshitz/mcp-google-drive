---
name: mcp-google-drive
description: >-
  Guides development and use of this Bun/TypeScript Google Drive + Sheets MCP:
  auth modes, env, tool shapes, caching, and safe patterns. Use when editing
  this repo, configuring Cursor MCP, troubleshooting Drive/Sheets access, or
  integrating the published package in scripts.
when_to_use: >-
  mcp-google-drive, Drive MCP, Sheets MCP, GOOGLE_AUTH_MODE, service account,
  OAuth token, get_drive_export, spreadsheet tools, file-cache, MCP_READONLY.
paths: "src/**/*.ts,README.md,.env.example,.cursor/mcp.json"
---

# mcp-google-drive

## Architecture (quick)

- **Entry**: `src/mcp/cli.ts` — `--stdio` for Cursor MCP; default HTTP with REST + MCP JSON-RPC on port from config.
- **Config**: `loadConfig()` in `src/config.ts` reads env (auth, scopes, paths, `MCP_READONLY`, cache dir).
- **Clients**: `DriveClient`, `SheetsClient`; responses go through **`FileCache`** — full payloads on disk; returns `{ file, type, sizeBytes, preview }` (capped). Agents/tools should **`read()` the `file` path** when preview is insufficient.
- **Library use**: Export `getAccessToken`, `loadConfig`, `SheetsClient`, `DriveClient` from `src/index.ts` (package name in cron examples in README).

## Auth

| Mode | When | Env essentials |
|------|------|----------------|
| `service_account` | Cron, automation, shared folders only | `GOOGLE_SERVICE_ACCOUNT` (path or JSON string); share Drive items with SA email |
| `oauth` | Act as user | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_PATH`; `bun run src/mcp/cli.ts auth` |

- Default scopes include Drive readonly + spreadsheets; changing `GOOGLE_SCOPES` requires re-auth (delete token, run `auth` again).
- **`MCP_READONLY=true`**: blocks writes (`403`; see `guardWrite` in `src/mcp/routes.ts`).
- **`GOOGLE_SPREADSHEET_ID`**: default spreadsheet when request omits id.

## MCP / HTTP tools (names)

Align implementations with README tool names so docs stay true:

- **Drive**: `get_drive_search`, `get_drive_file`, `get_drive_export`, `get_drive_permissions`.
- **Sheets**: `get_values`, `get_meta`, `post_append`, `post_update`, `post_batch_update`, `post_clear`, `post_sheets_add`, `post_batch`, `post_headers_ensure`, `get_rows_last`, `get_rows_find`, `get_cache`.
- **Slides**: `post_slides_create`, `get_slides_get`, `get_slides_content`, `get_slides_thumbnail`, `post_slides_add_slide`, `post_slides_set_text`, `post_slides_insert_text_box`, `post_slides_insert_image`, `post_slides_set_background`, `post_slides_set_speaker_notes`, `post_slides_format_text`, `get_slides_masters`, `post_slides_apply_master`, `post_slides_duplicate`, `post_slides_delete`.

## Best practices

1. **Exports**: `get_drive_export` — text MIME only (`text/plain`, `text/html`, `text/csv`); no PDF/binary through JSON by design.
2. **Cron/report flows** (README order): optional `post_sheets_add` → `post_headers_ensure` → `get_rows_find` (dedupe) → `post_append`; use cache files only when needed.
3. **Cursor**: Prefer `.cursor/mcp.json` stdio + `envFile` to `.env`; `cwd` = workspace folder.
4. **Secrets**: Never commit `.env`, tokens, or `service-account*.json`; cache lives under `.mcp-google-drive/` (gitignored).

## Pitfalls

- Service accounts **do not** see personal Drive unless files are shared or domain delegation is configured.
- Large responses: rely on **`file`** + preview contract; avoid pushing full API bodies through MCP message text alone.
- Changing redirect URI: align `GOOGLE_REDIRECT_URI` with Google Cloud OAuth client (default callback port documented in README).
