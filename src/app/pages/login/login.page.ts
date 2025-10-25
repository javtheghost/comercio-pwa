import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
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
    NgIf,
    ReactiveFormsModule,
    IonContent,
    IonIcon,
    IonSpinner,
    IonToast
  ],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss']
})
export class LoginPage implements OnInit, OnDestroy {
onSkip() {
  // Usar NavController con animationDirection 'back' para transición izquierda->derecha
  this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
}
  loginForm: FormGroup;
  showPassword = false;
  showToast = false;
  toastMessage = '';
  authLoading = false;
  private _verifyingSession = false;
  get verifyingSession(): boolean { return this._verifyingSession; }
  set verifyingSession(val: boolean) {
    this._verifyingSession = val;
    this.updateVerifyingOverlay();
    this.cdr.detectChanges();
  }
  // UI flag to indicate immediate submission state (used for Enter key feedback)
  submitting = false;

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
      this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
    }

    // Suscribirse a cambios en el estado de autenticación
    this.authService.authState$.subscribe(authState => {
      this.authLoading = authState.loading;
    });

    // Agregar listener global para mensajes OAuth
    this.setupOAuthListener();

    // Debug reCAPTCHA status
    setTimeout(() => {
      const status = this.recaptchaService.getRecaptchaStatus();
      console.log('🔍 Estado de reCAPTCHA en login ngOnInit:', status);
    }, 3000);
  }

  private setupOAuthListener() {
    // Listener global para mensajes OAuth que puedan venir de cualquier popup
    window.addEventListener('message', (event: MessageEvent) => {
      // Filtrar solo mensajes de OAuth, ignorar Angular DevTools
      if (event.data && typeof event.data === 'object' && event.data.type) {
        console.log('🔐 [LOGIN] Mensaje con tipo recibido:', event.data, 'Origin:', event.origin);

        // Permitir mensajes de localhost:4200 o cualquier origen (para OAuth)
        if (event.origin.includes('localhost:4200') ||
            event.origin.includes('127.0.0.1:4200') ||
            event.origin === window.location.origin ||
            event.origin === '*') {
          if (event.data.type === 'FACEBOOK_LOGIN_SUCCESS' || event.data.type === 'GOOGLE_LOGIN_SUCCESS') {
            console.log('🔐 [LOGIN] Procesando login OAuth desde listener global:', event.data);
            this.handleOAuthSuccess(event.data);
          }
        }
      }
    });
  }

  private handleOAuthSuccess(data: any) {
    console.log('🔐 [LOGIN] Procesando éxito OAuth:', data);

    try {
      // Mostrar overlay de verificación de sesión
      this.verifyingSession = true;
      this.setVerifyingOverlay(true);

      // Guardar token y datos del usuario localmente
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        console.log('🔐 [LOGIN] Token guardado en localStorage');
      }

      if (data.user) {
        try { localStorage.setItem('auth_user', JSON.stringify(data.user)); } catch (e) { /* ignore */ }
        console.log('🔐 [LOGIN] Usuario autenticado:', data.user);
      }

      // Emitir evento para que AuthService procese el login OAuth
      try {
        window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { token: data.token, user: data.user } }));
        console.log('🔐 [LOGIN] Evento userLoggedIn disparado');
      } catch (e) {
        console.warn('🔐 [LOGIN] No se pudo emitir userLoggedIn:', e);
      }

      this.showToastMessage(`¡Inicio de sesión exitoso!`);

      // Esperar a que AuthService confirme la sesión antes de navegar
      const timeoutMs = 5000;
      let navigated = false;
      const sub = this.authService.authState$.subscribe((state) => {
        if (state.isAuthenticated && !navigated) {
          navigated = true;
          sub.unsubscribe();
          this.verifyingSession = false;
          this.setVerifyingOverlay(false);
          this.router.navigate(['/tabs/home']);
        }
      });
      setTimeout(() => {
        if (!navigated) {
          navigated = true;
          try { sub.unsubscribe(); } catch (e) {}
          this.verifyingSession = false;
          this.setVerifyingOverlay(false);
          this.router.navigate(['/tabs/home']);
        }
      }, timeoutMs);

    } catch (error: any) {
      console.error('🔐 [LOGIN] Error procesando OAuth:', error);
      this.showToastMessage(`Error procesando login: ${error.message}`);
      this.verifyingSession = false;
      this.setVerifyingOverlay(false);
    }
  }

  // Ionic lifecycle hook: when the view becomes active again (e.g., after logout)
  ionViewWillEnter() {
    // Reset any transient UI flags to avoid stuck loading states when navigating back from logout
    this.submitting = false;
    this.verifyingSession = false;
    this.setVerifyingOverlay(false);
    // Also clear any lingering toasts
    this.showToast = false;
    // Trigger change detection for immediate UI update
    this.cdr.detectChanges();
  }

  ionViewWillLeave() {
    this.setVerifyingOverlay(false);
  }

  ngOnDestroy(): void {
    this.setVerifyingOverlay(false);
  }

  private setVerifyingOverlay(active: boolean) {
    try {
      document.body.classList.toggle('verifying-session-active', !!active);
    } catch {}
  }

  // (single ngOnDestroy is sufficient)

  private updateVerifyingOverlay() {
    try {
      if (this._verifyingSession) {
        document.body.classList.add('verifying-session-active');
      } else {
        document.body.classList.remove('verifying-session-active');
      }
    } catch {}
  }

  async onLogin() {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched();
      return;
    }

    // Prevenir múltiples clics
    if (this.authLoading || this.submitting) {
      return;
    }

    try {
      // Set immediate UI feedback
      this.submitting = true;
      // Verificar si reCAPTCHA está disponible
      if (!this.recaptchaService.isRecaptchaAvailable()) {
        this.showToastMessage('reCAPTCHA no disponible. Por favor, recarga la página e intenta nuevamente.');
        this.submitting = false;
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
          // pass control to verifying overlay; keep button not loading now
          this.submitting = false;
          this.verifyingSession = true;
          this.setVerifyingOverlay(true);
          // Esperar a obtener el usuario fresco desde /auth/me para evitar estado obsoleto
          this.authService.getCurrentUser().subscribe({
            next: (freshUser) => {
              // Verificar si el usuario tiene email verificado O es OAuth
              if (freshUser?.email_verified_at || freshUser?.oauth_provider) {
                this.verifyingSession = false;
                this.setVerifyingOverlay(false);
                this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
              } else {
                // Segunda comprobación breve para evitar parpadeos por estado desincronizado
                setTimeout(() => {
                  this.authService.getCurrentUser().subscribe({
                    next: (second) => {
                      if (second?.email_verified_at || second?.oauth_provider) {
                        this.verifyingSession = false;
                        this.setVerifyingOverlay(false);
                        this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
                      } else {
                        const email = (second?.email || freshUser?.email || this.loginForm.value.email || '').trim();
                        this.verifyingSession = false;
                        this.setVerifyingOverlay(false);
                        this.router.navigate(['/tabs/verify-email'], { queryParams: { email, sent: '1' } });
                      }
                    },
                    error: () => {
                      const user = this.authService.getCurrentUserValue();
                      const email = (user?.email || this.loginForm.value.email || '').trim();
                      this.verifyingSession = false;
                      this.setVerifyingOverlay(false);
                      this.router.navigate(['/tabs/verify-email'], { queryParams: { email, sent: '1' } });
                    }
                  });
                }, 350);
              }
            },
            error: () => {
              // Reintentar una vez para evitar falsos negativos por demora de backend
              setTimeout(() => {
                this.authService.getCurrentUser().subscribe({
                  next: (retryUser) => {
                    if (retryUser?.email_verified_at) {
                      this.verifyingSession = false;
                      this.setVerifyingOverlay(false);
                      this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
                    } else {
                      const email = (retryUser?.email || this.loginForm.value.email || '').trim();
                      this.verifyingSession = false;
                      this.setVerifyingOverlay(false);
                      this.router.navigate(['/tabs/verify-email'], { queryParams: { email, sent: '1' } });
                    }
                  },
                  error: () => {
                    // Último recurso: decidir con el estado actual
                    const user = this.authService.getCurrentUserValue();
                    if (user?.email_verified_at) {
                      this.verifyingSession = false;
                      this.setVerifyingOverlay(false);
                      this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
                    } else {
                      const email = (user?.email || this.loginForm.value.email || '').trim();
                      this.verifyingSession = false;
                      this.setVerifyingOverlay(false);
                      this.router.navigate(['/tabs/verify-email'], { queryParams: { email, sent: '1' } });
                    }
                  }
                });
              }, 350);
            }
          });
        },
        error: (error) => {
          console.log('❌ Error completo del backend:', error);
          this.submitting = false;
          this.setVerifyingOverlay(false);

          // Manejar caso especial de cuenta OAuth-only
          if (error.error?.error_type === 'oauth_only_account') {
            console.log('🔐 [LOGIN] Usuario tiene cuenta OAuth-only');
            const providers = error.error.oauth_providers || [];
            const providerNames = providers.map((p: string) => p.charAt(0).toUpperCase() + p.slice(1)).join(' o ');

            this.showToastMessage(`Esta cuenta está vinculada con ${providerNames}. Por favor inicia sesión con tu cuenta social.`);

            // Mostrar botones de OAuth disponibles
            this.showOAuthOptions(providers);
            return;
          }

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
      this.submitting = false;
      this.setVerifyingOverlay(false);
      this.showToastMessage('Error de reCAPTCHA. Error al verificar reCAPTCHA. Por favor, recarga la página e intenta nuevamente.');
    }
  }

  onGoogleLogin() {
    console.log('🔐 [LOGIN] Iniciando login con Google...');

    try {
      // URL del backend para Google OAuth
      const backendUrl = 'https://ecommerceapi.toolaccess.tech';
      const googleUrl = `${backendUrl}/api/auth/google`;

      console.log('🔐 [LOGIN] Redirigiendo a Google OAuth:', googleUrl);

      // Abrir ventana popup para Google OAuth
      const popup = window.open(
        googleUrl,
        'google-login',
        'width=600,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('No se pudo abrir la ventana popup. Verifica que los popups estén habilitados.');
      }

      // Escuchar el mensaje de la ventana popup
      const messageListener = (event: MessageEvent) => {
        console.log('🔐 [LOGIN] Mensaje recibido:', event.data, 'Origin:', event.origin);

        // Permitir mensajes de localhost:4200 o cualquier origen (para OAuth)
        if (event.origin !== window.location.origin &&
            !event.origin.includes('localhost:4200') &&
            !event.origin.includes('127.0.0.1:4200') &&
            event.origin !== '*') {
          console.log('🔐 [LOGIN] Origen no permitido:', event.origin);
          return;
        }

        if (event.data.type === 'GOOGLE_LOGIN_SUCCESS') {
          console.log('🔐 [LOGIN] Login con Google exitoso:', event.data);
          popup.close();
          window.removeEventListener('message', messageListener);

          // Procesar la respuesta del login
          this.handleGoogleLoginSuccess(event.data);
        } else if (event.data.type === 'GOOGLE_LOGIN_ERROR') {
          console.error('🔐 [LOGIN] Error en login con Google:', event.data.error);
          popup.close();
          window.removeEventListener('message', messageListener);

          this.showToastMessage(`Error en login con Google: ${event.data.error}`);
        }
      };

      window.addEventListener('message', messageListener);

      // Verificar si la ventana se cerró manualmente
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          console.log('🔐 [LOGIN] Ventana popup cerrada manualmente');
        }
      }, 1000);

    } catch (error: any) {
      console.error('❌ [LOGIN] Error iniciando login con Google:', error);
      this.showToastMessage(`Error: ${error.message}`);
    }
  }

  onFacebookLogin() {


    try {
      // URL del backend para Facebook OAuth
      const backendUrl = 'https://ecommerceapi.toolaccess.tech';
      const facebookUrl = `${backendUrl}/api/auth/facebook`;

      console.log('🔐 [LOGIN] Redirigiendo a Facebook OAuth:', facebookUrl);

      // Abrir ventana popup para Facebook OAuth
      const popup = window.open(
        facebookUrl,
        'facebook-login',
        'width=600,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('No se pudo abrir la ventana popup. Verifica que los popups estén habilitados.');
      }

      // Escuchar el mensaje de la ventana popup
      const messageListener = (event: MessageEvent) => {
        console.log('🔐 [LOGIN] Mensaje recibido:', event.data, 'Origin:', event.origin);

        // Permitir mensajes de localhost:4200 o cualquier origen (para OAuth)
        if (event.origin !== window.location.origin &&
            !event.origin.includes('localhost:4200') &&
            !event.origin.includes('127.0.0.1:4200') &&
            event.origin !== '*') {
          console.log('🔐 [LOGIN] Origen no permitido:', event.origin);
          return;
        }

        if (event.data.type === 'FACEBOOK_LOGIN_SUCCESS') {
          console.log('🔐 [LOGIN] Login con Facebook exitoso:', event.data);
          popup.close();
          window.removeEventListener('message', messageListener);

          // Procesar la respuesta del login
          this.handleFacebookLoginSuccess(event.data);
        } else if (event.data.type === 'FACEBOOK_LOGIN_ERROR') {
          console.error('🔐 [LOGIN] Error en login con Facebook:', event.data.error);
          popup.close();
          window.removeEventListener('message', messageListener);

          this.showToastMessage(`Error en login con Facebook: ${event.data.error}`);
        }
      };

      window.addEventListener('message', messageListener);

      // Verificar si la ventana se cerró manualmente
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          console.log('🔐 [LOGIN] Ventana popup cerrada manualmente');
        }
      }, 1000);

    } catch (error: any) {
      console.error('🔐 [LOGIN] Error iniciando login con Facebook:', error);
      this.showToastMessage(`Error: ${error.message}`);
    }
  }

  /**
   * Manejar el éxito del login con Google
   */
  private async handleGoogleLoginSuccess(data: any) {
    console.log('🔐 [LOGIN] Procesando éxito de Google:', data);

    try {
      // Mostrar overlay de verificación de sesión
      this.verifyingSession = true;
      this.setVerifyingOverlay(true);

      // Guardar token y datos del usuario
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        console.log('🔐 [LOGIN] Token guardado en localStorage');
      }
      if (data.user) {
        try { localStorage.setItem('auth_user', JSON.stringify(data.user)); } catch (e) {}
        console.log('🔐 [LOGIN] Usuario autenticado con Google:', data.user);
      }

      // Emitir evento para que AuthService procese el login OAuth
      try { window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { token: data.token, user: data.user } })); } catch (e) {}

      this.showToastMessage('¡Inicio de sesión con Google exitoso!');

      // Esperar a que AuthService confirme la sesión antes de navegar
      const timeoutMs = 5000;
      let navigated = false;
      const sub = this.authService.authState$.subscribe((state) => {
        if (state.isAuthenticated && !navigated) {
          navigated = true;
          sub.unsubscribe();
          this.verifyingSession = false;
          this.setVerifyingOverlay(false);
          this.router.navigate(['/tabs/home']);
        }
      });
      setTimeout(() => {
        if (!navigated) {
          navigated = true;
          try { sub.unsubscribe(); } catch (e) {}
          this.verifyingSession = false;
          this.setVerifyingOverlay(false);
          this.router.navigate(['/tabs/home']);
        }
      }, timeoutMs);

    } catch (error: any) {
      console.error('🔐 [LOGIN] Error procesando login con Google:', error);
      this.showToastMessage(`Error procesando login: ${error.message}`);
      this.verifyingSession = false;
      this.setVerifyingOverlay(false);
    }
  }

  /**
   * Manejar el éxito del login con Facebook
   */
  private async handleFacebookLoginSuccess(data: any) {
    console.log('🔐 [LOGIN] Procesando éxito de Facebook:', data);

    try {
      // Mostrar overlay de verificación de sesión
      this.verifyingSession = true;
      this.setVerifyingOverlay(true);

      // Guardar token y datos del usuario
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        console.log('🔐 [LOGIN] Token guardado en localStorage');
      }
      if (data.user) {
        try { localStorage.setItem('auth_user', JSON.stringify(data.user)); } catch (e) {}
        console.log('🔐 [LOGIN] Usuario autenticado con Facebook:', data.user);
      }

      // Emitir evento para que AuthService procese el login OAuth
      try { window.dispatchEvent(new CustomEvent('userLoggedIn', { detail: { token: data.token, user: data.user } })); } catch (e) {}

      this.showToastMessage('¡Inicio de sesión con Facebook exitoso!');

      // Esperar a que AuthService confirme la sesión antes de navegar
      const timeoutMs = 5000;
      let navigated = false;
      const sub = this.authService.authState$.subscribe((state) => {
        if (state.isAuthenticated && !navigated) {
          navigated = true;
          sub.unsubscribe();
          this.verifyingSession = false;
          this.setVerifyingOverlay(false);
          this.router.navigate(['/tabs/home']);
        }
      });
      setTimeout(() => {
        if (!navigated) {
          navigated = true;
          try { sub.unsubscribe(); } catch (e) {}
          this.verifyingSession = false;
          this.setVerifyingOverlay(false);
          this.router.navigate(['/tabs/home']);
        }
      }, timeoutMs);

    } catch (error: any) {
      console.error('🔐 [LOGIN] Error procesando login con Facebook:', error);
      this.showToastMessage(`Error procesando login: ${error.message}`);
      this.verifyingSession = false;
      this.setVerifyingOverlay(false);
    }
  }

  onForgotPassword(event: Event) {
    event.preventDefault();
    this.showToastMessage('Funcionalidad de restablecimiento de contraseña no implementada aún');
  }

  /**
   * Mostrar opciones de OAuth disponibles para cuentas vinculadas
   */
  showOAuthOptions(providers: string[]) {
    console.log('🔐 [LOGIN] Mostrando opciones OAuth para proveedores:', providers);

    // Aquí podrías mostrar un modal o alert con las opciones disponibles
    // Por ahora, solo logueamos la información
    if (providers.includes('google')) {
      console.log('🔐 [LOGIN] Usuario puede usar Google OAuth');
    }
    if (providers.includes('facebook')) {
      console.log('🔐 [LOGIN] Usuario puede usar Facebook OAuth');
    }
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
