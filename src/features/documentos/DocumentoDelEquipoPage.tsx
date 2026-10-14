import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Chasis } from '../../app/Chasis'
import { DialogoEliminar } from '../../components/DialogoEliminar'
import { HojaInferior } from '../../components/HojaInferior'
import { ArrowSquareOut, CaretRight, DotsThreeOutline, LinkSimple, Monitor, PencilSimple, TrashSimple } from '../../components/iconos'
import { BTN_GHOST_PELIGRO, BTN_ICONO_SECUNDARIO, BTN_PRIMARIO_RELLENO } from '../../components/nocturne'
import { useUrlAdjunto } from '../../components/useUrlAdjunto'
import { ImagenAmpliable } from '../../components/VisorImagen'
import { db, type Adjunto, type Dispositivo } from '../../lib/db'
import { fechaConAnio } from '../../lib/mantenimientos'
import { conOrigen } from '../../lib/origenNavegacion'
import { EditarDocumento } from './EditarDocumento'
import { quitarAdjunto, vinculosDelDocumento } from './documentosEquipo'
import { VincularDocumento } from './VincularDocumento'

// UN ADJUNTO DE UN EQUIPO (tarea 322): un documento que puede estar en
// varios equipos (el acta con una página por equipo), visto desde la
// ficha de uno de ellos. Tres bloques que no se mezclan:
//   - "Del documento": de dónde viene y su fecha, iguales en todos sus
//     equipos; "Sin confirmar" cuando nadie los confirmó (no se deducen).
//   - "En este equipo": la página o nota de este vínculo.
//   - "También en": los otros equipos que lo tienen, con su nota; cada
//     uno abre el documento desde su ficha.
// La acción rellena es abrir el documento (regla 30). Editar y vincular
// van delineados; quitarlo de este equipo, en el menú: el archivo sigue
// mientras otro equipo lo tenga.

