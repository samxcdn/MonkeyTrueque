package pe.edu.monkeytrueque.exchange;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "exchange_completion_outbox")
class CompletionOutboxEntity {
  @Id @Column(length = 36) String exchangeId;
  @Column(nullable = false, length = 36) String listingId;
  @CreationTimestamp @Column(nullable = false, updatable = false) Instant createdAt;
  Instant deliveredAt;

  protected CompletionOutboxEntity() {}

  CompletionOutboxEntity(String exchangeId, String listingId) {
    this.exchangeId = exchangeId;
    this.listingId = listingId;
  }
}
