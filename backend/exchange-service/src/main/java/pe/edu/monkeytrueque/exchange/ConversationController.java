package pe.edu.monkeytrueque.exchange;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
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

@RestController
@RequestMapping("/api/conversations")
class ConversationController {
  private final ConversationRepository conversations;
  private final DirectMessageRepository messages;
  private final CatalogClient catalog;
  private final BlockedUserRepository blockedUsers;
  private final ExchangeRepository exchanges;
  private final CatalogListings listings;

  ConversationController(ConversationRepository conversations, DirectMessageRepository messages, CatalogClient catalog,
      BlockedUserRepository blockedUsers, ExchangeRepository exchanges, CatalogListings listings) {
    this.conversations = conversations;
    this.messages = messages;
    this.catalog = catalog;
    this.blockedUsers = blockedUsers;
    this.exchanges = exchanges;
    this.listings = listings;
  }

  @GetMapping("/mine")
  List<ConversationView> mine(@AuthenticationPrincipal Jwt jwt) {
    return conversations.findTop100ByOwnerIdOrVisitorIdOrderByUpdatedAtDesc(jwt.getSubject(), jwt.getSubject())
        .stream().map(this::view).toList();
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  @Transactional
  ConversationView start(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody NewConversation request) {
    requireMessagingAllowed(jwt);
    var listing = listings.available(request.listingId());
    String visitorId = jwt.getSubject();
    if (listing.ownerId().equals(visitorId)) bad(HttpStatus.BAD_REQUEST, "No puedes iniciar una conversación con tu propia publicación");
    if (exchanges.existsByListingIdAndStatusIn(listing.id(), ExchangeController.COMPLETED)) bad(HttpStatus.GONE, "Esta publicación ya fue entregada");

    ensureNotBlocked(visitorId, listing.ownerId());
    var existing = conversations.findByListingIdAndVisitorId(listing.id(), visitorId);
    if (existing.isPresent()) return view(existing.get());

    var conversation = new ConversationEntity();
    conversation.id = UUID.randomUUID().toString();
    conversation.listingId = listing.id();
    conversation.listingTitle = listing.title();
    conversation.listingMode = listing.mode() == null ? "trade" : listing.mode();
    conversation.listingPrice = listing.price();
    conversation.listingPhotoUrl = listing.photos() == null || listing.photos().isEmpty() ? "" : listing.photos().get(0).src();
    conversation.ownerId = listing.ownerId();
    conversation.ownerName = safe(listing.ownerName(), "Vendedor");
    conversation.ownerImageUrl = listing.ownerImageUrl();
    conversation.visitorId = visitorId;
    conversation.visitorName = safe(jwt.getClaimAsString("name"), "Usuario interesado");
    conversation.status = "active";
    conversation.updatedAt = Instant.now();
    conversations.save(conversation);
    saveMessage(conversation, visitorId, request.message().trim());
    return view(conversation);
  }

  @PostMapping("/{id}/messages")
  @Transactional
  ConversationView send(@AuthenticationPrincipal Jwt jwt, @PathVariable String id, @Valid @RequestBody NewMessage request) {
    requireMessagingAllowed(jwt);
    var conversation = participant(jwt, id);
    if (!"active".equals(conversation.status)) bad(HttpStatus.CONFLICT, "Esta conversación está cerrada");
    ensureNotBlocked(conversation.ownerId, conversation.visitorId);
    saveMessage(conversation, jwt.getSubject(), request.text().trim());
    conversation.updatedAt = Instant.now();
    conversations.save(conversation);
    return view(conversation);
  }

  private ConversationEntity participant(Jwt jwt, String id) {
    var conversation = conversations.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    if (!conversation.ownerId.equals(jwt.getSubject()) && !conversation.visitorId.equals(jwt.getSubject())) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
    return conversation;
  }

  private void ensureNotBlocked(String firstUserId, String secondUserId) {
    if (blockedUsers.existsByBlockerIdAndBlockedUserId(firstUserId, secondUserId)
        || blockedUsers.existsByBlockerIdAndBlockedUserId(secondUserId, firstUserId)) {
      throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No se puede continuar esta conversación");
    }
  }

  private void requireMessagingAllowed(Jwt jwt) {
    boolean restricted = catalog.mySanctions("Bearer " + jwt.getTokenValue()).stream()
        .anyMatch(item -> item.restrictionType().equals("messaging") || item.restrictionType().equals("all"));
    if (restricted) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Tu cuenta tiene temporalmente restringidos los mensajes");
  }

  private void saveMessage(ConversationEntity conversation, String senderId, String text) {
    var message = new DirectMessageEntity();
    message.id = UUID.randomUUID().toString();
    message.conversationId = conversation.id;
    message.senderId = senderId;
    message.body = text.length() > 400 ? text.substring(0, 400) : text;
    messages.save(message);
  }

  private ConversationView view(ConversationEntity conversation) {
    List<DirectMessageView> messageViews = messages.findByConversationIdOrderByCreatedAtAsc(conversation.id).stream()
        .map(message -> new DirectMessageView(message.id, message.senderId, message.body, message.createdAt)).toList();
    return new ConversationView(conversation.id, conversation.listingId, conversation.listingTitle, conversation.listingMode,
        conversation.listingPrice, conversation.listingPhotoUrl, conversation.ownerId, conversation.ownerName,
        conversation.ownerImageUrl, conversation.visitorId, conversation.visitorName, conversation.visitorImageUrl,
        conversation.status, conversation.updatedAt, exchanges.findFirstByConversationIdOrderByCreatedAtDesc(conversation.id).map(exchange -> exchange.id).orElse(null), messageViews);
  }

  private String safe(String value, String fallback) { return value == null || value.isBlank() ? fallback : value; }
  private void bad(HttpStatus status, String reason) { throw new ResponseStatusException(status, reason); }

  record NewConversation(@NotBlank(message = "La publicación es obligatoria") String listingId, @NotBlank(message = "El mensaje es obligatorio") @Size(max = 400, message = "El mensaje no puede superar 400 caracteres") String message) {}
  record NewMessage(@NotBlank(message = "El mensaje es obligatorio") @Size(max = 400, message = "El mensaje no puede superar 400 caracteres") String text) {}
  record DirectMessageView(String id, String senderId, String text, Instant createdAt) {}
  record ConversationView(String id, String listingId, String listingTitle, String listingMode,
      java.math.BigDecimal listingPrice, String listingPhotoUrl, String ownerId, String ownerName,
      String ownerImageUrl, String visitorId, String visitorName, String visitorImageUrl,
      String status, Instant updatedAt, String exchangeId, List<DirectMessageView> messages) {}
}
