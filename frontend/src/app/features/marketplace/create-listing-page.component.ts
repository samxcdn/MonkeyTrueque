import { CommonModule } from '@angular/common';
import { Component, effect, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DEMO_DISTRICTS } from '../../core/data/demo-marketplace.data';
import { MarketplaceApiService } from '../../core/data/marketplace-api.service';
import type { District, Listing, ListingCategory, ListingKind, ListingMode, ListingPhoto } from '../../core/models/marketplace.models';
import { MarketplaceHeaderComponent } from './marketplace-header.component';

@Component({
  selector: 'app-create-listing-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatSnackBarModule, MarketplaceHeaderComponent],
  templateUrl: './create-listing-page.component.html',
  styleUrl: './create-listing-page.component.scss',
})
export class CreateListingPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly api = inject(MarketplaceApiService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  readonly user = this.auth.user;
  readonly districts: readonly District[] = DEMO_DISTRICTS;
  readonly categories: { value: ListingCategory; label: string }[] = [
    { value: 'electronics', label: 'Electrónica' }, { value: 'clothing', label: 'Ropa y accesorios' },
    { value: 'beauty', label: 'Belleza y cuidado personal' }, { value: 'babies', label: 'Bebés y niños' },
    { value: 'sports', label: 'Deportes y aire libre' }, { value: 'toys', label: 'Juguetes, hobbies y coleccionables' },
    { value: 'food', label: 'Alimentos y bebidas' }, { value: 'other', label: 'Otros' },
    { value: 'home', label: 'Hogar y muebles' }, { value: 'school', label: 'Útiles escolares' },
    { value: 'books', label: 'Libros, música y películas' }, { value: 'mobility', label: 'Movilidad' },
    { value: 'decor', label: 'Decoración' }, { value: 'services', label: 'Servicios' },
  ];
  readonly form = this.fb.nonNullable.group({
    mode: ['trade' as ListingMode, Validators.required],
    price: [null as number | null],
    title: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(70)]],
    description: ['', [Validators.required, Validators.minLength(12), Validators.maxLength(320)]],
    kind: ['object' as ListingKind, Validators.required],
    condition: ['Buen estado' as Listing['condition'], Validators.required],
    districtId: ['' as Listing['districtId'], Validators.required],
    locationReference: ['', Validators.maxLength(160)],
    category: ['home' as ListingCategory, Validators.required],
    accepts: this.fb.nonNullable.control<ListingKind[]>(['object'], Validators.required),
    acceptanceSummary: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(70)]],
  });
  photos: ListingPhoto[] = [];
  photoError = '';
  error = '';
  submitting = false;
  step = 1;
  private loadedPreferencesFor = '';
  private readonly requestedDistrict = new URLSearchParams(window.location.search).get('district');

  get isTrade(): boolean { return this.form.controls.mode.value === 'trade'; }
  get isSale(): boolean { return this.form.controls.mode.value === 'sale'; }
  get availableCategories(): readonly { value: ListingCategory; label: string }[] {
    return this.categories.filter(({ value }) => this.form.controls.kind.value === 'service' ? value === 'services' : value !== 'services');
  }
  get selectedCategoryLabel(): string {
    return this.categories.find(({ value }) => value === this.form.controls.category.value)?.label ?? '';
  }

  constructor() {
    effect(() => {
      const user = this.user();
      if (!user || this.loadedPreferencesFor === user.id) return;
      this.loadedPreferencesFor = user.id;
      const preferences = this.readAccountLocation(user.id);
      if (preferences.locationReference) this.form.controls.locationReference.setValue(preferences.locationReference);
      const preferredDistrict = this.isDistrict(preferences.districtId) ? preferences.districtId : '';
      const queryDistrict = this.isDistrict(this.requestedDistrict) ? this.requestedDistrict : '';
      if (queryDistrict || preferredDistrict) this.form.controls.districtId.setValue((queryDistrict || preferredDistrict) as Listing['districtId']);
      void this.api.profile(user.id).then((profile) => {
        if (this.user()?.id === user.id && !queryDistrict && preferences.useProfileDistrict && this.isDistrict(profile.districtId)) {
          this.form.controls.districtId.setValue(profile.districtId as Listing['districtId']);
        }
      }).catch(() => undefined);
    });
    this.onModeChange('trade');
  }

  private readAccountLocation(userId: string): { districtId: string; locationReference: string; useProfileDistrict: boolean } {
    const key = `monkeytrueque.accountPreferences.${userId}`;
    const hasSavedPreferences = localStorage.getItem(key) !== null;
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? '{}') as { districtId?: unknown; districtExplicit?: unknown; meetupPlace?: unknown };
      return {
        districtId: saved.districtExplicit === true && typeof saved.districtId === 'string' ? saved.districtId : '',
        locationReference: typeof saved.meetupPlace === 'string' ? saved.meetupPlace.trim() : '',
        useProfileDistrict: !hasSavedPreferences,
      };
    } catch { return { districtId: '', locationReference: '', useProfileDistrict: !hasSavedPreferences }; }
  }

  private isDistrict(value: string | null | undefined): value is Listing['districtId'] {
    return Boolean(value && this.districts.some((district) => district.id === value));
  }

  onModeChange(mode: ListingMode): void {
    this.form.controls.mode.setValue(mode);
    const price = this.form.controls.price;
    if (mode === 'sale') price.setValidators([Validators.required, Validators.min(0.01)]);
    else if (mode === 'trade') price.setValidators([Validators.min(0.01)]);
    else price.clearValidators();
    price.updateValueAndValidity();
    const acceptance = this.form.controls.acceptanceSummary;
    if (mode === 'trade') acceptance.setValidators([Validators.required, Validators.minLength(3), Validators.maxLength(70)]);
    else acceptance.clearValidators();
    acceptance.updateValueAndValidity();
  }

  onKindChange(kind: ListingKind): void {
    this.form.controls.kind.setValue(kind);
    this.form.controls.category.setValue(kind === 'service' ? 'services' : 'home');
  }

  continueToDetails(): void {
    const required = [this.form.controls.title, this.form.controls.description, this.form.controls.kind, this.form.controls.condition, this.form.controls.price];
    required.forEach((control) => control.markAsTouched());
    const itemInvalid = this.form.controls.title.invalid || this.form.controls.description.invalid || this.form.controls.kind.invalid || this.form.controls.condition.invalid || (this.isSale && this.form.controls.price.invalid) || (this.isTrade && this.form.controls.price.value !== null && this.form.controls.price.invalid);
    if (this.photos.length === 0) this.photoError = 'Agrega al menos una foto para continuar.';
    if (itemInvalid || this.photos.length === 0) return;
    this.photoError = '';
    this.step = 2;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  backToOffer(): void { this.step = 1; window.scrollTo({ top: 0, behavior: 'smooth' }); }

  toggleAcceptedKind(kind: ListingKind): void {
    const current = this.form.controls.accepts.value;
    const next = current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind];
    this.form.controls.accepts.setValue(next);
    this.form.controls.accepts.markAsTouched();
    this.form.controls.accepts.updateValueAndValidity();
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    if (this.photos.length + files.length > 3) { this.photoError = 'Puedes agregar hasta 3 fotos por publicación.'; return; }
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10_000_000)) {
      this.photoError = 'Cada foto debe ser JPG, PNG o WebP y pesar hasta 10 MB.';
      return;
    }
    try {
      const sources = await Promise.all(files.map((file) => this.readPhoto(file)));
      this.photos = [...this.photos, ...sources.map((src) => ({ src, alt: `${this.form.controls.title.value || 'Publicación'}; foto añadida por quien publica.`, credit: 'Foto añadida por quien publica' }))];
      this.photoError = '';
    } catch { this.photoError = 'No se pudieron leer las fotos. Inténtalo de nuevo.'; }
  }

  removePhoto(index: number): void { this.photos = this.photos.filter((_, photoIndex) => photoIndex !== index); }

  async submit(): Promise<void> {
    if (!this.user()) { await this.signIn(); return; }
    if (this.form.invalid || !this.photos.length) {
      this.form.markAllAsTouched();
      if (!this.photos.length) this.photoError = 'Agrega al menos una foto para publicar.';
      return;
    }
    if (this.submitting) return;
    this.submitting = true;
    this.error = '';
    const value = this.form.getRawValue();
    const listing: Listing = {
      id: `pending-${Date.now()}`, title: value.title, description: value.description,
      kind: value.kind, mode: value.mode, price: value.mode === 'gift' ? null : value.price,
      category: value.kind === 'service' ? 'services' : value.category, condition: value.condition,
      districtId: value.districtId, locationReference: value.locationReference.trim(), distanceKm: 0.4,
      photos: this.photos.map((photo) => ({ ...photo, alt: photo.alt || `${value.title}; foto añadida por quien publica.` })),
      accepts: value.mode === 'trade' ? value.accepts : [],
      acceptanceSummary: value.mode === 'trade' ? value.acceptanceSummary : '',
      ownerName: this.user()?.name || 'Vecino',
    };
    try {
      await this.api.publish(listing);
      this.snackBar.open('Publicación guardada.', 'Cerrar', { duration: 3200 });
      await this.router.navigate(['/cuenta']);
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo guardar la publicación. Inténtalo otra vez.';
    } finally { this.submitting = false; }
  }

  async signIn(): Promise<void> {
    try { await this.auth.openSignIn(); }
    catch { this.error = 'No se pudo abrir el inicio de sesión.'; }
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
