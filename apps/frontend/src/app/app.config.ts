import { provideHttpClient } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideI18n } from 'src/app/shared/i18n/provide-i18n';
import { withHistoryPageIds } from 'src/app/shared/navigation/back';
import { ThemeService } from 'src/app/shared/theme/theme.service';
import { VersionWatcher } from 'src/app/shared/version/version-watcher';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withHistoryPageIds()),
    provideHttpClient(),
    ...provideI18n(),
    provideAppInitializer(() => {
      inject(ThemeService);
      inject(VersionWatcher).start();
    }),
  ],
};
