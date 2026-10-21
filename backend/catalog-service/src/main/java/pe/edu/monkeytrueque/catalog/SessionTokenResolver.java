package pe.edu.monkeytrueque.catalog;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;

/**
 * Lee el JWT de la cookie HttpOnly de la sesión. La cabecera Authorization sigue
 * aceptándose para las llamadas entre servicios (exchange-service consulta el catálogo).
 */
class SessionTokenResolver implements BearerTokenResolver {
  static final String COOKIE = "mt_session";
  private final DefaultBearerTokenResolver header = new DefaultBearerTokenResolver();

  @Override
  public String resolve(HttpServletRequest request) {
    if (request.getHeader(HttpHeaders.AUTHORIZATION) != null) return header.resolve(request);
    return sessionCookie(request);
  }

  static String sessionCookie(HttpServletRequest request) {
    if (request.getCookies() == null) return null;
    for (Cookie cookie : request.getCookies()) {
      if (COOKIE.equals(cookie.getName()) && !cookie.getValue().isBlank()) return cookie.getValue();
    }
    return null;
  }
}
