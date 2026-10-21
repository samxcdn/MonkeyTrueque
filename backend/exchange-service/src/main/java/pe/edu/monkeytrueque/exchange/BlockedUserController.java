package pe.edu.monkeytrueque.exchange;

import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/conversations/blocks")
class BlockedUserController {
  private final BlockedUserRepository blockedUsers;
  BlockedUserController(BlockedUserRepository blockedUsers) { this.blockedUsers = blockedUsers; }

  @GetMapping
  List<String> mine(@AuthenticationPrincipal Jwt jwt) {
    return blockedUsers.findByBlockerId(jwt.getSubject()).stream().map(block -> block.blockedUserId).toList();
  }

  @PostMapping("/{userId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void block(@AuthenticationPrincipal Jwt jwt, @PathVariable String userId) {
    String blockerId = jwt.getSubject();
    if (blockerId.equals(userId)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No puedes bloquear tu propia cuenta");
    if (!blockedUsers.existsByBlockerIdAndBlockedUserId(blockerId, userId)) {
      var block = new BlockedUserEntity();
      block.id = UUID.randomUUID().toString();
      block.blockerId = blockerId;
      block.blockedUserId = userId;
      blockedUsers.save(block);
    }
  }

  @DeleteMapping("/{userId}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void unblock(@AuthenticationPrincipal Jwt jwt, @PathVariable String userId) {
    blockedUsers.deleteByBlockerIdAndBlockedUserId(jwt.getSubject(), userId);
  }
}
