import { Component } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonAvatar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardContent, IonItem, IonLabel, IonInput, IonButton, IonAvatar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Mi Perfil</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-card>
        <ion-card-content>
          <ion-item>
            <ion-avatar slot="start">
              <img src="https://via.placeholder.com/100x100" alt="Avatar" />
            </ion-avatar>
            <ion-label>
              <h2>Usuario</h2>
              <p>usuario@email.com</p>
            </ion-label>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Nombre</ion-label>
            <ion-input placeholder="Tu nombre"></ion-input>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Email</ion-label>
            <ion-input type="email" placeholder="tu@email.com"></ion-input>
          </ion-item>

          <ion-item>
            <ion-label position="stacked">Teléfono</ion-label>
            <ion-input type="tel" placeholder="+1234567890"></ion-input>
          </ion-item>

          <ion-button expand="block" class="ion-margin-top">
            Guardar Cambios
          </ion-button>
        </ion-card-content>
      </ion-card>
    </ion-content>
  `
})
export class ProfilePage {
  constructor() {}
}
