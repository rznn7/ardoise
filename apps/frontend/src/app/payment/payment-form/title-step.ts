import {
  afterNextRender,
  Component,
  computed,
  type ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { defaultTitle } from 'src/app/payment/money-input';
import { NOW, PaymentDraft } from 'src/app/payment/payment-draft';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { GroupChip } from 'src/app/shared/ui/group-chip/group-chip';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { MoneyAmount } from 'src/app/shared/ui/money-amount/money-amount';
import { AppTextImports } from 'src/app/shared/ui/text/text';

const TITLE_MAX_LENGTH = 255;

@Component({
  selector: 'app-title-step',
  imports: [
    MobileShellImports,
    GroupChip,
    MoneyAmount,
    AppTextImports,
    HlmButtonImports,
    HlmIconImports,
    HlmInputImports,
  ],
  providers: [provideIcons({ lucideChevronLeft })],
  templateUrl: './title-step.html',
})
export class TitleStep {
  protected readonly draft = inject(PaymentDraft);
  private readonly router = inject(Router);
  private readonly goBack = injectGoBack();
  private readonly titleInput = viewChild.required<ElementRef<HTMLInputElement>>('titleInput');

  protected readonly placeholder = defaultTitle(inject(NOW)());
  protected readonly maxLength = TITLE_MAX_LENGTH;
  protected readonly editing = computed(() => this.draft.mode() === 'edit');

  constructor() {
    afterNextRender(() => {
      this.titleInput().nativeElement.focus();
    });
  }

  protected back(): void {
    this.goBack(this.editing() ? this.editUrl('options') : this.newUrl('amount'));
  }

  protected next(event: Event): void {
    event.preventDefault();
    if (this.editing()) {
      this.goBack(this.editUrl('options'));
      return;
    }
    void this.router.navigateByUrl(this.newUrl('options'));
  }

  private newUrl(step: string): string {
    return `/group/${String(this.draft.groupId())}/payments/new/${step}`;
  }

  private editUrl(step: string): string {
    return `/group/${String(this.draft.groupId())}/payments/${String(this.draft.paymentId())}/edit/${step}`;
  }
}
