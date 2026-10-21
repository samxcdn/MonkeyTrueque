package pe.edu.monkeytrueque.exchange;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface DirectMessageRepository extends JpaRepository<DirectMessageEntity, String> {
  List<DirectMessageEntity> findByConversationIdOrderByCreatedAtAsc(String conversationId);
}
