import type { Config } from '../config.ts';
import { authContext } from './context.ts';
import { getOAuthAccessToken } from './oauth.ts';
import { getServiceAccountAccessToken } from './service-account.ts';

export async function getAccessToken(cfg: Config): Promise<string> {
    const mode = authContext.get() || cfg.authMode;

    if (mode === 'service_account') {
        if (!cfg.serviceAccount) throw new Error('Service account auth requires GOOGLE_SERVICE_ACCOUNT.');
        return await getServiceAccountAccessToken(cfg.serviceAccount, cfg.scopes, cfg.impersonateEmail);
    }

    if (mode === 'oauth') return await getOAuthAccessToken(cfg);

    // auto: prefer OAuth (operator files), fall back to SA
    try { return await getOAuthAccessToken(cfg); } catch (err) {
        console.warn('[auth] OAuth failed, falling back to SA:', (err as Error).message);
    }
    if (cfg.serviceAccount) return await getServiceAccountAccessToken(cfg.serviceAccount, cfg.scopes, cfg.impersonateEmail);
    throw new Error('No auth method available — configure OAuth or GOOGLE_SERVICE_ACCOUNT.');
}

export { createOAuthToken } from './oauth.ts';
export { DEFAULT_GOOGLE_SCOPES, getServiceAccountAccessToken, loadServiceAccount } from './service-account.ts';
