export const environment = {
  production: true,
  apiUrl: 'https://api.book-smart.me/api', // URL de Railway
  appName: 'STORE',
  version: '1.0.0',
  // Clave secreta para encriptación (en producción usar variable de entorno)
  encryptionSecret: 'your-super-secret-encryption-key-change-in-production',
  recaptcha: {
    siteKey: '6LdlHK8rAAAAALfyPtW17XXmJBUOZ3hjRul9wSLN'
  },
  // Configuración de OAuth para producción
  oauth: {
    google: {
      clientId: '1000869383990-76t579i12qqeq7gi48bbqrks8kg4vcuf.apps.googleusercontent.com',
      redirectUri: 'https://api.book-smart.me/api/auth/google/callback'
    },
    facebook: {
      appId: '753241400797565',
      redirectUri: 'https://api.book-smart.me/api/auth/facebook/callback'
    }
  },
  vatRate: 0.16 // agrega esta línea

};
