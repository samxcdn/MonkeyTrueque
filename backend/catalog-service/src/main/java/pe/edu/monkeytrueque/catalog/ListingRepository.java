package pe.edu.monkeytrueque.catalog;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface ListingRepository extends JpaRepository<ListingEntity, String> {
  /** Publicaciones visibles: disponibles, no ocultas por moderación y de cuentas activas. */
  @Query(value = "SELECT l.* FROM listings l WHERE l.available = TRUE AND l.moderation_hidden = FALSE "
      + "AND NOT EXISTS (SELECT 1 FROM app_users u WHERE u.user_id = l.owner_id AND u.deactivated = TRUE) "
      + "ORDER BY l.created_at DESC LIMIT 100", nativeQuery = true)
  List<ListingEntity> findPublicListings();

  @Query(value = "SELECT COUNT(*) FROM app_users WHERE user_id = :ownerId AND deactivated = TRUE", nativeQuery = true)
  long countDeactivatedOwner(@Param("ownerId") String ownerId);
  List<ListingEntity> findTop100ByOrderByCreatedAtDesc();
  List<ListingEntity> findByOwnerIdOrderByCreatedAtDesc(String ownerId);

  @Modifying
  @Query("update ListingEntity listing set listing.ownerName = :displayName, listing.ownerImageUrl = :imageUrl where listing.ownerId = :userId")
  int updateOwnerProfile(@Param("userId") String userId, @Param("displayName") String displayName, @Param("imageUrl") String imageUrl);
}
