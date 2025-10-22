export const environment = {
  production: true,
  apiUrl: 'https://ecommerceapi.toolaccess.tech/api', // URL de Railway
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
      clientId: '679269429706-d90a1dnes40rn3ra1lhrcnh83up9sal8.apps.googleusercontent.com',
      redirectUri: 'https://ecommerceapi.toolaccess.tech/api/auth/google/callback'
    },
    facebook: {
      appId: '753241400797565',
      redirectUri: 'https://ecommerceapi.toolaccess.tech/api/auth/facebook/callback'
    }
  },
  vatRate: 0.16 // agrega esta línea

};
