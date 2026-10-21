package pe.edu.monkeytrueque.catalog;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ModerationSanctionServiceTests {
  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final ModerationSanctionService service = new ModerationSanctionService(jdbc);

  @Test
  void activeMessagingSanctionBlocksTheRequestedAction() {
    when(jdbc.queryForObject(anyString(), eq(Integer.class), any(), any())).thenReturn(1);
    var error = assertThrows(ResponseStatusException.class, () -> service.requireAllowed("user-1", "messaging"));
    assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
  }

  @Test
  void noActiveSanctionAllowsTheAction() {
    when(jdbc.queryForObject(anyString(), eq(Integer.class), any(), any())).thenReturn(0);
    assertDoesNotThrow(() -> service.requireAllowed("user-1", "publishing"));
  }
}
