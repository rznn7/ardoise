import { Component, inject, output, signal } from '@angular/core';
import { type ExpenseGroupSummary } from '@ardoise/shared';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { InviteLinkPanel } from 'src/app/invite-link/invite-link-panel/invite-link-panel';
import { AppTextImports } from 'src/app/shared/ui/text/text';

type SheetState =
  { step: 'form'; status: 'idle' | 'submitting' | 'error' } | { step: 'invite'; groupId: number };

@Component({
  selector: 'app-create-group-sheet',
  imports: [
    HlmButtonImports,
    HlmSheetImports,
    HlmFieldImports,
    HlmInputImports,
    HlmNativeSelectImports,
    AppTextImports,
    InviteLinkPanel,
  ],
  templateUrl: './create-group-sheet.html',
})
export class CreateGroupSheet {
  private readonly expenseGroupApi = inject(ExpenseGroupApiService);

  readonly created = output<ExpenseGroupSummary>();
  readonly closed = output();

  readonly name = signal('');
  readonly currencyCode = signal('EUR');
  readonly state = signal<SheetState>({ step: 'form', status: 'idle' });

  create(): void {
    const state = this.state();
    if (state.step !== 'form' || state.status === 'submitting') return;

    this.state.set({ step: 'form', status: 'submitting' });
    this.expenseGroupApi
      .create({ body: { name: this.name(), currencyCode: this.currencyCode() } })
      .subscribe({
        next: (summary) => {
          this.created.emit(summary);
          this.state.set({ step: 'invite', groupId: summary.id });
        },
        error: () => {
          this.state.set({ step: 'form', status: 'error' });
        },
      });
  }

  done(): void {
    this.closed.emit();
  }
}
