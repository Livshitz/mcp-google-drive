# mcp-google-drive

Google Drive + Sheets MCP server for Cursor, Claude, and cron-friendly scripts.

It lets agents search files visible to a Google identity, inspect metadata, export Google Workspace files, and read/write Sheets. Full API responses are written to disk; the agent receives metadata plus a capped preview.

## Setup

Install dependencies:

```bash
bun install
```

Copy the env template:

```bash
cp .env.example .env
```

## Auth Option 1: Service Account

Recommended for cron jobs and shared operational folders.

1. Create a Google Cloud service account.
2. Enable the Google Drive API and Google Sheets API.
3. Download the service account JSON key.
4. Share specific files or folders with the service account email.
5. Set:

```bash
GOOGLE_AUTH_MODE=service_account
GOOGLE_SERVICE_ACCOUNT=./service-account.json
GOOGLE_SPREADSHEET_ID=your_default_spreadsheet_id
```

`GOOGLE_SERVICE_ACCOUNT` can also contain the full JSON string instead of a file path.

Important: a service account does not automatically see your personal Drive. It only sees files/folders shared with its email, unless you configure Google Workspace domain-wide delegation.

## Auth Option 2: OAuth

Use this when the MCP should access files as your Google user.

1. Create an OAuth client in Google Cloud.
2. Add this redirect URI:

```text
http://localhost:3459/oauth2callback
```

3. Set:

```bash
GOOGLE_AUTH_MODE=oauth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_TOKEN_PATH=.mcp-google-drive/token.json
```

4. Run the one-time auth flow:

```bash
bun run src/mcp/cli.ts auth
```

This stores a refresh token at `GOOGLE_TOKEN_PATH`.

If you change `GOOGLE_SCOPES`, delete the existing token file and run the auth command again.

## Scopes

Default scopes:

```text
https://www.googleapis.com/auth/drive.metadata.readonly
https://www.googleapis.com/auth/drive.readonly
https://www.googleapis.com/auth/spreadsheets
```

Override with `GOOGLE_SCOPES` if you need a narrower or broader set.

## Run As MCP

Stdio mode:

```bash
bun run src/mcp/cli.ts --stdio
```

HTTP mode:

```bash
bun run src/mcp/cli.ts
```

HTTP endpoints:

```text
REST: http://localhost:3458/api/drive/search
MCP:  http://localhost:3458/api/mcp
```

## Cursor Config

The repo includes `.cursor/mcp.json`:

```json
{
	"mcpServers": {
		"mcp-google-drive": {
			"type": "stdio",
			"command": "bun",
			"args": ["run", "src/mcp/cli.ts", "--stdio"],
			"cwd": "${workspaceFolder}",
			"envFile": "${workspaceFolder}/.env"
		}
	}
}
```

## Drive Tools

- `get_drive_search` - search visible Drive files.
- `get_drive_file` - read metadata for a file.
- `get_drive_permissions` - list visible permissions for a file.
- `get_drive_export` - export Google Docs/Slides/etc. to a text MIME type.

Examples:

```bash
curl -sS 'http://localhost:3458/api/drive/search?mimeType=application/vnd.google-apps.spreadsheet&pageSize=10'
```

```bash
curl -sS 'http://localhost:3458/api/drive/file?fileId=...'
```

```bash
curl -sS 'http://localhost:3458/api/drive/export?fileId=...&mimeType=text/plain'
```

`get_drive_export` currently accepts text exports only, such as `text/plain`, `text/html`, or `text/csv`. Binary exports like PDF are intentionally rejected so large binary payloads are not pushed through JSON.

## Sheets Tools

- `get_values` - read one or more A1 ranges.
- `get_meta` - read spreadsheet metadata and sheet properties.
- `post_append` - append rows to a range.
- `post_update` - update a specific range.
- `post_batch_update` - update multiple ranges.
- `post_clear` - clear values from a range.
- `post_sheets_add` - create a sheet/tab.
- `post_batch` - run raw structural `spreadsheets.batchUpdate` requests.
- `post_headers_ensure` - create/validate first-row headers.
- `get_rows_last` - read the last N rows from a range.
- `get_rows_find` - find exact row matches by header name or column index.
- `get_cache` - reopen metadata and capped preview for a cached result file.

All tools return `{ file, type, sizeBytes, preview }`. Read the `file` path for the full response.

## Quick Verification

After configuring auth and a shared test sheet, start HTTP mode:

```bash
bun run src/mcp/cli.ts
```

List tools:

```bash
curl -sS -X POST http://localhost:3458/api/mcp \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Search visible spreadsheets:

```bash
curl -sS 'http://localhost:3458/api/drive/search?mimeType=application/vnd.google-apps.spreadsheet'
```

Read spreadsheet metadata:

```bash
curl -sS 'http://localhost:3458/api/meta'
```

Read a range:

```bash
curl -sS 'http://localhost:3458/api/values?range=Sheet1!A1:D10'
```

Ensure headers before a report append:

```bash
curl -sS -X POST http://localhost:3458/api/headers/ensure \
  -H 'content-type: application/json' \
  --data '{"sheetName":"Sheet1","headers":["date","campaign","spend"],"overwrite":false}'
```

Append a test row:

```bash
curl -sS -X POST http://localhost:3458/api/append \
  -H 'content-type: application/json' \
  --data '{"range":"Sheet1!A:C","values":[["test", "from mcp-google-drive", "2026-04-28"]]}'
```

## Cron Usage

For a daily FB ads spend report, use service account auth and import the library from a Bun script:

```ts
import { getAccessToken, loadConfig, SheetsClient } from '@livx.cc/mcp-google-drive';

const cfg = loadConfig();
const sheets = new SheetsClient(() => getAccessToken(cfg));

await sheets.appendValues({
	spreadsheetId: cfg.spreadsheetId!,
	range: 'Daily!A:F',
	values: [[new Date().toISOString().slice(0, 10), 'campaign', 'spend']],
});
```

Recommended report flow:

1. `post_sheets_add` once if the report tab does not exist.
2. `post_headers_ensure` with stable report columns.
3. `get_rows_find` by date/campaign to avoid duplicate rows.
4. `post_append` for new spend rows.
5. Read cached result files only when the inline preview is not enough.

## Safety

Generated local files are ignored by git:

- `.env`
- `.mcp-google-drive/`
- `.mcp-google-sheets/`
- `.tmp/`
- `service-account*.json`
- `node_modules/`
