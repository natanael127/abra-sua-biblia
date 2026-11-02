/** Parameters extracted from the path; missing optional ones are undefined. */
export type PathParams = Record<string, string | undefined>;

/** Pattern segment: literal ("planos"), parameter (":bible") or optional parameter (":book?"). */
interface Segment {
    name: string;
    param: boolean;
    optional: boolean;
}

const splitPath = (path: string): string[] => path.split('/').filter((segment) => segment !== '');

function compile(pattern: string): Segment[] {
    const segments = splitPath(pattern).map((segment) => {
        const param = segment.startsWith(':');
        const optional = param && segment.endsWith('?');
        return { name: param ? segment.slice(1, optional ? -1 : undefined) : segment, param, optional };
    });
    const firstOptional = segments.findIndex((segment) => segment.optional);
    if (firstOptional !== -1 && segments.slice(firstOptional).some((segment) => !segment.optional)) {
        throw new Error(`Invalid route pattern: "${pattern}" (optional segments only at the end)`);
    }
    return segments;
}

/**
 * Matches a path against a pattern such as "/:bible?/:book?/:passage?".
 * Literals are compared case-insensitively; parameters are returned already
 * decoded. Returns null if the path does not match.
 */
export function matchPath(pattern: string, path: string): PathParams | null {
    const segments = compile(pattern);
    const parts = splitPath(path);
    if (parts.length > segments.length) return null;

    const params: PathParams = {};
    for (const [i, segment] of segments.entries()) {
        const part = parts[i];
        if (part === undefined) {
            if (!segment.optional) return null;
            continue;
        }

        let value: string;
        try {
            value = decodeURIComponent(part);
        } catch {
            return null;
        }

        if (segment.param) {
            params[segment.name] = value;
        } else if (value.toLowerCase() !== segment.name.toLowerCase()) {
            return null;
        }
    }
    return params;
}

/** Encodes a path segment, keeping the safe characters of Bible notation readable. */
export function encodePathSegment(value: string): string {
    return encodeURIComponent(value).replace(/%2C/gi, ',');
}

/** Builds a path from segments; empty or missing ones are omitted. */
export function buildPath(...segments: (string | undefined)[]): string {
    return `/${segments
        .filter((segment): segment is string => !!segment)
        .map(encodePathSegment)
        .join('/')}`;
}
