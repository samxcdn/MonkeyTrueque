package pe.edu.monkeytrueque.exchange;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.transaction.annotation.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.beans.factory.annotation.Autowired;

@RestController
@RequestMapping("/api/admin/exchanges")
class AdminExchangeController {
  private final ExchangeRepository exchanges;
  private final MessageRepository messages;
  private final Set<String> adminIds;
  private final CatalogClient catalog;
  private final org.springframework.jdbc.core.JdbcTemplate jdbc;

  @Autowired
  AdminExchangeController(ExchangeRepository exchanges, MessageRepository messages,
      @Value("${app.admin-user-ids:}") String configuredIds, CatalogClient catalog, org.springframework.jdbc.core.JdbcTemplate jdbc) {
    this.exchanges = exchanges;
    this.messages = messages;
    this.catalog = catalog;
    this.jdbc = jdbc;
    this.adminIds = Arrays.stream(configuredIds.split(","))
        .map(String::trim).filter(id -> !id.isEmpty()).collect(Collectors.toUnmodifiableSet());
  }

  AdminExchangeController(ExchangeRepository exchanges, MessageRepository messages, String configuredIds) {
    this(exchanges, messages, configuredIds, null, null);
  }

  @GetMapping
  List<AdminExchange> all(@AuthenticationPrincipal Jwt jwt) {
    requireAdmin(jwt);
    return exchanges.findTop100ByOrderByCreatedAtDesc().stream().map(AdminExchange::from).toList();
  }

  @GetMapping("/reviews")
  List<AdminReview> reviews(@AuthenticationPrincipal Jwt jwt) {
    requireStaff(jwt);
    return exchanges.findAll().stream().flatMap(exchange -> {
      var items = new java.util.ArrayList<AdminReview>(2);
      if (exchange.ownerRating != null) items.add(new AdminReview(exchange.id, "owner", exchange.ownerId, exchange.proposerId, exchange.listingTitle, exchange.ownerRating, exchange.ownerReview, exchange.ownerReviewHidden, exchange.ownerReviewModerationNote, exchange.createdAt));
      if (exchange.proposerRating != null) items.add(new AdminReview(exchange.id, "proposer", exchange.proposerId, exchange.ownerId, exchange.listingTitle, exchange.proposerRating, exchange.proposerReview, exchange.proposerReviewHidden, exchange.proposerReviewModerationNote, exchange.createdAt));
      return items.stream();
    }).toList();
  }

