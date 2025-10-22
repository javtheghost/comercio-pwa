import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { IonContent, IonButton, IonIcon, IonSpinner, IonToast } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
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
        const regex = /(?:email\/verify|auth\/email\/verify|verify)\/(\d+)(?:\/|%2F)([^\/?#&]+)/i;
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
        
        // Si ya está verificado, redirigir a home
        if (user?.email_verified_at) {
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
      if (state.user?.email_verified_at && !this.verifying) {
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
    const start = Date.now();
    this.authService.verifyEmail(id, hash, expires, signature).subscribe({
      next: (response) => {
        console.log('✅ [VERIFY EMAIL] Email verificado exitosamente:', response);
        const elapsed = Date.now() - start;
        const minShow = 500; // ms
        const wait = Math.max(0, minShow - elapsed);
        setTimeout(() => {
          // Navigate after a short delay so the loader isn't a flicker
          console.log('🚀 [VERIFY EMAIL] Redirigiendo a home después del loader...');
          this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'forward' });
        }, wait);
      },
      error: (error) => {
        console.error('❌ [VERIFY EMAIL] Error verificando email:', error);
        this.verifying = false;
        this.loading = false;
        this.verificationError = true;
        this.isVerifyingFromLink = false; // Mostrar contenido con error

        const errorMsg = error?.error?.message || 'No se pudo verificar el email. El link puede haber expirado.';
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
