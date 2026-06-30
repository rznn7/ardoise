import { Component, computed, inject, signal } from '@angular/core';
import { type ExpenseGroupSummary } from '@ardoise/shared';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { CreateGroupSheet } from 'src/app/expense-group/create-group-sheet/create-group-sheet';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { MobileShellImports } from 'src/app/shared/mobile-shell/mobile-shell';

type HomeState =
  | { status: 'loading' }
  | { status: 'loaded'; groups: ExpenseGroupSummary[] }
  | { status: 'error' };

@Component({
  selector: 'app-home',
  imports: [
    MobileShellImports,
    HlmSpinnerImports,
    HlmButtonImports,
    HlmSheetImports,
    BrnSheetImports,
    CreateGroupSheet,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly expenseGroupApi = inject(ExpenseGroupApiService);

  readonly state = signal<HomeState>({ status: 'loading' });

  readonly groups = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.groups : [];
  });

  constructor() {
    this.load();
  }

  retry(): void {
    this.load();
  }

  refresh(): void {
    this.load({ silent: true });
  }

  private load(options?: { silent?: boolean }): void {
    if (!options?.silent) this.state.set({ status: 'loading' });
    this.expenseGroupApi.listMine().subscribe({
      next: (groups) => {
        this.state.set({ status: 'loaded', groups });
      },
      error: () => {
        this.state.set({ status: 'error' });
      },
    });
  }
}
