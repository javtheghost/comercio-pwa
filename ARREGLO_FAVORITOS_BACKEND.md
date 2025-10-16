# 🚨 ARREGLO URGENTE: Backend de Favoritos

## PROBLEMA IDENTIFICADO

El endpoint `/api/favorites` **NO está incluyendo la relación con los productos**, causando que el frontend reciba favoritos sin información del producto.

---

## SÍNTOMAS EN EL FRONTEND

1. ✅ Los favoritos se obtienen correctamente (6 favoritos)
2. ❌ Los productos aparecen como "Producto" sin imagen ni precio
3. ❌ Al hacer clic en un favorito → Error: `GET /api/products/NaN`
4. ❌ Las imágenes no se muestran (404)

---

## CAUSA RAÍZ

El backend está devolviendo:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "product_id": 5,
      "created_at": "2025-01-01 12:00:00",
      "updated_at": "2025-01-01 12:00:00"
      // ❌ FALTA: "product": {...}
    }
  ]
}
```

Pero el frontend espera:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "product_id": 5,
      "created_at": "2025-01-01 12:00:00",
      "updated_at": "2025-01-01 12:00:00",
      "product": {
        "id": 5,
        "name": "Chaqueta Bomber Clásica",
        "slug": "chaqueta-bomber-clasica",
        "price": 899.00,
        "image_url": "https://ejemplo.com/chaqueta.jpg"
      }
    }
  ]
}
```

---

## SOLUCIÓN REQUERIDA EN EL BACKEND

### 1️⃣ **Actualizar FavoriteController.php**

#### Método `index()` - Obtener favoritos

```php
<?php

public function index(Request $request)
{
    try {
        $favorites = $request->user()
            ->favorites()
            ->with('product:id,name,slug,price,image_url') // ✅ AGREGAR ESTA LÍNEA
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $favorites
        ]);
    } catch (\Exception $e) {
        \Log::error('Error obteniendo favoritos: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'Error al obtener favoritos',
            'errors' => $e->getMessage()
        ], 500);
    }
}
```

---

#### Método `store()` - Agregar favorito

```php
<?php

public function store(Request $request)
{
    $request->validate([
        'product_id' => 'required|integer|exists:products,id'
    ]);

    try {
        // Verificar si ya existe
        $existing = Favorite::where('user_id', $request->user()->id)
            ->where('product_id', $request->product_id)
            ->first();

        if ($existing) {
            return response()->json([
                'success' => true,
                'message' => 'Producto ya está en favoritos',
                'data' => $existing->load('product:id,name,slug,price,image_url') // ✅ AGREGAR
            ]);
        }

        $favorite = Favorite::create([
            'user_id' => $request->user()->id,
            'product_id' => $request->product_id
        ]);

        $favorite->load('product:id,name,slug,price,image_url'); // ✅ AGREGAR

        return response()->json([
            'success' => true,
            'message' => 'Producto agregado a favoritos',
            'data' => $favorite
        ], 201);
    } catch (\Exception $e) {
        \Log::error('Error agregando favorito: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'Error al agregar favorito',
            'errors' => $e->getMessage()
        ], 500);
    }
}
```

---

#### Método `sync()` - Sincronizar favoritos

```php
<?php

public function sync(Request $request)
{
    $request->validate([
        'product_ids' => 'required|array',
        'product_ids.*' => 'integer|exists:products,id'
    ]);

    try {
        $user = $request->user();
        $productIds = $request->product_ids;

        // Obtener favoritos actuales
        $currentFavorites = Favorite::where('user_id', $user->id)
            ->pluck('product_id')
            ->toArray();

        // Calcular diferencias
        $toAdd = array_diff($productIds, $currentFavorites);
        $toRemove = array_diff($currentFavorites, $productIds);

        // Eliminar favoritos que ya no están en la lista
        if (!empty($toRemove)) {
            Favorite::where('user_id', $user->id)
                ->whereIn('product_id', $toRemove)
                ->delete();
        }

        // Agregar nuevos favoritos
        $added = 0;
        foreach ($toAdd as $productId) {
            Favorite::create([
                'user_id' => $user->id,
                'product_id' => $productId
            ]);
            $added++;
        }

        // Obtener favoritos actualizados CON la relación product
        $favorites = Favorite::where('user_id', $user->id)
            ->with('product:id,name,slug,price,image_url') // ✅ AGREGAR
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Favoritos sincronizados exitosamente',
            'data' => [
                'added' => $added,
                'removed' => count($toRemove),
                'total' => count($favorites),
                'favorites' => $favorites // ✅ INCLUIR favoritos completos
            ]
        ]);
    } catch (\Exception $e) {
        \Log::error('Error sincronizando favoritos: ' . $e->getMessage());
        
        return response()->json([
            'success' => false,
            'message' => 'Error al sincronizar favoritos',
            'errors' => $e->getMessage()
        ], 500);
    }
}
```

---

### 2️⃣ **Verificar Modelos**

#### Modelo `Favorite.php`

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Favorite extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'product_id'
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * ✅ ASEGURAR QUE ESTA RELACIÓN EXISTE
     */
    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * ✅ ASEGURAR QUE ESTA RELACIÓN EXISTE
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
```

---

#### Modelo `User.php`

```php
<?php

/**
 * ✅ AGREGAR ESTA RELACIÓN SI NO EXISTE
 */
public function favorites()
{
    return $this->hasMany(Favorite::class);
}
```

---

### 3️⃣ **Verificar Migración**

```php
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

            // Índice único para evitar duplicados
            $table->unique(['user_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('favorites');
    }
};
```

---

## VERIFICACIÓN

Después de aplicar los cambios, probar con:

```bash
# 1. Obtener favoritos
curl -X GET http://localhost:8000/api/favorites \
  -H "Authorization: Bearer {token}" \
  -H "Accept: application/json"

# Respuesta esperada:
# {
#   "success": true,
#   "data": [
#     {
#       "id": 1,
#       "user_id": 1,
#       "product_id": 5,
#       "created_at": "2025-01-01 12:00:00",
#       "updated_at": "2025-01-01 12:00:00",
#       "product": {
#         "id": 5,
#         "name": "Chaqueta Bomber",
#         "slug": "chaqueta-bomber",
#         "price": 899.00,
#         "image_url": "https://..."
#       }
#     }
#   ]
# }
```

---

## CHECKLIST

- [ ] Actualizar `FavoriteController@index` con `->with('product:...')`
- [ ] Actualizar `FavoriteController@store` con `->load('product:...')`
- [ ] Actualizar `FavoriteController@sync` con `->with('product:...')`
- [ ] Verificar relación `product()` en modelo `Favorite`
- [ ] Verificar relación `favorites()` en modelo `User`
- [ ] Verificar migración de tabla `favorites`
- [ ] Probar endpoint con curl o Postman
- [ ] Ver logs: `tail -f storage/logs/laravel.log`

---

## NOTAS IMPORTANTES

1. El `with('product:id,name,slug,price,image_url')` carga la relación de forma optimizada (Eager Loading)
2. El `:id,name,slug,price,image_url` limita las columnas que se cargan (mejor rendimiento)
3. Siempre incluir `id` en las columnas cuando usas select específico
4. El frontend ya está preparado para manejar la respuesta correctamente

---

## RESULTADO ESPERADO

Después de estos cambios:
- ✅ Las imágenes de productos aparecerán en favoritos
- ✅ Los nombres y precios se mostrarán correctamente
- ✅ Al hacer clic en un favorito, navegará correctamente al producto
- ✅ No más errores `GET /api/products/NaN`
