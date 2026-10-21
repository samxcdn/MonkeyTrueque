import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthService } from '../../core/auth/auth.service';
import { UnreadMessagesService } from '../../core/data/unread-messages.service';
import type { AppState, DistrictSelection } from '../../core/models/marketplace.models';
import { BrandMarkComponent } from './brand-mark.component';
import * as MarketplaceActions from './state/marketplace.actions';
import { selectDistricts, selectFilters, selectSelectedDistrictId } from './state/marketplace.selectors';

@Component({
  selector: 'app-marketplace-header',
  standalone: true,
  imports: [MatIconModule, CdkConnectedOverlay, CdkOverlayOrigin, RouterLink, RouterLinkActive, BrandMarkComponent],
  template: `
    <header class="mt-header" [class.district-picker-active]="districtPickerOpen()">
      <div class="mt-header__inner">
        <app-brand-mark />
        <label class="mt-header-search"><mat-icon fontSet="material-icons-outlined" aria-hidden="true">search</mat-icon><input type="search" [value]="filters().query" (input)="setQuery($any($event.target).value)" placeholder="Buscar publicaciones…" aria-label="Buscar objeto, descripción o servicio" /></label>
        <button class="district-switch" type="button" (click)="openDistrictPicker()" aria-haspopup="dialog" [attr.aria-expanded]="districtPickerOpen()" [attr.aria-label]="'Seleccionar zona. Actualmente: ' + selectedDistrictLabel()"><span class="district-switch__icon"><mat-icon fontSet="material-icons-outlined" aria-hidden="true">location_on</mat-icon></span><span class="district-switch__copy"><small>Mostrar publicaciones de</small><strong>{{ selectedDistrictLabel() }}</strong></span><mat-icon class="district-switch__chevron" fontSet="material-icons-outlined" aria-hidden="true">expand_more</mat-icon></button>
        <nav class="mt-nav" aria-label="Navegación principal"><a routerLink="/explorar" routerLinkActive="is-current" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page">Explorar</a><a routerLink="/como-funciona" routerLinkActive="is-current" ariaCurrentWhenActive="page">C&#243;mo funciona</a></nav>
        <div class="mt-header__actions"><button class="mt-header-icon mt-theme-toggle" type="button" (click)="toggleTheme()" [attr.aria-label]="darkMode() ? 'Activar modo claro' : 'Activar modo nocturno'"><mat-icon fontSet="material-icons-outlined">{{ darkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon></button>@if (currentUser()) { <a class="mt-messages-link" routerLink="/mensajes" routerLinkActive="is-current" [routerLinkActiveOptions]="{ exact: true }" ariaCurrentWhenActive="page" aria-label="Mensajes" title="Mensajes"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>@if (unreadMessages.total(); as count) { <span class="mt-unread-badge" aria-hidden="true">{{ count > 99 ? '99+' : count }}</span> }</a> }@if (currentUser(); as user) { <button class="mt-account-avatar" type="button" cdkOverlayOrigin #accountOrigin="cdkOverlayOrigin" [attr.aria-expanded]="accountMenuOpen()" aria-haspopup="menu" [attr.aria-label]="'Abrir opciones de cuenta de ' + user.name" (click)="toggleAccountMenu()">@if (user.imageUrl) { <img [src]="user.imageUrl" alt="" width="42" height="42" referrerpolicy="no-referrer" /> } @else { <span>{{ avatarInitials(user.name) }}</span> }</button><ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="accountOrigin" [cdkConnectedOverlayOpen]="accountMenuOpen()" [cdkConnectedOverlayPositions]="accountMenuPositions" [cdkConnectedOverlayHasBackdrop]="true" cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop" (backdropClick)="closeAccountMenu()"><section class="account-popover" role="menu" aria-label="Opciones de cuenta"><div class="account-popover__profile">@if (user.imageUrl) { <img [src]="user.imageUrl" alt="" /> } @else { <span class="account-popover__initials">{{ avatarInitials(user.name) }}</span> }<div><strong>{{ user.name }}</strong><small>Tu cuenta de MonkeyTrueque</small></div></div><div class="account-popover__links"><button type="button" role="menuitem" (click)="closeAccountMenu(); openAccountSettings()"><mat-icon fontSet="material-icons-outlined">manage_accounts</mat-icon><span>Mi cuenta</span></button><a role="menuitem" routerLink="/cuenta" [queryParams]="{ tab: 'listings' }" (click)="closeAccountMenu()"><mat-icon fontSet="material-icons-outlined">person</mat-icon><span>Mi perfil</span></a><a role="menuitem" routerLink="/me-gusta" (click)="closeAccountMenu()"><mat-icon fontSet="material-icons-outlined">favorite</mat-icon><span>Me gusta</span></a><a role="menuitem" routerLink="/mensajes" (click)="closeAccountMenu()"><mat-icon fontSet="material-icons-outlined">chat</mat-icon><span>Mensajes</span></a><a role="menuitem" routerLink="/publicar" (click)="closeAccountMenu()"><mat-icon fontSet="material-icons-outlined">add_circle_outline</mat-icon><span>Publicar algo</span></a></div><button class="account-popover__logout" type="button" role="menuitem" (click)="closeAccountMenu(); signOut()"><mat-icon fontSet="material-icons-outlined">logout</mat-icon><span>Cerrar sesión</span></button></section></ng-template> } @else if (authStatus() !== 'loading') { <a class="mt-login" routerLink="/acceso">Ingresar</a> } @else { <span class="mt-auth-placeholder" aria-hidden="true"></span> }<button class="mt-menu-toggle" type="button" [attr.aria-expanded]="showMobileMenu()" aria-controls="shared-mobile-navigation" [attr.aria-label]="showMobileMenu() ? 'Cerrar navegación' : 'Abrir navegación'" (click)="toggleMobileMenu()"><mat-icon fontSet="material-icons-outlined" aria-hidden="true">{{ showMobileMenu() ? 'close' : 'menu' }}</mat-icon></button></div>
      </div>
      @if (showMobileMenu()) { <nav class="mobile-nav" id="shared-mobile-navigation" aria-label="Navegación móvil"><a routerLink="/explorar" (click)="showMobileMenu.set(false)">Explorar publicaciones</a><a routerLink="/publicar" (click)="showMobileMenu.set(false)">Publicar algo</a>@if (currentUser()) { <a routerLink="/mensajes" (click)="showMobileMenu.set(false)">Mensajes</a><a routerLink="/me-gusta" (click)="showMobileMenu.set(false)">Me gusta</a><a routerLink="/cuenta" (click)="showMobileMenu.set(false)">Mi perfil</a> } @else if (authStatus() !== 'loading') { <a routerLink="/acceso" (click)="showMobileMenu.set(false)">Ingresar</a> }<a routerLink="/como-funciona" (click)="showMobileMenu.set(false)">C&#243;mo funciona</a></nav> }
      @if (districtPickerOpen()) {
        <button class="district-picker-backdrop" type="button" aria-label="Cerrar selector de distrito" (click)="closeDistrictPicker()"></button>
        <aside class="district-picker" role="dialog" aria-modal="true" aria-label="Elegir distrito">
          <header class="district-picker__header">
            @if (!districtSearchOpen()) {
              <button class="district-picker__icon-button" type="button" (click)="openDistrictSearch()" aria-label="Buscar distrito"><mat-icon fontSet="material-icons-outlined">search</mat-icon></button>
              <h2>Elige tu distrito</h2>
              <button class="district-picker__icon-button" type="button" (click)="closeDistrictPicker()" aria-label="Cerrar"><mat-icon fontSet="material-icons-outlined">close</mat-icon></button>
            } @else {
              <button class="district-picker__icon-button" type="button" (click)="closeDistrictSearch()" aria-label="Volver"><mat-icon fontSet="material-icons-outlined">arrow_back</mat-icon></button>
              <input class="district-picker__search-input" type="search" placeholder="Buscar..." aria-label="Buscar distrito" [value]="districtSearch()" (input)="districtSearch.set($any($event.target).value)" />
              <button class="district-picker__icon-button" type="button" (click)="clearDistrictSearch()" aria-label="Limpiar búsqueda"><mat-icon fontSet="material-icons-outlined">delete_outline</mat-icon></button>
            }
          </header>
          <div class="district-picker__content">
            <div class="district-picker__intro"><strong>Selecciona tu zona</strong><span>Publicaciones de Lima Metropolitana</span></div>
            <div class="district-picker__options" role="radiogroup" aria-label="Distritos disponibles">
            <button class="district-picker__option" type="button" role="radio" [attr.aria-checked]="draftDistrictId() === 'all'" [class.is-selected]="draftDistrictId() === 'all'" (click)="draftDistrictId.set('all')"><span><strong>Todos los distritos</strong><small>Lima, Perú</small></span><mat-icon fontSet="material-icons-outlined">{{ draftDistrictId() === 'all' ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon></button>
            @for (district of filteredDistricts(); track district.id) {
              <button class="district-picker__option" type="button" role="radio" [attr.aria-checked]="draftDistrictId() === district.id" [class.is-selected]="draftDistrictId() === district.id" (click)="draftDistrictId.set(district.id)"><span><strong>{{ district.name }}</strong><small>Lima, Perú</small></span><mat-icon fontSet="material-icons-outlined">{{ draftDistrictId() === district.id ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon></button>
            }
            </div>
            @if (filteredDistricts().length === 0) { <p class="district-picker__empty">No encontramos distritos con ese nombre.</p> }
          </div>
          <footer class="district-picker__footer"><span>{{ draftDistrictLabel() }}</span><button type="button" (click)="applyDistrictSelection()">Aplicar</button></footer>
        </aside>
      }
    </header>
  `,
  styles: [`
    :host { display:block; }
    .mt-auth-placeholder { display:block; width:98px; height:42px; flex:none; }
    .mobile-nav { display:none; }
    @media (max-width:1024px) { .mobile-nav { display:grid; gap:2px; padding:7px clamp(18px, 4vw, 24px) 15px; border-top:1px solid var(--mt-line); background:var(--mt-paper); } .mobile-nav a { display:flex; min-height:44px; align-items:center; padding:10px 2px; color:var(--mt-ink); font-size:14px; font-weight:500; text-decoration:none; } }
    .mt-account-avatar { display:grid; width:42px; height:42px; flex:none; place-items:center; overflow:hidden; border:0; border-radius:50%; padding:0; background:var(--mt-summary,#f2eafa); color:var(--mt-action,#6033bd); text-decoration:none; }
    .mt-account-avatar img { width:100%; height:100%; object-fit:cover; }
    .mt-account-avatar span { font-size:14px; font-weight:700; }
  `],
})
export class MarketplaceHeaderComponent {
  private readonly store = inject(Store<AppState>);
  private readonly auth = inject(AuthService);

