package pe.edu.monkeytrueque.exchange;

import java.util.List;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import java.util.List;

@FeignClient(name = "catalog", url = "${app.catalog-url}")
interface CatalogClient {
  @GetMapping("/api/admin/me")
  StaffIdentity staffRole(@RequestHeader("Authorization") String authorization);

  @GetMapping("/api/moderation/me/sanctions")
  List<UserSanction> mySanctions(@RequestHeader("Authorization") String authorization);

  @GetMapping("/api/listings/{id}")
  CatalogListing get(@PathVariable("id") String id);

  record CatalogListing(String id, String ownerId, String ownerName, String ownerImageUrl, String title, String locationReference,
      String mode, java.math.BigDecimal price, List<ListingPhoto> photos, List<String> accepts,
      boolean available, boolean moderationHidden) {
    CatalogListing(String id, String ownerId, String ownerName, String ownerImageUrl, String title,
        String mode, java.math.BigDecimal price, List<ListingPhoto> photos, List<String> accepts,
        boolean available, boolean moderationHidden) {
      this(id, ownerId, ownerName, ownerImageUrl, title, null, mode, price, photos, accepts, available, moderationHidden);
    }
  }
  record ListingPhoto(String src, String alt, String credit, String publicId) {}
  record UserSanction(String id, String restrictionType, String reason, java.time.Instant startsAt,
      java.time.Instant expiresAt) {}
  record StaffIdentity(String role, boolean admin, boolean moderator) {}
}
