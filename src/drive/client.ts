import type { CreateCommentOptions, ExportFileOptions, GetFileOptions, ListCommentsOptions, ReplyCommentOptions, SearchFilesOptions } from './types.ts';

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const COMMENT_FIELDS = 'comments(id,content,htmlContent,author(displayName,emailAddress),createdTime,modifiedTime,resolved,deleted,anchor,quotedFileContent,replies(id,content,author(displayName,emailAddress),createdTime,action)),nextPageToken';
const DEFAULT_FIELDS = 'nextPageToken,files(id,name,mimeType,webViewLink,modifiedTime,createdTime,owners(displayName,emailAddress),shared,parents,size)';

export class DriveClient {
    constructor(private readonly getAccessToken: () => Promise<string>) {}

    async searchFiles(options: SearchFilesOptions = {}) {
        const url = new URL(`${DRIVE_BASE}/files`);
        url.searchParams.set('fields', DEFAULT_FIELDS);
        url.searchParams.set('pageSize', String(Math.min(Math.max(options.pageSize || 20, 1), 100)));
        url.searchParams.set('orderBy', options.orderBy || 'modifiedTime desc');
        url.searchParams.set('includeItemsFromAllDrives', 'true');
        url.searchParams.set('supportsAllDrives', 'true');
        if (options.pageToken) url.searchParams.set('pageToken', options.pageToken);
        url.searchParams.set('q', buildQuery(options));
        return await this.request(url);
    }

    async getFile(options: GetFileOptions) {
        const url = new URL(`${DRIVE_BASE}/files/${encodeURIComponent(options.fileId)}`);
        url.searchParams.set('fields', options.fields || '*');
        url.searchParams.set('supportsAllDrives', 'true');
        return await this.request(url);
    }

    async listPermissions(fileId: string) {
        const url = new URL(`${DRIVE_BASE}/files/${encodeURIComponent(fileId)}/permissions`);
        url.searchParams.set('fields', 'permissions(id,type,emailAddress,role,displayName,domain,deleted)');
        url.searchParams.set('supportsAllDrives', 'true');
        return await this.request(url);
    }

    async listComments(options: ListCommentsOptions) {
        const url = new URL(`${DRIVE_BASE}/files/${encodeURIComponent(options.fileId)}/comments`);
        url.searchParams.set('fields', COMMENT_FIELDS);
        url.searchParams.set('pageSize', String(Math.min(Math.max(options.pageSize || 100, 1), 100)));
        if (options.includeDeleted) url.searchParams.set('includeDeleted', 'true');
        if (options.pageToken) url.searchParams.set('pageToken', options.pageToken);
        return await this.request(url);
    }

    async createComment(options: CreateCommentOptions) {
        const url = new URL(`${DRIVE_BASE}/files/${encodeURIComponent(options.fileId)}/comments`);
        url.searchParams.set('fields', '*');
        const body: Record<string, any> = { content: options.content };
        if (options.anchor) body.anchor = options.anchor;
        if (options.quotedText) body.quotedFileContent = { value: options.quotedText };
        return await this.request(url, { method: 'POST', body });
    }

    async replyToComment(options: ReplyCommentOptions) {
        const url = new URL(`${DRIVE_BASE}/files/${encodeURIComponent(options.fileId)}/comments/${encodeURIComponent(options.commentId)}/replies`);
        url.searchParams.set('fields', '*');
        const body: Record<string, any> = {};
        if (options.content) body.content = options.content;
        if (options.action) body.action = options.action;
        return await this.request(url, { method: 'POST', body });
    }

    async exportFile(options: ExportFileOptions) {
        const url = new URL(`${DRIVE_BASE}/files/${encodeURIComponent(options.fileId)}/export`);
        url.searchParams.set('mimeType', options.mimeType);
        const token = await this.getAccessToken();
        const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw Object.assign(new Error(text || `Google Drive export failed (${res.status})`), { status: res.status });
        }
        const contentType = res.headers.get('content-type') || options.mimeType;
        if (!isTextExport(contentType, options.mimeType)) {
            throw Object.assign(new Error(`Drive export only supports text responses for now. Requested ${options.mimeType}, got ${contentType}.`), {
                status: 415,
            });
        }
        const text = await res.text();
        return {
            fileId: options.fileId,
            mimeType: options.mimeType,
            contentType,
            text,
        };
    }

    private async request(url: URL, options: { method?: string; body?: any } = {}) {
        const token = await this.getAccessToken();
        const res = await fetch(url, {
            method: options.method || 'GET',
            headers: {
                authorization: `Bearer ${token}`,
                'content-type': 'application/json',
            },
            body: options.body == null ? undefined : JSON.stringify(options.body),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
            const message = data?.error?.message || data?.error || `Google Drive API failed (${res.status})`;
            throw Object.assign(new Error(message), { status: res.status, details: data });
        }
        return data;
    }
}

function buildQuery(options: SearchFilesOptions): string {
    const parts = ['trashed = false'];
    if (options.q) parts.push(`(${options.q})`);
    if (options.name) parts.push(`name contains '${escapeQuery(options.name)}'`);
    if (options.mimeType) parts.push(`mimeType = '${escapeQuery(options.mimeType)}'`);
    return parts.join(' and ');
}

function escapeQuery(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function isTextExport(contentType: string, requestedMimeType: string): boolean {
    const value = `${contentType};${requestedMimeType}`.toLowerCase();
    return value.includes('text/') || value.includes('application/json') || value.includes('application/xml') || value.includes('application/csv');
}
