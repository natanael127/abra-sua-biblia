/**
 * Page version, shown at the end of the About section: short commit hash and
 * commit date in UTC, e.g.: "593816c 2026-10-27 17:02:41 UTC".
 */
import { execSync } from 'node:child_process';

const git = (args: string, cwd?: string): string =>
    execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/**
 * Short commit hash (7 characters).
 *
 * On the Vercel server, it comes from the commit synced with git, without "-dirty":
 * there are no local changes there, but Vercel itself modifies vercel.json
 * during the build, so git would report changes. In local builds, it appends
 * "-dirty" when there are uncommitted changes. Tags are ignored so the
 * result is the same in both cases (Vercel clones without them).
 */
export function describeVersion(env = process.env, cwd?: string): string {
    const vercelCommit = env.VERCEL_GIT_COMMIT_SHA;
    if (vercelCommit) {
        return vercelCommit.slice(0, 7);
    }
    try {
        return git(`describe --always --dirty=-dirty --exclude='*' --abbrev=7`, cwd);
    } catch {
        return 'versão desconhecida';
    }
}

/** Date in UTC in the format "YYYY-MM-DD hh:mm:ss". */
export const formatUtc = (date: Date): string => date.toISOString().slice(0, 19).replace('T', ' ');

/**
 * Commit date (committer date) in UTC. On Vercel, the build runs in a clone
 * of the repository and the deploy commit is in it. Without .git (e.g.
 * `vercel deploy` from a local folder), there is no way to know the date.
 */
export function describeCommitDate(env = process.env, cwd?: string): string | undefined {
    const commit = env.VERCEL_GIT_COMMIT_SHA ?? 'HEAD';
    try {
        const seconds = Number(git(`show -s --format=%ct ${commit}`, cwd));
        return Number.isFinite(seconds) && seconds > 0 ? formatUtc(new Date(seconds * 1000)) : undefined;
    } catch {
        return undefined;
    }
}

/** Text shown on the page: hash and, when available, the commit date followed by "UTC". */
export function describePageVersion(env = process.env, cwd?: string): string {
    const date = describeCommitDate(env, cwd);
    return [describeVersion(env, cwd), date && `${date} UTC`].filter(Boolean).join(' ');
}

/** Uncommitted changes, for the local build log. */
export const uncommittedChanges = (cwd?: string): string => git('status --porcelain', cwd);
