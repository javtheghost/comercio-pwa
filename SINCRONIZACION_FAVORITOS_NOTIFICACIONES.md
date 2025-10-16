# 🔄 Sincronización de Favoritos y Notificaciones entre Dispositivos

## 📊 Diagnóstico del Problema Actual

### ❌ Estado Actual (Solo Local)

**Favoritos (`favorites.service.ts`):**
- Almacenamiento: `localStorage` con clave `favorites_{userId}`
- Problema: Los datos NO se sincronizan entre navegadores/dispositivos
- Si cambias de navegador → Pierdes tus favoritos ❌

**Notificaciones (`notification.service.ts`):**
- Almacenamiento: `localStorage` con clave `notifications_{userId}`
- Problema: Las notificaciones de órdenes NO se sincronizan entre dispositivos
- Si cambias de navegador → Pierdes tu historial de notificaciones ❌

### ✅ Solución: Backend + Sincronización

Para que funcione en todos los navegadores/dispositivos, necesitamos:

1. **Backend**: Crear endpoints para guardar favoritos y notificaciones en la base de datos
2. **Frontend**: Modificar los servicios para sincronizar con el backend
3. **Estrategia Híbrida**: Mantener localStorage para velocidad + sincronizar con backend para persistencia

---

## 🎯 Implementación Paso a Paso

### PARTE 1: Backend - Favoritos

#### Paso 1.1: Crear migración para tabla `favorites`

```php
// database/migrations/2025_01_XX_create_favorites_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('favorites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->timestamps();
            
            // Un usuario no puede tener el mismo producto duplicado en favoritos
            $table->unique(['user_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('favorites');
    }
};
```

Ejecutar: `php artisan migrate`

#### Paso 1.2: Crear modelo `Favorite`

```php
// app/Models/Favorite.php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Favorite extends Model
{
    use HasFactory;

    protected $fillable = ['user_id', 'product_id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }
}
```

#### Paso 1.3: Crear controlador `FavoriteController`

```php
// app/Http/Controllers/FavoriteController.php
<?php

namespace App\Http\Controllers;

use App\Models\Favorite;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FavoriteController extends Controller
{
    /**
     * Obtener todos los favoritos del usuario autenticado
     * GET /api/favorites
     */
    public function index()
    {
        $favorites = Favorite::where('user_id', Auth::id())
            ->with('product:id,name,price,primary_image')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($favorite) {
                return [
                    'id' => $favorite->product_id,
                    'name' => $favorite->product->name ?? null,
                    'price' => $favorite->product->price ?? null,
                    'image' => $favorite->product->primary_image ?? null,
                    'updatedAt' => strtotime($favorite->updated_at) * 1000, // timestamp en ms
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $favorites
        ]);
    }

    /**
     * Agregar producto a favoritos
     * POST /api/favorites
     * Body: { "product_id": 123 }
     */
    public function store(Request $request)
    {
        $request->validate([
            'product_id' => 'required|integer|exists:products,id'
        ]);

        $favorite = Favorite::firstOrCreate([
            'user_id' => Auth::id(),
            'product_id' => $request->product_id
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Producto agregado a favoritos',
            'data' => [
                'id' => $favorite->product_id,
                'updatedAt' => strtotime($favorite->updated_at) * 1000
            ]
        ]);
    }

    /**
     * Eliminar producto de favoritos
     * DELETE /api/favorites/{productId}
     */
    public function destroy($productId)
    {
        $deleted = Favorite::where('user_id', Auth::id())
            ->where('product_id', $productId)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => $deleted ? 'Producto eliminado de favoritos' : 'Producto no estaba en favoritos'
        ]);
    }

    /**
     * Sincronizar favoritos (recibir array de IDs y actualizar en backend)
     * POST /api/favorites/sync
     * Body: { "product_ids": [1, 2, 3] }
     */
    public function sync(Request $request)
    {
        $request->validate([
            'product_ids' => 'required|array',
            'product_ids.*' => 'integer|exists:products,id'
        ]);

        $userId = Auth::id();
        $productIds = $request->product_ids;

        // Eliminar favoritos que ya no están en la lista
        Favorite::where('user_id', $userId)
            ->whereNotIn('product_id', $productIds)
            ->delete();

        // Agregar nuevos favoritos
        foreach ($productIds as $productId) {
            Favorite::firstOrCreate([
                'user_id' => $userId,
                'product_id' => $productId
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Favoritos sincronizados correctamente'
        ]);
    }
}
```

#### Paso 1.4: Agregar rutas para favoritos

