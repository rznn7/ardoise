import { NgComponentOutlet } from '@angular/common';
import { Component, resource } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VARIANTS_ENABLED } from 'src/environments/environment';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgComponentOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly variantToggle = resource({
    loader: async () =>
      VARIANTS_ENABLED
        ? (await import('src/app/shared/variants/variant-toggle')).VariantToggle
        : undefined,
  });
}
