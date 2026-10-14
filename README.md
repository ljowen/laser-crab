# Time for Crab!

Workflow to block PRs containing attributions to corporate LLM's. 
These models never attribute their sources so why should corporations get free advertising?

## Install

Copy `.github/` into the repository you want policed:

```sh
cp -r .github /path/to/your/repo/
```

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

Edit `PATTERNS` in `.github/scripts/check-attribution.mjs` to adjust the list.

## [See it in action](https://github.com/ljowen/laser-crab/pull/2)



## Fixing a flagged PR
```sh
git rebase -i origin/main      # reword
git push --force-with-lease
```
