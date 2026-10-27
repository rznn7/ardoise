import {
  booleanAttribute,
  Component,
  contentChild,
  Directive,
  type ElementRef,
  input,
  viewChild,
} from '@angular/core';

@Directive({ selector: '[appShellHeader]' })
export class ShellHeader {}

@Directive({ selector: '[appShellFab]' })
export class ShellFab {}

@Component({
  selector: 'app-mobile-shell',
  imports: [],
  host: {
    class: 'flex h-[100dvh] justify-center bg-background',
    '[class.pt-[env(safe-area-inset-top)]]': '!bleed()',
    '[class.pr-[env(safe-area-inset-right)]]': '!bleed()',
    '[class.pb-[env(safe-area-inset-bottom)]]': '!bleed()',
    '[class.pl-[env(safe-area-inset-left)]]': '!bleed()',
  },
  templateUrl: './mobile-shell.html',
})
export class MobileShell {
  readonly bleed = input(false, { transform: booleanAttribute });

  protected readonly header = contentChild(ShellHeader);
  protected readonly fab = contentChild(ShellFab);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  scrollTop(): number {
    return this.main().nativeElement.scrollTop;
  }

  scrollTo(top: number): void {
    this.main().nativeElement.scrollTop = top;
  }
}

export const MobileShellImports = [MobileShell, ShellHeader, ShellFab] as const;
