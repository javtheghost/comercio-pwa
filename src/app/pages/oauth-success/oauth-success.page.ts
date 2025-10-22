import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-oauth-success',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './oauth-success.page.html',
  styleUrls: ['./oauth-success.page.scss']
})
export class OauthSuccessPage implements OnInit {
  loading = true;
  success = false;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('🔐 [OAUTH] Página de callback OAuth iniciada');
    console.log('🔐 [OAUTH] window.opener:', !!window.opener);
    console.log('🔐 [OAUTH] window.parent:', !!window.parent);
    console.log('🔐 [OAUTH] window.parent !== window:', window.parent !== window);

    // Obtener parámetros de la URL
    this.route.queryParams.subscribe(params => {
      console.log('🔐 [OAUTH] Parámetros recibidos:', params);

      if (params['success'] === 'true') {
        this.handleSuccess(params);
      } else {
        this.handleError(params);
      }
    });
  }

  private handleSuccess(params: any) {
    console.log('🔐 [OAUTH] Procesando éxito:', params);

    this.loading = false;
    this.success = true;

    // Determinar el tipo de mensaje basado en el referrer o parámetros
    const referrer = document.referrer;
    const isFromRegister = referrer.includes('/register') || referrer.includes('/tabs/register');
    const isFromLogin = referrer.includes('/login') || referrer.includes('/tabs/login');

    // Detectar proveedor OAuth
    let userData = null;
    if (params['user']) {
      try {
        // El parámetro user viene codificado en base64, necesitamos decodificarlo
        const decodedUser = atob(params['user']);
        userData = JSON.parse(decodedUser);
        console.log('🔐 [OAUTH] Usuario decodificado:', userData);
      } catch (error) {
        console.error('🔐 [OAUTH] Error decodificando usuario:', error);
        // Fallback: intentar parsear directamente
        try {
          userData = JSON.parse(params['user']);
        } catch (fallbackError) {
          console.error('🔐 [OAUTH] Error parseando usuario directamente:', fallbackError);
        }
      }
    }
    const provider = userData?.oauth_provider || 'facebook'; // Default a facebook si no se especifica

    let messageType = '';
    let successMessage = '';

    if (isFromRegister) {
      messageType = provider === 'google' ? 'GOOGLE_REGISTER_SUCCESS' : 'FACEBOOK_REGISTER_SUCCESS';
      successMessage = `Registro con ${provider === 'google' ? 'Google' : 'Facebook'} exitoso`;
    } else if (isFromLogin) {
      messageType = provider === 'google' ? 'GOOGLE_LOGIN_SUCCESS' : 'FACEBOOK_LOGIN_SUCCESS';
      successMessage = `Login con ${provider === 'google' ? 'Google' : 'Facebook'} exitoso`;
    } else {
      // Fallback: asumir que es login
      messageType = provider === 'google' ? 'GOOGLE_LOGIN_SUCCESS' : 'FACEBOOK_LOGIN_SUCCESS';
      successMessage = `Login con ${provider === 'google' ? 'Google' : 'Facebook'} exitoso`;
    }

    console.log('🔐 [OAUTH] Tipo de mensaje:', messageType);
    console.log('🔐 [OAUTH] Referrer:', referrer);
    console.log('🔐 [OAUTH] Proveedor:', provider);

    // Intentar enviar mensaje a la ventana padre
    try {
      console.log('🔐 [OAUTH] Verificando window.opener:', !!window.opener);
      console.log('🔐 [OAUTH] window.opener.closed:', window.opener?.closed);
      console.log('🔐 [OAUTH] window.parent:', !!window.parent);
      console.log('🔐 [OAUTH] window.parent !== window:', window.parent !== window);

      let messageSent = false;

      // Método 1: Usar window.opener
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: messageType,
            token: params['token'],
            user: userData,
            message: successMessage
          }, window.location.origin);

          console.log('🔐 [OAUTH] Mensaje enviado a window.opener:', messageType);
          messageSent = true;
        } catch (error) {
          console.error('🔐 [OAUTH] Error enviando a window.opener:', error);
        }
      }

      // Método 2: Usar window.parent si el primero falló
      if (!messageSent && window.parent && window.parent !== window) {
        try {
          window.parent.postMessage({
            type: messageType,
            token: params['token'],
            user: userData,
            message: successMessage
          }, window.location.origin);

          console.log('🔐 [OAUTH] Mensaje enviado a window.parent:', messageType);
          messageSent = true;
        } catch (error) {
          console.error('🔐 [OAUTH] Error enviando a window.parent:', error);
        }
      }

      // Método 3: Intentar con '*' como targetOrigin
      if (!messageSent) {
        try {
          const targetWindow = window.opener || window.parent;
          if (targetWindow && targetWindow !== window) {
            targetWindow.postMessage({
              type: messageType,
              token: params['token'],
              user: userData,
              message: successMessage
            }, '*');

            console.log('🔐 [OAUTH] Mensaje enviado con targetOrigin "*":', messageType);
            messageSent = true;
          }
        } catch (error) {
          console.error('🔐 [OAUTH] Error enviando con "*":', error);
        }
      }

      if (messageSent) {
        console.log('🔐 [OAUTH] Mensaje enviado exitosamente, cerrando ventana en 2 segundos');
        // Procesar login directamente también, por si acaso
        this.processLoginDirectly(params);
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        console.log('🔐 [OAUTH] No se pudo enviar mensaje, procesando login directamente');
        // Si no se pudo enviar mensaje, procesar el login directamente
        this.processLoginDirectly(params);
      }

    } catch (error) {
      console.error('🔐 [OAUTH] Error general enviando mensaje:', error);
      // Fallback: procesar login directamente
      setTimeout(() => {
        this.processLoginDirectly(params);
      }, 2000);
    }
  }

  private handleError(params: any) {
    console.log('🔐 [OAUTH] Procesando error:', params);

    this.loading = false;
    this.success = false;
    this.errorMessage = params['error'] || 'Error desconocido en el login';

    // Determinar el tipo de mensaje de error basado en el referrer
    const referrer = document.referrer;
    const isFromRegister = referrer.includes('/register') || referrer.includes('/tabs/register');
    const isFromLogin = referrer.includes('/login') || referrer.includes('/tabs/login');

    let errorMessageType = '';

    if (isFromRegister) {
      errorMessageType = 'FACEBOOK_REGISTER_ERROR'; // Usar Facebook como default para errores
    } else if (isFromLogin) {
      errorMessageType = 'FACEBOOK_LOGIN_ERROR';
    } else {
      errorMessageType = 'FACEBOOK_LOGIN_ERROR'; // Fallback
    }

    console.log('🔐 [OAUTH] Tipo de mensaje de error:', errorMessageType);

    // Enviar mensaje de error a la ventana padre
    if (window.opener) {
      window.opener.postMessage({
        type: errorMessageType,
        error: this.errorMessage
      }, window.location.origin);

      console.log('🔐 [OAUTH] Mensaje de error enviado a ventana padre');

      // Cerrar la ventana después de un breve delay
      setTimeout(() => {
        window.close();
      }, 3000);
    } else {
      console.log('🔐 [OAUTH] No hay ventana padre, mostrando error');
      // Si no hay ventana padre, redirigir al login
      setTimeout(() => {
        this.router.navigate(['/tabs/login']);
      }, 3000);
    }
  }

  manualClose() {
    console.log('🔐 [OAUTH] Cierre manual solicitado');

    const params = this.route.snapshot.queryParams;

    // Intentar enviar mensaje una vez más
    try {
      let userData = null;
      if (params['user']) {
        try {
          const decodedUser = atob(params['user']);
          userData = JSON.parse(decodedUser);
        } catch (error) {
          try {
            userData = JSON.parse(params['user']);
          } catch (fallbackError) {
            console.error('🔐 [OAUTH] Error parseando usuario en manualClose:', fallbackError);
          }
        }
      }

      const provider = userData?.oauth_provider || 'facebook';
      const referrer = document.referrer;
      const isFromRegister = referrer.includes('/register') || referrer.includes('/tabs/register');

      let messageType = '';
      if (isFromRegister) {
        messageType = provider === 'google' ? 'GOOGLE_REGISTER_SUCCESS' : 'FACEBOOK_REGISTER_SUCCESS';
      } else {
        messageType = provider === 'google' ? 'GOOGLE_LOGIN_SUCCESS' : 'FACEBOOK_LOGIN_SUCCESS';
      }

      console.log('🔐 [OAUTH] Enviando mensaje manual:', messageType);

      // Intentar todos los métodos de comunicación
      const targetWindow = window.opener || window.parent;
      if (targetWindow && targetWindow !== window) {
        targetWindow.postMessage({
          type: messageType,
          token: params['token'],
          user: userData,
          message: 'Login manual exitoso'
        }, '*');

        console.log('🔐 [OAUTH] Mensaje manual enviado');
      }
    } catch (error) {
      console.error('🔐 [OAUTH] Error en cierre manual:', error);
    }

    // Procesar login directamente
    this.processLoginDirectly(params);
  }

  forceLogin() {
    console.log('🔐 [OAUTH] Forzando login...');

    const params = this.route.snapshot.queryParams;
    console.log('🔐 [OAUTH] Parámetros para forzar login:', params);

    // Procesar login directamente sin esperar
    this.processLoginDirectly(params);
  }

  private processLoginDirectly(params: any) {
    console.log('🔐 [OAUTH] Procesando login directamente:', params);

    // Guardar token en localStorage
    if (params['token']) {
      localStorage.setItem('auth_token', params['token']);
      console.log('🔐 [OAUTH] Token guardado en localStorage:', params['token']);
    }

    // Procesar y guardar datos del usuario
    let userData = null;
    if (params['user']) {
      try {
        // El parámetro user viene codificado en base64, necesitamos decodificarlo
        const decodedUser = atob(params['user']);
        userData = JSON.parse(decodedUser);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        console.log('🔐 [OAUTH] Datos del usuario guardados (Base64):', userData);
      } catch (error) {
        console.error('🔐 [OAUTH] Error decodificando datos del usuario:', error);
        // Fallback: intentar parsear directamente
        try {
          userData = JSON.parse(params['user']);
          localStorage.setItem('auth_user', JSON.stringify(userData));
          console.log('🔐 [OAUTH] Datos del usuario guardados (directo):', userData);
        } catch (fallbackError) {
          console.error('🔐 [OAUTH] Error parseando datos del usuario directamente:', fallbackError);
        }
      }
    }

    // Emitir evento personalizado para notificar al AuthService
    const event = new CustomEvent('userLoggedIn', {
      detail: {
        token: params['token'],
        user: userData
      }
    });
    window.dispatchEvent(event);
    console.log('🔐 [OAUTH] Evento userLoggedIn emitido con datos:', { token: params['token'], user: userData });

    // Verificar que los datos se guardaron correctamente
    console.log('🔐 [OAUTH] Verificando datos guardados...');
    console.log('🔐 [OAUTH] Token en localStorage:', localStorage.getItem('auth_token'));
    console.log('🔐 [OAUTH] Usuario en localStorage:', localStorage.getItem('auth_user'));

    // Forzar recarga del estado de autenticación inmediatamente
    window.location.href = '/tabs/home';
  }

  private redirectWithToken(params: any) {
    console.log('🔐 [OAUTH] Redirigiendo con token:', params);

    // Guardar token en localStorage
    if (params['token']) {
      localStorage.setItem('auth_token', params['token']);
      console.log('🔐 [OAUTH] Token guardado en localStorage');
    }

    // Redirigir a la página principal
    this.router.navigate(['/tabs/home']);
  }
}
