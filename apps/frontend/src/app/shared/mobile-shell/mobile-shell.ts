import { Component, contentChild, Directive } from '@angular/core';

@Directive({ selector: '[appShellHeader]' })
export class ShellHeader {}

@Directive({ selector: '[appShellFab]' })
export class ShellFab {}

@Component({
  selector: 'app-mobile-shell',
  imports: [],
  host: {
    class:
      'flex h-[100dvh] justify-center bg-background pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]',
  },
  templateUrl: './mobile-shell.html',
})
export class MobileShell {
  protected readonly header = contentChild(ShellHeader);
  protected readonly fab = contentChild(ShellFab);
}

export const MobileShellImports = [MobileShell, ShellHeader, ShellFab] as const;
