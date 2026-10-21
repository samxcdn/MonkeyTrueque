import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MarketplaceApiService } from '../../../core/data/marketplace-api.service';
import { EvidenceAttachmentsComponent, EvidenceImageDraft } from '../../shared/evidence-attachments.component';
import type { ConfirmationRole, District, DistrictId, ExchangeAgreement, Listing, ListingCategory, ListingKind, ListingMode, ListingPhoto } from '../../../core/models/marketplace.models';

export type MarketplaceDialogMode = 'listing' | 'proposal' | 'publish' | 'edit' | 'meetup' | 'rating' | 'report';

export interface MarketplaceDialogData {
  readonly mode: MarketplaceDialogMode;
  readonly listing?: Listing;
  readonly districts?: readonly District[];
  readonly selectedDistrictId?: DistrictId;
  readonly ownerName?: string;
  readonly exchange?: Pick<ExchangeAgreement, 'meetupPlace' | 'meetupDate' | 'meetupTime'> | null;
  readonly ratingRole?: ConfirmationRole;
  readonly reportListingId?: string;
}

export type MarketplaceDialogResult =
  | { readonly type: 'proposal'; readonly listingId: string; readonly offeredTitle: string; readonly offeredKind: ListingKind; readonly note: string }
  | { readonly type: 'proposal-requested'; readonly listing: Listing }
  | { readonly type: 'published'; readonly listing: Listing }
  | { readonly type: 'updated'; readonly listing: Listing }
  | { readonly type: 'meetup'; readonly place: string; readonly date: string; readonly time: string }
  | { readonly type: 'rating'; readonly role: ConfirmationRole; readonly rating: number; readonly review: string }
  | { readonly type: 'report-requested'; readonly listing: Listing }
  | { readonly type: 'reported'; readonly listingId?: string; readonly reason: string; readonly details: string; readonly attachments: readonly EvidenceImageDraft[] };

