package pe.edu.monkeytrueque.exchange;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;
import java.util.Optional;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AdminExchangeControllerTests {
  private final ExchangeRepository exchanges = mock(ExchangeRepository.class);
  private final MessageRepository messages = mock(MessageRepository.class);
  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final AdminExchangeController controller = new AdminExchangeController(exchanges, messages, "user_admin", null, jdbc);

  @Test
  void onlyConfiguredAdminCanInspectExchanges() {
    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.all(jwt("user_normal"))).getStatusCode());
    verifyNoInteractions(exchanges, messages);
    controller.all(jwt("user_admin"));
    verify(exchanges).findTop100ByOrderByCreatedAtDesc();
  }

  @Test
  void reviewModerationPreservesRatingAndRequiresAuditReason() {
    var exchange = new ExchangeEntity();
    exchange.id = "exchange-1";
    exchange.ownerId = "owner-1";
    exchange.proposerId = "proposer-1";
    exchange.ownerRating = 5;
    exchange.ownerReview = "Comentario ofensivo";
    when(exchanges.findById("exchange-1")).thenReturn(Optional.of(exchange));
    var result = controller.reviewVisibility(jwt("user_admin"), "exchange-1", "owner",
        new AdminExchangeController.ReviewVisibility(true, "Incumple las normas"));
    assertTrue(result.hidden());
    assertEquals(5, exchange.ownerRating);
    assertEquals("Comentario ofensivo", exchange.ownerReview);
    verify(jdbc).update(anyString(), any(), eq("user_admin"), eq("review-hidden"), eq("exchange-1"), eq("owner"), eq("Incumple las normas"));
  }

  private Jwt jwt(String subject) {
    return Jwt.withTokenValue("test").header("alg", "none").subject(subject).build();
  }
}
