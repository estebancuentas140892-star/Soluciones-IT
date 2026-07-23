import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { BotonVolver } from '../../components/BotonVolver'
import { CaretDown, CaretUp, LinkSimple, Monitor, Wrench } from '../../components/iconos'
import { BTN_PRIMARIO, TituloSeccion } from '../../components/nocturne'
import { type CampoProtegido, db } from '../../lib/db'
import { eliminarRegistro, guardarRegistro, nuevoId, registrarAccesoBoveda } from '../../lib/repositorio'
import { camposDeDispositivo, esOcultoPorDefecto, siguienteOrden } from '../dispositivos/camposProtegidos'
import { CampoSecreto } from './CampoSecreto'
import { camposAMigrar, detectarCandidatos, type CandidatoMigracion } from './migracionSecretos'
import { cifrarValor, descifrarCredencial, type DatosCredencial } from './sesionBoveda'

// Migracion asistida de secretos de equipo (fase P4 de
// PROPUESTA_SEGURIDAD_DISPOSITIVO.md), mismo espiritu que
// MigracionUbicaciones.tsx: detecta, con un informe previo, las
// credenciales de la Boveda que en realidad representan un equipo
// entero (vinculadas a un solo dispositivo, o con una IP heredada que
// coincide con la de un equipo) y ofrece moverlas a la seccion
// "Seguridad" de su ficha. Idempotente: al migrar una credencial se
// elimina de la Boveda (guardando antes sus datos como campos
// protegidos), asi que una segunda pasada no la vuelve a proponer. La
// deteccion y el armado de campos son puros y estan en
// migracionSecretos.ts; aqui solo se descifra, se revisa y se
// ejecuta. Vive dentro de BovedaGuard (ruta /boveda/migrar), asi que la
// boveda ya esta desbloqueada al llegar.
export function MigracionCredenciales() {
  const dispositivos = useLiveQuery(() => db.dispositivos.filter((d) => !d.eliminadoEn).toArray(), [], [])
  const credenciales = useLiveQuery(() => db.credenciales.filter((c) => !c.eliminadoEn).toArray(), [], [])
  const camposProtegidos = useLiveQuery(() => db.campos_protegidos.toArray(), [], [] as CampoProtegido[])

  // Descifrado en bloque: el informe previo necesita el contenido en
  // claro de cada credencial (para armar los campos a crear) y, para la
  // deteccion por IP, su direccion heredada. Se hace una sola vez por
  // credencial, no en cada render; una que no se puede descifrar con la
  // contraseña maestra actual (se guardo con otra) queda como null y se
  // excluye de las candidatas listas para migrar, no de las detectadas
  // por vinculo (esas se muestran igual, avisando que no se pueden leer).
  const [descifradas, setDescifradas] = useState<Map<string, DatosCredencial | null>>(new Map())
  useEffect(() => {
    let vigente = true
    void Promise.all(
      credenciales.map(async (c) => [c.id, await descifrarCredencial(c.datosCifrados)] as const),
    ).then((pares) => {
      if (vigente) setDescifradas(new Map(pares))
    })
    return () => {
      vigente = false
    }
  }, [credenciales])

  const ipsDescifradas = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const [id, datos] of descifradas) mapa.set(id, datos?.ip ?? '')
    return mapa
  }, [descifradas])

  const candidatos = useMemo(
    () => detectarCandidatos(credenciales, dispositivos, ipsDescifradas),
    [credenciales, dispositivos, ipsDescifradas],
  )
  const analizando = credenciales.length > 0 && descifradas.size < credenciales.length
  const sinLeer = candidatos.filter((c) => descifradas.get(c.credencialId) == null).length

  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [migrandoId, setMigrandoId] = useState<string | null>(null)
  const [revelados, setRevelados] = useState<Set<string>>(new Set())

  function alternarExpandir(candidato: CandidatoMigracion) {
    const abriendo = expandidoId !== candidato.credencialId
    setExpandidoId(abriendo ? candidato.credencialId : null)
    // Auditoria (fase B3): abrir el informe previo de una credencial es
    // consultarla, igual que abrir su ficha en la Bóveda.
    if (abriendo) {
      void registrarAccesoBoveda({
        credencialId: candidato.credencialId,
        credencialTitulo: candidato.credencialTitulo,
        accion: 'consulto',
      })
    }
  }

  // Auditoria de copiar (fase B3): mismo criterio que CredencialPage,
  // solo usuario y contraseña tienen una accion que el registro
  // inmutable sabe nombrar; URL, notas y los datos extra no se auditan
  // al copiar en ningun otro lugar de la app tampoco.
  function accionCopia(tipo: string): 'copio_usuario' | 'copio_contrasena' | undefined {
    if (tipo === 'usuario') return 'copio_usuario'
    if (tipo === 'contrasena') return 'copio_contrasena'
    return undefined
  }

  function alternarRevelado(credencialId: string, credencialTitulo: string, campo: { nombre: string; tipo: string }) {
    const clave = `${credencialId}:${campo.nombre}`
    const revelando = !revelados.has(clave)
    // Mismo criterio que CredencialPage: solo la contraseña genera
    // auditoría de "mostro" (es la única acción que el registro
    // inmutable sabe nombrar y el único dato que de verdad hay que
    // vigilar quién lo reveló).
    if (revelando && campo.tipo === 'contrasena') {
      void registrarAccesoBoveda({ credencialId, credencialTitulo, accion: 'mostro' })
    }
    setRevelados((actuales) => {
      const siguiente = new Set(actuales)
      if (revelando) siguiente.add(clave)
      else siguiente.delete(clave)
      return siguiente
    })
  }

  async function migrar(candidato: CandidatoMigracion) {
    const datos = descifradas.get(candidato.credencialId)
    if (!datos) return
    const existentes = camposDeDispositivo(camposProtegidos, candidato.dispositivoId)
    const nuevosCampos = camposAMigrar(datos, existentes)
    const ordenBase = siguienteOrden(existentes)

    setMigrandoId(candidato.credencialId)
    try {
      for (const [indice, campo] of nuevosCampos.entries()) {
        await guardarRegistro('campos_protegidos', {
          id: nuevoId(),
          dispositivoId: candidato.dispositivoId,
          nombre: campo.nombre,
          tipo: campo.tipo,
          valorCifrado: await cifrarValor(campo.valor),
          orden: ordenBase + indice,
          venceEn: null,
        })
      }
      // Se registra como eliminación (mismo patrón que BovedaPage y
      // CredencialPage): el secreto deja de existir como tal, ahora vive
      // como campos protegidos de la ficha del equipo.
      await registrarAccesoBoveda({
        credencialId: candidato.credencialId,
        credencialTitulo: candidato.credencialTitulo,
        accion: 'elimino',
      })
      await eliminarRegistro('credenciales', candidato.credencialId)
      // La lista se refresca sola por useLiveQuery: la credencial migrada
      // desaparece de `candidatos` sin ningún estado extra que mantener.
    } finally {
      setMigrandoId(null)
    }
  }

  return (
    <div className="nocturne min-h-svh bg-noct-bg font-inter text-[15px] leading-[1.55] text-noct-text">
      <div className="mx-auto flex min-h-svh max-w-md flex-col">
        <div className="sticky top-0 z-20 border-b border-noct-divider bg-noct-bg/[.92] backdrop-blur-[12px]">
          <header className="flex items-center justify-between gap-2 py-2.5 pl-2 pr-3 pb-0">
            <BotonVolver />
          </header>
          <div className="px-4 pb-3 pt-0.5">
            <h1 className="m-0 text-[22px] font-medium leading-[1.25]">Migrar secretos de equipo</h1>
            <p className="mt-[3px] text-[12.5px] leading-[1.5] text-noct-neutral-500">
              Detecta secretos que en realidad son de un equipo (vinculados a uno solo, o con su misma
              dirección IP) y los mueve a "Seguridad" en su ficha. Revisa qué se va a crear antes de
              migrar cada uno.
            </p>
          </div>
        </div>

        <main className="flex flex-1 flex-col gap-2.5 px-4 pb-12 pt-[18px]">
          {analizando && (
            <p className="rounded-md border border-dashed border-noct-neutral-700 px-4 py-6 text-center text-sm text-noct-neutral-500">
              Analizando los secretos guardados...
            </p>
          )}

          {!analizando && candidatos.length === 0 && (
            <p className="rounded-md border border-dashed border-noct-neutral-700 px-4 py-6 text-center text-sm text-noct-neutral-500">
              No hay secretos pendientes de migrar. Todo lo que representa a un equipo ya vive en su
              ficha.
            </p>
          )}

          {!analizando &&
            candidatos.map((candidato) => {
              const datos = descifradas.get(candidato.credencialId)
              const noLegible = datos == null
              const expandido = expandidoId === candidato.credencialId
              const existentes = camposDeDispositivo(camposProtegidos, candidato.dispositivoId)
              const campos = datos ? camposAMigrar(datos, existentes) : []

              return (
                <div
                  key={candidato.credencialId}
                  className="rounded-md border border-noct-divider bg-noct-surface"
                >
                  <button
                    type="button"
                    onClick={() => alternarExpandir(candidato)}
                    aria-expanded={expandido}
                    className="flex min-h-[56px] w-full items-center gap-2.5 px-3 py-2 text-left"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-noct-text/[.06] text-noct-neutral-400">
                      <Monitor size={17} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium leading-tight">
                        {candidato.credencialTitulo}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-noct-neutral-500">
                        {candidato.motivo === 'vinculo' ? (
                          <LinkSimple size={11} className="shrink-0" aria-hidden />
                        ) : (
                          <Wrench size={11} className="shrink-0" aria-hidden />
                        )}
                        {candidato.motivo === 'vinculo' ? 'Vinculada a' : 'Misma IP que'}{' '}
                        {candidato.dispositivoNombre}
                      </span>
                    </span>
                    {expandido ? (
                      <CaretUp size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
                    ) : (
                      <CaretDown size={14} className="shrink-0 text-noct-neutral-500" aria-hidden />
                    )}
                  </button>

                  {expandido && (
                    <div className="flex flex-col gap-2 border-t border-noct-divider p-3">
                      {noLegible ? (
                        <p className="text-[12.5px] leading-relaxed text-noct-precaucion">
                          No se pudo descifrar este secreto con la contraseña maestra actual (se guardó
                          con otra). No se puede migrar sin poder leer su contenido.
                        </p>
                      ) : campos.length === 0 ? (
                        <p className="text-[12.5px] text-noct-neutral-500">
                          Este secreto no tiene contenido: se puede eliminar directo desde la Bóveda.
                        </p>
                      ) : (
                        <>
                          <TituloSeccion>
                            Se creará en "{candidato.dispositivoNombre}"
                          </TituloSeccion>
                          <dl className="flex flex-col gap-1.5">
                            {campos.map((campo) => {
                              const clave = `${candidato.credencialId}:${campo.nombre}`
                              // Mismo criterio que SeguridadDelEquipo: el
                              // usuario no es un secreto que haya que
                              // esconder (hace falta leerlo para
                              // escribirlo en otro lado); contraseña y
                              // el resto (URL, notas, extras) sí.
                              const oculta = esOcultoPorDefecto(campo.tipo)
                              const accion = accionCopia(campo.tipo)
                              return (
                                <CampoSecreto
                                  key={clave}
                                  etiqueta={campo.nombre}
                                  valor={campo.valor}
                                  oculto={oculta && !revelados.has(clave)}
                                  alternarOculto={
                                    oculta
                                      ? () =>
                                          alternarRevelado(
                                            candidato.credencialId,
                                            candidato.credencialTitulo,
                                            campo,
                                          )
                                      : undefined
                                  }
                                  onCopiado={
                                    accion
                                      ? () =>
                                          void registrarAccesoBoveda({
                                            credencialId: candidato.credencialId,
                                            credencialTitulo: candidato.credencialTitulo,
                                            accion,
                                          })
                                      : undefined
                                  }
                                />
                              )
                            })}
                          </dl>
                        </>
                      )}
                      {datos?.ip && (
                        <p className="text-[11.5px] leading-relaxed text-noct-neutral-600">
                          Se descarta la dirección IP heredada ({datos.ip}): ya vive sin cifrar en la
                          ficha del equipo.
                        </p>
                      )}
                      <p className="text-[11.5px] leading-relaxed text-noct-neutral-600">
                        Al migrar, este secreto se elimina de la Bóveda: el contenido pasa a la sección
                        "Seguridad" del equipo.
                      </p>
                      <button
                        type="button"
                        onClick={() => void migrar(candidato)}
                        disabled={noLegible || migrandoId === candidato.credencialId}
                        className={`${BTN_PRIMARIO} min-h-11 self-start px-4 disabled:opacity-50`}
                      >
                        {migrandoId === candidato.credencialId ? 'Migrando...' : 'Migrar a este equipo'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

          {sinLeer > 0 && (
            <p className="px-0.5 text-[11.5px] leading-relaxed text-noct-neutral-600">
              {sinLeer} {sinLeer === 1 ? 'secreto detectado no se pudo' : 'secretos detectados no se pudieron'} leer
              con la contraseña maestra actual, así que no se pueden migrar todavía.
            </p>
          )}
        </main>
      </div>
    </div>
  )
}
