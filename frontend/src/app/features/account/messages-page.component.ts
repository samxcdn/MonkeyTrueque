import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { MarketplaceApiService } from '../../core/data/marketplace-api.service';
import { formatMeetupTime } from '../../core/data/meetup-time';
import type { AgreementStatus, DirectConversation, DirectMessage, PublicProfile, ServerExchange } from '../../core/data/marketplace-api.service';
import type { ConfirmationRole } from '../../core/models/marketplace.models';
import type { MarketplaceDialogData, MarketplaceDialogResult } from '../marketplace/dialogs/marketplace-dialog.component';
import { MarketplaceHeaderComponent } from '../marketplace/marketplace-header.component';
import { ReportUserDialogComponent } from './report-user-dialog.component';
import type { ReportUserDialogResult } from './report-user-dialog.component';
import { BlockUserDialogComponent } from './block-user-dialog.component';

/** Estados en los que el acuerdo terminó sin entrega y se puede empezar otro. */
const CLOSED_WITHOUT_DEAL: readonly AgreementStatus[] = ['rejected', 'cancelled', 'listing-closed'];

@Component({
  selector: 'app-messages-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatMenuModule, MatSnackBarModule, MarketplaceHeaderComponent],
  templateUrl: './messages-page.component.html',
  styleUrl: './messages-page.component.scss',
})
export class MessagesPageComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(MarketplaceApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly user = this.auth.user;
  readonly authStatus = this.auth.status;
  readonly conversations = signal<DirectConversation[]>([]);
  readonly exchanges = signal<ServerExchange[]>([]);
  readonly readCursors = signal<Record<string, string>>({});
  readonly selectedId = signal('');
  readonly tab = signal<'searching' | 'offering'>('searching');
  readonly search = signal('');
  readonly archivedView = signal(false);
  readonly archivedIds = signal<string[]>([]);
  readonly archivedCount = computed(() => this.conversations().filter((conversation) => this.archivedIds().includes(conversation.id)).length);
  readonly draft = signal('');
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  readonly selectedConversation = computed(() => this.conversations().find((conversation) => conversation.id === this.selectedId()) ?? null);
  /** El acuerdo más reciente de la conversación abierta. */
  readonly agreement = computed(() => {
    const conversation = this.selectedConversation();
    return conversation ? this.agreementFor(conversation) : null;
  });
  readonly visibleConversations = computed(() => {
    const userId = this.user()?.id;
    const query = this.search().trim().toLocaleLowerCase();
    return this.conversations().filter((conversation) => {
      const isVisitor = conversation.visitorId === userId;
      const matchesTab = this.tab() === 'searching' ? isVisitor : conversation.ownerId === userId;
      const matchesQuery = !query || conversation.listingTitle.toLocaleLowerCase().includes(query) || this.otherName(conversation).toLocaleLowerCase().includes(query);
      const isArchived = this.archivedIds().includes(conversation.id);
      return matchesTab && matchesQuery && isArchived === this.archivedView();
    });
  });

  private loadedUserId = '';
  private loadRequestId = 0;
  private readonly profileCache = new Map<string, PublicProfile>();

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const conversationId = params.get('conversation');
      if (conversationId) this.selectedId.set(conversationId);
    });
    effect(() => {
      const userId = this.user()?.id ?? '';
      if (!userId) { this.loadedUserId = ''; this.conversations.set([]); this.exchanges.set([]); this.readCursors.set({}); this.selectedId.set(''); return; }
      if (this.loadedUserId === userId) return;
      this.loadedUserId = userId;
      this.readCursors.set(this.loadReadCursors(userId));
      this.archivedIds.set(this.loadArchivedIds(userId));
      void this.load();
    });
    effect((onCleanup) => {
      if (!this.user()) return;
      const refresh = window.setInterval(() => void this.load(true), 3000);
      onCleanup(() => window.clearInterval(refresh));
    });
  }

  async load(silent = false): Promise<void> {
    if (!this.user()) return;
    // Do not let a polling response that began before a send replace the newer
    // conversation returned by the POST request.
    if (silent && this.sending()) return;
    const requestId = ++this.loadRequestId;
    if (!silent) { this.loading.set(true); this.error.set(''); }
    try {
      const [items, exchanges] = await Promise.all([this.api.conversations(), this.api.exchanges()]);
      const userId = this.user()?.id ?? '';
      const conversations = await Promise.all(items.map(async (conversation) => {
        const isOwner = conversation.ownerId === userId;
        const otherId = isOwner ? conversation.visitorId : conversation.ownerId;
        const otherName = isOwner ? conversation.visitorName : conversation.ownerName;
        const otherImage = isOwner ? conversation.visitorImageUrl : conversation.ownerImageUrl;
        if (otherName && otherName !== 'Usuario interesado' && otherImage) return conversation;
        const profile = await this.profileFor(otherId);
        if (!profile) return conversation;
        return isOwner
          ? { ...conversation, visitorName: profile.displayName || conversation.visitorName, visitorImageUrl: profile.imageUrl || conversation.visitorImageUrl }
          : { ...conversation, ownerName: profile.displayName || conversation.ownerName, ownerImageUrl: profile.imageUrl || conversation.ownerImageUrl };
      }));
      if (requestId !== this.loadRequestId || this.sending()) return;
      this.conversations.set(conversations);
      this.exchanges.set(exchanges);
      if (!conversations.some((conversation) => conversation.id === this.selectedId())) this.selectedId.set(conversations[0]?.id ?? '');
      const cursors = { ...this.readCursors() };
      const hasSavedCursors = this.hasSavedReadCursors(userId);
      for (const conversation of conversations) {
        if (!Object.prototype.hasOwnProperty.call(cursors, conversation.id)) {
          // On first use, count incoming messages since the user's latest reply.
          // New chats added after that begin fully unread.
          cursors[conversation.id] = hasSavedCursors ? '' : this.lastOwnMessageId(conversation, userId);
        }
      }
      const active = conversations.find((conversation) => conversation.id === this.selectedId());
      if (active) cursors[active.id] = active.messages.at(-1)?.id ?? '';
      this.saveReadCursors(cursors, userId);
      if (active?.ownerId === this.user()?.id) this.tab.set('offering');
    } catch (error) {
      if (requestId === this.loadRequestId && !silent) this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar tus mensajes.');
    } finally { if (!silent) this.loading.set(false); }
  }

  selectConversation(conversation: DirectConversation): void {
    this.selectedId.set(conversation.id);
    this.markRead(conversation);
    this.tab.set(conversation.ownerId === this.user()?.id ? 'offering' : 'searching');
    this.draft.set('');
    this.error.set('');
    void this.router.navigate([], { relativeTo: this.route, queryParams: { conversation: conversation.id }, replaceUrl: true });
  }

  async send(): Promise<void> {
    const conversation = this.selectedConversation();
    const text = this.draft().trim();
    if (!conversation || !text || this.sending()) return;
    this.sending.set(true);
    this.loadRequestId++;
    this.error.set('');
    try {
      const updated = await this.api.sendDirectMessage(conversation.id, text);
      this.conversations.update((items) => [updated, ...items.filter((item) => item.id !== updated.id)]);
      this.markRead(updated);
      this.draft.set('');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo enviar el mensaje.');
    } finally { this.sending.set(false); }
  }

  // ---- Acuerdo de la conversación -------------------------------------------------

  agreementFor(conversation: DirectConversation): ServerExchange | null {
    const linked = conversation.exchangeId ? this.exchanges().find((exchange) => exchange.id === conversation.exchangeId) : undefined;
    return linked ?? this.exchanges().find((exchange) => exchange.conversationId === conversation.id) ?? null;
  }
  /** Se puede empezar un acuerdo si no hay ninguno o el anterior terminó sin entrega. */
  canStartAgreement(conversation: DirectConversation): boolean {
    const agreement = this.agreementFor(conversation);
    return conversation.status === 'active' && (!agreement || CLOSED_WITHOUT_DEAL.includes(agreement.status));
  }
  isOwner(conversation: DirectConversation): boolean { return conversation.ownerId === this.user()?.id; }
  ownRole(exchange: ServerExchange): ConfirmationRole { return exchange.ownerId === this.user()?.id ? 'owner' : 'proposer'; }
  hasConfirmed(exchange: ServerExchange): boolean { return this.ownRole(exchange) === 'owner' ? exchange.ownerConfirmed : exchange.proposerConfirmed; }
  proposedMeetupMyself(exchange: ServerExchange): boolean { return exchange.meetupProposedBy === this.ownRole(exchange); }
  /** La entrega se confirma desde el día del encuentro (hora de Lima). */
  canConfirmToday(exchange: ServerExchange): boolean {
    if (!exchange.meetupDate) return true;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
    return today >= exchange.meetupDate;
  }
  isCancellable(exchange: ServerExchange): boolean { return ['accepted', 'meetup-proposed', 'meetup-agreed'].includes(exchange.status); }
  startLabel(conversation: DirectConversation): string {
    return ({ trade: 'Proponer trueque', sale: 'Quiero comprarlo', gift: 'Quiero recibirlo' } as Record<string, string>)[conversation.listingMode] ?? 'Enviar propuesta';
  }
  agreementStatus(status: AgreementStatus): string {
    return ({
      'proposal-sent': 'Propuesta enviada', accepted: 'Propuesta aceptada', 'meetup-proposed': 'Encuentro por confirmar',
      'meetup-agreed': 'Encuentro acordado', 'confirmed-by-one': 'Falta una confirmación', 'confirmed-by-both': 'Entrega confirmada',
      rated: 'Finalizado', rejected: 'Propuesta rechazada', cancelled: 'Acuerdo cancelado', 'listing-closed': 'Publicación entregada a otra persona',
    } as Record<AgreementStatus, string>)[status] ?? status;
  }
  meetupTimeLabel(time: string): string {
    return formatMeetupTime(time);
  }

  meetupDateLabel(date: string): string {
    if (!date) return '';
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  async startAgreement(conversation: DirectConversation): Promise<void> {
    if (!this.canStartAgreement(conversation) || this.isOwner(conversation)) return;
    if (conversation.listingMode !== 'trade') {
      await this.runAgreementAction(() => this.api.propose(conversation.id, null, null, ''), 'Solicitud enviada.');
      return;
    }
    let listing;
    try { listing = await this.api.listing(conversation.listingId); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'No se pudo abrir la publicación.'); return; }
    const result = await this.openExchangeDialog({ mode: 'proposal', listing });
    if (result?.type !== 'proposal') return;
    await this.runAgreementAction(() => this.api.propose(conversation.id, result.offeredTitle, result.offeredKind, result.note), 'Propuesta enviada.');
  }
  acceptProposal(exchange: ServerExchange): Promise<void> { return this.runAgreementAction(() => this.api.acceptProposal(exchange.id), 'Propuesta aceptada.'); }
  rejectProposal(exchange: ServerExchange): Promise<void> { return this.runAgreementAction(() => this.api.rejectProposal(exchange.id), 'Propuesta rechazada.'); }
  cancelAgreement(exchange: ServerExchange): Promise<void> {
    const message = exchange.status === 'proposal-sent' ? 'Propuesta retirada.' : 'Acuerdo cancelado.';
    return this.runAgreementAction(() => this.api.cancelAgreement(exchange.id), message);
  }
  async proposeMeetup(exchange: ServerExchange): Promise<void> {
    const result = await this.openExchangeDialog({ mode: 'meetup', exchange });
    if (result?.type !== 'meetup') return;
    await this.runAgreementAction(() => this.api.meetup(exchange.id, result.place, result.date, result.time), 'Encuentro propuesto. Falta que la otra persona lo acepte.');
  }
  acceptMeetup(exchange: ServerExchange): Promise<void> { return this.runAgreementAction(() => this.api.acceptMeetup(exchange.id), 'Encuentro acordado.'); }
  confirmDelivery(exchange: ServerExchange): Promise<void> { return this.runAgreementAction(() => this.api.confirm(exchange.id), 'Tu confirmación quedó guardada.'); }
  async rateExchange(exchange: ServerExchange): Promise<void> {
    const role = this.ownRole(exchange);
    if (exchange.status !== 'confirmed-by-both' || exchange.ratings[role]) return;
    const result = await this.openExchangeDialog({ mode: 'rating', exchange, ratingRole: role });
    if (result?.type !== 'rating') return;
    await this.runAgreementAction(() => this.api.rate(exchange.id, result.rating, result.review), 'Calificación guardada.');
  }

  /** Ejecuta un paso del acuerdo y recarga el chat, donde queda registrado. */
  private async runAgreementAction(action: () => Promise<ServerExchange>, done: string): Promise<void> {
    if (this.sending()) return;
    this.sending.set(true);
    this.error.set('');
    try {
      const exchange = await action();
      this.exchanges.update((items) => [exchange, ...items.filter((item) => item.id !== exchange.id)]);
      this.snackBar.open(done, 'Cerrar', { duration: 3000 });
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo actualizar el acuerdo.');
    } finally { this.sending.set(false); }
    await this.load(true);
  }
  private async openExchangeDialog(data: MarketplaceDialogData): Promise<MarketplaceDialogResult | undefined> {
    const { MarketplaceDialogComponent } = await import('../marketplace/dialogs/marketplace-dialog.component');
    return firstValueFrom(this.dialog.open(MarketplaceDialogComponent, { data, width: 'min(560px, calc(100vw - 28px))', maxWidth: '560px', maxHeight: 'min(88vh, 850px)', panelClass: ['monkeytrueque-dialog'], autoFocus: 'first-tabbable', restoreFocus: true }).afterClosed());
  }

  // ---- Lista y conversación ---------------------------------------------------------

  otherName(conversation: DirectConversation): string {
    return conversation.ownerId === this.user()?.id ? conversation.visitorName : conversation.ownerName;
  }
  otherImage(conversation: DirectConversation): string {
    return conversation.ownerId === this.user()?.id ? conversation.visitorImageUrl ?? '' : conversation.ownerImageUrl ?? '';
  }
  initials(name: string): string { return name.trim().charAt(0).toUpperCase() || '?'; }
  isOwnMessage(senderId: string): boolean { return senderId === this.user()?.id; }
  modeLabel(mode: string): string { return ({ trade: 'Trueque', sale: 'Venta', gift: 'Regalo' } as Record<string, string>)[mode] ?? mode; }
  timeLabel(value: string): string { return value ? new Date(value).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : ''; }
  lastMessage(conversation: DirectConversation): string { return conversation.messages.at(-1)?.text ?? 'Conversación iniciada'; }
  unreadCount(conversation: DirectConversation): number {
    const userId = this.user()?.id;
    if (!userId || conversation.id === this.selectedId()) return 0;
    const cursor = this.readCursors()[conversation.id] ?? '';
    const cursorIndex = cursor ? conversation.messages.findIndex((message) => message.id === cursor) : -1;
    return conversation.messages.reduce((count, message, index) =>
      count + (index > cursorIndex && message.senderId !== userId ? 1 : 0), 0);
  }
  unreadTotal(tab: 'searching' | 'offering'): number {
    const userId = this.user()?.id;
    if (!userId) return 0;
    return this.conversations().reduce((total, conversation) => {
      const belongsToTab = tab === 'searching' ? conversation.visitorId === userId : conversation.ownerId === userId;
      return total + (belongsToTab ? this.unreadCount(conversation) : 0);
    }, 0);
  }
  private lastOwnMessageId(conversation: DirectConversation, userId: string): string {
    for (let index = conversation.messages.length - 1; index >= 0; index--) {
      if (conversation.messages[index].senderId === userId) return conversation.messages[index].id;
    }
    return '';
  }
  firstMessageDate(conversation: DirectConversation): string | null { return conversation.messages[0]?.createdAt ?? null; }
  async signIn(): Promise<void> { try { await this.auth.openSignIn('/mensajes'); } catch { this.error.set('No se pudo abrir el inicio de sesión.'); } }
  backToList(): void { this.selectedId.set(''); void this.router.navigate([], { relativeTo: this.route, queryParams: { conversation: null }, queryParamsHandling: 'merge', replaceUrl: true }); }
  reloadPage(): void { window.location.reload(); }

  toggleArchive(conversation: DirectConversation): void {
    const ids = new Set(this.archivedIds());
    if (ids.has(conversation.id)) ids.delete(conversation.id); else ids.add(conversation.id);
    const next = [...ids];
    this.archivedIds.set(next);
    const userId = this.user()?.id;
    if (userId) {
      try { localStorage.setItem(this.archiveKey(userId), JSON.stringify(next)); } catch { /* El cambio sigue activo en esta sesión. */ }
    }
    if (ids.has(conversation.id)) this.backToList();
  }

  isArchived(conversation: DirectConversation): boolean { return this.archivedIds().includes(conversation.id); }
  toggleArchivedView(): void { this.archivedView.update((value) => !value); }

  async reportUser(conversation: DirectConversation): Promise<void> {
    const referenceId = conversation.ownerId === this.user()?.id ? conversation.visitorId : conversation.ownerId;
    this.dialog.open(ReportUserDialogComponent, {
      data: { name: this.otherName(conversation) },
      panelClass: ['monkeytrueque-dialog', 'report-user-dialog'],
      width: 'min(500px, calc(100vw - 28px))',
      maxWidth: '500px',
      autoFocus: false,
    }).afterClosed().subscribe((result: ReportUserDialogResult | undefined) => {
      if (result) void this.submitUserReport(conversation, referenceId, result);
    });
  }

  async reportMessage(conversation: DirectConversation, message: DirectMessage): Promise<void> {
    if (message.senderId === this.user()?.id) return;
    this.dialog.open(ReportUserDialogComponent, {
      data: { name: this.otherName(conversation), title: 'Reportar mensaje', prompt: '¿Qué problema tiene el mensaje de' },
      panelClass: ['monkeytrueque-dialog', 'report-user-dialog'],
      width: 'min(500px, calc(100vw - 28px))', maxWidth: '500px', autoFocus: false,
    }).afterClosed().subscribe((result: ReportUserDialogResult | undefined) => {
      if (!result) return;
      const evidence = `Mensaje de ${message.senderId} en la conversación ${conversation.id}: ${message.text}`;
      void this.api.report(conversation.listingId, result.reason, result.details, { type: 'message', id: message.id, evidence, attachments: result.attachments })
        .then(() => this.snackBar.open('Mensaje reportado. El equipo revisará la evidencia capturada.', 'Cerrar', { duration: 4000 }))
        .catch((error) => this.snackBar.open(error instanceof Error ? error.message : 'No se pudo enviar el reporte.', 'Cerrar', { duration: 5000 }));
    });
  }

  private async submitUserReport(conversation: DirectConversation, referenceId: string, result: ReportUserDialogResult): Promise<void> {
    this.error.set('');
    const context = `Cuenta reportada: ${this.otherName(conversation)} (${referenceId}). Conversación: ${conversation.id}. Publicación relacionada: ${conversation.listingTitle} (${conversation.listingId}).`;
    try {
      await this.api.report(conversation.listingId, result.reason, [context, result.details.trim()].filter(Boolean).join('\n'), { type: 'user', id: referenceId, attachments: result.attachments });
      this.snackBar.open('Reporte enviado al equipo de moderación.', 'Cerrar', { duration: 4000 });
    } catch (error) { this.snackBar.open(error instanceof Error ? error.message : 'No se pudo enviar el reporte.', 'Cerrar', { duration: 5000 }); }
  }

  async blockUser(conversation: DirectConversation): Promise<void> {
    const userId = conversation.ownerId === this.user()?.id ? conversation.visitorId : conversation.ownerId;
    const confirmed = await firstValueFrom(this.dialog.open(BlockUserDialogComponent, {
      data: { name: this.otherName(conversation) },
      panelClass: ['monkeytrueque-dialog', 'block-user-dialog'],
      width: 'min(480px, calc(100vw - 28px))',
      maxWidth: '480px',
      autoFocus: false,
    }).afterClosed());
    if (!confirmed) return;
    this.error.set('');
    try {
      await this.api.blockUser(userId);
      if (!this.isArchived(conversation)) this.toggleArchive(conversation);
      this.snackBar.open('Usuario bloqueado. Ya no podrá enviarte mensajes.', 'Cerrar', { duration: 4000 });
    } catch (error) { this.snackBar.open(error instanceof Error ? error.message : 'No se pudo bloquear al usuario.', 'Cerrar', { duration: 5000 }); }
  }

  private async profileFor(userId: string): Promise<PublicProfile | null> {
    if (!userId) return null;
    const cached = this.profileCache.get(userId);
    if (cached) return cached;
    try {
      const profile = await this.api.profile(userId);
      this.profileCache.set(userId, profile);
      return profile;
    } catch { return null; }
  }

  private readCursorKey(userId: string): string { return `monkeytrueque.readMessages.${userId}`; }
  private archiveKey(userId: string): string { return `monkeytrueque.archivedConversations.${userId}`; }
  private loadArchivedIds(userId: string): string[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(this.archiveKey(userId)) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  }
  private hasSavedReadCursors(userId: string): boolean {
    try { return localStorage.getItem(this.readCursorKey(userId)) !== null; } catch { return false; }
  }
  private loadReadCursors(userId: string): Record<string, string> {
    try {
      const value = localStorage.getItem(this.readCursorKey(userId));
      if (!value) return {};
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    } catch { return {}; }
  }
  private saveReadCursors(cursors: Record<string, string>, userId: string): void {
    this.readCursors.set(cursors);
    try { localStorage.setItem(this.readCursorKey(userId), JSON.stringify(cursors)); } catch { /* Chat remains usable when local storage is blocked. */ }
  }
  private markRead(conversation: DirectConversation): void {
    const userId = this.user()?.id;
    if (!userId) return;
    this.saveReadCursors({ ...this.readCursors(), [conversation.id]: conversation.messages.at(-1)?.id ?? '' }, userId);
  }
}
