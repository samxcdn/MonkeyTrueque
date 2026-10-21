import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, HostListener, computed, effect, signal, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Store } from '@ngrx/store';
import { AuthService } from '../../core/auth/auth.service';
import { MarketplaceApiService } from '../../core/data/marketplace-api.service';
import { UnreadMessagesService } from '../../core/data/unread-messages.service';
import { BrandMarkComponent } from './brand-mark.component';
import { ListingCardComponent } from './listing-card.component';
import type { MarketplaceDialogData, MarketplaceDialogResult } from './dialogs/marketplace-dialog.component';
import type { AcceptedKind, AppState, DistrictId, DistrictSelection, Listing, ListingCategory, ListingKind } from '../../core/models/marketplace.models';

type PendingDemoAction = { readonly type: 'publish' } | { readonly type: 'proposal'; readonly listingId: string } | { readonly type: 'contact'; readonly listingId: string } | { readonly type: 'report'; readonly listingId?: string };
type TourStep = { readonly target: string; readonly title: string; readonly description: string };
const pendingActionKey = 'monkeytrueque.pendingAction';
import * as MarketplaceActions from './state/marketplace.actions';
import { selectDistricts, selectFilters, selectListings, selectSelectedDistrict, selectSelectedDistrictId } from './state/marketplace.selectors';

