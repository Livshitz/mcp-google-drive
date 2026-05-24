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

    // auto: prefer SA if available, fall back to OAuth
    if (cfg.serviceAccount) return await getServiceAccountAccessToken(cfg.serviceAccount, cfg.scopes, cfg.impersonateEmail);
    return await getOAuthAccessToken(cfg);
}

export { createOAuthToken } from './oauth.ts';
export { DEFAULT_GOOGLE_SCOPES, getServiceAccountAccessToken, loadServiceAccount } from './service-account.ts';
