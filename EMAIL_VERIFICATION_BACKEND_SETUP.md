# 📧 Configuración de Verificación de Email - Backend

## 🎯 Problema a resolver:

1. ✅ El link del email debe apuntar a la URL correcta de la PWA
2. ✅ El link debe incluir todos los parámetros necesarios (id, hash, expires, signature)
3. ✅ Al verificar, el backend debe retornar token + usuario para login automático

---

## � Pasos rápidos (Resumen ejecutivo):

1. ✅ Agregar `FRONTEND_URL=http://localhost:4200` en `.env`
2. ✅ Crear `app/Notifications/VerifyEmailNotification.php` (código completo abajo)
3. ✅ **CREAR** `resources/views/emails/verify-email.blade.php` (HTML bonito abajo)
4. ✅ Modificar `User.php` para usar la notificación personalizada
5. ✅ Crear `VerificationController.php` con método `verify()` que retorna token
6. ✅ Agregar rutas en `routes/api.php`

---

## �📝 Cambios requeridos en el Backend (Laravel)

### 1. Configurar la URL del frontend en `.env`

```env
# URL de la PWA (desarrollo)
FRONTEND_URL=http://localhost:4200

# URL de la PWA (producción)
# FRONTEND_URL=https://tu-dominio.com
```

### 2. Modificar el email de verificación

**Archivo: `app/Notifications/VerifyEmailNotification.php` (o similar)**

```php
<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail as BaseVerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\URL;

class VerifyEmailNotification extends BaseVerifyEmail
{
    /**
     * Get the verification URL for the given notifiable.
     *
     * @param  mixed  $notifiable
     * @return string
     */
    protected function verificationUrl($notifiable)
    {
        // Generar la URL firmada del backend
        $backendUrl = URL::temporarySignedRoute(
            'verification.verify',
            Carbon::now()->addMinutes(Config::get('auth.verification.expire', 60)),
            [
                'id' => $notifiable->getKey(),
                'hash' => sha1($notifiable->getEmailForVerification()),
            ]
        );

        // Extraer los parámetros de la URL del backend
        $parsedUrl = parse_url($backendUrl);
        parse_str($parsedUrl['query'] ?? '', $queryParams);

        // Construir la URL del frontend con los parámetros necesarios
        $frontendUrl = rtrim(env('FRONTEND_URL', 'http://localhost:4200'), '/');
        
        $verifyUrl = $frontendUrl . '/verify-email?' . http_build_query([
            'id' => $notifiable->getKey(),
            'hash' => sha1($notifiable->getEmailForVerification()),
            'expires' => $queryParams['expires'] ?? null,
            'signature' => $queryParams['signature'] ?? null,
        ]);

        return $verifyUrl;
    }

    /**
     * Build the mail representation of the notification.
     *
     * @param  mixed  $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function toMail($notifiable)
    {
        $verificationUrl = $this->verificationUrl($notifiable);
        $userName = $notifiable->first_name ?? 'Usuario';

        return (new MailMessage)
            ->subject('¡Bienvenido! Verifica tu cuenta')
            ->greeting('¡Hola ' . $userName . '!')
            ->line('Gracias por registrarte en nuestra plataforma.')
            ->line('Estás a un paso de completar tu registro. Por favor verifica tu dirección de correo electrónico haciendo clic en el botón de abajo:')
            ->action('Verificar mi correo', $verificationUrl)
            ->line('Este enlace expirará en 60 minutos.')
            ->line('Si no creaste una cuenta, puedes ignorar este correo de forma segura.')
            ->salutation('Saludos, Ecommerce API');
    }
}
```

### 3. ⚠️ IMPORTANTE: Personalizar el diseño del email con HTML/CSS

**EL EMAIL ACTUAL SE VE MUY PLANO Y ABURRIDO. NECESITAS IMPLEMENTAR ESTE DISEÑO BONITO:**

Para un email profesional y atractivo, crea una vista Blade personalizada:

**Archivo: `resources/views/emails/verify-email.blade.php`**

