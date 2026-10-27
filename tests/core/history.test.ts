import { describe, expect, it } from 'vitest';
import { addToHistory } from '../../src/core/history';

describe('addToHistory', () => {
    it('insere no início', () => {
        expect(addToHistory(['Mt 5'], 'Jo 3,16')).toEqual(['Jo 3,16', 'Mt 5']);
    });

    it('move uma referência repetida para o início', () => {
        expect(addToHistory(['Jo 3,16', 'Mt 5'], 'Mt 5')).toEqual(['Mt 5', 'Jo 3,16']);
    });

    it('substitui prefixos digitados antes (ex.: durante a digitação)', () => {
        let history: string[] = [];
        for (const typed of ['Mt 5', 'Mt 5,3', 'Mt 5,3-1', 'Mt 5,3-12']) {
            history = addToHistory(history, typed);
        }
        expect(history).toEqual(['Mt 5,3-12']);
    });

    it('não inclui referência que é prefixo de uma existente (ex.: ao apagar)', () => {
        expect(addToHistory(['Mt 5,3-12'], 'mt 5,3')).toEqual(['Mt 5,3-12']);
    });

    it('limita o tamanho', () => {
        const history = Array.from({ length: 10 }, (_, i) => `Sl ${i + 1}0`);
        const output = addToHistory(history, 'Jo 1');
        expect(output).toHaveLength(10);
        expect(output[0]).toBe('Jo 1');
        expect(output).not.toContain('Sl 100');
    });

    it('ignora referência vazia e não altera a lista recebida', () => {
        const history = ['Mt 5'];
        expect(addToHistory(history, '  ')).toEqual(['Mt 5']);
        addToHistory(history, 'Jo 1');
        expect(history).toEqual(['Mt 5']);
    });
});
