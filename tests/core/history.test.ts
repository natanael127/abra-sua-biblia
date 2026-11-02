import { describe, expect, it } from 'vitest';
import { addToHistory } from '../../src/core/history';

describe('addToHistory', () => {
    it('inserts at the start', () => {
        expect(addToHistory(['Mt 5'], 'Jo 3,16')).toEqual(['Jo 3,16', 'Mt 5']);
    });

    it('moves a repeated reference to the start', () => {
        expect(addToHistory(['Jo 3,16', 'Mt 5'], 'Mt 5')).toEqual(['Mt 5', 'Jo 3,16']);
    });

    it('replaces previously typed prefixes (e.g. while typing)', () => {
        let history: string[] = [];
        for (const typed of ['Mt 5', 'Mt 5,3', 'Mt 5,3-1', 'Mt 5,3-12']) {
            history = addToHistory(history, typed);
        }
        expect(history).toEqual(['Mt 5,3-12']);
    });

    it('does not add a reference that is a prefix of an existing one (e.g. when deleting)', () => {
        expect(addToHistory(['Mt 5,3-12'], 'mt 5,3')).toEqual(['Mt 5,3-12']);
    });

    it('limits the size', () => {
        const history = Array.from({ length: 10 }, (_, i) => `Sl ${i + 1}0`);
        const output = addToHistory(history, 'Jo 1');
        expect(output).toHaveLength(10);
        expect(output[0]).toBe('Jo 1');
        expect(output).not.toContain('Sl 100');
    });

    it('ignores an empty reference and does not change the given list', () => {
        const history = ['Mt 5'];
        expect(addToHistory(history, '  ')).toEqual(['Mt 5']);
        addToHistory(history, 'Jo 1');
        expect(history).toEqual(['Mt 5']);
    });
});
