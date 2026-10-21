package pe.edu.monkeytrueque.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/listings")
class ListingCompletionController {
  private final ListingRepository listings;
  private final RestClient exchanges;

  ListingCompletionController(ListingRepository listings, RestClient.Builder builder,
      @Value("${app.exchange-url}") String exchangeUrl) {
    this.listings = listings;
    this.exchanges = builder.baseUrl(exchangeUrl).build();
  }

  @PostMapping("/{id}/complete")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Transactional
  void complete(@AuthenticationPrincipal Jwt jwt, @PathVariable String id,
      @Valid @RequestBody CompletionRequest request) {
    var listing = listings.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    Map<?, ?> exchange;
    try {
      exchange = exchanges.get().uri("/api/exchanges/{id}", request.exchangeId())
          .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.getTokenValue())
          .retrieve().body(Map.class);
    } catch (RestClientException ex) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "No se pudo verificar el trueque", ex);
    }
    if (exchange == null || !id.equals(exchange.get("listingId"))
        || !("confirmed-by-both".equals(exchange.get("status")) || "rated".equals(exchange.get("status")))) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "El trueque no está completado para esta publicación");
    }
    if (listing.available) {
      listing.available = false;
      listings.save(listing);
    }
  }

  record CompletionRequest(@NotBlank(message = "El intercambio es obligatorio") String exchangeId) {}
}
