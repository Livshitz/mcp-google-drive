import { describe, it, expect, afterEach } from 'bun:test';
import { describeCommentLimits } from '../src/drive/comment-limits.ts';
import { SheetsClient, parseA1Cell } from '../src/sheets/client.ts';

const SHEET = 'application/vnd.google-apps.spreadsheet';

describe('describeCommentLimits', () => {
    it('Sheets: unanchored + points to post_cell_comment, not to a note', () => {
        const l = describeCommentLimits(SHEET, 'hi', { anchor: '{"r":1}' });
        expect(l.anchored).toBe(false);
        expect(l.notes[0]).toContain('post_cell_comment');
        expect(l.notes.join(' ')).not.toMatch(/cell note|cannot anchor/i);
    });
    it('Docs/Slides name their own route; a plain file keeps its anchor', () => {
        expect(describeCommentLimits('application/vnd.google-apps.document', 'x', {}).notes[0]).toContain('documents.batchUpdate insertComment');
        expect(describeCommentLimits('application/vnd.google-apps.presentation', 'x', {}).notes[0]).toContain('Slides');
        const pdf = describeCommentLimits('application/pdf', 'x', { anchor: 'a' });
        expect(pdf.anchored).toBe(true);
        expect(pdf.notes.some((n) => n.startsWith('Unanchored'))).toBe(false);
    });
    it('lists mentions Google did not register', () => {
        const l = describeCommentLimits(SHEET, '+A@x.com +b@y.org', { mentionedEmailAddresses: ['a@x.com'] });
        expect(l.mentionsRequested).toEqual(['a@x.com', 'b@y.org']);
        expect(l.notes.find((n) => n.startsWith('Not registered'))).toContain('b@y.org');
        expect(l.notes.find((n) => n.startsWith('Not registered'))).not.toContain('a@x.com');
    });
    it('a plus-addressed email is not a mention; a real +email still is', () => {
        const plain = describeCommentLimits(SHEET, 'mail a+b@c.com please', {});
        expect(plain.mentionsRequested).toEqual([]);
        expect(plain.notes.some((n) => n.startsWith('Not registered'))).toBe(false);
        expect(describeCommentLimits(SHEET, 'cc (+d@e.com), a+b@c.com', {}).mentionsRequested).toEqual(['d@e.com']);
        expect(describeCommentLimits(SHEET, '+d@e.com first', {}).mentionsRequested).toEqual(['d@e.com']);
    });
});

describe('parseA1Cell', () => {
    it('parses tab, quoted tab, absolute refs and multi-letter columns', () => {
        expect(parseA1Cell('Sheet1!B2')).toEqual({ sheetTitle: 'Sheet1', rowIndex: 1, columnIndex: 1 });
        expect(parseA1Cell("'Bob''s tab'!$AA$10")).toEqual({ sheetTitle: "Bob's tab", rowIndex: 9, columnIndex: 26 });
        expect(parseA1Cell('A1')).toEqual({ sheetTitle: undefined, rowIndex: 0, columnIndex: 0 });
    });
    it('rejects ranges and row 0', () => {
        expect(() => parseA1Cell('A1:B2')).toThrow();
        expect(() => parseA1Cell('A0')).toThrow();
    });
});

describe('SheetsClient.insertCellComment', () => {
    const realFetch = globalThis.fetch;
    afterEach(() => { globalThis.fetch = realFetch; });
    const stub = (batchReply: any) => {
        const bodies: any[] = [];
        globalThis.fetch = (async (url: any, init: any) => {
            if (init?.body) bodies.push(JSON.parse(init.body));
            const data = String(url).includes(':batchUpdate') ? batchReply : { sheets: [{ properties: { sheetId: 0, title: 'A' } }, { properties: { sheetId: 77, title: 'Team' } }] };
            return new Response(JSON.stringify(data), { status: 200 });
        }) as any;
        return bodies;
    };
    const client = new SheetsClient(async () => 'tok');

    it('sends insertComment on the named tab coordinate', async () => {
        const bodies = stub({ commentUpdateState: 'ALL_SAVED', replies: [{}] });
        const r = await client.insertCellComment({ spreadsheetId: 's', cell: 'Team!C5', content: 'look', assigneeEmailAddress: 'a@x.com' });
        expect(bodies[0]).toEqual({ requests: [{ insertComment: { content: 'look', coordinate: { sheetId: 77, rowIndex: 4, columnIndex: 2 }, assigneeEmailAddress: 'a@x.com' } }] });
        expect(r.coordinate.sheetId).toBe(77);
    });
    it('throws when Google did not save the comment (200 but ALL_FAILED)', async () => {
        stub({ commentUpdateState: 'ALL_FAILED_UNKNOWN_REASON' });
        await expect(client.insertCellComment({ spreadsheetId: 's', cell: 'A1', content: 'x' })).rejects.toThrow('ALL_FAILED_UNKNOWN_REASON');
    });
});
