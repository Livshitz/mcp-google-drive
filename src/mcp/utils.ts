export const q = (v: any, fallback = ''): string => (Array.isArray(v) ? v[0] : v) ?? fallback;

export function required(value: string | undefined, name: string): string {
    if (!value) throw Object.assign(new Error(`${name} is required`), { status: 400 });
    return value;
}
