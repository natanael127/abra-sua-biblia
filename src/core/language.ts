/**
 * Normalização de códigos de idioma para ISO 639-3, exigido pelo campo
 * bible.language do EBF1 (três letras minúsculas, ex.: "por").
 *
 * Mesmas regras de converters/language.py do easy-bible-format; as tabelas
 * foram geradas dos arquivos iso_639-3.json e iso_639-2.json do pacote
 * iso-codes (Debian, versão 4.9.0).
 */

export const UNDETERMINED_LANGUAGE = 'und';

/** ISO 639-1 (duas letras) -> ISO 639-3 */
const ISO_639_1_TO_3: Readonly<Record<string, string>> = {
    aa: 'aar', ab: 'abk', ae: 'ave', af: 'afr', ak: 'aka', am: 'amh', an: 'arg', ar: 'ara',
    as: 'asm', av: 'ava', ay: 'aym', az: 'aze', ba: 'bak', be: 'bel', bg: 'bul', bi: 'bis',
    bm: 'bam', bn: 'ben', bo: 'bod', br: 'bre', bs: 'bos', ca: 'cat', ce: 'che', ch: 'cha',
    co: 'cos', cr: 'cre', cs: 'ces', cu: 'chu', cv: 'chv', cy: 'cym', da: 'dan', de: 'deu',
    dv: 'div', dz: 'dzo', ee: 'ewe', el: 'ell', en: 'eng', eo: 'epo', es: 'spa', et: 'est',
    eu: 'eus', fa: 'fas', ff: 'ful', fi: 'fin', fj: 'fij', fo: 'fao', fr: 'fra', fy: 'fry',
    ga: 'gle', gd: 'gla', gl: 'glg', gn: 'grn', gu: 'guj', gv: 'glv', ha: 'hau', he: 'heb',
    hi: 'hin', ho: 'hmo', hr: 'hrv', ht: 'hat', hu: 'hun', hy: 'hye', hz: 'her', ia: 'ina',
    id: 'ind', ie: 'ile', ig: 'ibo', ii: 'iii', ik: 'ipk', io: 'ido', is: 'isl', it: 'ita',
    iu: 'iku', ja: 'jpn', jv: 'jav', ka: 'kat', kg: 'kon', ki: 'kik', kj: 'kua', kk: 'kaz',
    kl: 'kal', km: 'khm', kn: 'kan', ko: 'kor', kr: 'kau', ks: 'kas', ku: 'kur', kv: 'kom',
    kw: 'cor', ky: 'kir', la: 'lat', lb: 'ltz', lg: 'lug', li: 'lim', ln: 'lin', lo: 'lao',
    lt: 'lit', lu: 'lub', lv: 'lav', mg: 'mlg', mh: 'mah', mi: 'mri', mk: 'mkd', ml: 'mal',
    mn: 'mon', mr: 'mar', ms: 'msa', mt: 'mlt', my: 'mya', na: 'nau', nb: 'nob', nd: 'nde',
    ne: 'nep', ng: 'ndo', nl: 'nld', nn: 'nno', no: 'nor', nr: 'nbl', nv: 'nav', ny: 'nya',
    oc: 'oci', oj: 'oji', om: 'orm', or: 'ori', os: 'oss', pa: 'pan', pi: 'pli', pl: 'pol',
    ps: 'pus', pt: 'por', qu: 'que', rm: 'roh', rn: 'run', ro: 'ron', ru: 'rus', rw: 'kin',
    sa: 'san', sc: 'srd', sd: 'snd', se: 'sme', sg: 'sag', sh: 'hbs', si: 'sin', sk: 'slk',
    sl: 'slv', sm: 'smo', sn: 'sna', so: 'som', sq: 'sqi', sr: 'srp', ss: 'ssw', st: 'sot',
    su: 'sun', sv: 'swe', sw: 'swa', ta: 'tam', te: 'tel', tg: 'tgk', th: 'tha', ti: 'tir',
    tk: 'tuk', tl: 'tgl', tn: 'tsn', to: 'ton', tr: 'tur', ts: 'tso', tt: 'tat', tw: 'twi',
    ty: 'tah', ug: 'uig', uk: 'ukr', ur: 'urd', uz: 'uzb', ve: 'ven', vi: 'vie', vo: 'vol',
    wa: 'wln', wo: 'wol', xh: 'xho', yi: 'yid', yo: 'yor', za: 'zha', zh: 'zho', zu: 'zul',
};

/** Códigos bibliográficos do ISO 639-2 (639-2/B) -> ISO 639-3 */
const ISO_639_2B_TO_3: Readonly<Record<string, string>> = {
    alb: 'sqi', arm: 'hye', baq: 'eus', bur: 'mya', chi: 'zho', cze: 'ces', dut: 'nld', fre: 'fra',
    geo: 'kat', ger: 'deu', gre: 'ell', ice: 'isl', mac: 'mkd', mao: 'mri', may: 'msa', per: 'fas',
    rum: 'ron', slo: 'slk', tib: 'bod', wel: 'cym',
};

/**
 * Converte um código de idioma para ISO 639-3. Aceita ISO 639-1 ("pt"),
 * ISO 639-2/B ("ger"), ISO 639-3 ("por") e tags com região ("pt-BR", "pt_BR").
 * Retorna "und" (indeterminado) se não reconhecer.
 */
export function toIso6393(code: string | null | undefined): string {
    const language = (code ?? '').trim().toLowerCase().split(/[-_]/)[0] ?? '';
    if (language.length === 2) {
        return ISO_639_1_TO_3[language] ?? UNDETERMINED_LANGUAGE;
    }
    if (/^[a-z]{3}$/.test(language)) {
        return ISO_639_2B_TO_3[language] ?? language;
    }
    return UNDETERMINED_LANGUAGE;
}
