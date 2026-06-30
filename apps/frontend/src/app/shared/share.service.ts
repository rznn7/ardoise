import { Injectable } from '@angular/core';
import { defer, type Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ShareService {
  canShare(): boolean {
    return typeof navigator.share === 'function';
  }

  share(data: { url: string }): Observable<void> {
    return defer(() => navigator.share(data));
  }
}
