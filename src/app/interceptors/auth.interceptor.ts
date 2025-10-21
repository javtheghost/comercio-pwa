import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, from } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { SecurityService } from '../services/security.service';

// Flag global para evitar múltiples refreshes simultáneos
let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<any> => {
  const authService = inject(AuthService);
  const securityService = inject(SecurityService);
  const httpClient = inject(HttpClient);

  // Agregar token a las peticiones autenticadas
  const modifiedRequest = addTokenToRequest(request, authService, securityService);

  // DEBUG: loggear peticiones salientes en localhost para ayudar a diagnosticar llamadas (sin exponer token completo)
  try {
    const isLocal = typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
    if (isLocal) {
      try {
        const shortAuth = modifiedRequest.headers.get('Authorization') ? modifiedRequest.headers.get('Authorization')!.substring(0, 30) + '...' : 'none';
        console.log(`🔁 [HTTP DEBUG] ${modifiedRequest.method} ${modifiedRequest.url} - Authorization: ${shortAuth}`);
      } catch (e) { /* noop */ }
    }
  } catch (e) { /* noop */ }

  return next(modifiedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && authService.isAuthenticated()) {
        const url = request.url || '';
        const isLogin = /\/auth\/login(\?.*)?$/.test(url);
        const isRefresh = /\/auth\/(refresh|token|refresh-token)(\/.+)?(\?.*)?$/.test(url);

        // Si es login o refresh que falló, no intentar renovar
        if (isLogin || isRefresh) {
          console.warn('🔴 [AUTH INTERCEPTOR] Login o refresh falló, cerrando sesión');
          authService.logout().subscribe();
          return throwError(() => error);
        }

        // Si ya estamos refrescando, esperar
        if (isRefreshing) {
          console.log('⏳ [AUTH INTERCEPTOR] Ya hay un refresh en progreso, esperando...');
          return throwError(() => error);
        }

        // Intentar renovar el token automáticamente
        console.log('🔄 [AUTH INTERCEPTOR] 401 detectado, intentando renovar token...');
        isRefreshing = true;

        return from(handleTokenRefresh(httpClient, authService, securityService, request, next)).pipe(
          switchMap(result => result),
          catchError(refreshError => {
            console.error('❌ [AUTH INTERCEPTOR] Error al renovar token, cerrando sesión');
            isRefreshing = false;
            authService.logout().subscribe();
            return throwError(() => refreshError);
          })
        );
      }
      return throwError(() => error);
    })
  );
};

/**
 * Maneja la renovación automática del token cuando expira
 */
async function handleTokenRefresh(
  httpClient: HttpClient,
  authService: AuthService,
  securityService: SecurityService,
  originalRequest: HttpRequest<unknown>,
  next: HttpHandlerFn
): Promise<Observable<any>> {
  try {
    const currentToken = securityService.getTokenSync();
    
    if (!currentToken) {
      throw new Error('No hay token para renovar');
    }

    console.log('🔑 [AUTH INTERCEPTOR] Llamando a /auth/refresh...');

    // Llamar al endpoint de refresh con el token actual
    const refreshResponse: any = await httpClient.post(
      '/auth/refresh',
      {},
      {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      }
    ).toPromise();

    // Extraer el nuevo token (compatible con ambas estructuras)
    const newToken = refreshResponse?.token || refreshResponse?.data?.token;
    const userData = refreshResponse?.data?.user;

    if (!newToken) {
      throw new Error('No se recibió token en la respuesta del refresh');
    }

    console.log('✅ [AUTH INTERCEPTOR] Token renovado exitosamente');
    console.log('🔍 [AUTH INTERCEPTOR] Nuevo token (primeros 30 chars):', newToken.substring(0, 30) + '...');

    // Guardar el nuevo token
    await securityService.setSecureToken(newToken);

    // Actualizar datos del usuario si vienen en la respuesta
    if (userData) {
      console.log('👤 [AUTH INTERCEPTOR] Actualizando datos del usuario con roles:', userData.roles);
      await securityService.setSecureUser(userData);
    }

    // Reintentar la petición original con el nuevo token
    console.log('🔄 [AUTH INTERCEPTOR] Reintentando petición original con nuevo token...');
    const retryRequest = originalRequest.clone({
      setHeaders: {
        Authorization: `Bearer ${newToken}`
      }
    });

    isRefreshing = false;
    return next(retryRequest);

  } catch (error: any) {
    isRefreshing = false;
    console.error('❌ [AUTH INTERCEPTOR] Error en handleTokenRefresh:', error);
    throw error;
  }
}

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
