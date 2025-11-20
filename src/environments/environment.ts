// environment.ts - Desarrollo
export const environment = {

  production: true,
  apiUrl: 'https://api.book-smart.me/api', // URL del backend Laravel
  appName: 'Book Smart Store',
  version: '1.0.0',
  // Tasa de IVA por defecto (16% en MX)
  vatRate: 0.16,
  // Clave secreta para encriptación (en producción usar variable de entorno)
  encryptionSecret: 'your-super-secret-encryption-key-change-in-production',
  recaptcha: {
    siteKey: '6LdlHK8rAAAAALfyPtW17XXmJBUOZ3hjRul9wSLN' // Nueva Site Key
  },
  // Configuración de OAuth
  oauth: {
    google: {
      clientId: '1000869383990-76t579i12qqeq7gi48bbqrks8kg4vcuf.apps.googleusercontent.com', // Google Client ID
      redirectUri: 'https://api.book-smart.me/api/auth/google/callback'
    },
    facebook: {
      appId: '753241400797565', // Facebook App ID
      redirectUri: 'https://api.book-smart.me/api/auth/facebook/callback'
    }
  },

};
