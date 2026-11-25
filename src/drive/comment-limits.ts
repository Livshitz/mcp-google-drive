/**
 * What a Drive API comment really became, read from Google's own response, plus the API route that
 * DOES anchor in that editor, so callers take it instead of driving the editor UI by browser.
 * Single source of this rule; descriptions/README/skills point here instead of restating it.
 * Sources: Drive manage-comments guide (Docs/Sheets/Slides treat Drive comments as unanchored);
 * Sheets guides/comments (spreadsheets.batchUpdate insertComment); Docs how-tos/suggestions
 * (documents.batchUpdate insertComment). `mentionedEmailAddresses` is output-only (Google's verdict).
 */
const EDITOR = /^application\/vnd\.google-apps\.(document|spreadsheet|presentation)$/;
// A mention starts the text or follows a char that cannot be in an email local part, so `a+b@c.com` is not `+b@c.com`.
const MENTION = /(?<![\w.+%-])[@+]([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;

/** Per editor: the anchored route. Docs: API route verified 2026-08-20 by the Circles agent identity, no tool here yet. Slides: not verified. */
const ANCHORED_ROUTE: Record<string, string> = {
    spreadsheet: 'To put it ON a cell use post_cell_comment (Sheets API insertComment, verified).',
    document: 'To anchor it to text, Google documents Docs API documents.batchUpdate insertComment {content, range:{startIndex,endIndex}, assigneeEmailAddress?} (route verified 2026-08-20 by the Circles agent identity; this MCP has no tool for it yet).',
    presentation: 'No anchored Slides comment route is verified here.',
};

export function describeCommentLimits(mimeType: string | undefined, content: string, comment: any) {
    const requested = [...content.matchAll(MENTION)].map((m) => m[1].toLowerCase());
    const mentioned: string[] = (comment?.mentionedEmailAddresses || []).map((e: string) => e.toLowerCase());
    const editor = EDITOR.exec(mimeType || '')?.[1];
    const missing = requested.filter((e) => !mentioned.includes(e));
    const notes = [
        editor && `Unanchored: the ${editor} editor ignores Drive API anchors, so this comment sits in the file comment list ("Original content deleted"), not on a cell/range. ${ANCHORED_ROUTE[editor]}`,
        missing.length && `Not registered as mentions by Google: ${missing.join(', ')}; no notification is guaranteed for them.`,
        'If no API route does what the user needs, report this and ask; never redo it through the editor UI/browser automation on a shared file.',
    ].filter(Boolean) as string[];
    return { mimeType, anchored: !editor && !!comment?.anchor, mentionsRequested: requested, mentionsRegistered: mentioned, notes };
}
