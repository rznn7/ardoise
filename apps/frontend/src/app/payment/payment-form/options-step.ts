import { Location, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { type GroupMember, type SplitType } from '@ardoise/shared';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { formatPercentInput } from 'src/app/payment/money-input';
import { PaymentDraft } from 'src/app/payment/payment-draft';
import { PaymentStore } from 'src/app/payment/payment-store';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { GroupChip } from 'src/app/shared/ui/group-chip/group-chip';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { MoneyAmount } from 'src/app/shared/ui/money-amount/money-amount';
import { Stepper } from 'src/app/shared/ui/stepper/stepper';
import { AppTextImports } from 'src/app/shared/ui/text/text';

interface SplitRow {
  readonly id: number;
  readonly name: string;
}

const SPLIT_MODES: readonly { readonly type: SplitType; readonly label: string }[] = [
  { type: 'equal', label: 'Equally' },
  { type: 'shares', label: 'Shares' },
  { type: 'percent', label: '%' },
  { type: 'exact', label: 'Exact' },
];

const withTextOf = (
  texts: ReadonlyMap<number, string>,
  memberId: number,
  text: string,
): ReadonlyMap<number, string> => new Map(texts).set(memberId, text);

@Component({
  selector: 'app-options-step',
  imports: [
    NgTemplateOutlet,
    MobileShellImports,
    GroupChip,
    MoneyAmount,
    Stepper,
    AppTextImports,
    HlmButtonImports,
    HlmIconImports,
    HlmInputImports,
    HlmNativeSelectImports,
    HlmToggleGroupImports,
  ],
  providers: [provideIcons({ lucideChevronLeft })],
  templateUrl: './options-step.html',
})
export class OptionsStep {
  protected readonly draft = inject(PaymentDraft);
  private readonly store = inject(PaymentStore);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly goBack = injectGoBack();

  protected readonly splitModes = SPLIT_MODES;
  protected readonly editing = computed(() => this.draft.mode() === 'edit');

  protected readonly displayTitle = computed(() => this.draft.toRequest().title);

  protected readonly rows = computed((): readonly SplitRow[] => {
    const me = this.draft.myMemberId();
    const nameOf = (member: GroupMember): string => (member.id === me ? 'You' : member.name);
    const members = this.draft.members();
    return [...members.filter((m) => m.id === me), ...members.filter((m) => m.id !== me)].map(
      (m) => ({ id: m.id, name: nameOf(m) }),
    );
  });

  protected readonly payerValue = computed(() => String(this.draft.payerMemberId() ?? ''));

  protected readonly runningTotal = computed(() => {
    const total = this.draft.runningTotal();
    if (total === null) return null;
    const percentText =
      this.draft.splitType() === 'percent'
        ? `${formatPercentInput(total.entered)} of ${formatPercentInput(total.target)} %`
        : null;
    return { ...total, percentText, over: total.entered > total.target };
  });

  protected back(): void {
    const groupId = String(this.draft.groupId());
    if (this.editing()) {
      this.goBack(`/group/${groupId}/payments/${String(this.draft.paymentId())}`);
      return;
    }
    this.goBack(`/group/${groupId}/payments/new/title`);
  }

  protected openAmount(): void {
    if (this.editing()) {
      void this.router.navigateByUrl(this.editUrl('amount'));
      return;
    }
    this.location.historyGo(-2);
  }

  protected openTitle(): void {
    if (this.editing()) {
      void this.router.navigateByUrl(this.editUrl('title'));
      return;
    }
    this.location.back();
  }

  protected selectPayer(value: string | null | undefined): void {
    if (value) this.draft.payerMemberId.set(Number(value));
  }

  protected selectSplit(value: SplitType | readonly SplitType[] | null | undefined): void {
    const type = typeof value === 'string' ? value : value?.[0];
    if (!type || type === this.draft.splitType()) return;
    this.draft.setSplitType(type);
  }

  protected toggle(memberId: number): void {
    this.draft.included.update((included) => {
      const next = new Set(included);
      if (!next.delete(memberId)) next.add(memberId);
      return next;
    });
  }

  protected weightOf(memberId: number): number {
    return this.draft.weights().get(memberId) ?? 1;
  }

  protected setWeight(memberId: number, weight: number): void {
    this.draft.weights.update((weights) => new Map(weights).set(memberId, weight));
  }

  protected setPercent(memberId: number, text: string): void {
    this.draft.percentTexts.update((texts) => withTextOf(texts, memberId, text));
  }

  protected setExact(memberId: number, text: string): void {
    this.draft.exactTexts.update((texts) => withTextOf(texts, memberId, text));
  }

  protected shareOf(memberId: number): number {
    return this.draft.preview().get(memberId) ?? 0;
  }

  protected save(): void {
    if (!this.draft.valid()) return;
    const body = this.draft.toRequest();
    if (this.editing()) {
      const paymentId = this.draft.paymentId();
      if (paymentId === null) return;
      this.store.update(this.draft.groupId(), paymentId, body);
      this.leave(`/group/${String(this.draft.groupId())}/payments/${String(paymentId)}`, -1);
      return;
    }
    this.store.create({ ...body, groupId: this.draft.groupId() });
    this.leave(`/group/${String(this.draft.groupId())}`, -3);
  }

  private leave(url: string, historySteps: number): void {
    const enteredDirectly = this.draft.enteredDirectly();
    this.draft.clear();
    if (enteredDirectly) {
      void this.router.navigateByUrl(url, { replaceUrl: true });
      return;
    }
    this.location.historyGo(historySteps);
  }

  private editUrl(step: string): string {
    return `/group/${String(this.draft.groupId())}/payments/${String(this.draft.paymentId())}/edit/${step}`;
  }
}
