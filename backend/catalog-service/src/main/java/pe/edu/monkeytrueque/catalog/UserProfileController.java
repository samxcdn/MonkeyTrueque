package pe.edu.monkeytrueque.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/profiles")
class UserProfileController {
  private final UserProfileRepository profiles;
  private final ListingRepository listings;

  UserProfileController(UserProfileRepository profiles, ListingRepository listings) {
    this.profiles = profiles;
    this.listings = listings;
  }

  @GetMapping("/{id}")
  ProfileView get(@PathVariable String id) {
    return profiles.findById(id).map(ProfileView::from)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Perfil no disponible"));
  }

  @PutMapping("/me")
  @ResponseStatus(HttpStatus.OK)
  @Transactional
  ProfileView sync(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProfileUpdate request) {
    var profile = profiles.findById(jwt.getSubject()).orElseGet(() -> {
      var created = new UserProfileEntity();
      created.userId = jwt.getSubject();
      created.memberSince = Instant.now();
      created.identityVerified = false;
      return created;
    });
    profile.displayName = request.displayName().trim();
    profile.imageUrl = request.imageUrl();
    if (request.description() != null) profile.description = request.description().trim();
    if (request.phone() != null) profile.phoneNumber = request.phone().trim();
    if (request.department() != null) profile.department = request.department().trim();
    if (request.countryCode() != null) profile.countryCode = request.countryCode().isBlank() ? null : request.countryCode().trim().toUpperCase();
    if (request.communityIds() != null) profile.communityIds = String.join(",", request.communityIds().stream().distinct().toList());
    if (request.districtId() != null) profile.districtId = request.districtId().isBlank() ? null : request.districtId();
    listings.updateOwnerProfile(profile.userId, profile.displayName, profile.imageUrl);
    return ProfileView.from(profiles.save(profile));
  }

  record ProfileUpdate(@NotBlank(message = "El nombre visible es obligatorio") @Size(max = 120, message = "El nombre visible no puede superar 120 caracteres") String displayName, @Size(max = 1000, message = "La URL de la imagen no puede superar 1.000 caracteres") String imageUrl, @Size(max = 500, message = "La descripción no puede superar 500 caracteres") String description, @Size(max = 30, message = "Puedes elegir hasta 30 comunidades") List<@NotBlank(message = "Cada comunidad debe tener un nombre") @Size(max = 80, message = "El nombre de una comunidad no puede superar 80 caracteres") @Pattern(regexp = "[a-z0-9-]+", message = "Cada comunidad solo puede tener letras minúsculas, números y guiones") String> communityIds, @Size(max = 80, message = "El distrito no puede superar 80 caracteres") @Pattern(regexp = "[a-z0-9-]*", message = "El distrito no es válido") String districtId, @Size(max = 40, message = "El teléfono no puede superar 40 caracteres") String phone, @Size(max = 100, message = "El departamento no puede superar 100 caracteres") String department, @Pattern(regexp = "|[A-Za-z]{2}", message = "El código de país debe tener 2 letras") String countryCode) {}
  record ProfileView(String userId, String displayName, String imageUrl, String description, List<String> communityIds, String districtId, Instant memberSince, boolean identityVerified, String countryCode) {
    static ProfileView from(UserProfileEntity profile) {
      var communityIds = profile.communityIds == null || profile.communityIds.isBlank() ? List.<String>of() : List.of(profile.communityIds.split(","));
      return new ProfileView(profile.userId, profile.displayName, profile.imageUrl, profile.description, communityIds, profile.districtId, profile.memberSince, profile.identityVerified, profile.countryCode);
    }
  }
}
