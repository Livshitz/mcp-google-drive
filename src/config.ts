export type AuthMode = 'service_account' | 'oauth' | 'auto';

export interface Config {
    authMode: AuthMode;
    cacheDir: string;
    clientId?: string;
    clientSecret?: string;
    oauthRedirectUri: string;
    readOnly: boolean;
    serviceAccount?: string;
    spreadsheetId?: string;
    tokenPath: string;
}

function bool(value: string | undefined, fallback = false): boolean {
    if (value == null || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function authMode(value: string | undefined): AuthMode {
    if (value === 'service_account' || value === 'oauth' || value === 'auto') return value;
    return 'auto';
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
    return {
        authMode: authMode(env.GOOGLE_AUTH_MODE),
        cacheDir: env.MCP_CACHE_DIR || '.mcp-google-sheets/cache',
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        oauthRedirectUri: env.GOOGLE_REDIRECT_URI || 'http://localhost:3459/oauth2callback',
        readOnly: bool(env.MCP_READONLY, false),
        serviceAccount: env.GOOGLE_SERVICE_ACCOUNT,
        spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
        tokenPath: env.GOOGLE_TOKEN_PATH || '.mcp-google-sheets/token.json',
    };
}
