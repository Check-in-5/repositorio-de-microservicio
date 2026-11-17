import { createPool as crear_pool } from 'mysql2/promise';

export async function crear_repositorio_mysql(configuracion = {}) {
  const base_dato = crear_pool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'checkin_user',
    password: process.env.DB_PASSWORD ?? 'checkin_password',
    database: process.env.DB_NAME ?? 'checkin_db',
    waitForConnections: true,
    connectionLimit: 10,
    ...configuracion,
  });
  
  try {
    await base_dato.query('SELECT 1 FROM ticket LIMIT 1');
    return {
      async insertar(entrada) {
        try {
          await base_dato.execute(
            'INSERT INTO ticket (id_entrada, id_evento, id_usuario, nombre_usuario, qr_data) VALUES (?, ?, ?, ?, ?)',
            [entrada.id_entrada, entrada.id_evento, entrada.id_usuario, entrada.nombre_usuario, JSON.stringify(entrada.qr_data)],
          );
          return true;
        } catch (error) {
          if (error.code === 'ER_DUP_ENTRY') return false;
          throw error;
        }
      },
      async obtener_asistentes(id_evento) {
        const [asistentes] = await base_dato.execute(
          'SELECT id_usuario, id_entrada FROM registro_asistencia WHERE id_evento = ?',
          [id_evento]
        );
        return asistentes;
      },
      async buscar_por_id(id) {
        const [fila_conjunto] = await base_dato.execute(
          'SELECT id_entrada, id_evento, id_usuario, nombre_usuario FROM ticket WHERE id_entrada = ?', [id],
        );
        return fila_conjunto[0] ? { ...fila_conjunto[0] } : null;
      },
      
      async registrar_ingreso(id_entrada, id_evento, id_usuario) {
        const conexion = await base_dato.getConnection();
        try {
          await conexion.beginTransaction();
          // Serializa los escaneos del mismo ticket sin alterar ni borrar datos existentes.
          const [tickets] = await conexion.execute('SELECT id_entrada FROM ticket WHERE id_entrada = ? FOR UPDATE', [id_entrada]);
          if (!tickets.length) throw new Error('Ticket inexistente');
          const [previos] = await conexion.execute('SELECT id_asistencia FROM registro_asistencia WHERE id_entrada = ? FOR UPDATE', [id_entrada]);
          if (previos.length) { await conexion.rollback(); return false; }
          await conexion.execute('INSERT INTO registro_asistencia (id_entrada, id_evento, id_usuario) VALUES (?, ?, ?)', [id_entrada, id_evento, id_usuario]);
          await conexion.commit();
          return true;
        } catch (error) { await conexion.rollback(); throw error; }
        finally { conexion.release(); }
      },
      
      async actualizar_usuario(id, usuario) {
        await base_dato.execute("UPDATE ticket SET id_usuario = ? WHERE id_entrada = ? AND id_usuario = ''", [usuario, id]);
      },
      async verificar_asistencia(evento, usuario) {
        const [filas] = await base_dato.execute('SELECT 1 FROM registro_asistencia WHERE id_evento = ? AND id_usuario = ? LIMIT 1', [evento, usuario]);
        return filas.length > 0;
      },
      async cerrar() { await base_dato.end(); },
    };
  } catch (error) {
    await base_dato.end();
    throw error;
  }
}