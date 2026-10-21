package pe.edu.monkeytrueque.exchange;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "direct_messages")
class DirectMessageEntity {
  @Id String id;
  @Column(nullable = false) String conversationId;
  @Column(nullable = false) String senderId;
  @Column(nullable = false, length = 400) String body;
  @CreationTimestamp @Column(nullable = false, updatable = false) Instant createdAt;
}
