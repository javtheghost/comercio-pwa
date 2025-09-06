import { Component, OnInit } from '@angular/core';
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
import { RegisterRequest } from '../../interfaces/auth.interfaces';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonIcon,
    IonSpinner,
    IonToast
  ],
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss']
})
export class RegisterPage implements OnInit {
  registerForm: FormGroup;
  loading = false;
  showPassword = false;
  showConfirmPassword = false;
  showToast = false;
  toastMessage = '';

  // reCAPTCHA
  recaptchaToken = '';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    public recaptchaService: RecaptchaService
  ) {
    this.registerForm = this.formBuilder.group({
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      last_name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6), this.passwordStrengthValidator]],
      password_confirmation: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    // Check if user is already authenticated
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/tabs/profile']);
    }
  }

  async onRegister() {
    console.log('🔄 onRegister llamado');
    console.log('📋 Formulario válido:', this.registerForm.valid);
    console.log('📋 Errores del formulario:', this.registerForm.errors);
    console.log('📋 Estado de los campos:', {
      first_name: this.registerForm.get('first_name')?.errors,
      last_name: this.registerForm.get('last_name')?.errors,
      email: this.registerForm.get('email')?.errors,
      password: this.registerForm.get('password')?.errors,
      password_confirmation: this.registerForm.get('password_confirmation')?.errors
    });

    if (this.registerForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

      this.loading = true;

    try {
      // Verificar si reCAPTCHA está disponible
      if (!this.recaptchaService.isRecaptchaAvailable()) {
        this.showToastMessage('reCAPTCHA no disponible. Por favor, recarga la página e intenta nuevamente.');
        this.loading = false;
        return;
      }

      // Ejecutar reCAPTCHA v3
      this.recaptchaToken = await this.recaptchaService.execute('register');

      // Obtener valores del formulario
      const userData: RegisterRequest = {
        first_name: this.registerForm.value.first_name,
        last_name: this.registerForm.value.last_name,
        email: this.registerForm.value.email,
        password: this.registerForm.value.password,
        password_confirmation: this.registerForm.value.password_confirmation
      };

      // Agregar el token de reCAPTCHA a los datos
      const dataWithRecaptcha = {
        ...userData,
        recaptcha_token: this.recaptchaToken
      };

      this.authService.register(dataWithRecaptcha).subscribe({
        next: (response) => {
          this.loading = false;
          this.showToastMessage('¡Cuenta creada exitosamente!');
          this.router.navigate(['/tabs/profile']);
        },
        error: (error) => {
          this.loading = false;
          console.log('❌ Error completo del backend:', error);

          // Aplicar errores específicos a los campos correspondientes
          if (error.error && error.error.errors) {
            const errors = error.error.errors;

            Object.keys(errors).forEach(field => {
              if (errors[field] && Array.isArray(errors[field])) {
                const fieldControl = this.registerForm.get(field);
                if (fieldControl) {
                  // Agregar error personalizado al campo
                  fieldControl.setErrors({ serverError: errors[field][0] });
                }
              }
            });
          }

          // Mostrar mensaje general en el toast
          const errorMessage = error.error?.message || 'Error en el registro. Por favor, revisa los campos marcados.';
          console.log('📝 Mensaje de error a mostrar:', errorMessage);
          this.showToastMessage(errorMessage);
        }
      });
    } catch (error) {
      this.loading = false;
      this.showToastMessage('Error de reCAPTCHA. Error al verificar reCAPTCHA. Por favor, recarga la página e intenta nuevamente.');
    }
  }

  onGoogleRegister() {
    this.showToastMessage('Registro con Google no implementado aún');
  }

  onFacebookRegister() {
    this.showToastMessage('Registro con Facebook no implementado aún');
  }



  onLoginClick(event: Event) {
    event.preventDefault();
    this.router.navigate(['/login']);
  }


  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  isFieldValid(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return field ? field.valid && field.touched : false;
  }

  hasFieldError(fieldName: string): boolean {
    const field = this.registerForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.registerForm.get(fieldName);
    if (field?.errors) {
      // Priorizar errores del servidor
      if (field.errors['serverError']) {
        return field.errors['serverError'];
      }

      if (field.errors['required']) {
        const fieldLabels: { [key: string]: string } = {
          'first_name': 'El nombre',
          'last_name': 'El apellido',
          'email': 'El correo electrónico',
          'password': 'La contraseña',
          'password_confirmation': 'La confirmación de contraseña',
          'acceptTerms': 'Los términos y condiciones'
        };
        return `${fieldLabels[fieldName] || fieldName} es requerido`;
      }
      if (field.errors['email']) {
        return 'Por favor ingresa un correo electrónico válido';
      }
      if (field.errors['minlength']) {
        if (fieldName === 'first_name' || fieldName === 'last_name') {
          return 'El nombre debe tener al menos 2 caracteres';
        }
        return 'La contraseña debe tener al menos 6 caracteres';
      }
      if (field.errors['passwordMismatch']) {
        return 'Las contraseñas no coinciden';
      }
      if (field.errors['uppercaseLowercase']) {
        return 'La contraseña debe contener al menos una letra mayúscula y una minúscula';
      }
      if (field.errors['symbol']) {
        return 'La contraseña debe contener al menos un símbolo';
      }
    }
    return '';
  }

  private passwordStrengthValidator(control: any) {
    const value = control.value;
    if (!value) return null;

    const errors: any = {};

    // Verificar mayúscula y minúscula
    if (!/(?=.*[a-z])(?=.*[A-Z])/.test(value)) {
      errors.uppercaseLowercase = true;
    }

    // Verificar símbolo
    if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(value)) {
      errors.symbol = true;
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }

  private passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('password_confirmation');

    if (password && confirmPassword) {
      if (password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
      } else {
        // Limpiar errores de passwordMismatch si las contraseñas coinciden
        const errors = confirmPassword.errors;
        if (errors && errors['passwordMismatch']) {
          delete errors['passwordMismatch'];
          if (Object.keys(errors).length === 0) {
            confirmPassword.setErrors(null);
          } else {
            confirmPassword.setErrors(errors);
          }
        }
      }
    }

    return null;
  }

  private markFormGroupTouched() {
    Object.keys(this.registerForm.controls).forEach(key => {
      const control = this.registerForm.get(key);
      control?.markAsTouched();
    });
  }

  private showToastMessage(message: string) {
    this.toastMessage = message;
    this.showToast = true;
  }
}
