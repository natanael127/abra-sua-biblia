/**
 * Versão da página, exibida no fim da seção Sobre: hash curto do commit e a
 * data do commit em UTC, ex.: "593816c 2026-10-27 17:02:41".
 */
import { execSync } from 'node:child_process';

const git = (args: string, cwd?: string): string =>
    execSync(`git ${args}`, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/**
 * Hash curto (7 caracteres) do commit.
 *
 * No servidor da Vercel, vem do commit sincronizado com o git, sem "-dirty":
 * lá não há alterações locais, mas a própria Vercel modifica o vercel.json
 * durante o build e o git acusaria alterações. Nos builds locais, indica
 * "-dirty" quando há alterações não commitadas. As tags são ignoradas para
 * o resultado ser igual nos dois casos (a Vercel clona sem elas).
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

/** Data em UTC no formato "YYYY-MM-DD hh:mm:ss". */
export const formatUtc = (date: Date): string => date.toISOString().slice(0, 19).replace('T', ' ');

/**
 * Data do commit (committer date) em UTC. Na Vercel, o build é feito num
 * clone do repositório e o commit do deploy está nele. Sem o .git (ex.:
 * `vercel deploy` a partir de uma pasta local), não há como saber a data.
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

/** Texto exibido na página: hash e, quando disponível, a data do commit. */
export function describePageVersion(env = process.env, cwd?: string): string {
    return [describeVersion(env, cwd), describeCommitDate(env, cwd)].filter(Boolean).join(' ');
}

/** Alterações não commitadas, para o log do build local. */
export const uncommittedChanges = (cwd?: string): string => git('status --porcelain', cwd);
