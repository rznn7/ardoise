import {
  afterNextRender,
  Component,
  computed,
  type ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideX } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { cashRegisterText } from 'src/app/payment/money-input';
import { PaymentDraft } from 'src/app/payment/payment-draft';
import { LanguageService } from 'src/app/shared/i18n/language.service';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { FigureInput } from 'src/app/shared/ui/figure-input/figure-input';
import { GroupChip } from 'src/app/shared/ui/group-chip/group-chip';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { AppTextImports } from 'src/app/shared/ui/text/text';

const editedText = (event: Event, value: string, previous: string): string => {
  if (!(event instanceof InputEvent)) return value;
  const { inputType, data } = event;
  if (inputType === 'insertText' && data !== null && value !== data) return previous + data;
  if (inputType.startsWith('deleteContent') && value !== '') return previous.slice(0, -1);
  return value;
};

@Component({
  selector: 'app-amount-step',
  imports: [
    TranslocoDirective,
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
  private readonly language = inject(LanguageService);
  private readonly goBack = injectGoBack();
  private readonly amountInput = viewChild.required<ElementRef<HTMLInputElement>>('amountInput');

  protected readonly editing = computed(() => this.draft.mode() === 'edit');
  protected readonly canContinue = computed(() => this.draft.amountCents() !== null);

  constructor() {
    afterNextRender(() => {
      this.amountInput().nativeElement.focus();
    });
  }

  protected typeAmount(event: Event): void {
    const input = this.amountInput().nativeElement;
    const previous = this.draft.amountText();
    const text = cashRegisterText(
      editedText(event, input.value, previous),
      previous,
      this.language.translator().locale,
    );
    this.draft.amountText.set(text);
    input.value = text;
    this.caretToEnd();
  }

  protected caretToEnd(): void {
    const input = this.amountInput().nativeElement;
    input.setSelectionRange(input.value.length, input.value.length);
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
