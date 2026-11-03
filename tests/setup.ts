// Tests that check Portuguese texts (the language of the Bible fixtures) run with the interface in Portuguese,
// whatever the language of the machine running them.
import { setUiLanguage } from '../src/i18n';

setUiLanguage('por', { persist: false });
