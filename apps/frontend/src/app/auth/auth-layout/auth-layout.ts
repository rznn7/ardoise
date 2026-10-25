import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeroScreen } from 'src/app/shared/ui/hero-screen/hero-screen';
import { MobileShell } from 'src/app/shared/ui/mobile-shell/mobile-shell';
import { AppTextImports } from 'src/app/shared/ui/text/text';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, MobileShell, HeroScreen, AppTextImports],
  templateUrl: './auth-layout.html',
})
export class AuthLayout {}
