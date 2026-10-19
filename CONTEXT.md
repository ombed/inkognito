# The words of InKognito

What each word means in this project, and where it lives in the code. The map of how the parts fit is
[ARCHITECTURE.md](ARCHITECTURE.md).

## The document

- **Document.** Whatever the lawyer brings: a Word file, a PDF or pasted text. Every one becomes a Word file
  first (`pdf-text.js` takes a PDF's text, `text-to-docx.js` builds the Word file), so one engine handles all.
- **Part.** A file inside the Word file, which is a ZIP: the body (`word/document.xml`), headers and footers,
  notes, comments, the properties (`docProps/`), pictures (`word/media/`), and the relationships (`_rels`),
  which hold the targets of links.
- **Block.** A piece of a part's text, about a paragraph, with the places in the XML it came from, so a
  change to the text can be written back (`flatten`, `engine/08-01-word-text.js`). `readBlocks` gives the
  blocks of a whole file (`engine/08-03-parts.js`).

## Finding

- **Finding.** A stretch of text that may identify someone, with its kind (`Engine.detect`,
  `engine/07-engine.js`).
- **Kind.** What a finding is: a person's name, a body, a place, an ID number, a phone, an address, a date
  and the rest (`KINDS`, `engine/07-engine.js`).
- **Pattern.** A rule that finds a kind of number or detail by its shape (`PAT`, `engine/06-detect-2-patterns.js`). An
  "on" pattern replaces what it finds; a "flag" pattern only marks it for the person.
- **The model.** A Hebrew name-recognition model (DictaBERT-parse's NER head) that runs in the browser
  (`engine/08-10-model-runtime.js`); what it says is cleaned before it is used (`nerClean`,
  `engine/06-detect-1-model-output.js`).
- **Suggestion.** A candidate the tool offers for the list: from the rules (`discover`,
  `engine/08-09-discover.js`; `bodyNames`, `engine/05-bodynames.js`), the model, or a near miss.
- **Near miss.** A spelling of a listed name one letter off: a typo or a transcription slip (`findNear`,
  `engine/04-nearmiss.js`).
- **Citation.** A reference to another case («ע"א 1234/90 כהן נ' לוי»): kept as written, names and number
  included, since they are not of this case and the AI needs them; not this case's own, nor one that names
  someone of this case (`engine/07-cite.js`).

## Deciding

- **The list.** What the person decided to replace: each entry a value, its kind, and a replacement if one was
  typed. It is `subs` in `redactDocx`.
- **The allow list.** What the person decided to leave as it is (`allow` in `redactDocx`).
- **Case.** The list and the map of one client matter, saved in this browser under the account. **The last
  list** is the list of the last document, unnamed, kept 24 hours so a restore still works after a reload.

## Replacing

- **Invented name** (pseudonym). What replaces a real name: a name from the pools, of the real name's origin
  and gender where they can be told (`fakeName`, `engine/03-fakenames.js`). It is never a word of the document.
- **The names' key** (alias key). A secret kept in the browser for each account. Invented names come from it
  through HMAC-SHA-256, so one person keeps one invented name across a case, and no one without the key can
  work back from it (`setAliasKey`, `aliasSeed`, `engine/03-fakenames.js`).
- **Mode.** What takes a name's place: an invented name, a label, or a black box (`mode`: `"real"`,
  `"label"`, `"block"`).
- **Applied, flagged.** In `redactDocx`'s result: applied is what was replaced; flagged is what was found and
  left for the person (a pattern set to flag, an invented name that is also in the document, a shared name,
  a near miss).
- **The sweep.** After the list is applied, the pieces of a replaced name left on their own, such as a
  surname alone, are replaced too (`engine/08-06-redact-docx.js`).
- **The map.** Each real value and what replaced it, kept for the restore (the result's `map`).
- **Date shift.** The document's dates move by one offset, so the AI never sees a real date; the restore
  moves them back (`dateOff`; `backDates`, `engine/08-12-restore.js`).

## Checking

- **The final check** (`verify`, `engine/08-08-checks.js`). Reads the finished file with its own reader and
  looks for every value on the list in every part. Anything left turns the bar red.
- **The second scan** (`secondScan`, the same file). Reads the finished text for what the list missed:
  ID-like numbers, known first names, a listed name's word on its own. Anything found turns the bar amber.
- **The bar.** The status the person sees: green when the final check passed and nothing is open, amber when
  the second scan found something, red when the final check failed.

## Restoring

- **Restore.** Putting the real names back into the AI's answer, from the map, also in the forms an AI
  writes them in: with a prefix letter, the first or last name alone, a spelling one letter off, English
  letters (`restoreNames`, `engine/08-12-restore.js`).

## Proving a change safe

- **The benchmark.** 43 invented documents with a key of every detail in them (`bench/`), run by
  `npm run bench:nomodel` and, with the model, `npm run bench`.
- **The gate** (`bench/gate.js`). No detail of the benchmark may get worse than at the base commit.
- **The golden outputs** (`bench/golden/`). The redacted text of each benchmark document, line by line.
- **The result lock** (`bench/lock.js`). The engine at the base and the engine changed, on the same
  documents: every result and every byte of the output must be the same.
- **A mutant** (`scripts/mutants.js`). A pass of the engine deleted on purpose, with the suite that must
  notice; one that survives means a test stopped guarding it.
- **The complexity guard** (`scripts/complexity.js --check`). No function may get more complex.
- **A floor** (`tests/floors.json`). The fewest checks a suite may run, so a suite cannot shrink unseen.
