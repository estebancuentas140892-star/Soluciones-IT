import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Eye, EyeSlash, Paperclip, Warning } from '../../components/iconos'
import { db, type Credencial } from '../../lib/db'
import { registrarAccesoBoveda } from '../../lib/repositorio'
import { usePerfilVivo } from '../autenticacion/usePerfilVivo'
import {
  camposVistaRapida,
  copiarCampoCredencial,
  SIN_VALOR,
  tipoDe,
  type CampoCopiable,
  type CampoVistaRapida,
} from '../boveda/accionesCredencial'
import { descifrarCredencial, type DatosCredencial } from '../boveda/sesionBoveda'
import { useBovedaDesbloqueada } from '../boveda/useSesionBoveda'
import { ACCION_PRIMARIA, ACCION_SECUNDARIA, MS_AVISO } from './clasesAcciones'
import { useContextoResultados } from './contextoResultados'
import { eventoDeResolucion } from './medicion'
import { PanelVistaRapida } from './PanelVistaRapida'

// VER UNA CREDENCIAL SIN IR A LA BÓVEDA (encargo del 2026-09-16,
// secciones 2 a 7).
//
// Buscar "administrador POS", desbloquear y tener que abrir la ficha
// completa para leer un usuario era justo el viaje que el buscador venía
// a ahorrar. Esta vista se despliega DEBAJO del resultado, dentro del
// mismo buscador: la consulta sigue escrita, la capa sigue abierta y
// cerrarla devuelve a la misma lista.
//
// NO IMPLEMENTA NADA DE SEGURIDAD PROPIO. Todo lo delega:
//
//   - descifrar: `descifrarCredencial`, la sesión de siempre (devuelve null
//     con la bóveda bloqueada; aquí no hay forma de leer nada sin ella);
//   - qué datos se ven: `camposVistaRapida`, que son los mismos que se
//     pueden copiar desde la fila (`accionesRapidasDeCredencial`);
//   - copiar: `copiarCampoCredencial`, con su auditoría;
//   - auditar el resto: `registrarAccesoBoveda`, con LAS MISMAS acciones
//     que la ficha de la Bóveda. Abrir la vista es "consultó" (como abrir
//     la ficha), mostrar la clave es "mostró" (como su ojo). No hay un
//     formato de auditoría paralelo.
//
// LO QUE NO HACE NUNCA. No revela nada al desplegarse (la clave arranca
// tapada aunque la bóveda esté abierta), no escribe el valor en la URL, en
// localStorage, en el índice ni en un atributo, no parte un valor largo
// con "..." y no se queda con el secreto al cerrarse: el descifrado vive
// en el estado de ESTE componente, que se desmonta al cerrar, y se borra
// antes si la bóveda se bloquea con la vista abierta.

/** Lo que se pinta en lugar de un secreto tapado. Siempre el mismo largo. */
export const SECRETO_TAPADO = '••••••••'