  @PatchMapping("/reviews/{exchangeId}/{participant}/visibility")
  @Transactional
  AdminReview reviewVisibility(@AuthenticationPrincipal Jwt jwt, @PathVariable String exchangeId, @PathVariable String participant, @Valid @RequestBody ReviewVisibility request) {
    requireStaff(jwt);
    if (!Set.of("owner", "proposer").contains(participant)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Participante de la reseña no válido");
    var exchange = exchanges.findById(exchangeId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    String authorId = participant.equals("owner") ? exchange.ownerId : exchange.proposerId;
    if (jwt.getSubject().equals(authorId) || jwt.getSubject().equals(participant.equals("owner") ? exchange.proposerId : exchange.ownerId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No puedes moderar un intercambio en el que participas");
    }
    Integer rating = participant.equals("owner") ? exchange.ownerRating : exchange.proposerRating;
    if (rating == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Reseña no encontrada");
    if (participant.equals("owner")) { exchange.ownerReviewHidden = request.hidden(); exchange.ownerReviewModerationNote = request.reason().trim(); }
    else { exchange.proposerReviewHidden = request.hidden(); exchange.proposerReviewModerationNote = request.reason().trim(); }
    String action = request.hidden() ? "review-hidden" : "review-restored";
    jdbcAudit(jwt.getSubject(), action, exchangeId, participant, request.reason().trim());
    return participant.equals("owner")
        ? new AdminReview(exchange.id, participant, authorId, exchange.proposerId, exchange.listingTitle, exchange.ownerRating, exchange.ownerReview, exchange.ownerReviewHidden, exchange.ownerReviewModerationNote, exchange.createdAt)
        : new AdminReview(exchange.id, participant, authorId, exchange.ownerId, exchange.listingTitle, exchange.proposerRating, exchange.proposerReview, exchange.proposerReviewHidden, exchange.proposerReviewModerationNote, exchange.createdAt);
  }

  @GetMapping("/reviews/actions")
  List<ReviewModerationAction> reviewActions(@AuthenticationPrincipal Jwt jwt) {
    requireStaff(jwt);
    String sql = "SELECT id, staff_id, action, exchange_id, participant, reason, created_at FROM exchange_moderation_actions " +
        ("admin".equals(catalog == null ? "admin" : catalog.staffRole("Bearer " + jwt.getTokenValue()).role()) ? "" : "WHERE staff_id = ? ") +
        "ORDER BY created_at DESC LIMIT 100";
    var mapper = (org.springframework.jdbc.core.RowMapper<ReviewModerationAction>) (rs, row) -> new ReviewModerationAction(rs.getString("id"), rs.getString("staff_id"), rs.getString("action"), rs.getString("exchange_id"), rs.getString("participant"), rs.getString("reason"), rs.getTimestamp("created_at").toInstant());
    if (catalog == null || "admin".equals(catalog.staffRole("Bearer " + jwt.getTokenValue()).role())) return jdbc.query(sql, mapper);
    return jdbc.query(sql, mapper, jwt.getSubject());
  }

  @GetMapping("/{id}")
  AdminExchangeDetail one(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    requireAdmin(jwt);
    var exchange = exchanges.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    return new AdminExchangeDetail(AdminExchange.from(exchange), List.of());
  }

  private void requireAdmin(Jwt jwt) {
    boolean allowed = jwt != null && (catalog == null ? adminIds.contains(jwt.getSubject()) : "admin".equals(catalog.staffRole("Bearer " + jwt.getTokenValue()).role()));
    if (!allowed) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acceso de administrador requerido");
    }
  }

  private void requireStaff(Jwt jwt) {
    boolean allowed = jwt != null && (catalog == null ? adminIds.contains(jwt.getSubject()) : catalog.staffRole("Bearer " + jwt.getTokenValue()).role().matches("admin|moderator"));
    if (!allowed) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Necesitas permisos de moderación");
  }

  private void jdbcAudit(String staffId, String action, String exchangeId, String participant, String reason) {
    if (jdbc == null) throw new IllegalStateException("Review audit persistence is not configured");
    jdbc.update("INSERT INTO exchange_moderation_actions (id, staff_id, action, exchange_id, participant, reason) VALUES (?, ?, ?, ?, ?, ?)",
        UUID.randomUUID().toString(), staffId, action, exchangeId, participant, reason);
  }

  record AdminExchange(String id, String listingId, String listingTitle, String offeredTitle,
      String ownerId, String proposerId, String status, String note, String meetupPlace,
      String meetupDate, String meetupTime, boolean ownerConfirmed, boolean proposerConfirmed,
      Instant createdAt) {
    static AdminExchange from(ExchangeEntity exchange) {
      return new AdminExchange(exchange.id, exchange.listingId, exchange.listingTitle,
          exchange.offeredTitle, exchange.ownerId, exchange.proposerId, exchange.status,
          exchange.note, exchange.meetupPlace, exchange.meetupDate, exchange.meetupTime,
          exchange.ownerConfirmed, exchange.proposerConfirmed, exchange.createdAt);
    }
  }
  record AdminMessage(String id, String sender, String text, Instant createdAt) {}
  record AdminExchangeDetail(AdminExchange exchange, List<AdminMessage> messages) {}
  record ReviewVisibility(@NotNull(message = "La visibilidad es obligatoria") Boolean hidden, @NotBlank(message = "El motivo es obligatorio") @Size(max = 1000, message = "El motivo no puede superar 1.000 caracteres") String reason) {}
  record AdminReview(String exchangeId, String participant, String reviewerId, String reviewedUserId, String listingTitle,
      int rating, String review, boolean hidden, String moderationReason, Instant createdAt) {}
  record ReviewModerationAction(String id, String staffId, String action, String exchangeId, String participant, String reason, Instant createdAt) {}
}
