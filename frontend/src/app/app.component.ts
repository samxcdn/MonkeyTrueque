import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { PageAnalyticsService } from './core/data/page-analytics.service';
import { AdminApiService, type StaffRole } from './core/data/admin-api.service';
import { AuthService } from './core/auth/auth.service';
import { MarketplaceApiService } from './core/data/marketplace-api.service';
import type { UserAppeal, UserSanction } from './core/data/marketplace-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe, RouterOutlet, RouterLink],
  template: `
    <router-outlet />
    @if (noticeSanctions().length) {
      <div class="sanction-notice-backdrop" (click)="dismissSanctionNotice()">
        <section class="sanction-notice" role="alertdialog" aria-modal="true" aria-labelledby="sanction-notice-title" aria-describedby="sanction-notice-description" (click)="$event.stopPropagation()">
          <button class="sanction-notice-close" type="button" aria-label="Cerrar aviso" (click)="dismissSanctionNotice()">×</button>
          <div class="sanction-notice-icon" aria-hidden="true">!</div>
          <p class="sanction-notice-eyebrow">INFORMACIÓN DE TU CUENTA</p>
          <h2 id="sanction-notice-title">Hay una medida vigente en tu cuenta</h2>
          <p id="sanction-notice-description" class="sanction-notice-intro">Te contamos qué función está limitada y hasta cuándo. Si crees que se aplicó por error, puedes solicitar que la revisen.</p>
          <div class="sanction-notice-items">
            @for (sanction of uniqueNoticeSanctions(); track sanction.restrictionType) {
              <article class="sanction-notice-item">
                <strong>{{ restrictionLabel(sanction) }}</strong>
                <p>{{ sanction.reason }}</p>
                <small>{{ expiryLabel(sanction) }}</small>
              </article>
            }
          </div>
          <div class="sanction-notice-actions">
            <a routerLink="/cuenta" (click)="dismissSanctionNotice()">Ver detalles y solicitar revisión</a>
            <button type="button" (click)="dismissSanctionNotice()">Entendido</button>
          </div>
          <p class="sanction-notice-footnote">Este aviso es privado y solo lo ves tú.</p>
        </section>
      </div>
    }
    @else if (noticeAppeals().length) {
      <div class="appeal-resolution-backdrop" (click)="dismissAppealNotice()">
        <section class="appeal-resolution-notice" role="alertdialog" aria-modal="true" aria-labelledby="appeal-resolution-title" (click)="$event.stopPropagation()">
          <button class="sanction-notice-close" type="button" aria-label="Cerrar aviso" (click)="dismissAppealNotice()">×</button>
          <div class="appeal-resolution-icon" aria-hidden="true">{{ noticeAppeals()[0].status === 'accepted' ? '✓' : 'i' }}</div>
          <p class="appeal-resolution-eyebrow">RESULTADO DE TU SOLICITUD</p>
          <h2 id="appeal-resolution-title">{{ noticeAppeals()[0].status === 'accepted' ? 'Tu apelación fue aceptada' : 'Tu apelación fue revisada' }}</h2>
          <p class="appeal-resolution-intro">{{ noticeAppeals()[0].status === 'accepted' ? 'La medida fue retirada.' : 'La medida se mantiene vigente.' }}</p>
          <div class="sanction-notice-items">
            @for (appeal of noticeAppeals(); track appeal.id) {
              <article class="appeal-resolution-item"><strong>{{ appeal.status === 'accepted' ? 'Apelación aceptada' : 'Apelación rechazada' }}</strong><p>{{ appeal.resolution }}</p><small>{{ appeal.reviewedAt | date:'d MMMM y, HH:mm' }}</small></article>
            }
          </div>
          <div class="sanction-notice-actions"><a routerLink="/cuenta/restricciones" (click)="dismissAppealNotice()">Ver medidas y revisiones</a><button type="button" (click)="dismissAppealNotice()">Entendido</button></div>
          <p class="sanction-notice-footnote">La resolución también queda guardada en tu cuenta.</p>
        </section>
      </div>
    }
    @if (hasDashboardAccess() && !isDashboardPage()) {
      <a
        class="staff-dashboard-fab"
        routerLink="/admin"
        aria-label="Ir al dashboard de administración"
        title="Ir al dashboard de administración"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.14 12.94c.04-.31.06-.62.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.95l-.36-2.54A.49.49 0 0 0 13.88 2h-3.76a.49.49 0 0 0-.49.42L9.27 4.96c-.59.23-1.14.55-1.63.95l-2.39-.96a.5.5 0 0 0-.61.22L2.72 8.49a.5.5 0 0 0 .12.64l2.03 1.58a6.1 6.1 0 0 0 0 1.88l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.21.37.3.61.22l2.39-.96c.49.4 1.04.72 1.63.95l.36 2.54c.04.24.24.42.49.42h3.76c.25 0 .45-.18.49-.42l.36-2.54c.59-.23 1.14-.55 1.63-.95l2.39.96c.24.09.49-.01.61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.02-1.58ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"/></svg>
      </a>
    }
  `,
  styles: [`
    :host { display: block; min-height: 100%; }
    .staff-dashboard-fab { position: fixed; z-index: 1000; right: 22px; bottom: 22px; display: grid; width: 48px; height: 48px; place-items: center; border: 0; border-radius: 50%; background: #2563eb; color: #fff; box-shadow: 0 5px 16px rgba(37, 99, 235, .3); transition: transform .2s ease, box-shadow .2s ease; }
    .staff-dashboard-fab:hover { transform: scale(1.08); box-shadow: 0 7px 20px rgba(37, 99, 235, .4); }
    .staff-dashboard-fab svg { width: 27px; height: 27px; fill: currentColor; animation: staff-dashboard-spin .8s linear infinite; }
    .sanction-notice-backdrop { position: fixed; z-index: 2000; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(15, 23, 42, .58); backdrop-filter: blur(3px); }
    .appeal-resolution-backdrop { position: fixed; z-index: 2001; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(15, 23, 42, .58); backdrop-filter: blur(3px); }
    .appeal-resolution-notice { position: relative; width: min(100%, 520px); max-height: min(90vh, 760px); overflow-y: auto; padding: 34px 36px 24px; border: 1px solid #bbf7d0; border-top: 4px solid #16a34a; border-radius: 22px; background: #fff; color: #172554; box-shadow: 0 24px 80px rgba(15, 23, 42, .28); text-align: center; }
    .appeal-resolution-icon { display: grid; width: 46px; height: 46px; margin: 0 auto 15px; place-items: center; border: 2px solid #16a34a; border-radius: 50%; background: #f0fdf4; color: #15803d; font: 800 25px Arial, sans-serif; }
    .appeal-resolution-eyebrow { margin: 0 0 8px; color: #15803d; font-size: 11px; font-weight: 800; letter-spacing: .12em; }
    .appeal-resolution-notice h2 { margin: 0 auto 10px; max-width: 400px; color: #172554; font-size: clamp(21px, 4vw, 27px); line-height: 1.2; }
    .appeal-resolution-intro { margin: 0 auto 20px; color: #475569; font-size: 14px; line-height: 1.55; }
    .appeal-resolution-item { padding: 14px 16px; border: 1px solid #bbf7d0; border-radius: 13px; background: #f7fef9; text-align: left; }
    .appeal-resolution-item strong { color: #172554; font-size: 14px; }
    .appeal-resolution-item p { margin: 6px 0; color: #475569; font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
    .appeal-resolution-item small { color: #64748b; font-size: 12px; }
    .appeal-resolution-notice .sanction-notice-actions a { background: #15803d; }
    .sanction-notice { position: relative; width: min(100%, 520px); max-height: min(90vh, 760px); overflow-y: auto; padding: 34px 36px 24px; border: 1px solid #fecaca; border-top: 4px solid #dc2626; border-radius: 22px; background: #fff; color: #172554; box-shadow: 0 24px 80px rgba(15, 23, 42, .28); text-align: center; }
    .sanction-notice-close { position: absolute; top: 13px; right: 15px; width: 34px; height: 34px; border: 0; border-radius: 50%; background: #f1f5f9; color: #334155; font-size: 24px; line-height: 1; cursor: pointer; }
    .sanction-notice-icon { display: grid; width: 46px; height: 46px; margin: 0 auto 15px; place-items: center; border: 2px solid #dc2626; border-radius: 50%; background: #fef2f2; color: #b91c1c; font: 800 25px Arial, sans-serif; }
    .sanction-notice-eyebrow { margin: 0 0 8px; color: #b91c1c; font-size: 11px; font-weight: 800; letter-spacing: .12em; }
    .sanction-notice h2 { margin: 0 auto 10px; max-width: 400px; color: #172554; font-size: clamp(21px, 4vw, 27px); line-height: 1.2; }
    .sanction-notice-intro { margin: 0 auto 20px; max-width: 425px; color: #475569; font-size: 14px; line-height: 1.55; }
    .sanction-notice-items { display: grid; gap: 10px; text-align: left; }
    .sanction-notice-item { padding: 14px 16px; border: 1px solid #fecaca; border-radius: 13px; background: #fffafa; }
    .sanction-notice-item strong { color: #172554; font-size: 14px; }
    .sanction-notice-item p { margin: 6px 0; color: #475569; font-size: 13px; line-height: 1.45; white-space: pre-wrap; }
    .sanction-notice-item small { color: #64748b; font-size: 12px; }
    .sanction-notice-actions { display: grid; gap: 10px; margin-top: 22px; }
    .sanction-notice-actions a, .sanction-notice-actions button { display: flex; min-height: 44px; align-items: center; justify-content: center; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
    .sanction-notice-actions a { background: #b91c1c; color: #fff; text-decoration: none; }
    .sanction-notice-actions button { border: 1px solid #cbd5e1; background: #fff; color: #334155; }
    .sanction-notice-footnote { margin: 16px 0 0; color: #64748b; font-size: 11px; }
    @media (prefers-color-scheme: dark) { .sanction-notice { border-color: #7f1d1d; border-top-color: #ef4444; background: #111827; color: #f8fafc; } .sanction-notice h2, .sanction-notice-item strong { color: #f8fafc; } .sanction-notice-intro, .sanction-notice-item p { color: #cbd5e1; } .sanction-notice-icon { border-color: #ef4444; background: #450a0a; color: #fecaca; } .sanction-notice-eyebrow { color: #fca5a5; } .sanction-notice-item { border-color: #7f1d1d; background: #1f171a; } .sanction-notice-item small, .sanction-notice-footnote { color: #94a3b8; } .sanction-notice-close, .sanction-notice-actions button { border-color: #475569; background: #1e293b; color: #e2e8f0; } .sanction-notice-actions a { background: #dc2626; } }
    @media (max-width: 520px) { .sanction-notice { padding: 30px 20px 20px; border-radius: 18px; } }
    @keyframes staff-dashboard-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .staff-dashboard-fab, .staff-dashboard-fab svg { animation: none; transition: none; } }
  `]
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly adminApi = inject(AdminApiService);
  private readonly marketplaceApi = inject(MarketplaceApiService);
  private readonly router = inject(Router);
  readonly staffRole = signal<StaffRole>('none');
  readonly hasDashboardAccess = computed(() => this.staffRole() === 'admin' || this.staffRole() === 'moderator');
  readonly isDashboardPage = signal(/^\/admin(?:\/|$)/.test(window.location.pathname));
  readonly noticeSanctions = signal<UserSanction[]>([]);
  readonly noticeAppeals = signal<UserAppeal[]>([]);
  readonly uniqueNoticeSanctions = computed(() => {
    const byType = new Map<UserSanction['restrictionType'], UserSanction>();
    for (const sanction of this.noticeSanctions()) {
      const current = byType.get(sanction.restrictionType);
      if (!current || new Date(sanction.startsAt).getTime() > new Date(current.startsAt).getTime()) byType.set(sanction.restrictionType, sanction);
    }
    return [...byType.values()];
  });

  constructor() {
    inject(PageAnalyticsService);
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(event => {
      this.isDashboardPage.set(/^\/admin(?:\/|$)/.test(event.urlAfterRedirects));
    });
    window.addEventListener('monkeytrueque:show-sanction-notice', this.onSanctionNotice);
    effect(() => {
      const userId = this.auth.user()?.id;
      const authStatus = this.auth.status();
      if (!userId || authStatus !== 'ready') {
        this.staffRole.set('none');
        this.noticeSanctions.set([]);
        this.noticeAppeals.set([]);
        return;
      }
      void this.loadStaffRole(userId);
      void this.refreshSanctionNotice(userId);
      void this.refreshAppealNotice(userId);
      const timer = window.setInterval(() => { void this.refreshSanctionNotice(userId); void this.refreshAppealNotice(userId); }, 60_000);
      return () => window.clearInterval(timer);
    });
  }

  restrictionLabel(sanction: UserSanction): string {
    if (sanction.restrictionType === 'messaging') return 'Mensajes temporalmente limitados';
    if (sanction.restrictionType === 'publishing') return 'Publicaciones temporalmente limitadas';
    return 'Algunas funciones de la cuenta están limitadas';
  }

  expiryLabel(sanction: UserSanction): string {
    if (!sanction.expiresAt) return 'Sin fecha de finalización indicada';
    return `Vigente hasta ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(sanction.expiresAt))}`;
  }

  dismissSanctionNotice(): void {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const seen = this.readSeenSanctions(userId);
    for (const sanction of this.noticeSanctions()) seen.add(sanction.id);
    try { localStorage.setItem(this.seenSanctionsKey(userId), JSON.stringify([...seen])); } catch { /* El aviso se puede cerrar aunque el almacenamiento esté desactivado. */ }
    this.noticeSanctions.set([]);
  }

  dismissAppealNotice(): void {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const seen = this.readSeenAppeals(userId);
    for (const appeal of this.noticeAppeals()) seen.add(appeal.id);
    try { localStorage.setItem(this.seenAppealsKey(userId), JSON.stringify([...seen])); } catch { /* Se puede cerrar el aviso aunque el almacenamiento esté desactivado. */ }
    this.noticeAppeals.set([]);
  }

  private async refreshSanctionNotice(userId: string): Promise<void> {
    try {
      const sanctions = await this.marketplaceApi.mySanctions();
      if (this.auth.user()?.id !== userId) return;
      const seen = this.readSeenSanctions(userId);
      this.noticeSanctions.set(sanctions.filter((sanction) => !seen.has(sanction.id)));
    } catch { /* La consulta del aviso nunca debe interrumpir la navegación. */ }
  }

  private async refreshAppealNotice(userId: string): Promise<void> {
    try {
      const appeals = await this.marketplaceApi.myAppeals();
      if (this.auth.user()?.id !== userId) return;
      const seen = this.readSeenAppeals(userId);
      this.noticeAppeals.set(appeals.filter((appeal) => (appeal.status === 'accepted' || appeal.status === 'rejected') && !seen.has(appeal.id)));
    } catch { /* La consulta no debe interrumpir la navegación. */ }
  }

  private readSeenSanctions(userId: string): Set<string> {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(this.seenSanctionsKey(userId)) ?? '[]');
      return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);
    } catch { return new Set(); }
  }

  private seenSanctionsKey(userId: string): string { return `monkeytrueque:seen-sanctions:${userId}`; }
  private readSeenAppeals(userId: string): Set<string> {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(this.seenAppealsKey(userId)) ?? '[]');
      return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);
    } catch { return new Set(); }
  }
  private seenAppealsKey(userId: string): string { return `monkeytrueque:seen-appeal-resolutions:${userId}`; }

  private readonly onSanctionNotice = (event: Event): void => {
    const sanctions = (event as CustomEvent<UserSanction[]>).detail;
    if (Array.isArray(sanctions)) this.noticeSanctions.set(sanctions);
  };

  private async loadStaffRole(userId: string): Promise<void> {
    try {
      const role = await this.adminApi.staffRole();
      if (this.auth.user()?.id === userId) this.staffRole.set(role);
    } catch {
      if (this.auth.user()?.id === userId) this.staffRole.set('none');
    }
  }
}
