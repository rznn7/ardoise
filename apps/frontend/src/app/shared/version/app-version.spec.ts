import { TestBed } from '@angular/core/testing';
import { LanguageService } from 'src/app/shared/i18n/language.service';
import { translatorFor } from 'src/test-providers';

import { AppVersion, versionLabel } from './app-version';

const en = () => translatorFor('en');

describe('versionLabel', () => {
  it('formats the commit day in French', () => {
    expect(
      versionLabel({ sha: 'a1b2c3d4e5', date: '2026-11-03T10:00:00+01:00' }, translatorFor('fr')),
    ).toBe('Version a1b2c3d · 3 nov. 2026');
  });

  it('shows the short sha and the commit day', () => {
    expect(versionLabel({ sha: 'a1b2c3d4e5', date: '2026-11-03T10:00:00+01:00' }, en())).toBe(
      'Version a1b2c3d · 3 Nov 2026',
    );
  });

  it('says dev for a local build', () => {
    expect(versionLabel({ sha: 'dev', date: '' }, en())).toBe('Version dev');
  });

  it('says dev for an unreadable body', () => {
    expect(versionLabel(null, en())).toBe('Version dev');
    expect(versionLabel({ date: '2026-11-03T10:00:00+01:00' }, en())).toBe('Version dev');
    expect(versionLabel({ sha: 42, date: '2026-11-03T10:00:00+01:00' }, en())).toBe('Version dev');
  });

  it('says dev for an invalid date', () => {
    expect(versionLabel({ sha: 'a1b2c3d', date: 'nope' }, en())).toBe('Version dev');
  });
});

describe('AppVersion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const labelAfterFetch = async (fetch: () => Promise<Response>): Promise<string> => {
    vi.stubGlobal('fetch', vi.fn(fetch));
    const version = TestBed.inject(AppVersion);
    await vi.waitFor(() => {
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalled();
    });
    await new Promise((resolve) => setTimeout(resolve));
    return version.label();
  };

  it('reads the deployed version', async () => {
    const label = await labelAfterFetch(() =>
      Promise.resolve(Response.json({ sha: 'a1b2c3d4e5', date: '2026-11-03T10:00:00+01:00' })),
    );
    expect(label).toBe('Version a1b2c3d · 3 Nov 2026');
  });

  it('follows a language switch without fetching again', async () => {
    await labelAfterFetch(() =>
      Promise.resolve(Response.json({ sha: 'a1b2c3d4e5', date: '2026-11-03T10:00:00+01:00' })),
    );

    await TestBed.inject(LanguageService).setPreference('fr');

    expect(TestBed.inject(AppVersion).label()).toBe('Version a1b2c3d · 3 nov. 2026');
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });

  it('stays on dev when the file is missing', async () => {
    const label = await labelAfterFetch(() => Promise.resolve(new Response('', { status: 404 })));
    expect(label).toBe('Version dev');
  });

  it('stays on dev when the request fails', async () => {
    const label = await labelAfterFetch(() => Promise.reject(new TypeError('offline')));
    expect(label).toBe('Version dev');
  });
});
