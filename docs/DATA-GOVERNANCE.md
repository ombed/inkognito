# Real documents and the coding agent

The tool runs in the browser and never sends a document anywhere. This page is about the other side: how real documents
are handled while the tool is being built, by its owner and by the AI coding agent that writes its code.

## What is never in this repository

- No real document, real name or detail of a real case: not in the code, the tests, the benchmark, a commit message or
  a pull request. Tests and the benchmark use invented documents, and one public document (a Knesset committee
  transcript, [tests/protocol.txt](../tests/protocol.txt)).
- Early commits described the first user's work in more detail than they should have. On 10 October 2026 the git history
  was rewritten to remove those passages. Pull request descriptions are kept by GitHub outside the git history, so the
  rewrite did not reach them: on 13 October 29 of them were found to hold the same passages and were edited with the
  same replacements, and GitHub was asked to purge its cached copies of the old commits and the descriptions' earlier
  versions.

## The private test set

- A few of the first user's documents are kept outside the repository, in a folder no script publishes. She chose
  them, went through them and replaced their identifying details herself before sending them, and agreed to this use.
- The benchmark can score them, and then prints counts only: how many details were found, missed or leaked, never a
  value.
- The coding agent reads them only with the owner's approval (given on 23 September 2026). Whatever the agent reads is
  sent to its provider's API, so a raw real document needs its owner's consent, or replacing its details on this
  computer first, before the agent may read it. Agents started for side tasks are told never to open the private folders.

## Before anything is published

- Every push is preceded by a scan of the change, its commit messages and any text written for the public, against the
  private set: counts only. Nothing of the private set may reach the public repository.
- Public text that makes a claim about the law waits for a lawyer's review.
