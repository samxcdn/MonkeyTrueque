import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import type { ConfirmationRole, ExchangeRating, Listing, ListingKind, ListingMode } from '../models/marketplace.models';

/** Estados del acuerdo dentro de una conversación, en el orden en que avanzan. */
export type AgreementStatus =
  | 'proposal-sent' | 'accepted' | 'meetup-proposed' | 'meetup-agreed' | 'confirmed-by-one'
  | 'confirmed-by-both' | 'rated' | 'rejected' | 'cancelled' | 'listing-closed';

export interface ServerExchange {
  readonly id: string;
  readonly conversationId: string | null;
  readonly listingId: string;
  readonly listingTitle: string;
  readonly ownerId: string;
  readonly proposerId: string;
  readonly offeredTitle: string;
  readonly offeredKind: ListingKind;
  readonly note: string;
  readonly status: AgreementStatus;
  readonly meetupPlace: string;
  readonly meetupDate: string;
  readonly meetupTime: string;
  readonly meetupProposedBy: ConfirmationRole | null;
  readonly ownerConfirmed: boolean;
  readonly proposerConfirmed: boolean;
  readonly ratings: Partial<Record<ConfirmationRole, ExchangeRating>>;
}

export interface ModerationEvidenceUpload { readonly fileName: string; readonly data: string; }

export interface DirectMessage {
  readonly id: string;
  readonly senderId: string;
  readonly text: string;
  readonly createdAt: string;
}

export interface DirectConversation {
  readonly id: string;
  readonly listingId: string;
  readonly listingTitle: string;
  readonly listingMode: ListingMode;
  readonly listingPrice: number | null;
  readonly listingPhotoUrl: string;
  readonly ownerId: string;
  readonly ownerName: string;
  readonly ownerImageUrl: string | null;
  readonly visitorId: string;
  readonly visitorName: string;
  readonly visitorImageUrl: string | null;
  readonly status: 'active' | 'closed';
  readonly updatedAt: string;
  readonly exchangeId?: string | null;
  readonly messages: readonly DirectMessage[];
}

export interface PublicProfile {
  readonly userId: string;
  readonly displayName: string;
  readonly imageUrl: string | null;
  readonly description: string | null;
  readonly communityIds: readonly string[];
  readonly districtId: string | null;
  readonly memberSince: string;
  readonly identityVerified: boolean;
  readonly countryCode?: string | null;
}

export interface PublicReview {
  readonly exchangeId: string;
  readonly participant: 'owner' | 'proposer';
  readonly listingId: string;
  readonly rating: number;
  readonly review: string | null;
  readonly listingTitle: string;
  readonly createdAt: string;
  readonly moderated: boolean;
}

export interface PublicReputation {
  readonly averageRating: number;
  readonly reviewCount: number;
  readonly completedCount: number;
  readonly reviews: readonly PublicReview[];
}

export interface UserSanction { readonly id: string; readonly restrictionType: 'publishing' | 'messaging' | 'all'; readonly reason: string; readonly startsAt: string; readonly expiresAt: string | null; }
export interface UserAppeal { readonly id: string; readonly sanctionId: string; readonly userId: string; readonly explanation: string; readonly status: string; readonly reviewedBy: string | null; readonly resolution: string | null; readonly createdAt: string; readonly reviewedAt: string | null; }

@Injectable({ providedIn: 'root' })
export class MarketplaceApiService {
  private readonly auth = inject(AuthService);
  private readonly catalogUrl = document.querySelector<HTMLMetaElement>('meta[name="catalog-api-url"]')?.content || 'http://localhost:8081';
  private readonly exchangeUrl = document.querySelector<HTMLMetaElement>('meta[name="exchange-api-url"]')?.content || 'http://localhost:8082';

