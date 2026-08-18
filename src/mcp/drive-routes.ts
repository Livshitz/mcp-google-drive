import type { IRequest } from 'itty-router';
import type { RouterWrapper } from 'edge.libx.js';
import type { Config } from '../config.ts';
import type { DriveClient } from '../drive/client.ts';
import type { FileCache } from './file-cache.ts';
import { q, required } from './utils.ts';

function guardWrite(cfg: Config): void {
    if (cfg.readOnly) {
        throw Object.assign(new Error('Write operations are disabled. Set MCP_READONLY=false to enable.'), { status: 403 });
    }
}

export function registerDriveRoutes(rw: RouterWrapper, client: DriveClient, fileCache: FileCache, cfg: Config) {
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

    rw.router.get('/drive/comments', async (req: IRequest) => {
        const fileId = required(q(req.query.fileId), 'fileId');
        const data = await client.listComments({
            fileId,
            includeDeleted: q(req.query.includeDeleted) === 'true',
            pageSize: q(req.query.pageSize) ? Number(q(req.query.pageSize)) : undefined,
            pageToken: q(req.query.pageToken) || undefined,
        });
        return fileCache.write('drive_comments', fileId, data);
    });

    rw.router.post('/drive/comments', async (req: IRequest) => {
        guardWrite(cfg);
        const body = await req.json();
        const data = await client.createComment({
            fileId: required(body.fileId, 'fileId'),
            content: required(body.content, 'content'),
            anchor: body.anchor,
            quotedText: body.quotedText,
        });
        return fileCache.write('drive_comment_create', body.fileId, data);
    });

    rw.router.post('/drive/comments/reply', async (req: IRequest) => {
        guardWrite(cfg);
        const body = await req.json();
        if (!body.content && !body.action) throw Object.assign(new Error('content or action is required'), { status: 400 });
        const data = await client.replyToComment({
            fileId: required(body.fileId, 'fileId'),
            commentId: required(body.commentId, 'commentId'),
            content: body.content,
            action: body.action,
        });
        return fileCache.write('drive_comment_reply', `${body.fileId}_${body.commentId}`, data);
    });

    rw.describeMCP('/drive/comments', 'GET', {
        description: 'List comment threads (with replies, resolved state, and anchored quoted text) on a Drive file such as a Google Doc. Full response is cached to disk.',
        params: {
            fileId: { description: 'Google Drive file ID.' },
            includeDeleted: { description: 'Set true to include deleted comments.' },
            pageSize: { description: 'Threads per page, capped at 100.' },
            pageToken: { description: 'Next page token from a prior result.' },
        },
    });

    rw.describeMCP('/drive/comments', 'POST', {
        description: 'Create a comment on a Drive file. Pass quotedText to anchor it to a phrase in a Google Doc (Docs shows it as the quoted context). Requires the https://www.googleapis.com/auth/drive scope.',
        params: {
            fileId: { description: 'Google Drive file ID.' },
            content: { description: 'Comment body (plain text).' },
            quotedText: { description: 'Text the comment refers to, shown as the quoted context.' },
            anchor: { description: 'Optional raw Drive anchor JSON string for region anchoring.' },
        },
    });

    rw.describeMCP('/drive/comments/reply', 'POST', {
        description: 'Reply to a comment thread, and/or resolve or reopen it via action. Requires the https://www.googleapis.com/auth/drive scope.',
        params: {
            fileId: { description: 'Google Drive file ID.' },
            commentId: { description: 'Comment thread ID from GET /drive/comments.' },
            content: { description: 'Reply body. Optional when action is set.' },
            action: { description: "'resolve' to close the thread, 'reopen' to re-open it." },
        },
    });
}
