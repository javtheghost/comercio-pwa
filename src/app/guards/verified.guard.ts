import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanActivateChild, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ToastController } from '@ionic/angular';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class VerifiedGuard implements CanActivate, CanActivateChild {
  private static toastActive = false;
  private static checking = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toastController: ToastController
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> {
    // Si no está autenticado, mandar a login
    if (!this.authService.isAuthenticated()) {
      return this.router.parseUrl('/tabs/login');
    }
    // Permitir verificar correo explícitamente
    if (state.url === '/tabs/verify-email' || route.routeConfig?.path === 'verify-email') {
      return true;
    }

    // Verificar estado actual en memoria
    const user = this.authService.getCurrentUserValue();
    if (user?.email_verified_at) {
      return true;
    }

    // Estado podría estar obsoleto. Consultar /auth/me antes de decidir.
    // Si ya estamos consultando, no interrumpir navegación; permitir continuar temporalmente
    if (VerifiedGuard.checking) {
      return true;
    }
    VerifiedGuard.checking = true;
    return this.authService.getCurrentUser().pipe(
      map((fresh) => {
        VerifiedGuard.checking = false;
        // Verificar si el usuario está verificado O si viene de OAuth
        if (fresh?.email_verified_at || fresh?.oauth_provider) {
          return true;
        }
        this.presentVerifyToast();
        return this.router.parseUrl('/tabs/verify-email');
      }),
      catchError(() => {
        VerifiedGuard.checking = false;
        this.presentVerifyToast();
        return of(this.router.parseUrl('/tabs/verify-email'));
      })
    );
  }

  canActivateChild(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> {
    // Permitir libremente la página de verificación
    if (route.routeConfig?.path === 'verify-email') {
      return true;
    }
    return this.canActivate(route, state);
  }

  private async presentVerifyToast(): Promise<void> {
    try {
      if (VerifiedGuard.toastActive) return;
      VerifiedGuard.toastActive = true;

      const toast = await this.toastController.create({
        message: 'Verifica tu correo para continuar',
        duration: 2500,
        position: 'top',
        color: 'warning',
        cssClass: 'verify-toast',
        buttons: [
          {
            text: 'Abrir',
            role: 'cancel',
            handler: () => this.router.navigateByUrl('/tabs/verify-email')
          }
        ]
      });

      toast.onDidDismiss().then(() => (VerifiedGuard.toastActive = false));
      await toast.present();
    } catch {
      VerifiedGuard.toastActive = false;
    }
  }
}
