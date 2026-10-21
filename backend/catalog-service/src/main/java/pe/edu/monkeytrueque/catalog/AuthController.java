package pe.edu.monkeytrueque.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
class AuthController {
  private final JdbcTemplate jdbc;
  private final PasswordEncoder passwords;
  private final JwtTokenService tokens;
  private final ListingRepository listings;
  private final CloudinaryImageStorage imageStorage;

  AuthController(JdbcTemplate jdbc, PasswordEncoder passwords, JwtTokenService tokens, ListingRepository listings, CloudinaryImageStorage imageStorage) {
    this.jdbc = jdbc;
    this.passwords = passwords;
    this.tokens = tokens;
    this.listings = listings;
    this.imageStorage = imageStorage;
  }

  /** Registrarse siempre crea una cuenta normal: los roles de equipo solo los asigna un administrador. */
  @PostMapping("/register")
  @Transactional
  AuthResponse register(@Valid @RequestBody RegisterRequest request, HttpServletResponse http) {
    String username = request.username().trim().toLowerCase(Locale.ROOT);
    if (exists(username)) throw new ResponseStatusException(HttpStatus.CONFLICT, "Ese nombre de usuario ya esta ocupado.");
    String userId = UUID.randomUUID().toString();
    jdbc.update("INSERT INTO app_users (user_id, username, password_hash) VALUES (?, ?, ?)", userId, username, passwords.encode(request.password()));
    jdbc.update("INSERT INTO user_profiles (user_id, display_name, member_since) VALUES (?, ?, CURRENT_TIMESTAMP(6))", userId, request.name().trim());
    return response(userId, http);
  }

  @PostMapping("/login")
  AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletResponse http) {
    String username = request.username().trim().toLowerCase(Locale.ROOT);
    List<String> ids = jdbc.query("SELECT user_id FROM app_users WHERE username = ? AND deactivated = FALSE", (rs, row) -> rs.getString(1), username);
    if (ids.isEmpty() || !passwords.matches(request.password(), passwordHash(ids.getFirst()))) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuario o contrasena incorrectos.");
    }
    return response(ids.getFirst(), http);
  }

  /** Cierra la sesión borrando la cookie; el navegador ya no la enviará. */
  @PostMapping("/logout")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void logout(HttpServletResponse http) { tokens.endSession(http); }

  @GetMapping("/me")
  AuthResponse me(@AuthenticationPrincipal Jwt jwt) { return new AuthResponse(user(jwt.getSubject()), jwt.getExpiresAt()); }

  @PutMapping("/profile")
  @Transactional
  AuthenticatedUser updateProfile(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileRequest request) {
    String imageUrl = null;
    if (request.imageData() != null && !request.imageData().isBlank()) imageUrl = imageStorage.storeProfileDataUrl(request.imageData(), jwt.getSubject()).url();
    if (imageUrl == null) jdbc.update("UPDATE user_profiles SET display_name = ? WHERE user_id = ?", request.name().trim(), jwt.getSubject());
    else jdbc.update("UPDATE user_profiles SET display_name = ?, image_url = ? WHERE user_id = ?", request.name().trim(), imageUrl, jwt.getSubject());
    var profile = jdbc.queryForObject("SELECT image_url FROM user_profiles WHERE user_id = ?", String.class, jwt.getSubject());
    listings.updateOwnerProfile(jwt.getSubject(), request.name().trim(), profile);
    return user(jwt.getSubject());
  }

  private boolean exists(String username) {
    Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM app_users WHERE username = ?", Integer.class, username);
    return count != null && count > 0;
  }

  private String passwordHash(String userId) {
    return jdbc.queryForObject("SELECT password_hash FROM app_users WHERE user_id = ?", String.class, userId);
  }

  private AuthResponse response(String userId, HttpServletResponse http) {
    AuthenticatedUser user = user(userId);
    // El token va en una cookie HttpOnly; la respuesta solo informa cuándo vence la sesión.
    return new AuthResponse(user, tokens.startSession(http, user.id(), user.username(), user.name()));
  }

  private AuthenticatedUser user(String userId) {
    return jdbc.queryForObject("SELECT p.user_id, p.display_name, u.username, p.image_url FROM app_users u "
        + "JOIN user_profiles p ON p.user_id = u.user_id WHERE u.user_id = ? AND u.deactivated = FALSE",
        (rs, row) -> new AuthenticatedUser(rs.getString("user_id"), rs.getString("display_name"), rs.getString("username"), rs.getString("image_url")), userId);
  }

  record RegisterRequest(@NotBlank(message = "El nombre es obligatorio") @Size(max = 120, message = "El nombre no puede superar 120 caracteres") String name,
      @NotBlank(message = "El nombre de usuario es obligatorio") @Pattern(regexp = "[A-Za-z0-9._-]{3,32}", message = "El nombre de usuario debe tener de 3 a 32 letras, números, puntos, guiones o guion bajo") String username,
      @NotBlank(message = "La contraseña es obligatoria") @Size(min = 8, max = 100, message = "La contraseña debe tener entre 8 y 100 caracteres") String password) {}
  record LoginRequest(@NotBlank(message = "El nombre de usuario es obligatorio") @Pattern(regexp = "[A-Za-z0-9._-]{3,32}", message = "El nombre de usuario debe tener de 3 a 32 letras, números, puntos, guiones o guion bajo") String username,
      @NotBlank(message = "La contraseña es obligatoria") @Size(max = 100, message = "La contraseña no puede superar 100 caracteres") String password) {}
  record ProfileRequest(@NotBlank(message = "El nombre es obligatorio") @Size(max = 120, message = "El nombre no puede superar 120 caracteres") String name, @Size(max = 14000000, message = "La imagen es demasiado grande") String imageData) {}
  record AuthenticatedUser(String id, String name, String username, String imageUrl) {}
  record AuthResponse(AuthenticatedUser user, Instant expiresAt) {}
}