  listings(): Promise<Listing[]> { return this.request<Listing[]>(`${this.catalogUrl}/api/listings`); }
  listing(id: string): Promise<Listing> { return this.request<Listing>(`${this.catalogUrl}/api/listings/${encodeURIComponent(id)}`); }
  myListings(): Promise<Listing[]> { return this.request<Listing[]>(`${this.catalogUrl}/api/listings/mine`, 'GET', undefined, true); }
  syncMyProfileImage(imageUrl: string): Promise<void> {
    return this.request<void>(`${this.catalogUrl}/api/listings/mine/profile-image`, 'PUT', { imageUrl });
  }
  syncMyProfile(displayName: string, imageUrl: string, description?: string, communityIds?: readonly string[], districtId?: string, phone?: string, department?: string, countryCode?: string): Promise<PublicProfile> {
    return this.request<PublicProfile>(`${this.catalogUrl}/api/profiles/me`, 'PUT', { displayName, imageUrl: imageUrl || null, description, communityIds, districtId, phone, department, countryCode });
  }
  profile(id: string): Promise<PublicProfile> { return this.request<PublicProfile>(`${this.catalogUrl}/api/profiles/${encodeURIComponent(id)}`); }
  reputation(id: string): Promise<PublicReputation> { return this.request<PublicReputation>(`${this.exchangeUrl}/api/profiles/${encodeURIComponent(id)}/reputation`); }
  publish(listing: Listing): Promise<Listing> {
    const { id, distanceKm, isDemo, ownerName, ownerImageUrl, ...content } = listing;
    return this.request<Listing>(`${this.catalogUrl}/api/listings`, 'POST', content);
  }
  updateListing(listing: Listing): Promise<Listing> {
    const { id, distanceKm, isDemo, ownerName, ownerImageUrl, ...content } = listing;
    return this.request<Listing>(`${this.catalogUrl}/api/listings/${id}`, 'PUT', content);
  }
  deleteListing(id: string): Promise<void> {
    return this.request<void>(`${this.catalogUrl}/api/listings/${id}`, 'DELETE');
  }
  exchanges(): Promise<ServerExchange[]> { return this.request<ServerExchange[]>(`${this.exchangeUrl}/api/exchanges/mine`, 'GET', undefined, true); }
  propose(conversationId: string, offeredTitle: string | null, offeredKind: ListingKind | null, note: string): Promise<ServerExchange> {
    return this.request<ServerExchange>(`${this.exchangeUrl}/api/exchanges`, 'POST', { conversationId, offeredTitle, offeredKind, note });
  }
  acceptProposal(id: string): Promise<ServerExchange> { return this.exchangeAction(id, 'accept'); }
  rejectProposal(id: string): Promise<ServerExchange> { return this.exchangeAction(id, 'reject'); }
  cancelAgreement(id: string): Promise<ServerExchange> { return this.exchangeAction(id, 'cancel'); }
  acceptMeetup(id: string): Promise<ServerExchange> { return this.exchangeAction(id, 'meetup/accept'); }
  meetup(id: string, place: string, date: string, time: string): Promise<ServerExchange> {
    return this.request<ServerExchange>(`${this.exchangeUrl}/api/exchanges/${id}/meetup`, 'POST', { place, date, time });
  }
  confirm(id: string): Promise<ServerExchange> { return this.exchangeAction(id, 'confirm'); }
  conversations(): Promise<DirectConversation[]> {
    return this.request<DirectConversation[]>(`${this.exchangeUrl}/api/conversations/mine`, 'GET', undefined, true);
  }
  blockUser(userId: string): Promise<void> {
    return this.request<void>(`${this.exchangeUrl}/api/conversations/blocks/${encodeURIComponent(userId)}`, 'POST', {});
  }
  blockedUsers(): Promise<string[]> { return this.request<string[]>(`${this.exchangeUrl}/api/conversations/blocks`, 'GET', undefined, true); }
  unblockUser(userId: string): Promise<void> { return this.request<void>(`${this.exchangeUrl}/api/conversations/blocks/${encodeURIComponent(userId)}`, 'DELETE'); }
  startConversation(listingId: string, message: string): Promise<DirectConversation> {
    return this.request<DirectConversation>(`${this.exchangeUrl}/api/conversations`, 'POST', { listingId, message });
  }
  sendDirectMessage(id: string, text: string): Promise<DirectConversation> {
    return this.request<DirectConversation>(`${this.exchangeUrl}/api/conversations/${id}/messages`, 'POST', { text });
  }
  rate(id: string, rating: number, review: string): Promise<ServerExchange> {
    return this.request<ServerExchange>(`${this.exchangeUrl}/api/exchanges/${id}/rating`, 'POST', { rating, review });
  }
  report(listingId: string | undefined, reason: string, details: string, target?: { type: 'listing' | 'user' | 'message' | 'review'; id: string; evidence?: string; attachments?: readonly ModerationEvidenceUpload[] }): Promise<void> {
    return this.request<void>(`${this.catalogUrl}/api/reports`, 'POST', {
      listingId, reason, details, targetType: target?.type ?? 'listing', targetId: target?.id, evidence: target?.evidence, attachments: target?.attachments,
    });
  }
  mySanctions(): Promise<UserSanction[]> { return this.request(`${this.catalogUrl}/api/moderation/me/sanctions`, 'GET', undefined, true); }
  myAppeals(): Promise<UserAppeal[]> { return this.request(`${this.catalogUrl}/api/appeals/mine`, 'GET', undefined, true); }
  appealSanction(sanctionId: string, explanation: string, attachments: readonly ModerationEvidenceUpload[] = []): Promise<UserAppeal> {
    return this.request(`${this.catalogUrl}/api/appeals`, 'POST', { sanctionId, explanation, attachments });
  }

