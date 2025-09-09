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
        // Por ahora, simplemente hacer logout en caso de 401
        // En el futuro se puede implementar refresh token automático
        authService.logout().subscribe();
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
