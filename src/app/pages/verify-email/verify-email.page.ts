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

  private visHandler?: () => void;
  private authSub?: Subscription;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private navCtrl: NavController
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUserValue();
    // Caso autenticado
    if (this.authService.isAuthenticated()) {
      this.email = user?.email || undefined;
      // Si ya está verificado, salir
      if (user?.email_verified_at) {
        // Al estar verificado, transición izquierda->derecha (back)
        this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
        return;
      }
      // Estado podría estar desactualizado; refrescar inmediatamente
      this.refreshStatus();
    } else {
      // Caso NO autenticado: permitir mostrar instrucciones usando query params
      this.unauthenticated = true;
      this.route.queryParamMap.subscribe((params) => {
        const emailParam = params.get('email') || undefined;
        const sent = params.get('sent');
        if (emailParam) this.email = emailParam;
        if (sent === '1') {
          this.show('Te enviamos un correo de verificación. Revisa tu bandeja.');
        }
      });
    }

    // Suscribirse a cambios de autenticación para actualizar UI y navegar si se verifica
    this.authSub = this.authService.authState$.subscribe(state => {
      this.unauthenticated = !state.isAuthenticated;
      this.email = state.user?.email || this.email;
      if (state.user?.email_verified_at) {
        this.navCtrl.navigateRoot(['/tabs/home'], { animationDirection: 'back' });
      }
    });
    // Al volver a la app (por ejemplo, tras tocar el enlace del correo), refrescar estado
    this.visHandler = () => {
      if (document.visibilityState === 'visible') {
        this.refreshStatus();
      }
    };
    document.addEventListener('visibilitychange', this.visHandler);
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
