import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthService } from '../../core/auth/auth.service';
import { AdminApiService } from '../../core/data/admin-api.service';
import { MarketplaceApiService } from '../../core/data/marketplace-api.service';
import type { AcceptedKind, AppState, DistrictSelection, Listing, ListingCategory, ListingKind } from '../../core/models/marketplace.models';
import { ListingCardComponent } from './listing-card.component';
import { MarketplaceHeaderComponent } from './marketplace-header.component';
import { BrandMarkComponent } from './brand-mark.component';
import * as MarketplaceActions from './state/marketplace.actions';
import { selectDistricts, selectFilters, selectSelectedDistrictId, selectVisibleListings } from './state/marketplace.selectors';

@Component({
  selector: 'app-explore-listings',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink, ListingCardComponent, MarketplaceHeaderComponent, BrandMarkComponent],
  template: `
    <div class="explore-page">
      <app-marketplace-header />
      <main>
        <section class="explore-heading"><div>@if (isSearchList()) { <h1>Resultados para “{{ filters().query }}”</h1><p>Publicaciones que coinciden con tu búsqueda.</p> } @else { <h1>Explorar productos y servicios</h1><p>Encuentra publicaciones de tu comunidad con los filtros que necesitas.</p> }</div></section>
        <label class="explore-search"><mat-icon fontSet="material-icons-outlined">search</mat-icon><input type="search" [value]="filters().query" (input)="setQuery($any($event.target).value)" placeholder="Busca por nombre, categoría o lugar" aria-label="Buscar publicaciones" /></label>
        <div class="explore-layout" [class.explore-layout--results]="isSearchList()">
          @if (!isSearchList()) {
          <aside class="explore-filters" aria-label="Filtros de publicaciones">
            <div class="filter-heading"><h2>Filtrar publicaciones</h2><button type="button" (click)="clearFilters()">Limpiar</button></div>
            <label class="filter-group"><span>Distrito</span><select [value]="selectedDistrictId()" (change)="selectDistrict($any($event.target).value)"><option value="all">Todos los distritos</option>@for (district of districts(); track district.id) { <option [value]="district.id">{{ district.name }}</option> }</select></label>
            <fieldset class="filter-group"><legend>Tipo de intercambio</legend><label><input type="radio" name="mode" [checked]="modeFilter() === 'all'" (change)="setModeFilter('all')" /> Todos</label><label><input type="radio" name="mode" [checked]="modeFilter() === 'trade'" (change)="setModeFilter('trade')" /> Trueque</label><label><input type="radio" name="mode" [checked]="modeFilter() === 'sale'" (change)="setModeFilter('sale')" /> Venta</label><label><input type="radio" name="mode" [checked]="modeFilter() === 'gift'" (change)="setModeFilter('gift')" /> Regalo</label></fieldset>
            <label class="filter-group"><span>Se publica</span><select [value]="filters().kind" (change)="selectKind($any($event.target).value)"><option value="all">Objeto o servicio</option><option value="object">Objeto</option><option value="service">Servicio</option></select></label>
            <label class="filter-group"><span>Categoría</span><select [value]="filters().category" (change)="selectCategory($any($event.target).value)"><option value="all">Todas las categorías</option><option value="electronics">Electrónica</option><option value="clothing">Ropa y accesorios</option><option value="home">Hogar y muebles</option><option value="beauty">Belleza y cuidado personal</option><option value="babies">Bebés y niños</option><option value="sports">Deportes y aire libre</option><option value="toys">Juguetes, hobbies y coleccionables</option><option value="books">Libros, música y películas</option><option value="food">Alimentos y bebidas</option><option value="other">Otros</option><option value="school">Útiles escolares</option><option value="mobility">Movilidad</option><option value="decor">Decoración</option><option value="services">Servicios</option></select></label>
            <fieldset class="filter-group"><legend>Acepta a cambio</legend><label><input type="radio" name="accepts" [checked]="filters().accepts === 'all'" (change)="selectAccepts('all')" /> Cualquier opción</label><label><input type="radio" name="accepts" [checked]="filters().accepts === 'object'" (change)="selectAccepts('object')" /> Objeto</label><label><input type="radio" name="accepts" [checked]="filters().accepts === 'service'" (change)="selectAccepts('service')" /> Servicio</label></fieldset>
          </aside>
          }
          <section class="explore-results" aria-label="Resultados de publicaciones">
            <div class="results-heading"><p><strong>{{ filteredListings().length }}</strong> {{ filteredListings().length === 1 ? 'resultado' : 'resultados' }}@if (isSearchList()) { para “{{ filters().query }}” }</p></div>
            @if (isSearchList()) {
              <div class="search-filter-bar" aria-label="Filtrar resultados">
                <div class="search-mode-pills" role="group" aria-label="Modalidad">
                  <button type="button" [class.is-active]="modeFilter() === 'all'" (click)="setModeFilter('all')">Todos</button>
                  <button type="button" [class.is-active]="modeFilter() === 'trade'" (click)="setModeFilter('trade')">Trueque</button>
                  <button type="button" [class.is-active]="modeFilter() === 'sale'" (click)="setModeFilter('sale')">Venta</button>
                  <button type="button" [class.is-active]="modeFilter() === 'gift'" (click)="setModeFilter('gift')">Regalo</button>
                </div>
                <select aria-label="Filtrar por distrito" [value]="selectedDistrictId()" (change)="selectDistrict($any($event.target).value)"><option value="all">Todos los distritos</option>@for (district of districts(); track district.id) { <option [value]="district.id">{{ district.name }}</option> }</select>
                <select aria-label="Filtrar por tipo de publicación" [value]="filters().kind" (change)="selectKind($any($event.target).value)"><option value="all">Objeto o servicio</option><option value="object">Objeto</option><option value="service">Servicio</option></select>
                <select aria-label="Filtrar por categoría" [value]="filters().category" (change)="selectCategory($any($event.target).value)"><option value="all">Todas las categorías</option><option value="electronics">Electrónica</option><option value="clothing">Ropa y accesorios</option><option value="home">Hogar y muebles</option><option value="beauty">Belleza y cuidado personal</option><option value="babies">Bebés y niños</option><option value="sports">Deportes y aire libre</option><option value="toys">Juguetes y coleccionables</option><option value="books">Libros, música y películas</option><option value="food">Alimentos y bebidas</option><option value="other">Otros</option><option value="school">Útiles escolares</option><option value="mobility">Movilidad</option><option value="decor">Decoración</option><option value="services">Servicios</option></select>
                <select aria-label="Filtrar por lo que acepta a cambio" [value]="filters().accepts" (change)="selectAccepts($any($event.target).value)"><option value="all">Cualquier opción</option><option value="object">Acepta objeto</option><option value="service">Acepta servicio</option></select>
              </div>
            }
            @if (error()) { <p class="explore-error" role="status">{{ error() }}</p> }
            @if (filteredListings().length) {
              @if (isSearchList()) {
                <div class="explore-list">@for (listing of paginatedListings(); track listing.id) {
                  <article class="search-result">
                    <button class="search-result__image" type="button" [attr.aria-label]="'Ver ' + listing.title" (click)="openListing(listing)"><img [src]="listing.photos[0].src" [alt]="listing.photos[0].alt" loading="lazy" /><span>{{ modeLabel(listing) }}</span></button>
                    <div class="search-result__content"><span class="search-result__category">{{ categoryLabel(listing.category) }} · {{ listing.condition }}</span><h2><a [routerLink]="['/producto', listing.id]">{{ listing.title }}</a></h2><p class="search-result__description">{{ listing.description }}</p><div class="search-result__footer"><span><mat-icon fontSet="material-icons-outlined" aria-hidden="true">location_on</mat-icon>{{ districtName(listing) }}, Lima</span>@if (listing.mode === 'sale' && listing.price != null) { <strong>S/ {{ listing.price | number:'1.2-2' }}</strong> } @else if (listing.mode === 'trade' && listing.price != null) { <small>Valor referencial: S/ {{ listing.price | number:'1.2-2' }}</small> }</div></div>
                  </article>
                }</div>
              } @else {
                <div class="explore-grid">@for (listing of paginatedListings(); track listing.id) { <app-listing-card [listing]="listing" [districtName]="districtName(listing)" (detailsRequested)="openListing($event)" /> }</div>
              }
              <nav class="pagination" aria-label="Paginación de publicaciones">
                  <button type="button" aria-label="Página anterior" [disabled]="currentPage() === 1" (click)="goToPage(currentPage() - 1)"><mat-icon fontSet="material-icons-outlined">chevron_left</mat-icon></button>
                  @for (page of paginationPages(); track $index) {
                    @if (page === '…') { <span class="pagination__ellipsis" aria-hidden="true">…</span> }
                    @else { <button type="button" [class.is-current]="page === currentPage()" [attr.aria-current]="page === currentPage() ? 'page' : null" [attr.aria-label]="'Página ' + page" (click)="goToPage(+page)">{{ page }}</button> }
                  }
                  <button type="button" aria-label="Página siguiente" [disabled]="currentPage() === totalPages()" (click)="goToPage(currentPage() + 1)"><mat-icon fontSet="material-icons-outlined">chevron_right</mat-icon></button>
              </nav>
            }
            @else { <div class="explore-empty"><mat-icon fontSet="material-icons-outlined">search_off</mat-icon><h2>No encontramos publicaciones</h2><p>Prueba con otros filtros o elige otro distrito.</p><button type="button" (click)="clearFilters()">Limpiar filtros</button></div> }
          </section>
        </div>
        <section class="community-banner explore-community-banner" aria-labelledby="explore-community-title">
          <div class="community-banner__mascot"><img src="/brand/jorge-curioso.png" alt="Jorge el curioso invita a la comunidad MonkeyTrueque" loading="lazy" /></div>
          <div class="community-banner__content">
            <span class="community-banner__eyebrow">Comunidad</span>
            <h2 id="explore-community-title">Únete a nuestra comunidad</h2>
            <p>Sigue nuestras redes para enterarte de novedades, ferias y los trueques más buscados de la semana.</p>
            <nav class="community-banner__links" aria-label="Redes sociales de MonkeyTrueque">
              <a href="https://www.facebook.com/groups/" target="_blank" rel="noopener noreferrer">Grupo FB</a>
              <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer">Facebook</a>
              <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a href="https://www.tiktok.com/" target="_blank" rel="noopener noreferrer">TikTok</a>
            </nav>
          </div>
        </section>
      </main>
      <footer class="mt-footer"><div class="mt-shell mt-footer__inner"><app-brand-mark /><p class="mt-footer__tagline">Intercambia lo que tienes por algo que te sirve. Hecho en Lima.</p><nav class="mt-footer__links" aria-label="Enlaces del pie de página"><a routerLink="/como-funciona">Cómo funciona</a><a routerLink="/explorar">Explorar</a></nav></div></footer>
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:var(--mt-paper,#faf7f1); color:var(--mt-ink,#241d2b); }
    .explore-page { width:100%; margin:auto; padding:0; }
    .explore-page > .mt-header { width:100%; margin:0 0 10px; }
    .explore-page > main { width:min(1280px,calc(100% - 48px)); margin:auto; padding:18px 0 14px; }
    .explore-page .district-switch select { max-width:170px; border:0; outline:0; background:transparent; color:inherit; font:inherit; font-size:13px; font-weight:600; }
    .explore-page .mt-account-avatar { display:grid; width:42px; height:42px; place-items:center; overflow:hidden; border:0; border-radius:50%; padding:0; background:var(--mt-summary,#f2eafa); color:var(--mt-action,#6033bd); text-decoration:none; }
    .explore-page .mt-account-avatar img { width:100%; height:100%; object-fit:cover; }
    .explore-page .mt-account-avatar span { font-size:14px; font-weight:700; }
    .explore-heading { margin-bottom:20px; } .explore-heading span { color:var(--mt-action,#6033bd); font-size:10px; font-weight:700; letter-spacing:.12em; }
    .explore-heading h1 { margin:5px 0; font-size:clamp(24px,3vw,34px); } .explore-heading p { margin:0; color:var(--mt-muted,#81778b); font-size:13px; }
    .explore-search { display:flex; height:48px; align-items:center; gap:10px; margin-bottom:18px; padding:0 10px 0 14px; border:1px solid var(--mt-line,#e8dfd1); border-radius:13px; background:var(--mt-card,#fff); }
    .explore-search mat-icon { color:var(--mt-muted,#81778b); } .explore-search input { min-width:0; flex:1; border:0; outline:0; background:transparent; color:inherit; font:inherit; font-size:13px; }
    .explore-layout { display:grid; grid-template-columns:minmax(220px,260px) minmax(0,1fr); align-items:start; gap:20px; }
    .explore-layout--results { grid-template-columns:minmax(0,1fr); }
    .explore-filters { display:grid; gap:18px; position:static; padding:16px; border:1px solid var(--mt-line,#e8dfd1); border-radius:14px; background:var(--mt-card,#fff); }
    .filter-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; } .filter-heading h2 { margin:0; font-size:13px; }
    .filter-heading button { border:0; background:none; color:#111; cursor:pointer; font-size:11px; }
    .filter-group { display:grid; gap:8px; margin:0; padding:0; border:0; } .filter-group > span,.filter-group legend { margin-bottom:1px; color:#111; font-size:11px; font-weight:650; }
    .filter-group select { width:100%; height:36px; border:1px solid var(--mt-line,#e8dfd1); border-radius:8px; padding:0 9px; background:var(--mt-card,#fff); color:#111; font:inherit; font-size:11px; }
    .filter-group label { display:flex; align-items:center; gap:7px; color:#111; font-size:11px; cursor:pointer; }
    .filter-group input { accent-color:#111; }
    .results-heading { display:flex; align-items:center; justify-content:space-between; min-height:36px; margin-bottom:10px; color:var(--mt-muted,#81778b); font-size:11px; }
    .results-heading p { margin:0; } .results-heading strong { color:var(--mt-ink,#241d2b); }
    .search-filter-bar { display:flex; align-items:center; flex-wrap:wrap; gap:9px; margin:0 0 14px; }
    .search-mode-pills { display:flex; align-items:center; gap:3px; padding:4px; border:1px solid var(--mt-line,#e8dfd1); border-radius:999px; background:var(--mt-card,#fff); }
    .search-mode-pills button { min-height:30px; padding:0 12px; border:0; border-radius:999px; background:transparent; color:var(--mt-ink,#241d2b); cursor:pointer; font:inherit; font-size:11px; }
    .search-mode-pills button.is-active { background:#111; color:#fff; font-weight:650; }
    .search-filter-bar > select { min-height:38px; max-width:210px; padding:0 30px 0 12px; border:1px solid var(--mt-line,#e8dfd1); border-radius:999px; background:var(--mt-card,#fff); color:var(--mt-ink,#241d2b); font:inherit; font-size:11px; }
    .results-heading label { display:flex; align-items:center; gap:7px; } .results-heading select { border:1px solid var(--mt-line,#e8dfd1); border-radius:8px; padding:7px 10px; background:var(--mt-card,#fff); color:inherit; font:inherit; }
    .explore-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); align-items:start; gap:14px; }
    .explore-list { display:grid; gap:0; }
    .search-result { display:grid; grid-template-columns:minmax(200px,256px) minmax(0,1fr); min-height:210px; padding:12px 0; border-bottom:1px solid var(--mt-line,#e8dfd1); background:transparent; }
    .search-result__image { position:relative; display:block; width:100%; min-height:210px; overflow:hidden; padding:0; border:0; border-radius:7px; background:#f0eaf6; cursor:pointer; }
    .search-result__image img { display:block; width:100%; height:100%; min-height:210px; object-fit:cover; }
    .search-result__image span { position:absolute; top:10px; left:10px; padding:6px 10px; border-radius:999px; background:#f5b51b; color:#17131c; font-size:11px; font-weight:700; }
    .search-result__content { display:flex; min-width:0; flex-direction:column; padding:16px 20px; }
    .search-result__category { color:var(--mt-muted,#81778b); font-size:11px; }
    .search-result__content h2 { margin:7px 0; font-size:18px; line-height:1.35; }
    .search-result__content h2 a { color:var(--mt-ink,#241d2b); text-decoration:none; }
    .search-result__content h2 a:hover { text-decoration:underline; }
    .search-result__description { display:-webkit-box; overflow:hidden; margin:0; color:var(--mt-muted,#81778b); font-size:13px; line-height:1.5; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
    .search-result__footer { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:auto; padding-top:12px; }
    .search-result__footer > span { display:flex; align-items:center; gap:4px; color:var(--mt-muted,#81778b); font-size:11px; }
    .search-result__footer mat-icon { width:16px; height:16px; font-size:16px; }
    .search-result__footer strong { color:var(--mt-ink,#241d2b); font-size:20px; }
    .search-result__footer small { color:var(--mt-muted,#81778b); font-size:11px; }
    .pagination { display:flex; align-items:center; justify-content:center; gap:4px; margin-top:24px; }
    .pagination button { display:grid; width:34px; height:34px; place-items:center; border:0; border-radius:50%; background:transparent; color:var(--mt-ink,#241d2b); cursor:pointer; font:inherit; font-size:12px; }
    .pagination button:hover:not(:disabled):not(.is-current) { background:var(--mt-summary,#f2eafa); }
    .pagination button.is-current { background:#4b5b6b; color:white; font-weight:700; }
    .pagination button:disabled { opacity:.42; cursor:default; }
    .pagination button mat-icon { width:18px; height:18px; font-size:18px; }
    .pagination__ellipsis { display:grid; width:25px; height:34px; place-items:center; color:var(--mt-muted,#81778b); font-size:12px; }
    .explore-empty { display:grid; min-height:260px; justify-items:center; align-content:center; border:1px dashed var(--mt-line,#e8dfd1); border-radius:14px; color:var(--mt-muted,#81778b); text-align:center; }
    .explore-empty mat-icon { color:var(--mt-action,#6033bd); } .explore-empty h2 { margin:10px 0 4px; color:var(--mt-ink,#241d2b); font-size:18px; } .explore-empty p { font-size:12px; }
    .explore-empty button { border:1px solid var(--mt-line,#e8dfd1); border-radius:999px; padding:9px 14px; background:var(--mt-card,#fff); color:var(--mt-ink,#241d2b); cursor:pointer; }
    .explore-error { color:#b42318; font-size:12px; }
    @media(max-width:1100px) { .explore-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
    @media(max-width:850px) { .explore-page > main { width:calc(100% - 28px); } .explore-layout { grid-template-columns:1fr; } .explore-filters { position:static; grid-template-columns:repeat(2,minmax(0,1fr)); } .filter-heading { grid-column:1/-1; } .explore-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
    @media(max-width:600px) { .explore-filters { grid-template-columns:1fr; } .results-heading { align-items:flex-start; } .explore-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; } }
    @media(max-width:540px) { .search-result { grid-template-columns:120px minmax(0,1fr); min-height:160px; } .search-result__image,.search-result__image img { min-height:160px; } .search-result__content { padding:10px; } .search-result__content h2 { font-size:14px; } .search-result__description { font-size:11px; -webkit-line-clamp:2; } .search-result__footer strong { font-size:16px; } }
    @media(max-width:380px) { .explore-grid { grid-template-columns:1fr; } }
  `],
})
export class ExploreListingsComponent {
  private readonly store = inject(Store<AppState>);
  private readonly api = inject(MarketplaceApiService);
  private readonly auth = inject(AuthService);
  private readonly adminApi = inject(AdminApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly districts = this.store.selectSignal(selectDistricts);
  readonly filters = this.store.selectSignal(selectFilters);
  readonly selectedDistrictId = this.store.selectSignal(selectSelectedDistrictId);
  readonly visibleListings = this.store.selectSignal(selectVisibleListings);
  readonly modeFilter = signal<'all' | 'trade' | 'sale' | 'gift'>('all');
  readonly isSearchList = computed(() => !!this.filters().query.trim());
  readonly error = signal('');
  readonly filteredListings = computed(() => this.visibleListings().filter((listing) => this.modeFilter() === 'all' || (listing.mode ?? 'trade') === this.modeFilter()));
  readonly currentPage = signal(1);
  private readonly pageSize = 24;
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredListings().length / this.pageSize)));
  readonly paginatedListings = computed(() => this.filteredListings().slice((this.currentPage() - 1) * this.pageSize, this.currentPage() * this.pageSize));
  readonly paginationPages = computed((): (number | '…')[] => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
    if (current <= 3) return [1, 2, 3, '…', total];
    if (current >= total - 2) return [1, '…', total - 2, total - 1, total];
    return [1, '…', current - 1, current, current + 1, '…', total];
  });
  readonly currentUser = this.auth.user;
  readonly darkMode = signal(false);
  readonly isAdmin = signal(false);

  constructor() {
    this.darkMode.set(localStorage.getItem('monkeytrueque.theme') === 'dark');
    document.documentElement.classList.toggle('marketplace-dark', this.darkMode());
    this.route.queryParamMap.subscribe((params) => {
      const query = params.get('q');
      if (query !== null) this.setQuery(query);
    });
    effect(() => {
      const user = this.currentUser();
      this.isAdmin.set(false);
      if (user) void this.adminApi.isAdmin().then((allowed) => {
        if (this.currentUser()?.id === user.id) this.isAdmin.set(allowed);
      }).catch(() => undefined);
    });
    void this.loadListings();
  }

  private async loadListings(): Promise<void> {
    try { this.store.dispatch(MarketplaceActions.setListings({ listings: await this.api.listings() })); }
    catch { this.error.set('No se pudieron cargar las publicaciones. Revisa que el servidor esté iniciado.'); }
  }
  setQuery(query: string): void { this.currentPage.set(1); this.store.dispatch(MarketplaceActions.setQuery({ query })); }
  toggleTheme(): void {
    const enabled = !this.darkMode();
    this.darkMode.set(enabled);
    document.documentElement.classList.toggle('marketplace-dark', enabled);
    localStorage.setItem('monkeytrueque.theme', enabled ? 'dark' : 'light');
  }
  avatarInitials(name: string): string { return name.trim().charAt(0).toUpperCase() || '?'; }
  selectDistrict(districtId: DistrictSelection): void { this.currentPage.set(1); this.store.dispatch(MarketplaceActions.setDistrict({ districtId })); }
  selectCategory(category: ListingCategory | 'all'): void { this.currentPage.set(1); this.store.dispatch(MarketplaceActions.setCategory({ category })); }
  selectKind(kind: ListingKind | 'all'): void { this.currentPage.set(1); this.store.dispatch(MarketplaceActions.setListingKind({ kind })); }
  selectAccepts(accepts: AcceptedKind | 'all'): void { this.currentPage.set(1); this.store.dispatch(MarketplaceActions.setAcceptedKind({ accepts })); }
  setModeFilter(mode: 'all' | 'trade' | 'sale' | 'gift'): void { this.currentPage.set(1); this.modeFilter.set(mode); }
  toggleModeFilter(mode: 'trade' | 'sale' | 'gift'): void { this.setModeFilter(this.modeFilter() === mode ? 'all' : mode); }
  goToPage(page: number): void { this.currentPage.set(Math.max(1, Math.min(this.totalPages(), page))); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  clearFilters(): void {
    this.currentPage.set(1);
    this.store.dispatch(MarketplaceActions.setQuery({ query: '' }));
    this.store.dispatch(MarketplaceActions.setDistrict({ districtId: 'all' }));
    this.store.dispatch(MarketplaceActions.setCategory({ category: 'all' }));
    this.store.dispatch(MarketplaceActions.setListingKind({ kind: 'all' }));
    this.store.dispatch(MarketplaceActions.setAcceptedKind({ accepts: 'all' }));
    void this.router.navigate([], { relativeTo: this.route, queryParams: { q: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  districtName(listing: Listing): string { return this.districts().find((district) => district.id === listing.districtId)?.name ?? listing.districtId; }
  modeLabel(listing: Listing): string { return ({ trade: 'Trueque', sale: 'Venta', gift: 'Regalo' } as const)[listing.mode ?? 'trade']; }
  categoryLabel(category: ListingCategory): string {
    return ({ electronics: 'Electrónica', clothing: 'Ropa y accesorios', home: 'Hogar y muebles', beauty: 'Belleza y cuidado personal', babies: 'Bebés y niños', sports: 'Deportes y aire libre', toys: 'Juguetes, hobbies y coleccionables', school: 'Útiles escolares', books: 'Libros, música y películas', food: 'Alimentos y bebidas', other: 'Otros', mobility: 'Movilidad', decor: 'Decoración', services: 'Servicios' } as Record<ListingCategory, string>)[category];
  }
  openListing(listing: Listing): void { void this.router.navigate(['/producto', listing.id]); }
}
