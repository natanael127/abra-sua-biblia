import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { describeCommitDate, describePageVersion, describeVersion, formatUtc } from '../../scripts/build-version';

let root: string;
let repo: string;
let first: string;
let second: string;

const run = (command: string, cwd: string, env: Record<string, string> = {}) =>
    execSync(command, { cwd, encoding: 'utf8', env: { ...process.env, ...env } }).trim();

/** Commit com data fixa, em fuso diferente de UTC, para conferir a conversão. */
function commit(message: string, date: string): string {
    writeFileSync(join(repo, 'arquivo.txt'), message);
    run('git add arquivo.txt', repo);
    run(`git -c user.name=Teste -c user.email=t@t -c commit.gpgsign=false commit -q -m "${message}"`, repo, {
        GIT_AUTHOR_DATE: date,
        GIT_COMMITTER_DATE: date,
    });
    return run('git rev-parse HEAD', repo);
}

beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'build-version-'));
    repo = join(root, 'repo');
    run(`git init -q ${repo}`, root);
    first = commit('primeiro', '2026-01-02T03:04:05-03:00');
    second = commit('segundo', '2026-10-27T23:59:59-03:00');
});

afterAll(() => {
    rmSync(root, { recursive: true });
});

describe('formatUtc', () => {
    it('formata em UTC como YYYY-MM-DD hh:mm:ss', () => {
        expect(formatUtc(new Date('2026-10-27T14:02:43-03:00'))).toBe('2026-10-27 17:02:43');
    });
});

describe('build local', () => {
    it('hash curto e data do HEAD em UTC, inclusive virando o dia', () => {
        expect(describeVersion({}, repo)).toBe(second.slice(0, 7));
        expect(describeCommitDate({}, repo)).toBe('2026-10-28 02:59:59');
        expect(describePageVersion({}, repo)).toBe(`${second.slice(0, 7)} 2026-10-28 02:59:59`);
    });

    it('com alterações não commitadas, indica -dirty e mantém a data do commit', () => {
        writeFileSync(join(repo, 'arquivo.txt'), 'alterado');
        try {
            expect(describePageVersion({}, repo)).toBe(`${second.slice(0, 7)}-dirty 2026-10-28 02:59:59`);
        } finally {
            run('git checkout -q -- arquivo.txt', repo);
        }
    });
});

describe('Vercel', () => {
    it('usa o commit do deploy (VERCEL_GIT_COMMIT_SHA), não o HEAD', () => {
        const env = { VERCEL_GIT_COMMIT_SHA: first };
        expect(describePageVersion(env, repo)).toBe(`${first.slice(0, 7)} 2026-01-02 06:04:05`);
    });

    it('funciona num clone raso, como o que a Vercel faz para o build', () => {
        const shallow = join(root, 'raso');
        run(`git clone -q --depth=1 file://${repo} ${shallow}`, root);
        expect(run('git rev-parse --is-shallow-repository', shallow)).toBe('true');
        expect(describePageVersion({ VERCEL_GIT_COMMIT_SHA: second }, shallow)).toBe(
            `${second.slice(0, 7)} 2026-10-28 02:59:59`,
        );
    });

    it('sem o .git (vercel deploy de uma pasta local), mostra só o hash', () => {
        const noGit = mkdtempSync(join(tmpdir(), 'sem-git-'));
        try {
            expect(describeCommitDate({ VERCEL_GIT_COMMIT_SHA: second }, noGit)).toBeUndefined();
            expect(describePageVersion({ VERCEL_GIT_COMMIT_SHA: second }, noGit)).toBe(second.slice(0, 7));
            expect(describePageVersion({}, noGit)).toBe('versão desconhecida');
        } finally {
            rmSync(noGit, { recursive: true });
        }
    });
});
