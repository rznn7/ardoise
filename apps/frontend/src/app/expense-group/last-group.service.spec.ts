import { TestBed } from '@angular/core/testing';

import { LastGroupService } from './last-group.service';

const KEY = 'ardoise.lastGroup';

describe('LastGroupService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('returns the stored id on the first launch redirect, then null', () => {
    localStorage.setItem(KEY, '7');
    const service = TestBed.inject(LastGroupService);

    expect(service.takeLaunchRedirect()).toBe(7);
    expect(service.takeLaunchRedirect()).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(TestBed.inject(LastGroupService).takeLaunchRedirect()).toBeNull();
  });

  it('returns null for a stored value that is not a group id', () => {
    localStorage.setItem(KEY, 'nope');

    expect(TestBed.inject(LastGroupService).takeLaunchRedirect()).toBeNull();
  });

  it('remembers the group in localStorage', () => {
    TestBed.inject(LastGroupService).remember(12);

    expect(localStorage.getItem(KEY)).toBe('12');
  });

  it('skips the launch redirect once a group page has been opened', () => {
    localStorage.setItem(KEY, '7');
    const service = TestBed.inject(LastGroupService);

    service.remember(3);

    expect(service.takeLaunchRedirect()).toBeNull();
  });

  it('skips the launch redirect without changing the remembered group', () => {
    localStorage.setItem(KEY, '7');
    const service = TestBed.inject(LastGroupService);

    service.skipLaunchRedirect();

    expect(service.takeLaunchRedirect()).toBeNull();
    expect(localStorage.getItem(KEY)).toBe('7');
  });

  it('gives null without an error when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const service = TestBed.inject(LastGroupService);

    expect(() => {
      service.remember(7);
    }).not.toThrow();
    expect(service.takeLaunchRedirect()).toBeNull();
  });
});
