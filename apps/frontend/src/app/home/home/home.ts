import { Component, computed, inject, signal } from '@angular/core';
import { type ExpenseGroupSummary } from '@ardoise/shared';
import { provideIcons } from '@ng-icons/core';
import { lucidePlus } from '@ng-icons/lucide';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { CreateGroupSheet } from 'src/app/expense-group/create-group-sheet/create-group-sheet';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { GroupFade } from 'src/app/shared/ui/backdrop/group-fade';
import { ListRowImports } from 'src/app/shared/ui/list-row/list-row';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { PageStateImports } from 'src/app/shared/ui/page-state/page-state';
import { AppTextImports } from 'src/app/shared/ui/text/text';

type HomeState =
  { status: 'loading' } | { status: 'loaded'; groups: ExpenseGroupSummary[] } | { status: 'error' };

@Component({
  selector: 'app-home',
  imports: [
    MobileShellImports,
    HlmIconImports,
    PageStateImports,
    ListRowImports,
    GroupFade,
    AppTextImports,
    HlmButtonImports,
    HlmSheetImports,
    BrnSheetImports,
    CreateGroupSheet,
  ],
  templateUrl: './home.html',
  providers: [provideIcons({ lucidePlus })],
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