@Component({
  selector: 'app-marketplace-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, EvidenceAttachmentsComponent],
  templateUrl: './marketplace-dialog.component.html',
  styleUrl: './marketplace-dialog.component.scss',
})
export class MarketplaceDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly data = inject<MarketplaceDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<MarketplaceDialogComponent, MarketplaceDialogResult>>(MatDialogRef);
  private readonly api = inject(MarketplaceApiService);

  readonly categories: { value: ListingCategory; label: string }[] = [
    { value: 'electronics', label: 'Electrónica' }, { value: 'clothing', label: 'Ropa y accesorios' },
    { value: 'beauty', label: 'Belleza y cuidado personal' }, { value: 'babies', label: 'Bebés y niños' },
    { value: 'sports', label: 'Deportes y aire libre' }, { value: 'toys', label: 'Juguetes, hobbies y coleccionables' },
    { value: 'food', label: 'Alimentos y bebidas' }, { value: 'other', label: 'Otros' },
    { value: 'home', label: 'Hogar y muebles' }, { value: 'school', label: 'Útiles escolares' },
    { value: 'books', label: 'Libros, música y películas' }, { value: 'mobility', label: 'Movilidad' },
    { value: 'decor', label: 'Decoración' }, { value: 'services', label: 'Servicios' },
  ];
  get availableCategories(): readonly { value: ListingCategory; label: string }[] {
    return this.categories.filter(({ value }) => this.publishForm.controls.kind.value === 'service' ? value === 'services' : value !== 'services');
  }
  readonly offerForm = this.fb.nonNullable.group({
    offeredTitle: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(70)]],
    offeredKind: [this.data.listing?.accepts[0] ?? ('object' as ListingKind), Validators.required],
    note: ['', Validators.maxLength(180)],
  });
  readonly publishForm = this.fb.nonNullable.group({
    mode: ['trade' as ListingMode, Validators.required],
    price: [null as number | null],
    title: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(70)]],
    description: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(320)]],
    kind: ['object' as ListingKind, Validators.required],
    condition: ['Buen estado' as Listing['condition'], Validators.required],
    districtId: [this.data.selectedDistrictId ?? ('' as DistrictId), Validators.required],
    locationReference: ['', Validators.maxLength(160)],
    category: ['home' as ListingCategory, Validators.required],
    accepts: ['object' as ListingKind, Validators.required],
    acceptanceSummary: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(70)]],
  });
  readonly meetupForm = this.fb.nonNullable.group({
    place: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(90)]],
    date: ['', Validators.required],
    time: ['', Validators.required],
  });
  readonly reportForm = this.fb.nonNullable.group({
    reason: ['', Validators.required],
    details: ['', Validators.maxLength(220)],
  });
  reportAttachments: readonly EvidenceImageDraft[] = [];
  rating = 0;
  ratingReview = '';
  photos: ListingPhoto[] = [];
  photoError = '';
  publishError = '';
  publishing = false;
  get isTrade(): boolean { return this.publishForm.controls.mode.value === 'trade'; }
  get isSale(): boolean { return this.publishForm.controls.mode.value === 'sale'; }
  readonly today = this.formatToday();

  constructor() {
    const listing = this.data.mode === 'edit' ? this.data.listing : undefined;
    if (listing) {
      this.publishForm.patchValue({
        mode: listing.mode ?? 'trade', price: listing.price ?? null, title: listing.title,
        description: listing.description, kind: listing.kind, condition: listing.condition,
        districtId: listing.districtId, locationReference: listing.locationReference ?? '', category: listing.category, accepts: listing.accepts[0] ?? 'object',
        acceptanceSummary: listing.acceptanceSummary,
      });
      this.photos = [...listing.photos];
      this.onListingModeChange(listing.mode ?? 'trade');
    }
    this.meetupForm.patchValue({
      place: this.data.exchange?.meetupPlace ?? '',
      date: this.data.exchange?.meetupDate ?? '',
      time: this.data.exchange?.meetupTime ?? '',
    });
  }

  get title(): string {
    const titles: Record<MarketplaceDialogMode, string> = {
      listing: 'Detalles de la publicación', proposal: 'Propón un intercambio', publish: 'Publica lo que ya no usas', edit: 'Edita tu publicación',
      meetup: 'Acuerden lugar y fecha', rating: 'Califica el intercambio', report: 'Reportar publicación',
    };
    return titles[this.data.mode];
  }

  get formMode(): MarketplaceDialogMode {
    return this.data.mode === 'edit' ? 'publish' : this.data.mode;
  }

  requestProposal(): void {
    const listing = this.data.listing;
    if (listing) this.dialogRef.close({ type: 'proposal-requested', listing });
  }

  onListingKindChange(kind: ListingKind): void {
    this.publishForm.controls.kind.setValue(kind);
    if (kind === 'service') {
      this.publishForm.controls.category.setValue('services');
    } else if (this.publishForm.controls.category.value === 'services') {
      this.publishForm.controls.category.setValue('home');
    }
  }

  onListingModeChange(mode: ListingMode): void {
    this.publishForm.controls.mode.setValue(mode);
    const acceptance = this.publishForm.controls.acceptanceSummary;
    if (mode === 'trade') acceptance.addValidators([Validators.required, Validators.minLength(3)]);
    else acceptance.clearValidators();
    acceptance.updateValueAndValidity();
    const price = this.publishForm.controls.price;
    if (mode === 'sale') price.setValidators([Validators.required, Validators.min(0.01)]);
    else if (mode === 'trade') price.setValidators([Validators.min(0.01)]);
    else price.clearValidators();
    price.updateValueAndValidity();
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    if (this.photos.length + files.length > 3) {
      this.photoError = 'Puedes agregar hasta 3 fotos por publicación.';
      return;
    }
    const invalid = files.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10_000_000);
    if (invalid) {
      this.photoError = 'Cada foto debe ser JPG, PNG o WebP y pesar hasta 10 MB.';
      return;
    }
    try {
      const added = await Promise.all(files.map((file) => this.readPhoto(file)));
      this.photos = [...this.photos, ...added.map((src) => ({
        src, alt: `${this.publishForm.controls.title.value || 'Publicación'}; foto añadida por quien publica.`, credit: 'Foto añadida por quien publica',
      }))];
      this.photoError = '';
    } catch {
      this.photoError = 'No se pudieron leer las fotos. Inténtalo de nuevo.';
    }
  }

  removePhoto(index: number): void { this.photos = this.photos.filter((_, photoIndex) => photoIndex !== index); }

  showError(controlName: string): boolean {
    const control = this.publishForm.get(controlName) ?? this.offerForm.get(controlName) ?? this.meetupForm.get(controlName) ?? this.reportForm.get(controlName);
    return Boolean(control?.invalid && control?.touched);
  }

  submitProposal(): void {
    if (this.offerForm.invalid || !this.data.listing) {
      this.offerForm.markAllAsTouched();
      return;
    }
    const value = this.offerForm.getRawValue();
    this.dialogRef.close({ type: 'proposal', listingId: this.data.listing.id, ...value });
  }

  async submitPublish(): Promise<void> {
    if (this.publishForm.invalid || this.photos.length === 0) {
      this.publishForm.markAllAsTouched();
      if (this.photos.length === 0) this.photoError = 'Agrega al menos una foto para publicar.';
      return;
    }
    if (this.publishing) return;
    this.publishing = true;
    this.publishError = '';
    const value = this.publishForm.getRawValue();
    const listing: Listing = {
      id: this.data.listing?.id ?? `pending-${Date.now()}`,
      ownerId: this.data.listing?.ownerId,
      title: value.title,
      description: value.description,
      kind: value.kind,
      mode: value.mode,
      price: value.mode === 'gift' ? null : value.price,
      category: value.kind === 'service' ? 'services' : value.category,
      condition: value.condition,
      districtId: value.districtId,
      locationReference: value.locationReference.trim(),
      distanceKm: 0.4,
      photos: this.photos.map((photo) => ({ ...photo, alt: photo.alt || `${value.title}; foto añadida por quien publica.` })),
      accepts: value.mode === 'trade' ? [value.accepts] : [],
      acceptanceSummary: value.mode === 'trade' ? value.acceptanceSummary : '',
      ownerName: 'Tu publicación',
    };
    try {
      const saved = this.data.mode === 'edit'
        ? await this.api.updateListing(listing)
        : await this.api.publish(listing);
      this.dialogRef.close(this.data.mode === 'edit' ? { type: 'updated', listing: saved } : { type: 'published', listing: saved });
    } catch (error) {
      this.publishError = error instanceof Error ? error.message : 'No se pudo guardar la publicación. Inténtalo otra vez.';
    } finally {
      this.publishing = false;
    }
  }

  submitMeetup(): void {
    if (this.meetupForm.invalid) { this.meetupForm.markAllAsTouched(); return; }
    this.dialogRef.close({ type: 'meetup', ...this.meetupForm.getRawValue() });
  }

  setRating(value: number): void { this.rating = value; }

  get ratingNeedsReview(): boolean { return this.rating > 0 && this.rating <= 2; }
  get canSubmitRating(): boolean {
    return this.rating >= 1 && (!this.ratingNeedsReview || this.ratingReview.trim().length >= 30);
  }

  submitRating(): void {
    if (!this.canSubmitRating) return;
    this.dialogRef.close({ type: 'rating', role: this.data.ratingRole ?? 'proposer', rating: this.rating, review: this.ratingReview.trim() });
  }

  submitReport(): void {
    if (this.reportForm.invalid) { this.reportForm.markAllAsTouched(); return; }
    this.dialogRef.close({ type: 'reported', listingId: this.data.reportListingId ?? this.data.listing?.id, ...this.reportForm.getRawValue(), attachments: this.reportAttachments });
  }

  quickReport(): void {
    if (this.data.listing) this.dialogRef.close({ type: 'report-requested', listing: this.data.listing });
  }

  private formatToday(): string {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private readPhoto(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image data'));
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read image'));
      reader.readAsDataURL(file);
    });
  }
}
