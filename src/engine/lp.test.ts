import { CHAIR_TABLE, THREE_PROJECTS, checkSelection, judgeSelection, solveIP, solveLP, vertices } from './lp';

describe('lecture: chair vs. table (Cream Ale vs. Tripel)', () => {
  it('optimum X_C = 2, X_T = 3 with Z = 9,500', () => {
    const ip = solveIP(CHAIR_TABLE);
    expect(ip.x).toEqual([2, 3]);
    expect(ip.z).toBe(9500);
    expect(ip.feasibleCount).toBe(21);
  });
  it('the LP relaxation has the same optimum here', () => {
    const lp = solveLP(CHAIR_TABLE);
    expect(lp.z).toBeCloseTo(9500, 6);
    expect(lp.x[0]).toBeCloseTo(2, 6);
    expect(lp.x[1]).toBeCloseTo(3, 6);
  });
  it('corner points of the feasible region', () => {
    const v = vertices(CHAIR_TABLE).map((x) => x.map((y) => Math.round(y * 100) / 100).join(',')).sort();
    expect(v).toEqual(['0,0', '0,3', '2,3', '4,2', '6,0'].sort());
  });
  it('checks plans against resources and demand', () => {
    expect(checkSelection(CHAIR_TABLE, [4, 2]).feasible).toBe(true);
    expect(checkSelection(CHAIR_TABLE, [4, 2]).used).toEqual([12, 8]);
    expect(checkSelection(CHAIR_TABLE, [3, 3]).overCapacity).toEqual([1]);
    expect(checkSelection(CHAIR_TABLE, [7, 0]).overDemand).toEqual([0]);
  });
  it('verdicts', () => {
    expect(judgeSelection(CHAIR_TABLE, [2, 3]).outcome).toBe('perfect');
    expect(judgeSelection(CHAIR_TABLE, [4, 2]).outcome).toBe('good-enough');
    expect(judgeSelection(CHAIR_TABLE, [6, 0]).outcome).toBe('too-little');
    expect(judgeSelection(CHAIR_TABLE, [3, 3]).outcome).toBe('too-much');
  });
});

describe('lecture: 3 projects, 6 resources', () => {
  it('complete enumeration: 20 of 432 integer plans are feasible, optimum (1, 0, 2) with Z = 2,800', () => {
    const ip = solveIP(THREE_PROJECTS);
    expect(ip.candidates).toBe(432);
    expect(ip.feasibleCount).toBe(20);
    expect(ip.x).toEqual([1, 0, 2]);
    expect(ip.z).toBe(2800);
  });
  it('LP relaxation Z ≈ 3,490.57 at (2.08, 0, 1.83); rounding it is infeasible', () => {
    const lp = solveLP(THREE_PROJECTS);
    expect(Math.round(lp.z * 100) / 100).toBe(3490.57);
    expect(Math.round(lp.x[0] * 100) / 100).toBe(2.08);
    expect(Math.round(lp.x[2] * 100) / 100).toBe(1.83);
    expect(checkSelection(THREE_PROJECTS, lp.x.map(Math.round)).feasible).toBe(false);
  });
});
