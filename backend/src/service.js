import { error_api } from './errors.js';
import { consultar_entrada, consultar_evento } from './integrations.js';
import { publicar_evento } from './rabbitmq.js';

function validar_cuerpo(cuerpo, campo) {
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo) || Object.keys(cuerpo).some(clave => !Object.hasOwn(campo, clave))) {
    throw new error_api(400, 'INVALID_REQUEST', 'El cuerpo debe contener únicamente los campos especificados.');
  }
  for (const [clave, maximo] of Object.entries(campo)) {
    if (typeof cuerpo[clave] !== 'string' || !cuerpo[clave].trim() || cuerpo[clave].length > maximo || cuerpo[clave] !== cuerpo[clave].trim()) {
      throw new error_api(400, 'INVALID_REQUEST', clave + ' debe ser un texto de 1 a ' + maximo + ' caracteres, sin espacios al inicio o al final.');
    }
  }
}

export function crear_servicio(repositorio) {
  return {
    async registrar(cuerpo) {
      const { qr_data, id_usuario, ...datos } = cuerpo && typeof cuerpo === 'object' && !Array.isArray(cuerpo) ? cuerpo : {};
      validar_cuerpo(datos, { id_entrada: 128, id_evento: 128, nombre_usuario: 200 });
      if (id_usuario !== undefined) validar_cuerpo({ id_usuario }, { id_usuario: 255 });
      if (qr_data && typeof qr_data === 'object' && !Array.isArray(qr_data)) {
        validar_cuerpo(qr_data, { id_entrada: 128, id_evento: 128 });
        if (qr_data.id_entrada !== datos.id_entrada || qr_data.id_evento !== datos.id_evento) {
          throw new error_api(400, 'QR_MISMATCH', 'El QR no coincide con el ticket.');
        }
      } else {
        // Compatibilidad con los productores anteriores; v2 permite omitir usuario solo con QR estructurado.
        if (!id_usuario) throw new error_api(400, 'INVALID_REQUEST', 'Se requiere qr_data estructurado o id_usuario.');
        if (qr_data !== undefined && qr_data !== datos.id_entrada) throw new error_api(400, 'QR_MISMATCH', 'El QR no coincide con el ticket.');
      }

      const insertado = await repositorio.insertar({ 
        id_entrada: cuerpo.id_entrada, 
        id_evento: cuerpo.id_evento, 
        id_usuario: cuerpo.id_usuario || '',
        nombre_usuario: cuerpo.nombre_usuario,
        qr_data: cuerpo.qr_data || cuerpo.id_entrada 
      });
      
      if (!insertado) throw new error_api(409, 'TICKET_ALREADY_EXISTS', 'El ticket ya se encuentra registrado en Check-in.');
    },
    
    async validar(cuerpo, { cookie } = {}) {
      validar_cuerpo(cuerpo, { id_entrada: 128, id_evento: 128 });
      
      let entrada = await repositorio.buscar_por_id(cuerpo.id_entrada);
      if (entrada && entrada.id_evento !== cuerpo.id_evento) return { valido: false, motivo: 'EVENT_MISMATCH' };
      if (!entrada || !entrada.id_usuario) {
        const remota = await consultar_entrada(cuerpo.id_entrada);
        if (!remota && !entrada) return { valido: false, motivo: 'TICKET_NOT_FOUND' };
        if (remota) {
          if (remota.id_evento !== cuerpo.id_evento || (entrada && remota.id_evento !== entrada.id_evento)) return { valido: false, motivo: 'EVENT_MISMATCH' };
          if (!entrada) {
            await repositorio.insertar({ ...remota, qr_data: { id_entrada: remota.id_entrada, id_evento: remota.id_evento } });
          } else {
            await repositorio.actualizar_usuario(entrada.id_entrada, remota.id_usuario);
          }
          entrada = await repositorio.buscar_por_id(cuerpo.id_entrada);
        }
      }
      if (entrada.id_evento !== cuerpo.id_evento) return { valido: false, motivo: 'EVENT_MISMATCH' };
      if (!entrada.id_usuario) throw new error_api(503, 'TICKET_IDENTITY_UNAVAILABLE', 'Entradas debe proporcionar el identificador real del comprador.');
      const evento = await consultar_evento(cuerpo.id_evento, cookie);
      if (evento?.estado_gestion === 'CANCELADO') return { valido: false, motivo: 'EVENTO_CANCELADO' };
      if (evento?.estado_gestion === 'FINALIZADO') return { valido: false, motivo: 'EVENTO_FINALIZADO' };
      if (evento && evento.estado_gestion !== 'PUBLICADO') return { valido: false, motivo: 'EVENTO_NO_PUBLICADO' };

      const ingreso_exitoso = await repositorio.registrar_ingreso(
        entrada.id_entrada, 
        entrada.id_evento, 
        entrada.id_usuario
      );

      if (!ingreso_exitoso) {
        return { valido: false, motivo: 'TICKET_ALREADY_USED' };
      }

      const { id_usuario, ...ticket_para_operador } = entrada;

      return { valido: true, motivo: 'TICKET_FOUND', ticket: ticket_para_operador, ...(evento ? { evento } : {}) };
    },
    async consultar_asistencia(cuerpo, query = {}) {
      const eventoId = cuerpo?.eventoId ?? query.eventoId;
      const usuarioId = cuerpo?.usuarioId ?? query.usuarioId;
      validar_cuerpo({ eventoId, usuarioId }, { eventoId: 128, usuarioId: 255 });
      const asistio = await repositorio.verificar_asistencia(eventoId, usuarioId);
      // Se conserva el contrato de la rama reseñas: cadenas, no booleanos.
      return { asistio: asistio ? 'true' : 'false' };
    },
    async enviar_lote_resenas(id_evento) {
      if (typeof id_evento !== 'string' || !id_evento.trim()) {
        throw new error_api(400, 'INVALID_REQUEST', 'El id_evento es inválido.');
      }
      
      const asistentes = await repositorio.obtener_asistentes(id_evento);
      
      if (asistentes.length === 0) return 0;
      
      const payload = {
        id_evento: id_evento,
        total_asistentes: asistentes.length,
        asistentes: asistentes,
        fecha_emision: new Date().toISOString()
      };
      
      await publicar_evento('checkin.asistencia_final', payload);
      
      return asistentes.length;
    },
  };
}