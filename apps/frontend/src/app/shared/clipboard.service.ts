import { Injectable } from '@angular/core';
import { defer, type Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ClipboardService {
  writeText(text: string): Observable<void> {
    return defer(() => navigator.clipboard.writeText(text));
  }
}
