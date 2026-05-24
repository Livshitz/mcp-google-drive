export interface CreatePresentationOptions {
    title: string;
}

export interface GetPresentationOptions {
    presentationId: string;
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
