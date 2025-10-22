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

    // Enviar mensaje a la ventana padre
    if (window.opener) {
      window.opener.postMessage({
        type: 'FACEBOOK_LOGIN_SUCCESS',
        token: params['token'],
        user: params['user'] ? JSON.parse(params['user']) : null,
        message: 'Login con Facebook exitoso'
      }, window.location.origin);

      console.log('🔐 [OAUTH] Mensaje enviado a ventana padre');

      // Cerrar la ventana después de un breve delay
      setTimeout(() => {
        window.close();
      }, 2000);
    } else {
      console.log('🔐 [OAUTH] No hay ventana padre, redirigiendo directamente');
      // Si no hay ventana padre, redirigir directamente
      setTimeout(() => {
        this.router.navigate(['/tabs/home']);
      }, 2000);
    }
  }

  private handleError(params: any) {
    console.log('🔐 [OAUTH] Procesando error:', params);

    this.loading = false;
    this.success = false;
    this.errorMessage = params['error'] || 'Error desconocido en el login';

    // Enviar mensaje de error a la ventana padre
    if (window.opener) {
      window.opener.postMessage({
        type: 'FACEBOOK_LOGIN_ERROR',
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
        this.router.navigate(['/login']);
      }, 3000);
    }
  }
}
