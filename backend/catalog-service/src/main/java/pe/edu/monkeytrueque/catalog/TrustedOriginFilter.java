package pe.edu.monkeytrueque.catalog;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpHeaders;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Protección CSRF para la sesión en cookie: el navegador adjunta la cookie automáticamente,
 * así que un cambio (POST, PUT, PATCH, DELETE) hecho con ella solo se acepta si el encabezado
 * Origin es la web de MonkeyTrueque. La cookie, además, es SameSite=Strict.
 */
class TrustedOriginFilter extends OncePerRequestFilter {
  private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");
  private final CorsConfiguration origins = new CorsConfiguration();

  TrustedOriginFilter(List<String> allowedOriginPatterns) {
    origins.setAllowedOriginPatterns(allowedOriginPatterns);
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    boolean usesSessionCookie = request.getHeader(HttpHeaders.AUTHORIZATION) == null && SessionTokenResolver.sessionCookie(request) != null;
    if (usesSessionCookie && !SAFE_METHODS.contains(request.getMethod())) {
      String origin = request.getHeader(HttpHeaders.ORIGIN);
      if (origin == null || origins.checkOrigin(origin) == null) {
        response.sendError(HttpServletResponse.SC_FORBIDDEN, "Origen no permitido");
        return;
      }
    }
    chain.doFilter(request, response);
  }
}
