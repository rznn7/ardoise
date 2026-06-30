import { type CreateInviteLinkResponse, type ExpenseGroupSummary } from '@ardoise/shared';
import { BrnDialogRef } from '@spartan-ng/brain/dialog';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, Subject, throwError } from 'rxjs';
import { ExpenseGroupApiService } from 'src/app/expense-group/expense-group-api.service';
import { InviteLinkApiService } from 'src/app/invite-link/invite-link-api.service';
import { ClipboardService } from 'src/app/shared/clipboard.service';
import { ShareService } from 'src/app/shared/share.service';

import { CreateGroupSheet } from './create-group-sheet';

const SUMMARY: ExpenseGroupSummary = {
  id: 7,
  name: 'Trip',
  currencyCode: 'EUR',
  createdAt: '2026-01-01T00:00:00.000Z',
};

type CreateMock = ReturnType<typeof vi.fn<() => Observable<ExpenseGroupSummary>>>;
type InviteCreateMock = ReturnType<typeof vi.fn<() => Observable<CreateInviteLinkResponse>>>;
type WriteTextMock = ReturnType<typeof vi.fn<(text: string) => Observable<void>>>;
type CanShareMock = ReturnType<typeof vi.fn<() => boolean>>;
type ShareMock = ReturnType<typeof vi.fn<(data: { url: string }) => Observable<void>>>;
type CreatedSpy = ReturnType<typeof vi.fn<(summary: ExpenseGroupSummary) => void>>;
type ClosedSpy = ReturnType<typeof vi.fn<() => void>>;

async function setup({
  create = vi.fn<() => Observable<ExpenseGroupSummary>>().mockReturnValue(of(SUMMARY)),
  inviteCreate = vi
    .fn<() => Observable<CreateInviteLinkResponse>>()
    .mockReturnValue(of({ token: 'abc' })),
  writeText = vi.fn<(text: string) => Observable<void>>().mockReturnValue(of(undefined)),
  canShare = vi.fn<() => boolean>().mockReturnValue(false),
  share = vi.fn<(data: { url: string }) => Observable<void>>().mockReturnValue(of(undefined)),
  onCreated = vi.fn<(summary: ExpenseGroupSummary) => void>(),
  onClosed = vi.fn<() => void>(),
}: {
  create?: CreateMock;
  inviteCreate?: InviteCreateMock;
  writeText?: WriteTextMock;
  canShare?: CanShareMock;
  share?: ShareMock;
  onCreated?: CreatedSpy;
  onClosed?: ClosedSpy;
} = {}): Promise<{
  create: CreateMock;
  inviteCreate: InviteCreateMock;
  writeText: WriteTextMock;
  canShare: CanShareMock;
  share: ShareMock;
  onCreated: CreatedSpy;
  onClosed: ClosedSpy;
  component: CreateGroupSheet;
}> {
  const { fixture } = await render(CreateGroupSheet, {
    providers: [
      { provide: ExpenseGroupApiService, useValue: { create } },
      { provide: InviteLinkApiService, useValue: { create: inviteCreate } },
      { provide: ClipboardService, useValue: { writeText } },
      { provide: ShareService, useValue: { canShare, share } },
      {
        provide: BrnDialogRef,
        useValue: { dialogId: 'sheet', setAriaLabelledBy: () => undefined },
      },
    ],
    on: { created: onCreated, closed: onClosed },
  });
  return {
    create,
    inviteCreate,
    writeText,
    canShare,
    share,
    onCreated,
    onClosed,
    component: fixture.componentInstance,
  };
}

