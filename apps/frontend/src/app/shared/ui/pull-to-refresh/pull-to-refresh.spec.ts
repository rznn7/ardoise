import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { PULL_THRESHOLD, PullToRefresh } from './pull-to-refresh';

@Component({
  imports: [PullToRefresh],
  template: `<div appPullToRefresh (pulled)="pulled()"></div>`,
})
class Host {
  readonly pull = viewChild.required(PullToRefresh);
  readonly pulled = vi.fn();
}

const pointer = (type: string, clientY: number): Event => {
  const event = new MouseEvent(type, { clientY, bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'mouse' });
  return event;
};

describe(PullToRefresh.name, () => {
  const render = async (scrollTop = 0) => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = (fixture.nativeElement as HTMLElement).querySelector('div');
    if (!element) throw new Error('no element');
    Object.defineProperty(element, 'scrollTop', { value: scrollTop });
    return { fixture, element };
  };

  const drag = (element: Element, distance: number) => {
    element.dispatchEvent(pointer('pointerdown', 100));
    element.dispatchEvent(pointer('pointermove', 100 + distance));
    element.dispatchEvent(pointer('pointerup', 100 + distance));
  };

  it('emits pulled when released past the threshold at the top', async () => {
    const { fixture, element } = await render();

    drag(element, PULL_THRESHOLD * 3);

    expect(fixture.componentInstance.pulled).toHaveBeenCalledTimes(1);
  });

  it('follows the finger with resistance while pulling', async () => {
    const { fixture, element } = await render();

    element.dispatchEvent(pointer('pointerdown', 100));
    element.dispatchEvent(pointer('pointermove', 140));

    expect(fixture.componentInstance.pull().distance()).toBe(20);
  });

  it('does nothing below the threshold', async () => {
    const { fixture, element } = await render();

    drag(element, PULL_THRESHOLD);

    expect(fixture.componentInstance.pulled).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pull().distance()).toBe(0);
  });

  it('does nothing when the list is scrolled', async () => {
    const { fixture, element } = await render(50);

    drag(element, PULL_THRESHOLD * 3);

    expect(fixture.componentInstance.pulled).not.toHaveBeenCalled();
  });
});