```php
// routes/api.php

// Agregar dentro del grupo de rutas autenticadas:
Route::middleware(['auth:sanctum'])->group(function () {
    // ... otras rutas existentes ...
    
    // Favoritos
    Route::get('/favorites', [FavoriteController::class, 'index']);
    Route::post('/favorites', [FavoriteController::class, 'store']);
    Route::delete('/favorites/{productId}', [FavoriteController::class, 'destroy']);
    Route::post('/favorites/sync', [FavoriteController::class, 'sync']);
});
```

---

### PARTE 2: Backend - Notificaciones

#### Paso 2.1: Crear migración para tabla `user_notifications`

```php
// database/migrations/2025_01_XX_create_user_notifications_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('type'); // 'order_created', 'order_status', 'promotion', etc.
            $table->string('title');
            $table->text('message');
            $table->json('data')->nullable(); // JSON con datos adicionales (order_id, etc.)
            $table->boolean('read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            
            $table->index(['user_id', 'read', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notifications');
    }
};
```

Ejecutar: `php artisan migrate`

#### Paso 2.2: Crear modelo `UserNotification`

```php
// app/Models/UserNotification.php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserNotification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'type',
        'title',
        'message',
        'data',
        'read',
        'read_at'
    ];

    protected $casts = [
        'data' => 'array',
        'read' => 'boolean',
        'read_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
```

#### Paso 2.3: Crear controlador `UserNotificationController`

```php
// app/Http/Controllers/UserNotificationController.php
<?php

namespace App\Http\Controllers;

use App\Models\UserNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserNotificationController extends Controller
{
    /**
     * Obtener todas las notificaciones del usuario
     * GET /api/user-notifications
     */
    public function index(Request $request)
    {
        $limit = $request->query('limit', 50);
        $onlyUnread = $request->query('unread', false);

        $query = UserNotification::where('user_id', Auth::id())
            ->orderBy('created_at', 'desc');

        if ($onlyUnread) {
            $query->where('read', false);
        }

        $notifications = $query->limit($limit)->get()->map(function ($notif) {
            return [
                'id' => $notif->id,
                'type' => $notif->type,
                'title' => $notif->title,
                'message' => $notif->message,
                'data' => $notif->data,
                'read' => $notif->read,
                'timestamp' => $notif->created_at->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $notifications
        ]);
    }

    /**
     * Marcar notificación como leída
     * PUT /api/user-notifications/{id}/read
     */
    public function markAsRead($id)
    {
        $notification = UserNotification::where('user_id', Auth::id())
            ->where('id', $id)
            ->first();

        if (!$notification) {
            return response()->json([
                'success' => false,
                'message' => 'Notificación no encontrada'
            ], 404);
        }

        $notification->update([
            'read' => true,
            'read_at' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Notificación marcada como leída'
        ]);
    }

    /**
     * Marcar todas las notificaciones como leídas
     * PUT /api/user-notifications/read-all
     */
    public function markAllAsRead()
    {
        UserNotification::where('user_id', Auth::id())
            ->where('read', false)
            ->update([
                'read' => true,
                'read_at' => now()
            ]);

        return response()->json([
            'success' => true,
            'message' => 'Todas las notificaciones marcadas como leídas'
        ]);
    }

    /**
     * Eliminar notificación
     * DELETE /api/user-notifications/{id}
     */
    public function destroy($id)
    {
        $deleted = UserNotification::where('user_id', Auth::id())
            ->where('id', $id)
            ->delete();

        return response()->json([
            'success' => $deleted,
            'message' => $deleted ? 'Notificación eliminada' : 'Notificación no encontrada'
        ]);
    }

    /**
     * Eliminar todas las notificaciones
     * DELETE /api/user-notifications
     */
    public function destroyAll()
    {
        $deleted = UserNotification::where('user_id', Auth::id())->delete();

        return response()->json([
            'success' => true,
            'message' => "Se eliminaron {$deleted} notificaciones"
        ]);
    }
}
```

#### Paso 2.4: Modificar `OrderController` para crear notificaciones

