import {CommonModule} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {Component, inject} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {IonButton, IonContent, IonIcon, IonInput, IonSpinner} from '@ionic/angular/standalone';
import {addIcons} from 'ionicons';
import {
  alertCircleOutline,
  eyeOffOutline,
  eyeOutline,
  hardwareChipOutline,
  personAddOutline
} from 'ionicons/icons';
import {AuthService} from '../core/service/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['../configuration/configuration.page.scss'],
  standalone: true,
  imports: [IonContent, CommonModule, FormsModule, IonInput, IonIcon, IonButton, IonSpinner, RouterLink]
})
export class RegisterPage {

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  passwordConfirmation = '';
  showPassword = false;
  loading = false;
  errorMessage = '';

  constructor() {
    addIcons({
      hardwareChipOutline,
      alertCircleOutline,
      eyeOutline,
      eyeOffOutline,
      personAddOutline
    });
  }

  async register(): Promise<void> {
    const email = this.email.trim();

    if (!email || !this.password || !this.passwordConfirmation || this.loading) {
      return;
    }

    if (this.password.length < 8) {
      this.errorMessage = 'Le mot de passe doit contenir au moins 8 caracteres.';
      return;
    }

    if (this.password !== this.passwordConfirmation) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    try {
      await this.authService.register(email, this.password);
      await this.router.navigate(['/setup']);
    } catch (error) {
      this.errorMessage = this.getRegistrationError(error);
      this.loading = false;
    }
  }

  private getRegistrationError(error: unknown): string {
    if (
      error instanceof HttpErrorResponse
      && error.status === 400
      && error.error?.message === 'email already exists'
    ) {
      return 'Un compte existe deja avec cette adresse email.';
    }

    return 'Inscription impossible. Verifiez les informations saisies.';
  }
}
