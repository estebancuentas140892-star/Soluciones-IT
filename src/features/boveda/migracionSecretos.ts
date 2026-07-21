import type { CampoProtegido, Credencial, Dispositivo, TipoCampoProtegido } from '../../lib/db'
import type { DatosCredencial } from './sesionBoveda'

// Migracion asistida de secretos de equipo (fase P4 de
// PROPUESTA_SEGURIDAD_DISPOSITIVO.md), mismo espiritu que
// src/features/ubicaciones/migracion.ts: logica pura y testeable
// (sin React, sin base local, sin criptografia real) que la pantalla
// `MigracionCredenciales.tsx` envuelve con la carga, el descifrado y el
// guardado. Detecta credenciales de la Boveda que en realidad
// representan un equipo entero (la duplicacion que corrige la
// propuesta) y prepara, por cada una, los campos protegidos que se
// crearian en la ficha de ese equipo. Es idempotente: una credencial
// migrada se elimina de la Boveda, asi que una segunda pasada no vuelve
// a proponerla.

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export type MotivoCandidato = 'vinculo' | 'ip'

export interface CandidatoMigracion {
  credencialId: string
  credencialTitulo: string
  dispositivoId: string
  dispositivoNombre: string
  // 'vinculo': la credencial ya esta vinculada a un solo equipo (señal
  // explicita, mas fuerte). 'ip': nadie la vinculo, pero su IP heredada
  // coincide con la de un equipo del inventario (señal implicita).
  motivo: MotivoCandidato
}

type CredencialMigrable = Pick<Credencial, 'id' | 'titulo' | 'dispositivos' | 'eliminadoEn'>
type DispositivoMigrable = Pick<Dispositivo, 'id' | 'nombre' | 'ip' | 'eliminadoEn'>

// Detecta las credenciales candidatas. `ipsDescifradas` llega ya resuelta
// por la pantalla (requiere descifrar cada credencial con la sesion de
// boveda, que esta funcion no conoce): mapa credencialId -> IP heredada
// descifrada ('' si no tiene o no se pudo descifrar). El vinculo
// explicito (un solo equipo) gana sobre la coincidencia de IP cuando
// apuntan a equipos distintos, por ser una señal puesta a mano por un
// tecnico.
export function detectarCandidatos(
  credenciales: CredencialMigrable[],
  dispositivos: DispositivoMigrable[],
  ipsDescifradas: Map<string, string>,
): CandidatoMigracion[] {
  const vivos = dispositivos.filter((d) => !d.eliminadoEn)
  const porId = new Map(vivos.map((d) => [d.id, d]))
  const porIp = new Map(
    vivos.filter((d) => d.ip.trim() !== '').map((d) => [normalizar(d.ip), d]),
  )

  const candidatos: CandidatoMigracion[] = []
  for (const c of credenciales) {
    if (c.eliminadoEn) continue

    if (c.dispositivos.length === 1) {
      const equipo = porId.get(c.dispositivos[0].id)
      if (equipo) {
        candidatos.push({
          credencialId: c.id,
          credencialTitulo: c.titulo,
          dispositivoId: equipo.id,
          dispositivoNombre: equipo.nombre,
          motivo: 'vinculo',
        })
        continue
      }
    }

    const ip = ipsDescifradas.get(c.id) ?? ''
    if (ip.trim() === '') continue
    const equipo = porIp.get(normalizar(ip))
    if (!equipo) continue
    candidatos.push({
      credencialId: c.id,
      credencialTitulo: c.titulo,
      dispositivoId: equipo.id,
      dispositivoNombre: equipo.nombre,
      motivo: 'ip',
    })
  }
  return candidatos
}

export interface CampoAMigrar {
  nombre: string
  tipo: TipoCampoProtegido
  valor: string
}

// A partir del contenido ya descifrado de una credencial, arma los
// campos protegidos que se crearian en la ficha del equipo destino. La
// direccion IP heredada se descarta a proposito (es la grieta que
// corrige la propuesta: el dato canonico ya vive sin cifrar en
// `dispositivo.ip`, volver a guardarla aqui repetiria la duplicacion,
// solo que escondida). Los nombres se desambiguan contra los campos que
// el equipo ya tiene (y entre si) agregando un sufijo " (2)", " (3)"...
// para que dos campos nunca queden indistinguibles al vincularlos desde
// un procedimiento (misma razon que valida `validarNombre` en
// camposProtegidos.ts).
export function camposAMigrar(
  datos: DatosCredencial,
  camposExistentes: Pick<CampoProtegido, 'nombre' | 'eliminadoEn'>[],
): CampoAMigrar[] {
  const propuestos: CampoAMigrar[] = []
  if (datos.usuario.trim()) propuestos.push({ nombre: 'Usuario', tipo: 'usuario', valor: datos.usuario.trim() })
  if (datos.contrasena.trim())
    propuestos.push({ nombre: 'Contraseña', tipo: 'contrasena', valor: datos.contrasena.trim() })
  if (datos.url.trim()) propuestos.push({ nombre: 'URL', tipo: 'texto', valor: datos.url.trim() })
  if (datos.notas.trim()) propuestos.push({ nombre: 'Notas', tipo: 'texto', valor: datos.notas.trim() })
  for (const [clave, valor] of Object.entries(datos.extras)) {
    if (valor.trim()) propuestos.push({ nombre: clave.trim(), tipo: 'texto', valor: valor.trim() })
  }

  const nombresUsados = new Set(
    camposExistentes.filter((c) => !c.eliminadoEn).map((c) => normalizar(c.nombre)),
  )
  return propuestos.map((campo) => {
    let nombreFinal = campo.nombre
    let sufijo = 2
    while (nombresUsados.has(normalizar(nombreFinal))) {
      nombreFinal = `${campo.nombre} (${sufijo})`
      sufijo += 1
    }
    nombresUsados.add(normalizar(nombreFinal))
    return { ...campo, nombre: nombreFinal }
  })
}
