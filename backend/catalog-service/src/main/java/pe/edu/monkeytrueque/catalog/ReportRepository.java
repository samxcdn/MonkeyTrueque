package pe.edu.monkeytrueque.catalog;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface ReportRepository extends JpaRepository<ReportEntity, String> {
  List<ReportEntity> findTop100ByArchivedFalseOrderByCreatedAtDesc();
  List<ReportEntity> findTop100ByReporterIdOrderByCreatedAtDesc(String reporterId);
}
