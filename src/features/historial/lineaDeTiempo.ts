import type { AccesoBoveda, EjecucionDiagnostico, HistorialEntrada } from '../../lib/db'

// Linea de tiempo unificada (fase N4, sin esquema): fusiona
// cronologicamente lo que hoy vive en tablas separadas. Los cambios de
// campos y las intervenciones manuales ya conviven en `historial`
// (nada que fusionar ahi); lo que faltaba eran las ejecuciones de
// diagnostico que usaron un articulo y los accesos de auditoria de una
// credencial, cada uno en su propia tabla inmutable. Logica pura para
// poder probarla sin navegador; Historial.tsx solo la usa para
// combinar y renderizar.
export type EventoLinea =
  | { tipo: 'historial'; fechaHora: string; entrada: HistorialEntrada }
  | { tipo: 'ejecucion_diagnostico'; fechaHora: string; ejecucion: EjecucionDiagnostico }
  | { tipo: 'acceso_boveda'; fechaHora: string; acceso: AccesoBoveda }

export function combinarEventos(
  historial: HistorialEntrada[],
  ejecuciones: EjecucionDiagnostico[] = [],
  accesos: AccesoBoveda[] = [],
): EventoLinea[] {
  const eventos: EventoLinea[] = [
    ...historial.map((entrada): EventoLinea => ({ tipo: 'historial', fechaHora: entrada.fechaHora, entrada })),
    ...ejecuciones.map(
      (ejecucion): EventoLinea => ({ tipo: 'ejecucion_diagnostico', fechaHora: ejecucion.fechaHora, ejecucion }),
    ),
    ...accesos.map((acceso): EventoLinea => ({ tipo: 'acceso_boveda', fechaHora: acceso.fechaHora, acceso })),
  ]
  return eventos.sort((a, b) => (a.fechaHora < b.fechaHora ? 1 : -1))
}

export const ETIQUETA_ACCION_BOVEDA: Record<AccesoBoveda['accion'], string> = {
  consulto: 'Consultó la ficha',
  mostro: 'Mostró la contraseña',
  copio_usuario: 'Copió el usuario',
  copio_contrasena: 'Copió la contraseña',
  modifico: 'Modificó el secreto',
  elimino: 'Eliminó el secreto',
}

export function etiquetaResuelto(resuelto: EjecucionDiagnostico['resuelto']): string {
  switch (resuelto) {
    case 'si':
      return 'Resuelto'
    case 'no':
      return 'No resuelto'
    case 'abandonado':
      return 'Abandonado'
  }
}

// "45 s", "3 min", "3 min 20 s". Las ejecuciones de diagnostico
// guardan la duracion en segundos (duracionSegundos en progresoDiagnostico.ts).
export function formatearDuracion(segundos: number): string {
  if (segundos < 60) return `${segundos} s`
  const minutos = Math.floor(segundos / 60)
  const resto = segundos % 60
  return resto === 0 ? `${minutos} min` : `${minutos} min ${resto} s`
}
