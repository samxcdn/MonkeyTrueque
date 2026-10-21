package pe.edu.monkeytrueque.exchange;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface BlockedUserRepository extends JpaRepository<BlockedUserEntity, String> {
  boolean existsByBlockerIdAndBlockedUserId(String blockerId, String blockedUserId);
  List<BlockedUserEntity> findByBlockerId(String blockerId);
  void deleteByBlockerIdAndBlockedUserId(String blockerId, String blockedUserId);
}
