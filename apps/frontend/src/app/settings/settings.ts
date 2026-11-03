import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { AuthService } from 'src/app/auth/auth.service';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { type ThemePreference, ThemeService } from 'src/app/shared/theme/theme.service';
import { ListRowImports } from 'src/app/shared/ui/list-row/list-row';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { AppTextImports } from 'src/app/shared/ui/text/text';
import { AppVersion } from 'src/app/shared/version/app-version';

type SignOutState = 'idle' | 'busy' | 'failed';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings',
  templateUrl: './settings.html',
  imports: [
    MobileShellImports,
    AppTextImports,
    ListRowImports,
    BrnSheetImports,
    HlmSheetImports,
    HlmButtonImports,
    HlmIconImports,
    HlmToggleGroupImports,
  ],
  providers: [provideIcons({ lucideChevronLeft })],
})
export class Settings {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly goBack = injectGoBack();
  protected readonly theme = inject(ThemeService);
  protected readonly version = inject(AppVersion);

  protected readonly signOutState = signal<SignOutState>('idle');

  protected back(): void {
    this.goBack('/home');
  }

  protected selectTheme(value: ThemePreference | readonly ThemePreference[] | null | undefined): void {
    const preference = typeof value === 'string' ? value : value?.[0];
    if (preference) this.theme.setPreference(preference);
  }

  protected resetSignOut(): void {
    this.signOutState.set('idle');
  }

  protected signOut(): void {
    this.signOutState.set('busy');
    this.auth.logout().subscribe({
      next: () => {
        void this.router.navigateByUrl('/login', { replaceUrl: true });
      },
      error: () => {
        this.signOutState.set('failed');
      },
    });
  }
}
