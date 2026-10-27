import { Directive, ElementRef, inject, input, output, signal } from '@angular/core';

export const PULL_THRESHOLD = 64;
const PULL_MAX = 96;
const RESISTANCE = 0.5;

@Directive({
  selector: '[appPullToRefresh]',
  exportAs: 'appPullToRefresh',
  host: {
    '(pointerdown)': 'onPointer($event, "start")',
    '(pointermove)': 'onPointer($event, "move")',
    '(pointerup)': 'onPointer($event, "end")',
    '(pointercancel)': 'cancel()',
    '(touchstart)': 'onTouch($event, "start")',
    '(touchmove)': 'onTouch($event, "move")',
    '(touchend)': 'end()',
    '(touchcancel)': 'cancel()',
  },
})
export class PullToRefresh {
  readonly enabled = input(true, {
    alias: 'appPullToRefresh',
    transform: (v: boolean | '') => v !== false,
  });
  readonly pulled = output();

  readonly distance = signal(0);

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private startY: number | null = null;

  protected onPointer(event: PointerEvent, phase: 'start' | 'move' | 'end'): void {
    if (event.pointerType === 'touch') return;
    if (phase === 'start') this.start(event.clientY);
    else if (phase === 'move') this.move(event.clientY);
    else this.end();
  }

  protected onTouch(event: TouchEvent, phase: 'start' | 'move'): void {
    const touch = event.touches.item(0);
    if (!touch) return;
    if (phase === 'start') this.start(touch.clientY);
    else this.move(touch.clientY);
  }

  protected end(): void {
    const reached = this.distance() >= PULL_THRESHOLD;
    this.cancel();
    if (reached) this.pulled.emit();
  }

  protected cancel(): void {
    this.startY = null;
    this.distance.set(0);
  }

  private start(y: number): void {
    this.startY = this.enabled() && this.element.scrollTop <= 0 ? y : null;
  }

  private move(y: number): void {
    if (this.startY === null) return;
    const pulled = Math.max(0, y - this.startY) * RESISTANCE;
    if (pulled > 0) this.element.ownerDocument.getSelection()?.removeAllRanges();
    this.distance.set(Math.min(pulled, PULL_MAX));
  }
}
