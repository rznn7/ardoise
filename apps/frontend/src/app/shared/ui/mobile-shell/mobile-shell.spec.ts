import { Component } from '@angular/core';
import { render, within } from '@testing-library/angular';

import { MobileShellImports } from './mobile-shell';

@Component({
  imports: [MobileShellImports],
  template: `
    <app-mobile-shell>
      <div appShellHeader>My Header</div>
    </app-mobile-shell>
  `,
})
class HeaderHost {}

@Component({
  imports: [MobileShellImports],
  template: `<app-mobile-shell>Body content</app-mobile-shell>`,
})
class NoHeaderHost {}

@Component({
  imports: [MobileShellImports],
  template: `
    <app-mobile-shell>
      <button appShellFab>Add</button>
    </app-mobile-shell>
  `,
})
class FabHost {}

@Component({
  imports: [MobileShellImports],
  template: `<app-mobile-shell bleed>Body content</app-mobile-shell>`,
})
class BleedHost {}

describe('MobileShell', () => {
  it('is full width on phones', async () => {
    const { container } = await render(NoHeaderHost);

    const inner = container.querySelector('app-mobile-shell > div')!;
    expect(inner.classList).toContain('w-full');
    expect(inner.classList).not.toContain('border-x');
    expect(inner.classList).not.toContain('shadow-sm');
  });

  it('caps width from sm', async () => {
    const { container } = await render(NoHeaderHost);

    expect(container.querySelector('app-mobile-shell > div')!.classList).toContain('sm:max-w-md');
  });

  it('keeps top safe-area padding by default', async () => {
    const { container } = await render(NoHeaderHost);

    expect(container.querySelector('app-mobile-shell')!.classList).toContain(
      'pt-[env(safe-area-inset-top)]',
    );
  });

  it('bleed removes top safe-area padding', async () => {
    const { container } = await render(BleedHost);

    expect(container.querySelector('app-mobile-shell')!.classList).not.toContain(
      'pt-[env(safe-area-inset-top)]',
    );
  });

  it('bleed removes bottom safe-area padding too', async () => {
    const { container } = await render(BleedHost);

    expect(container.querySelector('app-mobile-shell')!.classList).not.toContain(
      'pb-[env(safe-area-inset-bottom)]',
    );
  });

  it('projects header content into a rendered header region', async () => {
    const { container } = await render(HeaderHost);

    const header = container.querySelector('header');
    expect(header).not.toBeNull();
    expect(within(header!).getByText('My Header')).toBeTruthy();
  });

  it('renders no header element when none projected', async () => {
    const { container } = await render(NoHeaderHost);

    expect(container.querySelector('header')).toBeNull();
  });

  it('projects default content into the main region', async () => {
    const { container } = await render(NoHeaderHost);

    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(within(main!).getByText('Body content')).toBeTruthy();
  });

  it('projects FAB content into the FAB slot', async () => {
    const { container } = await render(FabHost);

    const fab = within(container).getByText('Add');
    const main = container.querySelector('main');

    expect(fab).not.toBeNull();
    expect(main!.contains(fab)).toBe(false);
  });

  it.todo('has no accessibility violations', () => {
    // mount with and without a projected header
    // run jest-axe and assert no violations (landmark hygiene, no empty landmark)
  });
});