describe('CreateGroupSheet', () => {
  it('create is disabled until a name is entered', async () => {
    await setup();

    const createButton = screen.getByRole<HTMLButtonElement>('button', { name: /create/i });
    expect(createButton.disabled).toBe(true);

    await userEvent.type(screen.getByLabelText(/name/i), 'Trip');

    expect(createButton.disabled).toBe(false);
  });

  it('creates the group with the entered name and selected currency', async () => {
    const { create } = await setup();

    await userEvent.type(screen.getByLabelText(/name/i), 'Trip');
    await userEvent.selectOptions(screen.getByLabelText(/currency/i), 'USD');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(create).toHaveBeenCalledWith({ body: { name: 'Trip', currencyCode: 'USD' } });
  });

  it('emits created with the returned summary', async () => {
    const { onCreated } = await setup({
      create: vi.fn<() => Observable<ExpenseGroupSummary>>().mockReturnValue(of(SUMMARY)),
    });

    await userEvent.type(screen.getByLabelText(/name/i), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(onCreated).toHaveBeenCalledWith(SUMMARY);
  });

  it('shows an error with retry on group-create failure, preserving the form', async () => {
    const create = vi
      .fn<() => Observable<ExpenseGroupSummary>>()
      .mockReturnValueOnce(throwError(() => new Error('failed')))
      .mockReturnValueOnce(of(SUMMARY));
    const { onCreated } = await setup({ create });

    await userEvent.type(screen.getByLabelText(/name/i), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(screen.getByText(/couldn't create the group/i)).toBeTruthy();
    expect(screen.getByLabelText<HTMLInputElement>(/name/i).value).toBe('Trip');

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(onCreated).toHaveBeenCalledWith(SUMMARY);
  });

  it('ignores repeated submissions while in flight', async () => {
    const create = vi.fn<() => Observable<ExpenseGroupSummary>>().mockReturnValue(new Subject());
    const { component } = await setup({ create });

    component.name.set('Trip');
    component.create();
    component.create();

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('chains the invite link from the response id and shows the join URL', async () => {
    const { inviteCreate } = await setup({
      create: vi.fn<() => Observable<ExpenseGroupSummary>>().mockReturnValue(of(SUMMARY)),
      inviteCreate: vi
        .fn<() => Observable<CreateInviteLinkResponse>>()
        .mockReturnValue(of({ token: 'abc' })),
    });

    await userEvent.type(screen.getByLabelText(/name/i), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    expect(inviteCreate).toHaveBeenCalledWith({
      body: { groupId: 7, singleUse: false, expiresAt: expect.any(String) },
    });

    const urlField = await screen.findByLabelText<HTMLInputElement>(/invite link/i);
    expect(urlField.value.endsWith('/register?token=abc')).toBe(true);
  });

  it('copy writes the URL to the clipboard', async () => {
    const { writeText } = await setup();

    await userEvent.type(screen.getByLabelText(/name/i), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    const urlField = await screen.findByLabelText<HTMLInputElement>(/invite link/i);

    await userEvent.click(screen.getByRole('button', { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith(urlField.value);
    const status = await screen.findByRole('status');
    expect(status.textContent).toMatch(/copied/i);
  });

  it('share uses the native share sheet when available, else falls back to copy', async () => {
    const canShare = vi.fn<() => boolean>().mockReturnValue(true);
    const { share, writeText } = await setup({ canShare });

    await userEvent.type(screen.getByLabelText(/name/i), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    const urlField = await screen.findByLabelText<HTMLInputElement>(/invite link/i);

    await userEvent.click(screen.getByRole('button', { name: /share/i }));
    expect(share).toHaveBeenCalledWith({ url: urlField.value });

    canShare.mockReturnValue(false);
    await userEvent.click(screen.getByRole('button', { name: /share/i }));

    expect(writeText).toHaveBeenCalledWith(urlField.value);
    expect(screen.getByText(/link copied — paste it to share/i)).toBeTruthy();
  });

  it('invite-step retry re-runs only the invite call', async () => {
    const create = vi.fn<() => Observable<ExpenseGroupSummary>>().mockReturnValue(of(SUMMARY));
    const inviteCreate = vi
      .fn<() => Observable<CreateInviteLinkResponse>>()
      .mockReturnValueOnce(throwError(() => new Error('failed')))
      .mockReturnValueOnce(of({ token: 'abc' }));
    const { onCreated } = await setup({ create, inviteCreate });

    await userEvent.type(screen.getByLabelText(/name/i), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await userEvent.click(screen.getByRole('button', { name: /retry link/i }));

    expect(create).toHaveBeenCalledTimes(1);
    expect(inviteCreate).toHaveBeenCalledTimes(2);
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('done emits closed', async () => {
    const { onClosed } = await setup();

    await userEvent.type(screen.getByLabelText(/name/i), 'Trip');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    await screen.findByLabelText<HTMLInputElement>(/invite link/i);

    await userEvent.click(screen.getByRole('button', { name: /done/i }));

    expect(onClosed).toHaveBeenCalled();
  });
});
