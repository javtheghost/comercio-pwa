import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { IonContent, IonButton, IonIcon, IonSpinner, IonToast } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment.prod';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, IonContent, IonButton, IonIcon, IonSpinner, IonToast],
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss']
})
export class VerifyEmailPage implements OnInit, OnDestroy {
  loading = false;
  showToast = false;
  toastMessage = '';
  email: string | undefined;
  unauthenticated = false;
  verifying = false;
  verificationSuccess = false;
  verificationError = false;
  isVerifyingFromLink = false; // Nueva flag para ocultar contenido durante verificación

  private visHandler?: () => void;
  private authSub?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private navCtrl: NavController
  ) {}

  ngOnInit(): void {
    console.log('📧 [VERIFY EMAIL] Página iniciada');
    // Quick check: if we already have an OAuth user/token in localStorage, avoid showing the verify screen
    try {
      const token = localStorage.getItem('auth_token');
      const userStr = localStorage.getItem('auth_user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (parsed?.oauth_provider) {
          console.log('📧 [VERIFY EMAIL] auth_user indicates OAuth provider, redirecting to home');
          this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
          return;
        }
      }

      // If there's a token but AuthService hasn't restored the session yet, show verifying spinner
      if (token && !this.authService.isAuthenticated()) {
        console.log('📧 [VERIFY EMAIL] Token found in storage but session not yet restored — showing processing state');
        this.verifying = true;
        this.loading = true;
        // Fallback: stop waiting after 5s to avoid blocking UI indefinitely
        setTimeout(() => {
          if (this.verifying) {
            console.log('📧 [VERIFY EMAIL] Timeout waiting for session restore — hiding processing state');
            this.verifying = false;
            this.loading = false;
          }
        }, 5000);
      }
    } catch (e) {
      console.warn('📧 [VERIFY EMAIL] Error parsing localStorage auth_user:', e);
    }
    
    // Capturar parámetros de la URL para verificación automática
    this.route.queryParamMap.subscribe((params) => {
      const id = params.get('id');
      const hash = params.get('hash');
      const expires = params.get('expires') || undefined;
      const signature = params.get('signature') || undefined;
      const emailParam = params.get('email') || undefined;
      const sent = params.get('sent');

      console.log('📧 [VERIFY EMAIL] Query params:', { id, hash, expires, signature, emailParam, sent });

      // Si tenemos id y hash, es un link de verificación del email
      if (id && hash) {
        console.log('✅ [VERIFY EMAIL] Detectado link de verificación, procesando...');
        this.isVerifyingFromLink = true; // Ocultar contenido, solo mostrar loader
        this.verifyEmailWithToken(id, hash, expires, signature);
        return;
      }

      // Fallback: algunos proveedores o redirecciones pueden reescribir el link y quitar query params.
      // Intentar extraer id/hash desde la URL completa (path segments) si no vienen como query params.
      try {
        const href = window.location.href || '';
        // Buscar patrones como /email/verify/{id}/{hash} o /auth/email/verify/{id}/{hash}
        // Aceptar id y hash como cualquier segmento (no solo dígitos)
        const regex = /(?:email\/verify|auth\/email\/verify|verify)\/([^\/?#&]+)\/([^\/?#&]+)/i;
        const m = href.match(regex);
        if (m && m[1] && m[2]) {
          const idFromPath = decodeURIComponent(m[1]);
          const hashFromPath = decodeURIComponent(m[2]);
          console.log('✅ [VERIFY EMAIL] Detectado link de verificación en path, procesando...', { idFromPath, hashFromPath });
          this.isVerifyingFromLink = true;
          this.verifyEmailWithToken(idFromPath, hashFromPath, expires, signature);
          return;
        }
      } catch (e) {
        console.warn('⚠️ [VERIFY EMAIL] Error intentando extraer token desde URL:', e);
      }

      // Caso normal: mostrar instrucciones de que se envió el email
      const user = this.authService.getCurrentUserValue();
      
      if (this.authService.isAuthenticated()) {
        this.email = user?.email || emailParam || undefined;
        
        // Si ya está verificado o es cuenta OAuth, redirigir a home
        if (user?.email_verified_at || user?.oauth_provider) {
          console.log('✅ [VERIFY EMAIL] Usuario ya verificado, redirigiendo a home');
          this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
          return;
        }
        
        // Usuario autenticado pero no verificado: mostrar pantalla de "revisa tu email"
        console.log('📧 [VERIFY EMAIL] Usuario autenticado pero no verificado, mostrando instrucciones');
        this.unauthenticated = false;
        if (sent === '1') {
          this.show('Te enviamos un correo de verificación. Revisa tu bandeja.');
        }
      } else {
        // No autenticado: mostrar instrucciones básicas
        console.log('⚠️ [VERIFY EMAIL] Usuario no autenticado, mostrando instrucciones básicas');
        this.unauthenticated = true;
        if (emailParam) this.email = emailParam;
        if (sent === '1') {
          this.show('Te enviamos un correo de verificación. Revisa tu bandeja.');
        }
      }
    });

    // Suscribirse a cambios de autenticación
    this.authSub = this.authService.authState$.subscribe(state => {
      this.unauthenticated = !state.isAuthenticated;
      this.email = state.user?.email || this.email;
      if ((state.user?.email_verified_at || state.user?.oauth_provider) && !this.verifying) {
        console.log('✅ [VERIFY EMAIL] Usuario verificado detectado, redirigiendo a home');
        setTimeout(() => {
          this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
        }, 1500);
      }
    });

    // Al volver a la app, refrescar estado
    this.visHandler = () => {
      if (document.visibilityState === 'visible' && !this.verifying) {
        this.refreshStatus();
      }
    };
    document.addEventListener('visibilitychange', this.visHandler);
  }

  /**
   * Verifica el email usando el token de la URL
   */
  private verifyEmailWithToken(id: string, hash: string, expires?: string, signature?: string): void {
    console.log('🔄 [VERIFY EMAIL] Verificando email con token...');
    this.verifying = true;
    this.loading = true;
    const wasAuthenticatedBefore = this.authService.isAuthenticated();
    console.log('🔐 [VERIFY EMAIL] Usuario estaba autenticado antes de verificar:', wasAuthenticatedBefore);

    this.authService.verifyEmail(id, hash, expires, signature).subscribe({
      next: (response) => {
        console.log('✅ [VERIFY EMAIL] Email verificado exitosamente (API):', response);
        
        // Caso 1: El backend devolvió token y user (auto-login)
        if (response.data?.token && response.data?.user) {
          console.log('🔑 [VERIFY EMAIL] Backend devolvió token, esperando a que AuthService actualice estado...');
          
          // Esperar un poco a que AuthService procese la respuesta
          setTimeout(() => {
            console.log('� [VERIFY EMAIL] Redirigiendo a home después de auto-login');
            this.verifying = false;
            this.loading = false;
            this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'forward' });
          }, 1000);
          return;
        }

        // Caso 2: Usuario estaba autenticado, solo necesitamos refrescar su estado
        if (wasAuthenticatedBefore) {
          console.log('🔄 [VERIFY EMAIL] Usuario autenticado, refrescando estado...');
          this.authService.getCurrentUser().subscribe({
            next: (user) => {
              console.log('✅ [VERIFY EMAIL] Estado actualizado, usuario:', user);
              if (user?.email_verified_at) {
                console.log('🚀 [VERIFY EMAIL] Email verificado, redirigiendo a home');
                this.verifying = false;
                this.loading = false;
                this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'forward' });
              } else {
                console.warn('⚠️ [VERIFY EMAIL] Email aún no verificado según getCurrentUser');
                this.verifying = false;
                this.loading = false;
                this.isVerifyingFromLink = false;
                this.show('Verificación completada. Por favor, actualiza la página.');
              }
            },
            error: (err) => {
              console.error('❌ [VERIFY EMAIL] Error obteniendo usuario actualizado:', err);
              this.verifying = false;
              this.loading = false;
              this.isVerifyingFromLink = false;
              this.show('Email verificado, pero hubo un error al actualizar tu sesión. Inicia sesión nuevamente.');
            }
          });
          return;
        }

        // Caso 3: Usuario NO estaba autenticado y el backend NO devolvió token
        // Redirigir al login con mensaje de éxito
        console.log('✅ [VERIFY EMAIL] Email verificado. Usuario no autenticado, redirigiendo a login');
        this.verifying = false;
        this.loading = false;
        
        // Guardar mensaje de éxito en localStorage para mostrarlo en login
        localStorage.setItem('email_verified_message', 'Tu correo ha sido verificado exitosamente. Ahora puedes iniciar sesión.');
        
        this.navCtrl.navigateRoot(['/tabs/login'], { 
          animationDirection: 'forward',
          queryParams: { verified: '1' }
        });
      },
      error: (error) => {
        console.error('❌ [VERIFY EMAIL] Error verificando email (API):', error);
        this.verifying = false;
        this.loading = false;
        this.verificationError = true;
        this.isVerifyingFromLink = false;
        
        const errorMsg = error?.error?.message || error?.message || 'No se pudo verificar el email. El link puede haber expirado o ya fue usado.';
        this.show(errorMsg);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.visHandler) document.removeEventListener('visibilitychange', this.visHandler);
    if (this.authSub) this.authSub.unsubscribe();
  }

  async resend(): Promise<void> {
    try {
      if (!this.authService.isAuthenticated()) {
        this.show('Inicia sesión para reenviar el correo de verificación.');
        return;
      }
      this.loading = true;
      await this.authService.resendVerificationEmail();
      this.show('Hemos reenviado el correo de verificación. Revisa tu bandeja.');
    } catch (e) {
      this.show('No se pudo reenviar el correo. Intenta más tarde.');
    } finally {
      this.loading = false;
    }
  }

  refreshStatus(): void {
    if (!this.authService.isAuthenticated()) {
      this.show('Inicia sesión para verificar el estado.');
      return;
    }
    this.loading = true;
    this.authService.getCurrentUser().subscribe({
      next: (u) => {
        this.loading = false;
        if (u?.email_verified_at) {
          this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
        } else {
          this.show('Tu correo aún no está verificado.');
        }
      },
      error: () => {
        this.loading = false;
        this.show('No se pudo actualizar el estado.');
      }
    });
  }

  private show(msg: string) {
    this.toastMessage = msg;
    this.showToast = true;
  }

  goToLogin(): void {
    // Desde verificar correo hacia login: derecha->izquierda (forward)
    this.navCtrl.navigateRoot(['/tabs/login'], { animationDirection: 'forward' });
  }
}
