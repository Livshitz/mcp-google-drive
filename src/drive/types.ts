export interface SearchFilesOptions {
    q?: string;
    name?: string;
    mimeType?: string;
    pageSize?: number;
    pageToken?: string;
    orderBy?: string;
}

export interface GetFileOptions {
    fileId: string;
    fields?: string;
}

export interface ExportFileOptions {
    fileId: string;
    mimeType: string;
}

export interface ListCommentsOptions {
    fileId: string;
    includeDeleted?: boolean;
    pageSize?: number;
    pageToken?: string;
}

export interface CreateCommentOptions {
    fileId: string;
    content: string;
    /** Anchor the comment to a region — a Drive anchor JSON string (see Drive API "anchor"). */
    anchor?: string;
    /** Text the comment refers to; Docs shows it as the quoted context. */
    quotedText?: string;
}

export interface ReplyCommentOptions {
    fileId: string;
    commentId: string;
    /** Optional when `action` is set (a bare resolve/reopen). */
    content?: string;
    /** 'resolve' closes the thread, 'reopen' re-opens it. */
    action?: 'resolve' | 'reopen';
}
