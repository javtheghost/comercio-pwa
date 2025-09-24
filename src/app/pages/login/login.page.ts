import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
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
onSkip() {
  // Usar NavController con animationDirection 'back' para transición izquierda->derecha
  this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
}
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
    public recaptchaService: RecaptchaService,
    private navCtrl: NavController
  ) {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  ngOnInit() {
    // Check if user is already authenticated
    if (this.authService.isAuthenticated()) {
      this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'forward' });
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
      // Verificar si reCAPTCHA está disponible
      if (!this.recaptchaService.isRecaptchaAvailable()) {
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
          // En login exitoso, usar 'forward' (derecha->izquierda) al ir a Home
          this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'forward' });
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

  onGoogleLogin() {
    this.showToastMessage('Inicio de sesión con Google no implementado aún');
  }

  onFacebookLogin() {
    this.showToastMessage('Inicio de sesión con Facebook no implementado aún');
  }

  onForgotPassword(event: Event) {
    event.preventDefault();
    this.showToastMessage('Funcionalidad de restablecimiento de contraseña no implementada aún');
  }

  onSignUp(event: Event) {
    event.preventDefault();
    this.router.navigate(['/tabs/register']);
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  isFieldValid(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return field ? field.valid && field.touched : false;
  }

  hasFieldError(fieldName: string): boolean {
    const field = this.loginForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.loginForm.get(fieldName);
    if (field?.errors) {
      // Priorizar errores del servidor
      if (field.errors['serverError']) {
        return field.errors['serverError'];
      }

      if (field.errors['required']) {
        const fieldLabels: { [key: string]: string } = {
          'email': 'El correo electrónico',
          'password': 'La contraseña'
        };
        return `${fieldLabels[fieldName] || fieldName} es requerido`;
      }
      if (field.errors['email']) {
        return 'Por favor ingresa un correo electrónico válido';
      }
      if (field.errors['minlength']) {
        return 'La contraseña debe tener al menos 6 caracteres';
      }
    }
    return '';
  }

  private markFormGroupTouched() {
    Object.keys(this.loginForm.controls).forEach(key => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }

  private showToastMessage(message: string) {
    this.toastMessage = message;
    this.showToast = true;
    this.cdr.detectChanges();
  }
}
