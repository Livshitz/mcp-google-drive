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
