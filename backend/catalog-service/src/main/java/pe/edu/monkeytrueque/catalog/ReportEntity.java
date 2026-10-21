package pe.edu.monkeytrueque.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "reports")
class ReportEntity {
  @Id String id;
  @Column(nullable = false) String reporterId;
  String listingId;
  @Column(name = "target_type", nullable = false, length = 24) String targetType = "listing";
  @Column(name = "target_id", length = 100) String targetId;
  @Column(nullable = false) String reason;
  @Column(nullable = false, length = 1000) String details = "";
  @Column(nullable = false) String status = "open";
  @Column(nullable = false, length = 16) String priority = "normal";
  @Column(name = "assigned_to", length = 100) String assignedTo;
  @Column(name = "evidence_snapshot", columnDefinition = "LONGTEXT") String evidenceSnapshot;
  @Column(length = 1000) String resolution;
  @Column(name = "user_response", length = 1000) String userResponse;
  String reviewedBy;
  Instant reviewedAt;
  @Column(nullable = false) boolean archived = false;
  Instant archivedAt;
  @Column(length = 100) String archivedBy;
  @CreationTimestamp @Column(nullable = false, updatable = false) Instant createdAt;
}
