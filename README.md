# Time for Crab!

Workflow to block PRs containing attributions to corporate LLM's. 
These models never attribute their sources so why should corporations get free advertising?

## Install

Add one workflow file. No checkout step, no dependencies, no secrets.

```yaml
# .github/workflows/ai-attribution.yml
name: AI attribution check

on:
  pull_request_target:
    types: [opened, synchronize, reopened]

permissions:
  pull-requests: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: ljowen/laser-crab@v1
```

`pull_request_target`, not `pull_request` — otherwise fork PRs get a read-only
token and the comment never posts.

Options: `fail-on-match: false` to nag without blocking, `meme-url` for your
own picture. The step outputs `count`.

Prefer to call the whole job? `uses: ljowen/laser-crab/.github/workflows/laser-crab.yml@v1`

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
"generated with". 

Edit `PATTERNS` in `src/check-attribution.mjs` to adjust the list.

## [See it in action](https://github.com/ljowen/laser-crab/pull/2)



## Fixing a flagged PR
```sh
git rebase -i origin/main      # reword
git push --force-with-lease
```
