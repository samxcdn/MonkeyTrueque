export type DistrictId =
  | 'ancon' | 'ate' | 'barranco' | 'brena' | 'carabayllo' | 'chaclacayo' | 'chorrillos'
  | 'cieneguilla' | 'comas' | 'el-agustino' | 'independencia' | 'jesus-maria' | 'la-molina'
  | 'la-victoria' | 'lima' | 'lince' | 'los-olivos' | 'lurigancho' | 'lurin' | 'magdalena-del-mar'
  | 'miraflores' | 'pachacamac' | 'pucusana' | 'pueblo-libre' | 'puente-piedra' | 'punta-hermosa'
  | 'punta-negra' | 'rimac' | 'san-bartolo' | 'san-borja' | 'san-isidro'
  | 'san-juan-de-lurigancho' | 'san-juan-de-miraflores' | 'san-luis' | 'san-martin-de-porres'
  | 'san-miguel' | 'santa-anita' | 'santa-maria-del-mar' | 'santa-rosa' | 'santiago-de-surco'
  | 'surquillo' | 'villa-el-salvador' | 'villa-maria-del-triunfo';
export type DistrictSelection = DistrictId | 'all';

export type ListingKind = 'object' | 'service';
export type ListingMode = 'trade' | 'sale' | 'gift';
export type AcceptedKind = ListingKind;
export type ListingCategory =
  | 'electronics'
  | 'clothing'
  | 'home'
  | 'beauty'
  | 'babies'
  | 'sports'
  | 'toys'
  | 'school'
  | 'books'
  | 'food'
  | 'other'
  | 'mobility'
  | 'decor'
  | 'services';
export type ListingCondition = 'Buen estado' | 'Funciona con marcas de uso';
export type ExchangeStatus =
  | 'proposal-sent'
  | 'meetup-agreed'
  | 'confirmed-by-one'
  | 'confirmed-by-both'
  | 'rated';
export type ConfirmationRole = 'owner' | 'proposer';
export type ExchangeChatSender = ConfirmationRole;

export interface ExchangeChatMessage {
  readonly id: string;
  readonly sender: ExchangeChatSender;
  readonly text: string;
}

export interface ExchangeRating {
  readonly rating: number;
  readonly review: string;
}

export interface District {
  readonly id: DistrictId;
  readonly name: string;
  readonly abbreviation: string;
  readonly demoOfferCount: number;
  readonly communityCount: number;
  readonly neighbors: readonly DistrictId[];
  readonly pinColor: string;
}

export interface ListingPhoto {
  readonly src: string;
  readonly alt: string;
  readonly credit: string;
  readonly publicId?: string;
}

export interface Listing {
  readonly id: string;
  readonly ownerId?: string;
  readonly title: string;
  readonly description: string;
  readonly kind: ListingKind;
  readonly mode?: ListingMode;
  readonly price?: number | null;
  readonly category: ListingCategory;
  readonly condition: ListingCondition;
  readonly districtId: DistrictId;
  readonly locationReference?: string | null;
  readonly distanceKm: number;
  readonly photos: readonly ListingPhoto[];
  readonly accepts: readonly AcceptedKind[];
  readonly acceptanceSummary: string;
  readonly ownerName: string;
  readonly ownerImageUrl?: string;
  readonly available?: boolean;
  readonly moderationHidden?: boolean;
  readonly moderationHiddenReason?: string | null;
  readonly isDemo?: boolean;
}

export interface Community {
  readonly id: string;
  readonly name: string;
  readonly districtId: DistrictId;
  readonly memberCount: number;
  readonly demoOfferCount: number;
  readonly isVerified: boolean;
  readonly verificationSummary: string;
}

export interface ListingFilters {
  readonly query: string;
  readonly category: ListingCategory | 'all';
  readonly kind: ListingKind | 'all';
  readonly accepts: AcceptedKind | 'all';
}

export interface ExchangeAgreement {
  readonly id?: string;
  readonly listingTitle?: string;
  readonly ownerId?: string;
  readonly proposerId?: string;
  readonly listingId: string;
  readonly offeredTitle: string;
  readonly offeredKind: ListingKind;
  readonly note: string;
  readonly status: ExchangeStatus;
  readonly meetupPlace: string;
  readonly meetupDate: string;
  readonly meetupTime: string;
  readonly ownerConfirmed: boolean;
  readonly proposerConfirmed: boolean;
  readonly messages: readonly ExchangeChatMessage[];
  readonly ratings: Partial<Record<ConfirmationRole, ExchangeRating>>;
}

export interface MarketplaceState {
  readonly districts: readonly District[];
  readonly listings: readonly Listing[];
  readonly communities: readonly Community[];
  readonly selectedDistrictId: DistrictSelection;
  readonly filters: ListingFilters;
  readonly exchange: ExchangeAgreement | null;
}

export interface AppState {
  readonly marketplace: MarketplaceState;
}
