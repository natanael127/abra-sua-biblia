/**
 * Flag of each interface language, from the flag-icons package (MIT). Languages
 * with no country of their own get the flag of the place most linked to them:
 * Latin the Vatican, classical Greek Greece. The Spanish flag is ours: the one in
 * the package carries the coat of arms and weighs 80 KB, too much for an icon.
 */
import bd from 'flag-icons/flags/4x3/bd.svg?url';
import br from 'flag-icons/flags/4x3/br.svg?url';
import cn from 'flag-icons/flags/4x3/cn.svg?url';
import de from 'flag-icons/flags/4x3/de.svg?url';
import fr from 'flag-icons/flags/4x3/fr.svg?url';
import gb from 'flag-icons/flags/4x3/gb.svg?url';
import gr from 'flag-icons/flags/4x3/gr.svg?url';
import id from 'flag-icons/flags/4x3/id.svg?url';
import il from 'flag-icons/flags/4x3/il.svg?url';
import it from 'flag-icons/flags/4x3/it.svg?url';
import jp from 'flag-icons/flags/4x3/jp.svg?url';
import pk from 'flag-icons/flags/4x3/pk.svg?url';
import ru from 'flag-icons/flags/4x3/ru.svg?url';
import sa from 'flag-icons/flags/4x3/sa.svg?url';
import va from 'flag-icons/flags/4x3/va.svg?url';
import hi from 'flag-icons/flags/4x3/in.svg?url';
import es from './flags/es.svg?url';

/** Flag image by ISO 639-3 code of the interface language. */
export const FLAG_URLS: Readonly<Record<string, string>> = {
    eng: gb,
    zho: cn,
    hin: hi,
    spa: es,
    arb: sa,
    fra: fr,
    ben: bd,
    por: br,
    ind: id,
    urd: pk,
    rus: ru,
    deu: de,
    jpn: jp,
    ita: it,
    lat: va,
    ell: gr,
    grc: gr,
    heb: il,
};
