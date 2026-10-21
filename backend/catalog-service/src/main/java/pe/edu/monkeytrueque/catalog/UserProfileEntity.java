package pe.edu.monkeytrueque.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "user_profiles")
class UserProfileEntity {
  @Id @Column(name = "user_id") String userId;
  @Column(name = "display_name", nullable = false) String displayName;
  @Column(name = "image_url", length = 1000) String imageUrl;
  @Column(name = "description", length = 500) String description;
  @Column(name = "phone_number", length = 40) String phoneNumber;
  @Column(name = "department", length = 100) String department;
  @Column(name = "country_code", length = 2) String countryCode;
  @Column(name = "community_ids", nullable = false, length = 2500) String communityIds = "";
  @Column(name = "district_id", length = 80) String districtId;
  @Column(name = "member_since", nullable = false) Instant memberSince;
  @Column(name = "identity_verified", nullable = false) boolean identityVerified;
}
