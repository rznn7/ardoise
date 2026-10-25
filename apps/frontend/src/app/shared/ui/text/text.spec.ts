import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';

import { AppTextImports } from './text';

@Component({
  imports: [AppTextImports],
  template: `
    <h1 appTitle>Title</h1>
    <p appBody>Body</p>
    <p appMeta>Meta</p>
    <p appError>Error</p>
    <p appEyebrow>Eyebrow</p>
    <p appFigure>42</p>
  `,
})
class TextHost {}

describe('text directives', () => {
  it('apply their type styles', async () => {
    await render(TextHost);

    expect(screen.getByText('Title').classList).toContain('font-medium');
    expect(screen.getByText('Body').classList).toContain('text-sm');
    expect(screen.getByText('Meta').classList).toContain('text-muted-foreground');
    expect(screen.getByText('Error').classList).toContain('text-destructive');
    expect(screen.getByText('Eyebrow').classList).toContain('uppercase');
    const figure = screen.getByText('42').classList;
    expect(figure).toContain('tabular-nums');
    expect(figure).toContain('font-light');
  });
});
