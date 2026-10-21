import { initialMarketplaceState as emptyMarketplaceState } from './marketplace.reducer';
import { DEMO_LISTINGS } from '../../../core/data/demo-marketplace.data';
import { selectVisibleListings } from './marketplace.selectors';

describe('marketplace selectors', () => {
  const initialMarketplaceState = { ...emptyMarketplaceState, listings: DEMO_LISTINGS };
  const state = { marketplace: initialMarketplaceState };

  it('shows listings from every district by default, nearest first', () => {
    const listings = selectVisibleListings(state);
    expect(new Set(listings.map((listing) => listing.districtId)).size).toBeGreaterThan(1);
    expect(listings).toHaveSize(DEMO_LISTINGS.length);
  });

  it('filters listings to a district only after the user selects it', () => {
    const surquillo = selectVisibleListings({ marketplace: { ...initialMarketplaceState, selectedDistrictId: 'surquillo' } });
    expect(surquillo.map((listing) => listing.id)).toEqual([
      'mochila-floreada',
      'lampara-barranco',
      'ventilador-tres-velocidades',
      'silla-auxiliar',
    ]);
  });

  it('filters by query, category and accepted trade kind', () => {
    const stateWithFilters = {
      marketplace: {
        ...initialMarketplaceState,
        selectedDistrictId: 'surquillo' as const,
        filters: { query: 'lámpara', category: 'home' as const, kind: 'all' as const, accepts: 'service' as const },
      },
    };
    expect(selectVisibleListings(stateWithFilters).map((listing) => listing.id)).toEqual(['lampara-barranco']);
  });

  it('returns an empty result for a district without matches', () => {
    const noBooksInDistrict = {
      marketplace: { ...initialMarketplaceState, selectedDistrictId: 'surquillo' as const, filters: { ...initialMarketplaceState.filters, category: 'books' as const } },
    };
    expect(selectVisibleListings(noBooksInDistrict)).toHaveSize(0);
  });
});
