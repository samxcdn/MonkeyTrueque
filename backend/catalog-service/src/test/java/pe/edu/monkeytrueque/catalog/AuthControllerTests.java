package pe.edu.monkeytrueque.catalog;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AuthControllerTests {
  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final PasswordEncoder passwords = mock(PasswordEncoder.class);
  private final JwtTokenService tokens = mock(JwtTokenService.class);
  private final AuthController controller = new AuthController(jdbc, passwords, tokens, mock(ListingRepository.class), mock(CloudinaryImageStorage.class));

  @Test
  void registeringNeverGrantsAStaffRoleEvenAsTheFirstAccount() {
    // Base vacía: nadie usa ese nombre y esta sería la primera cuenta.
    when(jdbc.queryForObject(contains("COUNT(*) FROM app_users"), eq(Integer.class), any())).thenReturn(0);
    when(passwords.encode(anyString())).thenReturn("hash");
    when(jdbc.queryForObject(anyString(), any(RowMapper.class), anyString()))
        .thenReturn(new AuthController.AuthenticatedUser("id", "Ana", "ana", null));
    when(tokens.startSession(any(), anyString(), anyString(), anyString())).thenReturn(Instant.now());

    var result = controller.register(new AuthController.RegisterRequest("Ana", "ana", "ClaveSegura2026"), new MockHttpServletResponse());

    assertEquals("ana", result.user().username());
    verify(jdbc).update(contains("INSERT INTO app_users"), any(), eq("ana"), eq("hash"));
    verify(jdbc, never()).update(contains("moderation_staff"), any(Object[].class));
    verify(jdbc, never()).update(contains("moderation_staff"), anyString());
  }
}
