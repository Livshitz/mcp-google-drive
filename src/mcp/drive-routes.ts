import type { IRequest } from 'itty-router';
import type { RouterWrapper } from 'edge.libx.js';
import type { DriveClient } from '../drive/client.ts';
import type { FileCache } from './file-cache.ts';
import { q, required } from './utils.ts';

export function registerDriveRoutes(rw: RouterWrapper, client: DriveClient, fileCache: FileCache) {
    rw.router.get('/drive/search', async (req: IRequest) => {
        const data = await client.searchFiles({
            q: q(req.query.q) || undefined,
            name: q(req.query.name) || undefined,
            mimeType: q(req.query.mimeType) || undefined,
            pageSize: q(req.query.pageSize) ? Number(q(req.query.pageSize)) : undefined,
            pageToken: q(req.query.pageToken) || undefined,
            orderBy: q(req.query.orderBy) || undefined,
        });
        return fileCache.write('drive_search', q(req.query.name) || q(req.query.mimeType) || 'files', data);
    });

    rw.router.get('/drive/file', async (req: IRequest) => {
        const fileId = required(q(req.query.fileId), 'fileId');
        const data = await client.getFile({
            fileId,
            fields: q(req.query.fields) || undefined,
        });
        return fileCache.write('drive_file', fileId, data);
    });

    rw.router.get('/drive/permissions', async (req: IRequest) => {
        const fileId = required(q(req.query.fileId), 'fileId');
        const data = await client.listPermissions(fileId);
        return fileCache.write('drive_permissions', fileId, data);
    });

    rw.router.get('/drive/export', async (req: IRequest) => {
        const fileId = required(q(req.query.fileId), 'fileId');
        const mimeType = q(req.query.mimeType, 'text/plain');
        const data = await client.exportFile({ fileId, mimeType });
        return fileCache.write('drive_export', `${fileId}_${mimeType}`, data);
    });

    rw.describeMCP('/drive/search', 'GET', {
        description: 'Search Google Drive files visible to the authenticated account. Supports name contains, mimeType, raw Drive q, pageSize, pageToken, and orderBy. Full response is cached to disk.',
        params: {
            q: { description: 'Raw Drive query fragment, combined with trashed=false.' },
            name: { description: 'Find files where name contains this text.' },
            mimeType: { description: 'Exact MIME type, e.g. application/vnd.google-apps.spreadsheet.' },
            pageSize: { description: 'Result count, capped at 100.' },
            pageToken: { description: 'Next page token from a prior result.' },
            orderBy: { description: 'Drive orderBy, defaults to modifiedTime desc.' },
        },
    });

    rw.describeMCP('/drive/file', 'GET', {
        description: 'Get Google Drive file metadata by fileId. Full response is cached to disk.',
        params: {
            fileId: { description: 'Google Drive file ID.' },
            fields: { description: 'Optional Drive fields selector. Defaults to *.' },
        },
    });

    rw.describeMCP('/drive/permissions', 'GET', {
        description: 'List Google Drive file permissions visible to the authenticated account. Full response is cached to disk.',
        params: {
            fileId: { description: 'Google Drive file ID.' },
        },
    });

    rw.describeMCP('/drive/export', 'GET', {
        description: 'Export a Google Workspace file such as Docs or Slides into a text MIME type. Full text is cached to disk.',
        params: {
            fileId: { description: 'Google Drive file ID.' },
            mimeType: { description: 'Text export MIME type, default text/plain. Examples: text/plain, text/html, text/csv.' },
        },
    });
}
