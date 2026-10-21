package pe.edu.monkeytrueque.catalog;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.ExpectedCount.once;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class ListingCompletionControllerTests {
  private final ListingRepository listings = mock(ListingRepository.class);
  private final RestClient.Builder builder = RestClient.builder();
  private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
  private final ListingCompletionController controller =
      new ListingCompletionController(listings, builder, "http://localhost:8082");

  @Test
  void closesListingOnlyWhenExchangeConfirmsSameListing() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.available = true;
    when(listings.findById(listing.id)).thenReturn(Optional.of(listing));
    server.expect(once(), requestTo("http://localhost:8082/api/exchanges/exchange-1"))
        .andExpect(method(HttpMethod.GET))
        .andExpect(header("Authorization", "Bearer test"))
        .andRespond(withSuccess("{\"listingId\":\"listing-1\",\"status\":\"confirmed-by-both\"}", MediaType.APPLICATION_JSON));

    controller.complete(jwt(), listing.id, new ListingCompletionController.CompletionRequest("exchange-1"));

    assertFalse(listing.available);
    verify(listings).save(listing);
    server.verify();
  }

  @Test
  void rejectsCompletionForDifferentListing() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.available = true;
    when(listings.findById(listing.id)).thenReturn(Optional.of(listing));
    server.expect(once(), requestTo("http://localhost:8082/api/exchanges/exchange-1"))
        .andRespond(withSuccess("{\"listingId\":\"listing-2\",\"status\":\"confirmed-by-both\"}", MediaType.APPLICATION_JSON));

    assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
        () -> controller.complete(jwt(), listing.id,
            new ListingCompletionController.CompletionRequest("exchange-1"))).getStatusCode());
    assertTrue(listing.available);
    verify(listings, never()).save(any());
    server.verify();
  }

  @Test
  void rejectsUnconfirmedExchange() {
    var listing = new ListingEntity();
    listing.id = "listing-1";
    listing.available = true;
    when(listings.findById(listing.id)).thenReturn(Optional.of(listing));
    server.expect(once(), requestTo("http://localhost:8082/api/exchanges/exchange-1"))
        .andRespond(withSuccess("{\"listingId\":\"listing-1\",\"status\":\"meetup-agreed\"}", MediaType.APPLICATION_JSON));

    assertEquals(HttpStatus.CONFLICT, assertThrows(ResponseStatusException.class,
        () -> controller.complete(jwt(), listing.id,
            new ListingCompletionController.CompletionRequest("exchange-1"))).getStatusCode());
    assertTrue(listing.available);
    verify(listings, never()).save(any());
    server.verify();
  }

  private Jwt jwt() {
    return Jwt.withTokenValue("test").header("alg", "none").subject("owner").build();
  }
}
