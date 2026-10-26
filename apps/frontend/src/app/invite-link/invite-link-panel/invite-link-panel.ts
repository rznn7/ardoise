import { Component, inject, input, type OnInit, output, signal } from '@angular/core';
import { provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideCopy } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmFieldImports } from '@spartan-ng/helm/field';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { InviteLinkApiService } from 'src/app/invite-link/invite-link-api.service';
import { ClipboardService } from 'src/app/shared/clipboard.service';
import { ShareService } from 'src/app/shared/share.service';
import { AppTextImports } from 'src/app/shared/ui/text/text';

type PanelState = { status: 'creating' } | { status: 'error' } | { status: 'ready'; url: string };

const INVITE_EXPIRY_MS = 24 * 60 * 60 * 1000;

@Component({
  selector: 'app-invite-link-panel',
  imports: [HlmButtonImports, HlmIconImports, HlmFieldImports, HlmInputImports, AppTextImports],
  providers: [provideIcons({ lucideCopy, lucideCheck })],
  host: { class: 'flex flex-col gap-4' },
  templateUrl: './invite-link-panel.html',
})
export class InviteLinkPanel implements OnInit {
  private readonly inviteLinkApi = inject(InviteLinkApiService);
  private readonly clipboard = inject(ClipboardService);
  private readonly share = inject(ShareService);

  readonly groupId = input.required<number>();
  readonly done = output();

  readonly state = signal<PanelState>({ status: 'creating' });
  readonly copied = signal(false);
  readonly sharedViaCopy = signal(false);

  ngOnInit(): void {
    this.createLink();
  }

  createLink(): void {
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS).toISOString();
    this.state.set({ status: 'creating' });
    this.inviteLinkApi
      .create({ body: { groupId: this.groupId(), singleUse: false, expiresAt } })
      .subscribe({
        next: ({ token }) => {
          this.state.set({ status: 'ready', url: `${location.origin}/join?token=${token}` });
        },
        error: () => {
          this.state.set({ status: 'error' });
        },
      });
  }

  copyLink(url: string): void {
    this.clipboard.writeText(url).subscribe(() => {
      this.copied.set(true);
    });
  }

  shareLink(url: string): void {
    if (this.share.canShare()) {
      this.share.share({ url }).subscribe();
      return;
    }
    this.clipboard.writeText(url).subscribe(() => {
      this.sharedViaCopy.set(true);
    });
  }
}
