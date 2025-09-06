import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

declare global {
  interface Window {
    grecaptcha: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class RecaptchaService {
  private isLoaded = false;
  private siteKey = environment.recaptcha.siteKey;
  private platformId = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadRecaptchaScript();
    }
  }

  /**
   * Carga el script de reCAPTCHA v3 de Google
   */
  private loadRecaptchaScript(): void {
    if (this.isLoaded || !isPlatformBrowser(this.platformId)) return;

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${this.siteKey}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('reCAPTCHA script cargado exitosamente');
      // Esperar un poco más para asegurar que grecaptcha esté disponible
      setTimeout(() => {
        this.isLoaded = true;
        console.log('reCAPTCHA marcado como cargado, grecaptcha disponible:', !!window.grecaptcha);
      }, 1000);
    };

    script.onerror = () => {
      console.error('Error cargando script de reCAPTCHA');
      this.isLoaded = false;
    };

    // Agregar el script al DOM
    document.head.appendChild(script);
  }

  /**
   * Ejecuta reCAPTCHA v3 y retorna el token
   */
  async execute(action: string): Promise<string> {
    console.log('🔒 RecaptchaService.execute() llamado con acción:', action);

    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('reCAPTCHA solo está disponible en el navegador');
    }

    // Verificar que el siteKey esté configurado
    if (!this.siteKey) {
      console.error('❌ SiteKey de reCAPTCHA no configurado');
      throw new Error('SiteKey de reCAPTCHA no configurado');
    }

    // Esperar a que reCAPTCHA esté completamente cargado
    console.log('⏳ Esperando a que reCAPTCHA esté disponible...');
    await this.waitForRecaptcha();
    console.log('✅ reCAPTCHA está disponible, procediendo con ejecución...');

    return new Promise((resolve, reject) => {
      try {
        // Verificar que grecaptcha esté disponible
        if (!window.grecaptcha) {
          console.error('❌ window.grecaptcha no está disponible');
          reject(new Error('reCAPTCHA no está disponible'));
          return;
        }

        console.log('🔄 Llamando a grecaptcha.ready()...');
        window.grecaptcha.ready(() => {
          console.log('✅ grecaptcha.ready() ejecutado, llamando a execute...');

          // Verificar que el método execute esté disponible
          if (typeof window.grecaptcha.execute !== 'function') {
            console.error('❌ grecaptcha.execute no es una función');
            reject(new Error('grecaptcha.execute no está disponible'));
            return;
          }

          // Agregar un pequeño delay para asegurar inicialización
          setTimeout(() => {
            console.log('🚀 Ejecutando grecaptcha.execute con siteKey:', this.siteKey, 'y acción:', action);

            window.grecaptcha.execute(this.siteKey, { action })
              .then((token: string) => {
                if (!token || token.length === 0) {
                  console.error('❌ Token de reCAPTCHA vacío o inválido');
                  reject(new Error('Token de reCAPTCHA vacío'));
                  return;
                }

                console.log('✅ reCAPTCHA ejecutado exitosamente para:', action);
                console.log('🔑 Token recibido, longitud:', token.length);
                console.log('🔑 Token (primeros 20 caracteres):', token.substring(0, 20) + '...');
                resolve(token);
              })
              .catch((error: any) => {
                console.error('❌ Error ejecutando reCAPTCHA:', error);
                console.error('❌ Detalles del error:', {
                  name: error.name,
                  message: error.message,
                  stack: error.stack
                });
                reject(error);
              });
          }, 1000); // Aumentar delay a 1 segundo
        });
      } catch (error) {
        console.error('❌ Error con reCAPTCHA:', error);
        reject(error);
      }
    });
  }

  /**
   * Espera a que reCAPTCHA esté disponible
   */
  private async waitForRecaptcha(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 segundos máximo

      const checkRecaptcha = () => {
        attempts++;

        if (window.grecaptcha && window.grecaptcha.ready && typeof window.grecaptcha.execute === 'function') {
          console.log('✅ reCAPTCHA completamente disponible después de', attempts, 'intentos');
          resolve();
        } else if (attempts >= maxAttempts) {
          console.error('❌ Timeout esperando reCAPTCHA después de', maxAttempts, 'intentos');
          reject(new Error('Timeout esperando reCAPTCHA'));
        } else {
          setTimeout(checkRecaptcha, 100);
        }
      };
      checkRecaptcha();
    });
  }

  /**
   * Verifica si reCAPTCHA está disponible
   */
  isRecaptchaAvailable(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }

    // Verificar si el script está cargado y grecaptcha está disponible
    const isScriptLoaded = this.isLoaded;
    const isGrecaptchaAvailable = !!window.grecaptcha;

    console.log('🔍 Verificando disponibilidad de reCAPTCHA:', {
      isScriptLoaded,
      isGrecaptchaAvailable,
      siteKey: this.siteKey
    });

    return isScriptLoaded && isGrecaptchaAvailable;
  }

  /**
   * Verifica el estado de reCAPTCHA de forma más detallada
   */
  getRecaptchaStatus(): { available: boolean; details: any } {
    if (!isPlatformBrowser(this.platformId)) {
      return {
        available: false,
        details: { reason: 'Not in browser' }
      };
    }

    const details = {
      isScriptLoaded: this.isLoaded,
      isGrecaptchaAvailable: !!window.grecaptcha,
      siteKey: this.siteKey,
      scriptExists: !!document.querySelector(`script[src*="recaptcha"]`)
    };

    return {
      available: this.isLoaded && !!window.grecaptcha,
      details
    };
  }
}
