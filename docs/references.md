# Bible references and passages

A **Bible reference** is the address of a passage (book, chapter and verses: `Jo 3,16-18`); the
**passage** is the text it points to. The code keeps apart the two references involved in each
passage displayed, which can differ:

- **input reference**: what the user wrote, in the reference field or in a link, e.g.
  `joão 3, 18.16.17`. Its canonical form only swaps the book for the Bible's abbreviation
  (`Jo 3, 18.16.17`) and is what goes into the field and the search history. In the URL the book is
  its USFM id instead, in lowercase (`/por/ave-maria/jhn/3, 18.16.17`), the same in every
  translation; a book read from a URL is looked up by USFM id first, then by abbreviation or name,
  and the URL is corrected to the USFM id. The book is a single word: a book whose name has spaces
  (`1 Coríntios`) is written by its abbreviation (`1Cor`) or USFM id (`1CO`). Besides the comma
  notation (`Mt 5,3-12.21-38`, dots between the parts), the colon notation is accepted
  (`Mt 5:3-12,21-38`, commas between the parts), and ranges may use an en or em dash
  (`Mt 5,3–12`). The reference is parsed with regular expressions only; anything outside the format
  (`Jo 3,abc`, `Jo 3,16.`, `Jo 3:16.17`, numbers over 3 digits) is an invalid input reference, and
  the field turns red;
- **resulting reference**: the compacted reference of the verses actually displayed, e.g.
  `Jo 3,16-18`. It is shown after the passage (with the `()` option), in the page title and when
  sharing.

The help on how to type a reference (`src/screens/reader/instructions.ts`, shown on the Help
page and in place of the passage when the reference is invalid) writes its examples with the books of the
open Bible (`Mt 5,13` in one, `Мф 5,13` in another), so that every example works when typed.

The passage is built (`src/core/passage.ts`) from the input reference and the display options
into a structure independent of the output format, which carries the resulting reference and is
then rendered (`src/core/render.ts`) as HTML for reading and as plain text for copying. See
`src/core/reference.ts` for the details.

Verses and chapters can carry notes: a `comment` (verses and chapters) and cross-references
(`references`, verses only), both in EBF1, e.g. cross-references in the Almeida Revista e
Atualizada and comments in the Edição Pastoral. In the HTML (never in the copied text), a verse with
notes has a balloon between the verse number (if shown) and the text, and a chapter with a comment
has one before its heading (`[balloon] Levítico 1 (Edição Pastoral)`). Clicking it opens a modal
with the comment, if any, followed by the cross-references, with consecutive verses of the same
chapter grouped (`Mc 10,7-8`) and the text of each one; clicking a reference opens it. A book the
Bible lacks is listed by its USFM id and cannot be opened. See `src/core/cross-references.ts` and
`src/ui/dialogs/NotesModal.svelte`.
