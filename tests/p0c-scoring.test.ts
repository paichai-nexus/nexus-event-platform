import { describe, expect, it } from 'vitest';
import { calculateFinalScore, calculateScoreRows, calculateScoringResult } from '../features/scoring/lib/calculateScores';

const row = (teamId: string, professional: number, audience: number) => ({teamId, teamName: teamId, professional, audience});

describe('P0-C / 80:20 scoring contract', () => {
  it('weighs professional scores at 80% and audience scores at 20%', () => {
    expect(calculateFinalScore(90, 50)).toBe(82);
    expect(calculateFinalScore(50, 90)).toBe(58);
    expect(calculateFinalScore(100, 0)).toBe(80);
    expect(calculateFinalScore(0, 100)).toBe(20);
  });
  it('uses computed totals to rank teams instead of professional score alone', () => {
    const result = calculateScoreRows([row('A', 85, 60), row('B', 80, 100)]);
    expect(result.map((v) => [v.teamId, v.finalScore, v.rank])).toEqual([['B', 84, 1], ['A', 80, 2]]);
  });
  it('assigns competition ranks for exact ties (1, 1, 3)', () => {
    const result = calculateScoreRows([row('C', 50, 50), row('A', 90, 50), row('B', 80, 90)]);
    expect(result.map(v => [v.teamId, v.rank, v.tied])).toEqual([['A', 1, true], ['B', 1, true], ['C', 3, false]]);
  });
  it('recomputes rankings when judge scores are revised (pure function)', () => {
    const before = calculateScoreRows([row('A', 85, 80), row('B', 80, 70)]);
    const after = calculateScoreRows([row('A', 85, 80), row('B', 100, 70)]);
    expect(before[0].teamId).toBe('A');
    expect(after[0].teamId).toBe('B');
  });
  it('blocks calculation until criteria are configured', () => {
    const result = calculateScoringResult([row('A', 100, 100)], false);
    expect(result.status).toBe('SCORING_BLOCKED');
    expect(result.rows).toEqual([]);
  });
  it('does not mutate input array or existing rows', () => {
    const input = Object.freeze([Object.freeze(row('A', 10, 20)), Object.freeze(row('B', 90, 60))]);
    expect(() => calculateScoreRows(input as unknown as Parameters<typeof calculateScoreRows>[0])).not.toThrow();
    expect(input.map(x=>x.teamId)).toEqual(['A','B']);
  });
  it('has a documented one-decimal tie limitation', () => {
    // Both raw weighted totals are different, but presentation rounds to one decimal.
    const result = calculateScoreRows([row('A', 80.01, 80), row('B', 80.04, 80)]);
    expect(result.map(x => x.finalScore)).toEqual([80, 80]);
    expect(result.every(x => x.tied)).toBe(true);
  });
});
