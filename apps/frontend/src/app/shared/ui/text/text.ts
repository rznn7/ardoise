import { Directive } from '@angular/core';
import { classes } from '@spartan-ng/helm/utils';

@Directive({ selector: '[appTitle]' })
export class AppTitle {
  constructor() {
    classes(() => 'text-xl font-medium tracking-tight break-words');
  }
}

@Directive({ selector: '[appBody]' })
export class AppBody {
  constructor() {
    classes(() => 'text-sm leading-relaxed');
  }
}

@Directive({ selector: '[appMeta]' })
export class AppMeta {
  constructor() {
    classes(() => 'text-xs text-muted-foreground');
  }
}

@Directive({ selector: '[appError]' })
export class AppError {
  constructor() {
    classes(() => 'text-sm text-destructive');
  }
}

@Directive({ selector: '[appEyebrow]' })
export class AppEyebrow {
  constructor() {
    classes(() => 'text-xs font-medium tracking-wider uppercase');
  }
}

@Directive({ selector: '[appFigure]' })
export class AppFigure {
  constructor() {
    classes(() => 'text-4xl font-light tracking-tighter break-words tabular-nums');
  }
}

export const AppTextImports = [
  AppTitle,
  AppBody,
  AppMeta,
  AppError,
  AppEyebrow,
  AppFigure,
] as const;
