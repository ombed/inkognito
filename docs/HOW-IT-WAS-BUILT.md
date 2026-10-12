# How InKognito is built

InKognito is built by one person working with an AI coding agent, Claude Code. The agent writes the code and the tests.
The owner decides what to build, reviews every change, uses the tool the way a lawyer would, and catches what the
agent and the tests miss. This page describes how that works, and points to the evidence in this repository.

## Who does what

- **The owner** sets the goal and the quality bar, makes every product decision (recorded with its reasons: the
  changelog, [docs/PLAN-v18.md](PLAN-v18.md), [docs/model-eval/PLAN.md](model-eval/PLAN.md)), approves every word a
  user sees, tests each release live on the site, on a phone and in other browsers, and commissions outside reviews.
- **The agent** reproduces problems, writes the fixes and the tests, builds the measurement tools, and runs the release
  checks. It proposes; it does not decide product behaviour, user-facing wording or legal claims.

## How a change gets in

1. **Reproduce first.** A problem becomes a failing test or a measured case before anything is fixed.
2. **Fix the class, not the instance.** "This date was missed" becomes "a value in another written form is missed",
   and the test covers the forms, not the one example.
3. **Every new test must fail on the code before the fix.** A test that would have passed anyway proves nothing.
4. **Gates that cannot be talked past:**
   - unit suites, about 7,700 checks, each suite's size pinned from below so none can quietly shrink
     ([tests/floors.json](../tests/floors.json));
   - browser tests in Chrome, WebKit and Firefox, about 340 in each browser;
   - a benchmark of 43 invented documents with 335 keyed details and traps that must survive; a pull request that makes
     any single entity worse fails ([bench/gate.js](../bench/gate.js));
   - the output itself: every engine change shows, line by line, what the tool now writes ([bench/golden.js](../bench/golden.js));
   - the published figures: README's numbers are re-measured on every change ([bench/protocol-claims.js](../bench/protocol-claims.js)).
5. **Live check.** The owner checks the newest change on the live site, end to end, in a fresh browser.

## What the owner catches that the agent and the tests miss

Between 4 September and 11 October 2026 the owner recorded 198 distinct catches: bugs, gaps and wrong plans that had
got past the agent and its tests. Two of them:

- On 6 October, right after the agent reported a release as live and fully verified, the owner used it the way a new
  user would and listed a run of basic gaps a real product would not have. They became a 41-decision review.
- On 9 October, the home page's own example showed a date the tool had not replaced. The fix covered dates in every
  usual spelling, not just that one (v73).

The catches were distilled into 17 "lenses", ways of looking that the agent now runs before it calls a change done. A
few of them:

- **Every written form.** A value missed because it was written differently: a date in words, a number with other
  separators, a name that appears only misspelled. This class came back every week or two until the tests started
  generating the forms instead of listing examples.
- **The second time through.** Back, reload, the next client in the same tab. Nothing of client A may reach client B,
  and the browser tests walk those paths ([e2e/restore.spec.js](../e2e/restore.spec.js), "the next document … finds
  nothing of the last one").
- **Ground truth before claims.** Every public number is re-measured before it is quoted, and every "all clear" has a
  test that fails if it is false.
- **Through the user's eyes.** Small screens, phones, Safari and Firefox: the first cross-browser run found three bugs
  that Chrome hid.
- **Counterexample first.** Any rule that merges, folds or filters is tried first on the cases that would break it.

## Outside reviews

- [docs/review/](review/): independent QA, UX and code reviews, every finding triaged.
- [docs/model-eval/](model-eval/README.md): the language model was chosen by a decision rule written before any run,
  with held-out public sets and confidence intervals; the evaluation found two real bugs on the way.
- October 2026: an outside review and an engineering audit. Every claim was checked against the code; the real bugs were
  reproduced and fixed with tests that fail on the old code, and the design questions went to the owner, one at a time.

## What the agent got wrong

Saying so is part of the method:

- An arithmetic bug in the invented-name picker (a stride of 7 over a list of 28 reached only 4 names) passed
  thousands of example-based checks. An outside audit found it; the fix added checks of properties that must always
  hold (every name can be reached, no two people share an invented name).
- A fix that quietly merged two spellings of a name was reverted the same day: it broke an earlier owner decision that
  merges are always offered, never silent.
- Tests that passed by accident (a tap above the window, a fixed delay) led to a standing rule: break the line a test
  protects and watch it fail.

## In numbers (12 October 2026)

537 commits and 106 merged pull requests since 3 September 2026; 78 releases in the
[changelog](../CHANGELOG.md) (Hebrew). Built for a real client, a lawyer.