export function DocumentoDelEquipoPage() {
  const { dispositivoId = '', adjuntoId = '' } = useParams()
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [quitando, setQuitando] = useState(false)
  const [hoja, setHoja] = useState<'editar' | 'vincular' | null>(null)

  const adjunto = useLiveQuery(async () => (await db.adjuntos.get(adjuntoId)) ?? null, [adjuntoId])
  const equipo = useLiveQuery(async () => (await db.dispositivos.get(dispositivoId)) ?? null, [dispositivoId])
  const otros = useLiveQuery(
    async () => {
      if (!adjunto) return []
      const vinculos = (await vinculosDelDocumento(adjunto.referencia)).filter((v) => v.entidadId !== dispositivoId)
      const equipos = await db.dispositivos.bulkGet(vinculos.map((v) => v.entidadId))
      return vinculos
        .map((vinculo, i) => ({ vinculo, equipo: equipos[i] }))
        .filter((o): o is { vinculo: Adjunto; equipo: Dispositivo } => Boolean(o.equipo) && !o.equipo?.eliminadoEn)
    },
    [adjunto, dispositivoId],
  )
  const url = useUrlAdjunto(adjunto?.referencia ?? null)

  const deLaFicha = `/dispositivos/${dispositivoId}#adjuntos`
  if (adjunto === null || equipo === null || adjunto?.eliminadoEn || equipo?.eliminadoEn) {
    return <Navigate to={equipo && !equipo.eliminadoEn ? deLaFicha : '/dispositivos'} replace />
  }
  // Un enlace con el equipo equivocado no enseña el adjunto de otro.
  if (adjunto && (adjunto.entidadTipo !== 'dispositivo' || adjunto.entidadId !== dispositivoId)) {
    return <Navigate to={deLaFicha} replace />
  }
  if (!adjunto || !equipo || !otros) {
    return (
      <div className="nocturne min-h-svh bg-noct-bg font-inter text-noct-text">
        <p className="px-4 pt-6 text-sm text-noct-neutral-400">Cargando...</p>
      </div>
    )
  }

  async function quitar() {
    if (!adjunto) return
    await quitarAdjunto(adjunto)
    navigate(deLaFicha, { replace: true })
  }

  const esImagen = adjunto.tipo.startsWith('image/')
  const aqui = conOrigen(`/dispositivos/${dispositivoId}/adjuntos/${adjuntoId}`, adjunto.nombre)

  return (
    <Chasis
      modo="documento"
      volverA={deLaFicha}
      volverEtiqueta={equipo.nombre}
      titulo={adjunto.nombre}
      contexto={`Adjunto de ${equipo.nombre}`}
      acciones={
        // QUITAR, EN EL MENÚ (regla 30): lo destructivo no va junto a Editar.
        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label="Más acciones: quitar de este equipo"
          aria-expanded={menuAbierto}
          className={BTN_ICONO_SECUNDARIO}
        >
          <DotsThreeOutline size={17} aria-hidden />
        </button>
      }
      barra={
        menuAbierto && (
          <div className="flex flex-wrap gap-2 border-t border-noct-divider px-4 pb-3 pt-3">
            <button
              type="button"
              onClick={() => {
                setMenuAbierto(false)
                setQuitando(true)
              }}
              className={`${BTN_GHOST_PELIGRO} min-h-11`}
            >
              <TrashSimple size={14} aria-hidden />
              Quitar de este equipo
            </button>
          </div>
        )
      }
    >
      <main className="flex flex-1 flex-col gap-[22px] px-4 pb-4 pt-4 lg:px-10">
        <section className="flex flex-col gap-3">
          <h1 className="m-0 text-[22px] font-semibold leading-[1.2] [overflow-wrap:anywhere]">{adjunto.nombre}</h1>
          {esImagen && url && (
            <ImagenAmpliable
              url={url}
              alt={adjunto.nombre}
              pie={adjunto.nombre}
              etiqueta="Ampliar"
              claseBoton="rounded-[14px]"
              className="max-h-64 w-full rounded-[14px] object-cover"
            />
          )}
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className={`w-full ${BTN_PRIMARIO_RELLENO}`}>
              <ArrowSquareOut size={18} aria-hidden />
              Abrir
            </a>
          ) : (
            <p className="text-[13.5px] leading-[1.45] text-noct-neutral-400">
              El archivo todavía no está en este teléfono. Con conexión se abre desde aquí.
            </p>
          )}
        </section>

        <section aria-labelledby="doc-documento" className="flex flex-col">
          <h2 id="doc-documento" className="pb-0.5 text-[13.5px] font-semibold text-noct-neutral-400">
            Del documento
          </h2>
          <Dato etiqueta="Origen">{adjunto.origen || <SinConfirmar />}</Dato>
          <Dato etiqueta="Fecha">{adjunto.fechaDocumento ? fechaConAnio(adjunto.fechaDocumento) : <SinConfirmar />}</Dato>
        </section>

        <section aria-labelledby="doc-equipo" className="flex flex-col gap-1">
          <h2 id="doc-equipo" className="text-[13.5px] font-semibold text-noct-neutral-400">
            En este equipo
          </h2>
          <p
            className={`whitespace-pre-wrap text-[14.5px] leading-[1.5] [overflow-wrap:anywhere] ${adjunto.nota ? 'text-noct-neutral-200' : 'text-noct-neutral-400'}`}
          >
            {adjunto.nota || 'Sin página ni nota.'}
          </p>
        </section>

        <section aria-labelledby="doc-otros" className="flex flex-col gap-2">
          <h2 id="doc-otros" className="text-[13.5px] font-semibold text-noct-neutral-400">
            También en
          </h2>
          {otros.length > 0 ? (
            <ul className="flex flex-col">
              {otros.map(({ vinculo, equipo: otro }) => (
                <li key={vinculo.id}>
                  <Link
                    to={`/dispositivos/${otro.id}/adjuntos/${vinculo.id}`}
                    state={aqui}
                    className="flex min-h-[52px] items-center gap-3 border-b border-noct-divider py-1.5 text-noct-text hover:bg-noct-text/[.04]"
                  >
                    <Monitor size={18} className="shrink-0 text-noct-neutral-400" aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[15px] [overflow-wrap:anywhere]">{otro.nombre}</span>
                      {vinculo.nota && (
                        <span className="text-[12.5px] leading-snug text-noct-neutral-400 [overflow-wrap:anywhere]">{vinculo.nota}</span>
                      )}
                    </span>
                    <CaretRight size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] leading-[1.45] text-noct-neutral-400">Solo en este equipo.</p>
          )}
          <button type="button" onClick={() => setHoja('vincular')} className={ACCION_DELINEADA}>
            <LinkSimple size={16} aria-hidden />
            Vincular a otro equipo
          </button>
        </section>

        {/* EDITAR, ABAJO Y DELINEADO: no hace avanzar nada (igual que la
            ficha de una autorización). */}
        <div className="sticky bottom-[calc(65px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-auto border-t border-noct-divider bg-noct-bg/[.94] px-3 pb-2.5 pt-2.5 backdrop-blur-[12px] md:bottom-0 lg:-mx-10">
          <button
            type="button"
            onClick={() => setHoja('editar')}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[15px] border-[1.5px] border-noct-text/25 text-[15.5px] font-semibold text-noct-text hover:bg-noct-text/[.05]"
          >
            <PencilSimple size={17} aria-hidden />
            Editar
          </button>
        </div>
      </main>

      {/* Las hojas se montan solo abiertas: cada vez empiezan con los datos de ahora. */}
      <HojaInferior abierta={hoja === 'editar'} onCerrar={() => setHoja(null)} titulo="Editar adjunto" contexto={equipo.nombre}>
        {hoja === 'editar' && (
          <EditarDocumento
            adjunto={adjunto}
            nombreEquipo={equipo.nombre}
            otrosEquipos={otros.length}
            alTerminar={() => setHoja(null)}
          />
        )}
      </HojaInferior>
      <HojaInferior abierta={hoja === 'vincular'} onCerrar={() => setHoja(null)} titulo="Vincular a otro equipo" contexto={adjunto.nombre}>
        {hoja === 'vincular' && (
          <VincularDocumento
            adjunto={adjunto}
            yaVinculados={[dispositivoId, ...otros.map((o) => o.equipo.id)]}
            alTerminar={() => setHoja(null)}
          />
        )}
      </HojaInferior>

      <DialogoEliminar
        abierto={quitando}
        titulo={`¿Quitar "${adjunto.nombre}" de ${equipo.nombre}?`}
        descripcion={
          otros.length > 0
            ? `Sale solo de este equipo: sigue en ${otros.length === 1 ? 'el otro equipo que lo tiene' : `los otros ${otros.length} equipos que lo tienen`}.`
            : 'Sale de este equipo. Ningún otro equipo lo tiene.'
        }
        textoConfirmar="Quitar"
        onCerrar={() => setQuitando(false)}
        onConfirmar={quitar}
      />
    </Chasis>
  )
}

const ACCION_DELINEADA =
  'inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border-[1.5px] border-noct-text/25 px-3.5 text-[14px] font-semibold text-noct-text hover:bg-noct-text/[.05]'

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-noct-divider py-2.5">
      <span className="min-w-0 flex-1 text-[13px] text-noct-neutral-400">{etiqueta}</span>
      <span className="max-w-[62%] text-right text-[14.5px] font-medium text-noct-neutral-200 [overflow-wrap:anywhere]">{children}</span>
    </div>
  )
}

function SinConfirmar() {
  return <span className="font-normal text-noct-neutral-400">Sin confirmar</span>
}
