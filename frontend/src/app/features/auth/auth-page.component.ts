import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.scss',
})
export class AuthPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  /** Llega con ?sesionVencida=true cuando el token venció, como en la guía del curso. */
  readonly sessionExpired = inject(ActivatedRoute).snapshot.queryParamMap.get('sesionVencida') === 'true';
  readonly registering = signal(false);
  readonly name = signal('');
  readonly username = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly error = signal('');
  readonly busy = signal(false);

  async submit(): Promise<void> {
    if (this.busy()) return;
    if (this.registering() && this.password() !== this.confirmPassword()) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.registering()) await this.auth.signUp(this.name().trim(), this.username().trim(), this.password());
      else await this.auth.signIn(this.username().trim(), this.password());
      await this.router.navigateByUrl(this.auth.signInRedirectUrl());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión. Revisa tus datos e inténtalo otra vez.');
    } finally { this.busy.set(false); }
  }

  toggleMode(): void {
    this.registering.update((value) => !value);
    this.error.set('');
  }
}
