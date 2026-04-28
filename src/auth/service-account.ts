import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { JwtHelper } from 'edge.libx.js/build/helpers/jwt.js';

export const DEFAULT_GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets',
].join(' ');

export function loadServiceAccount(value: string): any {
    if (value.trim().startsWith('{')) return JSON.parse(value);
    const filePath = resolve(process.cwd(), value);
    if (!existsSync(filePath)) throw new Error(`Google service account file not found: ${filePath}`);
    return JSON.parse(readFileSync(filePath, 'utf-8'));
}

export async function getServiceAccountAccessToken(serviceAccountValue: string, scope = DEFAULT_GOOGLE_SCOPES): Promise<string> {
    const serviceAccount = loadServiceAccount(serviceAccountValue);
    return await JwtHelper.generateOAuth(serviceAccount, scope);
}
