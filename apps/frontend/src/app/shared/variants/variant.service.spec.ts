import { TestBed } from '@angular/core/testing';

import { VariantService } from './variant.service';

describe('VariantService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to a', () => {
    const service = TestBed.inject(VariantService);

    expect(service.variant('add-expense')()).toBe('a');
  });

  it('toggle flips and persists', () => {
    const service = TestBed.inject(VariantService);

    service.toggle('add-expense');

    expect(service.variant('add-expense')()).toBe('b');
    expect(localStorage.getItem('ardoise.variant.add-expense')).toBe('b');
  });

  it('restores persisted value', () => {
    localStorage.setItem('ardoise.variant.add-expense', 'b');
    const service = TestBed.inject(VariantService);

    expect(service.variant('add-expense')()).toBe('b');
  });

  it('survives storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const service = TestBed.inject(VariantService);

    expect(service.variant('add-expense')()).toBe('a');
    expect(() => {
      service.toggle('add-expense');
    }).not.toThrow();
    expect(service.variant('add-expense')()).toBe('b');
  });

  it('lists registered keys once', () => {
    const service = TestBed.inject(VariantService);

    service.register('add-expense', 'Add expense form');
    service.register('add-expense', 'Add expense form');

    expect(service.registered()).toEqual([{ key: 'add-expense', label: 'Add expense form' }]);
  });
});
