package pe.edu.monkeytrueque.exchange;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * Acuerdos dentro de una conversación: propuesta, aceptación, encuentro,
 * confirmación de ambas partes y calificación.
 */
@RestController
@RequestMapping("/api/exchanges")
class ExchangeController {
  /** Estados en los que el acuerdo sigue abierto. */
  static final Set<String> ACTIVE = Set.of("proposal-sent", "accepted", "meetup-proposed", "meetup-agreed", "confirmed-by-one");
  /** Estados en los que el dueño ya se comprometió con esta persona. */
  static final Set<String> COMMITTED = Set.of("accepted", "meetup-proposed", "meetup-agreed", "confirmed-by-one");
  /** Estados de un acuerdo concretado: la publicación ya se entregó. */
  static final Set<String> COMPLETED = Set.of("confirmed-by-both", "rated");
  private static final ZoneId LIMA = ZoneId.of("America/Lima");

  private final ExchangeRepository exchanges;
  private final ConversationRepository conversations;
  private final DirectMessageRepository messages;
  private final CompletionOutboxRepository outbox;
  private final CatalogClient catalog;
  private final CatalogListings listings;
  private final BlockedUserRepository blockedUsers;
  Clock clock = Clock.system(LIMA);

  ExchangeController(ExchangeRepository exchanges, ConversationRepository conversations, DirectMessageRepository messages,
      CompletionOutboxRepository outbox, CatalogClient catalog, CatalogListings listings, BlockedUserRepository blockedUsers) {
    this.exchanges = exchanges;
    this.conversations = conversations;
    this.messages = messages;
    this.outbox = outbox;
    this.catalog = catalog;
    this.listings = listings;
    this.blockedUsers = blockedUsers;
  }

  @GetMapping("/mine")
  List<ExchangeView> mine(@AuthenticationPrincipal Jwt jwt) {
    return exchanges.findTop30ByOwnerIdOrProposerIdOrderByCreatedAtDesc(jwt.getSubject(), jwt.getSubject())
        .stream().map(ExchangeController::view).toList();
  }

  @GetMapping("/{id}")
  ExchangeView one(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    return view(participant(jwt, id));
  }

