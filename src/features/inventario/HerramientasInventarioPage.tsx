import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Chasis } from '../../app/Chasis'
import { MapPin, Monitor, QrCode, UploadSimple, User, UsersThree } from '../../components/iconos'
import { db } from '../../lib/db'
import { conOrigen } from '../../lib/origenNavegacion'
import { cuantosEstadosPorUnificar } from '../dispositivos/estadosEscritos'
import { FilaMas, TituloGrupo } from '../mas/FilasMas'
import { equiposPorValidar } from '../personas/cicloPersona'
import { candidatosPersona } from '../personas/migracion'
import { textosSinUbicacion } from '../ubicaciones/migracion'

// HERRAMIENTAS DE INVENTARIO (tarea 268, secciones 18 y 19 del encargo
// del 2026-09-23). Una sola puerta, desde Más > Herramientas, para lo que
// se hace de vez en cuando con el inventario:
//
//   - Cargar y etiquetar: Importar equipos y Etiquetas QR, que eran dos
//     filas de primer nivel en Más. Sus pantallas no cambian; Etiquetas
//     sigue siendo el primer paso de "pegar el QR, escanearlo y abrir la
//     ficha".
//   - Por ordenar, SOLO si hay algo: las tareas asistidas que convierten
//     texto suelto en datos (ubicaciones escritas como texto, estados
//     escritos a mano, responsables anotados en campos adicionales) y lo
//     que queda por validar. Cada fila dice cuántos equipos son. No es la
//     Agenda (sección 15 del encargo): la calidad del inventario no
//     compite con lo que vence hoy.
//
// Cada puerta lleva el origen de esta pantalla, así que su regreso vuelve
// aquí (M-R2) y no a Equipos, Ubicaciones o Personas.
export function HerramientasInventarioPage() {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])

  const pendientes = useMemo(() => {
    const ubicaciones = textosSinUbicacion(dispositivos)
    return {
      ubicacionesEquipos: ubicaciones.reduce((suma, t) => suma + t.cantidad, 0),
      ubicacionesLugares: ubicaciones.length,
      estados: cuantosEstadosPorUnificar(dispositivos),
      responsablesEnDetalles: candidatosPersona(dispositivos).length,
      porValidar: equiposPorValidar(dispositivos).length,
    }
  }, [dispositivos])
  const hayPendientes =
    pendientes.ubicacionesEquipos + pendientes.estados + pendientes.responsablesEnDetalles + pendientes.porValidar > 0
  const origenAqui = conOrigen('/inventario', 'Herramientas de inventario')

  return (
    // Nivel 2 del chasis (tarea 185): documento, con regreso a Más.
    <Chasis
      modo="documento"
      barra={
        <div className="px-4 pb-3 pt-0.5">
          <h1 className="m-0 text-[22px] font-medium leading-[1.25]">Herramientas de inventario</h1>
          <p className="mt-[3px] text-[12.5px] text-noct-neutral-500">Cargar, etiquetar y ordenar los datos de los equipos</p>
        </div>
      }
    >
      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-16 pt-4">
        <section>
          <TituloGrupo>Cargar y etiquetar</TituloGrupo>
          <div className="flex flex-col divide-y divide-noct-divider">
            <FilaMas
              to="/dispositivos/importar"
              Icono={UploadSimple}
              titulo="Importar equipos"
              subtitulo="Carga masiva desde Excel o CSV"
              nota="Mejor desde el ordenador"
              estado={origenAqui}
            />
            <FilaMas
              to="/dispositivos/etiquetas"
              Icono={QrCode}
              titulo="Etiquetas QR"
              subtitulo="Imprimir, pegar en el equipo y escanear para abrir su ficha"
              nota="Mejor desde el ordenador"
              estado={origenAqui}
            />
          </div>
        </section>

        {hayPendientes && (
          <section>
            <TituloGrupo>Por ordenar</TituloGrupo>
            <div className="flex flex-col divide-y divide-noct-divider">
              {pendientes.ubicacionesEquipos > 0 && (
                <FilaMas
                  to="/ubicaciones/migrar"
                  Icono={MapPin}
                  titulo="Ubicaciones escritas como texto"
                  subtitulo={`${pendientes.ubicacionesLugares} ${
                    pendientes.ubicacionesLugares === 1 ? 'lugar' : 'lugares'
                  } por convertir en fichas`}
                  conteo={pendientes.ubicacionesEquipos}
                  estado={origenAqui}
                />
              )}
              {pendientes.estados > 0 && (
                <FilaMas
                  to="/inventario/estados"
                  Icono={Monitor}
                  titulo="Estados escritos a mano"
                  subtitulo="Llevarlos a la lista: Operativo, Disponible, En mantenimiento..."
                  conteo={pendientes.estados}
                />
              )}
              {pendientes.responsablesEnDetalles > 0 && (
                <FilaMas
                  to="/personas/migrar"
                  Icono={UsersThree}
                  titulo="Responsables en campos adicionales"
                  subtitulo="Anotados en «Usuario asignado» u otra propiedad"
                  conteo={pendientes.responsablesEnDetalles}
                  estado={origenAqui}
                />
              )}
              {pendientes.porValidar > 0 && (
                <FilaMas
                  to="/personas?porValidar=1"
                  Icono={User}
                  titulo="Responsables por validar"
                  subtitulo="Un área, un estado o dos nombres donde va una persona"
                  conteo={pendientes.porValidar}
                  estado={origenAqui}
                />
              )}
            </div>
          </section>
        )}
      </main>
    </Chasis>
  )
}
