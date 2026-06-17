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

describe('MobileShell', () => {
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

  it.todo('has no accessibility violations', () => {
    // mount with and without a projected header
    // run jest-axe and assert no violations (landmark hygiene, no empty landmark)
  });
});
