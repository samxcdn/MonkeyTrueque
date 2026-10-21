package pe.edu.monkeytrueque.exchange;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class ExchangeEvents {
  static final String EXCHANGE = "monkeytrueque.events";
  static final String QUEUE = "monkeytrueque.exchange.completed";
  static final String ROUTING_KEY = "exchange.completed";
  static final String DEAD_LETTER_EXCHANGE = "monkeytrueque.dead-letters";
  static final String DEAD_LETTER_QUEUE = "monkeytrueque.exchange.completed.failed";
  static final String DEAD_LETTER_ROUTING_KEY = "exchange.completed.failed";

  @Bean DirectExchange monkeyTruequeEvents() { return new DirectExchange(EXCHANGE, true, false); }
  @Bean DirectExchange monkeyTruequeDeadLetters() { return new DirectExchange(DEAD_LETTER_EXCHANGE, true, false); }
  @Bean Queue completedExchanges() {
    return QueueBuilder.durable(QUEUE)
        .deadLetterExchange(DEAD_LETTER_EXCHANGE)
        .deadLetterRoutingKey(DEAD_LETTER_ROUTING_KEY)
        .build();
  }
  @Bean Queue failedCompletedExchanges() { return QueueBuilder.durable(DEAD_LETTER_QUEUE).build(); }
  @Bean Binding completedExchangeBinding() {
    return BindingBuilder.bind(completedExchanges()).to(monkeyTruequeEvents()).with(ROUTING_KEY);
  }
  @Bean Binding failedCompletedExchangeBinding() {
    return BindingBuilder.bind(failedCompletedExchanges()).to(monkeyTruequeDeadLetters()).with(DEAD_LETTER_ROUTING_KEY);
  }
}
