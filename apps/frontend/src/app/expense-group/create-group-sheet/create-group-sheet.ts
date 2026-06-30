import { Component, inject, output, signal } from '@angular/core';
import { type ExpenseGroupSummary } from '@ardoise/shared';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { InviteLinkApiService } from 'src/app/invite-link/invite-link-api.service';
import { ClipboardService } from 'src/app/shared/clipboard.service';
import { ShareService } from 'src/app/shared/share.service';

type SheetState =
  | { step: 'form'; status: 'idle' | 'submitting' | 'error' }
  | { step: 'invite'; status: 'idle' | 'submitting' | 'error'; url: string | null };

const INVITE_EXPIRY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-create-group-sheet',
  imports: [HlmButtonImports, HlmIconImports, HlmSheetImports],
  providers: [provideIcons({ lucideCopy, lucideCheck })],
  templateUrl: './create-group-sheet.html',
})
export class CreateGroupSheet {
  private readonly expenseGroupApi = inject(ExpenseGroupApiService);
  private readonly inviteLinkApi = inject(InviteLinkApiService);
  private readonly clipboard = inject(ClipboardService);
  private readonly share = inject(ShareService);

  readonly created = output<ExpenseGroupSummary>();
  readonly closed = output();

  readonly name = signal('');
  readonly currencyCode = signal('EUR');
  readonly state = signal<SheetState>({ step: 'form', status: 'idle' });
  readonly copied = signal(false);
  readonly sharedViaCopy = signal(false);

  private createdSummary: ExpenseGroupSummary | null = null;

  create(): void {
    const state = this.state();
    if (state.step !== 'form' || state.status === 'submitting') return;

    this.state.set({ step: 'form', status: 'submitting' });
    this.expenseGroupApi
      .create({ body: { name: this.name(), currencyCode: this.currencyCode() } })
      .subscribe({
        next: (summary) => {
          this.createdSummary = summary;
          this.created.emit(summary);
          this.createInvite(summary);
        },
        error: () => {
          this.state.set({ step: 'form', status: 'error' });
        },
      });
  }

  retryInvite(): void {
    if (this.createdSummary === null) {
      throw new Error(`🚧 work in progress`);
    }
    this.createInvite(this.createdSummary);
  }

  done(): void {
    this.closed.emit();
  }

  copyLink(): void {
    const state = this.state();
    if (state.step !== 'invite' || state.url === null) {
      throw new Error(`🚧 work in progress`);
    }
    this.clipboard.writeText(state.url).subscribe(() => {
      this.copied.set(true);
    });
  }

  shareLink(): void {
    const state = this.state();
    if (state.step !== 'invite' || state.url === null) {
      throw new Error(`🚧 work in progress`);
    }
    const url = state.url;
    if (this.share.canShare()) {
      this.share.share({ url }).subscribe();
      return;
    }
    this.clipboard.writeText(url).subscribe(() => {
      this.sharedViaCopy.set(true);
    });
  }

  private createInvite(summary: ExpenseGroupSummary): void {
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS).toISOString();
    this.state.set({ step: 'invite', status: 'submitting', url: null });
    this.inviteLinkApi
      .create({ body: { groupId: summary.id, singleUse: false, expiresAt } })
      .subscribe({
        next: ({ token }) => {
          this.state.set({
            step: 'invite',
            status: 'idle',
            url: `${location.origin}/register?token=${token}`,
          });
        },
        error: () => {
          this.state.set({ step: 'invite', status: 'error', url: null });
        },
      });
  }
}
