import { createReducer, on } from '@ngrx/store';
import { DEMO_COMMUNITIES, DEMO_DISTRICTS } from '../../../core/data/demo-marketplace.data';
import type { ExchangeAgreement, ExchangeStatus, ListingFilters, MarketplaceState } from '../../../core/models/marketplace.models';
import * as MarketplaceActions from './marketplace.actions';

const emptyFilters: ListingFilters = { query: '', category: 'all', kind: 'all', accepts: 'all' };

export const initialMarketplaceState: MarketplaceState = {
  districts: DEMO_DISTRICTS,
  listings: [],
  communities: DEMO_COMMUNITIES,
  selectedDistrictId: 'all',
  filters: emptyFilters,
  exchange: null,
};

export const marketplaceReducer = createReducer(
  initialMarketplaceState,
  on(MarketplaceActions.resetDemoSession, () => initialMarketplaceState),
  on(MarketplaceActions.setListings, (state, { listings }) => ({ ...state, listings })),
  on(MarketplaceActions.setExchange, (state, { exchange }) => ({ ...state, exchange })),
  on(MarketplaceActions.setDistrict, (state, { districtId }) => ({ ...state, selectedDistrictId: districtId })),
  on(MarketplaceActions.setQuery, (state, { query }) => ({ ...state, filters: { ...state.filters, query } })),
  on(MarketplaceActions.setCategory, (state, { category }) => ({ ...state, filters: { ...state.filters, category } })),
  on(MarketplaceActions.setListingKind, (state, { kind }) => ({ ...state, filters: { ...state.filters, kind } })),
  on(MarketplaceActions.setAcceptedKind, (state, { accepts }) => ({ ...state, filters: { ...state.filters, accepts } })),
  on(MarketplaceActions.addListing, (state, { listing }) => ({
    ...state,
    listings: [listing, ...state.listings],
    filters: emptyFilters,
  })),
  on(MarketplaceActions.startExchange, (state, proposal) => {
    const listing = state.listings.find((item) => item.id === proposal.listingId);
    if (!listing || !listing.accepts.includes(proposal.offeredKind) || (state.exchange && state.exchange.status !== 'rated')) return state;
    const exchange: ExchangeAgreement = {
      listingId: proposal.listingId,
      offeredTitle: proposal.offeredTitle,
      offeredKind: proposal.offeredKind,
      note: proposal.note,
      status: 'proposal-sent',
      meetupPlace: '',
      meetupDate: '',
      meetupTime: '',
      ownerConfirmed: false,
      proposerConfirmed: false,
      messages: [],
      ratings: {},
    };
    return { ...state, exchange };
  }),
  on(MarketplaceActions.saveMeetup, (state, { place, date, time }) => {
    if (!state.exchange) return state;
    const exchange: ExchangeAgreement = {
      ...state.exchange,
      meetupPlace: place,
      meetupDate: date,
      meetupTime: time,
      status: 'meetup-agreed',
    };
    return { ...state, exchange };
  }),
  on(MarketplaceActions.confirmDelivery, (state, { role }) => {
    if (!state.exchange || state.exchange.status === 'proposal-sent' || state.exchange.status === 'confirmed-by-both' || state.exchange.status === 'rated') return state;
    if (!state.exchange.meetupPlace || !state.exchange.meetupDate || !state.exchange.meetupTime) return state;
    const ownerConfirmed = state.exchange.ownerConfirmed || role === 'owner';
    const proposerConfirmed = state.exchange.proposerConfirmed || role === 'proposer';
    const status: ExchangeStatus = ownerConfirmed && proposerConfirmed ? 'confirmed-by-both' : 'confirmed-by-one';
    const exchange: ExchangeAgreement = { ...state.exchange, ownerConfirmed, proposerConfirmed, status };
    return { ...state, exchange };
  }),
  on(MarketplaceActions.addExchangeMessage, (state, { message }) => {
    if (!state.exchange || !message.text.trim() || state.exchange.status === 'confirmed-by-both' || state.exchange.status === 'rated') return state;
    return { ...state, exchange: { ...state.exchange, messages: [...state.exchange.messages, { ...message, text: message.text.trim() }] } };
  }),
  on(MarketplaceActions.rateExchange, (state, { role, rating, review }) => {
    const current = state.exchange;
    if (!current || current.status !== 'confirmed-by-both' || current.ratings[role] || rating < 1 || rating > 5 || !Number.isInteger(rating)) return state;
    const ratings = { ...current.ratings, [role]: { rating, review: review.trim() } };
    const status: ExchangeStatus = ratings.owner && ratings.proposer ? 'rated' : 'confirmed-by-both';
    return { ...state, exchange: { ...current, ratings, status } };
  }),
);
