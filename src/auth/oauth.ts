import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { createServer } from 'http';
import type { Config } from '../config.ts';

export interface OAuthToken {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
}

function requireOAuthConfig(cfg: Config): { clientId: string; clientSecret: string } {
    if (!cfg.clientId || !cfg.clientSecret) {
        throw new Error('OAuth auth requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
    }
    return { clientId: cfg.clientId, clientSecret: cfg.clientSecret };
}

function tokenFile(cfg: Config): string {
    return resolve(process.cwd(), cfg.tokenPath);
}

async function exchangeToken(params: Record<string, string>): Promise<OAuthToken> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
    });
    const data = (await res.json()) as OAuthToken & { error?: string; error_description?: string };
    if (!res.ok || data.error) {
        throw new Error(data.error_description || data.error || `Google OAuth token exchange failed (${res.status})`);
    }
    return data;
}

export async function getOAuthAccessToken(cfg: Config): Promise<string> {
    const { clientId, clientSecret } = requireOAuthConfig(cfg);
    const path = tokenFile(cfg);
    if (!existsSync(path)) throw new Error(`OAuth token file not found: ${path}. Run "mcp-google-drive auth" first.`);

    const token = JSON.parse(readFileSync(path, 'utf-8')) as OAuthToken;
    if (!token.refresh_token) throw new Error(`OAuth token file has no refresh_token: ${path}`);

    const refreshed = await exchangeToken({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: token.refresh_token,
        grant_type: 'refresh_token',
    });

    return refreshed.access_token!;
}

export async function createOAuthToken(cfg: Config): Promise<string> {
    const { clientId, clientSecret } = requireOAuthConfig(cfg);
    const redirectUri = cfg.oauthRedirectUri;
    const callbackUrl = new URL(redirectUri);
    const port = Number(callbackUrl.port || (callbackUrl.protocol === 'https:' ? 443 : 80));

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('scope', cfg.scopes);

    const code = await new Promise<string>((resolveCode, reject) => {
        const server = createServer((req, res) => {
            const url = new URL(req.url || '/', redirectUri);
            if (url.pathname !== callbackUrl.pathname) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }

            const error = url.searchParams.get('error');
            const value = url.searchParams.get('code');
            res.writeHead(error ? 400 : 200, { 'content-type': 'text/plain' });
            res.end(error ? `OAuth failed: ${error}` : 'OAuth complete. You can close this tab.');
            server.close();

            if (error) reject(new Error(error));
            else if (value) resolveCode(value);
            else reject(new Error('OAuth callback did not include a code.'));
        });

        server.listen(port, () => {
            console.log(`Open this URL to authorize Google Drive access:\n${authUrl.toString()}`);
            // Best-effort browser launch — headless/remote boxes have no opener, and a missing
            // binary must not kill the flow: the URL above is enough to authorize from anywhere.
            const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
            try { Bun.spawn([opener, authUrl.toString()], { stdout: 'ignore', stderr: 'ignore' }); } catch (err) {
                console.warn(`[auth] could not open a browser (${(err as Error).message}) — open the URL above manually.`);
            }
        });
    });

    const token = await exchangeToken({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    });

    const path = tokenFile(cfg);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(token, null, 2), 'utf-8');
    return path;
}
