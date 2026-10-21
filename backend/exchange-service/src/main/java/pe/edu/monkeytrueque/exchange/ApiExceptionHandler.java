package pe.edu.monkeytrueque.exchange;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Devuelve los errores como Problem Details. Cuando falla una validación (@NotBlank, @Size...),
 * "detail" lleva el mensaje en español de la anotación y "errors" el mensaje de cada campo.
 */
@RestControllerAdvice
class ApiExceptionHandler extends ResponseEntityExceptionHandler {
  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException ex, HttpHeaders headers,
      HttpStatusCode status, WebRequest request) {
    return validationProblem(ex, ex.getBindingResult().getAllErrors(), headers, request);
  }

  @Override
  protected ResponseEntity<Object> handleHandlerMethodValidationException(HandlerMethodValidationException ex, HttpHeaders headers,
      HttpStatusCode status, WebRequest request) {
    return validationProblem(ex, ex.getAllErrors(), headers, request);
  }

  private ResponseEntity<Object> validationProblem(Exception ex, List<? extends MessageSourceResolvable> errors,
      HttpHeaders headers, WebRequest request) {
    Map<String, String> fields = new LinkedHashMap<>();
    for (MessageSourceResolvable error : errors) {
      String field = error instanceof FieldError fieldError ? fieldError.getField() : "solicitud";
      fields.putIfAbsent(field, error.getDefaultMessage());
    }
    String detail = fields.values().stream().findFirst().orElse("Revisa los datos enviados");
    ProblemDetail body = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, detail);
    body.setTitle("Datos no válidos");
    body.setProperty("errors", fields);
    return handleExceptionInternal(ex, body, headers, HttpStatus.BAD_REQUEST, request);
  }
}
