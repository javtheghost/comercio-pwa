// environment.ts - Desarrollo
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api', // URL del backend Laravel local
  appName: 'STORE',
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
      clientId: '679269429706-d90a1dnes40rn3ra1lhrcnh83up9sal8.apps.googleusercontent.com', // Google Client ID
      redirectUri: 'http://127.0.0.1:8000/api/auth/google/callback'
    },
    facebook: {
      appId: '753241400797565', // Facebook App ID
      redirectUri: 'http://127.0.0.1:8000/api/auth/facebook/callback'
    }
  }
};