export function VistaRapidaCredencial({
  credencialId,
  idPanel,
  desdeMejores,
  onCerrar,
}: {
  credencialId: string
  idPanel: string
  /** Para la medición del recorrido (sección 17 de la tarea 241). */
  desdeMejores: boolean
  onCerrar: () => void
}) {
  const desbloqueada = useBovedaDesbloqueada()
  const perfil = usePerfilVivo()
  const { modo, consulta, onResolver, huboDesbloqueo, estadoDeSalto, alSaltar, onNavegar } =
    useContextoResultados()
  const credencial = useLiveQuery(() => db.credenciales.get(credencialId), [credencialId])

  // undefined: nada que enseñar todavía (descifrando, o la bóveda se
  // cerró); null: no se pudo descifrar con la contraseña maestra actual.
  const [datos, setDatos] = useState<DatosCredencial | null | undefined>(undefined)
  const [revelado, setRevelado] = useState(false)
  const [aviso, setAviso] = useState<{ campo: CampoCopiable; ok: boolean; mensaje?: string } | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined)
  const consultaRegistrada = useRef<string | null>(null)

  // La vista solo existe con permiso, con la bóveda abierta y con la
  // credencial viva. Es una segunda guarda: una credencial solo llega al
  // índice con la bóveda abierta, pero el autobloqueo por inactividad
  // puede cerrarla con la vista desplegada.
  const vigente: Credencial | null =
    desbloqueada && perfil?.puedeVerBoveda && credencial && !credencial.eliminadoEn ? credencial : null
  const tipo = vigente ? tipoDe(vigente) : 'cuenta'
  // Un archivo seguro no se descifra ni se abre aquí (sección 2).
  const conContenido = vigente !== null && tipo !== 'archivo'
  const datosCifrados = conContenido ? vigente.datosCifrados : null

  useEffect(() => () => clearTimeout(temporizador.current), [])

  useEffect(() => {
    if (datosCifrados === null) {
      // Bloqueada, sin permiso o eliminada: el secreto sale del estado.
      setDatos(undefined)
      setRevelado(false)
      return
    }
    let activa = true
    void descifrarCredencial(datosCifrados).then((resultado) => {
      if (activa) setDatos(resultado)
    })
    return () => {
      activa = false
    }
  }, [datosCifrados])

  // "Consultó": una entrada por cada vez que se despliega la vista, igual
  // que abrir la ficha. La ref evita repetirla cuando la credencial se
  // refresca (una sincronización) sin que el técnico la haya vuelto a
  // abrir, y el doble montaje de StrictMode.
  useEffect(() => {
    if (!conContenido || consultaRegistrada.current === vigente.id) return
    consultaRegistrada.current = vigente.id
    void registrarAccesoBoveda({ credencialId: vigente.id, credencialTitulo: vigente.titulo, accion: 'consulto' })
  }, [conContenido, vigente])

  if (!vigente) return null

  // Copia local: TypeScript no arrastra el descarte de null a las
  // funciones de abajo.
  const actual = vigente

  function cerrar() {
    // Explícito aunque desmontarse ya lo descarte: el secreto no espera a
    // que React recoja el componente.
    setDatos(undefined)
    setRevelado(false)
    onCerrar()
  }

  function alternarRevelado() {
    const revelando = !revelado
    // Fuera del actualizador de estado, como en la ficha: React puede
    // invocarlo dos veces y se registraría el revelado por duplicado.
    if (revelando) {
      void registrarAccesoBoveda({ credencialId: actual.id, credencialTitulo: actual.titulo, accion: 'mostro' })
    }
    setRevelado(revelando)
  }

  async function copiar(campo: CampoCopiable) {
    const resultado = await copiarCampoCredencial(actual, campo)
    if (resultado.ok) {
      onResolver(
        eventoDeResolucion({ accion: 'copiar_credencial', tipo: 'credencial', desdeMejores, consulta, huboDesbloqueo }),
      )
    }
    clearTimeout(temporizador.current)
    setAviso({ campo, ok: resultado.ok, mensaje: resultado.mensaje })
    temporizador.current = setTimeout(() => setAviso(null), MS_AVISO)
  }

  return (
    <PanelVistaRapida
      idPanel={idPanel}
      titulo={actual.titulo}
      onCerrar={cerrar}
      // La ficha completa sigue a un toque fuera de una tarea: URL, otros
      // datos protegidos, equipos y actividad. En consulta no se ofrece:
      // abrirla sacaría al técnico de lo que está haciendo.
      fichaCompleta={
        modo === 'normal'
          ? {
              to: `/boveda/${actual.id}`,
              state: estadoDeSalto,
              onClick: () => {
                alSaltar()
                onNavegar?.()
              },
            }
          : undefined
      }
    >
      {tipo === 'archivo' ? (
        <p className="flex items-start gap-2 text-[13px] leading-normal text-noct-neutral-300">
          <Paperclip size={15} className="mt-0.5 shrink-0 text-noct-neutral-400" aria-hidden />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {actual.archivo ? `Archivo seguro: ${actual.archivo.nombre}. ` : 'Archivo seguro. '}
            {modo === 'consulta'
              ? 'Se descarga y se descifra desde su ficha en Bóveda, al terminar lo que estás haciendo.'
              : 'Se descarga y se descifra desde su ficha en Bóveda.'}
          </span>
        </p>
      ) : (
        <>
          <p className="text-[11.5px] leading-snug text-noct-neutral-500">
            Cada consulta, revelado y copia queda registrada.
          </p>
          {datos === undefined ? (
            <p className="text-[13px] text-noct-neutral-400">Descifrando...</p>
          ) : datos === null ? (
            <p className="text-[13px] leading-normal text-noct-precaucion">
              No se pudo descifrar este acceso con la contraseña maestra actual. Se guardó con una contraseña
              distinta.
            </p>
          ) : tipo === 'nota' ? (
            // La ficha muestra la nota en claro al abrirla (tras registrar
            // la consulta), y aquí la regla es la misma.
            datos.notas ? (
              <p className="whitespace-pre-wrap rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 text-[13.5px] leading-[1.55] text-noct-text [overflow-wrap:anywhere]">
                {datos.notas}
              </p>
            ) : (
              <p className="text-[13px] text-noct-neutral-500">Esta nota no tiene contenido.</p>
            )
          ) : (
            camposVistaRapida(actual).map((campo) => (
              <DatoCredencial
                key={campo.campo}
                campo={campo}
                valor={campo.campo === 'usuario' ? datos.usuario : datos.contrasena}
                sinValor={campo.campo === 'usuario' ? 'Sin usuario guardado.' : SIN_VALOR[tipo]}
                titulo={actual.titulo}
                oculto={campo.secreto && !revelado}
                onAlternar={campo.secreto ? alternarRevelado : undefined}
                onCopiar={() => void copiar(campo.campo)}
                aviso={aviso?.campo === campo.campo ? aviso : null}
              />
            ))
          )}
        </>
      )}
    </PanelVistaRapida>
  )
}

