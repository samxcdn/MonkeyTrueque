package pe.edu.monkeytrueque.exchange;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class ExchangeControllerTests {
  private final ExchangeRepository exchanges = mock(ExchangeRepository.class);
  private final ConversationRepository conversations = mock(ConversationRepository.class);
  private final DirectMessageRepository messages = mock(DirectMessageRepository.class);
  private final CatalogClient catalog = mock(CatalogClient.class);
  private final CatalogListings listings = mock(CatalogListings.class);
  private final CompletionOutboxRepository outbox = mock(CompletionOutboxRepository.class);
  private final BlockedUserRepository blockedUsers = mock(BlockedUserRepository.class);
  private final ExchangeController controller = new ExchangeController(exchanges, conversations, messages, outbox, catalog, listings, blockedUsers);
  private final ConversationEntity conversation = conversation();

  @BeforeEach
  void fixedClock() {
    controller.clock = Clock.fixed(Instant.parse("2026-10-10T15:00:00Z"), ZoneId.of("America/Lima"));
    when(conversations.findById("chat-1")).thenReturn(Optional.of(conversation));
    when(catalog.mySanctions(anyString())).thenReturn(List.of());
  }

  @Test
  void meetupTimesAreShownInTwelveHourFormat() {
    assertEquals("12:05 a. m.", ExchangeController.timeLabel("00:05"));
    assertEquals("9:30 a. m.", ExchangeController.timeLabel("09:30"));
    assertEquals("12:04 p. m.", ExchangeController.timeLabel("12:04"));
    assertEquals("3:30 p. m.", ExchangeController.timeLabel("15:30"));
  }

  @Test
  void onlyTheVisitorCanProposeAndOnlyWhatTheListingAccepts() {
    when(listings.available("listing-1")).thenReturn(tradeListing());

    assertEquals(HttpStatus.FORBIDDEN, status(() -> controller.propose(jwt("owner"), proposal("Libro", "object"))));
    assertEquals(HttpStatus.BAD_REQUEST, status(() -> controller.propose(jwt("visitor"), proposal("Clases", "service"))));

    var created = controller.propose(jwt("visitor"), proposal("Libro", "object"));

    assertEquals("proposal-sent", created.status());
    assertEquals("chat-1", created.conversationId());
    assertEquals("Libro", created.offeredTitle());
    verify(messages).save(argThat(message -> message.conversationId.equals("chat-1") && message.body.contains("Libro")));
  }

  @Test
  void saleRequestsDescribeThePriceAndDoNotNeedAnOffer() {
    when(listings.available("listing-1")).thenReturn(new CatalogClient.CatalogListing("listing-1", "owner", "Ana", null, "Bicicleta",
        "sale", new BigDecimal("80"), List.of(), List.of(), true, false));

    var created = controller.propose(jwt("visitor"), proposal(null, null));

    assertEquals("Compra por S/ 80.00", created.offeredTitle());
  }

  @Test
  void aVisitorCannotStackProposalsInTheSameConversation() {
    when(exchanges.existsByConversationIdAndStatusIn(eq("chat-1"), any())).thenReturn(true);

    assertEquals(HttpStatus.CONFLICT, status(() -> controller.propose(jwt("visitor"), proposal("Libro", "object"))));
    verify(exchanges, never()).save(any());
  }

  @Test
  void proposalsAreRejectedOnceTheListingWasDelivered() {
    when(exchanges.existsByListingIdAndStatusIn(eq("listing-1"), eq(ExchangeController.COMPLETED))).thenReturn(true);

    assertEquals(HttpStatus.GONE, status(() -> controller.propose(jwt("visitor"), proposal("Libro", "object"))));
  }

  @Test
  void onlyTheOwnerAnswersAProposalAndOnlyOneDealCanBeInProgressPerListing() {
    var exchange = agreement("proposal-sent");
    assertEquals(HttpStatus.FORBIDDEN, status(() -> controller.accept(jwt("visitor"), exchange.id)));

    when(exchanges.existsByListingIdAndStatusInAndIdNot("listing-1", ExchangeController.COMMITTED, exchange.id)).thenReturn(true);
    assertEquals(HttpStatus.CONFLICT, status(() -> controller.accept(jwt("owner"), exchange.id)));

    when(exchanges.existsByListingIdAndStatusInAndIdNot("listing-1", ExchangeController.COMMITTED, exchange.id)).thenReturn(false);
    assertEquals("accepted", controller.accept(jwt("owner"), exchange.id).status());
    assertEquals(HttpStatus.CONFLICT, status(() -> controller.reject(jwt("owner"), exchange.id)));
  }

  @Test
  void theOwnerRejectsWhileTheVisitorWithdrawsTheirProposal() {
    var exchange = agreement("proposal-sent");
    assertEquals(HttpStatus.CONFLICT, status(() -> controller.cancel(jwt("owner"), exchange.id)));
    assertEquals("cancelled", controller.cancel(jwt("visitor"), exchange.id).status());

    var other = agreement("proposal-sent");
    assertEquals("rejected", controller.reject(jwt("owner"), other.id).status());
  }

  @Test
  void aMeetupNeedsTheOtherPersonsApprovalAndAFutureDate() {
    var exchange = agreement("accepted");

    assertEquals(HttpStatus.BAD_REQUEST, status(() -> controller.meetup(jwt("visitor"), exchange.id,
        new ExchangeController.Meetup("Parque", "2026-10-10", "09:00"))));
    var proposed = controller.meetup(jwt("visitor"), exchange.id, new ExchangeController.Meetup("Parque", "2026-10-12", "17:00"));
    assertEquals("meetup-proposed", proposed.status());
    assertEquals("proposer", proposed.meetupProposedBy());

    assertEquals(HttpStatus.CONFLICT, status(() -> controller.acceptMeetup(jwt("visitor"), exchange.id)));
    assertEquals(HttpStatus.CONFLICT, status(() -> controller.confirm(jwt("owner"), exchange.id)));
    assertEquals("meetup-agreed", controller.acceptMeetup(jwt("owner"), exchange.id).status());
  }

  @Test
  void deliveryCanOnlyBeConfirmedFromTheMeetupDay() {
    var exchange = agreement("meetup-agreed");
    exchange.meetupDate = "2026-10-11";

    assertEquals(HttpStatus.CONFLICT, status(() -> controller.confirm(jwt("owner"), exchange.id)));

    controller.clock = Clock.fixed(Instant.parse("2026-10-11T15:00:00Z"), ZoneId.of("America/Lima"));
    assertEquals("confirmed-by-one", controller.confirm(jwt("owner"), exchange.id).status());
    assertEquals(HttpStatus.CONFLICT, status(() -> controller.confirm(jwt("owner"), exchange.id)));
  }

  @Test
  void completingADealClosesTheListingAndEveryOtherDealOrChatAboutIt() {
    var exchange = agreement("confirmed-by-one");
    exchange.ownerConfirmed = true;
    var pending = agreement("proposal-sent");
    pending.id = "exchange-2";
    pending.conversationId = "chat-2";
    var otherChat = conversation();
    otherChat.id = "chat-2";
    otherChat.visitorId = "someone-else";
    when(exchanges.findByListingIdAndStatusIn("listing-1", ExchangeController.ACTIVE)).thenReturn(List.of(exchange, pending));
    when(conversations.findByListingIdAndStatus("listing-1", "active")).thenReturn(List.of(conversation, otherChat));

    var both = controller.confirm(jwt("visitor"), exchange.id);

    assertEquals("confirmed-by-both", both.status());
    verify(outbox).save(argThat(event -> event.exchangeId.equals(exchange.id) && event.listingId.equals("listing-1")));
    assertEquals("listing-closed", pending.status);
    assertEquals("closed", otherChat.status);
    assertEquals("active", conversation.status);
  }

  @Test
  void ratingsRequireBothConfirmationsAndCannotBeRepeated() {
    var exchange = agreement("confirmed-by-one");
    exchange.ownerConfirmed = true;
    var rating = new ExchangeController.Rating(5, "Todo bien");
    assertEquals(HttpStatus.BAD_REQUEST, status(() -> controller.rate(jwt("owner"), exchange.id, rating)));

    exchange.proposerConfirmed = true;
    exchange.status = "confirmed-by-both";
    controller.rate(jwt("owner"), exchange.id, rating);
    assertEquals(HttpStatus.BAD_REQUEST, status(() -> controller.rate(jwt("owner"), exchange.id, rating)));
    assertEquals(HttpStatus.BAD_REQUEST, status(() -> controller.rate(jwt("visitor"), exchange.id,
        new ExchangeController.Rating(1, "Mal"))));
    assertEquals("rated", controller.rate(jwt("visitor"), exchange.id, new ExchangeController.Rating(4, "")).status());
  }

  @Test
  void strangersCannotReadOrChangeAnAgreement() {
    var exchange = agreement("proposal-sent");
    assertEquals(HttpStatus.FORBIDDEN, status(() -> controller.one(jwt("stranger"), exchange.id)));
    assertEquals(HttpStatus.FORBIDDEN, status(() -> controller.cancel(jwt("stranger"), exchange.id)));
  }

  private ExchangeEntity agreement(String status) {
    var exchange = new ExchangeEntity();
    exchange.id = "exchange-" + System.identityHashCode(exchange);
    exchange.conversationId = "chat-1";
    exchange.ownerId = "owner";
    exchange.proposerId = "visitor";
    exchange.listingId = "listing-1";
    exchange.listingTitle = "Bicicleta";
    exchange.offeredTitle = "Libro";
    exchange.offeredKind = "object";
    exchange.note = "";
    exchange.status = status;
    if (!status.equals("proposal-sent") && !status.equals("accepted")) {
      exchange.meetupPlace = "Parque";
      exchange.meetupDate = "2026-10-10";
      exchange.meetupTime = "12:00";
    }
    when(exchanges.findById(exchange.id)).thenReturn(Optional.of(exchange));
    return exchange;
  }

  private static ConversationEntity conversation() {
    var conversation = new ConversationEntity();
    conversation.id = "chat-1";
    conversation.listingId = "listing-1";
    conversation.listingTitle = "Bicicleta";
    conversation.ownerId = "owner";
    conversation.visitorId = "visitor";
    conversation.status = "active";
    return conversation;
  }

  private static CatalogClient.CatalogListing tradeListing() {
    return new CatalogClient.CatalogListing("listing-1", "owner", "Ana", null, "Bicicleta",
        "trade", null, List.of(), List.of("object"), true, false);
  }

  private static ExchangeController.Proposal proposal(String title, String kind) {
    return new ExchangeController.Proposal("chat-1", title, kind, "");
  }

  private static HttpStatus status(org.junit.jupiter.api.function.Executable action) {
    return (HttpStatus) assertThrows(ResponseStatusException.class, action).getStatusCode();
  }

  private Jwt jwt(String subject) {
    return Jwt.withTokenValue("test").header("alg", "none").subject(subject).build();
  }
}
