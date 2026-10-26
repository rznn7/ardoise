import { inject } from '@angular/core';
import {
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  type GuardResult,
  RedirectCommand,
  Router,
} from '@angular/router';
import { catchError, forkJoin, map, type Observable, of } from 'rxjs';
import { AuthApiService } from 'src/app/auth/auth-api.service';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { MemberApiService } from 'src/app/member/member-api.service';
import { PaymentApiService } from 'src/app/payment/payment-api.service';
import { PaymentDraft } from 'src/app/payment/payment-draft';

const paramOf = (route: ActivatedRouteSnapshot, name: string): string | undefined =>
  route.pathFromRoot.map((r) => r.paramMap.get(name)).find((value) => value !== null) ?? undefined;

export const paymentFlowGuard: CanActivateFn = (route) => {
  const groupId = Number(paramOf(route, 'groupId'));
  const paymentId = paramOf(route, 'paymentId');
  return paymentId === undefined
    ? guardNewStep(groupId, route.routeConfig?.path)
    : guardEditStep(groupId, Number(paymentId));
};

function guardNewStep(
  groupId: number,
  step: string | undefined,
): GuardResult | Observable<GuardResult> {
  const draft = inject(PaymentDraft);
  const router = inject(Router);
  const drafting = draft.active() && draft.mode() === 'new' && draft.groupId() === groupId;
  if (step !== 'amount') {
    return (
      drafting ||
      new RedirectCommand(router.createUrlTree(['/group', groupId, 'payments', 'new', 'amount']), {
        replaceUrl: true,
      })
    );
  }
  if (drafting && router.currentNavigation()?.trigger === 'popstate') return true;

  const groupUrl = router.createUrlTree(['/group', groupId]);
  const enteredDirectly = router.lastSuccessfulNavigation() === null;
  return forkJoin({
    group: inject(ExpenseGroupApiService).findOne({ params: { id: groupId } }),
    members: inject(MemberApiService).listByGroup(groupId),
    me: inject(AuthApiService).me(),
  }).pipe(
    map(({ group, members, me }) => {
      const myMember = members.find((member) => member.userId === me.id);
      if (myMember === undefined) return groupUrl;
      draft.startNew(groupId, members, myMember.id);
      draft.enteredDirectly.set(enteredDirectly);
      draft.group.set(group);
      return true;
    }),
    catchError(() => of(groupUrl)),
  );
}

function guardEditStep(groupId: number, paymentId: number): GuardResult | Observable<GuardResult> {
  const draft = inject(PaymentDraft);
  const router = inject(Router);
  const editing =
    draft.active() &&
    draft.mode() === 'edit' &&
    draft.groupId() === groupId &&
    draft.paymentId() === paymentId;
  if (editing) return true;

  const payments = inject(PaymentApiService);
  const groupUrl = router.createUrlTree(['/group', groupId]);
  const enteredDirectly = router.lastSuccessfulNavigation() === null;
  return forkJoin({
    payment: payments.findOne(paymentId),
    shares: payments.sharesOf(paymentId),
    members: inject(MemberApiService).listByGroup(groupId),
    group: inject(ExpenseGroupApiService).findOne({ params: { id: groupId } }),
    me: inject(AuthApiService).me(),
  }).pipe(
    map(({ payment, shares, members, group, me }) => {
      if (payment.groupId !== groupId) return groupUrl;
      draft.startEdit(payment, shares, members);
      draft.myMemberId.set(members.find((member) => member.userId === me.id)?.id ?? null);
      draft.enteredDirectly.set(enteredDirectly);
      draft.group.set(group);
      return true;
    }),
    catchError(() => of(groupUrl)),
  );
}
