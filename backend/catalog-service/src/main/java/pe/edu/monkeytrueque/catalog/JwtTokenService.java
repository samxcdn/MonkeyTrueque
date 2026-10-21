package pe.edu.monkeytrueque.catalog;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;

/**
 * Emite el JWT de la sesión y lo entrega en una cookie HttpOnly que vence junto con el token.
 * La duración se configura con APP_JWT_EXPIRATION_MINUTES (60 por defecto).
 */
@Service
class JwtTokenService {
  private final JwtEncoder encoder;
  private final Duration lifetime;
  private final boolean secureCookie;

  JwtTokenService(@Value("${app.jwt-secret}") String encodedSecret,
      @Value("${app.jwt-expiration-minutes:60}") long expirationMinutes,
      @Value("${app.session-cookie-secure:false}") boolean secureCookie) {
    byte[] secret = Base64.getDecoder().decode(encodedSecret);
    if (secret.length < 32) throw new IllegalStateException("APP_JWT_SECRET must decode to at least 32 bytes");
    if (expirationMinutes < 1) throw new IllegalStateException("APP_JWT_EXPIRATION_MINUTES debe ser al menos 1");
    SecretKey key = new SecretKeySpec(secret, "HmacSHA256");
    this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
    this.lifetime = Duration.ofMinutes(expirationMinutes);
    this.secureCookie = secureCookie;
  }

  /** Firma el token, lo guarda en la cookie de la respuesta y devuelve cuándo vence. */
  Instant startSession(HttpServletResponse response, String userId, String username, String name) {
    Instant now = Instant.now();
    Instant expiresAt = now.plus(lifetime);
    JwtClaimsSet claims = JwtClaimsSet.builder().issuer("monkeytrueque")
        .issuedAt(now).expiresAt(expiresAt)
        .subject(userId).claim("username", username).claim("name", name).build();
    String token = encoder.encode(JwtEncoderParameters.from(
        org.springframework.security.oauth2.jwt.JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    response.addHeader(HttpHeaders.SET_COOKIE, cookie(token, lifetime).toString());
    return expiresAt;
  }

  /** Borra la cookie de la sesión (cerrar sesión). */
  void endSession(HttpServletResponse response) {
    response.addHeader(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString());
  }

  private ResponseCookie cookie(String value, Duration maxAge) {
    // HttpOnly: JavaScript no puede leer el token. SameSite=Strict: no viaja en peticiones desde otros sitios.
    return ResponseCookie.from(SessionTokenResolver.COOKIE, value)
        .httpOnly(true).secure(secureCookie).sameSite("Strict").path("/").maxAge(maxAge).build();
  }
}
