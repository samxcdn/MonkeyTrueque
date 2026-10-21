package pe.edu.monkeytrueque.exchange;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface ExchangeRepository extends JpaRepository<ExchangeEntity, String> {
  List<ExchangeEntity> findTop30ByOwnerIdOrProposerIdOrderByCreatedAtDesc(String ownerId, String proposerId);
  List<ExchangeEntity> findByOwnerIdOrProposerIdOrderByCreatedAtDesc(String ownerId, String proposerId);
  List<ExchangeEntity> findTop100ByOrderByCreatedAtDesc();
  Optional<ExchangeEntity> findFirstByConversationIdOrderByCreatedAtDesc(String conversationId);
  List<ExchangeEntity> findByListingIdAndStatusIn(String listingId, Collection<String> statuses);
  boolean existsByConversationIdAndStatusIn(String conversationId, Collection<String> statuses);
  boolean existsByListingIdAndStatusIn(String listingId, Collection<String> statuses);
  boolean existsByListingIdAndStatusInAndIdNot(String listingId, Collection<String> statuses, String id);
  long countByListingIdAndOwnerIdAndStatusIn(String listingId, String ownerId, Collection<String> statuses);
}
