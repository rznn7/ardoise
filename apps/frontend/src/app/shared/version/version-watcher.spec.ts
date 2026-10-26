import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { CHUNK_RELOAD_KEY, PAGE_RELOAD, VERSION_URL, VersionWatcher } from './version-watcher';

@Component({ template: '' })
class Blank {}

const versionResponse = (sha: string): Response =>
  new Response(JSON.stringify({ sha, date: '' }), {
    headers: { 'content-type': 'application/json' },
  });

const chunkError = (): TypeError =>
  new TypeError('Failed to fetch dynamically imported module: /chunk-ABCDEFGH.js');

function setup(responses: (() => Promise<Response>)[]): {
  reload: ReturnType<typeof vi.fn>;
  fetchMock: ReturnType<typeof vi.fn>;
  router: Router;
} {
  const queue = [...responses];
  const fetchMock = vi.fn(() => (queue.shift() ?? (() => Promise.reject(new Error('empty'))))());
  vi.stubGlobal('fetch', fetchMock);
  const reload = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: PAGE_RELOAD, useValue: reload },
      provideRouter([
        { path: 'ok', component: Blank },
        { path: 'broken', loadComponent: () => Promise.reject(chunkError()) },
        {
          path: 'guarded',
          component: Blank,
          canActivate: [
            () => {
              throw new Error('boom');
            },
          ],
        },
      ]),
    ],
  });
  TestBed.inject(VersionWatcher).start();
  return { reload, fetchMock, router: TestBed.inject(Router) };
}

const respond =
  (sha: string): (() => Promise<Response>) =>
  () =>
    Promise.resolve(versionResponse(sha));

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

async function comeBack(): Promise<void> {
  setVisibility('visible');
  await settle();
}

describe('VersionWatcher', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('reloads when the app comes back with a new sha', async () => {
    const { reload, fetchMock } = setup([respond('aaa'), respond('bbb')]);
    await settle();

    await comeBack();

    expect(fetchMock).toHaveBeenCalledWith(VERSION_URL, { cache: 'no-store' });
    expect(reload).toHaveBeenCalledOnce();
  });

  it('stays put when the sha is unchanged', async () => {
    const { reload } = setup([respond('aaa'), respond('aaa')]);
    await settle();

    await comeBack();

    expect(reload).not.toHaveBeenCalled();
  });

  it('does not check when the app goes to the background', async () => {
    const { fetchMock } = setup([respond('aaa'), respond('bbb')]);
    await settle();

    setVisibility('hidden');
    await settle();

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('ignores a response that is not version JSON', async () => {
    const { reload } = setup([
      respond('aaa'),
      () =>
        Promise.resolve(
          new Response('<!doctype html><html></html>', {
            headers: { 'content-type': 'text/html' },
          }),
        ),
      respond('aaa'),
    ]);
    await settle();

    await comeBack();
    await comeBack();

    expect(reload).not.toHaveBeenCalled();
  });

  it('ignores the dev sha', async () => {
    const { reload } = setup([respond('dev'), respond('bbb')]);
    await settle();

    await comeBack();

    expect(reload).not.toHaveBeenCalled();
  });

  it('adopts the first sha it manages to read as the baseline', async () => {
    const { reload } = setup([
      () => Promise.reject(new TypeError('offline')),
      respond('aaa'),
      respond('bbb'),
    ]);
    await settle();

    await comeBack();
    expect(reload).not.toHaveBeenCalled();

    await comeBack();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads once when a lazy route fails to load', async () => {
    const { reload, router } = setup([respond('aaa')]);

    await router.navigateByUrl('/broken').catch(() => undefined);

    expect(reload).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).not.toBeNull();
  });

  it('reloads only once for repeated chunk failures', async () => {
    const { reload, router } = setup([respond('aaa')]);

    await router.navigateByUrl('/broken').catch(() => undefined);
    await router.navigateByUrl('/broken').catch(() => undefined);

    expect(reload).toHaveBeenCalledOnce();
  });

  it('does not reload again when a successful navigation sits between two chunk failures', async () => {
    const { reload, router } = setup([respond('aaa')]);

    await router.navigateByUrl('/broken').catch(() => undefined);
    await router.navigateByUrl('/ok');
    await router.navigateByUrl('/broken').catch(() => undefined);

    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads again once the last chunk reload is a minute old', async () => {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now() - 61_000));
    const { reload, router } = setup([respond('aaa')]);

    await router.navigateByUrl('/broken').catch(() => undefined);

    expect(reload).toHaveBeenCalledOnce();
  });

  it('ignores navigation errors that are not chunk failures', async () => {
    const { reload, router } = setup([respond('aaa')]);

    await router.navigateByUrl('/guarded').catch(() => undefined);

    expect(reload).not.toHaveBeenCalled();
  });
});
