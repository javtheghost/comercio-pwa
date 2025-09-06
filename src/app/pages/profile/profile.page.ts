import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonAvatar, IonSpinner, IonIcon } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/auth.interfaces';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonAvatar, IonSpinner, IonIcon],
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss']
})
export class ProfilePage implements OnInit {
  user: User | null = null;
  loading = false;
  isAuthenticated = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.checkAuthState();

    // Suscribirse a cambios en el estado de autenticación
    this.authService.authState$.subscribe(authState => {
      this.isAuthenticated = authState.isAuthenticated;
      this.user = authState.user;
    });
  }

  private checkAuthState() {
    this.isAuthenticated = this.authService.isAuthenticated();
    this.user = this.authService.getCurrentUserValue();

    console.log('🔍 Estado de autenticación:', {
      isAuthenticated: this.isAuthenticated,
      user: this.user
    });
  }

  onLogin() {
    this.router.navigate(['/login']);
  }

  onRegister() {
    this.router.navigate(['/register']);
  }

  onLogout() {
    this.loading = true;
    console.log('🚪 Iniciando proceso de logout...');

    this.authService.logout().subscribe({
      next: () => {
        this.loading = false;
        console.log('✅ Logout exitoso');
        // El estado se actualiza automáticamente a través de authState$
        // No necesitamos redirigir, el componente se actualiza automáticamente
      },
      error: (error) => {
        this.loading = false;
        console.error('❌ Error en logout:', error);
        // Even if logout fails on server, local state is cleared
        // El usuario ya no está autenticado localmente
      }
    });
  }

  formatDate(dateString?: string): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

}
