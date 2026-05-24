export { getAccessToken, createOAuthToken } from './auth/index.ts';
export { loadConfig } from './config.ts';
export type { AuthMode, Config } from './config.ts';
export { DriveClient } from './drive/client.ts';
export type { ExportFileOptions, GetFileOptions, SearchFilesOptions } from './drive/types.ts';
export { SheetsClient } from './sheets/client.ts';
export type {
    AddSheetOptions,
    BatchWriteValuesOptions,
    ClearValuesOptions,
    EnsureHeadersOptions,
    FindRowsOptions,
    GetValuesOptions,
    LastRowsOptions,
    StructuralBatchUpdateOptions,
    ValueRange,
    WriteValuesOptions,
} from './sheets/types.ts';
export { SlidesClient } from './slides/client.ts';
export type {
    AddSlideOptions,
    ApplyMasterOptions,
    CreatePresentationOptions,
    DeleteSlideOptions,
    DuplicateSlideOptions,
    FormatTextOptions,
    GetMastersOptions,
    GetPresentationOptions,
    InsertImageOptions,
    InsertTextBoxOptions,
    SetBackgroundOptions,
    SetSlideTextOptions,
    SetSpeakerNotesOptions,
    TextStyle,
} from './slides/types.ts';
