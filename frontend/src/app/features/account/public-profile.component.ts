import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';
import { DEMO_COMMUNITIES, DEMO_DISTRICTS } from '../../core/data/demo-marketplace.data';
import { MarketplaceApiService } from '../../core/data/marketplace-api.service';
import type { PublicProfile, PublicReputation, PublicReview } from '../../core/data/marketplace-api.service';
import { MarketplaceHeaderComponent } from '../marketplace/marketplace-header.component';
import type { Listing } from '../../core/models/marketplace.models';
import { ListingCardComponent } from '../marketplace/listing-card.component';

@Component({
  selector: 'app-public-profile',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MarketplaceHeaderComponent, ListingCardComponent],
  template: `
    <div class="public-profile-page">
      <app-marketplace-header />
      @if (loading()) { <p class="profile-message">Cargando perfil…</p> }
      @else if (profile() || listings().length) {
        <main>
          <section class="public-profile-card">
            @if (ownerImageUrl() && ownerImageUrl() !== failedAvatarUrl()) { <img class="public-avatar" [src]="ownerImageUrl()" alt="Foto de perfil" referrerpolicy="no-referrer" (error)="failedAvatarUrl.set(ownerImageUrl())" /> }
            @else { <span class="public-avatar public-avatar--initial" aria-hidden="true">{{ ownerName().charAt(0).toUpperCase() }}</span> }
            <h1>{{ ownerName() }}</h1>
            @if (profile()?.description) { <p class="public-description">{{ profile()?.description }}</p> }
            <div class="public-profile-meta">
              @if (profile()?.memberSince) { <span>Miembro desde {{ memberSince() }}</span> }
              @if (profileDistrictName()) { <span><mat-icon fontSet="material-icons-outlined" aria-hidden="true">location_on</mat-icon>{{ profileDistrictName() }} · Lima · Lima</span> }
            </div>
            @if (communityNames().length) { <div class="profile-communities" aria-label="Comunidades"><span class="profile-communities__label">Comunidades</span>@for (name of communityNames(); track name) { <span class="community-chip">{{ name }}</span> }</div> }
            @if (profile()?.identityVerified) { <span class="verified-badge"><mat-icon fontSet="material-icons-outlined">verified</mat-icon>Identidad verificada</span> }
            <button class="share-button" type="button" (click)="shareProfile()"><mat-icon fontSet="material-icons-outlined" aria-hidden="true">share</mat-icon>Compartir</button>
          </section>
          <section class="profile-reputation" aria-label="Resumen de calificaciones">
            <div class="reputation-metrics">
              <article class="reputation-metric"><strong><span aria-hidden="true">☆</span>{{ reputation()?.reviewCount ? (reputation()!.averageRating | number:'1.1-1') : '—' }}</strong><span>{{ reputation()?.reviewCount ?? 0 }} {{ reputation()?.reviewCount === 1 ? 'calificación' : 'calificaciones' }}</span></article>
              <article class="reputation-metric"><strong>{{ reputation()?.completedCount ?? 0 }}</strong><span>Operaciones completadas</span><small>Como vendedor y comprador</small></article>
            </div>
            <div class="rating-distribution" aria-label="Distribución de calificaciones">
              @for (star of [5,4,3,2,1]; track star) {
                <div class="rating-row"><span>{{ star }} <span class="rating-row__star" aria-hidden="true">☆</span></span><div class="rating-bar" role="progressbar" [attr.aria-label]="star + ' estrellas'" [attr.aria-valuenow]="ratingCount(star)" [attr.aria-valuemax]="reputation()?.reviewCount ?? 0"><span [style.width.%]="ratingPercentage(star)"></span></div><span>{{ ratingCount(star) }}</span></div>
              }
            </div>
          </section>
          <nav class="profile-tabs" aria-label="Actividad del perfil">
            <button type="button" [class.is-selected]="tab() === 'active'" (click)="tab.set('active')">Activas ({{ listings().length }})</button>
            <button type="button" [class.is-selected]="tab() === 'traded'" (click)="tab.set('traded')">Operaciones (0)</button>
            <button type="button" [class.is-selected]="tab() === 'reviews'" (click)="tab.set('reviews')">Reseñas ({{ reviewsWithComments().length }})</button>
          </nav>
          @if (tab() === 'active') {
            <section class="public-listings"><div class="public-listings__grid">@for (listing of listings(); track listing.id) { <app-listing-card [listing]="listing" [districtName]="districtName(listing)" (detailsRequested)="openListing($event)" /> }</div></section>
          } @else if (tab() === 'reviews' && reviewsWithComments().length) {
            <section class="public-reviews" aria-label="Reseñas recibidas">
              @for (review of reviewsWithComments(); track review.exchangeId + review.participant) {
                <article class="public-review"><div class="review-stars" [attr.aria-label]="review.rating + ' de 5 estrellas'">{{ stars(review.rating) }}</div><strong>{{ review.listingTitle }}</strong>@if (review.review) { <p>{{ review.review }}</p> }<small>{{ review.createdAt | date:'d MMM y' }}</small></article>
              }
            </section>
          } @else {
            <section class="empty-tab"><mat-icon fontSet="material-icons-outlined" aria-hidden="true">{{ tab() === 'reviews' ? 'star_outline' : 'swap_horiz' }}</mat-icon><p>{{ tab() === 'reviews' ? 'Aún no tiene reseñas con comentario.' : 'Aún no tiene operaciones completadas.' }}</p></section>
          }
        </main>
      } @else { <main class="profile-message"><mat-icon fontSet="material-icons-outlined">person_search</mat-icon><h1>Perfil no disponible</h1><p>Este usuario no tiene publicaciones activas.</p><a routerLink="/">Volver a explorar</a></main> }
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:var(--mt-paper,#faf7f1); color:var(--mt-ink,#241d2b); }
    .public-profile-page { width:100%; margin:auto; padding:0 0 56px; }
    main { display:grid; width:min(912px,calc(100% - 36px)); gap:18px; margin:18px auto 0; }
    .profile-message a { display:inline-flex; align-items:center; gap:6px; color:var(--mt-action,#6033bd); text-decoration:none; font-size:13px; }
    .public-profile-card { display:grid; justify-items:center; padding:24px 20px 19px; border:1px solid var(--mt-line,#e8dfd1); border-radius:20px; background:var(--mt-card,#fff); text-align:center; }
    .public-avatar { width:82px; height:82px; border:2px solid color-mix(in srgb,var(--mt-action,#6033bd) 22%,transparent); border-radius:50%; object-fit:cover; }
    .public-avatar--initial { display:grid; place-items:center; background:var(--mt-summary,#f2eafa); color:var(--mt-action,#6033bd); font-size:28px; }
    .profile-communities { display:flex; flex-wrap:wrap; justify-content:center; gap:7px; max-width:560px; margin-top:12px; }
    .profile-communities__label { width:100%; color:var(--mt-muted,#81778b); font-size:11px; }
    .community-chip { padding:6px 11px; border:1px solid var(--mt-line,#e8dfd1); border-radius:999px; background:var(--mt-summary,#f2eafa); color:var(--mt-ink,#241d2b); font-size:11px; font-weight:600; }
    h1 { margin:10px 0 4px; font-size:23px; font-weight:500; } .public-profile-card p { margin:0; color:var(--mt-muted,#81778b); font-size:12px; } .public-profile-card .public-description { max-width:560px; margin-top:10px; color:var(--mt-ink,#241d2b); font-size:13px; line-height:1.6; white-space:pre-wrap; }
    .public-profile-meta { display:flex; flex-wrap:wrap; justify-content:center; gap:5px 14px; margin-top:10px; color:var(--mt-muted,#81778b); font-size:11px; }
    .public-profile-meta > span { display:inline-flex; align-items:center; gap:4px; }
    .public-profile-meta mat-icon { width:15px; height:15px; font-size:15px; }
    .share-button { display:inline-flex; min-height:35px; align-items:center; gap:6px; margin-top:14px; padding:0 13px; border:1px solid var(--mt-line,#e8dfd1); border-radius:999px; background:var(--mt-card,#fff); color:var(--mt-ink,#241d2b); cursor:pointer; font-size:12px; }
    .share-button mat-icon { width:16px; height:16px; font-size:16px; }
    .verified-badge { display:inline-flex; align-items:center; gap:4px; margin-top:9px; padding:4px 9px; border-radius:999px; background:#e9f5ff; color:#0874bd; font-size:11px; font-weight:600; }
    .verified-badge mat-icon { width:15px; height:15px; font-size:15px; }
    .profile-reputation { display:grid; gap:15px; padding:17px 20px; border:1px solid var(--mt-line,#e8dfd1); border-radius:24px; background:var(--mt-card,#fff); }
    .reputation-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .reputation-metric { display:grid; min-height:98px; align-content:center; justify-items:center; gap:5px; padding:12px; border:1px solid var(--mt-line,#e8dfd1); border-radius:18px; background:var(--mt-summary,#f2eafa); text-align:center; }
    .reputation-metric strong { display:flex; align-items:center; gap:7px; font-size:25px; line-height:1; }
    .reputation-metric strong > span, .rating-row__star { color:#ffb33f; font:700 21px/1 Arial,sans-serif; }
    .reputation-metric > span { color:var(--mt-muted,#81778b); font-size:12px; }
    .reputation-metric small { color:var(--mt-muted,#81778b); font-size:11px; }
    .rating-distribution { display:grid; gap:7px; }
    .rating-row { display:grid; grid-template-columns:30px minmax(0,1fr) 24px; align-items:center; gap:9px; color:var(--mt-muted,#81778b); font-size:11px; }
    .rating-row > span:first-child { color:var(--mt-ink,#241d2b); }
    .rating-row__star { font-size:13px; }
    .rating-bar { height:8px; overflow:hidden; border-radius:999px; background:color-mix(in srgb,var(--mt-line,#e8dfd1) 65%,transparent); }
    .rating-bar > span { display:block; height:100%; border-radius:inherit; background:#ffb33f; }
    .profile-tabs { display:flex; gap:4px; padding:5px; border:1px solid var(--mt-line,#e8dfd1); border-radius:999px; background:var(--mt-summary,#f3eee6); }
    .profile-tabs button { min-height:39px; flex:1; border:0; border-radius:999px; background:transparent; color:var(--mt-muted,#81778b); cursor:pointer; font-size:12px; }
    .profile-tabs button.is-selected { background:var(--mt-card,#fff); color:var(--mt-ink,#241d2b); box-shadow:0 2px 8px #241d2b12; }
    .public-listings { min-height:70px; }
    .public-listings__grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),290px)); align-items:start; gap:16px; }
    .empty-tab { display:grid; min-height:130px; align-content:center; justify-items:center; gap:9px; border:1px dashed var(--mt-line,#e8dfd1); border-radius:14px; color:var(--mt-muted,#81778b); text-align:center; }
    .empty-tab mat-icon { color:var(--mt-action,#6033bd); } .empty-tab p { margin:0; font-size:12px; }
    .public-reviews { display:grid; gap:10px; }
    .public-review { display:grid; gap:5px; padding:14px 16px; border:1px solid var(--mt-line,#e8dfd1); border-radius:14px; background:var(--mt-card,#fff); }
    .public-review strong { font-size:13px; } .public-review p { margin:0; font-size:13px; } .public-review small { color:var(--mt-muted,#81778b); font-size:11px; }
    .review-stars { color:#c58200; letter-spacing:2px; }
    .profile-message { display:grid; min-height:50vh; justify-items:center; align-content:center; text-align:center; color:var(--mt-muted,#81778b); }
    @media(max-width:600px) { .profile-reputation { padding:12px; } .reputation-metrics { gap:8px; } .reputation-metric { min-height:86px; padding:8px; } .profile-tabs button { padding-inline:4px; font-size:11px; } .public-listings__grid { grid-template-columns:minmax(0,1fr); } }
  `],
})
export class PublicProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(MarketplaceApiService);
  private readonly auth = inject(AuthService);
  readonly listings = signal<Listing[]>([]);
  readonly profile = signal<PublicProfile | null>(null);
  readonly communityNames = computed(() => {
    const ids = new Set(this.profile()?.communityIds ?? []);
    return [...ids].map((id) => DEMO_COMMUNITIES.find((community) => community.id === id)?.name ?? id.replaceAll('-', ' '));
  });
  readonly profileDistrictName = computed(() => {
    const districtId = this.profile()?.districtId;
    return districtId ? DEMO_DISTRICTS.find((district) => district.id === districtId)?.name ?? districtId : '';
  });
  readonly reputation = signal<PublicReputation | null>(null);
  readonly loading = signal(true);
  readonly tab = signal<'active' | 'traded' | 'reviews'>('active');
  readonly failedAvatarUrl = signal('');
  readonly ownerId = signal('');
  readonly ownerName = computed(() => this.profile()?.displayName || this.listings()[0]?.ownerName || 'Perfil de usuario');
  readonly ownerImageUrl = computed(() => {
    const signedInUser = this.auth.user();
    const firstListing = this.listings()[0];
    if (signedInUser?.id === this.ownerId() && signedInUser.imageUrl) return signedInUser.imageUrl;
    return this.profile()?.imageUrl || firstListing?.ownerImageUrl || '';
  });
  readonly memberSince = computed(() => {
    const date = this.profile()?.memberSince;
    return date ? new Date(date).toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }) : 'fecha reciente';
  });
  private syncedAvatarKey = '';

  constructor() {
    effect(() => {
      const user = this.auth.user();
      const ownerId = this.ownerId();
      if (!user?.imageUrl || user.id !== ownerId) return;
      const key = `${user.id}:${user.imageUrl}`;
      if (this.syncedAvatarKey === key) return;
      this.syncedAvatarKey = key;
      void this.api.syncMyProfileImage(user.imageUrl).catch(() => {
        if (this.syncedAvatarKey === key) this.syncedAvatarKey = '';
      });
    });
    const ownerId = this.route.snapshot.paramMap.get('id');
    if (!ownerId) { this.loading.set(false); return; }
    this.ownerId.set(ownerId);
    void Promise.allSettled([this.api.profile(ownerId), this.api.reputation(ownerId), this.api.listings()]).then(([profile, reputation, listings]) => {
      if (profile.status === 'fulfilled') this.profile.set(profile.value);
      if (reputation.status === 'fulfilled') this.reputation.set(reputation.value);
      if (listings.status === 'fulfilled') this.listings.set(listings.value.filter((listing) => listing.ownerId === ownerId && listing.available !== false && !listing.moderationHidden));
    }).finally(() => this.loading.set(false));
  }

  districtName(listing: Listing): string { return DEMO_DISTRICTS.find((district) => district.id === listing.districtId)?.name ?? listing.districtId; }
  reviewsWithComments(): readonly PublicReview[] { return (this.reputation()?.reviews ?? []).filter((review) => Boolean(review.review?.trim())); }
  ratingCount(star: number): number { return this.reputation()?.reviews.filter((review) => review.rating === star).length ?? 0; }
  ratingPercentage(star: number): number {
    const total = this.reputation()?.reviewCount ?? 0;
    return total ? this.ratingCount(star) / total * 100 : 0;
  }
  stars(rating: number): string { return '★'.repeat(Math.max(0, Math.min(5, rating))) + '☆'.repeat(Math.max(0, 5 - rating)); }
  openListing(listing: Listing): void { window.location.assign(`/producto/${encodeURIComponent(listing.id)}`); }
  shareProfile(): void {
    if (navigator.share) void navigator.share({ title: this.ownerName(), url: window.location.href }).catch(() => undefined);
    else if (navigator.clipboard) void navigator.clipboard.writeText(window.location.href);
  }
}
