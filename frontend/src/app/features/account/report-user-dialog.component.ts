import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { EvidenceAttachmentsComponent, EvidenceImageDraft } from '../shared/evidence-attachments.component';

export interface ReportUserDialogData { readonly name: string; readonly title?: string; readonly prompt?: string; }
export interface ReportUserDialogResult { readonly reason: string; readonly details: string; readonly attachments: readonly EvidenceImageDraft[]; }

@Component({
  selector: 'app-report-user-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, EvidenceAttachmentsComponent],
  templateUrl: './report-user-dialog.component.html',
  styleUrl: './report-user-dialog.component.scss',
})
export class ReportUserDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject<MatDialogRef<ReportUserDialogComponent, ReportUserDialogResult>>(MatDialogRef);
  readonly data = inject<ReportUserDialogData>(MAT_DIALOG_DATA);
  readonly form = this.fb.nonNullable.group({ reason: ['inappropriate', Validators.required], details: ['', Validators.maxLength(700)] });
  attachments: readonly EvidenceImageDraft[] = [];

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.dialog.close({ ...this.form.getRawValue(), attachments: this.attachments });
  }
}
