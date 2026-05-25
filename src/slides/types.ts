export interface CreatePresentationOptions {
    title: string;
}

export interface GetPresentationOptions {
    presentationId: string;
}

export interface GetSlidesContentOptions {
    presentationId: string;
    slideIndex?: number;
}

export interface GetSlideThumbnailOptions {
    presentationId: string;
    pageObjectId?: string;
    slideIndex?: number;
    size?: 'SMALL' | 'MEDIUM' | 'LARGE';
}

export interface AddSlideOptions {
    presentationId: string;
    layout?: PredefinedLayout;
    insertionIndex?: number;
}

export interface SetSlideTextOptions {
    presentationId: string;
    slideId: string;
    placeholder: PlaceholderType;
    text: string;
}

export interface InsertTextBoxOptions {
    presentationId: string;
    slideId: string;
    text: string;
    position: Position;
    size: Size;
}

export interface InsertImageOptions {
    presentationId: string;
    slideId: string;
    imageUrl: string;
    position: Position;
    size: Size;
}

export interface SetBackgroundOptions {
    presentationId: string;
    slideId: string;
    color: RgbColor;
}

export interface SetSpeakerNotesOptions {
    presentationId: string;
    slideId: string;
    notes: string;
}

export interface DeleteSlideOptions {
    presentationId: string;
    slideId: string;
}

export interface Position {
    x: number;
    y: number;
    unit?: DimensionUnit;
}

export interface Size {
    width: number;
    height: number;
    unit?: DimensionUnit;
}

export interface RgbColor {
    red?: number;
    green?: number;
    blue?: number;
}

export type DimensionUnit = 'PT' | 'EMU';

export type PredefinedLayout =
    | 'BLANK'
    | 'CAPTION_ONLY'
    | 'TITLE'
    | 'TITLE_AND_BODY'
    | 'TITLE_AND_TWO_COLUMNS'
    | 'TITLE_ONLY'
    | 'SECTION_HEADER'
    | 'SECTION_TITLE_AND_DESCRIPTION'
    | 'ONE_COLUMN_TEXT'
    | 'MAIN_POINT'
    | 'BIG_NUMBER';

export type PlaceholderType =
    | 'TITLE'
    | 'SUBTITLE'
    | 'BODY'
    | 'CENTERED_TITLE'
    | 'SLIDE_NUMBER';

export interface FormatTextOptions {
    presentationId: string;
    objectId: string;
    startIndex?: number;
    endIndex?: number;
    match?: string;
    matchAll?: boolean;
    style: TextStyle;
}

export interface TextStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fontSize?: number;
    fontFamily?: string;
    foregroundColor?: RgbColor;
    backgroundColor?: RgbColor;
    link?: string;
}

export interface GetMastersOptions {
    presentationId: string;
}

export interface ApplyMasterOptions {
    presentationId: string;
    slideId: string;
    layoutId: string;
}

export interface SetPageSizeOptions {
    presentationId: string;
    width: number;
    height: number;
    unit?: DimensionUnit;
}

export interface DuplicateSlideOptions {
    presentationId: string;
    slideId: string;
    insertionIndex?: number;
}
