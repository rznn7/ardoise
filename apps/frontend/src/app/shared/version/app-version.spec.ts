import { TestBed } from '@angular/core/testing';

import { AppVersion, versionLabel } from './app-version';

describe('versionLabel', () => {
  it('shows the short sha and the commit day', () => {
    expect(versionLabel({ sha: 'a1b2c3d4e5', date: '2026-11-03T10:00:00+01:00' })).toBe(
      'Version a1b2c3d · 3 Nov 2026',
    );
  });

  it('says dev for a local build', () => {
    expect(versionLabel({ sha: 'dev', date: '' })).toBe('Version dev');
  });

  it('says dev for an unreadable body', () => {
    expect(versionLabel(null)).toBe('Version dev');
    expect(versionLabel({ date: '2026-11-03T10:00:00+01:00' })).toBe('Version dev');
    expect(versionLabel({ sha: 42, date: '2026-11-03T10:00:00+01:00' })).toBe('Version dev');
  });

  it('says dev for an invalid date', () => {
    expect(versionLabel({ sha: 'a1b2c3d', date: 'nope' })).toBe('Version dev');
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

  it('stays on dev when the file is missing', async () => {
    const label = await labelAfterFetch(() =>
      Promise.resolve(new Response('', { status: 404 })),
    );
    expect(label).toBe('Version dev');
  });

  it('stays on dev when the request fails', async () => {
    const label = await labelAfterFetch(() => Promise.reject(new TypeError('offline')));
    expect(label).toBe('Version dev');
  });
});
