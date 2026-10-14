# laser-crab

A GitHub Actions workflow that notices when a commit credits an AI assistant as
an author, and asks — with a photograph — that you reconsider.

When a pull request contains commits attributed to Claude, Copilot, Codex,
Gemini, Cursor, Devin, Aider or Windsurf, the workflow posts a single comment
on the PR containing the meme and a task item:

> - [ ] Remove corporate attribution

The check fails while any attributed commit remains, so the PR carries a red ✗
until the history is rewritten.

## Install

Copy `.github/` into the repository you want policed:

```sh
cp -r .github /path/to/your/repo/
```

No dependencies, no marketplace actions, no secrets beyond the automatic
`GITHUB_TOKEN`. The script is plain Node and runs on the runner's built-in
`fetch`.

Because the workflow triggers on `pull_request_target`, GitHub runs the copy on
your **base branch** — so it takes effect only once merged, and edits to the
workflow itself won't apply until they land on the default branch.

## What counts as attribution

Each commit in the PR is checked against these patterns:

| Vendor | Matches |
| --- | --- |
| Anthropic | `claude`, `anthropic.com` |
| OpenAI | `codex`, `chatgpt`, `openai.com` |
| GitHub | `copilot` |
| Google | `gemini`, `jules`, `google-labs` |
| Cursor | `cursor` |
| Cognition | `devin`, `cognition.ai` |
| Aider | `aider` |
| Codeium | `windsurf`, `codeium` |

Patterns are tested **only** against the commit's author and committer
identity, and against trailer-shaped lines in the message — `Co-Authored-By:`,
`Signed-off-by:`, `Assisted-by:`, `Generated-with:`, and any line containing
"generated with". The prose body is never scanned, so a commit that merely
discusses Copilot doesn't trip the check. This repository's own initial commit
names six vendors in its body and passes.

Edit `PATTERNS` in `.github/scripts/check-attribution.mjs` to adjust the list.
`\bcursor\b` is the loosest entry and the first one to drop if it misfires.

## Behaviour

- **One comment per PR.** A hidden `<!-- ai-attribution-check -->` marker locates
  the existing comment and edits it in place rather than posting on every push.
- **The box stays ticked.** If you check `- [x] Remove corporate attribution`, a
  later run preserves it instead of silently reverting your work.
- **It clears itself.** Once the commits are clean, the comment is rewritten to a
  ✅ note rather than deleted, so the thread still makes sense to read.
- **Exit 1 on any match**, plus `::error::` annotations and a job-summary table.

## Fixing a flagged PR

Attribution lives in commit metadata, so it can't be removed by a follow-up
commit — the history has to be rewritten and force-pushed:

```sh
git rebase -i origin/main      # reword / drop the trailers
git push --force-with-lease
```

On a shared branch, agree that with whoever else is on it first.

## Changing the image

The image lives at `.github/assets/attribution.webp` and is served from this
repo's `main` branch via `raw.githubusercontent.com`. That URL is hardcoded in
the script — it deliberately points at **this** repo, not at whichever repo
the workflow is running in. Replacing the file on `main` updates the comment
everywhere the workflow is installed.

To use your own picture, set `MEME_URL` in the workflow; the hardcoded default
is only a fallback.

## Limitations

- GitHub's PR-commits API returns at most 250 commits. Beyond that, older
  commits go uninspected and the run logs a warning.
- Only commits belonging to the PR are checked — nothing already on the base
  branch is revisited.
- **The image URL must point at a public repo.** GitHub's image proxy fetches
  server-side and unauthenticated, so a `raw.githubusercontent.com` URL only
  renders if the repo hosting the *file* is public. The repo running the
  *workflow* can be private — that's why the default URL is pinned here rather
  than built from `github.repository`. If you fork this repo private and
  self-host the image, the comment will show a broken image.
