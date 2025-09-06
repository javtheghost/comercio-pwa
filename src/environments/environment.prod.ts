export const environment = {
  production: true,
  apiUrl: 'https://ecommerceapi-production-fe72.up.railway.app/api', // URL de Railway
  appName: 'STORE',
  version: '1.0.0',
  recaptcha: {
    siteKey: '6LdlHK8rAAAAALfyPtW17XXmJBUOZ3hjRul9wSLN'
  },
  // Configuración de OAuth para producción
  oauth: {
    google: {
      clientId: '679269429706-d90a1dnes40rn3ra1lhrcnh83up9sal8.apps.googleusercontent.com',
      redirectUri: 'https://ecommerceapi-production-fe72.up.railway.app/api/auth/google/callback'
    },
    facebook: {
      appId: '753241400797565',
      redirectUri: 'https://ecommerceapi-production-fe72.up.railway.app/api/auth/facebook/callback'
    }
  }
};
