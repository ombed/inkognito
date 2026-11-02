# Releasing

How a change reaches users, and how often. The owner's rule (18.10.2026): **one release a week; the same
day only for a leak.**

## The rhythm

- Changes reach `main` through pull requests: fixes, features and refactors alike. `main` is not served,
  so a merged PR reaches no one by itself.
- Once a week, what `main` holds goes out as one release. `npm run bump <n>` makes a version (vNN) when
  users will see something new; `npm run bump fix` makes vNN.k when they will not, as after a week of
  refactors.
- A leak fix goes out the same day, on its own, after the same checks.

## Before a release

1. CI on `main` is green: the Node suites, Chrome, the type checks, the recall gate, the golden outputs,
   the complexity guard, the benchmark table, the result lock, the model-on benchmark, the blind test and
   the figures README quotes.
2. Locally, WebKit and Firefox: `npm run test:browsers -- --workers=1`, alone on the machine.
3. `main` is merged into `inkognito`; its Node suites and its Chrome suite pass there.

## The release

1. `npm run build:hosted` on `inkognito`, then the deploy to Cloudflare Pages
   (`npx --yes wrangler@4.147.0 pages deploy dist --project-name=inkognito --branch=main`).
2. The live site is probed: the sign-in gate, the security headers, nothing injected, and the demo serves
   the new version.
3. The deployed commit is tagged `ink/vNN` (or `ink/vNN.k`) on `inkognito`, and the tag gets a GitHub
   Release with the notes from `CHANGELOG.md`.

Rolling back: [ROLLBACK.md](ROLLBACK.md).

## What users read

- `CHANGELOG.md` has an entry for every version.
- The site's «מה חדש» page gets a line only for a change users can see. A release of refactors adds none.
