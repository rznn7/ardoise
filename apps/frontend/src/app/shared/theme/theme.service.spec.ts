import { TestBed } from '@angular/core/testing';

import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

class FakeMediaQueryList extends EventTarget {
  constructor(public matches: boolean) {
    super();
  }

  flip(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event('change'));
  }
}

function setup(systemDark: boolean): { service: ThemeService; media: FakeMediaQueryList } {
  const media = new FakeMediaQueryList(systemDark);
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  const service = TestBed.inject(ThemeService);
  TestBed.tick();
  return { service, media };
}

const isDark = (): boolean => document.documentElement.classList.contains('dark');

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('defaults to system and resolves from prefers-color-scheme', () => {
    const { service } = setup(true);

    expect(service.preference()).toBe('system');
    expect(service.resolved()).toBe('dark');
    expect(isDark()).toBe(true);
  });

  it('follows the system live when preference is system', () => {
    const { service, media } = setup(true);

    media.flip(false);
    TestBed.tick();

    expect(service.resolved()).toBe('light');
    expect(isDark()).toBe(false);
  });

  it('stored preference wins over system', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const { service } = setup(true);

    expect(service.resolved()).toBe('light');
    expect(isDark()).toBe(false);
  });

  it('setPreference persists and applies', () => {
    const { service } = setup(false);

    service.setPreference('dark');
    TestBed.tick();

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(isDark()).toBe(true);
  });

  it('ignores garbage in storage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    const { service } = setup(false);

    expect(service.preference()).toBe('system');
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { service } = setup(true);

    expect(service.resolved()).toBe('dark');
    expect(() => {
      service.setPreference('light');
    }).not.toThrow();
    TestBed.tick();
    expect(isDark()).toBe(false);
  });
});
