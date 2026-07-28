import {
  contrastRatio,
  isValidHexColor,
  meetsWcagAA,
  parseHexColor,
  WCAG_AA_NORMAL_TEXT_RATIO,
} from './color-contrast';

describe('parseHexColor / isValidHexColor', () => {
  it('parses 6-digit hex', () => {
    expect(parseHexColor('#FFFFFF')).toEqual([255, 255, 255]);
    expect(parseHexColor('#000000')).toEqual([0, 0, 0]);
    expect(parseHexColor('#2F4A3C')).toEqual([47, 74, 60]);
  });

  it('parses 3-digit shorthand hex by doubling each digit', () => {
    expect(parseHexColor('#FFF')).toEqual([255, 255, 255]);
    expect(parseHexColor('#000')).toEqual([0, 0, 0]);
  });

  it('rejects non-hex strings', () => {
    expect(isValidHexColor('red')).toBe(false);
    expect(isValidHexColor('#12345')).toBe(false);
    expect(isValidHexColor('#gggggg')).toBe(false);
    expect(parseHexColor('not-a-color')).toBeNull();
  });
});

describe('contrastRatio (WCAG 2.0 relative luminance)', () => {
  it('black on white is the maximum possible ratio, 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('a color against itself is the minimum possible ratio, 1:1', () => {
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('is symmetric regardless of argument order', () => {
    const a = contrastRatio('#2F4A3C', '#FFFFFF');
    const b = contrastRatio('#FFFFFF', '#2F4A3C');
    expect(a).toBeCloseTo(b as number, 10);
  });

  it('returns null when either color is invalid', () => {
    expect(contrastRatio('not-a-color', '#FFFFFF')).toBeNull();
    expect(contrastRatio('#FFFFFF', 'not-a-color')).toBeNull();
  });
});

describe('meetsWcagAA', () => {
  it('black on white passes (21:1, far above the 4.5:1 minimum)', () => {
    expect(meetsWcagAA('#000000', '#FFFFFF')).toBe(true);
  });

  it('white on white fails (1:1, no contrast at all)', () => {
    expect(meetsWcagAA('#FFFFFF', '#FFFFFF')).toBe(false);
  });

  it('a pale, low-contrast color against white fails AA', () => {
    // A pale yellow — bright, low-contrast, the exact failure mode
    // findings-log.md #17 names as the reason brand colors get checked
    // against white at all.
    expect(meetsWcagAA('#FFFF66', '#FFFFFF')).toBe(false);
  });

  it('a dark, saturated color against white passes AA', () => {
    expect(meetsWcagAA('#1A1A2E', '#FFFFFF')).toBe(true);
  });

  it('treats an invalid color as a failure, not a pass', () => {
    expect(meetsWcagAA('not-a-color', '#FFFFFF')).toBe(false);
  });

  it('uses the 4.5:1 normal-text threshold, not the 3:1 large-text one', () => {
    expect(WCAG_AA_NORMAL_TEXT_RATIO).toBe(4.5);
  });
});