  private exchangeAction(id: string, action: string): Promise<ServerExchange> {
    return this.request<ServerExchange>(`${this.exchangeUrl}/api/exchanges/${encodeURIComponent(id)}/${action}`, 'POST', {});
  }

  private async request<T>(url: string, method = 'GET', body?: object, authenticated = method !== 'GET'): Promise<T> {
    const headers: Record<string, string> = {};
    if (body) headers['Content-Type'] = 'application/json';
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new Error('El servidor tardó demasiado en responder. Vuelve a intentarlo.'));
      }, 20000);
    });
    let response: Response;
    try {
      // La sesión viaja en la cookie HttpOnly que el navegador adjunta con credentials: 'include'.
      if (authenticated) this.auth.requireSession();
      response = await Promise.race([fetch(url, { method, headers, credentials: 'include', body: body ? JSON.stringify(body) : undefined, signal: controller.signal }), timeout]);
    } catch (error) {
      if (controller.signal.aborted && error instanceof Error && error.message.includes('demasiado')) throw error;
      if (error instanceof Error && error.message.startsWith('Inicia sesión')) throw error;
      throw new Error('No se pudo conectar con el servidor. Inicia el backend e inténtalo de nuevo.');
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
    if (!response.ok) {
      if (response.status === 401) {
        if (authenticated) this.auth.sessionExpired();
        throw new Error('Tu sesión ha expirado. Inicia sesión nuevamente.');
      }
      if (response.status === 502 || response.status === 503 || response.status === 504) throw new Error('Un servicio de MonkeyTrueque no está disponible. Inténtalo de nuevo en unos minutos.');
      const rawError = await response.text().catch(() => '');
      let errorBody: Record<string, unknown> | null = null;
      try { errorBody = JSON.parse(rawError) as Record<string, unknown>; } catch { /* respuesta no JSON */ }
      // El backend explica en "detail" por qué no se pudo (por ejemplo, una regla del trueque).
      const detail = [errorBody?.['detail'], errorBody?.['message'], errorBody?.['reason']]
        .find((value): value is string => typeof value === 'string' && value.trim().length > 0 && !value.startsWith('Invalid request'));
      if (detail) throw new Error(detail);
      if (response.status === 403) throw new Error('No tienes permiso para realizar esta acción.');
      if (response.status === 404) throw new Error('No se encontró el recurso solicitado. Actualiza la página e inténtalo otra vez.');
      if (response.status === 409) throw new Error('El estado actual no permite completar esta acción. Actualiza la página e inténtalo de nuevo.');
      if (response.status === 410) throw new Error('La publicación ya no está disponible.');
      if (response.status === 400) {
        throw new Error('El servidor rechazó los datos enviados. Revisa los campos y el formato de la imagen.');
      }
      throw new Error(`No se pudo completar la operación (${response.status}).`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
