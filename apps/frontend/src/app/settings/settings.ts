import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { USER_NAME_MAX_LENGTH } from '@ardoise/shared';
import { provideIcons } from '@ng-icons/core';
import { lucideChevronLeft, lucideChevronRight } from '@ng-icons/lucide';
import { BrnSheetImports } from '@spartan-ng/brain/sheet';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmSheetImports } from '@spartan-ng/helm/sheet';
import { HlmToggleGroupImports } from '@spartan-ng/helm/toggle-group';
import { AuthService } from 'src/app/auth/auth.service';
import { injectGoBack } from 'src/app/shared/navigation/back';
import { type ThemePreference, ThemeService } from 'src/app/shared/theme/theme.service';
import { ListRowImports } from 'src/app/shared/ui/list-row/list-row';
import { MobileShellImports } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { AppTextImports } from 'src/app/shared/ui/text/text';
import { AppVersion } from 'src/app/shared/version/app-version';

type RequestState = 'idle' | 'busy' | 'failed';

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
    HlmInputImports,
  ],
  providers: [provideIcons({ lucideChevronLeft, lucideChevronRight })],
})
export class Settings {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly goBack = injectGoBack();
  protected readonly theme = inject(ThemeService);
  protected readonly version = inject(AppVersion);

  protected readonly nameMaxLength = USER_NAME_MAX_LENGTH;
  protected readonly name = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly renameState = signal<RequestState>('idle');
  protected readonly canSave = computed(() => {
    const trimmed = this.draft().trim();
    return trimmed !== '' && trimmed !== this.name() && this.renameState() !== 'busy';
  });
  protected readonly signOutState = signal<RequestState>('idle');

  constructor() {
    this.auth
      .currentUser()
      .pipe(takeUntilDestroyed())
      .subscribe((user) => {
        this.name.set(user.name);
      });
  }

  protected startRename(): void {
    this.draft.set(this.name() ?? '');
    this.renameState.set('idle');
  }

  protected saveName(event: Event, close: () => void): void {
    event.preventDefault();
    if (!this.canSave()) return;
    this.renameState.set('busy');
    this.auth.rename(this.draft().trim()).subscribe({
      next: (user) => {
        this.name.set(user.name);
        this.renameState.set('idle');
        close();
      },
      error: () => {
        this.renameState.set('failed');
      },
    });
  }

  protected back(): void {
    this.goBack('/home');
  }

  protected selectTheme(
    value: ThemePreference | readonly ThemePreference[] | null | undefined,
  ): void {
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
