import type { Config } from '../config.ts';
import { getOAuthAccessToken } from './oauth.ts';
import { getServiceAccountAccessToken } from './service-account.ts';

export async function getAccessToken(cfg: Config): Promise<string> {
    if (cfg.authMode === 'service_account') {
        if (!cfg.serviceAccount) throw new Error('Service account auth requires GOOGLE_SERVICE_ACCOUNT.');
        return await getServiceAccountAccessToken(cfg.serviceAccount, cfg.scopes, cfg.impersonateEmail);
    }

    if (cfg.authMode === 'oauth') return await getOAuthAccessToken(cfg);

    if (cfg.serviceAccount) return await getServiceAccountAccessToken(cfg.serviceAccount, cfg.scopes, cfg.impersonateEmail);
    return await getOAuthAccessToken(cfg);
}

export { createOAuthToken } from './oauth.ts';
export { DEFAULT_GOOGLE_SCOPES, getServiceAccountAccessToken, loadServiceAccount } from './service-account.ts';
