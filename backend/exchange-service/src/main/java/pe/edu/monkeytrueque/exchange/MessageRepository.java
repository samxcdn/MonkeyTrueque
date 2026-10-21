package pe.edu.monkeytrueque.exchange;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface MessageRepository extends JpaRepository<MessageEntity, String> {
  List<MessageEntity> findByExchangeIdOrderByCreatedAtAsc(String exchangeId);
}
