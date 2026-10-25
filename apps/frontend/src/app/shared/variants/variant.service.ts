import { computed, Injectable, type Signal, signal, type WritableSignal } from '@angular/core';

export type Variant = 'a' | 'b';

export interface RegisteredVariant {
  key: string;
  label: string;
}

const storageKey = (key: string): string => `ardoise.variant.${key}`;

function readVariant(key: string): Variant {
  try {
    return localStorage.getItem(storageKey(key)) === 'b' ? 'b' : 'a';
  } catch {
    return 'a';
  }
}

function writeVariant(key: string, variant: Variant): void {
  try {
    localStorage.setItem(storageKey(key), variant);
  } catch {
    return;
  }
}

@Injectable({ providedIn: 'root' })
export class VariantService {
  private readonly variants = new Map<string, WritableSignal<Variant>>();
  private readonly registeredState = signal<RegisteredVariant[]>([]);

  readonly registered = this.registeredState.asReadonly();

  register(key: string, label: string): void {
    if (this.registeredState().some((entry) => entry.key === key)) return;
    this.registeredState.update((entries) => [...entries, { key, label }]);
  }

  variant(key: string): Signal<Variant> {
    return computed(() => this.state(key)());
  }

  toggle(key: string): void {
    this.set(key, this.state(key)() === 'a' ? 'b' : 'a');
  }

  set(key: string, variant: Variant): void {
    this.state(key).set(variant);
    writeVariant(key, variant);
  }

  private state(key: string): WritableSignal<Variant> {
    let state = this.variants.get(key);
    if (!state) {
      state = signal(readVariant(key));
      this.variants.set(key, state);
    }
    return state;
  }
}
