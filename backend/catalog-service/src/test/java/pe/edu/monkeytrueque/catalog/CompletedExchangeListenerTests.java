package pe.edu.monkeytrueque.catalog;

import java.util.Optional;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CompletedExchangeListenerTests {
  private final ListingRepository listings = mock(ListingRepository.class);
  private final CompletedExchangeListener listener = new CompletedExchangeListener(listings);

  @Test
  void closesListingAndAcceptsDuplicateDelivery() {
    var listing = new ListingEntity();
    listing.id = "00000000-0000-0000-0000-000000000002";
    listing.available = true;
    when(listings.findById(listing.id)).thenReturn(Optional.of(listing));
    var payload = "00000000-0000-0000-0000-000000000001|" + listing.id;

    listener.complete(payload);
    listener.complete(payload);

    assertFalse(listing.available);
    verify(listings, times(1)).save(listing);
  }

  @Test
  void rejectsMalformedEventWithoutChangingAListing() {
    assertThrows(IllegalArgumentException.class, () -> listener.complete("bad-message"));
    verifyNoInteractions(listings);
  }
}
