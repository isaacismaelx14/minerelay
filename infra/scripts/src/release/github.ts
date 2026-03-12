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

const GITHUB_API_VERSION = "2022-11-28";
const RELEASE_CREATE_ATTEMPTS = 3;

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
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RELEASE_CREATE_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${input.owner}/${input.repo}/releases`,
        {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${input.token}`,
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
            "User-Agent": "mvl-semantic-release",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildCreateGithubReleasePayload(input)),
        },
      );

      const raw = await response.text();
      if (response.ok) {
        const parsed = JSON.parse(raw) as { html_url?: string };
        return {
          htmlUrl:
            parsed.html_url ??
            `${`https://github.com/${input.owner}/${input.repo}`}/releases/tag/${encodeURIComponent(input.tagName)}`,
        };
      }

      if (
        response.status === 422 &&
        /already_exists|already exists|already been taken/iu.test(raw)
      ) {
        const existing = await getReleaseByTag({
          owner: input.owner,
          repo: input.repo,
          tagName: input.tagName,
          token: input.token,
        });
        if (existing?.htmlUrl) {
          return { htmlUrl: existing.htmlUrl };
        }
      }

      const isRetryableStatus =
        response.status >= 500 || response.status === 429;
      const error = new Error(
        `Failed to create GitHub release (${response.status}): ${raw}`,
      );
      if (!isRetryableStatus || attempt === RELEASE_CREATE_ATTEMPTS) {
        throw error;
      }
      lastError = error;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === RELEASE_CREATE_ATTEMPTS) {
        break;
      }
    }

    const backoffMs = attempt * 1000;
    await delay(backoffMs);
  }

  throw (
    lastError ?? new Error("Failed to create GitHub release: unknown error")
  );
}

type GetReleaseByTagInput = {
  owner: string;
  repo: string;
  tagName: string;
  token: string;
};

async function getReleaseByTag(
  input: GetReleaseByTagInput,
): Promise<{ htmlUrl: string } | null> {
  const response = await fetch(
    `https://api.github.com/repos/${input.owner}/${input.repo}/releases/tags/${encodeURIComponent(input.tagName)}`,
    {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.token}`,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": "mvl-semantic-release",
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(
      `Failed to fetch GitHub release by tag (${response.status}): ${raw}`,
    );
  }

  const parsed = (await response.json()) as { html_url?: string };
  return {
    htmlUrl:
      parsed.html_url ??
      `${`https://github.com/${input.owner}/${input.repo}`}/releases/tag/${encodeURIComponent(input.tagName)}`,
  };
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
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
