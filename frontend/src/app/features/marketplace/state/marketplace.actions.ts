import { createAction, props } from '@ngrx/store';
import type { AcceptedKind, ConfirmationRole, DistrictSelection, ExchangeAgreement, ExchangeChatMessage, Listing, ListingCategory, ListingKind } from '../../../core/models/marketplace.models';

export const setDistrict = createAction('[Marketplace] Set district', props<{ districtId: DistrictSelection }>());
export const setQuery = createAction('[Marketplace] Set search query', props<{ query: string }>());
export const setCategory = createAction('[Marketplace] Set category', props<{ category: ListingCategory | 'all' }>());
export const setListingKind = createAction('[Marketplace] Set listing kind', props<{ kind: ListingKind | 'all' }>());
export const setAcceptedKind = createAction('[Marketplace] Set accepted kind', props<{ accepts: AcceptedKind | 'all' }>());
export const addListing = createAction('[Marketplace] Add demo listing', props<{ listing: Listing }>());
export const setListings = createAction('[Marketplace] Load server listings', props<{ listings: readonly Listing[] }>());
export const setExchange = createAction('[Exchange] Load server exchange', props<{ exchange: ExchangeAgreement | null }>());
export const resetDemoSession = createAction('[Marketplace] Reset demo session');
export const startExchange = createAction('[Exchange] Start demo exchange', props<{ listingId: string; offeredTitle: string; offeredKind: ListingKind; note: string }>());
export const saveMeetup = createAction('[Exchange] Save meetup details', props<{ place: string; date: string; time: string }>());
export const confirmDelivery = createAction('[Exchange] Confirm delivery', props<{ role: ConfirmationRole }>());
export const addExchangeMessage = createAction('[Exchange] Add local chat message', props<{ message: ExchangeChatMessage }>());
export const rateExchange = createAction('[Exchange] Rate confirmed exchange', props<{ role: ConfirmationRole; rating: number; review: string }>());
