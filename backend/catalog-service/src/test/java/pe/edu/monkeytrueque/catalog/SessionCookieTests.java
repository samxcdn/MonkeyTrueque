package pe.edu.monkeytrueque.catalog;

import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class SessionCookieTests {
  private static final String SECRET = "c2VjcmV0by1kZS1wcnVlYmEtcGFyYS1sYXMtY29va2llcy0zMmI=";

  @Test
  void theSessionTokenTravelsInAnHttpOnlyStrictCookieThatExpiresWithIt() {
    var tokens = new JwtTokenService(SECRET, 2, false);
    var response = new MockHttpServletResponse();

    Instant expiresAt = tokens.startSession(response, "user-1", "ana", "Ana");

    String cookie = response.getHeader(HttpHeaders.SET_COOKIE);
    assertTrue(cookie.startsWith(SessionTokenResolver.COOKIE + "="));
    assertTrue(cookie.contains("HttpOnly"));
    assertTrue(cookie.contains("SameSite=Strict"));
    assertTrue(cookie.contains("Max-Age=120"));
    assertFalse(cookie.contains("Secure"));
    long minutes = Duration.between(Instant.now(), expiresAt).toMinutes();
    assertTrue(minutes >= 1 && minutes <= 2);
  }

  @Test
  void signingOutClearsTheCookie() {
    var response = new MockHttpServletResponse();
    new JwtTokenService(SECRET, 60, true).endSession(response);

    String cookie = response.getHeader(HttpHeaders.SET_COOKIE);
    assertTrue(cookie.contains("Max-Age=0"));
    assertTrue(cookie.contains("Secure"));
  }

  @Test
  void theTokenIsReadFromTheCookieOrFromTheAuthorizationHeader() {
    var resolver = new SessionTokenResolver();
    var fromCookie = new MockHttpServletRequest("GET", "/api/auth/me");
    fromCookie.setCookies(new Cookie(SessionTokenResolver.COOKIE, "token-de-cookie"));
    assertEquals("token-de-cookie", resolver.resolve(fromCookie));

    var fromHeader = new MockHttpServletRequest("GET", "/api/auth/me");
    fromHeader.addHeader(HttpHeaders.AUTHORIZATION, "Bearer token-de-servicio");
    assertEquals("token-de-servicio", resolver.resolve(fromHeader));
  }

  @Test
  void changesMadeWithTheCookieOnlyAcceptRequestsFromTheWebsite() throws Exception {
    var filter = new TrustedOriginFilter(SecurityConfig.allowedOrigins("http://localhost:4200"));

    assertEquals(403, run(filter, "POST", "https://sitio-malicioso.example", true).getStatus());
    assertEquals(403, run(filter, "DELETE", null, true).getStatus());
    assertEquals(200, run(filter, "POST", "http://localhost:4200", true).getStatus());
    assertEquals(200, run(filter, "GET", "https://sitio-malicioso.example", true).getStatus());
    assertEquals(200, run(filter, "POST", "https://sitio-malicioso.example", false).getStatus());
  }

  private static MockHttpServletResponse run(TrustedOriginFilter filter, String method, String origin, boolean withCookie) throws Exception {
    var request = new MockHttpServletRequest(method, "/api/listings");
    if (origin != null) request.addHeader(HttpHeaders.ORIGIN, origin);
    if (withCookie) request.setCookies(new Cookie(SessionTokenResolver.COOKIE, "token"));
    var response = new MockHttpServletResponse();
    filter.doFilter(request, response, new MockFilterChain());
    return response;
  }

}
