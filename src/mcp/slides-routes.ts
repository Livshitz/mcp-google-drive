import type { IRequest } from 'itty-router';
import type { RouterWrapper } from 'edge.libx.js';
import type { SlidesClient } from '../slides/client.ts';
import type { PlaceholderType } from '../slides/types.ts';
import type { FileCache } from './file-cache.ts';
import { q, required } from './utils.ts';

export function registerSlidesRoutes(rw: RouterWrapper, client: SlidesClient, fileCache: FileCache) {
    rw.router.post('/slides/create', async (req: IRequest) => {
        const body = await req.json();
        const data = await client.createPresentation({ title: required(body.title, 'title') });
        return fileCache.write('slides_create', data.presentationId, data);
    });

    rw.router.get('/slides/get', async (req: IRequest) => {
        const presentationId = required(q(req.query.presentationId), 'presentationId');
        const data = await client.getPresentation({ presentationId });
        return fileCache.write('slides_get', presentationId, data);
    });

    rw.router.get('/slides/content', async (req: IRequest) => {
        const presentationId = required(q(req.query.presentationId), 'presentationId');
        const raw = req.query.slideIndex;
        const slideIndex = raw != null ? Number(q(raw)) : undefined;
        const data = await client.getSlidesContent({ presentationId, slideIndex });
        return fileCache.write('slides_content', presentationId, data);
    });

    rw.router.get('/slides/thumbnail', async (req: IRequest) => {
        const presentationId = required(q(req.query.presentationId), 'presentationId');
        const rawIndex = req.query.slideIndex;
        const slideIndex = rawIndex != null ? Number(q(rawIndex)) : undefined;
        const pageObjectId = q(req.query.pageObjectId) || undefined;
        const size = (q(req.query.size) || 'LARGE') as 'SMALL' | 'MEDIUM' | 'LARGE';
        const data = await client.getSlideThumbnails({ presentationId, slideIndex, pageObjectId, size });
        return fileCache.write('slides_thumbnail', presentationId, data);
    });

    rw.router.post('/slides/add_slide', async (req: IRequest) => {
        const body = await req.json();
        const data = await client.addSlide({
            presentationId: required(body.presentationId, 'presentationId'),
            layout: body.layout || undefined,
            insertionIndex: body.insertionIndex ?? undefined,
        });
        return fileCache.write('slides_add_slide', body.presentationId, data);
    });

    rw.router.post('/slides/set_text', async (req: IRequest) => {
        const body = await req.json();
        const data = await client.setSlideText({
            presentationId: required(body.presentationId, 'presentationId'),
            slideId: required(body.slideId, 'slideId'),
            placeholder: required(body.placeholder, 'placeholder') as PlaceholderType,
            text: required(body.text, 'text'),
        });
        return fileCache.write('slides_set_text', `${body.presentationId}_${body.slideId}`, data);
    });

    rw.router.post('/slides/insert_text_box', async (req: IRequest) => {
        const body = await req.json();
        const data = await client.insertTextBox({
            presentationId: required(body.presentationId, 'presentationId'),
            slideId: required(body.slideId, 'slideId'),
            text: required(body.text, 'text'),
            position: body.position || { x: 100, y: 100 },
            size: body.size || { width: 400, height: 50 },
        });
        return fileCache.write('slides_insert_text_box', `${body.presentationId}_${body.slideId}`, data);
    });

    rw.router.post('/slides/insert_image', async (req: IRequest) => {
        const body = await req.json();
        const data = await client.insertImage({
            presentationId: required(body.presentationId, 'presentationId'),
            slideId: required(body.slideId, 'slideId'),
            imageUrl: required(body.imageUrl, 'imageUrl'),
            position: body.position || { x: 100, y: 100 },
            size: body.size || { width: 400, height: 300 },
        });
        return fileCache.write('slides_insert_image', `${body.presentationId}_${body.slideId}`, data);
    });

    rw.router.post('/slides/set_background', async (req: IRequest) => {
        const body = await req.json();
        const data = await client.setBackground({
            presentationId: required(body.presentationId, 'presentationId'),
            slideId: required(body.slideId, 'slideId'),
            color: body.color || { red: 1, green: 1, blue: 1 },
        });
        return fileCache.write('slides_set_background', `${body.presentationId}_${body.slideId}`, data);
    });

    rw.router.post('/slides/set_speaker_notes', async (req: IRequest) => {
        const body = await req.json();
        const data = await client.setSpeakerNotes({
            presentationId: required(body.presentationId, 'presentationId'),
            slideId: required(body.slideId, 'slideId'),
            notes: required(body.notes, 'notes'),
        });
        return fileCache.write('slides_set_speaker_notes', `${body.presentationId}_${body.slideId}`, data);
    });

    rw.router.post('/slides/format_text', async (req: IRequest) => {
        const body = await req.json();
        const data = await client.formatText({
            presentationId: required(body.presentationId, 'presentationId'),
            objectId: required(body.objectId, 'objectId'),
            startIndex: body.startIndex ?? undefined,
            endIndex: body.endIndex ?? undefined,
            style: body.style || {},
        });
        return fileCache.write('slides_format_text', `${body.presentationId}_${body.objectId}`, data);
    });

    rw.router.get('/slides/masters', async (req: IRequest) => {
        const presentationId = required(q(req.query.presentationId), 'presentationId');
        const data = await client.getMasters({ presentationId });
        return fileCache.write('slides_masters', presentationId, data);
    });

    rw.router.post('/slides/apply_master', async (req: IRequest) => {
        const body = await req.json();
        const data = await client.applyMaster({
            presentationId: required(body.presentationId, 'presentationId'),
            slideId: required(body.slideId, 'slideId'),
            layoutId: required(body.layoutId, 'layoutId'),
        });
        return fileCache.write('slides_apply_master', `${body.presentationId}_${body.slideId}`, data);
    });

    rw.router.post('/slides/duplicate', async (req: IRequest) => {
        const body = await req.json();
        const data = await client.duplicateSlide({
            presentationId: required(body.presentationId, 'presentationId'),
            slideId: required(body.slideId, 'slideId'),
            insertionIndex: body.insertionIndex ?? undefined,
        });
        return fileCache.write('slides_duplicate', `${body.presentationId}_${body.slideId}`, data);
    });

    rw.router.post('/slides/delete', async (req: IRequest) => {
        const body = await req.json();
        const data = await client.deleteSlide({
            presentationId: required(body.presentationId, 'presentationId'),
            slideId: required(body.slideId, 'slideId'),
        });
        return fileCache.write('slides_delete', `${body.presentationId}_${body.slideId}`, data);
    });

    // MCP tool descriptions
    rw.describeMCP('/slides/create', 'POST', {
        description: 'Create a new Google Slides presentation. Returns presentationId and edit URL.',
        params: {
            body: { description: 'Object with title (string).' },
        },
    });

    rw.describeMCP('/slides/get', 'GET', {
        description: 'Get presentation metadata including slide IDs and layouts.',
        params: {
            presentationId: { description: 'Google Slides presentation ID.' },
        },
    });

    rw.describeMCP('/slides/content', 'GET', {
        description: 'Extract structured text content from slides with formatting metadata (bold, italic, strikethrough, links). Use instead of get_slides_get when you need to read what slides say.',
        params: {
            presentationId: { description: 'Google Slides presentation ID.' },
            slideIndex: { description: 'Optional 0-based slide index. Omit to return all slides.' },
        },
    });

    rw.describeMCP('/slides/thumbnail', 'GET', {
        description: 'Get PNG thumbnail URLs for slides. Returns contentUrl (valid ~30min), width, and height. Use to visually inspect slide content. Costly: prefer slideIndex or pageObjectId for single slides.',
        params: {
            presentationId: { description: 'Google Slides presentation ID.' },
            slideIndex: { description: 'Optional 0-based slide index for a single slide.' },
            pageObjectId: { description: 'Optional page object ID (from get_slides_get). Takes priority over slideIndex.' },
            size: { description: 'SMALL (200px), MEDIUM (800px), or LARGE (1600px, default).' },
        },
    });

    rw.describeMCP('/slides/add_slide', 'POST', {
        description: 'Add a new slide to the presentation. Returns the new slideId.',
        params: {
            body: { description: 'Object with presentationId, optional layout (BLANK | TITLE | TITLE_AND_BODY | TITLE_ONLY | SECTION_HEADER | CAPTION_ONLY | MAIN_POINT | BIG_NUMBER), optional insertionIndex (0-based).' },
        },
    });

    rw.describeMCP('/slides/set_text', 'POST', {
        description: 'Set text in a slide placeholder (TITLE, SUBTITLE, BODY). Replaces existing text.',
        params: {
            body: { description: 'Object with presentationId, slideId, placeholder (TITLE | SUBTITLE | BODY | CENTERED_TITLE), text.' },
        },
    });

    rw.describeMCP('/slides/insert_text_box', 'POST', {
        description: 'Insert a positioned text box on a slide. Use when no placeholder is available.',
        params: {
            body: { description: 'Object with presentationId, slideId, text, optional position { x, y, unit? } in PT, optional size { width, height, unit? } in PT.' },
        },
    });

    rw.describeMCP('/slides/insert_image', 'POST', {
        description: 'Insert an image on a slide by URL. The image must be publicly accessible.',
        params: {
            body: { description: 'Object with presentationId, slideId, imageUrl (publicly accessible), optional position { x, y, unit? } in PT, optional size { width, height, unit? } in PT.' },
        },
    });

    rw.describeMCP('/slides/set_background', 'POST', {
        description: 'Set a solid background color on a slide. RGB values are 0-1 floats.',
        params: {
            body: { description: 'Object with presentationId, slideId, color { red?, green?, blue? } (0-1 floats).' },
        },
    });

    rw.describeMCP('/slides/set_speaker_notes', 'POST', {
        description: 'Set speaker notes on a slide. Replaces existing notes.',
        params: {
            body: { description: 'Object with presentationId, slideId, notes (string).' },
        },
    });

    rw.describeMCP('/slides/format_text', 'POST', {
        description: 'Format text in a shape/text box. Apply bold, italic, font size, color, etc. Use objectId from set_text or insert_text_box responses.',
        params: {
            body: { description: 'Object with presentationId, objectId, optional startIndex/endIndex (omit for all text), style { bold?, italic?, underline?, fontSize? (PT), fontFamily?, foregroundColor? { red, green, blue } (0-1), backgroundColor?, link? (URL) }.' },
        },
    });

    rw.describeMCP('/slides/masters', 'GET', {
        description: 'List master slides and their layouts. Use layout objectIds with apply_master or add_slide.',
        params: {
            presentationId: { description: 'Google Slides presentation ID.' },
        },
    });

    rw.describeMCP('/slides/apply_master', 'POST', {
        description: 'Apply a master layout to an existing slide. Get layoutId from get_slides_masters.',
        params: {
            body: { description: 'Object with presentationId, slideId, layoutId (from masters response).' },
        },
    });

    rw.describeMCP('/slides/duplicate', 'POST', {
        description: 'Duplicate an existing slide. Useful for repeating a styled template slide.',
        params: {
            body: { description: 'Object with presentationId, slideId (to duplicate), optional insertionIndex.' },
        },
    });

    rw.describeMCP('/slides/delete', 'POST', {
        description: 'Delete a slide from the presentation.',
        params: {
            body: { description: 'Object with presentationId, slideId.' },
        },
    });
}
