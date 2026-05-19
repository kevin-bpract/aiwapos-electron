import { isValidHttpUrl } from './urlValidator';

describe('isValidHttpUrl', () => {
  it('accepts valid http/https urls', () => {
    expect(isValidHttpUrl('https://demo3.kevinroan.com')).toBe(true);
    expect(isValidHttpUrl('http://example.com/path?x=1')).toBe(true);
  });

  it('rejects urls ending with slash', () => {
    expect(isValidHttpUrl('https://demo3.kevinroan.com/')).toBe(false);
  });

  it('rejects invalid urls', () => {
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('example.com')).toBe(false);
  });
});
