import { render } from '@testing-library/angular';

import { backdropFor, backdropUrl } from './backdrop-for';
import { GroupFade } from './group-fade';

describe('GroupFade', () => {
  it('shows the group backdrop fading in from the right, hidden from assistive tech', async () => {
    const { fixture, container } = await render(GroupFade, { inputs: { groupId: 7 } });

    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.className).toContain('absolute');
    expect(host.className).toContain('mask-image');
    expect(container.querySelector('img')!.getAttribute('src')).toBe(backdropUrl(backdropFor(7)));
  });
});
