import { Injectable, isDevMode } from '@angular/core';
import { type TranslocoMissingHandler } from '@jsverse/transloco';

@Injectable()
export class StrictMissingHandler implements TranslocoMissingHandler {
  handle(key: string): string {
    if (isDevMode()) throw new Error(`Missing translation: ${key}`);
    return key;
  }
}
