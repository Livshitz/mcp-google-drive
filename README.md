# mcp-google-sheets

Google Sheets MCP server for Cursor, Claude, and cron-friendly scripts.

It exposes a small Sheets API surface, writes full responses to disk, and returns file metadata so agents can inspect large results without flooding chat context.

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

Recommended for cron jobs and shared operational sheets.

1. Create a Google Cloud service account.
2. Enable the Google Sheets API for the project.
3. Download the service account JSON key.
4. Share the target spreadsheet with the service account email.
5. Set:

```bash
GOOGLE_AUTH_MODE=service_account
GOOGLE_SERVICE_ACCOUNT=./service-account.json
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
```

`GOOGLE_SERVICE_ACCOUNT` can also contain the full JSON string instead of a file path.

## Auth Option 2: OAuth

Use this when the sheet should be accessed as your Google user.

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
GOOGLE_TOKEN_PATH=.mcp-google-sheets/token.json
```

4. Run the one-time auth flow:

```bash
bun run src/mcp/cli.ts auth
```

This stores a refresh token at `GOOGLE_TOKEN_PATH`.

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
REST: http://localhost:3458/api/values
MCP:  http://localhost:3458/api/mcp
```

## Cursor Config

The repo includes `.cursor/mcp.json`:

```json
{
	"mcpServers": {
		"mcp-google-sheets": {
			"type": "stdio",
			"command": "bun",
			"args": ["run", "src/mcp/cli.ts", "--stdio"],
			"cwd": "${workspaceFolder}",
			"envFile": "${workspaceFolder}/.env"
		}
	}
}
```

## Tools

- `get_values` - read one or more A1 ranges.
- `get_meta` - read spreadsheet metadata and sheet properties.
- `post_append` - append rows to a range.
- `post_update` - update a specific range.
- `post_batch_update` - update multiple ranges.

All tools return `{ file, type, sizeBytes, preview }`. Read the `file` path for the full response.

## Quick Verification

After configuring auth and `GOOGLE_SPREADSHEET_ID`, start HTTP mode:

```bash
bun run src/mcp/cli.ts
```

List tools:

```bash
curl -sS -X POST http://localhost:3458/api/mcp \
  -H 'content-type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Read metadata:

```bash
curl -sS 'http://localhost:3458/api/meta'
```

Read a range:

```bash
curl -sS 'http://localhost:3458/api/values?range=Sheet1!A1:D10'
```

Append a test row:

```bash
curl -sS -X POST http://localhost:3458/api/append \
  -H 'content-type: application/json' \
  --data '{"range":"Sheet1!A:C","values":[["test", "from mcp-google-sheets", "2026-04-28"]]}'
```

## Cron Usage

For a daily FB ads spend report, use service account auth and import the library from a Bun script:

```ts
import { getAccessToken, loadConfig, SheetsClient } from '@livx.cc/mcp-google-sheets';

const cfg = loadConfig();
const sheets = new SheetsClient(() => getAccessToken(cfg));

await sheets.appendValues({
	spreadsheetId: cfg.spreadsheetId!,
	range: 'Daily!A:F',
	values: [[new Date().toISOString().slice(0, 10), 'campaign', 'spend']],
});
```

Schedule that script with cron or a systemd timer after the Facebook Ads pull is ready.

## Safety

Generated local files are ignored by git:

- `.env`
- `.mcp-google-sheets/`
- `service-account*.json`
- `node_modules/`
