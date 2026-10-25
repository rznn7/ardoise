import { render } from '@testing-library/angular';

import { backdropFor, backdropUrl } from './backdrop-for';
import { GroupMark } from './group-mark';

describe('GroupMark', () => {
  it('renders the group backdrop tile hidden from assistive tech', async () => {
    const { fixture, container } = await render(GroupMark, { inputs: { groupId: 7 } });

    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('img')!.getAttribute('src')).toBe(backdropUrl(backdropFor(7)));
  });
});
