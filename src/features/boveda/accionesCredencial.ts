import type { Credencial, TipoSecreto } from '../../lib/db'
import { copiarAlPortapapeles } from '../../lib/portapapeles'
import { registrarAccesoBoveda } from '../../lib/repositorio'
import { descifrarCredencial } from './sesionBoveda'

// COPIAR UNA CREDENCIAL, UNA SOLA VEZ EN TODO EL CODIGO (tarea 241).
//
// Descifrar, comprobar que hay algo que copiar, copiar y REGISTRAR EL
// ACCESO era una funcion privada dentro de `BovedaPage`. Desde que los
// resultados del buscador global ofrecen copiar sin abrir la ficha
// (seccion 4 del encargo), ese recorrido lo necesitan dos pantallas, y
// el encargo es tajante: "NO dupliques descifrado ni bypasses controles
// de Boveda", "copies una credencial sin registrar la auditoria actual".
//
// Asi que vive aqui, una vez. Las tres garantias viajan juntas y no se
// pueden separar por descuido:
//
//   1. el descifrado pasa por `descifrarCredencial`, que devuelve null
//      con la boveda bloqueada (no hay forma de leer nada sin la
//      contrasena maestra, esta funcion no la puede saltar);
//   2. lo que se copia no se muestra nunca en pantalla;
//   3. cada copia con exito deja su entrada en la auditoria
//      (`registrarAccesoBoveda`), con quien y cuando.

/**
 * Las credenciales guardadas antes de que existiera la columna `tipo`
 * llegan sin valor; se leen como 'cuenta', igual que hace el editor.
 */
export function tipoDe(credencial: { tipo?: TipoSecreto }): TipoSecreto {
  return credencial.tipo ?? 'cuenta'
}

/**
 * Rotulo de la accion de copia del menu de la lista. `null` = este tipo
 * no se copia desde una lista; su fila abre la ficha, que es donde el
 * archivo se descarga y se descifra y donde la nota se lee.
 */
export const ETIQUETA_COPIA: Record<TipoSecreto, string | null> = {
  cuenta: 'Copiar contraseña',
  red: 'Copiar clave o PIN',
  llave: 'Copiar token, licencia o clave',
  archivo: null,
  nota: null,
}

/** Motivo exacto cuando el descifrado sale bien pero no hay nada que copiar. */
export const SIN_VALOR: Record<TipoSecreto, string> = {
  cuenta: 'Sin contraseña guardada.',
  red: 'Sin clave o PIN guardado.',
  llave: 'Sin token, licencia o clave guardada.',
  archivo: 'Este archivo se abre desde su ficha.',
  nota: 'Esta nota se lee desde su ficha.',
}

/** Los dos campos de una credencial que se pueden copiar sin abrirla. */
export type CampoCopiable = 'usuario' | 'contrasena'

export interface AccionCopia {
  campo: CampoCopiable
  /** Rotulo corto, para una fila de resultados (seccion 13: sin saturar). */
  etiqueta: string
}

/**
 * Que ofrece copiar una credencial en una fila de resultados, segun lo
 * que de verdad guarda (seccion 4 del encargo):
 *
 *   - un acceso normal: usuario y contrasena;
 *   - una clave o PIN: la clave (no tiene usuario);
 *   - un token o licencia: el valor, sin mas nombre;
 *   - un archivo seguro o una nota: nada, se abren en su ficha.
 *
 * Nunca mas de dos acciones: la tercera salida es la fila misma, que
 * abre la ficha completa.
 */
export function accionesRapidasDeCredencial(credencial: { tipo?: TipoSecreto }): AccionCopia[] {
  switch (tipoDe(credencial)) {
    case 'cuenta':
      return [
        { campo: 'usuario', etiqueta: 'Copiar usuario' },
        { campo: 'contrasena', etiqueta: 'Copiar contraseña' },
      ]
    case 'red':
      return [{ campo: 'contrasena', etiqueta: 'Copiar clave' }]
    case 'llave':
      return [{ campo: 'contrasena', etiqueta: 'Copiar' }]
    default:
      return []
  }
}

export interface ResultadoCopia {
  ok: boolean
  /** Por que no se pudo, para decirlo donde el tecnico lo esta mirando. */
  mensaje?: string
  /** Se descifro bien pero el campo esta vacio (credencial vieja). */
  sinDato?: boolean
}

/**
 * Descifra, copia al portapapeles y registra el acceso en la auditoria.
 * Devuelve el resultado en vez de tocar estado: quien llama decide como
 * avisar (una hoja abierta, una fila de la lista, una fila del buscador).
 */
export async function copiarCampoCredencial(
  credencial: Pick<Credencial, 'id' | 'titulo' | 'datosCifrados'> & { tipo?: TipoSecreto },
  campo: CampoCopiable,
): Promise<ResultadoCopia> {
  const datos = await descifrarCredencial(credencial.datosCifrados)
  if (!datos) return { ok: false, mensaje: 'No se pudo descifrar con la contraseña maestra actual.' }

  const valor = campo === 'usuario' ? datos.usuario : datos.contrasena
  if (!valor) {
    return {
      ok: false,
      sinDato: true,
      mensaje: campo === 'usuario' ? 'Sin usuario guardado.' : SIN_VALOR[tipoDe(credencial)],
    }
  }

  if (!(await copiarAlPortapapeles(valor))) {
    return { ok: false, mensaje: 'No se pudo copiar al portapapeles.' }
  }

  // SE ESPERA a que la auditoria quede escrita, no se lanza y se olvida
  // (`void`), que es como estaba dentro de BovedaPage. Es una escritura
  // local de milisegundos, y a cambio "copiar registra quien y cuando"
  // deja de depender de que la pantalla siga viva el tiempo suficiente:
  // en un telefono, tocar copiar y bloquear la pantalla en el mismo
  // gesto es normal. Tambien es lo que hace la garantia comprobable en
  // una prueba.
  await registrarAccesoBoveda({
    credencialId: credencial.id,
    credencialTitulo: credencial.titulo,
    accion: campo === 'usuario' ? 'copio_usuario' : 'copio_contrasena',
  })
  return { ok: true }
}
