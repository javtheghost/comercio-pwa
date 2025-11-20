import { Component, OnInit } from '@angular/core';
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
  // Show processing modal specifically for OAuth flows
  oauthProcessing = false;
  showPassword = false;
  showConfirmPassword = false;
  showToast = false;
  toastMessage = '';
  showSuccessModal = false;

  // reCAPTCHA
  recaptchaToken = '';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private navCtrl: NavController,
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
      this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
    }

    // Agregar listener global para mensajes OAuth
    this.setupOAuthListener();
  }

  private setupOAuthListener() {
    // Listener global para mensajes OAuth que puedan venir de cualquier popup
    window.addEventListener('message', (event: MessageEvent) => {
      console.log('🔐 [REGISTER] Mensaje global recibido:', event.data, 'Origin:', event.origin);

      // Permitir mensajes de localhost:4200 o cualquier origen (para OAuth)
      if (event.origin.includes('localhost:4200') ||
          event.origin.includes('127.0.0.1:4200') ||
          event.origin === window.location.origin ||
          event.origin === '*') {
        if (event.data.type === 'FACEBOOK_REGISTER_SUCCESS' || event.data.type === 'GOOGLE_REGISTER_SUCCESS') {
          console.log('🔐 [REGISTER] Procesando registro OAuth desde listener global:', event.data);
          this.handleOAuthSuccess(event.data);
        }
      }
    });
  }

  private handleOAuthSuccess(data: any) {
    console.log('🔐 [REGISTER] Procesando éxito OAuth:', data);

    try {
      // Mostrar processing modal para OAuth
      this.oauthProcessing = true;

      // Guardar token y datos del usuario localmente
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        console.log('🔐 [REGISTER] Token guardado en localStorage');
      }

      if (data.user) {
        try {
          localStorage.setItem('auth_user', JSON.stringify(data.user));
        } catch (e) {
          console.warn('🔐 [REGISTER] No se pudo guardar auth_user en localStorage:', e);
        }
        console.log('🔐 [REGISTER] Usuario recibido del provider:', data.user);
      }

      // Emitir evento para que AuthService procese el login OAuth
      try {
        window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { token: data.token, user: data.user } }));
        console.log('🔐 [REGISTER] Evento userLoggedIn disparado');
      } catch (e) {
        console.warn('🔐 [REGISTER] No se pudo emitir userLoggedIn:', e);
      }

      // Mostrar mensaje de éxito
      const provider = data.user?.oauth_provider === 'google' ? 'Google' : 'Facebook';
      this.showToastMessage(`¡Registro con ${provider} exitoso!`);

      // Esperar a que AuthService confirme la sesión antes de navegar (con timeout de fallback)
      const timeoutMs = 5000;
      let navigated = false;

      const sub = this.authService.authState$.subscribe((state) => {
        if (state.isAuthenticated && !navigated) {
          navigated = true;
          sub.unsubscribe();
          this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'forward' });
          this.oauthProcessing = false;
        }
      });

      // Fallback: si no se autentica en X ms, navegar igualmente
      setTimeout(() => {
        if (!navigated) {
          navigated = true;
          try { sub.unsubscribe(); } catch (e) {}
          this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'forward' });
          this.oauthProcessing = false;
        }
      }, timeoutMs);

    } catch (error: any) {
      console.error('🔐 [REGISTER] Error procesando OAuth:', error);
      this.showToastMessage(`Error procesando registro: ${error.message}`);
      this.oauthProcessing = false;
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
          this.showSuccessModal = true;

          // Obtener datos del usuario desde la respuesta del registro
          const user = this.authService.getCurrentUserValue();
          const email = user?.email || this.registerForm.value.email || '';

          console.log('✅ [REGISTER] Registro exitoso');

          // Redirigir después de 2 segundos para que vea el mensaje
          setTimeout(() => {
            this.closeSuccessModal();

            // Verificar si el usuario tiene email verificado (OAuth o verificación previa)
            if (user?.email_verified_at || user?.oauth_provider) {
              console.log('✅ [REGISTER] Usuario OAuth o email ya verificado, redirigiendo a home');
              this.navCtrl.navigateRoot(['/tabs/home'], {
                animationDirection: 'forward'
              });
            } else {
              console.log('📧 [REGISTER] Usuario necesita verificar email, redirigiendo a verify-email');
              this.navCtrl.navigateRoot(['/tabs/verify-email'], {
                queryParams: { email, sent: '1' },
                animationDirection: 'forward'
              });
            }
          }, 2000);
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
    console.log('🔐 [REGISTER] Iniciando registro con Google...');

    try {
      // URL del backend para Google OAuth
      const backendUrl = 'https://api.book-smart.me';
      const googleUrl = `${backendUrl}/api/auth/google`;

      console.log('🔐 [REGISTER] Redirigiendo a Google OAuth:', googleUrl);

      // Abrir ventana popup para Google OAuth
      const popup = window.open(
        googleUrl,
        'google-register',
        'width=600,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('No se pudo abrir la ventana popup. Verifica que los popups estén habilitados.');
      }

      // Escuchar el mensaje de la ventana popup
      const messageListener = (event: MessageEvent) => {
        console.log('🔐 [REGISTER] Mensaje recibido:', event.data, 'Origin:', event.origin);

        // Permitir mensajes de localhost:4200 (el popup OAuth)
        if (event.origin !== window.location.origin &&
            !event.origin.includes('localhost:4200') &&
            !event.origin.includes('127.0.0.1:4200')) {
          console.log('🔐 [REGISTER] Origen no permitido:', event.origin);
          return;
        }

        if (event.data.type === 'GOOGLE_REGISTER_SUCCESS') {
          console.log('🔐 [REGISTER] Registro con Google exitoso:', event.data);
          popup.close();
          window.removeEventListener('message', messageListener);

          // Procesar la respuesta del registro
          this.handleGoogleRegisterSuccess(event.data);
        } else if (event.data.type === 'GOOGLE_REGISTER_ERROR') {
          console.error('🔐 [REGISTER] Error en registro con Google:', event.data.error);
          popup.close();
          window.removeEventListener('message', messageListener);

          this.showToastMessage(`Error en registro con Google: ${event.data.error}`);
        }
      };

      window.addEventListener('message', messageListener);

      // Verificar si la ventana se cerró manualmente
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          console.log('🔐 [REGISTER] Ventana popup cerrada manualmente');
        }
      }, 1000);

    } catch (error: any) {
      console.error('❌ [REGISTER] Error en registro con Google:', error);
      this.showToastMessage(`Error al iniciar registro con Google: ${error.message}`);
    }
  }

  onFacebookRegister() {
    console.log('🔐 [REGISTER] Iniciando registro con Facebook...');

    try {
      // URL del backend para Facebook OAuth
      const backendUrl = 'https://api.book-smart.me';
      const facebookUrl = `${backendUrl}/api/auth/facebook`;

      console.log('🔐 [REGISTER] Redirigiendo a Facebook OAuth:', facebookUrl);

      // Abrir ventana popup para Facebook OAuth
      const popup = window.open(
        facebookUrl,
        'facebook-register',
        'width=600,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('No se pudo abrir la ventana popup. Verifica que los popups estén habilitados.');
      }

      // Escuchar el mensaje de la ventana popup
      const messageListener = (event: MessageEvent) => {
        console.log('🔐 [REGISTER] Mensaje recibido:', event.data, 'Origin:', event.origin);

        // Permitir mensajes de localhost:4200 (el popup OAuth)
        if (event.origin !== window.location.origin &&
            !event.origin.includes('localhost:4200') &&
            !event.origin.includes('127.0.0.1:4200')) {
          console.log('🔐 [REGISTER] Origen no permitido:', event.origin);
          return;
        }

        if (event.data.type === 'FACEBOOK_REGISTER_SUCCESS') {
          console.log('🔐 [REGISTER] Registro con Facebook exitoso:', event.data);
          popup.close();
          window.removeEventListener('message', messageListener);

          // Procesar la respuesta del registro
          this.handleFacebookRegisterSuccess(event.data);
        } else if (event.data.type === 'FACEBOOK_REGISTER_ERROR') {
          console.error('🔐 [REGISTER] Error en registro con Facebook:', event.data.error);
          popup.close();
          window.removeEventListener('message', messageListener);

          this.showToastMessage(`Error en registro con Facebook: ${event.data.error}`);
        }
      };

      window.addEventListener('message', messageListener);

      // Verificar si la ventana se cerró manualmente
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          console.log('🔐 [REGISTER] Ventana popup cerrada manualmente');
        }
      }, 1000);

    } catch (error: any) {
      console.error('❌ [REGISTER] Error en registro con Facebook:', error);
      this.showToastMessage(`Error al iniciar registro con Facebook: ${error.message}`);
    }
  }



  onLoginClick(event: Event) {
    event.preventDefault();
    this.router.navigate(['/tabs/login']);
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

  closeSuccessModal() {
    this.showSuccessModal = false;
  }

  private async handleGoogleRegisterSuccess(data: any) {
    console.log('✅ [REGISTER] Procesando registro exitoso con Google:', data);

    try {
      // Mostrar processing modal para OAuth
      this.oauthProcessing = true;

      // Guardar token y datos del usuario localmente
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        console.log('✅ [REGISTER] Token guardado en localStorage');
      }

      if (data.user) {
        try {
          localStorage.setItem('auth_user', JSON.stringify(data.user));
        } catch (e) {
          console.warn('✅ [REGISTER] No se pudo guardar auth_user en localStorage:', e);
        }
        console.log('✅ [REGISTER] Usuario registrado con Google:', data.user);
      }

      // Emitir evento para que AuthService procese el login OAuth
      try {
        window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { token: data.token, user: data.user } }));
        console.log('✅ [REGISTER] Evento userLoggedIn disparado (Google)');
      } catch (e) {
        console.warn('✅ [REGISTER] No se pudo emitir userLoggedIn (Google):', e);
      }

      this.showToastMessage('¡Registro con Google exitoso!');

      // Esperar a que AuthService confirme la sesión antes de navegar (con timeout de fallback)
      const timeoutMs = 5000;
      let navigated = false;
      const sub = this.authService.authState$.subscribe((state) => {
        if (state.isAuthenticated && !navigated) {
          navigated = true;
          sub.unsubscribe();
          this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'forward' });
          this.oauthProcessing = false;
        }
      });
      setTimeout(() => {
        if (!navigated) {
          navigated = true;
          try { sub.unsubscribe(); } catch (e) {}
          this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'forward' });
          this.oauthProcessing = false;
        }
      }, timeoutMs);

    } catch (error: any) {
      console.error('❌ [REGISTER] Error procesando registro con Google:', error);
      this.showToastMessage(`Error procesando registro: ${error.message}`);
      this.oauthProcessing = false;
    }
  }

  private async handleFacebookRegisterSuccess(data: any) {
    console.log('✅ [REGISTER] Procesando registro exitoso con Facebook:', data);

    try {
      // Mostrar processing modal para OAuth
      this.oauthProcessing = true;

      // Guardar token y datos del usuario localmente
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        console.log('✅ [REGISTER] Token guardado en localStorage');
      }

      if (data.user) {
        try {
          localStorage.setItem('auth_user', JSON.stringify(data.user));
        } catch (e) {
          console.warn('✅ [REGISTER] No se pudo guardar auth_user en localStorage:', e);
        }
        console.log('✅ [REGISTER] Usuario registrado con Facebook:', data.user);
      }

      // Emitir evento para que AuthService procese el login OAuth
      try {
        window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { token: data.token, user: data.user } }));
        console.log('✅ [REGISTER] Evento userLoggedIn disparado (Facebook)');
      } catch (e) {
        console.warn('✅ [REGISTER] No se pudo emitir userLoggedIn (Facebook):', e);
      }

      this.showToastMessage('¡Registro con Facebook exitoso!');

      // Esperar a que AuthService confirme la sesión antes de navegar (con timeout de fallback)
      const timeoutMs = 5000;
      let navigated = false;
      const sub = this.authService.authState$.subscribe((state) => {
        if (state.isAuthenticated && !navigated) {
          navigated = true;
          sub.unsubscribe();
          this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'forward' });
          this.oauthProcessing = false;
        }
      });
      setTimeout(() => {
        if (!navigated) {
          navigated = true;
          try { sub.unsubscribe(); } catch (e) {}
          this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'forward' });
          this.oauthProcessing = false;
        }
      }, timeoutMs);

    } catch (error: any) {
      console.error('❌ [REGISTER] Error procesando registro con Facebook:', error);
      this.showToastMessage(`Error procesando registro: ${error.message}`);
      this.oauthProcessing = false;
    }
  }
}