  /** Acuerdos abiertos de una publicación propia; el catálogo lo usa antes de editarla o borrarla. */
  @GetMapping("/listing/{listingId}/active")
  Map<String, Long> activeForListing(@AuthenticationPrincipal Jwt jwt, @PathVariable String listingId) {
    return Map.of("active", exchanges.countByListingIdAndOwnerIdAndStatusIn(listingId, jwt.getSubject(), ACTIVE));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  ExchangeView propose(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody Proposal request) {
    requireMessagingAllowed(jwt);
    var conversation = conversations.findById(request.conversationId())
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Conversación no encontrada"));
    if (!conversation.visitorId.equals(jwt.getSubject())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo quien consulta la publicación puede enviar una propuesta");
    }
    if (!"active".equals(conversation.status)) conflict("Esta conversación está cerrada");
    ensureNotBlocked(conversation.ownerId, conversation.visitorId);
    if (exchanges.existsByConversationIdAndStatusIn(conversation.id, ACTIVE)) {
      conflict("Ya tienes una propuesta en curso en esta conversación. Cancélala antes de enviar otra.");
    }
    requireListingNotCompleted(conversation.listingId);
    var listing = listings.available(conversation.listingId);

    String mode = listing.mode() == null ? "trade" : listing.mode();
    String offeredTitle;
    String offeredKind;
    if (mode.equals("trade")) {
      if (request.offeredTitle() == null || request.offeredTitle().isBlank()) bad("Indica qué ofreces a cambio");
      if (request.offeredKind() == null || listing.accepts() == null || !listing.accepts().contains(request.offeredKind())) {
        bad("La publicación no acepta ese tipo de oferta");
      }
      offeredTitle = request.offeredTitle().trim();
      offeredKind = request.offeredKind();
    } else {
      offeredTitle = mode.equals("sale") && listing.price() != null
          ? "Compra por S/ " + listing.price().setScale(2, RoundingMode.HALF_UP).toPlainString()
          : mode.equals("sale") ? "Compra" : "Solicitud de regalo";
      offeredKind = "object";
    }

    var exchange = new ExchangeEntity();
    exchange.id = UUID.randomUUID().toString();
    exchange.conversationId = conversation.id;
    exchange.listingId = conversation.listingId;
    exchange.listingTitle = listing.title();
    exchange.ownerId = conversation.ownerId;
    exchange.proposerId = conversation.visitorId;
    exchange.offeredTitle = offeredTitle;
    exchange.offeredKind = offeredKind;
    exchange.note = request.note() == null ? "" : request.note().trim();
    exchange.status = "proposal-sent";
    exchanges.save(exchange);
    String summary = mode.equals("trade") ? "Te propongo " + offeredTitle + " a cambio de " + listing.title() + "." : offeredTitle + " de " + listing.title() + ".";
    notify(conversation, jwt.getSubject(), "📝 Propuesta: " + summary + (exchange.note.isBlank() ? "" : " " + exchange.note));
    return view(exchange);
  }

  @PostMapping("/{id}/accept")
  @Transactional
  ExchangeView accept(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    var exchange = participant(jwt, id);
    requireOwner(exchange, jwt);
    requireStatus(exchange, Set.of("proposal-sent"), "Esta propuesta ya no está pendiente");
    requireListingNotCompleted(exchange.listingId);
    if (exchanges.existsByListingIdAndStatusInAndIdNot(exchange.listingId, COMMITTED, exchange.id)) {
      conflict("Ya tienes un acuerdo en curso para esta publicación. Cancélalo antes de aceptar otro.");
    }
    listings.available(exchange.listingId);
    exchange.status = "accepted";
    notifyParticipants(exchange, jwt, "✅ Propuesta aceptada. Ahora acuerden un lugar, una fecha y una hora para el encuentro.");
    return view(exchange);
  }

  @PostMapping("/{id}/reject")
  @Transactional
  ExchangeView reject(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    var exchange = participant(jwt, id);
    requireOwner(exchange, jwt);
    requireStatus(exchange, Set.of("proposal-sent"), "Esta propuesta ya no está pendiente");
    exchange.status = "rejected";
    notifyParticipants(exchange, jwt, "❌ Propuesta rechazada.");
    return view(exchange);
  }

  @PostMapping("/{id}/cancel")
  @Transactional
  ExchangeView cancel(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    var exchange = participant(jwt, id);
    if (exchange.status.equals("proposal-sent") && role(exchange, jwt).equals("owner")) {
      conflict("Para no aceptar una propuesta, recházala");
    }
    requireStatus(exchange, Set.of("proposal-sent", "accepted", "meetup-proposed", "meetup-agreed"),
        "Este acuerdo ya no se puede cancelar");
    exchange.status = "cancelled";
    notifyParticipants(exchange, jwt, "🚫 Acuerdo cancelado.");
    return view(exchange);
  }

  @PostMapping("/{id}/meetup")
  @Transactional
  ExchangeView meetup(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody Meetup request) {
    var exchange = participant(jwt, id);
    requireStatus(exchange, Set.of("accepted", "meetup-proposed", "meetup-agreed"), "El encuentro ya no se puede modificar");
    LocalDateTime when;
    try {
      when = LocalDateTime.of(LocalDate.parse(request.date()), LocalTime.parse(request.time()));
    } catch (DateTimeParseException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fecha u hora no válida");
    }
    if (!when.isAfter(LocalDateTime.now(clock))) bad("El encuentro debe ser en una fecha y hora futuras");
    exchange.meetupPlace = request.place().trim();
    exchange.meetupDate = request.date();
    exchange.meetupTime = request.time();
    exchange.meetupProposedBy = role(exchange, jwt);
    exchange.status = "meetup-proposed";
    notifyParticipants(exchange, jwt, "📍 Encuentro propuesto: " + exchange.meetupPlace + " · " + exchange.meetupDate + " · " + exchange.meetupTime + ". Falta que la otra persona lo acepte.");
    return view(exchange);
  }

  @PostMapping("/{id}/meetup/accept")
  @Transactional
  ExchangeView acceptMeetup(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    var exchange = participant(jwt, id);
    requireStatus(exchange, Set.of("meetup-proposed"), "No hay un encuentro pendiente de aceptar");
    if (role(exchange, jwt).equals(exchange.meetupProposedBy)) conflict("La otra persona debe aceptar el encuentro que propusiste");
    exchange.status = "meetup-agreed";
    notifyParticipants(exchange, jwt, "🤝 Encuentro acordado: " + exchange.meetupPlace + " · " + exchange.meetupDate + " · " + exchange.meetupTime + ".");
    return view(exchange);
  }

  @PostMapping("/{id}/confirm")
  @Transactional
  ExchangeView confirm(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    var exchange = participant(jwt, id);
    requireStatus(exchange, Set.of("meetup-agreed", "confirmed-by-one"), "Primero acuerden el encuentro");
    if (!exchange.meetupDate.isBlank() && LocalDate.now(clock).isBefore(LocalDate.parse(exchange.meetupDate))) {
      conflict("Podrás confirmar la entrega a partir del día del encuentro (" + exchange.meetupDate + ")");
    }
    boolean owner = role(exchange, jwt).equals("owner");
    if (owner ? exchange.ownerConfirmed : exchange.proposerConfirmed) conflict("Ya confirmaste la entrega");
    if (owner) exchange.ownerConfirmed = true;
    else exchange.proposerConfirmed = true;
    exchange.status = exchange.ownerConfirmed && exchange.proposerConfirmed ? "confirmed-by-both" : "confirmed-by-one";
    if (exchange.status.equals("confirmed-by-both")) {
      outbox.save(new CompletionOutboxEntity(exchange.id, exchange.listingId));
      closeOtherDeals(exchange);
      notifyParticipants(exchange, jwt, "🎉 Entrega confirmada por ambas partes. Ya pueden calificarse.");
    } else {
      notifyParticipants(exchange, jwt, "📦 Confirmé la entrega. Falta tu confirmación.");
    }
    return view(exchange);
  }

  @PostMapping("/{id}/rating")
  @Transactional
  ExchangeView rate(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody Rating request) {
    var exchange = participant(jwt, id);
    if (!exchange.ownerConfirmed || !exchange.proposerConfirmed) bad("Ambas personas deben confirmar antes de calificar");
    String review = request.review() == null ? "" : request.review().trim();
    if (request.rating() <= 2 && review.length() < 30) bad("Las calificaciones de 1 o 2 estrellas requieren un comentario de al menos 30 caracteres");
    if (role(exchange, jwt).equals("owner")) {
      if (exchange.ownerRating != null) bad("Ya calificaste este intercambio");
      exchange.ownerRating = request.rating();
      exchange.ownerReview = review;
    } else {
      if (exchange.proposerRating != null) bad("Ya calificaste este intercambio");
      exchange.proposerRating = request.rating();
      exchange.proposerReview = review;
    }
    if (exchange.ownerRating != null && exchange.proposerRating != null) exchange.status = "rated";
    return view(exchange);
  }

  /** Una publicación se entrega una sola vez: el resto de acuerdos y chats sobre ella se cierran. */
  private void closeOtherDeals(ExchangeEntity completed) {
    for (var other : exchanges.findByListingIdAndStatusIn(completed.listingId, ACTIVE)) {
      if (other.id.equals(completed.id)) continue;
      other.status = "listing-closed";
    }
    for (var conversation : conversations.findByListingIdAndStatus(completed.listingId, "active")) {
      if (conversation.id.equals(completed.conversationId)) continue;
      conversation.status = "closed";
      saveMessage(conversation, conversation.ownerId, "🔒 Esta publicación ya fue entregada a otra persona. La conversación quedó cerrada.");
    }
  }

  private void requireListingNotCompleted(String listingId) {
    if (exchanges.existsByListingIdAndStatusIn(listingId, COMPLETED)) {
      throw new ResponseStatusException(HttpStatus.GONE, "Esta publicación ya fue entregada");
    }
  }

  private ExchangeEntity participant(Jwt jwt, String id) {
    var exchange = exchanges.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    if (!exchange.ownerId.equals(jwt.getSubject()) && !exchange.proposerId.equals(jwt.getSubject())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
    return exchange;
  }

  private void requireOwner(ExchangeEntity exchange, Jwt jwt) {
    if (!exchange.ownerId.equals(jwt.getSubject())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Solo quien publicó puede responder la propuesta");
    }
  }

  private static void requireStatus(ExchangeEntity exchange, Set<String> allowed, String reason) {
    if (!allowed.contains(exchange.status)) conflict(reason);
  }

  private static String role(ExchangeEntity exchange, Jwt jwt) {
    return exchange.ownerId.equals(jwt.getSubject()) ? "owner" : "proposer";
  }

  private void ensureNotBlocked(String firstUserId, String secondUserId) {
    if (blockedUsers.existsByBlockerIdAndBlockedUserId(firstUserId, secondUserId)
        || blockedUsers.existsByBlockerIdAndBlockedUserId(secondUserId, firstUserId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No se puede continuar este intercambio");
    }
  }

  private void requireMessagingAllowed(Jwt jwt) {
    boolean restricted = catalog.mySanctions("Bearer " + jwt.getTokenValue()).stream()
        .anyMatch(item -> item.restrictionType().equals("messaging") || item.restrictionType().equals("all"));
    if (restricted) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tu cuenta tiene temporalmente restringidos los mensajes");
  }

  /** Deja constancia de cada paso del acuerdo en el chat de la conversación. */
  private void notifyParticipants(ExchangeEntity exchange, Jwt jwt, String text) {
    if (exchange.conversationId == null) return;
    conversations.findById(exchange.conversationId).ifPresent(conversation -> notify(conversation, jwt.getSubject(), text));
  }

  private void notify(ConversationEntity conversation, String senderId, String text) {
    saveMessage(conversation, senderId, text);
    conversation.updatedAt = Instant.now();
  }

  private void saveMessage(ConversationEntity conversation, String senderId, String text) {
    var message = new DirectMessageEntity();
    message.id = UUID.randomUUID().toString();
    message.conversationId = conversation.id;
    message.senderId = senderId;
    message.body = text.length() > 400 ? text.substring(0, 400) : text;
    messages.save(message);
  }

  static ExchangeView view(ExchangeEntity exchange) {
    Map<String, RatingView> ratings = new LinkedHashMap<>();
    if (exchange.ownerRating != null) ratings.put("owner", new RatingView(exchange.ownerRating, exchange.ownerReview));
    if (exchange.proposerRating != null) ratings.put("proposer", new RatingView(exchange.proposerRating, exchange.proposerReview));
    return new ExchangeView(exchange.id, exchange.conversationId, exchange.listingId, exchange.listingTitle, exchange.ownerId, exchange.proposerId,
        exchange.offeredTitle, exchange.offeredKind, exchange.note, exchange.status,
        exchange.meetupPlace, exchange.meetupDate, exchange.meetupTime, exchange.meetupProposedBy,
        exchange.ownerConfirmed, exchange.proposerConfirmed, ratings);
  }

  private static void bad(String reason) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, reason); }
  private static void conflict(String reason) { throw new ResponseStatusException(HttpStatus.CONFLICT, reason); }

  record Proposal(@NotBlank(message = "La conversación es obligatoria") String conversationId, @Size(max = 120, message = "Lo que ofreces no puede superar 120 caracteres") String offeredTitle,
      String offeredKind, @Size(max = 1000, message = "La nota no puede superar 1.000 caracteres") String note) {}
  record Meetup(@NotBlank(message = "El lugar del encuentro es obligatorio") @Size(max = 250, message = "El lugar del encuentro no puede superar 250 caracteres") String place, @NotBlank(message = "La fecha es obligatoria") String date, @NotBlank(message = "La hora es obligatoria") String time) {}
  record Rating(@Min(value = 1, message = "La calificación debe ser de 1 a 5 estrellas") @Max(value = 5, message = "La calificación debe ser de 1 a 5 estrellas") int rating, @Size(max = 1000, message = "El comentario no puede superar 1.000 caracteres") String review) {}
  record RatingView(int rating, String review) {}
  record ExchangeView(String id, String conversationId, String listingId, String listingTitle, String ownerId, String proposerId,
      String offeredTitle, String offeredKind, String note, String status,
      String meetupPlace, String meetupDate, String meetupTime, String meetupProposedBy,
      boolean ownerConfirmed, boolean proposerConfirmed, Map<String, RatingView> ratings) {}
}
