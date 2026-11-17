import amqp from 'amqplib';
import { error_api } from './errors.js';

export async function publicar_evento(routingKey, data) {
  if (!process.env.BROKER_URL) throw new error_api(503, 'BROKER_NOT_CONFIGURED', 'RabbitMQ no configurado.');
  let conexion;
  let canal;
  let temporizador;
  try {
    conexion = await amqp.connect(process.env.BROKER_URL, { timeout: 5000 });
    conexion.on('error', () => {});
    canal = await conexion.createConfirmChannel();
    canal.on('error', () => {});
    const exchange = process.env.EVENT_EXCHANGE || 'ticketu.events';
    await canal.assertExchange(exchange, 'topic', { durable: true });
    await Promise.race([
      new Promise((resolve, reject) => canal.publish(exchange, routingKey, Buffer.from(JSON.stringify(data)), { persistent: true, contentType: 'application/json' }, error => error ? reject(error) : resolve())),
      new Promise((_, reject) => { temporizador = setTimeout(() => reject(new Error('Confirmación agotada')), 5000); }),
    ]);
  } catch {
    throw new error_api(503, 'BROKER_UNAVAILABLE', 'No se pudo confirmar la publicación en RabbitMQ.');
  } finally {
    clearTimeout(temporizador);
    if (canal) await canal.close().catch(() => {});
    if (conexion) await conexion.close().catch(() => {});
  }
}
