package pe.edu.monkeytrueque.catalog;

import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
class ModerationEvidenceController {
  private final ModerationEvidenceService evidence;
  private final AdminAccess access;

  ModerationEvidenceController(ModerationEvidenceService evidence, AdminAccess access) {
    this.evidence = evidence;
    this.access = access;
  }

  @GetMapping("/api/admin/reports/{id}/attachments")
  ResponseEntity<List<ModerationEvidenceService.EvidenceImageView>> reportAttachments(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    access.requireStaff(jwt);
    return ResponseEntity.ok().cacheControl(CacheControl.noStore().cachePrivate()).body(evidence.find("report", id));
  }

  @GetMapping("/api/admin/appeals/{id}/attachments")
  ResponseEntity<List<ModerationEvidenceService.EvidenceImageView>> appealAttachments(@AuthenticationPrincipal Jwt jwt, @PathVariable String id) {
    access.requireStaff(jwt);
    return ResponseEntity.ok().cacheControl(CacheControl.noStore().cachePrivate()).body(evidence.find("appeal", id));
  }
}
