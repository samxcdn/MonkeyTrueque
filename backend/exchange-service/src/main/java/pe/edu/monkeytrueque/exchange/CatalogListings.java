package pe.edu.monkeytrueque.exchange;

import feign.FeignException;
import org.springframework.cloud.client.circuitbreaker.CircuitBreakerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Consulta publicaciones del catálogo y traduce sus errores a respuestas claras. */
@Component
class CatalogListings {
  private final CatalogClient catalog;
  private final CircuitBreakerFactory<?, ?> circuitBreakers;

  CatalogListings(CatalogClient catalog, CircuitBreakerFactory<?, ?> circuitBreakers) {
    this.catalog = catalog;
    this.circuitBreakers = circuitBreakers;
  }

  CatalogClient.CatalogListing available(String listingId) {
    CatalogClient.CatalogListing listing = circuitBreakers.create("catalog").run(
        () -> catalog.get(listingId),
        error -> {
          if (error instanceof FeignException.NotFound) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Publicación no encontrada", error);
          if (error instanceof FeignException.Gone) throw new ResponseStatusException(HttpStatus.GONE, "La publicación ya no está disponible", error);
          throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Catálogo no disponible", error);
        });
    if (!listing.available() || listing.moderationHidden()) {
      throw new ResponseStatusException(HttpStatus.GONE, "La publicación ya no está disponible");
    }
    return listing;
  }
}
