// Resilient changelog generator for Changesets.
//
// Uses @changesets/changelog-github for rich entries (PR links + "Thanks
// @author"), but if GitHub's GraphQL API fails during `changeset version`
// (e.g. the intermittent "Premature close" error), it falls back to a plain
// entry built from the changeset summary — so a GitHub API hiccup degrades a
// changelog line instead of failing the whole release.

const changelogGithub = require("@changesets/changelog-github");

const github = changelogGithub.default || changelogGithub;

function plainReleaseLine(changeset) {
  const [firstLine, ...rest] = changeset.summary
    .split("\n")
    .map((line) => line.trimEnd());
  let line = `\n- ${firstLine}`;
  const continuation = rest.filter(Boolean);
  if (continuation.length > 0) {
    line += `\n${continuation.map((l) => `  ${l}`).join("\n")}`;
  }
  return line;
}

module.exports = {
  async getReleaseLine(changeset, type, changelogOpts) {
    try {
      return await github.getReleaseLine(changeset, type, changelogOpts);
    } catch (err) {
      console.error(
        `[changelog] @changesets/changelog-github failed (${
          err && err.message
        }); falling back to a plain changelog entry.`,
      );
      return plainReleaseLine(changeset);
    }
  },
  async getDependencyReleaseLine(
    changesets,
    dependenciesUpdated,
    changelogOpts,
  ) {
    try {
      return await github.getDependencyReleaseLine(
        changesets,
        dependenciesUpdated,
        changelogOpts,
      );
    } catch (err) {
      console.error(
        `[changelog] @changesets/changelog-github dependency line failed (${
          err && err.message
        }); omitting dependency details.`,
      );
      return "";
    }
  },
};
