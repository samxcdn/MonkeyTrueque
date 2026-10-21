package pe.edu.monkeytrueque.catalog;

import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/moderation")
class ModerationSelfServiceController {
  private final ModerationSanctionService sanctions;
  ModerationSelfServiceController(ModerationSanctionService sanctions) { this.sanctions = sanctions; }

  @GetMapping("/me/sanctions")
  List<PublicSanction> mine(@AuthenticationPrincipal Jwt jwt) {
    return sanctions.activeFor(jwt.getSubject()).stream().map(item -> new PublicSanction(item.id(), item.restrictionType(), item.reason(), item.startsAt(), item.expiresAt())).toList();
  }

  record PublicSanction(String id, String restrictionType, String reason, java.time.Instant startsAt, java.time.Instant expiresAt) {}
}