```blade
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verificación de Email</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f6f7fb;
        }
        .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .email-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
        }
        .email-header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .email-body {
            padding: 40px 30px;
        }
        .greeting {
            font-size: 24px;
            color: #1a202c;
            margin-bottom: 20px;
            font-weight: 600;
        }
        .content {
            color: #4a5568;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .button-wrapper {
            text-align: center;
            margin: 35px 0;
        }
        .verify-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            transition: all 0.3s ease;
        }
        .verify-button:hover {
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
            transform: translateY(-2px);
        }
        .info-box {
            background-color: #f7fafc;
            border-left: 4px solid #667eea;
            padding: 15px 20px;
            margin: 25px 0;
            border-radius: 4px;
        }
        .info-box p {
            margin: 0;
            color: #4a5568;
            font-size: 14px;
        }
        .footer {
            background-color: #f7fafc;
            padding: 30px;
            text-align: center;
            color: #718096;
            font-size: 14px;
        }
        .footer a {
            color: #667eea;
            text-decoration: none;
        }
        .icon {
            width: 60px;
            height: 60px;
            margin: 0 auto 20px;
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 30px;
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <!-- Header -->
        <div class="email-header">
            <div class="icon">📧</div>
            <h1>Verifica tu cuenta</h1>
        </div>

        <!-- Body -->
        <div class="email-body">
            <p class="greeting">¡Hola {{ $user->first_name }}!</p>
            
            <p class="content">
                Gracias por registrarte en <strong>Ecommerce API</strong>. Estamos emocionados de tenerte con nosotros.
            </p>
            
            <p class="content">
                Para completar tu registro y comenzar a disfrutar de todas las funciones, por favor verifica tu dirección de correo electrónico haciendo clic en el botón de abajo:
            </p>

            <div class="button-wrapper">
                <a href="{{ $verificationUrl }}" class="verify-button">
                    Verificar mi correo
                </a>
            </div>

            <div class="info-box">
                <p><strong>⏰ Este enlace expirará en 60 minutos</strong></p>
                <p>Por seguridad, el enlace de verificación solo es válido por una hora.</p>
            </div>

            <p class="content">
                Si no creaste una cuenta con nosotros, puedes ignorar este correo de forma segura. No se realizará ningún cambio en tu información.
            </p>
            
            <p class="content" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:
            </p>
            <p class="content" style="word-break: break-all; color: #667eea; font-size: 14px;">
                {{ $verificationUrl }}
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p style="margin-bottom: 10px;"><strong>Ecommerce API</strong></p>
            <p>© {{ date('Y') }} Todos los derechos reservados.</p>
            <p style="margin-top: 15px;">
                <a href="#">Términos y Condiciones</a> | 
                <a href="#">Política de Privacidad</a>
            </p>
        </div>
    </div>
</body>
</html>
```

**CRÍTICO: Actualiza el método `toMail()` en `VerifyEmailNotification.php` para usar el template HTML:**

```php
public function toMail($notifiable)
{
    $verificationUrl = $this->verificationUrl($notifiable);

    // ⚠️ CAMBIAR ESTE CÓDIGO PARA USAR LA VISTA PERSONALIZADA
    return (new MailMessage)
        ->subject('¡Bienvenido! Verifica tu cuenta')
        ->view('emails.verify-email', [  // ← USA LA VISTA BLADE PERSONALIZADA
            'user' => $notifiable,
            'verificationUrl' => $verificationUrl
        ]);
}
```

**Vista previa de cómo se verá el email:**

ANTES (ACTUAL - PLANO Y ABURRIDO):
```
┌─────────────────────────────┐
│ Ecommerce API               │
│                             │
│ ¡Hola Guillermo!            │
│                             │
│ Por favor haz clic...       │
│                             │
│ [Verificar correo]          │
│                             │
│ Si no creaste una cuenta... │
│                             │
│ Saludos, Ecommerce API      │
└─────────────────────────────┘
```

DESPUÉS (NUEVO - PROFESIONAL Y ATRACTIVO):
```
┌─────────────────────────────────────────┐
│ ╔════════════════════════════════════╗  │
│ ║  🎨 GRADIENTE MORADO BONITO       ║  │
│ ║         📧 (Icono grande)         ║  │
│ ║      Verifica tu cuenta           ║  │
│ ╚════════════════════════════════════╝  │
│                                         │
│  ¡Hola Guillermo! 👋                    │
│                                         │
│  Gracias por registrarte en             │
│  Ecommerce API. Estamos emocionados    │
│                                         │
│  ╔═══════════════════════════╗         │
│  ║  Verificar mi correo      ║ ← BOTÓN │
│  ║  (Gradiente con sombra)   ║   GRANDE│
│  ╚═══════════════════════════╝         │
│                                         │
│  ┌───────────────────────────────┐     │
│  │ ⏰ Expira en 60 minutos       │     │
│  └───────────────────────────────┘     │
│                                         │
│ ╔════════════════════════════════════╗  │
│ ║      FOOTER PROFESIONAL            ║  │
│ ║   © 2025 Ecommerce API             ║  │
│ ╚════════════════════════════════════╝  │
└─────────────────────────────────────────┘
```

---

### 4. Configurar el modelo User para usar la notificación personalizada

**Archivo: `app/Models/User.php`**

```php
<?php

namespace App\Models;

use App\Notifications\VerifyEmailNotification;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, Notifiable;

    // ... resto del código ...

    /**
     * Send the email verification notification.
     *
     * @return void
     */
    public function sendEmailVerificationNotification()
    {
        $this->notify(new VerifyEmailNotification);
    }
}
```

### 4. Modificar el controlador de verificación para retornar token

**Archivo: `app/Http/Controllers/Auth/VerificationController.php` (o AuthController)**

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;