```php
// app/Http/Controllers/OrderController.php

// Agregar al método store() después de crear la orden:

use App\Models\UserNotification;

public function store(Request $request)
{
    // ... código existente para crear la orden ...
    
    // Crear notificación de nueva orden
    UserNotification::create([
        'user_id' => $order->user_id,
        'type' => 'order_created',
        'title' => '¡Pedido realizado!',
        'message' => "Tu pedido #{$order->id} ha sido creado exitosamente por $" . number_format($order->total, 2),
        'data' => [
            'order_id' => $order->id,
            'total' => $order->total,
            'status' => $order->status
        ]
    ]);
    
    // ... resto del código ...
}

// Agregar método para actualizar estado de orden
public function updateStatus(Request $request, $id)
{
    $request->validate([
        'status' => 'required|string|in:pending,processing,shipped,delivered,cancelled'
    ]);
    
    $order = Order::findOrFail($id);
    $oldStatus = $order->status;
    $order->status = $request->status;
    $order->save();
    
    // Crear notificación de cambio de estado
    $statusMessages = [
        'processing' => 'Tu pedido está siendo procesado',
        'shipped' => 'Tu pedido ha sido enviado',
        'delivered' => 'Tu pedido ha sido entregado',
        'cancelled' => 'Tu pedido ha sido cancelado'
    ];
    
    if (isset($statusMessages[$request->status])) {
        UserNotification::create([
            'user_id' => $order->user_id,
            'type' => 'order_status',
            'title' => 'Actualización de pedido',
            'message' => $statusMessages[$request->status] . " (Pedido #{$order->id})",
            'data' => [
                'order_id' => $order->id,
                'old_status' => $oldStatus,
                'new_status' => $request->status
            ]
        ]);
    }
    
    return response()->json([
        'success' => true,
        'message' => 'Estado de la orden actualizado',
        'data' => $order
    ]);
}
```

#### Paso 2.5: Agregar rutas para notificaciones

```php
// routes/api.php

// Agregar dentro del grupo de rutas autenticadas:
Route::middleware(['auth:sanctum'])->group(function () {
    // ... otras rutas existentes ...
    
    // Notificaciones de usuario
    Route::get('/user-notifications', [UserNotificationController::class, 'index']);
    Route::put('/user-notifications/{id}/read', [UserNotificationController::class, 'markAsRead']);
    Route::put('/user-notifications/read-all', [UserNotificationController::class, 'markAllAsRead']);
    Route::delete('/user-notifications/{id}', [UserNotificationController::class, 'destroy']);
    Route::delete('/user-notifications', [UserNotificationController::class, 'destroyAll']);
});
```

---

## 🔄 PARTE 3: Frontend - Actualizar Servicios

### Paso 3.1: Crear `favorites-api.service.ts`

```typescript
// src/app/services/favorites-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FavoriteApiResponse {
  success: boolean;
  data?: any;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class FavoritesApiService {
  private readonly API_URL = `${environment.apiUrl}/favorites`;

  constructor(private http: HttpClient) {}

  // Obtener todos los favoritos desde el backend
  getAll(): Observable<FavoriteApiResponse> {
    return this.http.get<FavoriteApiResponse>(this.API_URL);
  }

  // Agregar a favoritos
  add(productId: number): Observable<FavoriteApiResponse> {
    return this.http.post<FavoriteApiResponse>(this.API_URL, { product_id: productId });
  }

  // Eliminar de favoritos
  remove(productId: number): Observable<FavoriteApiResponse> {
    return this.http.delete<FavoriteApiResponse>(`${this.API_URL}/${productId}`);
  }

  // Sincronizar favoritos (enviar array completo de IDs)
  sync(productIds: number[]): Observable<FavoriteApiResponse> {
    return this.http.post<FavoriteApiResponse>(`${this.API_URL}/sync`, { product_ids: productIds });
  }
}
```

---

### Paso 3.2: Actualizar `favorites.service.ts` para sincronizar

