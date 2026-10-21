import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DEMO_COMMUNITIES, DEMO_DISTRICTS } from '../../core/data/demo-marketplace.data';
import { MarketplaceApiService } from '../../core/data/marketplace-api.service';
import type { PublicProfile, PublicReputation, ServerExchange, UserAppeal, UserSanction } from '../../core/data/marketplace-api.service';
import type { Listing } from '../../core/models/marketplace.models';
import type { MarketplaceDialogResult } from '../marketplace/dialogs/marketplace-dialog.component';
import { MarketplaceHeaderComponent } from '../marketplace/marketplace-header.component';
import { ListingCardComponent } from '../marketplace/listing-card.component';
import { BrandMarkComponent } from '../marketplace/brand-mark.component';
import { ReportUserDialogComponent } from './report-user-dialog.component';
import type { ReportUserDialogResult } from './report-user-dialog.component';

type AccountTab = 'listings' | 'traded' | 'reviews';
type BlockedAccount = { readonly id: string; readonly name: string };

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, RouterLink, MatDialogModule, MatIconModule, MatSnackBarModule, MarketplaceHeaderComponent, ListingCardComponent, BrandMarkComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(MarketplaceApiService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private loadedUserId: string | null = null;

  readonly user = this.auth.user;
  readonly authStatus = this.auth.status;
  readonly tab = signal<AccountTab>('listings');
  readonly listings = signal<Listing[]>([]);
  readonly exchanges = signal<ServerExchange[]>([]);
  readonly reputation = signal<PublicReputation | null>(null);
  readonly profile = signal<PublicProfile | null>(null);
  readonly communityNames = computed(() => {
    const ids = new Set(this.profile()?.communityIds ?? []);
    return [...ids].map((id) => DEMO_COMMUNITIES.find((community) => community.id === id)?.name ?? id.replaceAll('-', ' '));
  });
  readonly profileDistrictName = computed(() => {
    const districtId = this.profile()?.districtId;
    return districtId ? DEMO_DISTRICTS.find((district) => district.id === districtId)?.name ?? districtId : '';
  });
  readonly memberSinceLabel = computed(() => {
    const date = this.profile()?.memberSince;
    return date ? new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(new Date(date)) : '';
  });
  readonly reputationLoadFailed = signal(false);
  readonly reputationLoading = signal(false);
  readonly blockedAccounts = signal<BlockedAccount[]>([]);
  readonly activeSanctions = signal<UserSanction[]>([]);
  readonly displayedSanctions = computed(() => {
    const byType = new Map<UserSanction['restrictionType'], UserSanction>();
    for (const sanction of this.activeSanctions()) {
      const current = byType.get(sanction.restrictionType);
      if (!current || new Date(sanction.startsAt).getTime() > new Date(current.startsAt).getTime()) byType.set(sanction.restrictionType, sanction);
    }
    return [...byType.values()];
  });
  readonly accountAppeals = signal<UserAppeal[]>([]);
  readonly appealDraft = signal('');
  readonly appealBusyId = signal<string | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly failedAvatarUrl = signal('');
  readonly deletingListingId = signal<string | null>(null);
  readonly unblockingUserId = signal<string | null>(null);

  constructor() {
    this.tab.set('listings');
    effect(() => {
      const user = this.user();
      if (!user) {
        this.loadedUserId = null;
        this.loading.set(false);
        this.listings.set([]);
        this.exchanges.set([]);
        this.reputation.set(null);
        this.profile.set(null);
        this.reputationLoadFailed.set(false);
        this.reputationLoading.set(false);
        this.blockedAccounts.set([]);
        this.activeSanctions.set([]);
        this.accountAppeals.set([]);
        return;
      }
      if (this.loadedUserId === user.id) return;
      this.loadedUserId = user.id;
      void this.loadActivity();
      void this.loadProfile(user.id);
      void this.loadReputation(user.id);
      void this.loadBlockedAccounts(user.id);
      void this.loadSanctionsAndAppeals(user.id);
    });
  }

  private async loadProfile(userId: string): Promise<void> {
    try {
      const profile = await this.api.profile(userId);
      if (this.user()?.id === userId) this.profile.set(profile);
    } catch { /* El resumen de cuenta puede mostrarse aunque el perfil no esté disponible. */ }
  }

  private async loadSanctionsAndAppeals(userId: string): Promise<void> {
    try {
      const [sanctions, appeals] = await Promise.all([this.api.mySanctions(), this.api.myAppeals()]);
      if (this.user()?.id === userId) { this.activeSanctions.set(sanctions); this.accountAppeals.set(appeals); }
    } catch { /* La consulta de medidas no bloquea la carga del perfil. */ }
  }

  async submitAppeal(sanction: UserSanction): Promise<void> {
    const explanation = this.appealDraft().trim();
    if (!explanation || this.appealBusyId()) return;
    this.appealBusyId.set(sanction.id);
    try {
      const appeal = await this.api.appealSanction(sanction.id, explanation);
      this.accountAppeals.update((items) => [appeal, ...items]);
      this.appealDraft.set('');
      this.snackBar.open('Apelación enviada para revisión.', 'Cerrar', { duration: 3500 });
    } catch (error) { this.snackBar.open(error instanceof Error ? error.message : 'No se pudo enviar la apelación.', 'Cerrar', { duration: 5000 }); }
    finally { this.appealBusyId.set(null); }
  }

  reportReview(review: import('../../core/data/marketplace-api.service').PublicReview): void {
    this.dialog.open(ReportUserDialogComponent, {
      data: { name: review.listingTitle, title: 'Reportar reseña', prompt: '¿Qué problema tiene la reseña de la operación' },
      panelClass: ['monkeytrueque-dialog', 'report-user-dialog'], width: 'min(500px, calc(100vw - 28px))', maxWidth: '500px', autoFocus: false,
    }).afterClosed().subscribe((result: ReportUserDialogResult | undefined) => {
      if (!result) return;
      const evidence = `Reseña ${review.rating}/5 en ${review.listingTitle}: ${review.review || '(sin comentario)'}; operación ${review.exchangeId}.`;
      void this.api.report(review.listingId, result.reason, result.details, { type: 'review', id: `${review.exchangeId}:${review.participant}`, evidence, attachments: result.attachments })
        .then(() => this.snackBar.open('Reseña reportada para revisión.', 'Cerrar', { duration: 3500 }))
        .catch((error) => this.snackBar.open(error instanceof Error ? error.message : 'No se pudo reportar la reseña.', 'Cerrar', { duration: 5000 }));
    });
  }

  hasOpenAppeal(sanctionId: string): boolean { return this.accountAppeals().some((appeal) => appeal.sanctionId === sanctionId && appeal.status === 'open'); }

  async loadActivity(): Promise<void> {
    const userId = this.user()?.id;
    if (!userId) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const [listings, exchanges] = await Promise.allSettled([this.api.myListings(), this.api.exchanges()]);
      if (this.user()?.id !== userId) return;
      if (listings.status === 'fulfilled') this.listings.set(listings.value);
      if (exchanges.status === 'fulfilled') this.exchanges.set(exchanges.value);
      if (listings.status === 'rejected' || exchanges.status === 'rejected') {
        this.error.set('No pudimos cargar tus publicaciones o intercambios. Comprueba los servicios e inténtalo de nuevo.');
      }
    } finally {
      if (this.user()?.id === userId) this.loading.set(false);
    }
  }

  async loadReputation(userId = this.user()?.id): Promise<void> {
    if (!userId) return;
    this.reputationLoading.set(true);
    this.reputationLoadFailed.set(false);
    try {
      const result = await this.api.reputation(userId);
      if (this.user()?.id === userId) this.reputation.set(result);
    } catch {
      if (this.user()?.id === userId) this.reputationLoadFailed.set(true);
    } finally {
      if (this.user()?.id === userId) this.reputationLoading.set(false);
    }
  }

  private async loadBlockedAccounts(userId: string): Promise<void> {
    try {
      const blocked = await this.api.blockedUsers();
      const profiles = await Promise.all(blocked.map(async (id) => {
        try { return { id, name: (await this.api.profile(id)).displayName || 'Usuario de MonkeyTrueque' }; }
        catch { return { id, name: 'Usuario de MonkeyTrueque' }; }
      }));
      if (this.user()?.id === userId) this.blockedAccounts.set(profiles);
    } catch {
      // La lista de bloqueados es independiente de las publicaciones y las reseñas.
    }
  }

  async signIn(): Promise<void> {
    try { await this.auth.openSignIn(); }
    catch { this.error.set('No se pudo abrir el inicio de sesión.'); }
  }

  editProfile(): void { void this.router.navigate(['/cuenta/configuracion']); }

  async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
      await this.router.navigate(['/']);
    } catch { this.error.set('No se pudo cerrar la sesión.'); }
  }

  async openPublish(): Promise<void> {
    const user = this.user();
    if (!user) { await this.signIn(); return; }
    await this.router.navigate(['/publicar'], { queryParams: { district: 'surquillo' } });
  }

  async editListing(listing: Listing): Promise<void> {
    if (!listing.available || listing.moderationHidden) return;
    const user = this.user();
    if (!user) { await this.signIn(); return; }
    const { MarketplaceDialogComponent } = await import('../marketplace/dialogs/marketplace-dialog.component');
    const ref = this.dialog.open(MarketplaceDialogComponent, {
      data: { mode: 'edit', listing, districts: DEMO_DISTRICTS, selectedDistrictId: listing.districtId, ownerName: user.name },
      width: 'min(560px, calc(100vw - 28px))', maxWidth: '560px', maxHeight: 'min(88vh, 850px)',
      panelClass: ['monkeytrueque-dialog'], autoFocus: 'first-tabbable', restoreFocus: true,
    });
    ref.afterClosed().subscribe((result: MarketplaceDialogResult | undefined) => {
      if (result?.type !== 'updated') return;
      this.listings.update((items) => items.map((item) => item.id === result.listing.id ? result.listing : item));
      this.snackBar.open('Cambios guardados.', 'Cerrar', { duration: 3200 });
    });
  }

  async deleteListing(listing: Listing): Promise<void> {
    if (!window.confirm(`¿Eliminar “${listing.title}”? Esta acción también borrará su foto.`)) return;
    this.deletingListingId.set(listing.id);
    this.error.set('');
    try {
      await this.api.deleteListing(listing.id);
      this.listings.update((items) => items.filter((item) => item.id !== listing.id));
      this.snackBar.open('Publicación eliminada.', 'Cerrar', { duration: 3200 });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo eliminar la publicación. Inténtalo otra vez.');
    } finally {
      this.deletingListingId.set(null);
    }
  }

  async unblockUser(account: BlockedAccount): Promise<void> {
    this.unblockingUserId.set(account.id);
    try {
      await this.api.unblockUser(account.id);
      this.blockedAccounts.update((items) => items.filter((item) => item.id !== account.id));
      this.snackBar.open(`${account.name} ya puede volver a contactarte.`, 'Cerrar', { duration: 3500 });
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : 'No se pudo desbloquear a esta persona.', 'Cerrar', { duration: 5000 });
    } finally { this.unblockingUserId.set(null); }
  }

  openListing(listing: Listing): void { void this.router.navigate(['/producto', listing.id]); }

  avatarInitials(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }

  districtName(id: string): string { return DEMO_DISTRICTS.find((district) => district.id === id)?.name ?? id; }
  listingStatus(listing: Listing): string {
    if (listing.moderationHidden) return 'Oculta';
    return listing.available === false ? 'Intercambiada' : 'Disponible';
  }
  completedCount(): number { return this.reputation()?.completedCount ?? 0; }

  activeListings(): Listing[] { return this.listings().filter((listing) => listing.available !== false && !listing.moderationHidden); }
  tradedListings(): Listing[] { return this.listings().filter((listing) => listing.available === false && !listing.moderationHidden); }
  tabListings(): Listing[] { return this.tab() === 'traded' ? this.tradedListings() : this.activeListings(); }

  receivedReviews(): readonly import('../../core/data/marketplace-api.service').PublicReview[] {
    return (this.reputation()?.reviews ?? []).filter((review) => Boolean(review.review?.trim()));
  }

  private receivedRatings(): number[] {
    const userId = this.user()?.id;
    if (!userId) return [];
    return this.exchanges().flatMap((exchange) => {
      const otherRole = exchange.ownerId === userId ? 'proposer' : 'owner';
      const rating = exchange.ratings[otherRole]?.rating;
      return typeof rating === 'number' ? [rating] : [];
    });
  }

  reviewCount(): number { return this.reputation()?.reviewCount ?? 0; }

  ratingCount(star: number): number { return this.reputation()?.reviews.filter((review) => review.rating === star).length ?? 0; }

  ratingPercentage(star: number): number {
    const total = this.reviewCount();
    return total ? this.ratingCount(star) / total * 100 : 0;
  }

  averageRating(): string {
    return this.reviewCount() ? this.reputation()!.averageRating.toFixed(1) : '—';
  }
}
