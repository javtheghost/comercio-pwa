ComercioPwa

ComercioPwa es una aplicación Progressive Web App (PWA) de comercio electrónico desarrollada con Angular y un backend en Laravel.
Permite a los usuarios navegar y comprar productos incluso sin conexión, gracias al uso de Service Workers, caché offline y sincronización con el servidor.
Incluye integración de códigos QR para una experiencia rápida y moderna en tiendas físicas o catálogos.

Características principales

PWA completa: instalable en dispositivos móviles y de escritorio.

Modo offline: los productos se almacenan en caché para su consulta sin conexión.

Sincronización inteligente: cuando se recupera la conexión, los datos se sincronizan con el backend Laravel.

Escáner QR integrado: permite agregar o buscar productos escaneando su código.

Arquitectura moderna con Angular 20 y Laravel REST API.

Autenticación segura basada en tokens JWT.

Optimización de rendimiento con precarga de módulos y lazy loading.

Requisitos previos

Asegúrate de tener instalados:

Node.js v18 o superior

Angular CLI v20.2.1

Composer y Laravel

Base de datos Postgres

Instalación y configuración
1. Clonar el repositorio
git clone https://github.com/tuusuario/ComercioPwa.git
cd ComercioPwa

2. Instalar dependencias del frontend
npm install

3. Instalar y configurar el backend Laravel
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve

4. Conectar el frontend con la API

En el archivo src/environments/environment.ts, actualiza la URL base de tu API:

export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/api'
};

Ejecución del proyecto
Frontend (Angular)
ng serve


Abre en el navegador: http://localhost:4200

Backend (Laravel)
php artisan serve

Pruebas
Pruebas unitarias (Karma)
ng test

Pruebas end-to-end
ng e2e

Build de producción
ng build --configuration production

Tecnologías utilizadas
Frontend	Backend	Otras herramientas
Angular 20	Laravel 11	Postgres
RxJS	Sanctum/JWT	Service Workers
Angular PWA	QR Scanner Ionic, Capacitor Push notifications
