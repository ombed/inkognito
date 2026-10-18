# Benchmark results

43 documents, 335 keyed entities: 272 identifying details the tool must replace, and 63 traps and public bodies it must leave alone. Model on (q8, same artifact as the browser). Generated 2026-10-18.

## Per category

| category | found | missed | leaked | false positives |
|---|---|---|---|---|
| person: Arabic name | 10 | 0 | 0 | 0 |
| person: name that is also a common word (lexicon-aided) | 7 | 0 | 0 | 0 |
| person: title attached | 8 | 0 | 0 | 0 |
| person: same person, one clean and one corrupted spelling | 12 | 0 | 0 | 0 |
| person: name split across two runs mid-word | 3 | 0 | 0 | 0 |
| org: private body, must be redacted | 10 | 0 | 1 | 0 |
| place: town (lexicon-aided) | 12 | 1 | 0 | 0 |
| trap: section references and other numbers that identify no one | – | – | – | 0 |
| pii: full date (omitted by default) | 18 | 0 | 0 | 0 |
| trap: idiom or public title beside a same-word name | – | – | – | 1 |
| person: full name, surname alone, first name alone | 9 | 0 | 0 | 0 |
| person: only in prose, never before a speech verb | 7 | 0 | 0 | 0 |
| person: Ethiopian name | 8 | 0 | 0 | 0 |
| person: role word directly before, no colon | 6 | 0 | 0 | 0 |
| org: body whose name reads like a person's | 3 | 0 | 0 | 0 |
| place: neighbourhood | 6 | 0 | 0 | 0 |
| person: two people sharing a surname | 10 | 0 | 0 | 0 |
| person: Russian name | 8 | 0 | 0 | 0 |
| person: nikud on one occurrence | 3 | 0 | 0 | 0 |
| person: once, only with a prefix letter (expected to fail) | 3 | 0 | 0 | 0 |
| person: name that reads like a body's | 3 | 0 | 0 | 0 |
| org: public body, must not be redacted | – | – | – | 0 |
| person: two people edit-distance 1 apart (must not merge) | 6 | 0 | 0 | 0 |
| person: only in corrupted form, never cleanly (expected to fail) | 4 | 0 | 0 | 0 |
| person: hyphenated surname, elsewhere with a space | 5 | 0 | 0 | 0 |
| person: minor, first name only | 10 | 0 | 0 | 0 |
| place: street | 8 | 0 | 0 | 0 |
| trap: פלוני / פלונית | – | – | – | 0 |
| pii: court or registry case number (deleted by default) | 4 | 0 | 0 | 0 |
| person: two-letter surname | 5 | 0 | 0 | 0 |
| person: minor introduced by הקטין / הקטינה | 7 | 0 | 0 | 0 |
| pii: ID number | 10 | 0 | 0 | 0 |
| pii: mobile phone | 10 | 0 | 0 | 0 |
| pii: date of birth | 6 | 0 | 0 | 0 |
| pii: email address | 6 | 0 | 0 | 0 |
| pii: bank account | 5 | 0 | 0 | 0 |
| pii: licence plate | 4 | 0 | 0 | 0 |
| person: party by role word and colon, first name only | 6 | 0 | 0 | 0 |
| person: name right after a discourse word (כאמור, משכך, לדבריה) | 3 | 0 | 0 | 0 |
| trap: form label with a colon (not a speaker) | – | – | – | 0 |
| trap: word ending in ת before a word starting with ז (not ת"ז) | – | – | – | 0 |
| trap: הח"מ before a verb (not a name) | – | – | – | 0 |
| trap: role word in any spelling (אפוטרופא, אפוטרופוס) | – | – | – | 0 |
| trap: ordinary word that is also a locality name (קדימה, לשם, גבעות) | – | – | – | 2 |
| person: speaker written on a line of its own (no colon) | 5 | 0 | 0 | 0 |
| person: foreign first name only after a care or teaching role word, in child speech | 3 | 0 | 0 | 0 |
| person: everyday word as a first name, before a speech verb (lexicon-aided by design) (lexicon-aided) | 3 | 0 | 0 | 0 |
| channel: person only in the page header | 3 | 0 | 0 | 0 |
| channel: person only in a footnote | 3 | 0 | 0 | 0 |
| channel: person only in a picture's alt text | 2 | 1 | 1 | 0 |
| channel: person only in a comment and as its author (removed by design) | 3 | 0 | 0 | 0 |
| channel: person only in the file's properties (emptied by design) | 3 | 0 | 0 | 0 |

## Per genre

| genre | found | missed | leaked | false positives |
|---|---|---|---|---|
| meeting | 27 | 0 | 0 | 0 |
| filing | 41 | 0 | 0 | 1 |
| transcript | 33 | 0 | 0 | 0 |
| welfare | 27 | 0 | 0 | 0 |
| medical | 19 | 0 | 0 | 0 |
| police | 24 | 1 | 0 | 0 |
| bank | 18 | 0 | 1 | 0 |
| chat | 23 | 0 | 0 | 0 |
| position | 13 | 0 | 0 | 2 |
| audio | 20 | 0 | 0 | 0 |
| interview | 11 | 0 | 0 | 0 |
| structure | 14 | 1 | 1 | 0 |

## Unlisted suggestions (match nothing in the key; one tap each) — 30 in total

Counted, not optimised for: the list is read, accept-all is not how the tool is used.

- **meeting** (2, 1 applied): בקבוצה [discover; מופיע אחרי מילת תפקיד טיפולית או חינוכית] **applied** · גן [model+flagged]
- **filing** (6, 6 applied): נישאו [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · ירושלים [model] **applied** · ומצא סימני [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · תצהיר [discover; פסקה שכולה שם, ואחריה דיבור] **applied** · תצהירי [near+flagged] **applied** · עלי [flagged] **applied**
- **transcript** (3, 3 applied): במרפאת עין [suggest] **applied** · הראשון [discover; מופיע אחרי תואר] **applied** · יו"ר [discover; פותח תור דיבור בתמלול] **applied**
- **welfare** (1, 1 applied): לסדרי [discover; מופיע אחרי מילת תפקיד טיפולית או חינוכית] **applied**
- **medical** (5, 5 applied): המטופלת [discover; פותח תור דיבור בתמלול] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied** · מחלקת [model] **applied** · הנבדק [discover; פותח תור דיבור בתמלול] **applied** · חתימה [discover; פותח תור דיבור בתמלול] **applied**
- **police** (2, 2 applied): המתלוננת [discover; פותח תור דיבור בתמלול] **applied** · תחנת גבעת [model] **applied**
- **bank** (2, 2 applied): החשבון [discover; פותח תור דיבור בתמלול] **applied** · יתרה לסוף התקופה [discover; פותח תור דיבור בתמלול] **applied**
- **chat** (1, 1 applied): בגן [discover; מופיע אחרי מילת תפקיד טיפולית או חינוכית] **applied**
- **position** (1, 1 applied): הבהרה [discover; פותח תור דיבור בתמלול] **applied**
- **audio** (1, 1 applied): ושניהם [suggest] **applied**
- **structure** (6, 6 applied): תסקיר שהוגש [discover; מופיע אחרי תפקיד ונקודתיים] **applied** · מתגורר [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · תסקיר שהוגש [discover; מופיע אחרי תפקיד ונקודתיים] **applied** · מתגורר [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied** · תסקיר שהוגש [discover; מופיע אחרי תפקיד ונקודתיים] **applied** · מתגורר [discover; מופיע אחרי מילת תפקיד בגוף הטקסט] **applied**

## Missed and leaked, by document

- p2 · place: town · גבעת עדה: missed
- b2 · org: private body, must be redacted · חברת קו הזהב הובלות: found via model+applied as «קו הזהב הובלות», **leaked**: קו הזהב
- s1 · channel: person only in a picture's alt text · שולמית אוזרבך: missed, **leaked**: שולמית אוזרבך

## Traps and public bodies touched

- f2 · trap: idiom or public title beside a same-word name · בגיל 8: altered: עם שחר
- x1 · trap: ordinary word that is also a locality name (קדימה, לשם, גבעות) · לשם: suggested as «קדימה [flagged]»; altered: קדימה
- x2 · trap: ordinary word that is also a locality name (קדימה, לשם, גבעות) · אורה: suggested as «עלי [flagged]»; altered: עלי

## Timing

| doc | genre | ms | rules confirmed | unlisted |
|---|---|---|---|---|
| m1 | meeting | 204 | 9 | 1 |
| m2 | meeting | 104 | 11 | 1 |
| m3 | meeting | 65 | 6 | 0 |
| m4 | meeting | 107 | 8 | 0 |
| f1 | filing | 131 | 14 | 2 |
| f2 | filing | 130 | 13 | 1 |
| f3 | filing | 102 | 8 | 0 |
| f4 | filing | 112 | 11 | 3 |
| t1 | transcript | 89 | 7 | 0 |
| t2 | transcript | 90 | 13 | 1 |
| t3 | transcript | 102 | 11 | 1 |
| t4 | transcript | 91 | 11 | 1 |
| w1 | welfare | 64 | 4 | 0 |
| w2 | welfare | 64 | 5 | 0 |
| w3 | welfare | 74 | 5 | 0 |
| w4 | welfare | 75 | 5 | 1 |
| h1 | medical | 77 | 6 | 2 |
| h2 | medical | 68 | 5 | 1 |
| h3 | medical | 80 | 6 | 2 |
| p1 | police | 68 | 4 | 0 |
| p2 | police | 64 | 4 | 2 |
| p3 | police | 75 | 2 | 0 |
| p4 | police | 61 | 3 | 0 |
| b1 | bank | 64 | 5 | 2 |
| b2 | bank | 42 | 2 | 0 |
| b3 | bank | 51 | 2 | 0 |
| c1 | chat | 57 | 4 | 0 |
| c2 | chat | 66 | 5 | 1 |
| c3 | chat | 66 | 2 | 0 |
| c4 | chat | 66 | 4 | 0 |
| x1 | position | 103 | 7 | 1 |
| x2 | position | 73 | 5 | 0 |
| x3 | position | 72 | 5 | 0 |
| a1 | audio | 80 | 7 | 0 |
| a2 | audio | 75 | 7 | 0 |
| a3 | audio | 66 | 7 | 1 |
| a4 | audio | 59 | 6 | 0 |
| v1 | interview | 82 | 3 | 0 |
| v2 | interview | 76 | 5 | 0 |
| v3 | interview | 61 | 3 | 0 |
| s1 | structure | 86 | 4 | 2 |
| s2 | structure | 87 | 5 | 2 |
| s3 | structure | 92 | 5 | 2 |
