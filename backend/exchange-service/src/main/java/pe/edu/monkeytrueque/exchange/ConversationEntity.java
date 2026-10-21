package pe.edu.monkeytrueque.exchange;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "conversations")
class ConversationEntity {
  @Id String id;
  @Column(nullable = false) String listingId;
  @Column(nullable = false) String listingTitle;
  @Column(nullable = false) String listingMode;
  @Column(precision = 10, scale = 2) java.math.BigDecimal listingPrice;
  @Column(columnDefinition = "MEDIUMTEXT") String listingPhotoUrl;
  @Column(nullable = false) String ownerId;
  @Column(nullable = false) String ownerName;
  @Column(length = 1000) String ownerImageUrl;
  @Column(nullable = false) String visitorId;
  @Column(nullable = false) String visitorName;
  @Column(length = 1000) String visitorImageUrl;
  @Column(nullable = false) String status = "active";
  @CreationTimestamp @Column(nullable = false, updatable = false) Instant createdAt;
  @Column(nullable = false) Instant updatedAt;
}
