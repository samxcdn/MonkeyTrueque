package pe.edu.monkeytrueque.exchange;

import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named = "RUN_RABBIT_INTEGRATION", matches = "true")
class RabbitBrokerIntegrationTests {
  @Test
  void springAmqpPublishesConfirmsAndReceivesAMessage() throws Exception {
    var factory = new CachingConnectionFactory("localhost");
    factory.setUsername("guest");
    factory.setPassword("guest");
    factory.setPublisherConfirmType(CachingConnectionFactory.ConfirmType.CORRELATED);
    factory.setPublisherReturns(true);
    var admin = new RabbitAdmin(factory);
    var rabbit = new RabbitTemplate(factory);
    rabbit.setMandatory(true);
    var topology = new ExchangeEvents();
    admin.declareExchange(topology.monkeyTruequeEvents());
    admin.declareExchange(topology.monkeyTruequeDeadLetters());
    admin.declareQueue(topology.completedExchanges());
    admin.declareQueue(topology.failedCompletedExchanges());
    admin.declareBinding(topology.completedExchangeBinding());
    admin.declareBinding(topology.failedCompletedExchangeBinding());
    var suffix = UUID.randomUUID().toString();
    var exchange = new DirectExchange("monkeytrueque.test." + suffix, false, true);
    var queue = new Queue("monkeytrueque.test." + suffix, false, true, true);
    try {
      admin.declareExchange(exchange);
      admin.declareQueue(queue);
      admin.declareBinding(BindingBuilder.bind(queue).to(exchange).with("test"));
      var confirmation = new CorrelationData();
      rabbit.convertAndSend(exchange.getName(), "test", "RabbitMQ funciona", confirmation);
      assertTrue(confirmation.getFuture().get(5, TimeUnit.SECONDS).ack());
      assertNull(confirmation.getReturned());
      assertEquals("RabbitMQ funciona", rabbit.receiveAndConvert(queue.getName(), 5000));
    } finally {
      admin.deleteQueue(queue.getName());
      admin.deleteExchange(exchange.getName());
      factory.destroy();
    }
  }
}
