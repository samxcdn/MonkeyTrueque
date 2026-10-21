package pe.edu.monkeytrueque.exchange;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CompletionEventPublisherTests {
  private final CompletionOutboxRepository outbox = mock(CompletionOutboxRepository.class);
  private final RabbitTemplate rabbit = mock(RabbitTemplate.class);
  private final CompletionEventPublisher publisher = new CompletionEventPublisher(outbox, rabbit);

  @Test
  void marksOutboxDeliveredOnlyAfterBrokerConfirmation() {
    var entry = new CompletionOutboxEntity("exchange-1", "listing-1");
    when(outbox.findTop50ByDeliveredAtIsNullOrderByCreatedAtAsc()).thenReturn(List.of(entry));
    doAnswer(invocation -> {
      CorrelationData correlation = invocation.getArgument(3);
      correlation.getFuture().complete(new CorrelationData.Confirm(true, null));
      return null;
    }).when(rabbit).convertAndSend(eq(ExchangeEvents.EXCHANGE), eq(ExchangeEvents.ROUTING_KEY),
        anyString(), any(CorrelationData.class));

    publisher.publishPending();

    assertNotNull(entry.deliveredAt);
    verify(outbox).save(entry);
  }

  @Test
  void keepsOutboxPendingWhenBrokerFails() {
    var entry = new CompletionOutboxEntity("exchange-1", "listing-1");
    when(outbox.findTop50ByDeliveredAtIsNullOrderByCreatedAtAsc()).thenReturn(List.of(entry));
    doThrow(new IllegalStateException("broker down")).when(rabbit).convertAndSend(
        eq(ExchangeEvents.EXCHANGE), eq(ExchangeEvents.ROUTING_KEY), anyString(), any(CorrelationData.class));

    publisher.publishPending();

    assertNull(entry.deliveredAt);
    verify(outbox, never()).save(any());
  }
}
