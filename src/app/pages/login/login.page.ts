import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonSpinner,
  IonToast
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { RecaptchaService } from '../../services/recaptcha.service';
import { LoginRequest } from '../../interfaces/auth.interfaces';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonIcon,
    IonSpinner,
    IonToast
  ],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage implements OnInit {
  loginForm: FormGroup;
  showPassword = false;
  showToast = false;
  toastMessage = '';
  authLoading = false;

  // reCAPTCHA
  recaptchaToken = '';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
      private cdr: ChangeDetectorRef,
      public recaptchaService: RecaptchaService
    ) {
      this.loginForm = this.formBuilder.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]]
      });
    }

    ngOnInit() {
      // Check if user is already authenticated
      if (this.authService.isAuthenticated()) {
        this.router.navigate(['/tabs/home']);
      }

      // Suscribirse a cambios en el estado de autenticación
      this.authService.authState$.subscribe(authState => {
        this.authLoading = authState.loading;
      });

      // Debug reCAPTCHA status
      setTimeout(() => {
        const status = this.recaptchaService.getRecaptchaStatus();
        console.log('🔍 Estado de reCAPTCHA en login ngOnInit:', status);
      }, 3000);
    }

  async onLogin() {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    // Prevenir múltiples clics
    if (this.authLoading) {
      return;
    }

    try {
      // Verificar si reCAPTCHA está disponible (de develop)
      if (typeof this.recaptchaService.isRecaptchaAvailable === 'function' && !this.recaptchaService.isRecaptchaAvailable()) {
        this.showToastMessage('reCAPTCHA no disponible. Por favor, recarga la página e intenta nuevamente.');
        return;
      }

      // Ejecutar reCAPTCHA v3
      this.recaptchaToken = await this.recaptchaService.execute('login');

      // Obtener valores del formulario
      const credentials: LoginRequest = this.loginForm.value;

      // Agregar el token de reCAPTCHA a los datos
      const dataWithRecaptcha = {
        ...credentials,
        recaptcha_token: this.recaptchaToken
      };

      this.authService.login(dataWithRecaptcha).subscribe({
        next: (response) => {
          console.log('✅ Respuesta del login en componente:', response);

          // Si llegamos aquí, el login fue exitoso
          this.showToastMessage('¡Inicio de sesión exitoso!');
          this.router.navigate(['/tabs/home']);
        },
        error: (error) => {
          console.log('❌ Error completo del backend:', error);

          // Aplicar errores específicos a los campos correspondientes
          if (error.error && error.error.errors) {
            const errors = error.error.errors;

            Object.keys(errors).forEach(field => {
              if (errors[field] && Array.isArray(errors[field])) {
                const fieldControl = this.loginForm.get(field);
                if (fieldControl) {
                  // Agregar error personalizado al campo
                  fieldControl.setErrors({ serverError: errors[field][0] });
                }
              }
            });
          }

          // Mostrar mensaje general en el toast
          const errorMessage = error.error?.message || 'Error en el inicio de sesión. Por favor, revisa los campos marcados.';
          console.log('📝 Mensaje de error a mostrar:', errorMessage);
          this.showToastMessage(errorMessage);
        }
      });
    } catch (error) {
      this.showToastMessage('Error de reCAPTCHA. Error al verificar reCAPTCHA. Por favor, recarga la página e intenta nuevamente.');
    }
  }

  onSkip() {
    this.router.navigate(['/tabs/home']);
  }

  onGoogleLogin() {
    this.showToastMessage('Inicio de sesión con Google no implementado aún');
  }

  onFacebookLogin() {
    this.showToastMessage('Inicio de sesión con Facebook no implementado aún');
  }

  onForgotPassword(event: Event) {
    // Aquí puedes implementar la lógica para recuperar contraseña
    this.showToastMessage('Funcionalidad de recuperación de contraseña no implementada aún');
  }

  markFormGroupTouched() {
    Object.values(this.loginForm.controls).forEach(control => {
      control.markAsTouched();
    });
  }

  showToastMessage(message: string) {
    this.toastMessage = message;
    this.showToast = true;
    setTimeout(() => {
      this.showToast = false;
    }, 3000);
  }

  isFieldValid(field: string): boolean {
    const control = this.loginForm.get(field);
    return !!(control && control.valid && (control.dirty || control.touched));
  }

  hasFieldError(field: string): boolean {
    const control = this.loginForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getFieldError(field: string): string | null {
    const control = this.loginForm.get(field);
    if (!control || !control.errors) return null;
    if (control.errors['required']) return 'Este campo es obligatorio.';
    if (control.errors['email']) return 'Correo inválido.';
    if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres.`;
    return null;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
}
