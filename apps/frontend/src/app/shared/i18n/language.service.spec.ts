import { TestBed } from '@angular/core/testing';

import { LANGUAGE_STORAGE_KEY, LanguageService } from './language.service';

function setup(deviceLanguages: readonly string[]) {
  const device = vi.spyOn(navigator, 'languages', 'get').mockReturnValue(deviceLanguages);
  const service = TestBed.inject(LanguageService);
  return { service, device };
}

describe('LanguageService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to system and follows a French device', async () => {
    const { service } = setup(['fr-BE', 'en']);
    await service.ready();

    expect(service.preference()).toBe('system');
    expect(service.active()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('lets a stored choice win over the device', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    const { service } = setup(['fr-FR']);
    await service.ready();

    expect(service.preference()).toBe('en');
    expect(service.active()).toBe('en');
  });

  it('ignores garbage in storage', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'klingon');
    const { service } = setup(['en-US']);
    await service.ready();

    expect(service.preference()).toBe('system');
  });

  it('switches, remembers the choice and translates in the new language', async () => {
    const { service } = setup(['en-US']);
    await service.ready();

    await service.setPreference('fr');

    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('fr');
    expect(service.active()).toBe('fr');
    expect(service.translator().translate('settings.title')).toBe('Réglages');
    expect(service.translator().locale).toBe('fr-FR');
    expect(document.documentElement.lang).toBe('fr');
  });

  it('follows a device language change while on system', async () => {
    const { service, device } = setup(['en-US']);
    await service.ready();

    device.mockReturnValue(['fr-FR']);
    window.dispatchEvent(new Event('languagechange'));
    await service.ready();

    expect(service.active()).toBe('fr');
  });

  it('formats with the device variant of the language', async () => {
    const { service } = setup(['en-US']);
    await service.ready();

    expect(service.translator().locale).toBe('en-US');
  });

  it('follows a device region change even with an explicit language', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    const { service, device } = setup(['en-US']);
    await service.ready();

    device.mockReturnValue(['en-GB']);
    window.dispatchEvent(new Event('languagechange'));

    expect(service.translator().locale).toBe('en-GB');
  });

  it('survives storage that throws', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const { service } = setup(['en-US']);
    await service.ready();

    expect(service.preference()).toBe('system');
    await expect(service.setPreference('fr')).resolves.toBeUndefined();
    expect(service.active()).toBe('fr');
  });
});