```typescript
// src/app/services/favorites.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { FavoritesApiService } from './favorites-api.service';

export interface FavoriteItem {
  id: number;
  name?: string;
  price?: number;
  image?: string;
  updatedAt: number;
}

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private items$ = new BehaviorSubject<FavoriteItem[]>([]);
  private userId: number | 'guest' = 'guest';
  private isSyncing = false;

  constructor(
    private auth: AuthService,
    private favoritesApi: FavoritesApiService
  ) {
    // Load on init and react to auth changes
    try {
      const current = this.auth.getCurrentUserValue();
      this.userId = current?.id ?? 'guest';
      this.loadFromStorage();
      // Si está autenticado, sincronizar con backend
      if (this.userId !== 'guest') {
        this.syncFromBackend();
      }
    } catch { this.loadFromStorage(); }

    this.auth.authState$.subscribe(state => {
      const newId = state.isAuthenticated && state.user && typeof (state.user as any).id === 'number'
        ? (state.user as any).id as number
        : 'guest';
      if (newId !== this.userId) {
        this.userId = newId;
        this.loadFromStorage();
        // Sincronizar con backend cuando el usuario inicia sesión
        if (newId !== 'guest') {
          this.syncFromBackend();
        }
      }
    });
  }

  private storageKey(): string {
    return `favorites_${this.userId}`;
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.storageKey());
      const parsed: FavoriteItem[] = raw ? JSON.parse(raw) : [];
      this.items$.next(Array.isArray(parsed) ? parsed : []);
    } catch {
      this.items$.next([]);
    }
  }

  private saveToStorage(): void {
    try { localStorage.setItem(this.storageKey(), JSON.stringify(this.items$.value)); } catch {}
  }

  /**
   * Sincronizar favoritos desde el backend
   */
  private syncFromBackend(): void {
    if (this.userId === 'guest' || this.isSyncing) return;
    
    this.isSyncing = true;
    console.log('🔄 Sincronizando favoritos desde backend...');

    this.favoritesApi.getAll().subscribe({
      next: (response) => {
        if (response.success && Array.isArray(response.data)) {
          const backendFavorites = response.data as FavoriteItem[];
          console.log(`✅ ${backendFavorites.length} favoritos recibidos del backend`);
          
          // Actualizar localStorage y BehaviorSubject
          this.items$.next(backendFavorites);
          this.saveToStorage();
          
          // Notificar cambios
          try { window.dispatchEvent(new CustomEvent('favorites:updated')); } catch {}
        }
        this.isSyncing = false;
      },
      error: (error) => {
        console.warn('⚠️ No se pudieron sincronizar favoritos desde backend:', error);
        this.isSyncing = false;
        // Continuar con los favoritos locales
      }
    });
  }

  /**
   * Sincronizar favoritos hacia el backend
   */
  private syncToBackend(): void {
    if (this.userId === 'guest') return;

    const productIds = this.items$.value.map(item => item.id);
    
    this.favoritesApi.sync(productIds).subscribe({
      next: () => console.log('✅ Favoritos sincronizados con backend'),
      error: (error) => console.warn('⚠️ Error sincronizando favoritos:', error)
    });
  }

  getAll$(): Observable<FavoriteItem[]> { return this.items$.asObservable(); }
  getAll(): FavoriteItem[] { return this.items$.value; }
  count$(): Observable<number> { return new Observable(obs => {
    const sub = this.items$.subscribe(list => { obs.next(list.length); });
    return () => sub.unsubscribe();
  }); }

  isFavorite(productId: number): boolean {
    return this.items$.value.some(i => i.id === productId);
  }

  toggle(product: { id: number; name?: string; price?: number; image?: string }): void {
    const arr = this.items$.value.slice();
    const idx = arr.findIndex(i => i.id === product.id);
    
    if (idx >= 0) {
      // Eliminar
      arr.splice(idx, 1);
      
      // Sincronizar con backend
      if (this.userId !== 'guest') {
        this.favoritesApi.remove(product.id).subscribe({
          next: () => console.log(`✅ Favorito ${product.id} eliminado del backend`),
          error: (err) => console.warn('⚠️ Error eliminando favorito del backend:', err)
        });
      }
    } else {
      // Agregar
      arr.unshift({ id: product.id, name: product.name, price: product.price, image: product.image, updatedAt: Date.now() });
      
      // Sincronizar con backend
      if (this.userId !== 'guest') {
        this.favoritesApi.add(product.id).subscribe({
          next: () => console.log(`✅ Favorito ${product.id} agregado al backend`),
          error: (err) => console.warn('⚠️ Error agregando favorito al backend:', err)
        });
      }
    }
    
    this.items$.next(arr);
    this.saveToStorage();
    try { window.dispatchEvent(new CustomEvent('favorites:updated')); } catch {}
  }

  /**
   * Forzar sincronización completa (útil para debugging o refresh manual)
   */
  forceSync(): void {
    if (this.userId !== 'guest') {
      this.syncFromBackend();
    }
  }
}
```

---

## ✅ Resultado Final

Con esta implementación:

### Favoritos ❤️
- ✅ Se guardan en el **backend** (base de datos)
- ✅ Se sincronizan **automáticamente** al iniciar sesión
- ✅ Funcionan en **cualquier navegador/dispositivo**
- ✅ Mantienen **localStorage** para velocidad
- ✅ Si falla el backend, siguen funcionando localmente

### Notificaciones 🔔
- ✅ Se crean en el **backend** cuando hay nuevas órdenes
- ✅ Se obtienen desde el **backend** al iniciar sesión
- ✅ Persisten entre **dispositivos y navegadores**
- ✅ Se pueden marcar como leídas/eliminar desde cualquier dispositivo
- ✅ Notificaciones push siguen funcionando igual

---

## 🚀 Próximos Pasos

1. **Backend**: Implementar todos los cambios de la PARTE 1 y PARTE 2
2. **Frontend**: Crear `favorites-api.service.ts` y actualizar `favorites.service.ts`
3. **Testing**: Probar agregando favoritos en un navegador y verificando que aparezcan en otro
4. **Notificaciones**: Implementar servicio similar para sincronizar notificaciones desde backend

¿Quieres que implemente la parte del frontend ahora? 🤔
