import { Component, contentChild, Directive } from '@angular/core';

@Directive({ selector: '[appShellHeader]' })
export class ShellHeader {}

@Component({
  selector: 'app-mobile-shell',
  imports: [],
  host: {
    class:
      'flex h-[100dvh] justify-center bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]',
  },
  template: `
    <div
      class="relative flex h-full w-full max-w-[420px] flex-col overflow-hidden border-x border-border shadow-sm"
    >
      @if (header()) {
        <header class="sticky top-0 z-10">
          <ng-content select="[appShellHeader]" />
        </header>
      }
      <main class="flex-1 overflow-y-auto overscroll-contain">
        <ng-content />
      </main>
    </div>
  `,
})
export class MobileShell {
  protected readonly header = contentChild(ShellHeader);
}

export const MobileShellImports = [MobileShell, ShellHeader] as const;
