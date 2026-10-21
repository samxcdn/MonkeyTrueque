package pe.edu.monkeytrueque.catalog;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class SecurityConfigTests {
  @Test
  void allowsAngularDevelopmentPortsWithoutOpeningExternalSites() {
    var configuration = new SecurityConfig().corsConfigurationSource("http://localhost:4200")
        .getCorsConfigurations().get("/**");

    assertEquals("http://localhost:60981", configuration.checkOrigin("http://localhost:60981"));
    assertEquals("http://127.0.0.1:63718", configuration.checkOrigin("http://127.0.0.1:63718"));
    assertNull(configuration.checkOrigin("https://example.com"));
  }
}
