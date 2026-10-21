package pe.edu.monkeytrueque.catalog;

import java.util.List;
import java.util.Base64;
import jakarta.servlet.DispatcherType;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.preauth.AbstractPreAuthenticatedProcessingFilter;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
class SecurityConfig {
  @Bean
  SecurityFilterChain security(HttpSecurity http, UrlBasedCorsConfigurationSource corsConfigurationSource,
      @Value("${app.cors-origin}") String origin) throws Exception {
    return http.csrf(csrf -> csrf.disable())
        .cors(cors -> cors.configurationSource(corsConfigurationSource))
        // La sesión viaja en una cookie: solo se aceptan cambios enviados desde la web de MonkeyTrueque.
        .addFilterBefore(new TrustedOriginFilter(allowedOrigins(origin)), AbstractPreAuthenticatedProcessingFilter.class)
        .authorizeHttpRequests(auth -> auth
            .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
            .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/analytics/visits").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/register", "/api/auth/logout").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/listings/mine").authenticated()
            .requestMatchers(HttpMethod.GET, "/api/profiles/*").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/listings", "/api/listings/*", "/actuator/health").permitAll()
            .anyRequest().authenticated())
        .oauth2ResourceServer(oauth -> oauth.bearerTokenResolver(new SessionTokenResolver()).jwt(jwt -> {}))
        .build();
  }

  @Bean
  SecretKey jwtSecretKey(@Value("${app.jwt-secret}") String secret) {
    byte[] bytes = Base64.getDecoder().decode(secret);
    if (bytes.length < 32) throw new IllegalStateException("APP_JWT_SECRET must decode to at least 32 bytes");
    return new SecretKeySpec(bytes, "HmacSHA256");
  }

  @Bean
  JwtDecoder jwtDecoder(SecretKey jwtSecretKey) { return NimbusJwtDecoder.withSecretKey(jwtSecretKey).macAlgorithm(MacAlgorithm.HS256).build(); }

  @Bean
  PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }

  @Bean
  UrlBasedCorsConfigurationSource corsConfigurationSource(@Value("${app.cors-origin}") String origin) {
    var config = new CorsConfiguration();
    config.setAllowedOriginPatterns(allowedOrigins(origin));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    // Permite que el navegador envíe la cookie de sesión a la API.
    config.setAllowCredentials(true);
    var source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
  }

  static List<String> allowedOrigins(String origin) {
    return List.of(origin, "http://localhost:[*]", "http://127.0.0.1:[*]");
  }
}