  readonly unreadMessages = inject(UnreadMessagesService);
  readonly districts = this.store.selectSignal(selectDistricts);
  readonly filteredDistricts = computed(() => {
    const query = this.districtSearch().trim().toLocaleLowerCase('es');
    return this.districts().filter((district) => district.name.toLocaleLowerCase('es').includes(query));
  });
  readonly filters = this.store.selectSignal(selectFilters);
  readonly selectedDistrictId = this.store.selectSignal(selectSelectedDistrictId);
  readonly currentUser = this.auth.user;
  readonly authStatus = this.auth.status;
  readonly darkMode = signal(false);
  readonly showMobileMenu = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly accountMenuPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 12 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -12 },
  ];
  readonly districtPickerOpen = signal(false);
  readonly districtSearchOpen = signal(false);
  readonly draftDistrictId = signal<DistrictSelection>('all');
  readonly districtSearch = signal('');


  constructor() {
    this.darkMode.set(localStorage.getItem('monkeytrueque.theme') === 'dark');
    document.documentElement.classList.toggle('marketplace-dark', this.darkMode());
  }
  setQuery(query: string): void { this.store.dispatch(MarketplaceActions.setQuery({ query })); }
  toggleAccountMenu(): void { this.accountMenuOpen.update((open) => !open); }
  closeAccountMenu(): void { this.accountMenuOpen.set(false); }
  openDistrictPicker(): void { this.draftDistrictId.set(this.selectedDistrictId()); this.districtSearch.set(''); this.districtSearchOpen.set(false); this.districtPickerOpen.set(true); }
  closeDistrictPicker(): void { this.districtPickerOpen.set(false); this.districtSearchOpen.set(false); }
  openDistrictSearch(): void { this.districtSearchOpen.set(true); }
  closeDistrictSearch(): void { this.districtSearchOpen.set(false); this.districtSearch.set(''); }
  clearDistrictSearch(): void { this.districtSearch.set(''); }
  applyDistrictSelection(): void { this.selectDistrict(this.draftDistrictId()); this.closeDistrictPicker(); }
  draftDistrictLabel(): string { const id = this.draftDistrictId(); return id === 'all' ? 'Todos los distritos' : this.districts().find((district) => district.id === id)?.name ?? 'Todos los distritos'; }
  @HostListener('document:keydown.escape') closeOverlaysOnEscape(): void { if (this.districtPickerOpen()) this.closeDistrictPicker(); this.closeAccountMenu(); }
  selectDistrict(districtId: DistrictSelection): void { this.store.dispatch(MarketplaceActions.setDistrict({ districtId })); }
  selectedDistrictLabel(): string { const id = this.selectedDistrictId(); return id === 'all' ? 'Todos los distritos' : this.districts().find((district) => district.id === id)?.name ?? 'Todos los distritos'; }
  toggleTheme(): void {
    const enabled = !this.darkMode();
    this.darkMode.set(enabled);
    document.documentElement.classList.toggle('marketplace-dark', enabled);
    localStorage.setItem('monkeytrueque.theme', enabled ? 'dark' : 'light');
  }
  toggleMobileMenu(): void { this.showMobileMenu.update((open) => !open); }
  async openAccountSettings(): Promise<void> {
    try { await this.auth.openUserProfile(); }
    catch { /* El perfil se gestiona desde la interfaz local. */ }
  }
  async signOut(): Promise<void> { await this.auth.signOut(); }
  avatarInitials(name: string): string { return name.trim().charAt(0).toUpperCase() || '?'; }
}
