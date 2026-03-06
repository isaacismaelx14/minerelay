import { execSync } from "node:child_process";

type RepoIdentity = {
  owner: string;
  repo: string;
  webUrl: string;
};

type CreateGithubReleaseInput = {
  owner: string;
  repo: string;
  tagName: string;
  name: string;
  body: string;
  token: string;
  prerelease?: boolean;
  draft?: boolean;
};

export function buildCreateGithubReleasePayload(
  input: CreateGithubReleaseInput,
) {
  return {
    tag_name: input.tagName,
    name: input.name,
    body: input.body,
    draft: Boolean(input.draft),
    prerelease: Boolean(input.prerelease),
  };
}

export function getGithubRepoFromGitRemote(): RepoIdentity {
  const remote = execSync("git remote get-url origin", {
    encoding: "utf8",
  }).trim();
  const parsed = parseGithubRemote(remote);
  if (!parsed) {
    throw new Error(
      `Could not parse GitHub owner/repo from origin remote: ${remote}`,
    );
  }
  return parsed;
}

export async function createGithubRelease(
  input: CreateGithubReleaseInput,
): Promise<{ htmlUrl: string }> {
  const response = await fetch(
    `https://api.github.com/repos/${input.owner}/${input.repo}/releases`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "mvl-semantic-release",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildCreateGithubReleasePayload(input)),
    },
  );

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      `Failed to create GitHub release (${response.status}): ${raw}`,
    );
  }

  const parsed = JSON.parse(raw) as { html_url?: string };
  return {
    htmlUrl:
      parsed.html_url ??
      `${`https://github.com/${input.owner}/${input.repo}`}/releases/tag/${encodeURIComponent(input.tagName)}`,
  };
}

function parseGithubRemote(remote: string): RepoIdentity | null {
  const ssh = remote.match(
    /^git@github\.com:(?<owner>[^/]+)\/(?<repo>[^.]+)(?:\.git)?$/u,
  );
  if (ssh?.groups?.owner && ssh.groups.repo) {
    return {
      owner: ssh.groups.owner,
      repo: ssh.groups.repo,
      webUrl: `https://github.com/${ssh.groups.owner}/${ssh.groups.repo}`,
    };
  }

  const https = remote.match(
    /^https:\/\/github\.com\/(?<owner>[^/]+)\/(?<repo>[^.]+)(?:\.git)?$/u,
  );
  if (https?.groups?.owner && https.groups.repo) {
    return {
      owner: https.groups.owner,
      repo: https.groups.repo,
      webUrl: `https://github.com/${https.groups.owner}/${https.groups.repo}`,
    };
  }

  return null;
}
