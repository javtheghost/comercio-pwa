import { Routes } from '@angular/router';
import { HomePage } from './pages/home/home.page';
import { ProfilePage } from './pages/profile/profile.page';
import { OrdersPage } from './pages/orders/orders.page';
import { CartPage } from './pages/cart/cart.page';
import { ProductDetailPage } from './pages/product-detail/product-detail.page';
import { LoginPage } from './pages/login/login.page';
import { RegisterPage } from './pages/register/register.page';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full'
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
        component: CartPage,
        canActivate: [AuthGuard]
      },
      {
        path: 'orders',
        component: OrdersPage,
        canActivate: [AuthGuard]
      },
      {
        path: 'profile',
        component: ProfilePage
      }
    ]
  },
  {
    path: 'product/:id',
    component: ProductDetailPage
  }
];
// ...existing code...
