#!/usr/bin/env node
// Flags pull-request commits that carry AI-assistant attribution, then posts
// (or updates) a single nag comment on the PR. Exits 1 while any commit is
// still attributed, so the check stays red until history is rewritten.
//
// Dependency-free: Node 20+ on the runner provides fetch.

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.GITHUB_REPOSITORY;
const PR = process.env.PR_NUMBER;
const MEME_URL = process.env.MEME_URL;

const MARKER = "<!-- ai-attribution-check -->";
const TASK_TEXT = "Remove corporate attribution";

// Each pattern is tested only against commit identity fields and trailer-ish
// lines -- never the whole message body -- so a commit that merely *mentions*
// Claude or Copilot in prose does not trip the check.
const PATTERNS = [
  { vendor: "Anthropic", re: /\bclaude\b/i },
  { vendor: "Anthropic", re: /anthropic\.com/i },
  { vendor: "OpenAI", re: /\bcodex\b|\bchatgpt\b|openai\.com/i },
  { vendor: "GitHub Copilot", re: /\bcopilot\b/i },
  { vendor: "Google", re: /\bgemini\b|\bjules\b|google-labs/i },
  { vendor: "Cursor", re: /\bcursor\b/i },
  { vendor: "Cognition", re: /\bdevin\b|cognition\.ai/i },
  { vendor: "Aider", re: /\baider\b/i },
  { vendor: "Codeium", re: /\bwindsurf\b|codeium/i },
];

// Lines worth inspecting inside a commit message.
const TRAILER = /^\s*(?:co-authored-by|signed-off-by|assisted-by|authored-by|on-behalf-of|generated[- ]with)\s*:/i;
const GENERATED = /generated with/i;

async function api(path, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${TOKEN}`,
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

async function paginate(path, maxPages = 10) {
  const sep = path.includes("?") ? "&" : "?";
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = await api(`${path}${sep}per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

// Pull out the only lines we are willing to judge a commit on.
function suspectLines(commit) {
  const { author, committer, message } = commit.commit;
  const lines = [];
  if (author) lines.push(`author: ${author.name} <${author.email}>`);
  if (committer && (committer.name !== author?.name || committer.email !== author?.email)) {
    lines.push(`committer: ${committer.name} <${committer.email}>`);
  }
  for (const raw of (message ?? "").split("\n")) {
    const line = raw.trim();
    if (line && (TRAILER.test(line) || GENERATED.test(line))) lines.push(line);
  }
  return lines;
}

function inspect(commit) {
  const vendors = new Set();
  const evidence = new Set();
  for (const line of suspectLines(commit)) {
    for (const { vendor, re } of PATTERNS) {
      if (re.test(line)) {
        vendors.add(vendor);
        evidence.add(line);
      }
    }
  }
  if (!vendors.size) return null;
  return {
    sha: commit.sha.slice(0, 7),
    subject: (commit.commit.message ?? "").split("\n")[0].slice(0, 72),
    vendors: [...vendors],
    evidence: [...evidence],
  };
}

function buildBody(offenders, previousBody) {
  if (!offenders.length) {
    return `${MARKER}\n✅ No AI attribution left on this PR's commits. Carry on.`;
  }

  // Never silently untick a box the author already ticked.
  const alreadyChecked = /- \[[xX]\] *Remove corporate attribution/.test(previousBody ?? "");
  const task = `- [${alreadyChecked ? "x" : " "}] ${TASK_TEXT}`;

  const noun = offenders.length === 1 ? "commit carries" : "commits carry";
  const rows = offenders
    .map((o) => `- \`${o.sha}\` ${o.subject} — **${o.vendors.join(", ")}**\n  > ${o.evidence.join("\n  > ")}`)
    .join("\n");

  return [
    MARKER,
    `![](${MEME_URL})`,
    "",
    `**${offenders.length} ${noun} AI attribution:**`,
    "",
    rows,
    "",
    task,
    "",
    "<sub>Amend the offending commits (`git rebase -i` / `git commit --amend --no-edit --reset-author`) and force-push. This check re-runs on every push.</sub>",
  ].join("\n");
}

async function findExistingComment() {
  const comments = await paginate(`/repos/${REPO}/issues/${PR}/comments`);
  return comments.find((c) => (c.body ?? "").includes(MARKER)) ?? null;
}

async function main() {
  for (const [key, value] of Object.entries({ GITHUB_TOKEN: TOKEN, GITHUB_REPOSITORY: REPO, PR_NUMBER: PR })) {
    if (!value) throw new Error(`Missing required env var ${key}`);
  }

  const commits = await paginate(`/repos/${REPO}/pulls/${PR}/commits`, 3);
  if (commits.length === 250) {
    console.log("::warning::PR has 250+ commits; GitHub caps this endpoint at 250 so older commits were not inspected.");
  }

  const offenders = commits.map(inspect).filter(Boolean);
  const existing = await findExistingComment();

  if (!offenders.length && !existing) {
    console.log(`Clean: ${commits.length} commit(s), no AI attribution.`);
    return 0;
  }

  const body = buildBody(offenders, existing?.body);
  if (existing) {
    if (existing.body.trim() !== body.trim()) {
      await api(`/repos/${REPO}/issues/comments/${existing.id}`, { method: "PATCH", body: JSON.stringify({ body }) });
      console.log(`Updated comment ${existing.id}.`);
    } else {
      console.log(`Comment ${existing.id} already up to date.`);
    }
  } else {
    await api(`/repos/${REPO}/issues/${PR}/comments`, { method: "POST", body: JSON.stringify({ body }) });
    console.log("Posted comment.");
  }

  const summary = offenders.length
    ? [
        "## 🤖 AI attribution detected",
        "",
        "| Commit | Subject | Vendor |",
        "| --- | --- | --- |",
        ...offenders.map((o) => `| \`${o.sha}\` | ${o.subject.replace(/\|/g, "\\|")} | ${o.vendors.join(", ")} |`),
      ].join("\n")
    : "## ✅ No AI attribution\n\nAll commits are clean.";
  if (process.env.GITHUB_STEP_SUMMARY) {
    await (await import("node:fs/promises")).appendFile(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }

  for (const o of offenders) {
    console.log(`::error title=AI attribution on ${o.sha}::${o.vendors.join(", ")} — ${o.evidence[0]}`);
  }

  return offenders.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.log(`::error::${err.message}`);
    process.exit(1);
  },
);
