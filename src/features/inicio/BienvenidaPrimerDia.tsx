import { useSyncExternalStore } from 'react'
import {
  descargarTodoOffline,
  obtenerProgresoDescarga,
  suscribirProgresoDescarga,
} from '../../lib/adjuntosOffline'
import { obtenerEstadoInstalacion, suscribirEstadoInstalacion } from '../../lib/instalacionPwa'
import { BotonInstalarApp } from '../../components/BotonInstalarApp'
import { Check } from '../../components/iconos'
import { BTN_PRIMARIO } from '../../components/nocturne'
import { debeMostrarBienvenida, pasosBienvenida, type PasoBienvenida } from './bienvenida'

// Bienvenida del primer dia (tarea 184, mockup 3b del handoff): tres
// pasos que se apagan solos, en vez de un tour modal que hay que cerrar.
// Los dos que faltan traen su accion dentro, porque de ellos depende que
// la app sirva sin señal: instalarla y bajar los adjuntos.
//
// La regla de visibilidad vive aparte y probada en ./bienvenida.ts. Aqui
// solo queda leer el estado real del dispositivo (¿corre instalada?
// ¿hubo descarga?) y pintar.
export function BienvenidaPrimerDia({
  nombre,
  hayBloquesReales,
}: {
  nombre?: string | null
  // Inicio ya tiene recientes, pendientes o un procedimiento a medias.
  hayBloquesReales: boolean
}) {
  const instalacion = useSyncExternalStore(suscribirEstadoInstalacion, obtenerEstadoInstalacion)
  const descarga = useSyncExternalStore(suscribirProgresoDescarga, obtenerProgresoDescarga)

  const pasos = pasosBienvenida({
    instalada: instalacion.instalada,
    descargaHecha: descarga.ultimaDescarga !== null,
  })

  if (!debeMostrarBienvenida({ pasos, hayBloquesReales })) return null

  // Nombre de pila: "Bienvenido, Andrés Vélez" en una tarjeta de 448px
  // roba la linea entera y suena a formulario.
  const nombrePila = nombre?.trim().split(/\s+/)[0]

  return (
    <section className="rounded-lg border border-noct-accent/[.32] bg-noct-accent/[.07] p-4">
      <h2 className="text-base font-medium leading-[1.3]">
        {nombrePila ? `Bienvenido, ${nombrePila}` : 'Bienvenido'}
      </h2>
      <p className="mb-3.5 mt-1.5 text-[13.5px] leading-normal text-noct-neutral-200">
        Aquí vive lo que el equipo sabe hacer: procedimientos, equipos y credenciales. Tres cosas y
        ya estás listo.
      </p>

      <ol className="flex flex-col gap-0.5">
        {pasos.map((paso) => (
          <li key={paso.clave} className="flex min-h-12 items-center gap-3 py-[5px]">
            <MarcaPaso paso={paso} />
            <span
              className={`flex-1 text-sm leading-[1.4] ${paso.hecho ? 'text-noct-neutral-300' : ''}`}
            >
              {paso.titulo}
            </span>

            {paso.clave === 'instalar' && !paso.hecho && <BotonInstalarApp />}

            {paso.clave === 'offline' && !paso.hecho && (
              <button
                type="button"
                onClick={() => void descargarTodoOffline()}
                disabled={descarga.enCurso}
                className={`${BTN_PRIMARIO} min-h-11 shrink-0 px-3 disabled:opacity-50`}
              >
                {descarga.enCurso
                  ? `${descarga.completados + descarga.fallidos} de ${descarga.total}`
                  : 'Descargar'}
              </button>
            )}
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[12px] leading-normal text-noct-neutral-400">
        Cuando haya recientes, pendientes o un procedimiento a medias, esos bloques aparecen aquí y
        esta bienvenida se retira sola.
      </p>
    </section>
  )
}

// Marca del paso: un check verde cuando esta hecho, su numero cuando
// falta. El primero que falta va en el acento; los demas, en neutro
// (dos canales, forma y color, regla R16).
function MarcaPaso({ paso }: { paso: PasoBienvenida }) {
  if (paso.hecho) {
    return (
      <span
        className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-noct-exito/[.16] text-noct-exito"
        aria-label="Hecho"
      >
        <Check size={14} aria-hidden />
      </span>
    )
  }
  return (
    <span
      aria-hidden
      className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border text-[12px] font-medium ${
        paso.siguiente
          ? 'border-noct-accent text-noct-accent-300'
          : 'border-noct-neutral-600 text-noct-neutral-300'
      }`}
    >
      {paso.numero}
    </span>
  )
}
