import { createFeatureSelector, createSelector } from '@ngrx/store';
import type { AppState, MarketplaceState } from '../../../core/models/marketplace.models';

export const selectMarketplaceState = createFeatureSelector<MarketplaceState>('marketplace');
export const selectDistricts = createSelector(selectMarketplaceState, (state) => state.districts);
export const selectListings = createSelector(selectMarketplaceState, (state) => state.listings);
export const selectCommunities = createSelector(selectMarketplaceState, (state) => state.communities);
export const selectSelectedDistrictId = createSelector(selectMarketplaceState, (state) => state.selectedDistrictId);
export const selectFilters = createSelector(selectMarketplaceState, (state) => state.filters);
export const selectExchange = createSelector(selectMarketplaceState, (state) => state.exchange);
export const selectSelectedDistrict = createSelector(selectDistricts, selectSelectedDistrictId,
  (districts, id) => districts.find((district) => district.id === id) ?? districts[0]);
export const selectNeighboringDistricts = createSelector(selectDistricts, selectSelectedDistrict,
  selectSelectedDistrictId,
  (districts, selected, selectedId) => selectedId === 'all' ? districts : districts.filter((district) => selected.neighbors.includes(district.id)));
export const selectDistrictCommunities = createSelector(selectCommunities, selectSelectedDistrictId, selectNeighboringDistricts,
  (communities, districtId, neighbors) => {
    if (districtId === 'all') return communities;
    const nearbyIds = new Set([districtId, ...neighbors.map((district) => district.id)]);
    return communities.filter((community) => nearbyIds.has(community.districtId));
  });
export const selectVisibleListings = createSelector(selectListings, selectSelectedDistrictId, selectFilters,
  (listings, districtId, filters) => listings.filter((listing) => {
    if (districtId !== 'all' && listing.districtId !== districtId) return false;
    if (filters.category !== 'all' && listing.category !== filters.category) return false;
    if (filters.kind !== 'all' && listing.kind !== filters.kind) return false;
    if (filters.accepts !== 'all' && !listing.accepts.includes(filters.accepts)) return false;
    if (filters.query.trim()) {
      const text = `${listing.title} ${listing.description} ${listing.acceptanceSummary} ${listing.districtId}`.toLocaleLowerCase('es-PE');
      if (!text.includes(filters.query.trim().toLocaleLowerCase('es-PE'))) return false;
    }
    return true;
  }).sort((first, second) => first.distanceKm - second.distanceKm));
export const selectVisibleOfferCount = createSelector(selectVisibleListings, (listings) => listings.length);
export const selectAppMarketplace = (state: AppState): MarketplaceState => state.marketplace;