class VerificationController extends Controller
{
    /**
     * Verifica el email del usuario
     *
     * @param Request $request
     * @param string $id
     * @param string $hash
     * @return \Illuminate\Http\JsonResponse
     */
    public function verify(Request $request, $id, $hash)
    {
        // Buscar el usuario
        $user = User::findOrFail($id);

        // Verificar que el hash coincida
        if (! hash_equals($hash, sha1($user->getEmailForVerification()))) {
            return response()->json([
                'success' => false,
                'message' => 'El enlace de verificación es inválido.'
            ], 400);
        }

        // Verificar que la firma de la URL sea válida
        if (! $request->hasValidSignature()) {
            return response()->json([
                'success' => false,
                'message' => 'El enlace de verificación ha expirado.'
            ], 400);
        }

        // Verificar si ya está verificado
        if ($user->hasVerifiedEmail()) {
            // Si ya está verificado pero no tiene sesión, crear token
            if (!Auth::check()) {
                $token = $user->createToken('auth_token')->plainTextToken;
                
                return response()->json([
                    'success' => true,
                    'message' => 'Tu correo ya estaba verificado.',
                    'data' => [
                        'user' => $user,
                        'token' => $token
                    ]
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Tu correo ya estaba verificado.'
            ]);
        }

        // Marcar como verificado
        if ($user->markEmailAsVerified()) {
            event(new Verified($user));
        }

        // Crear token para login automático
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => '¡Email verificado exitosamente!',
            'data' => [
                'user' => $user->load('roles'), // Incluir roles si es necesario
                'token' => $token
            ]
        ]);
    }

    /**
     * Reenvía el email de verificación
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function resend(Request $request)
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'success' => false,
                'message' => 'Tu correo ya está verificado.'
            ], 400);
        }

        $user->sendEmailVerificationNotification();

        return response()->json([
            'success' => true,
            'message' => 'Hemos reenviado el correo de verificación.'
        ]);
    }
}
```

### 5. Configurar las rutas

**Archivo: `routes/api.php`**

```php
use App\Http\Controllers\Auth\VerificationController;

// Rutas de verificación de email (públicas)
Route::prefix('auth')->group(function () {
    // Verificar email con token de la URL
    Route::get('/email/verify/{id}/{hash}', [VerificationController::class, 'verify'])
        ->name('verification.verify');
    
    // Reenviar email de verificación (requiere autenticación)
    Route::post('/email/resend', [VerificationController::class, 'resend'])
        ->middleware('auth:sanctum');
});
```

### 6. Permitir verificación sin autenticación en el middleware

**Archivo: `app/Http/Kernel.php` o configuración de Sanctum**

Asegúrate de que la ruta `/auth/email/verify/{id}/{hash}` NO requiera autenticación, ya que el usuario aún no ha iniciado sesión cuando hace clic en el enlace del correo.

---

## ✅ Flujo esperado después de la configuración:

```
1. Usuario se registra en la PWA
   ↓
2. Backend crea cuenta y envía email con link:
   http://localhost:4200/verify-email?id=1&hash=abc123&expires=1234567890&signature=xyz789
   ↓
3. Usuario abre el email y hace clic en el link
   ↓
4. PWA se abre en /verify-email con los parámetros en la URL
   ↓
5. Frontend llama automáticamente a GET /api/auth/email/verify/1/abc123?expires=...&signature=...
   ↓
6. Backend verifica el email y retorna:
   {
     "success": true,
     "message": "¡Email verificado exitosamente!",
     "data": {
       "user": { ... },
       "token": "1|nuevo_token_para_login_automatico"
     }
   }
   ↓
7. Frontend guarda el token automáticamente (login automático)
   ↓
8. Usuario es redirigido a /tabs/home ✅ YA LOGUEADO
```

---

## 🧪 Testing:

### 1. Verificar que el email se envía correctamente:
```bash
# En desarrollo, revisar los logs o usar Mailtrap/MailHog
tail -f storage/logs/laravel.log
```

### 2. Verificar la URL del link en el email:
```
Debe ser: http://localhost:4200/verify-email?id=X&hash=Y&expires=Z&signature=W
NO debe ser: http://localhost:8000/api/auth/email/verify/...
```

### 3. Probar la verificación manualmente:
```bash
# Copiar la URL del email y abrirla en el navegador
# Debería:
# 1. Abrir la PWA en /verify-email
# 2. Mostrar "Verificando..."
# 3. Mostrar "¡Email verificado exitosamente!"
# 4. Redirigir a /tabs/home automáticamente
# 5. Estar logueado (ver el perfil del usuario)
```

---

## 📊 Resumen de cambios:

| Componente | Archivo | Cambio |
|------------|---------|--------|
| Notificación | `VerifyEmailNotification.php` | Link apunta a frontend con query params |
| Modelo | `User.php` | Usa notificación personalizada |
| Controlador | `VerificationController.php` | Retorna token + usuario al verificar |
| Rutas | `routes/api.php` | Ruta pública para verificación |
| Config | `.env` | Variable `FRONTEND_URL` |

---

## 🎉 Resultado final:

- ✅ Email con link correcto a la PWA
- ✅ Verificación automática al abrir el link
- ✅ Login automático después de verificar
- ✅ Usuario redirigido a home sin necesidad de hacer login manual
- ✅ Sesión mantenida por 8 horas (según configuración del token)
