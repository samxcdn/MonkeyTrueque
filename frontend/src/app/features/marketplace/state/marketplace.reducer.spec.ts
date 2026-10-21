import { initialMarketplaceState as emptyMarketplaceState, marketplaceReducer } from './marketplace.reducer';
import { DEMO_LISTINGS } from '../../../core/data/demo-marketplace.data';
import * as MarketplaceActions from './marketplace.actions';

describe('marketplaceReducer', () => {
  const initialMarketplaceState = { ...emptyMarketplaceState, listings: DEMO_LISTINGS };
  const proposal = MarketplaceActions.startExchange({
    listingId: 'mochila-floreada',
    offeredTitle: 'Kit de acuarelas',
    offeredKind: 'object',
    note: 'Puedo coordinar cerca del parque.',
  });
  const scheduledState = () => {
    const proposed = marketplaceReducer(initialMarketplaceState, proposal);
    return marketplaceReducer(proposed, MarketplaceActions.saveMeetup({
      place: 'Parque Reducto · entrada principal',
      date: '2026-10-10',
      time: '12:00',
    }));
  };

  it('starts proposals as unconfirmed and without a meetup', () => {
    const state = marketplaceReducer(initialMarketplaceState, proposal);
    expect(state.exchange?.status).toBe('proposal-sent');
    expect(state.exchange?.ownerConfirmed).toBeFalse();
    expect(state.exchange?.proposerConfirmed).toBeFalse();
    expect(state.exchange?.meetupPlace).toBe('');
    expect(state.exchange?.messages).toEqual([]);
  });

  it('requires an agreed public meetup before either party can confirm', () => {
    const state = marketplaceReducer(marketplaceReducer(initialMarketplaceState, proposal), MarketplaceActions.confirmDelivery({ role: 'owner' }));
    expect(state.exchange?.status).toBe('proposal-sent');
    expect(state.exchange?.ownerConfirmed).toBeFalse();
  });

  it('opens ratings only after both people confirm', () => {
    const afterOwner = marketplaceReducer(scheduledState(), MarketplaceActions.confirmDelivery({ role: 'owner' }));
    expect(afterOwner.exchange?.status).toBe('confirmed-by-one');
    expect(marketplaceReducer(afterOwner, MarketplaceActions.rateExchange({ role: 'owner', rating: 5, review: '' })).exchange?.ratings.owner).toBeUndefined();

    const afterBoth = marketplaceReducer(afterOwner, MarketplaceActions.confirmDelivery({ role: 'proposer' }));
    const afterOwnerRating = marketplaceReducer(afterBoth, MarketplaceActions.rateExchange({ role: 'owner', rating: 5, review: 'Buen intercambio.' }));
    expect(afterOwnerRating.exchange?.status).toBe('confirmed-by-both');
    expect(afterOwnerRating.exchange?.ratings.owner?.rating).toBe(5);
    const rated = marketplaceReducer(afterOwnerRating, MarketplaceActions.rateExchange({ role: 'proposer', rating: 4, review: 'Buena coordinación.' }));
    expect(rated.exchange?.status).toBe('rated');
    expect(rated.exchange?.ratings.proposer?.rating).toBe(4);
  });

  it('rejects ratings outside the one-to-five star range', () => {
    const afterOwner = marketplaceReducer(scheduledState(), MarketplaceActions.confirmDelivery({ role: 'owner' }));
    const afterBoth = marketplaceReducer(afterOwner, MarketplaceActions.confirmDelivery({ role: 'proposer' }));
    const invalid = marketplaceReducer(afterBoth, MarketplaceActions.rateExchange({ role: 'owner', rating: 6, review: '' }));
    expect(invalid.exchange?.status).toBe('confirmed-by-both');
    expect(invalid.exchange?.ratings.owner).toBeUndefined();
  });

  it('rejects a proposal when the listing does not accept the offered kind', () => {
    const invalidProposal = MarketplaceActions.startExchange({
      listingId: 'mochila-floreada',
      offeredTitle: 'Ajuste de bicicleta',
      offeredKind: 'service',
      note: '',
    });
    expect(marketplaceReducer(initialMarketplaceState, invalidProposal).exchange).toBeNull();
  });

  it('keeps chat messages with the exchange and blocks messages after completion', () => {
    const proposed = marketplaceReducer(initialMarketplaceState, proposal);
    const message = { id: 'message-1', sender: 'proposer' as const, text: 'Puedo coordinar cerca del parque.' };
    const withMessage = marketplaceReducer(proposed, MarketplaceActions.addExchangeMessage({ message }));
    expect(withMessage.exchange?.messages).toEqual([message]);

    const scheduled = marketplaceReducer(withMessage, MarketplaceActions.saveMeetup({ place: 'Parque Reducto', date: '2026-10-10', time: '12:00' }));
    expect(scheduled.exchange?.messages).toEqual([message]);
    const afterOwner = marketplaceReducer(scheduled, MarketplaceActions.confirmDelivery({ role: 'owner' }));
    const afterBoth = marketplaceReducer(afterOwner, MarketplaceActions.confirmDelivery({ role: 'proposer' }));
    const completed = marketplaceReducer(afterBoth, MarketplaceActions.addExchangeMessage({ message: { ...message, id: 'message-2' } }));
    expect(completed.exchange?.messages).toEqual([message]);
  });

  it('allows one rating per participant and closes only after both rate', () => {
    const afterBothConfirm = marketplaceReducer(scheduledState(), MarketplaceActions.confirmDelivery({ role: 'owner' }));
    const confirmed = marketplaceReducer(afterBothConfirm, MarketplaceActions.confirmDelivery({ role: 'proposer' }));
    const firstRating = MarketplaceActions.rateExchange({ role: 'owner', rating: 5, review: 'Todo bien.' });
    const afterFirst = marketplaceReducer(confirmed, firstRating);
    expect(afterFirst.exchange?.status).toBe('confirmed-by-both');
    expect(marketplaceReducer(afterFirst, firstRating)).toBe(afterFirst);
    const final = marketplaceReducer(afterFirst, MarketplaceActions.rateExchange({ role: 'proposer', rating: 4, review: '' }));
    expect(final.exchange?.status).toBe('rated');
  });

  it('does not replace an active exchange with a second proposal', () => {
    const proposed = marketplaceReducer(initialMarketplaceState, proposal);
    const nextProposal = MarketplaceActions.startExchange({
      listingId: 'ventilador-tres-velocidades',
      offeredTitle: 'Una maceta',
      offeredKind: 'object',
      note: '',
    });
    expect(marketplaceReducer(proposed, nextProposal)).toBe(proposed);
  });

  it('updates the selected district without losing filters', () => {
    const withQuery = marketplaceReducer(initialMarketplaceState, MarketplaceActions.setQuery({ query: 'libros' }));
    const next = marketplaceReducer(withQuery, MarketplaceActions.setDistrict({ districtId: 'miraflores' }));
    expect(next.selectedDistrictId).toBe('miraflores');
    expect(next.filters.query).toBe('libros');
  });

  it('hydrates listings and the current exchange from the API', () => {
    const loaded = marketplaceReducer(emptyMarketplaceState, MarketplaceActions.setListings({ listings: DEMO_LISTINGS }));
    expect(loaded.listings).toEqual(DEMO_LISTINGS);
    const exchange = marketplaceReducer(loaded, proposal).exchange;
    expect(marketplaceReducer(loaded, MarketplaceActions.setExchange({ exchange })).exchange).toEqual(exchange);
  });

  it('clears a previous account\'s local exchange when its session ends', () => {
    const proposed = marketplaceReducer(initialMarketplaceState, proposal);
    const withMessage = marketplaceReducer(proposed, MarketplaceActions.addExchangeMessage({
      message: { id: 'private-message', sender: 'proposer', text: 'Nos vemos en el parque.' },
    }));
    const reset = marketplaceReducer(withMessage, MarketplaceActions.resetDemoSession());
    expect(reset.exchange).toBeNull();
    expect(reset.listings).toEqual(emptyMarketplaceState.listings);
    expect(reset.filters).toEqual(initialMarketplaceState.filters);
  });
});
