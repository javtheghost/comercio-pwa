import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { ProfilePage } from './pages/profile/profile.page';
import { OrdersPage } from './pages/orders/orders.page';
import { CartPage } from './pages/cart/cart.page';
import { ProductDetailPage } from './pages/product-detail/product-detail.page';
import { LoginPage } from './pages/login/login.page';
import { RegisterPage } from './pages/register/register.page';
import { CheckoutPage } from './pages/checkout/checkout.page';
import { OrderConfirmationPage } from './pages/order-confirmation/order-confirmation.page';
import { AddressPage } from './pages/address/address.page';
import { NotificationsPage } from './pages/notifications/notifications.page';
import { AuthGuard } from './guards/auth.guard';
import { VerifiedGuard } from './guards/verified.guard';
import { VerifyEmailPage } from './pages/verify-email/verify-email.page';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
  },
  {
    path: 'checkout',
    component: CheckoutPage,
    canActivate: [AuthGuard, VerifiedGuard]
  },
  {
    path: 'order-confirmation',
    component: OrderConfirmationPage,
    canActivate: [AuthGuard, VerifiedGuard]
  },
  {
    path: 'tabs',
    loadComponent: () => import('./tabs/tabs.page').then(m => m.TabsPage),
    children: [
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full'
      },
      {
        path: 'home',
        component: HomePage
      },
      {
        path: 'search',
        loadComponent: () => import('./pages/search/search.page').then(m => m.SearchPage)
      },
      {
        path: 'cart',
        component: CartPage
      },
      {
        path: 'orders',
        component: OrdersPage,
        canActivate: [AuthGuard, VerifiedGuard]
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('./pages/order-detail/order-detail.page').then(m => m.OrderDetailPage),
        canActivate: [AuthGuard, VerifiedGuard]
      },
      {
        path: 'notifications',
        component: NotificationsPage
      },
      {
        path: 'profile',
        component: ProfilePage,
        canActivate: [AuthGuard, VerifiedGuard]
      },
      {
        path: 'verify-email',
        component: VerifyEmailPage
      },
      {
        path: 'product/:id',
        component: ProductDetailPage
      },
      {
        path: 'favorites',
        loadComponent: () => import('./pages/favorites/favorites.page').then(m => m.FavoritesPage)
      },
      {
        path: 'login',
        component: LoginPage
      },
      {
        path: 'register',
        component: RegisterPage
      },
      {
        path: 'address',
        component: AddressPage,
        canActivate: [AuthGuard, VerifiedGuard]
      },
      {
        path: 'address/:id',
        component: AddressPage,
        canActivate: [AuthGuard, VerifiedGuard]
      }
    ]
  }
];
// ...existing code...
