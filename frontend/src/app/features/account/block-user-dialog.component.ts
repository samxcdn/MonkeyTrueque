import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface BlockUserDialogData { readonly name: string; }

@Component({
  selector: 'app-block-user-dialog',
  standalone: true,
  imports: [MatDialogModule, MatIconModule],
  template: `
    <section class="block-dialog" aria-labelledby="block-dialog-title">
      <header class="block-dialog__header">
        <h2 id="block-dialog-title">Bloquear usuario</h2>
        <button type="button" class="block-dialog__close" aria-label="Cerrar" (click)="close()"><mat-icon fontSet="material-icons-outlined">close</mat-icon></button>
      </header>
      <div class="block-dialog__content">
        <p>¿Bloquear a <strong>{{ data.name }}</strong>?</p>
        <ul>
          <li>Esta persona no podrá iniciar nuevos chats contigo.</li>
          <li>Este chat se archivará en tu bandeja y no podrán enviarse mensajes mientras dure el bloqueo.</li>
          <li>Puedes desbloquear a esta persona desde Mi perfil.</li>
        </ul>
      </div>
      <footer class="block-dialog__actions">
        <button type="button" class="block-dialog__cancel" (click)="close()">Cancelar</button>
        <button type="button" class="block-dialog__confirm" (click)="confirm()">Bloquear</button>
      </footer>
    </section>
  `,
  styles: [`
    :host { display:block; color:var(--mt-ink,#f2eef8); }
    .block-dialog { overflow:hidden; border-radius:18px; background:var(--mt-card,#211b2a); }
    .block-dialog__header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px 22px; border-bottom:1px solid var(--mt-line,#393141); }
    .block-dialog__header h2 { margin:0; font-size:19px; font-weight:650; }
    .block-dialog__close { display:grid; width:30px; height:30px; place-items:center; border:0; border-radius:50%; background:transparent; color:var(--mt-muted,#b5adbf); cursor:pointer; }
    .block-dialog__close mat-icon { width:19px; height:19px; font-size:19px; }
    .block-dialog__content { padding:20px 22px 18px; color:var(--mt-muted,#b5adbf); font-size:14px; line-height:1.5; }
    .block-dialog__content p { margin:0 0 7px; }
    .block-dialog__content strong { color:var(--mt-ink,#f2eef8); }
    .block-dialog__content ul { margin:0; padding-left:18px; }
    .block-dialog__actions { display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid var(--mt-line,#393141); }
    .block-dialog__actions button { min-height:36px; padding:0 16px; border:0; border-radius:999px; font:inherit; font-size:12px; font-weight:600; cursor:pointer; }
    .block-dialog__cancel { background:transparent; color:var(--mt-muted,#b5adbf); }
    .block-dialog__confirm { background:#481517; color:#ff7479; }
    .block-dialog__confirm:hover { background:#5a1a1c; }
  `],
})
export class BlockUserDialogComponent {
  private readonly dialog = inject<MatDialogRef<BlockUserDialogComponent, boolean>>(MatDialogRef);
  readonly data = inject<BlockUserDialogData>(MAT_DIALOG_DATA);
  close(): void { this.dialog.close(false); }
  confirm(): void { this.dialog.close(true); }
}
