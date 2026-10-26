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
import { lucideChevronLeft, lucideX } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { PaymentDraft } from 'src/app/payment/payment-draft';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { FigureInput } from 'src/app/shared/ui/figure-input/figure-input';
import { GroupChip } from 'src/app/shared/ui/group-chip/group-chip';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { AppTextImports } from 'src/app/shared/ui/text/text';

@Component({
  selector: 'app-amount-step',
  imports: [
    MobileShellImports,
    GroupChip,
    FigureInput,
    AppTextImports,
    HlmButtonImports,
    HlmIconImports,
  ],
  providers: [provideIcons({ lucideChevronLeft, lucideX })],
  templateUrl: './amount-step.html',
})
export class AmountStep {
  protected readonly draft = inject(PaymentDraft);
  private readonly router = inject(Router);
  private readonly goBack = injectGoBack();
  private readonly amountInput = viewChild.required<ElementRef<HTMLInputElement>>('amountInput');

  protected readonly editing = computed(() => this.draft.mode() === 'edit');
  protected readonly canContinue = computed(() => this.draft.amountCents() !== null);

  constructor() {
    afterNextRender(() => {
      this.amountInput().nativeElement.focus();
    });
  }

  protected cancel(): void {
    const groupId = this.draft.groupId();
    this.draft.clear();
    this.goBack(`/group/${String(groupId)}`);
  }

  protected backToOptions(): void {
    this.goBack(this.optionsUrl());
  }

  protected next(event: Event): void {
    event.preventDefault();
    if (!this.canContinue()) return;
    if (this.editing()) {
      this.goBack(this.optionsUrl());
      return;
    }
    void this.router.navigate(['/group', this.draft.groupId(), 'payments', 'new', 'title']);
  }

  private optionsUrl(): string {
    return `/group/${String(this.draft.groupId())}/payments/${String(this.draft.paymentId())}/edit/options`;
  }
}
