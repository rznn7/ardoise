import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { injectGoBack } from './back';

@Component({ template: '' })
class Blank {}

async function setup(): Promise<{
  harness: RouterTestingHarness;
  goBack: (fallback: string) => void;
}> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'home', component: Blank },
        { path: 'group/:groupId', component: Blank },
      ]),
    ],
  });
  const harness = await RouterTestingHarness.create();
  const goBack = TestBed.runInInjectionContext(() => injectGoBack());
  return { harness, goBack };
}

describe('injectGoBack', () => {
  it('goes back in history when the app navigated here from another page', async () => {
    const { harness, goBack } = await setup();
    await harness.navigateByUrl('/home');
    await harness.navigateByUrl('/group/1');
    const back = vi.spyOn(TestBed.inject(Location), 'back');

    goBack('/home');

    expect(back).toHaveBeenCalledTimes(1);
  });

  it('replaces the url with the fallback when this is the first page of the app', async () => {
    const { harness, goBack } = await setup();
    await harness.navigateByUrl('/group/1');
    const back = vi.spyOn(TestBed.inject(Location), 'back');
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    goBack('/home');

    expect(back).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/home', { replaceUrl: true });
  });
});
