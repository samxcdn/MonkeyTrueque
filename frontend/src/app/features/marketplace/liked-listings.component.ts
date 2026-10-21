import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthService } from '../../core/auth/auth.service';
import { MarketplaceApiService } from '../../core/data/marketplace-api.service';
import type { AppState, Listing } from '../../core/models/marketplace.models';
import { DEMO_DISTRICTS } from '../../core/data/demo-marketplace.data';
import { ListingCardComponent } from './listing-card.component';
import { MarketplaceHeaderComponent } from './marketplace-header.component';
import * as MarketplaceActions from './state/marketplace.actions';
import { selectListings } from './state/marketplace.selectors';

const likedListingsKey = 'monkeytrueque.likedListings';

@Component({
  selector: 'app-liked-listings',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink, ListingCardComponent, MarketplaceHeaderComponent],
  template: `
    <div class="liked-page">
      <app-marketplace-header />
      <main class="liked-shell">
        <header class="liked-heading"><span>MONKEYTRUEQUE</span><h1>Me gusta</h1><p>Las publicaciones que guardaste para ver después.</p></header>
        @if (!currentUser()) {
          <section class="liked-state"><mat-icon fontSet="material-icons-outlined">favorite_border</mat-icon><h2>Inicia sesión para ver tus favoritos</h2><p>Guarda publicaciones y las encontrarás aquí.</p><button class="mt-publish" type="button" (click)="signIn()">Iniciar sesión</button></section>
        } @else if (loading()) {
          <section class="liked-state" aria-live="polite"><mat-icon fontSet="material-icons-outlined">hourglass_top</mat-icon><p>Cargando tus publicaciones guardadas…</p></section>
        } @else if (error()) {
          <section class="liked-state"><mat-icon fontSet="material-icons-outlined">error_outline</mat-icon><h2>No se pudieron cargar las publicaciones</h2><p>{{ error() }}</p><button type="button" (click)="reload()">Intentar de nuevo</button></section>
        } @else if (favorites().length) {
          <p class="liked-count">{{ favorites().length }} {{ favorites().length === 1 ? 'publicación guardada' : 'publicaciones guardadas' }}</p>
          <div class="listing-grid liked-grid">
            @for (listing of favorites(); track listing.id) {
              <app-listing-card [listing]="listing" [districtName]="districtName(listing)" (detailsRequested)="openListing($event)" (favoriteChanged)="onFavoriteChanged($event)" />
            }
          </div>
        } @else {
          <section class="liked-state"><mat-icon fontSet="material-icons-outlined">favorite_border</mat-icon><h2>Aún no tienes favoritos</h2><p>Cuando marques una publicación con el corazón, aparecerá aquí.</p><a class="mt-publish" routerLink="/explorar">Explorar publicaciones</a></section>
        }
      </main>
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:var(--mt-paper); color:var(--mt-ink); }
    .liked-page { min-height:100vh; }
    .liked-shell { width:min(1280px,calc(100% - 48px)); margin:auto; padding:30px 0 58px; }
    .liked-heading { margin-bottom:22px; }
    .liked-heading > span { color:var(--mt-action); font-size:10px; font-weight:700; letter-spacing:.12em; }
    .liked-heading h1 { margin:4px 0; font:600 clamp(30px,4vw,40px)/1.05 var(--font-display); }
    .liked-heading p,.liked-count { margin:0; color:var(--mt-muted); font-size:13px; }
    .liked-count { margin-bottom:2px; }
    .liked-grid { grid-template-columns:repeat(5,minmax(0,1fr)); }
    .liked-state { display:grid; min-height:300px; align-content:center; justify-items:center; gap:9px; padding:24px; border:1px solid var(--mt-line); border-radius:20px; background:var(--mt-card); text-align:center; }
    .liked-state > mat-icon { width:38px; height:38px; color:var(--mt-action); font-size:38px; }
    .liked-state h2 { margin:4px 0 0; color:var(--mt-ink); font-size:19px; }
    .liked-state p { margin:0; color:var(--mt-muted); font-size:13px; }
    .liked-state button,.liked-state a { margin-top:8px; }
    .liked-state > button:not(.mt-publish) { min-height:38px; padding:0 14px; border:1px solid var(--mt-line); border-radius:999px; background:var(--mt-card); color:var(--mt-ink); cursor:pointer; }
    .liked-state a { text-decoration:none; }
    @media(max-width:1100px) { .liked-grid { grid-template-columns:repeat(4,minmax(0,1fr)); } }
    @media(max-width:850px) { .liked-shell { width:calc(100% - 28px); } .liked-grid { grid-template-columns:repeat(3,minmax(0,1fr)); } }
    @media(max-width:600px) { .liked-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; } }
    @media(max-width:380px) { .liked-grid { grid-template-columns:1fr; } }
  `],
})
export class LikedListingsComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(MarketplaceApiService);
  private readonly store = inject(Store<AppState>);
  private readonly router = inject(Router);
  private readonly allListings = this.store.selectSignal(selectListings);
  readonly currentUser = this.auth.user;
  readonly likedIds = signal<string[]>([]);
  readonly favorites = computed(() => this.allListings().filter((listing) => this.likedIds().includes(listing.id)));
  readonly loading = signal(true);
  readonly error = signal('');
  private loadedForUser = '';

  constructor() {
    this.likedIds.set(this.readLikedIds());
    effect(() => {
      const status = this.auth.status();
      const user = this.currentUser();
      if (status === 'loading') return;
      if (!user) { this.loading.set(false); return; }
      if (this.loadedForUser === user.id) return;
      this.loadedForUser = user.id;
      void this.loadListings();
    });
  }

  async loadListings(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.store.dispatch(MarketplaceActions.setListings({ listings: await this.api.listings() }));
      this.likedIds.set(this.readLikedIds());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Revisa que el servidor esté iniciado.');
    } finally {
      this.loading.set(false);
    }
  }

  reload(): void { this.loadedForUser = ''; void this.loadListings(); }
  signIn(): void { void this.auth.openSignIn('/me-gusta'); }
  openListing(listing: Listing): void { void this.router.navigate(['/producto', listing.id]); }
  districtName(listing: Listing): string { return DEMO_DISTRICTS.find((district) => district.id === listing.districtId)?.name ?? listing.districtId; }
  onFavoriteChanged(change: { listingId: string; liked: boolean }): void {
    this.likedIds.update((ids) => change.liked ? [...new Set([...ids, change.listingId])] : ids.filter((id) => id !== change.listingId));
  }

  private readLikedIds(): string[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(likedListingsKey) ?? '[]');
      return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  }
}
