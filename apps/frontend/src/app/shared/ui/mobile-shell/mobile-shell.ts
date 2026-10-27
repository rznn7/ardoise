import {
  booleanAttribute,
  Component,
  contentChild,
  Directive,
  type ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { PullToRefresh } from 'src/app/shared/ui/pull-to-refresh/pull-to-refresh';

@Directive({ selector: '[appShellHeader]' })
export class ShellHeader {}

@Directive({ selector: '[appShellFab]' })
export class ShellFab {}

@Component({
  selector: 'app-mobile-shell',
  imports: [PullToRefresh, HlmSpinnerImports],
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
  readonly refreshable = input(false, { transform: booleanAttribute });
  readonly refreshing = input(false, { transform: booleanAttribute });
  readonly refresh = output();

  protected readonly header = contentChild(ShellHeader);
  protected readonly fab = contentChild(ShellFab);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  private lastScrollTop = 0;

  scrollTop(): number {
    return this.lastScrollTop;
  }

  scrollTo(top: number): void {
    this.main().nativeElement.scrollTop = top;
    this.lastScrollTop = this.main().nativeElement.scrollTop;
  }

  protected scrolled(): void {
    this.lastScrollTop = this.main().nativeElement.scrollTop;
  }
}

export const MobileShellImports = [MobileShell, ShellHeader, ShellFab] as const;
