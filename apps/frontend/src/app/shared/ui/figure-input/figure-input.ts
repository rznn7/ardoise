import { Directive } from '@angular/core';
import { HlmInput } from '@spartan-ng/helm/input';
import { classes } from '@spartan-ng/helm/utils';

@Directive({
  selector: 'input[appFigureInput]',
  hostDirectives: [HlmInput],
})
export class FigureInput {
  constructor() {
    classes(() => 'h-16 px-3 text-4xl font-light tracking-tighter tabular-nums md:text-4xl');
  }
}
