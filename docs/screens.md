# Screens and main menu

The site is a single page (SPA): the router (`src/router/`) shows the screen of the URL and hides
the others, without reloading the page. The main menu (☰, `src/ui/components/MainMenu.svelte`, a
popover drawer) leads to the Bible (the reader) and to the pages, each item with an emoji:
📖 Bible, ❓ Help (`/help`: what each button does, how to type a reference and how to install the
site as an app on Android and iOS), ℹ️ About (`/about`). The paths of the pages are in English, the same in every interface language.

From any page, going back always returns to the Bible (`src/screens/navigation.ts`): a page is
always one history entry above the reader. Opening a page from the reader creates an entry, opening
another page replaces it, and a page opened directly (link, new tab) gets the reader's last reading
(`/`) behind it. The Bible item of the menu, on a page, is the same as Back.
