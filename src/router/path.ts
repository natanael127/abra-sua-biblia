/** Parâmetros extraídos do caminho; os opcionais ausentes ficam indefinidos. */
export type PathParams = Record<string, string | undefined>;

/** Segmento de padrão: literal ("planos"), parâmetro (":bible") ou parâmetro opcional (":book?"). */
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
        throw new Error(`Padrão de rota inválido: "${pattern}" (opcionais só no fim)`);
    }
    return segments;
}

/**
 * Compara um caminho com um padrão como "/:bible?/:book?/:passage?".
 * Literais são comparados sem diferenciar maiúsculas; os parâmetros são
 * devolvidos já decodificados. Retorna null se o caminho não corresponder.
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

/** Codifica um segmento do caminho, mantendo legíveis os caracteres seguros da notação bíblica. */
export function encodePathSegment(value: string): string {
    return encodeURIComponent(value).replace(/%2C/gi, ',');
}

/** Monta um caminho a partir de segmentos; os vazios ou ausentes são omitidos. */
export function buildPath(...segments: (string | undefined)[]): string {
    return `/${segments
        .filter((segment): segment is string => !!segment)
        .map(encodePathSegment)
        .join('/')}`;
}
