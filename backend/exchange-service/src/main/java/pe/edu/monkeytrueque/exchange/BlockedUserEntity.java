package pe.edu.monkeytrueque.exchange;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "blocked_users")
class BlockedUserEntity {
  @Id String id;
  @Column(nullable = false) String blockerId;
  @Column(nullable = false) String blockedUserId;
  @CreationTimestamp @Column(nullable = false, updatable = false) Instant createdAt;
}
