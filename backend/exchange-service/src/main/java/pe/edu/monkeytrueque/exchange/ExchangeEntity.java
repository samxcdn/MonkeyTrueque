package pe.edu.monkeytrueque.exchange;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "exchanges")
class ExchangeEntity {
  @Id String id;
  @Column(nullable = false) String listingId;
  @Column(length = 36) String conversationId;
  @Column(nullable = false) String listingTitle;
  @Column(nullable = false) String ownerId;
  @Column(nullable = false) String proposerId;
  @Column(nullable = false) String offeredTitle;
  @Column(nullable = false) String offeredKind;
  @Column(nullable = false, length = 1000) String note;
  @Column(nullable = false) String status;
  @Column(nullable = false) String meetupPlace = "";
  @Column(nullable = false) String meetupDate = "";
  @Column(nullable = false) String meetupTime = "";
  @Column(length = 16) String meetupProposedBy;
  boolean ownerConfirmed;
  boolean proposerConfirmed;
  Integer ownerRating;
  @Column(length = 1000) String ownerReview;
  boolean ownerReviewHidden;
  @Column(length = 1000) String ownerReviewModerationNote;
  Integer proposerRating;
  @Column(length = 1000) String proposerReview;
  boolean proposerReviewHidden;
  @Column(length = 1000) String proposerReviewModerationNote;
  @CreationTimestamp @Column(nullable = false, updatable = false) Instant createdAt;
  @Version long version;
}
