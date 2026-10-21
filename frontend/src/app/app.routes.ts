import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'acceso',
    title: 'Iniciar sesión',
    loadComponent: () => import('./features/auth/auth-page.component').then((module) => module.AuthPageComponent),
  },
  {
    path: 'como-funciona',
    title: 'Cómo funciona',
    loadComponent: () => import('./features/marketplace/how-it-works.component').then((module) => module.HowItWorksComponent),
  },
  {
    path: 'explorar',
    title: 'Explorar publicaciones',
    loadComponent: () => import('./features/marketplace/explore-listings.component').then((module) => module.ExploreListingsComponent),
  },
  {
    path: 'me-gusta',
    title: 'Mis favoritos',
    loadComponent: () => import('./features/marketplace/liked-listings.component').then((module) => module.LikedListingsComponent),
  },
  {
    path: 'publicar',
    title: 'Publicar',
    loadComponent: () => import('./features/marketplace/create-listing-page.component').then((module) => module.CreateListingPageComponent),
  },
  {
    path: 'mensajes',
    title: 'Mensajes',
    loadComponent: () => import('./features/account/messages-page.component').then((module) => module.MessagesPageComponent),
  },
  {
    path: 'admin',
    title: 'Administración',
    loadComponent: () => import('./features/admin/admin.component').then((module) => module.AdminComponent),
  },
  {
    path: 'admin/:section',
    title: 'Panel de administración',
    loadComponent: () => import('./features/admin/admin.component').then((module) => module.AdminComponent),
  },
  {
    path: '',
    title: 'MonkeyTrueque',
    loadComponent: () => import('./features/marketplace/marketplace-home.component').then((module) => module.MarketplaceHomeComponent),
  },
  {
    path: 'perfil/:id',
    title: 'Perfil',
    loadComponent: () => import('./features/account/public-profile.component').then((module) => module.PublicProfileComponent),
  },
  {
    path: 'cuenta/restricciones',
    title: 'Medidas de mi cuenta',
    loadComponent: () => import('./features/account/account-restrictions.component').then((module) => module.AccountRestrictionsComponent),
  },
  {
    path: 'cuenta/configuracion',
    title: 'Configuración de cuenta',
    loadComponent: () => import('./features/account/account-settings.component').then((module) => module.AccountSettingsComponent),
  },
  {
    path: 'cuenta',
    title: 'Mi cuenta',
    loadComponent: () => import('./features/account/account.component').then((module) => module.AccountComponent),
  },
  {
    path: 'producto/:id',
    title: 'Publicación | MonkeyTrueque',
    loadComponent: () => import('./features/marketplace/product-detail.component').then((module) => module.ProductDetailComponent),
  },
  { path: '**', redirectTo: '' },
];
