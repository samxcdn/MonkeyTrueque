package pe.edu.monkeytrueque.exchange;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "exchange_messages")
class MessageEntity {
  @Id String id;
  @Column(nullable = false) String exchangeId;
  @Column(nullable = false) String sender;
  @Column(name = "body", nullable = false, length = 400) String text;
  @CreationTimestamp @Column(nullable = false, updatable = false) Instant createdAt;
}
