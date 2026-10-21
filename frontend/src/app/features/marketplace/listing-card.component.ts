import { CommonModule } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import type { Listing, ListingCategory } from '../../core/models/marketplace.models';

@Component({
  selector: 'app-listing-card',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  templateUrl: './listing-card.component.html',
  styleUrl: './listing-card.component.scss',
})
export class ListingCardComponent {
  private static readonly likesKey = 'monkeytrueque.likedListings';
  private readonly auth = inject(AuthService);
  readonly listing = input.required<Listing>();
  readonly districtName = input.required<string>();
  readonly layout = input<'grid' | 'list'>('grid');
  readonly detailsRequested = output<Listing>();
  readonly proposalRequested = output<Listing>();
  readonly reportRequested = output<Listing>();
  readonly favoriteChanged = output<{ listingId: string; liked: boolean }>();
  readonly liked = signal(false);

  ngOnInit(): void {
    this.liked.set(this.savedLikes().includes(this.listing().id));
  }

  toggleLike(): void {
    if (!this.auth.user()) {
      void this.auth.openSignIn(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      return;
    }
    const id = this.listing().id;
    const likes = this.savedLikes();
    const updated = this.liked() ? likes.filter((likedId) => likedId !== id) : [...likes, id];
    localStorage.setItem(ListingCardComponent.likesKey, JSON.stringify(updated));
    this.liked.set(!this.liked());
    this.favoriteChanged.emit({ listingId: id, liked: this.liked() });
  }

  private savedLikes(): string[] {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(ListingCardComponent.likesKey) ?? '[]');
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  }

  modeLabel(): string { return ({ trade: 'Trueque', sale: 'Venta', gift: 'Regalo' } as const)[this.listing().mode ?? 'trade']; }
  modeIcon(): string { return ({ trade: 'swap_horiz', sale: 'sell', gift: 'redeem' } as const)[this.listing().mode ?? 'trade']; }

  categoryLabel(category: ListingCategory): string {
    return ({ electronics: 'Electrónica', clothing: 'Ropa y accesorios', home: 'Hogar y muebles', beauty: 'Belleza y cuidado personal', babies: 'Bebés y niños', sports: 'Deportes y aire libre', toys: 'Juguetes, hobbies y coleccionables', school: 'Útiles escolares', books: 'Libros, música y películas', food: 'Alimentos y bebidas', other: 'Otros', mobility: 'Movilidad', decor: 'Decoración', services: 'Servicios' } as Record<ListingCategory, string>)[category];
  }
}
