import { CommonModule } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DEMO_COMMUNITIES, DEMO_DISTRICTS } from '../../core/data/demo-marketplace.data';
import { MarketplaceApiService, type PublicProfile } from '../../core/data/marketplace-api.service';
import { MarketplaceHeaderComponent } from '../marketplace/marketplace-header.component';

interface SavedPreferences {
  districtId: string;
  districtExplicit: boolean;
  meetupPlace: string;
  exchangeObjects: boolean;
  exchangeServices: boolean;
  communityIds: string[];
  whatsappNotifications: boolean;
}

const defaultPreferences: SavedPreferences = {
  districtId: '', districtExplicit: false, meetupPlace: '', exchangeObjects: true, exchangeServices: true,
  communityIds: [], whatsappNotifications: false,
};

@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule, RouterLink, MarketplaceHeaderComponent],
  templateUrl: './account-settings.component.html',
})
export class AccountSettingsComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(MarketplaceApiService);
  private readonly snackBar = inject(MatSnackBar);
  private loadedUserId = '';

  readonly user = this.auth.user;
  readonly authStatus = this.auth.status;
  readonly districts = DEMO_DISTRICTS;
  readonly communities = DEMO_COMMUNITIES;
  readonly profile = signal<PublicProfile | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly name = signal('');
  readonly description = signal('');
  readonly selectedPhoto = signal<File | null>(null);
  readonly photoPreview = signal('');
  readonly photoError = signal('');
  readonly preferences = signal<SavedPreferences>({ ...defaultPreferences });

  constructor() {
    effect(() => {
      const user = this.user();
      const status = this.authStatus();
      if (!user) {
        if (status !== 'loading') this.loading.set(false);
        return;
      }
      if (user.id === this.loadedUserId) return;
      this.loadedUserId = user.id;
      this.name.set(user.name);
      this.photoPreview.set(user.imageUrl);
      this.loadSettings(user.id);
    });
  }

  private async loadSettings(userId: string): Promise<void> {
    this.loading.set(true);
    try {
      const profile = await this.api.profile(userId).catch(async () => this.api.syncMyProfile(this.user()?.name ?? '', this.user()?.imageUrl ?? ''));
      if (this.user()?.id !== userId) return;
      this.profile.set(profile);
      this.name.set(profile.displayName || this.user()?.name || '');
      this.description.set(profile.description || '');
      this.photoPreview.set(profile.imageUrl || this.user()?.imageUrl || '');
      const savedPreferences = this.readPreferences(userId);
      const hasLocalPreferences = localStorage.getItem(this.preferencesKey(userId)) !== null;
      const districtWasSelected = savedPreferences.districtExplicit || (!hasLocalPreferences && Boolean(profile.districtId));
      this.preferences.set({
        ...savedPreferences,
        communityIds: profile.communityIds?.length ? [...profile.communityIds] : savedPreferences.communityIds,
        districtId: districtWasSelected ? (profile.districtId || savedPreferences.districtId) : '',
        districtExplicit: districtWasSelected,
      });
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : 'No se pudo cargar tu perfil.', 'Cerrar', { duration: 4500 });
    } finally {
      this.loading.set(false);
    }
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
      this.photoError.set('Elige una imagen JPG, PNG o WebP de hasta 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.selectedPhoto.set(file);
      this.photoPreview.set(String(reader.result ?? ''));
      this.photoError.set('');
    };
    reader.onerror = () => this.photoError.set('No se pudo leer la imagen. Inténtalo de nuevo.');
    reader.readAsDataURL(file);
  }

  setPreference<K extends keyof SavedPreferences>(key: K, value: SavedPreferences[K]): void {
    this.preferences.update((current) => ({ ...current, [key]: value }));
  }

  setDistrict(value: string): void {
    this.preferences.update((current) => ({ ...current, districtId: value, districtExplicit: Boolean(value) }));
  }

  toggleCommunity(id: string): void {
    const current = this.preferences().communityIds;
    this.setPreference('communityIds', current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  communitySelected(id: string): boolean { return this.preferences().communityIds.includes(id); }

  async save(): Promise<void> {
    const user = this.user();
    const displayName = this.name().trim();
    if (!user) return;
    if (!displayName || displayName.length > 120) {
      this.snackBar.open('El nombre debe tener entre 1 y 120 caracteres.', 'Cerrar', { duration: 3500 });
      return;
    }
    if (this.description().length > 500) {
      this.snackBar.open('La descripción puede tener hasta 500 caracteres.', 'Cerrar', { duration: 3500 });
      return;
    }
    this.saving.set(true);
    try {
      const updatedUser = await this.auth.updateProfile(displayName, this.selectedPhoto() ?? undefined);
      const savedProfile = await this.api.syncMyProfile(updatedUser.name, updatedUser.imageUrl, this.description().trim(), this.preferences().communityIds, this.preferences().districtId);
      this.profile.set(savedProfile);
      this.preferences.update((current) => ({ ...current, communityIds: [...(savedProfile.communityIds ?? [])] }));
      this.photoPreview.set(updatedUser.imageUrl);
      this.selectedPhoto.set(null);
      this.writePreferences(user.id);
      if (updatedUser.imageUrl) await this.api.syncMyProfileImage(updatedUser.imageUrl).catch(() => undefined);
      this.snackBar.open('Tu perfil y preferencias se guardaron.', 'Cerrar', { duration: 3200 });
    } catch (error) {
      this.snackBar.open(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.', 'Cerrar', { duration: 5000 });
    } finally {
      this.saving.set(false);
    }
  }

  initials(): string { return this.name().trim().charAt(0).toUpperCase() || '?'; }
  memberSince(): string {
    const date = this.profile()?.memberSince;
    return date ? new Intl.DateTimeFormat('es-PE', { month: 'short', year: 'numeric' }).format(new Date(date)) : 'Miembro reciente';
  }

  private preferencesKey(userId: string): string { return `monkeytrueque.accountPreferences.${userId}`; }
  private readPreferences(userId: string): SavedPreferences {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.preferencesKey(userId)) ?? '{}') as Partial<SavedPreferences>;
      return {
        ...defaultPreferences,
        ...parsed,
        districtId: parsed.districtExplicit === true && typeof parsed.districtId === 'string' ? parsed.districtId : '',
        districtExplicit: parsed.districtExplicit === true && Boolean(parsed.districtId),
        communityIds: Array.isArray(parsed.communityIds) ? parsed.communityIds : [],
      };
    } catch { return { ...defaultPreferences }; }
  }
  private writePreferences(userId: string): void {
    try { localStorage.setItem(this.preferencesKey(userId), JSON.stringify(this.preferences())); }
    catch { this.snackBar.open('Se guardó tu perfil, pero no se pudieron guardar algunas preferencias en este navegador.', 'Cerrar', { duration: 4500 }); }
  }
}
