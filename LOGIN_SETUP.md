# Login System Setup

This document explains the login system implementation in the PWA frontend.

## Features Implemented

### 1. Authentication Interfaces
- `LoginRequest` - Login form data structure
- `LoginResponse` - API response structure
- `User` - User data structure
- `AuthState` - Authentication state management

### 2. Authentication Service
- Login with email/password
- Token management (localStorage)
- Authentication state management
- Logout functionality
- Token refresh capability

### 3. Login Page
- Modern, responsive design matching the provided image
- Form validation with real-time feedback
- Loading states and error handling
- Social login placeholders (Google, Facebook)
- Forgot password and sign up links

### 4. Register Page
- Clean, modern design consistent with login page
- Complete registration form with validation
- Password confirmation matching
- Terms and conditions checkbox
- Social registration placeholders (Google, Facebook)
- Link to login page for existing users

### 5. Route Protection
- AuthGuard to protect purchase-related routes only
- Public routes: `/tabs/home`, `/tabs/profile`, `/product/:id`
- Protected routes: `/tabs/cart`, `/tabs/orders` (require authentication for purchases)

### 6. HTTP Interceptor
- Automatic token attachment to API requests
- Bearer token authentication

## API Integration

The authentication system connects to your Laravel API endpoints:
```
POST /api/auth/login
POST /api/auth/register
```

### Login Request Format
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Register Request Format
```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "password123",
  "password_confirmation": "password123"
}
```

### Response Format
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "email_verified_at": "2024-01-01T00:00:00.000000Z",
      "created_at": "2024-01-01T00:00:00.000000Z",
      "updated_at": "2024-01-01T00:00:00.000000Z"
    },
    "token": "1|abc123...",
    "token_type": "Bearer"
  }
}
```

## Usage

### 1. Public Access
- Users can browse products and view the home page without authentication
- Profile page shows login/register options for unauthenticated users
- Authentication is only required for cart and orders

### 2. Authentication Access
- Click "Iniciar Sesión" or "Crear Cuenta" from the profile page
- Or navigate directly to `/login` or `/register`

### 3. Protected Routes
Only purchase-related routes require authentication:
- `/tabs/cart` - Shopping cart (requires login)
- `/tabs/orders` - Order history (requires login)

### 4. Authentication State
The authentication state is managed globally and persists across browser sessions using localStorage.

## File Structure

```
src/app/
├── interfaces/
│   └── auth.interfaces.ts          # Authentication type definitions
├── services/
│   ├── auth.service.ts             # Authentication service
│   └── api.service.ts              # API service (updated with auth methods)
├── guards/
│   └── auth.guard.ts               # Route protection guard
├── interceptors/
│   └── auth.interceptor.ts         # HTTP interceptor for token attachment
├── pages/
│   ├── login/
│   │   ├── login.page.ts           # Login page component
│   │   └── login.page.scss         # Login page styles
│   ├── register/
│   │   ├── register.page.ts        # Register page component
│   │   └── register.page.scss      # Register page styles
│   └── profile/
│       └── profile.page.ts         # Profile page (updated with logout)
└── app.routes.ts                   # Routes configuration (updated)
```

## Testing

1. Start your Laravel API server
2. Start the PWA development server: `ng serve`
3. Navigate to the app - you should see the home page (no login required)
4. Go to the profile tab to see login/register options
5. Test registration by clicking "Crear Cuenta" or navigating to `/register`
6. Test login by clicking "Iniciar Sesión" or navigating to `/login`
7. After successful login/registration, you should be redirected to `/tabs/profile`
8. Test logout from the profile page
9. Try accessing cart/orders without login (should redirect to login)

## Configuration

Make sure your API base URL is correctly configured in `src/app/services/api.service.ts`:
```typescript
private baseUrl = 'http://localhost:8000/api'; // Update this to match your API
```

## Next Steps

1. Implement social login (Google, Facebook)
2. Add forgot password functionality
3. Implement email verification
4. Add password change functionality
5. Add user profile editing
6. Add form validation improvements
7. Add loading states for better UX