// Un dato de la credencial: rótulo, valor a ancho completo y, debajo, sus
// acciones. El valor NO comparte renglón con los botones a propósito: a
// 360 px, un token de 120 caracteres al lado de "Mostrar" y "Copiar" se
// quedaría en una columna de tres letras (regla M-R13 de `FilaDato`).
function DatoCredencial({
  campo,
  valor,
  sinValor,
  titulo,
  oculto,
  onAlternar,
  onCopiar,
  aviso,
}: {
  campo: CampoVistaRapida
  valor: string
  sinValor: string
  titulo: string
  oculto: boolean
  onAlternar?: () => void
  onCopiar: () => void
  aviso: { ok: boolean; mensaje?: string } | null
}) {
  const rotuloBajo = campo.rotulo.charAt(0).toLowerCase() + campo.rotulo.slice(1)

  if (!valor) {
    return (
      <div className="flex flex-col gap-1 rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5">
        <span className="text-[12px] leading-4 text-noct-neutral-400">{campo.rotulo}</span>
        <span className="text-[13px] text-noct-neutral-500">{sinValor}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5">
      <div className="flex flex-col gap-1">
        <span className="text-[12px] leading-4 text-noct-neutral-400">{campo.rotulo}</span>
        {/* UN SECRETO LARGO SE LEE ENTERO (2026-09-15): mostrado, parte en
            varias líneas aunque no tenga espacios y conserva los suyos;
            nunca se recorta con "...". Tapado, siempre los mismos puntos. */}
        <span
          className={`font-mono text-[14px] leading-[1.45] text-noct-text ${
            oculto ? 'tracking-[2px]' : 'whitespace-pre-wrap break-all'
          }`}
        >
          {oculto ? SECRETO_TAPADO : valor}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {onAlternar && (
          <button
            type="button"
            onClick={onAlternar}
            aria-label={oculto ? `Mostrar ${rotuloBajo} (queda registrado)` : `Ocultar ${rotuloBajo}`}
            className={ACCION_SECUNDARIA}
          >
            {oculto ? (
              <Eye size={16} className="shrink-0" aria-hidden />
            ) : (
              <EyeSlash size={16} className="shrink-0" aria-hidden />
            )}
            {oculto ? 'Mostrar' : 'Ocultar'}
          </button>
        )}
        <button
          type="button"
          onClick={onCopiar}
          aria-label={`${campo.etiqueta} de "${titulo}"`}
          className={aviso && !aviso.ok ? ACCION_SECUNDARIA : ACCION_PRIMARIA}
        >
          {aviso ? (
            aviso.ok ? (
              <Check size={16} className="shrink-0 text-noct-exito" aria-hidden />
            ) : (
              <Warning size={16} className="shrink-0 text-noct-precaucion" aria-hidden />
            )
          ) : (
            <Copy size={16} className="shrink-0" aria-hidden />
          )}
          {aviso ? (aviso.ok ? 'Copiado' : 'No se pudo') : campo.etiqueta}
        </button>
      </div>
      {/* El motivo del fallo, donde el técnico está mirando. El valor
          copiado nunca se anuncia: solo va al portapapeles. */}
      {aviso && !aviso.ok && aviso.mensaje && (
        <p role="status" className="text-[12px] leading-snug text-noct-precaucion">
          {aviso.mensaje}
        </p>
      )}
    </div>
  )
}