@Component({
  selector: 'app-marketplace-home',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, RouterLinkActive, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, CdkConnectedOverlay, CdkOverlayOrigin, MatSelectModule, MatSnackBarModule, BrandMarkComponent, ListingCardComponent],
  templateUrl: './marketplace-home.component.html',
  styleUrl: './marketplace-home.component.scss',
})
export class MarketplaceHomeComponent implements AfterViewInit {
  private readonly store = inject(Store<AppState>);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly api = inject(MarketplaceApiService);
  private readonly router = inject(Router);
  private destroyed = false;
  private previousUserId: string | null = null;
  private syncedAvatarKey = '';
  private tourScheduledUserId = '';
  private pendingDemoAction: PendingDemoAction | null = null;
  readonly districts = this.store.selectSignal(selectDistricts);
  readonly allListings = this.store.selectSignal(selectListings);
  readonly selectedDistrict = this.store.selectSignal(selectSelectedDistrict);
  readonly selectedDistrictId = this.store.selectSignal(selectSelectedDistrictId);
  readonly filters = this.store.selectSignal(selectFilters);
  readonly modeFilter = signal<'all' | 'sale' | 'trade' | 'gift'>('all');
  readonly visibleListings = computed(() => {
    const districtId = this.selectedDistrictId();
    return this.allListings().filter((listing) => {
      if (districtId !== 'all' && listing.districtId !== districtId) return false;
      if (this.modeFilter() !== 'all' && (listing.mode ?? 'trade') !== this.modeFilter()) return false;
      return true;
    }).sort((first, second) => first.distanceKm - second.distanceKm);
  });
  readonly homeListings = computed(() => this.visibleListings().slice(0, 10));
  readonly visibleCount = computed(() => this.visibleListings().length);
  readonly showMobileMenu = signal(false);
  readonly districtPickerOpen = signal(false);
  readonly accountMenuOpen = signal(false);
  readonly accountMenuPositions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 12 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -12 },
  ];
  readonly districtSearchOpen = signal(false);
  readonly draftDistrictId = signal<DistrictSelection>('all');
  readonly districtSearch = signal('');
  readonly filteredDistricts = computed(() => {
    const query = this.districtSearch().trim().toLocaleLowerCase('es-PE');
    return this.districts().filter((district) => district.name.toLocaleLowerCase('es-PE').includes(query));
  });
  readonly darkMode = signal(false);
  readonly tourOpen = signal(false);
  readonly tourViewReady = signal(false);
  readonly tourStep = signal(0);
  readonly tourRect = signal({ top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0, viewportWidth: 0, viewportHeight: 0, cardLeft: 12, cardTop: 90 });
  readonly tourSteps: readonly TourStep[] = [
    { target: 'tour-search', title: 'Busca lo que necesitas', description: 'Escribe el nombre de un objeto, servicio o persona para encontrar publicaciones.' },
    { target: 'tour-district', title: 'Elige tu zona', description: 'Explora publicaciones de todos los distritos o filtra por el lugar que te quede cerca.' },
    { target: 'tour-publish', title: 'Publica algo', description: 'Sube fotos, agrega una descripción y elige si quieres hacer un trueque, vender o regalar.' },
    { target: 'tour-filters', title: 'Explora y filtra', description: 'Usa las categorías y los filtros para encontrar publicaciones que te interesen.' },
  ];
  readonly currentUser = this.auth.user;
  readonly authStatus = this.auth.status;
  readonly failedAvatarUrl = signal('');
  readonly unreadMessages = inject(UnreadMessagesService);
  readonly searchControl = new FormControl('', { nonNullable: true });

  constructor() {
    this.setDarkMode(localStorage.getItem('monkeytrueque.theme') === 'dark', false);
    this.destroyRef.onDestroy(() => { this.destroyed = true; });
    void this.loadListings();
    const refresh = window.setInterval(() => void this.loadListings(true), 15000);
    this.destroyRef.onDestroy(() => window.clearInterval(refresh));
    effect(() => {
      const user = this.currentUser();
      if (this.previousUserId && this.previousUserId !== user?.id) {
        queueMicrotask(() => {
          if (this.destroyed) return;
          this.resetLocalDemoState();
          void this.loadListings();
        });
      }
      this.previousUserId = user?.id ?? null;
      if (!user) return;
      void this.api.syncMyProfile(user.name, user.imageUrl).catch(() => undefined);
      if (user.imageUrl) {
        const avatarKey = `${user.id}:${user.imageUrl}`;
        if (this.syncedAvatarKey !== avatarKey) {
          this.syncedAvatarKey = avatarKey;
          void this.api.syncMyProfileImage(user.imageUrl).then(() => this.loadListings(true)).catch(() => {
            if (this.syncedAvatarKey === avatarKey) this.syncedAvatarKey = '';
          });
        }
      }
      const action = this.takePendingAction();
      if (!action) return;
      queueMicrotask(() => {
        if (this.destroyed) return;
        if (action.type === 'publish') this.openPublish();
        if (action.type === 'proposal' || action.type === 'contact') void this.startConversation(action.listingId);
        if (action.type === 'report') {
          const listing = this.allListings().find((item) => item.id === action.listingId);
          this.openReport(listing, action.listingId);
        }
      });
    });
    effect((onCleanup) => {
      const userId = this.currentUser()?.id;
      if (!userId || !this.tourViewReady() || this.tourScheduledUserId === userId) return;
      const key = `monkeytrueque.tour.completed.${userId}`;
      try { if (localStorage.getItem(key) === 'true') return; } catch { /* El recorrido sigue disponible en esta sesión. */ }
      this.tourScheduledUserId = userId;
      const timer = window.setTimeout(() => {
        if (!this.destroyed && this.currentUser()?.id === userId) this.startTour();
      }, 900);
      onCleanup(() => window.clearTimeout(timer));
    });
  }

  async ngAfterViewInit(): Promise<void> {
    this.removeMascotBackground();
    const { gsap } = await import('gsap');
    if (this.destroyed) return;
    const media = gsap.matchMedia(this.host.nativeElement);
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const intro = gsap.timeline({ defaults: { ease: 'power2.out' } });
      const heroTitle = this.host.nativeElement.querySelector('.district-hero__copy h1');
      const heroVisual = this.host.nativeElement.querySelector('.district-hero__visual');
      if (heroTitle) intro.from(heroTitle, { autoAlpha: 0, y: 14, duration: 0.48 });
      if (heroVisual) intro.from(heroVisual, { autoAlpha: 0, y: 12, duration: 0.4 }, '-=0.24');
      return () => intro.kill();
    });
    this.destroyRef.onDestroy(() => media.revert());
    this.tourViewReady.set(true);
  }

  private removeMascotBackground(): void {
    const image = this.host.nativeElement.querySelector('.district-hero__scene') as HTMLImageElement | null;
    if (!image) return;
    // Pixel-by-pixel background removal is too expensive on phones. Blend the
    // original white backdrop into the hero gradient there and reveal it now.
    if (window.matchMedia('(max-width: 680px)').matches) {
      image.classList.add('is-visible');
      return;
    }
    const process = (): void => {
      if (!image.naturalWidth || !image.naturalHeight) return;
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) { image.classList.add('is-visible'); return; }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = pixels;
      const size = width * height;
      const stack = new Int32Array(size);
      const visited = new Uint8Array(size);
      let stackSize = 0;
      const isBackground = (index: number): boolean => {
        const offset = index * 4;
        const red = data[offset], green = data[offset + 1], blue = data[offset + 2];
        return Math.min(red, green, blue) >= 205 && Math.max(red, green, blue) - Math.min(red, green, blue) <= 38;
      };
      const seed = (index: number): void => {
        if (visited[index] || !isBackground(index)) return;
        visited[index] = 1;
        data[index * 4 + 3] = 0;
        stack[stackSize++] = index;
      };
      for (let x = 0; x < width; x++) { seed(x); seed((height - 1) * width + x); }
      for (let y = 1; y < height - 1; y++) { seed(y * width); seed(y * width + width - 1); }
      while (stackSize) {
        const index = stack[--stackSize];
        const x = index % width;
        if (x > 0) seed(index - 1);
        if (x + 1 < width) seed(index + 1);
        if (index >= width) seed(index - width);
        if (index + width < size) seed(index + width);
      }
      context.putImageData(pixels, 0, 0);
      image.onload = null;
      image.classList.add('is-visible');
      image.src = canvas.toDataURL('image/png');
    };
    image.addEventListener('error', () => image.classList.add('is-visible'), { once: true });
    if (image.complete) process();
    else image.addEventListener('load', process, { once: true });
  }

  selectDistrict(districtId: DistrictSelection): void {
    this.store.dispatch(MarketplaceActions.setDistrict({ districtId }));
    this.searchControl.setValue('', { emitEvent: false });
    this.store.dispatch(MarketplaceActions.setQuery({ query: '' }));
    this.showMobileMenu.set(false);
  }

  openDistrictPicker(): void {
    this.draftDistrictId.set(this.selectedDistrictId());
    this.districtSearch.set('');
    this.districtSearchOpen.set(false);
    this.districtPickerOpen.set(true);
  }
  closeDistrictPicker(): void { this.districtPickerOpen.set(false); }
  closeDistrictSearch(): void { this.districtSearchOpen.set(false); }
  clearDistrictSearch(): void { this.districtSearch.set(''); }
  @HostListener('document:keydown.escape')
  closeDistrictPickerOnEscape(): void { if (this.districtPickerOpen()) this.closeDistrictPicker(); this.closeAccountMenu(); }
  applyDistrictSelection(): void {
    this.selectDistrict(this.draftDistrictId());
    this.closeDistrictPicker();
  }
  draftDistrictLabel(): string {
    const id = this.draftDistrictId();
    return id === 'all' ? 'Todos los distritos' : this.districts().find((district) => district.id === id)?.name ?? 'Elige tu distrito';
  }

  selectCategory(category: ListingCategory | 'all'): void { this.store.dispatch(MarketplaceActions.setCategory({ category })); }
  selectListingKind(kind: ListingKind | 'all'): void { this.store.dispatch(MarketplaceActions.setListingKind({ kind })); }
  selectAcceptedKind(accepts: AcceptedKind | 'all'): void { this.store.dispatch(MarketplaceActions.setAcceptedKind({ accepts })); }
  toggleModeFilter(mode: 'sale' | 'trade' | 'gift'): void {
    this.modeFilter.set(this.modeFilter() === mode ? 'all' : mode);
  }
  setModeFilter(mode: 'all' | 'sale' | 'trade' | 'gift'): void { this.modeFilter.set(mode); }
  selectedDistrictLabel(): string { return this.selectedDistrictId() === 'all' ? 'Todos los distritos' : this.selectedDistrict().name; }
  selectedDistrictForPublish(): DistrictId | undefined {
    const districtId = this.selectedDistrictId();
    return districtId === 'all' ? undefined : districtId;
  }
  districtName(districtId: DistrictId): string { return this.districts().find((district) => district.id === districtId)?.name ?? ''; }

  clearFilters(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.store.dispatch(MarketplaceActions.setQuery({ query: '' }));
    this.store.dispatch(MarketplaceActions.setCategory({ category: 'all' }));
    this.store.dispatch(MarketplaceActions.setListingKind({ kind: 'all' }));
    this.store.dispatch(MarketplaceActions.setAcceptedKind({ accepts: 'all' }));
    this.modeFilter.set('all');
  }

  toggleMobileMenu(): void { this.showMobileMenu.update((current) => !current); }
  toggleTheme(): void { this.setDarkMode(!this.darkMode()); }
  private setDarkMode(enabled: boolean, persist = true): void {
    this.darkMode.set(enabled);
    document.documentElement.classList.toggle('marketplace-dark', enabled);
    if (persist) localStorage.setItem('monkeytrueque.theme', enabled ? 'dark' : 'light');
  }
  currentTourStep(): TourStep { return this.tourSteps[this.tourStep()]; }
  startTour(): void {
    this.tourStep.set(0);
    this.tourOpen.set(true);
    this.focusTourTarget(true);
  }
  advanceTour(direction: number): void {
    const next = this.tourStep() + direction;
    if (next < 0) return;
    if (next >= this.tourSteps.length) { this.finishTour(); return; }
    this.tourStep.set(next);
    this.focusTourTarget(true);
  }
  finishTour(): void {
    this.tourOpen.set(false);
    const userId = this.currentUser()?.id;
    if (userId) {
      try { localStorage.setItem(`monkeytrueque.tour.completed.${userId}`, 'true'); } catch { /* No volver a abrir el recorrido durante esta sesión. */ }
    }
  }
  @HostListener('window:resize') onWindowResize(): void { if (this.tourOpen()) this.updateTourRect(); }
  @HostListener('window:scroll') onWindowScroll(): void { if (this.tourOpen()) this.updateTourRect(); }
  private focusTourTarget(scroll: boolean): void {
    const target = this.host.nativeElement.querySelector(`#${this.currentTourStep().target}`) as HTMLElement | null;
    if (!target) { this.finishTour(); return; }
    if (scroll) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.setTimeout(() => { if (this.tourOpen()) this.updateTourRect(); }, scroll ? 320 : 0);
  }
  private updateTourRect(): void {
    const target = this.host.nativeElement.querySelector(`#${this.currentTourStep().target}`) as HTMLElement | null;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const cardWidth = Math.min(352, vw - 24);
    const cardHeight = 245;
    const cardLeft = Math.max(12, Math.min(vw - cardWidth - 12, rect.left + rect.width / 2 - cardWidth / 2));
    const below = rect.bottom + 14;
    const cardTop = below + cardHeight < vh - 12 ? below : Math.max(12, rect.top - cardHeight - 14);
    this.tourRect.set({ top: rect.top, left: rect.left, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom, viewportWidth: vw, viewportHeight: vh, cardLeft, cardTop });
  }
  openListing(listing: Listing): void { void this.router.navigate(['/producto', listing.id]); }
  openProposal(listing: Listing): void {
    if (listing.ownerId === this.currentUser()?.id) {
      this.snackBar.open('No puedes proponer sobre tu propia publicación.', 'Cerrar', { duration: 3400 });
      return;
    }
    if (!this.currentUser()) {
      this.rememberPendingAction({ type: 'contact', listingId: listing.id });
      this.openLogin();
      return;
    }
    // Las propuestas se envían desde el chat de la publicación.
    void this.startConversation(listing.id);
  }
  openSearchResults(): void {
    const query = this.searchControl.value.trim();
    this.store.dispatch(MarketplaceActions.setQuery({ query }));
    this.store.dispatch(MarketplaceActions.setCategory({ category: 'all' }));
    this.store.dispatch(MarketplaceActions.setListingKind({ kind: 'all' }));
    this.store.dispatch(MarketplaceActions.setAcceptedKind({ accepts: 'all' }));
    void this.router.navigate(['/explorar'], { queryParams: query ? { q: query } : {} });
  }

  openPublish(): void {
    if (!this.currentUser()) {
      this.rememberPendingAction({ type: 'publish' });
      this.openLogin();
      return;
    }
    const districtId = this.selectedDistrictForPublish();
    void this.router.navigate(['/publicar'], { queryParams: districtId ? { district: districtId } : undefined });
  }
  openLogin(): void {
    this.showMobileMenu.set(false);
    if (!this.auth.configured) {
      this.clearPendingAction();
      this.snackBar.open('El inicio de sesion no esta disponible. Intentalo de nuevo.', 'Cerrar', { duration: 5000 });
      return;
    }
    void this.auth.openSignIn().catch(() => {
    });
  }
  avatarInitials(name: string): string {
    return name.trim().charAt(0).toUpperCase() || '?';
  }
  toggleAccountMenu(): void { this.accountMenuOpen.update((open) => !open); }
  closeAccountMenu(): void { this.accountMenuOpen.set(false); }
  async openAccountSettings(): Promise<void> {
    try { await this.auth.openUserProfile(); }
    catch { this.snackBar.open('No se pudo abrir la configuración del perfil.', 'Cerrar', { duration: 3500 }); }
  }
  async signOut(): Promise<void> {
    try {
      await this.auth.signOut();
      this.clearPendingAction();
      this.resetLocalDemoState();
      void this.loadListings();
    } catch {
      this.snackBar.open('No se pudo cerrar la sesión. Inténtalo otra vez.', 'Cerrar', { duration: 3400 });
    }
  }
  openReport(listing?: Listing, reportListingId?: string): void {
    const listingId = listing?.id ?? reportListingId;
    if (!this.currentUser()) {
      this.rememberPendingAction({ type: 'report', listingId });
      this.openLogin();
      return;
    }
    this.openDialog({ mode: 'report', listing, reportListingId: listingId });
  }

  private async openDialog(data: MarketplaceDialogData): Promise<void> {
    const { MarketplaceDialogComponent } = await import('./dialogs/marketplace-dialog.component');
    if (this.destroyed) return;
    const ref = this.dialog.open(MarketplaceDialogComponent, {
      data,
      width: data.mode === 'listing' ? 'min(580px, calc(100vw - 28px))' : 'min(560px, calc(100vw - 28px))',
      maxWidth: '560px',
      maxHeight: 'min(88vh, 850px)',
      panelClass: ['monkeytrueque-dialog'],
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
    ref.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((result) => {
      void this.handleDialogResult(result as MarketplaceDialogResult | undefined);
    });
  }

  private async handleDialogResult(result: MarketplaceDialogResult | undefined): Promise<void> {
    if (!result) return;
    try {
      switch (result.type) {
        case 'proposal-requested':
          this.openProposal(result.listing);
          break;
        case 'published':
          this.store.dispatch(MarketplaceActions.addListing({ listing: result.listing }));
          this.searchControl.setValue('', { emitEvent: false });
          this.snackBar.open('Publicación guardada.', 'Cerrar', { duration: 3400 });
          document.querySelector('#publicaciones')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          break;
        case 'reported':
          await this.api.report(result.listingId, result.reason, result.details, { type: 'listing', id: result.listingId ?? '', attachments: result.attachments });
          this.snackBar.open('Reporte enviado al equipo de moderación.', 'Cerrar', { duration: 4200 });
          break;
        case 'report-requested':
          this.openReport(result.listing);
          break;
      }
    } catch (error) { this.showApiError(error); }
  }

  private async startConversation(listingId: string): Promise<void> {
    try {
      const sanctions = await this.api.mySanctions();
      const messagingSanctions = sanctions.filter((sanction) => sanction.restrictionType === 'messaging' || sanction.restrictionType === 'all');
      if (messagingSanctions.length) {
        window.dispatchEvent(new CustomEvent('monkeytrueque:show-sanction-notice', { detail: messagingSanctions }));
        return;
      }
      const listing = this.allListings().find((item) => item.id === listingId) ?? (await this.api.listings()).find((item) => item.id === listingId);
      if (!listing) throw new Error('No encontramos esta publicación.');
      const user = this.currentUser();
      if (user) await this.api.syncMyProfile(user.name, user.imageUrl).catch(() => undefined);
      const initialMessage = listing.mode === 'trade'
        ? `¡Hola! Me interesa hacer un trueque por “${listing.title}”. Vi que buscas: ${listing.acceptanceSummary}. ¿Qué podría ofrecerte?`
        : `Hola, me interesa “${listing.title}”. ¿Sigue disponible?`;
      const conversation = await this.api.startConversation(listingId, initialMessage);
      await this.router.navigate(['/mensajes'], { queryParams: { conversation: conversation.id } });
    } catch (error) { this.showApiError(error); }
  }

  private async loadListings(silent = false): Promise<void> {
    try { this.store.dispatch(MarketplaceActions.setListings({ listings: await this.api.listings() })); }
    catch { if (!silent) this.snackBar.open('No se pudo conectar con el catálogo. Inicia el backend.', 'Cerrar', { duration: 6000 }); }
  }

  private showApiError(error: unknown): void {
    this.snackBar.open(error instanceof Error ? error.message : 'No se pudo conectar con el servidor.', 'Cerrar', { duration: 5500 });
  }

  private rememberPendingAction(action: PendingDemoAction): void {
    this.pendingDemoAction = action;
    try { sessionStorage.setItem(pendingActionKey, JSON.stringify(action)); } catch { /* Storage may be unavailable. */ }
  }

  private takePendingAction(): PendingDemoAction | null {
    const inMemory = this.pendingDemoAction;
    this.pendingDemoAction = null;
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(pendingActionKey);
      sessionStorage.removeItem(pendingActionKey);
    } catch { /* The in-memory action still works without storage. */ }
    if (inMemory) return inMemory;
    if (!stored) return null;
    try {
      const action: unknown = JSON.parse(stored);
      if (action && typeof action === 'object' && 'type' in action) {
        if (action.type === 'publish') return { type: 'publish' };
        if (action.type === 'proposal' && 'listingId' in action && typeof action.listingId === 'string') {
          return { type: 'proposal', listingId: action.listingId };
        }
        if (action.type === 'contact' && 'listingId' in action && typeof action.listingId === 'string') {
          return { type: 'contact', listingId: action.listingId };
        }
        if (action.type === 'report') {
          return { type: 'report', listingId: 'listingId' in action && typeof action.listingId === 'string' ? action.listingId : undefined };
        }
      }
    } catch { /* Ignore invalid state from an older session. */ }
    return null;
  }

  private clearPendingAction(): void {
    this.pendingDemoAction = null;
    try { sessionStorage.removeItem(pendingActionKey); } catch { /* No storage to clear. */ }
  }

  private resetLocalDemoState(): void {
    this.store.dispatch(MarketplaceActions.resetDemoSession());
    this.searchControl.setValue('', { emitEvent: false });
  }
}
