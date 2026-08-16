import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { provideIcons } from '@ng-icons/core';
import { lucideNotebookPen } from '@ng-icons/lucide';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { MobileShell } from 'src/app/shared/mobile-shell/mobile-shell';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, HlmCardImports, HlmIconImports, MobileShell],
  templateUrl: './auth-layout.html',
  styleUrl: './auth-layout.css',
  providers: [provideIcons({ lucideNotebookPen })],
})
export class AuthLayout {}
