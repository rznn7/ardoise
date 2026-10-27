import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { screen } from '@testing-library/angular';
import { type More } from 'src/app/shared/paged-list';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LoadMore } from './load-more';

class FakeObserver {
  static instances: FakeObserver[] = [];
  readonly targets: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.targets.push(target);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  enter(): void {
    this.callback(
      this.targets.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry),
      this as unknown as IntersectionObserver,
    );
  }
}

@Component({
  imports: [LoadMore],
  template: `<app-load-more [state]="state()" (reached)="load()" (retry)="retry()" />`,
})
class Host {
  readonly state = signal<More>('idle');
  readonly load = vi.fn();
  readonly retry = vi.fn();
}

describe(LoadMore.name, () => {
  beforeEach(() => {
    FakeObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const render = async (state: More) => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.state.set(state);
    await fixture.whenStable();
    return fixture;
  };

  const liveObserver = () => FakeObserver.instances.filter((o) => !o.disconnected).at(-1);

  it('asks for more when the end of the list comes into view', async () => {
    const fixture = await render('idle');

    liveObserver()?.enter();

    expect(fixture.componentInstance.load).toHaveBeenCalledTimes(1);
  });

  it('shows a spinner and asks nothing while a page loads', async () => {
    const fixture = await render('loading');

    expect(screen.getByRole('status', { name: 'Loading more' })).toBeTruthy();
    expect(liveObserver()).toBeUndefined();
    expect(fixture.componentInstance.load).not.toHaveBeenCalled();
  });

  it('offers a retry when the page failed', async () => {
    const fixture = await render('error');

    expect(screen.getByText("Couldn't load more")).toBeTruthy();
    screen.getByRole('button', { name: 'Retry' }).click();

    expect(fixture.componentInstance.retry).toHaveBeenCalledTimes(1);
  });

  it('renders nothing at the end', async () => {
    const fixture = await render('end');

    expect((fixture.nativeElement as HTMLElement).textContent.trim()).toBe('');
    expect(liveObserver()).toBeUndefined();
  });

  it('watches again once the next page has loaded', async () => {
    const fixture = await render('idle');
    fixture.componentInstance.state.set('loading');
    await fixture.whenStable();
    fixture.componentInstance.state.set('idle');
    await fixture.whenStable();

    liveObserver()?.enter();

    expect(fixture.componentInstance.load).toHaveBeenCalledTimes(1);
    expect(FakeObserver.instances.length).toBe(2);
  });
});
