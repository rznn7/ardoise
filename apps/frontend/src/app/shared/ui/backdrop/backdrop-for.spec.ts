import { backdropFor, backdropUrl } from './backdrop-for';
import { BACKDROP_PALETTES, BACKDROP_SEEDS, BACKDROP_SHAPES } from './backdrop-palettes';

describe('backdropFor', () => {
  it('palette cycles by id', () => {
    expect([1, 2, 3, 4].map((id) => backdropFor(id).palette)).toEqual([
      'cobalt',
      'sunset',
      'ember',
      'violet',
    ]);
  });

  it('deterministic', () => {
    expect(backdropFor(42)).toEqual(backdropFor(42));
  });

  it('always in range for odd ids', () => {
    for (const id of [0, -7, 2_147_483_647]) {
      const backdrop = backdropFor(id);
      expect(Object.keys(BACKDROP_PALETTES)).toContain(backdrop.palette);
      expect(BACKDROP_SHAPES).toContain(backdrop.shape);
      expect(BACKDROP_SEEDS).toContain(backdrop.seed);
    }
  });

  it('url format', () => {
    expect(backdropUrl({ palette: 'violet', shape: 'sunrise', seed: 2 })).toBe(
      '/backdrops/violet-sunrise-2.webp',
    );
  });
});
