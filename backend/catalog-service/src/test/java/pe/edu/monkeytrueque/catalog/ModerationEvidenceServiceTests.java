package pe.edu.monkeytrueque.catalog;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class ModerationEvidenceServiceTests {
  private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
  private final ModerationEvidenceService service = new ModerationEvidenceService(jdbc);

  @Test
  void savesOnlyAfterValidatingImageSignature() {
    byte[] pngSignature = {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10};
    var image = new ModerationEvidenceService.EvidenceImage("test.png", "data:image/png;base64," + Base64.getEncoder().encodeToString(pngSignature));

    service.save("report", "report-id", List.of(image));

    verify(jdbc).update(anyString(), any(Object[].class));
  }

  @Test
  void rejectsMimeTypeThatDoesNotMatchFileSignature() {
    byte[] jpegSignature = {(byte) 0xff, (byte) 0xd8, (byte) 0xff};
    var image = new ModerationEvidenceService.EvidenceImage("fake.png", "data:image/png;base64," + Base64.getEncoder().encodeToString(jpegSignature));

    assertThrows(ResponseStatusException.class, () -> service.save("report", "report-id", List.of(image)));
    verify(jdbc, never()).update(anyString(), any(Object[].class));
  }

  @Test
  void rejectsMoreThanThreeAttachments() {
    var image = new ModerationEvidenceService.EvidenceImage("test.png", "data:image/png;base64,iVBORw0KGgo=");

    assertThrows(ResponseStatusException.class, () -> service.save("appeal", "appeal-id", List.of(image, image, image, image)));
    verify(jdbc, never()).update(anyString(), any(Object[].class));
  }
}
