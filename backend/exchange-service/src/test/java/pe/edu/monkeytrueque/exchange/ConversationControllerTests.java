package pe.edu.monkeytrueque.exchange;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ConversationControllerTests {
  private final ConversationRepository conversations = mock(ConversationRepository.class);
  private final DirectMessageRepository messages = mock(DirectMessageRepository.class);
  private final CatalogClient catalog = mock(CatalogClient.class);
  private final BlockedUserRepository blockedUsers = mock(BlockedUserRepository.class);
  private final ExchangeRepository exchanges = mock(ExchangeRepository.class);
  private final CatalogListings listings = mock(CatalogListings.class);
  private final ConversationController controller = new ConversationController(conversations, messages, catalog, blockedUsers, exchanges, listings);

  @Test
  void startsAConversationForAnyListingModeAndSavesTheOpeningMessage() {
    var listing = new CatalogClient.CatalogListing("listing-1", "owner", "Vendedora", "https://img.test/owner.jpg",
        "Argos", "sale", new BigDecimal("70.00"), List.of(new CatalogClient.ListingPhoto("https://img.test/item.jpg", "Foto", "", null)),
        List.of(), true, false);
    when(listings.available("listing-1")).thenReturn(listing);
    when(conversations.findByListingIdAndVisitorId("listing-1", "buyer")).thenReturn(Optional.empty());
    when(messages.findByConversationIdOrderByCreatedAtAsc(any())).thenReturn(List.of());

    var result = controller.start(jwt("buyer"), new ConversationController.NewConversation("listing-1", "¿Sigue disponible?"));

    assertEquals("Argos", result.listingTitle());
    assertEquals("sale", result.listingMode());
    assertEquals("Vendedora", result.ownerName());
    verify(conversations).save(argThat(saved -> saved.ownerId.equals("owner") && saved.visitorId.equals("buyer")
        && saved.status.equals("active")));
    verify(messages).save(argThat(saved -> saved.senderId.equals("buyer") && saved.body.equals("¿Sigue disponible?")));
  }

  @Test
  void rejectsSelfConversationsAndMessagesFromNonParticipants() {
    var ownListing = new CatalogClient.CatalogListing("listing-1", "buyer", "Yo", null,
        "Argos", "gift", null, List.of(), List.of(), true, false);
    when(listings.available("listing-1")).thenReturn(ownListing);
    assertEquals(HttpStatus.BAD_REQUEST, assertThrows(ResponseStatusException.class,
        () -> controller.start(jwt("buyer"), new ConversationController.NewConversation("listing-1", "Hola"))).getStatusCode());

    var conversation = new ConversationEntity();
    conversation.id = "chat-1";
    conversation.ownerId = "owner";
    conversation.visitorId = "visitor";
    conversation.status = "active";
    when(conversations.findById("chat-1")).thenReturn(Optional.of(conversation));
    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.send(jwt("stranger"), "chat-1", new ConversationController.NewMessage("Hola"))).getStatusCode());
  }

  @Test
  void preventsMessagesWhenEitherParticipantBlockedTheOther() {
    var conversation = new ConversationEntity();
    conversation.id = "chat-1";
    conversation.ownerId = "owner";
    conversation.visitorId = "visitor";
    conversation.status = "active";
    when(conversations.findById("chat-1")).thenReturn(Optional.of(conversation));
    when(blockedUsers.existsByBlockerIdAndBlockedUserId("owner", "visitor")).thenReturn(true);

    assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class,
        () -> controller.send(jwt("visitor"), "chat-1", new ConversationController.NewMessage("Hola"))).getStatusCode());
    verify(messages, never()).save(any());
  }

  @Test
  void aDeliveredListingCannotReceiveNewConversations() {
    var listing = new CatalogClient.CatalogListing("listing-1", "owner", "Vendedora", null,
        "Argos", "sale", new BigDecimal("70.00"), List.of(), List.of(), true, false);
    when(listings.available("listing-1")).thenReturn(listing);
    when(exchanges.existsByListingIdAndStatusIn("listing-1", ExchangeController.COMPLETED)).thenReturn(true);

    assertEquals(HttpStatus.GONE, assertThrows(ResponseStatusException.class,
        () -> controller.start(jwt("buyer"), new ConversationController.NewConversation("listing-1", "Hola"))).getStatusCode());
    verify(conversations, never()).save(any());
  }

  private Jwt jwt(String subject) {
    return Jwt.withTokenValue("test").header("alg", "none").subject(subject).claim("name", "Persona Test").build();
  }
}
