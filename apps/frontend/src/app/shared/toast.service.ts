import { Injectable } from '@angular/core';
import { toast } from '@spartan-ng/brain/sonner';

@Injectable({ providedIn: 'root' })
export class ToastService {
  message(text: string): void {
    toast(text);
  }

  error(message: string): void {
    toast.error(message);
  }
}
