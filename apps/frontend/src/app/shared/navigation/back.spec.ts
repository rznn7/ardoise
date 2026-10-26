import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';

import { injectGoBack, withHistoryPageIds } from './back';
import { openFirstPage } from './first-page.testing';

@Component({ template: '' })
class Blank {}

async function setup(firstUrl: string): Promise<{
  harness: RouterTestingHarness;
  goBack: (fallback: string) => void;
  location: Location;
  router: Router;
}> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'home', component: Blank },
          { path: 'group/:groupId', component: Blank },
          { path: 'group/:groupId/payments/:paymentId', component: Blank },
        ],
        withHistoryPageIds(),
      ),
    ],
  });
  const harness = await RouterTestingHarness.create();
  const location = TestBed.inject(Location);
  const router = TestBed.inject(Router);
  router.setUpLocationChangeListener();
  await openFirstPage(harness, firstUrl);
  const goBack = TestBed.runInInjectionContext(() => injectGoBack());
  return { harness, goBack, location, router };
}

describe('injectGoBack', () => {
  it('goes back in history when the app navigated here from another page', async () => {
    const { harness, goBack, location } = await setup('/home');
    await harness.navigateByUrl('/group/1');
    const back = vi.spyOn(location, 'back');

    goBack('/home');

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('replaces the url with the fallback when this is the first page of the app', async () => {
    const { goBack, location, router } = await setup('/group/1');
    const back = vi.spyOn(location, 'back');
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl');

    goBack('/home');

    expect(back).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('falls back once the user went back to the first page of the app', async () => {
    const { harness, goBack, location, router } = await setup('/group/1');
    await harness.navigateByUrl('/group/1/payments/5');
    const ended = firstValueFrom(router.events.pipe(filter((e) => e instanceof NavigationEnd)));
    location.back();
    await ended;
    expect(router.url).toBe('/group/1');
    const back = vi.spyOn(location, 'back');
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl');

    goBack('/home');

    expect(back).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });

  it('falls back on a page that replaced the first page of the app', async () => {
    const { goBack, location, router } = await setup('/group/1');
    await router.navigateByUrl('/group/1/payments/5', { replaceUrl: true });
    const back = vi.spyOn(location, 'back');
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl');

    goBack('/group/1');

    expect(back).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/group/1', { replaceUrl: true });
  });
});
