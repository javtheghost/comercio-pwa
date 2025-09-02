import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Define custom elements for PWA
defineCustomElements(window);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
