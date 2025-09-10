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

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
  },
  {
    path: 'checkout',
    component: CheckoutPage,
    canActivate: [AuthGuard]
  },
  {
    path: 'order-confirmation',
    component: OrderConfirmationPage,
    canActivate: [AuthGuard]
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
        canActivate: [AuthGuard]
      },
      {
        path: 'notifications',
        component: NotificationsPage
      },
      {
        path: 'profile',
        component: ProfilePage
      },
      {
        path: 'product/:id',
        component: ProductDetailPage
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
        canActivate: [AuthGuard]
      },
      {
        path: 'address/:id',
        component: AddressPage,
        canActivate: [AuthGuard]
      }
    ]
  }
];
// ...existing code...
