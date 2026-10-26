import { type CreateInviteLinkResponse } from '@ardoise/shared';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { type Observable, of, throwError } from 'rxjs';
import { InviteLinkApiService } from 'src/app/invite-link/invite-link-api.service';
import { ClipboardService } from 'src/app/shared/clipboard.service';
import { ShareService } from 'src/app/shared/share.service';

import { InviteLinkPanel } from './invite-link-panel';

type InviteCreateMock = ReturnType<typeof vi.fn<() => Observable<CreateInviteLinkResponse>>>;
type WriteTextMock = ReturnType<typeof vi.fn<(text: string) => Observable<void>>>;
type ShareMock = ReturnType<typeof vi.fn<(data: { url: string }) => Observable<void>>>;
type DoneSpy = ReturnType<typeof vi.fn<() => void>>;

async function setup({
  inviteCreate = vi
    .fn<() => Observable<CreateInviteLinkResponse>>()
    .mockReturnValue(of({ token: 'abc' })),
  canShare = false,
}: { inviteCreate?: InviteCreateMock; canShare?: boolean } = {}): Promise<{
  inviteCreate: InviteCreateMock;
  writeText: WriteTextMock;
  share: ShareMock;
  onDone: DoneSpy;
}> {
  const writeText = vi.fn<(text: string) => Observable<void>>().mockReturnValue(of(undefined));
  const share = vi.fn<(data: { url: string }) => Observable<void>>().mockReturnValue(of(undefined));
  const onDone = vi.fn<() => void>();
  await render(InviteLinkPanel, {
    inputs: { groupId: 7 },
    providers: [
      { provide: InviteLinkApiService, useValue: { create: inviteCreate } },
      { provide: ClipboardService, useValue: { writeText } },
      { provide: ShareService, useValue: { canShare: () => canShare, share } },
    ],
    on: { done: onDone },
  });
  return { inviteCreate, writeText, share, onDone };
}

describe('InviteLinkPanel', () => {
  it('creates a 24h reusable link for the group on init and shows its /join url', async () => {
    const { inviteCreate } = await setup();

    expect(inviteCreate).toHaveBeenCalledWith({
      body: { groupId: 7, singleUse: false, expiresAt: expect.any(String) },
    });
    const urlField = await screen.findByLabelText<HTMLInputElement>(/invite link/i);
    expect(urlField.value).toBe(`${location.origin}/join?token=abc`);
  });

  it('copy writes the url to the clipboard and says Copied', async () => {
    const { writeText } = await setup();

    await userEvent.click(await screen.findByRole('button', { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith(`${location.origin}/join?token=abc`);
    expect((await screen.findByRole('status')).textContent).toMatch(/copied/i);
  });

  it('share uses the native share sheet when available', async () => {
    const { share } = await setup({ canShare: true });

    await userEvent.click(await screen.findByRole('button', { name: /share/i }));

    expect(share).toHaveBeenCalledWith({ url: `${location.origin}/join?token=abc` });
  });

  it('share falls back to copying the link', async () => {
    const { writeText } = await setup();

    await userEvent.click(await screen.findByRole('button', { name: /share/i }));

    expect(writeText).toHaveBeenCalledWith(`${location.origin}/join?token=abc`);
    expect(screen.getByText(/link copied — paste it to share/i)).toBeTruthy();
  });

  it('shows an error and retries the link', async () => {
    const inviteCreate = vi
      .fn<() => Observable<CreateInviteLinkResponse>>()
      .mockReturnValueOnce(throwError(() => new Error('failed')))
      .mockReturnValueOnce(of({ token: 'abc' }));
    await setup({ inviteCreate });

    expect(screen.getByText(/couldn't generate an invite link/i)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: /retry link/i }));

    expect(inviteCreate).toHaveBeenCalledTimes(2);
    expect(await screen.findByLabelText(/invite link/i)).toBeTruthy();
  });

  it('done emits done', async () => {
    const { onDone } = await setup();

    await userEvent.click(await screen.findByRole('button', { name: /done/i }));

    expect(onDone).toHaveBeenCalled();
  });
});
