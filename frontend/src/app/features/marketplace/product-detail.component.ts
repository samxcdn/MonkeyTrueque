import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Store } from '@ngrx/store';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { MarketplaceApiService } from '../../core/data/marketplace-api.service';
import type { PublicProfile, PublicReputation } from '../../core/data/marketplace-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AdminApiService } from '../../core/data/admin-api.service';
import { DEMO_DISTRICTS } from '../../core/data/demo-marketplace.data';
import type { AppState, DistrictSelection, Listing, ListingKind } from '../../core/models/marketplace.models';
import * as MarketplaceActions from './state/marketplace.actions';
import { selectDistricts, selectFilters, selectListings, selectSelectedDistrictId } from './state/marketplace.selectors';
import { ListingCardComponent } from './listing-card.component';
import { MarketplaceHeaderComponent } from './marketplace-header.component';
import { BrandMarkComponent } from './brand-mark.component';

const pendingActionKey = 'monkeytrueque.pendingAction';
const likedListingsKey = 'monkeytrueque.likedListings';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatSnackBarModule, ListingCardComponent, MarketplaceHeaderComponent, BrandMarkComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pageTitle = inject(Title);
  private readonly api = inject(MarketplaceApiService);
  private readonly auth = inject(AuthService);
  private readonly adminApi = inject(AdminApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly store = inject(Store<AppState>);
  private readonly listings = this.store.selectSignal(selectListings);
  readonly districts = this.store.selectSignal(selectDistricts);
  readonly filters = this.store.selectSignal(selectFilters);
  readonly selectedDistrictId = this.store.selectSignal(selectSelectedDistrictId);
  readonly currentUser = this.auth.user;
  readonly darkMode = signal(false);
  readonly isAdmin = signal(false);
  readonly sellerProfile = signal<PublicProfile | null>(null);
  readonly sellerReputation = signal<PublicReputation | null>(null);

  readonly listingId = signal('');
  readonly listing = computed(() => this.listings().find((item) => item.id === this.listingId()) ?? null);
  readonly sellerImageUrl = computed(() => {
    const item = this.listing();
    const user = this.auth.user();
    return user?.id === item?.ownerId && user?.imageUrl ? user.imageUrl : item?.ownerImageUrl ?? '';
  });
  readonly similarListings = computed(() => {
    const current = this.listing();
    if (!current) return [];
    const available = this.listings().filter((item) => item.id !== current.id && item.available !== false && !item.moderationHidden);
    const sameCategory = available.filter((item) => item.category === current.category);
    const sameDistrict = available.filter((item) => item.districtId === current.districtId);
    const ordered = [
      ...sameCategory.filter((item) => item.districtId === current.districtId),
      ...sameCategory.filter((item) => item.districtId !== current.districtId),
      ...sameDistrict.filter((item) => item.category !== current.category),
      ...available.filter((item) => item.category !== current.category && item.districtId !== current.districtId),
    ];
    return ordered.slice(0, 4);
  });
  readonly selectedPhoto = signal(0);
  readonly liked = signal(false);
  readonly zoomOpen = signal(false);
  readonly magnifier = signal({ visible: false, origin: '50% 50%' });
  readonly loading = signal(true);
  readonly loadError = signal('');
  private syncedAvatarKey = '';

  constructor() {
    this.darkMode.set(localStorage.getItem('monkeytrueque.theme') === 'dark');
    document.documentElement.classList.toggle('marketplace-dark', this.darkMode());
    effect(() => {
      const item = this.listing();
      if (item?.title) this.pageTitle.setTitle(item.title);
      if (item) this.liked.set(this.savedLikes().includes(item.id));
    });
    effect(() => {
      const user = this.currentUser();
      this.isAdmin.set(false);
      if (user) void this.adminApi.isAdmin().then((allowed) => {
        if (this.currentUser()?.id === user.id) this.isAdmin.set(allowed);
      }).catch(() => undefined);
    });
    effect(() => {
      const item = this.listing();
      const user = this.auth.user();
      if (!item || !user?.imageUrl || user.id !== item.ownerId) return;
      const key = `${user.id}:${user.imageUrl}`;
      if (key === this.syncedAvatarKey) return;
      this.syncedAvatarKey = key;
      void this.api.syncMyProfileImage(user.imageUrl).then(async () => {
        const refreshed = await this.api.listings();
        this.store.dispatch(MarketplaceActions.setListings({ listings: refreshed }));
      }).catch(() => {
        if (this.syncedAvatarKey === key) this.syncedAvatarKey = '';
      });
    });
    effect(() => {
      const item = this.listing();
      const ownerId = item?.ownerId;
      this.sellerProfile.set(null);
      this.sellerReputation.set(null);
      if (!ownerId) return;
      void Promise.all([
        this.api.profile(ownerId).catch(() => null),
        this.api.reputation(ownerId).catch(() => null),
      ]).then(([profile, reputation]) => {
        if (this.listing()?.ownerId !== ownerId) return;
        this.sellerProfile.set(profile);
        this.sellerReputation.set(reputation);
      });
    });
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id') ?? '';
      this.listingId.set(id);
      this.selectedPhoto.set(0);
      this.zoomOpen.set(false);
      this.magnifier.update((lens) => ({ ...lens, visible: false }));
      this.loadError.set('');
      if (!id) {
        this.loading.set(false);
        return;
      }
      if (this.listing()) {
        this.loading.set(false);
        return;
      }
      void this.loadListing(id);
    });
  }

  async loadListing(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const listings = await this.api.listings();
      if (this.listingId() !== id) return;
      this.store.dispatch(MarketplaceActions.setListings({ listings }));
      if (!listings.some((item) => item.id === id)) this.loadError.set('No encontramos esta publicación. Puede que ya no esté disponible.');
    } catch (error) {
      if (this.listingId() === id) this.loadError.set(error instanceof Error ? error.message : 'No se pudo cargar esta publicación.');
    } finally {
      if (this.listingId() === id) this.loading.set(false);
    }
  }

  photoSrc(listing: Listing): string { return listing.photos[this.selectedPhoto()]?.src ?? listing.photos[0]?.src ?? ''; }
  setQuery(query: string): void { this.store.dispatch(MarketplaceActions.setQuery({ query })); }
  selectDistrict(districtId: DistrictSelection): void { this.store.dispatch(MarketplaceActions.setDistrict({ districtId })); }
  toggleTheme(): void {
    const enabled = !this.darkMode();
    this.darkMode.set(enabled);
    document.documentElement.classList.toggle('marketplace-dark', enabled);
    localStorage.setItem('monkeytrueque.theme', enabled ? 'dark' : 'light');
  }
  avatarInitials(name: string): string { return name.trim().charAt(0).toUpperCase() || '?'; }
  sellerRatingLabel(rating: number): string { return rating >= 4.5 ? 'Excelente' : rating >= 4 ? 'Muy buena' : rating >= 3 ? 'Buena' : 'En desarrollo'; }
  sellerMemberDuration(): string {
    const sinceValue = this.sellerProfile()?.memberSince;
    if (!sinceValue) return '—';
    const since = new Date(sinceValue);
    if (Number.isNaN(since.getTime())) return '—';
    const today = new Date();
    let months = (today.getFullYear() - since.getFullYear()) * 12 + today.getMonth() - since.getMonth();
    if (today.getDate() < since.getDate()) months -= 1;
    if (months < 1) return 'Menos de un mes';
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const duration: string[] = [];
    if (years) duration.push(`${years} ${years === 1 ? 'año' : 'años'}`);
    if (remainingMonths) duration.push(`${remainingMonths} ${remainingMonths === 1 ? 'mes' : 'meses'}`);
    return duration.join(' y ');
  }
  photoAlt(listing: Listing): string { return listing.photos[this.selectedPhoto()]?.alt ?? listing.title; }
  selectPhoto(index: number): void { this.selectedPhoto.set(index); this.magnifier.update((lens) => ({ ...lens, visible: false })); }
  closeZoom(): void { this.zoomOpen.set(false); }
  togglePhotoZoom(): void { this.magnifier.update((zoom) => ({ ...zoom, visible: !zoom.visible, origin: '50% 50%' })); }
  toggleLike(): void {
    const item = this.listing();
    if (!item) return;
    if (!this.currentUser()) {
      void this.auth.openSignIn(`/producto/${item.id}`);
      return;
    }
    const likes = this.savedLikes();
    const updated = this.liked() ? likes.filter((id) => id !== item.id) : [...likes, item.id];
    try { localStorage.setItem(likedListingsKey, JSON.stringify(updated)); } catch { return; }
    this.liked.set(!this.liked());
  }
  private savedLikes(): string[] {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(likedListingsKey) ?? '[]');
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  }
  moveMagnifier(event: MouseEvent): void {
    const image = event.currentTarget as HTMLImageElement;
    if (!this.magnifier().visible || this.zoomOpen() || !image.complete || !image.naturalWidth || !image.naturalHeight) return;
    const frame = image.parentElement!.getBoundingClientRect();
    const scale = Math.min(image.clientWidth / image.naturalWidth, image.clientHeight / image.naturalHeight);
    const shownWidth = image.naturalWidth * scale;
    const shownHeight = image.naturalHeight * scale;
    const imageOffsetX = (image.clientWidth - shownWidth) / 2;
    const imageOffsetY = (image.clientHeight - shownHeight) / 2;
    const pointerX = event.clientX - frame.left - image.offsetLeft;
    const pointerY = event.clientY - frame.top - image.offsetTop;
    if (pointerX < imageOffsetX || pointerX > imageOffsetX + shownWidth || pointerY < imageOffsetY || pointerY > imageOffsetY + shownHeight) {
      this.magnifier.update((lens) => ({ ...lens, visible: false }));
      return;
    }
    const focusX = pointerX - imageOffsetX;
    const focusY = pointerY - imageOffsetY;
    this.magnifier.set({
      visible: true,
      origin: `${((imageOffsetX + focusX) / image.clientWidth) * 100}% ${((imageOffsetY + focusY) / image.clientHeight) * 100}%`,
    });
  }
  hideMagnifier(): void { this.magnifier.update((lens) => ({ ...lens, visible: false })); }
  previousPhoto(listing: Listing): void { this.selectedPhoto.update((index) => (index - 1 + listing.photos.length) % listing.photos.length); }
  nextPhoto(listing: Listing): void { this.selectedPhoto.update((index) => (index + 1) % listing.photos.length); }
  @HostListener('document:keydown.escape') onEscape(): void { this.closeZoom(); }
  @HostListener('document:keydown.arrowleft') onArrowLeft(): void { if (this.zoomOpen() && (this.listing()?.photos.length ?? 0) > 1) this.previousPhoto(this.listing()!); }
  @HostListener('document:keydown.arrowright') onArrowRight(): void { if (this.zoomOpen() && (this.listing()?.photos.length ?? 0) > 1) this.nextPhoto(this.listing()!); }
  districtName(listing: Listing): string { return DEMO_DISTRICTS.find((district) => district.id === listing.districtId)?.name ?? listing.districtId; }
  kindLabel(kind: ListingKind): string { return kind === 'service' ? 'Servicio' : 'Objeto'; }
  modeLabel(listing: Listing): string { return ({ trade: 'Trueque', sale: 'Venta', gift: 'Regalo' } as const)[listing.mode ?? 'trade']; }

  contactSeller(): void {
    this.saveAction({ type: 'contact', listingId: this.listingId() });
    if (!this.currentUser()) {
      void this.auth.openSignIn();
      return;
    }
    void this.router.navigate(['/']);
  }

  openSimilar(listing: Listing): void {
    void this.router.navigate(['/producto', listing.id]);
  }

  report(): void {
    this.reportListing(this.listingId());
  }

  reportListing(listingId: string): void {
    this.saveAction({ type: 'report', listingId });
    void this.router.navigate(['/']);
  }

  private saveAction(action: { type: 'contact' | 'report'; listingId: string }): void {
    try { sessionStorage.setItem(pendingActionKey, JSON.stringify(action)); } catch { /* Keep the detail page available when storage is disabled. */ }
  }
}
