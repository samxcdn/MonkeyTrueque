package pe.edu.monkeytrueque.catalog;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

/** Pregunta a exchange-service si una publicación propia tiene propuestas o acuerdos abiertos. */
@Component
class ExchangeActivity {
  private final RestClient exchanges;

  ExchangeActivity(RestClient.Builder builder, @Value("${app.exchange-url}") String exchangeUrl) {
    this.exchanges = builder.clone().baseUrl(exchangeUrl).build();
  }

  long activeDeals(String listingId, Jwt jwt) {
    Map<?, ?> body;
    try {
      body = exchanges.get().uri("/api/exchanges/listing/{id}/active", listingId)
          .header(HttpHeaders.AUTHORIZATION, "Bearer " + jwt.getTokenValue())
          .retrieve().body(Map.class);
    } catch (RestClientException ex) {
      throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
          "No se pudo comprobar si la publicación tiene acuerdos en curso. Inténtalo en unos minutos.", ex);
    }
    return body != null && body.get("active") instanceof Number count ? count.longValue() : 0;
  }
}
