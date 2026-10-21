package pe.edu.monkeytrueque.exchange;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface ConversationRepository extends JpaRepository<ConversationEntity, String> {
  List<ConversationEntity> findTop100ByOwnerIdOrVisitorIdOrderByUpdatedAtDesc(String ownerId, String visitorId);
  Optional<ConversationEntity> findByListingIdAndVisitorId(String listingId, String visitorId);
  List<ConversationEntity> findByListingIdAndStatus(String listingId, String status);
}
