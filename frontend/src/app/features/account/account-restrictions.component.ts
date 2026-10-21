import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { MarketplaceApiService } from '../../core/data/marketplace-api.service';
import type { UserAppeal, UserSanction } from '../../core/data/marketplace-api.service';
import type { Listing } from '../../core/models/marketplace.models';
import { MarketplaceHeaderComponent } from '../marketplace/marketplace-header.component';
import { EvidenceAttachmentsComponent, EvidenceImageDraft } from '../shared/evidence-attachments.component';

@Component({
  selector: 'app-account-restrictions',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule, MatSnackBarModule, MarketplaceHeaderComponent, EvidenceAttachmentsComponent],
  templateUrl: './account-restrictions.component.html',
  styleUrl: './account-restrictions.component.scss',
})
export class AccountRestrictionsComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(MarketplaceApiService);
  private readonly snackBar = inject(MatSnackBar);
  readonly user = this.auth.user;
  readonly sanctions = signal<UserSanction[]>([]);
  readonly appeals = signal<UserAppeal[]>([]);
  readonly hiddenListings = signal<Listing[]>([]);
  readonly drafts = signal<Record<string, string>>({});
  readonly evidenceDrafts = signal<Record<string, readonly EvidenceImageDraft[]>>({});
  readonly busyId = signal<string | null>(null);
  readonly loading = signal(true);

  constructor() {
    effect(() => {
      const userId = this.user()?.id;
      if (!userId) { this.sanctions.set([]); this.appeals.set([]); this.hiddenListings.set([]); this.loading.set(false); return; }
      this.loading.set(true);
      void Promise.all([this.api.mySanctions(), this.api.myAppeals(), this.api.myListings()]).then(([sanctions, appeals, listings]) => {
        if (this.user()?.id === userId) { this.sanctions.set(sanctions); this.appeals.set(appeals); this.hiddenListings.set(listings.filter((listing) => listing.moderationHidden)); }
      }).catch(() => this.snackBar.open('No se pudieron cargar las medidas de tu cuenta.', 'Cerrar', { duration: 4500 }))
        .finally(() => { if (this.user()?.id === userId) this.loading.set(false); });
    });
  }

  label(sanction: UserSanction): string {
    if (sanction.restrictionType === 'messaging') return 'Mensajes';
    if (sanction.restrictionType === 'publishing') return 'Publicaciones';
    return 'Cuenta';
  }

  heading(sanction: UserSanction): string {
    if (sanction.restrictionType === 'messaging') return 'Mensajes restringidos';
    if (sanction.restrictionType === 'publishing') return 'Publicaciones restringidas';
    return 'Funciones de la cuenta restringidas';
  }

  appealFor(sanctionId: string): UserAppeal | undefined { return this.appeals().find((appeal) => appeal.sanctionId === sanctionId); }
  appealsWithoutActiveSanction(): UserAppeal[] {
    const activeIds = new Set(this.sanctions().map((sanction) => sanction.id));
    return this.appeals().filter((appeal) => !activeIds.has(appeal.sanctionId));
  }
  draftFor(sanctionId: string): string { return this.drafts()[sanctionId] ?? ''; }
  setDraft(id: string, value: string): void { this.drafts.update((drafts) => ({ ...drafts, [id]: value })); }
  setEvidence(id: string, files: readonly EvidenceImageDraft[]): void { this.evidenceDrafts.update((drafts) => ({ ...drafts, [id]: files })); }

  async submit(sanction: UserSanction): Promise<void> {
    const explanation = (this.drafts()[sanction.id] ?? '').trim();
    if (!explanation || this.busyId()) return;
    this.busyId.set(sanction.id);
    try {
      const appeal = await this.api.appealSanction(sanction.id, explanation, this.evidenceDrafts()[sanction.id] ?? []);
      this.appeals.update((items) => [appeal, ...items]);
      this.setDraft(sanction.id, '');
      this.setEvidence(sanction.id, []);
      this.snackBar.open('Tu solicitud de revisión fue enviada.', 'Cerrar', { duration: 3500 });
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.', 'Cerrar', { duration: 5000 });
    } finally { this.busyId.set(null); }
  }
}
