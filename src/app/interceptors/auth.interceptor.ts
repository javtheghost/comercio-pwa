import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { SecurityService } from '../services/security.service';

export const authInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<any> => {
  const authService = inject(AuthService);
  const securityService = inject(SecurityService);

  // Agregar token a las peticiones autenticadas
  const modifiedRequest = addTokenToRequest(request, authService, securityService);

  return next(modifiedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && authService.isAuthenticated()) {
        try {
          const url = request.url || '';
          const isAuthMe = /\/auth\/me(\?.*)?$/.test(url);
          const isLogin = /\/auth\/login(\?.*)?$/.test(url);
          const isRefresh = /\/auth\/(refresh|token|refresh-token)(\/.+)?(\?.*)?$/.test(url);

          // Solo cerrar sesión si el 401 viene de validar identidad
          if (isAuthMe || isRefresh) {
            authService.logout().subscribe();
          }
          // Para otros 401, dejar que la UI maneje el error sin cerrar la sesión automáticamente
        } catch (e) {
          // En caso de cualquier error en esta lógica, no forzar logout
          console.warn('[AUTH INTERCEPTOR] Error evaluando 401, no se forzará logout:', e);
        }
      }
      return throwError(() => error);
    })
  );
};

function addTokenToRequest(request: HttpRequest<any>, authService: AuthService, securityService: SecurityService): HttpRequest<any> {
  // Verificar si el usuario está autenticado
  if (authService.isAuthenticated()) {
    try {
      // Obtener el token usando SecurityService (método síncrono)
      const token = securityService.getTokenSync();
      if (token) {
        return request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('❌ [AUTH INTERCEPTOR] Error obteniendo token:', error);
    }
  }
  return request;
}
