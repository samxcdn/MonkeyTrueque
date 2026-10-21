import { Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { AdminSanction } from '../../core/data/admin-api.service';

export interface RevokeSanctionDialogData { readonly sanction: AdminSanction; }
export interface RevokeSanctionDialogResult { readonly reason: string; }

@Component({
  selector: 'app-revoke-sanction-dialog',
  standalone: true,
  imports: [MatDialogModule, MatIconModule],
  template: `
    <section class="revoke-dialog" aria-labelledby="revoke-title">
      <header class="revoke-dialog__header">
        <span class="revoke-dialog__icon"><mat-icon fontSet="material-icons-outlined" aria-hidden="true">undo</mat-icon></span>
        <button type="button" class="revoke-dialog__close" aria-label="Cerrar" (click)="close()"><mat-icon fontSet="material-icons-outlined">close</mat-icon></button>
        <p>REVISIÓN DE CUENTA</p>
        <h2 id="revoke-title">Retirar medida</h2>
        <span class="revoke-dialog__type">{{ data.sanction.restrictionType === 'messaging' ? 'Mensajes' : data.sanction.restrictionType === 'publishing' ? 'Publicaciones' : 'Suspensión general' }}</span>
      </header>
      <div class="revoke-dialog__body">
        <p>La medida se retirará de inmediato. Indica el motivo para dejar constancia en el historial de moderación.</p>
        <label for="revoke-reason">Motivo del retiro <span>Obligatorio</span></label>
        <textarea id="revoke-reason" rows="4" maxlength="1000" [value]="reason()" (input)="reason.set($any($event.target).value)" placeholder="Ej.: La restricción se aplicó por error tras revisar el caso."></textarea>
        <small class="revoke-dialog__count">{{ reason().length }}/1000</small>
      </div>
      <footer class="revoke-dialog__actions">
        <button type="button" class="revoke-dialog__cancel" (click)="close()">Cancelar</button>
        <button type="button" class="revoke-dialog__confirm" [disabled]="!reason().trim()" (click)="confirm()"><mat-icon fontSet="material-icons-outlined" aria-hidden="true">remove_circle_outline</mat-icon>Retirar medida</button>
      </footer>
    </section>
  `,
  styles: [`
    :host { display:block; color:#21163b; }
    .revoke-dialog { overflow:hidden; border:1px solid #e5deee; border-radius:20px; background:#fff; box-shadow:0 22px 70px rgba(25,16,48,.22); }
    .revoke-dialog__header { position:relative; padding:26px 28px 20px; background:linear-gradient(135deg,#fff5f4,#fff 72%); text-align:center; }
    .revoke-dialog__icon { display:grid; width:48px; height:48px; margin:0 auto 12px; place-items:center; border:1px solid #fecaca; border-radius:15px; background:#fff0ee; color:#b42318; }
    .revoke-dialog__icon mat-icon { width:25px; height:25px; font-size:25px; }
    .revoke-dialog__close { position:absolute; top:13px; right:14px; display:grid; width:34px; height:34px; place-items:center; border:0; border-radius:50%; background:#f2eef6; color:#625873; cursor:pointer; }
    .revoke-dialog__close mat-icon { width:19px; height:19px; font-size:19px; }
    .revoke-dialog__header p { margin:0 0 5px; color:#a12620; font-size:10px; font-weight:800; letter-spacing:.13em; }
    .revoke-dialog__header h2 { margin:0; color:#21163b; font-size:23px; }
    .revoke-dialog__type { display:inline-flex; margin-top:10px; padding:4px 10px; border:1px solid #f2b8b5; border-radius:999px; background:#fff; color:#9f2620; font-size:11px; font-weight:700; }
    .revoke-dialog__body { display:grid; gap:9px; padding:22px 28px 10px; }
    .revoke-dialog__body > p { margin:0 0 5px; color:#61586f; font-size:13px; line-height:1.55; }
    .revoke-dialog__body label { display:flex; justify-content:space-between; gap:10px; color:#30234a; font-size:12px; font-weight:750; }
    .revoke-dialog__body label span { color:#a12620; font-size:10px; font-weight:650; }
    .revoke-dialog__body textarea { box-sizing:border-box; width:100%; min-height:105px; resize:vertical; border:1px solid #d9d1e3; border-radius:11px; padding:12px 13px; background:#fff; color:#241b35; font:inherit; font-size:12px; line-height:1.5; }
    .revoke-dialog__body textarea:focus { border-color:#8b5cf6; outline:3px solid rgba(139,92,246,.14); }
    .revoke-dialog__body textarea::placeholder { color:#91889d; }
    .revoke-dialog__count { justify-self:end; color:#877e92; font-size:10px; }
    .revoke-dialog__actions { display:flex; justify-content:flex-end; gap:9px; padding:16px 22px 20px; }
    .revoke-dialog__actions button { display:inline-flex; min-height:42px; align-items:center; justify-content:center; gap:7px; border:0; border-radius:10px; padding:0 15px; font:inherit; font-size:12px; font-weight:750; cursor:pointer; }
    .revoke-dialog__cancel { background:#f1edf5; color:#51475f; }
    .revoke-dialog__confirm { background:#b42318; color:#fff; }
    .revoke-dialog__confirm:hover:not(:disabled) { background:#951b13; }
    .revoke-dialog__confirm:disabled { cursor:not-allowed; opacity:.45; }
    .revoke-dialog__confirm mat-icon { width:17px; height:17px; font-size:17px; }
    :host-context(html.marketplace-dark) .revoke-dialog { border-color:#41364e; background:#17141d; }
    :host-context(html.marketplace-dark) .revoke-dialog__header { background:linear-gradient(135deg,#2d191b,#17141d 72%); }
    :host-context(html.marketplace-dark) .revoke-dialog__header h2, :host-context(html.marketplace-dark) .revoke-dialog__body label { color:#f3edf8; }
    :host-context(html.marketplace-dark) .revoke-dialog__body > p { color:#c3b9cf; }
    :host-context(html.marketplace-dark) .revoke-dialog__body textarea { border-color:#4a4055; background:#211e27; color:#f3edf8; }
    :host-context(html.marketplace-dark) .revoke-dialog__close, :host-context(html.marketplace-dark) .revoke-dialog__cancel { background:#302a38; color:#e7dfee; }
    @media(max-width:520px) { .revoke-dialog__header { padding:23px 18px 17px; } .revoke-dialog__body { padding-inline:18px; } .revoke-dialog__actions { flex-direction:column-reverse; padding-inline:18px; } .revoke-dialog__actions button { width:100%; } }
  `],
})
export class RevokeSanctionDialogComponent {
  readonly data = inject<RevokeSanctionDialogData>(MAT_DIALOG_DATA);
  readonly reason = signal('');
  private readonly dialog = inject<MatDialogRef<RevokeSanctionDialogComponent, RevokeSanctionDialogResult>>(MatDialogRef);
  close(): void { this.dialog.close(); }
  confirm(): void { const reason = this.reason().trim(); if (reason) this.dialog.close({ reason }); }
}
