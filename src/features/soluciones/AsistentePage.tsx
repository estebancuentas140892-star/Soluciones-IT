import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { db } from '../../lib/db'
import { normalizarProcedimiento, procedimientoEjecutable } from '../../lib/procedimiento'
import { registrarVisita } from '../../lib/recientes'
import { Chasis } from '../../app/Chasis'
import { AsistenteVista } from './AsistenteVista'
import { ProveedorEjecucion } from './ProveedorEjecucion'

// Pantalla del modo ejecucion (asistente): nivel 3 del chasis (tarea
// 185), una tarea con salida. Es de los pocos sitios donde la barra de
// pestañas cede, para que el tecnico vea solo lo que necesita en el
// momento exacto; a cambio, la BarraTarea dice que esta ejecutando y
// deja salir (R19). Cabecera COMPACTA desde la tarea 218 (G-09, G-10):
// una sola linea de 44 px con el titulo y la X, sin rotulo ni ruta de
// vuelta ("vuelves aqui al terminar" ya no se repite: el tecnico acaba
// de decidir entrar hace cuatro segundos). Salir no pierde avance: el
// progreso vive en la base local, no en el estado de esta pantalla.
export function AsistentePage() {
  const { categoriaId = '', articuloId = '' } = useParams()

  const articulo = useLiveQuery(() => db.articulos.get(articuloId), [articuloId])
  const procedimiento = useMemo(() => normalizarProcedimiento(articulo?.procedimiento), [articulo])

  // USAR UNA GUÍA LA SUBE A RECIENTES, entre por donde entre (encargo del
  // 2026-09-16, sección 12). Hasta ahora solo lo anotaba su ficha
  // (`ArticuloPage`), y "Empezar" desde el buscador se la salta: la guía
  // que de verdad se estaba usando no aparecía en Inicio. Es la misma
  // anotación que la ficha, por clave (`articulo:<id>`): pasar por las dos
  // pantallas actualiza la fecha del mismo reciente, no crea otro.
  const idVisitado = articulo && !articulo.eliminadoEn ? articulo.id : null
  useEffect(() => {
    if (idVisitado) void registrarVisita('articulo', idVisitado)
  }, [idVisitado])

  if (articulo === null) return <Navigate to="/soluciones" replace />
  if (!articulo) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }
  // Un articulo sin pasos (sin procedimiento, o con metadata pero sin
  // pasos: K1) no tiene modo ejecucion que ofrecer.
  if (!procedimientoEjecutable(procedimiento)) {
    return <Navigate to={`/soluciones/${categoriaId}/${articuloId}`} replace />
  }

  return (
    <Chasis
      modo="tarea"
      compacta
      // BUSCAR SIN ABANDONAR EL PROCEDIMIENTO (tarea 241, secciones 8 a
      // 10). La navegación principal sigue fuera: lo que se añade es una
      // lupa que abre el buscador global COMO CAPA. Consultar un
      // comando, una herramienta o copiar una credencial de la bóveda
      // (incluso desbloqueándola ahí mismo) deja la ejecución intacta
      // debajo: mismo paso, mismo progreso, mismo cronómetro.
      conBusqueda
      rotulo="Ejecutando"
      titulo={articulo.titulo}
      salidaEtiqueta="Salir del modo ejecución"
    >
      {/* Sin relleno inferior propio: la acción dominante fija de
          `AsistenteVista` (M-011) es el último elemento del flujo y ya
          reserva su alto y el área segura del teléfono. */}
      <main className="flex flex-1 flex-col px-4 pt-4">
        {/* Sin onCompletado: al nivel 0 no hay a quien avisar,
            AsistenteVista ya muestra su propio resumen de "completado" y
            el tecnico decide cuando salir con el boton de arriba. */}
        {/* La ejecucion en curso: su fila de progreso es la raiz donde
            se guarda tambien el avance de sus guias vinculadas (tarea 2
            del encargo). */}
        <ProveedorEjecucion raizId={articuloId}>
          <AsistenteVista articuloId={articuloId} procedimiento={procedimiento} nivel={0} />
        </ProveedorEjecucion>
      </main>
    </Chasis>
  )
}
