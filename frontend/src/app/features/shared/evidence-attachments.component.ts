import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export interface EvidenceImageDraft { readonly fileName: string; readonly data: string; }

@Component({
  selector: 'app-evidence-attachments',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './evidence-attachments.component.html',
  styleUrl: './evidence-attachments.component.scss',
})
export class EvidenceAttachmentsComponent {
  private readonly maxFiles = 3;
  private readonly maxBytes = 1_572_864;
  @Output() readonly attachmentsChange = new EventEmitter<readonly EvidenceImageDraft[]>();
  readonly attachments = signal<EvidenceImageDraft[]>([]);
  readonly error = signal('');
  readonly allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

  async readFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.error.set('');
    if (this.attachments().length + files.length > this.maxFiles) {
      this.error.set('Puedes adjuntar hasta 3 imágenes.');
      return;
    }
    const accepted = [...this.attachments()];
    for (const file of files) {
      if (!this.allowedTypes.includes(file.type)) { this.error.set('Usa imágenes JPG, PNG o WebP.'); continue; }
      if (file.size > this.maxBytes) { this.error.set('Cada imagen debe pesar como máximo 1.5 MB.'); continue; }
      try { accepted.push({ fileName: file.name.slice(0, 160), data: await this.asDataUrl(file) }); }
      catch { this.error.set('No se pudo leer una de las imágenes.'); }
    }
    this.attachments.set(accepted);
    this.attachmentsChange.emit(accepted);
  }

  remove(index: number): void {
    const next = this.attachments().filter((_, current) => current !== index);
    this.attachments.set(next);
    this.error.set('');
    this.attachmentsChange.emit(next);
  }

  private asDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image'));
      reader.onerror = () => reject(reader.error ?? new Error('Could not read image'));
      reader.readAsDataURL(file);
    });
  }
}
