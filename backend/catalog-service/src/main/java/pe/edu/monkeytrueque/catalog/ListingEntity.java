package pe.edu.monkeytrueque.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.math.BigDecimal;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "listings")
class ListingEntity {
  @Id String id;
  @Column(nullable = false) String ownerId;
  @Column(nullable = false) String ownerName;
  @Column(length = 1000) String ownerImageUrl;
  @Column(nullable = false) String title;
  @Column(nullable = false, length = 2000) String description;
  @Column(nullable = false) String kind;
  @Column(name = "listing_mode", nullable = false) String mode = "trade";
  @Column(name = "sale_price") BigDecimal price;
  @Column(nullable = false) String category;
  @Column(name = "item_condition", nullable = false) String condition;
  @Column(nullable = false) String districtId;
  @Column(length = 160) String locationReference;
  @Column(nullable = false) String acceptanceSummary;
  @Column(nullable = false) String accepts;
  @Column(nullable = false, columnDefinition = "LONGTEXT") String photosJson;
  boolean available = true;
  boolean moderationHidden;
  @Column(name = "moderation_hidden_reason", length = 1000) String moderationHiddenReason;
  @CreationTimestamp @Column(nullable = false, updatable = false) Instant createdAt;
}
