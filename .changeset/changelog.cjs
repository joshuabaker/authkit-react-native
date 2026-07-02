// Resilient changelog generator for Changesets.
//
// Delegates to @changesets/changelog-github, but retries its GitHub GraphQL
// call with exponential backoff to ride out transient failures (e.g. the
// intermittent "Failed to parse data from GitHub … Premature close" error).
// @changesets/get-github-info's DataLoader clears a failed batch's keys, so
// each retry genuinely re-fetches. If every attempt fails, the error is
// re-thrown so the release fails loudly rather than shipping a degraded
// changelog — we don't want to silently drop the PR/author links.
//
// Tunable via env: CHANGELOG_MAX_ATTEMPTS, CHANGELOG_RETRY_BASE_MS,
// CHANGELOG_RETRY_MAX_MS.

const changelogGithub = require("@changesets/changelog-github");

const github = changelogGithub.default || changelogGithub;

const MAX_ATTEMPTS = Math.max(
  1,
  Number(process.env.CHANGELOG_MAX_ATTEMPTS) || 5,
);
const BASE_DELAY_MS = Math.max(
  0,
  Number(process.env.CHANGELOG_RETRY_BASE_MS) || 2000,
);
const MAX_DELAY_MS = Math.max(
  BASE_DELAY_MS,
  Number(process.env.CHANGELOG_RETRY_MAX_MS) || 16000,
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const firstLineOf = (error) =>
  error && error.message ? String(error.message).split("\n")[0] : String(error);

async function withRetry(label, run) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) break;
      const delay = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
      console.error(
        `[changelog] ${label} failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${firstLineOf(
          error,
        )} — retrying in ${delay}ms`,
      );
      await sleep(delay);
    }
  }
  const summary = `[changelog] ${label} failed after ${MAX_ATTEMPTS} attempts (GitHub API unreachable?): ${firstLineOf(
    lastError,
  )}`;
  if (process.env.GITHUB_ACTIONS) {
    console.error(`::error::${summary}`);
  }
  throw lastError instanceof Error ? lastError : new Error(summary);
}

module.exports = {
  getReleaseLine(changeset, type, changelogOpts) {
    return withRetry("getReleaseLine", () =>
      github.getReleaseLine(changeset, type, changelogOpts),
    );
  },
  getDependencyReleaseLine(changesets, dependenciesUpdated, changelogOpts) {
    return withRetry("getDependencyReleaseLine", () =>
      github.getDependencyReleaseLine(
        changesets,
        dependenciesUpdated,
        changelogOpts,
      ),
    );
  },
};
