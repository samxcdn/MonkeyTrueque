package pe.edu.monkeytrueque.exchange;

import java.time.Instant;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class CompletionEventPublisher {
  private static final Logger log = LoggerFactory.getLogger(CompletionEventPublisher.class);
  private final CompletionOutboxRepository outbox;
  private final RabbitTemplate rabbit;

  CompletionEventPublisher(CompletionOutboxRepository outbox, RabbitTemplate rabbit) {
    this.outbox = outbox;
    this.rabbit = rabbit;
  }

  @Scheduled(fixedDelayString = "${app.completion-publish-interval-ms:5000}")
  @Transactional
  void publishPending() {
    for (var entry : outbox.findTop50ByDeliveredAtIsNullOrderByCreatedAtAsc()) {
      try {
        var correlation = new CorrelationData(entry.exchangeId);
        rabbit.convertAndSend(ExchangeEvents.EXCHANGE, ExchangeEvents.ROUTING_KEY,
            entry.exchangeId + "|" + entry.listingId, correlation);
        var confirmation = correlation.getFuture().get(5, TimeUnit.SECONDS);
        if (!confirmation.ack() || correlation.getReturned() != null) {
          throw new IllegalStateException("RabbitMQ no confirmó el evento " + entry.exchangeId);
        }
        entry.deliveredAt = Instant.now();
        outbox.save(entry);
      } catch (Exception ex) {
        log.warn("No se pudo publicar el intercambio {}; se reintentará", entry.exchangeId, ex);
        break;
      }
    }
  }
}
