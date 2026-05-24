import type {
    AddSlideOptions,
    CreatePresentationOptions,
    DeleteSlideOptions,
    DimensionUnit,
    GetPresentationOptions,
    InsertImageOptions,
    InsertTextBoxOptions,
    Position,
    SetBackgroundOptions,
    SetSlideTextOptions,
    SetSpeakerNotesOptions,
    Size,
} from './types.ts';

const SLIDES_BASE = 'https://slides.googleapis.com/v1/presentations';

export class SlidesClient {
    constructor(private readonly getAccessToken: () => Promise<string>) {}

    async createPresentation(options: CreatePresentationOptions) {
        const data = await this.request(SLIDES_BASE, {
            method: 'POST',
            body: { title: options.title },
        });
        return {
            presentationId: data.presentationId,
            title: data.title,
            url: `https://docs.google.com/presentation/d/${data.presentationId}/edit`,
            slidesCount: data.slides?.length ?? 0,
        };
    }

    async getPresentation(options: GetPresentationOptions) {
        const data = await this.request(`${SLIDES_BASE}/${enc(options.presentationId)}`);
        return {
            presentationId: data.presentationId,
            title: data.title,
            url: `https://docs.google.com/presentation/d/${data.presentationId}/edit`,
            slidesCount: data.slides?.length ?? 0,
            slides: (data.slides || []).map((s: any) => ({
                objectId: s.objectId,
                layoutId: s.slideProperties?.layoutObjectId,
            })),
        };
    }

    async addSlide(options: AddSlideOptions) {
        const objectId = genId();
        const request: any = {
            createSlide: {
                objectId,
                ...(options.insertionIndex != null && { insertionIndex: options.insertionIndex }),
                ...(options.layout && {
                    slideLayoutReference: { predefinedLayout: options.layout },
                }),
            },
        };
        await this.batchUpdate(options.presentationId, [request]);
        return { slideId: objectId };
    }

    async setSlideText(options: SetSlideTextOptions) {
        const pres = await this.request(`${SLIDES_BASE}/${enc(options.presentationId)}`);
        const slide = pres.slides?.find((s: any) => s.objectId === options.slideId);
        if (!slide) throw err(`Slide ${options.slideId} not found`, 404);

        const element = findPlaceholder(slide, options.placeholder);
        if (!element) throw err(`Placeholder ${options.placeholder} not found on slide ${options.slideId}`, 404);

        const requests: any[] = [];
        if (hasText(element)) {
            requests.push({ deleteText: { objectId: element.objectId, textRange: { type: 'ALL' } } });
        }
        requests.push({ insertText: { objectId: element.objectId, text: options.text, insertionIndex: 0 } });
        await this.batchUpdate(options.presentationId, requests);
        return { objectId: element.objectId, placeholder: options.placeholder };
    }

    async insertTextBox(options: InsertTextBoxOptions) {
        const objectId = genId();
        const unit = options.position.unit || options.size.unit || 'PT';
        const requests: any[] = [
            {
                createShape: {
                    objectId,
                    shapeType: 'TEXT_BOX',
                    elementProperties: buildElementProperties(options.slideId, options.position, options.size, unit),
                },
            },
            { insertText: { objectId, text: options.text, insertionIndex: 0 } },
        ];
        await this.batchUpdate(options.presentationId, requests);
        return { objectId };
    }

    async insertImage(options: InsertImageOptions) {
        const objectId = genId();
        const unit = options.position.unit || options.size.unit || 'PT';
        const requests: any[] = [
            {
                createImage: {
                    objectId,
                    url: options.imageUrl,
                    elementProperties: buildElementProperties(options.slideId, options.position, options.size, unit),
                },
            },
        ];
        await this.batchUpdate(options.presentationId, requests);
        return { objectId };
    }

    async setBackground(options: SetBackgroundOptions) {
        const requests: any[] = [
            {
                updatePageProperties: {
                    objectId: options.slideId,
                    pageProperties: {
                        pageBackgroundFill: {
                            solidFill: {
                                color: { rgbColor: options.color },
                            },
                        },
                    },
                    fields: 'pageBackgroundFill.solidFill.color',
                },
            },
        ];
        await this.batchUpdate(options.presentationId, requests);
        return { slideId: options.slideId };
    }

    async setSpeakerNotes(options: SetSpeakerNotesOptions) {
        const pres = await this.request(`${SLIDES_BASE}/${enc(options.presentationId)}`);
        const slide = pres.slides?.find((s: any) => s.objectId === options.slideId);
        if (!slide) throw err(`Slide ${options.slideId} not found`, 404);

        const notesPage = slide.slideProperties?.notesPage;
        const notesShape = notesPage?.pageElements?.find(
            (el: any) => el.shape?.placeholder?.type === 'BODY',
        );
        if (!notesShape) throw err('Speaker notes placeholder not found', 404);

        const requests: any[] = [];
        if (hasText(notesShape)) {
            requests.push({ deleteText: { objectId: notesShape.objectId, textRange: { type: 'ALL' } } });
        }
        requests.push({ insertText: { objectId: notesShape.objectId, text: options.notes, insertionIndex: 0 } });
        await this.batchUpdate(options.presentationId, requests);
        return { objectId: notesShape.objectId };
    }

    async deleteSlide(options: DeleteSlideOptions) {
        const requests: any[] = [{ deleteObject: { objectId: options.slideId } }];
        await this.batchUpdate(options.presentationId, requests);
        return { deleted: options.slideId };
    }

    private async batchUpdate(presentationId: string, requests: any[]) {
        return await this.request(`${SLIDES_BASE}/${enc(presentationId)}:batchUpdate`, {
            method: 'POST',
            body: { requests },
        });
    }

    private async request(url: string, options: { method?: string; body?: any } = {}) {
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
            const message = data?.error?.message || data?.error || `Google Slides API failed (${res.status})`;
            throw Object.assign(new Error(message), { status: res.status, details: data });
        }
        return data;
    }
}

function enc(id: string) {
    return encodeURIComponent(id);
}

function genId(): string {
    return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function err(message: string, status: number) {
    return Object.assign(new Error(message), { status });
}

function findPlaceholder(slide: any, type: string) {
    return slide.pageElements?.find(
        (el: any) => el.shape?.placeholder?.type === type,
    );
}

function hasText(element: any): boolean {
    const content = element?.shape?.text?.textElements;
    if (!Array.isArray(content)) return false;
    return content.some((te: any) => te.textRun?.content?.trim());
}

function buildElementProperties(pageId: string, pos: Position, size: Size, unit: DimensionUnit) {
    return {
        pageObjectId: pageId,
        transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: pos.x,
            translateY: pos.y,
            unit,
        },
        size: {
            width: { magnitude: size.width, unit },
            height: { magnitude: size.height, unit },
        },
    };
}
