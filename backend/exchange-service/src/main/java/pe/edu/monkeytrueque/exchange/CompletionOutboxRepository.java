package pe.edu.monkeytrueque.exchange;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface CompletionOutboxRepository extends JpaRepository<CompletionOutboxEntity, String> {
  List<CompletionOutboxEntity> findTop50ByDeliveredAtIsNullOrderByCreatedAtAsc();
}
