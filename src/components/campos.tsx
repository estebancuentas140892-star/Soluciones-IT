import { useId, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { Plus, X } from './iconos'
import { BTN_GHOST_ACENTO } from './nocturne'

// Primitivas de formulario del sistema Nocturne (Fase 0 de
// PROPUESTA_REVISION_ARQUITECTURA.md): la fuente UNICA de como se ve un
// campo de texto y su etiqueta en toda la app.
//
// Antes de este modulo, `CLASE_CAMPO` estaba redefinida en 13 archivos y
// `CLASE_ETIQUETA` en 8. Seis copias eran identicas y las demas ya
// habian derivado: `ArticuloForm` habia perdido `box-border` y el color
// del placeholder, e `ImportarDispositivosPage` el color del
// placeholder. Esa deriva es justo lo que una constante compartida
// evita: el campo se ve igual en los diez formularios o no se ve igual
// en ninguno.

// El campo SIN ancho: para el caso raro en que quien lo usa necesita
// fijar el suyo (por ejemplo `w-2/5` en una fila de dos columnas). No se
// puede escribir `${CLASE_CAMPO} w-2/5` porque las dos utilidades de
// ancho tienen la misma especificidad y decide el orden de emision de
// Tailwind, no el del atributo (ver la nota de la variante de fondo).
export const CLASE_CAMPO_SIN_ANCHO =
  'box-border rounded-md border border-noct-divider bg-noct-surface px-3 py-2.5 text-sm text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600'

// Campo de texto sobre el fondo normal de un formulario.
export const CLASE_CAMPO = `w-full ${CLASE_CAMPO_SIN_ANCHO}`

// Misma pieza para un campo que se dibuja SOBRE una superficie (una
// tarjeta, un panel): ahi el fondo de superficie no contrastaria, asi
// que usa el fondo de la app.
//
// Es una constante completa y no `${CLASE_CAMPO} bg-noct-bg` a
// proposito, por la misma razon documentada en las variantes de boton
// de nocturne.tsx: dos utilidades de fondo tienen la misma
// especificidad, asi que no gana la que se escribe al final sino la que
// Tailwind emite mas tarde en la hoja. Tailwind ordena por nombre, asi
// que `bg-noct-surface` saldria despues de `bg-noct-bg` y lo taparia.
export const CLASE_CAMPO_SOBRE_SUPERFICIE =
  'w-full box-border rounded-md border border-noct-divider bg-noct-bg px-3 py-2.5 text-sm text-noct-text outline-none focus:border-noct-accent placeholder:text-noct-neutral-600'

// Modificadores que SI se pueden concatenar detras de las constantes de
// arriba, porque no compiten con ninguna utilidad que ellas ya traigan:
// `font-mono` (familia), `text-center` (alineacion, distinta propiedad
// que `text-sm`) y las alturas minimas (`min-h-11`). Los que NO se
// pueden concatenar y por eso tienen constante propia son el fondo y el
// ancho: son las dos utilidades que las constantes de arriba ya fijan.
export const CLASE_CAMPO_MONO = `${CLASE_CAMPO} font-mono`
export const CLASE_CAMPO_MONO_SIN_ANCHO = `${CLASE_CAMPO_SIN_ANCHO} font-mono`

// Rotulo de un campo: 12.5px, peso medio, en el gris de apoyo.
export const CLASE_ETIQUETA = 'text-[12.5px] font-medium text-noct-neutral-400'

// Un campo con su rotulo: el envoltorio `<label>` que ya repetian
// veintitantas veces los formularios. El `<label>` envuelve al control,
// asi que tocar el texto enfoca el campo sin necesidad de `htmlFor`.
export function Campo({
  etiqueta,
  ayuda,
  children,
  className = '',
}: {
  etiqueta: ReactNode
  // Texto de apoyo bajo el control (opcional): para que sirve el campo
  // o que formato espera.
  ayuda?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className={CLASE_ETIQUETA}>{etiqueta}</span>
      {children}
      {ayuda && <span className="text-[12px] leading-[1.5] text-noct-neutral-600">{ayuda}</span>}
    </label>
  )
}

// Campo de texto libre que ademas sugiere lo que el equipo ya escribio
// en ese mismo campo (marca de un equipo, categoria de un secreto,
// medio de una conexion). Sigue siendo texto libre: la sugerencia
// ayuda a converger, nunca obliga.
//
// El id del `<datalist>` se genera con useId en vez de recibirlo: dos
// instancias en la misma pantalla no pueden pisarse el listado.
export function CampoConSugerencias({
  valor,
  onChange,
  sugerencias,
  placeholder,
  className = '',
}: {
  valor: string
  onChange: (valor: string) => void
  // Ya deduplicadas y ordenadas (ver `valoresUnicos` en
  // src/lib/vocabulario.ts).
  sugerencias: string[]
  placeholder?: string
  className?: string
}) {
  const idLista = useId()
  return (
    <>
      <input
        type="text"
        value={valor}
        onChange={(evento) => onChange(evento.target.value)}
        list={sugerencias.length > 0 ? idLista : undefined}
        placeholder={placeholder}
        className={`${CLASE_CAMPO} ${className}`}
      />
      {sugerencias.length > 0 && (
        <datalist id={idLista}>
          {sugerencias.map((sugerencia) => (
            <option key={sugerencia} value={sugerencia} />
          ))}
        </datalist>
      )}
    </>
  )
}

export interface CampoClaveValor {
  clave: string
  valor: string
}

// Editor de pares clave/valor con su cabecera, su boton de agregar y
// sus filas. Estaba duplicado entre las "Propiedades personalizadas" de
// un dispositivo y los "Otros datos protegidos" de un secreto, con la
// misma logica de agregar/actualizar/quitar escrita dos veces y el
// markup de la fila copiado con clases sueltas en un lado y las
// constantes compartidas en el otro.
//
// El componente es controlado: no guarda estado propio, solo transforma
// la lista que recibe. Las claves vacias se conservan mientras se edita
// (el tecnico escribe primero el valor a veces); descartarlas es tarea
// de quien guarda, como ya hacian ambos formularios.
export function CamposClaveValor({
  titulo,
  ayuda,
  campos,
  onChange,
  sugerenciasClave = [],
  valorMono = false,
  valorAutoComplete,
}: {
  titulo: string
  ayuda?: ReactNode
  campos: CampoClaveValor[]
  // Es el `setState` de quien lo usa, no un `(campos) => void` a secas:
  // asi las tres operaciones pueden pasar la forma FUNCIONAL y partir
  // siempre del valor mas reciente. Con la forma directa, dos toques
  // seguidos en "Campo" que caigan en el mismo lote de React parten
  // ambos de la misma lista vieja y el segundo pierde la fila.
  onChange: Dispatch<SetStateAction<CampoClaveValor[]>>
  // Claves que ya usan otras fichas del mismo tipo, para el datalist.
  sugerenciasClave?: string[]
  // El valor en monoespaciada: para datos que se leen caracter a
  // caracter (claves, PIN, puertos), donde confundir una l con un 1
  // cuesta caro.
  valorMono?: boolean
  valorAutoComplete?: string
}) {
  const idLista = useId()

  function actualizar(indice: number, campo: keyof CampoClaveValor, valor: string) {
    onChange((actuales) => actuales.map((actual, i) => (i === indice ? { ...actual, [campo]: valor } : actual)))
  }

  function quitar(indice: number) {
    onChange((actuales) => actuales.filter((_, i) => i !== indice))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className={CLASE_ETIQUETA}>{titulo}</span>
        <button
          type="button"
          onClick={() => onChange((actuales) => [...actuales, { clave: '', valor: '' }])}
          className={`${BTN_GHOST_ACENTO} whitespace-nowrap`}
        >
          <Plus size={13} aria-hidden />
          Campo
        </button>
      </div>
      {ayuda && <p className="text-[12px] leading-[1.5] text-noct-neutral-600">{ayuda}</p>}

      {sugerenciasClave.length > 0 && (
        <datalist id={idLista}>
          {sugerenciasClave.map((clave) => (
            <option key={clave} value={clave} />
          ))}
        </datalist>
      )}

      {campos.map((campo, indice) => (
        // La clave de React es el indice a proposito: estas filas no
        // tienen id propio y su contenido puede repetirse mientras se
        // escribe (dos claves vacias recien agregadas), asi que el
        // indice es lo unico estable aqui.
        <div key={indice} className="flex items-center gap-2">
          {/* Las dos filas usan la variante SIN ancho: aqui el ancho lo
              reparte el flex (38% la clave, el resto el valor). Con el
              `w-full` del campo normal, la clave se comia toda la fila y
              el valor quedaba en 26px, que es justo lo que le pasaba a
              "Otros datos protegidos" de la Boveda antes de esta fase. */}
          <input
            type="text"
            placeholder="Campo"
            value={campo.clave}
            onChange={(evento) => actualizar(indice, 'clave', evento.target.value)}
            list={sugerenciasClave.length > 0 ? idLista : undefined}
            className={`min-h-[42px] w-[38%] ${CLASE_CAMPO_SIN_ANCHO}`}
          />
          <input
            type="text"
            placeholder="Valor"
            value={campo.valor}
            onChange={(evento) => actualizar(indice, 'valor', evento.target.value)}
            autoComplete={valorAutoComplete}
            className={`min-h-[42px] min-w-0 flex-1 ${valorMono ? CLASE_CAMPO_MONO_SIN_ANCHO : CLASE_CAMPO_SIN_ANCHO}`}
          />
          <button
            type="button"
            onClick={() => quitar(indice)}
            aria-label={`Quitar ${campo.clave.trim() || 'este campo'}`}
            className="flex min-h-11 w-8 shrink-0 items-center justify-center text-noct-neutral-600 hover:text-noct-text"
          >
            <X size={14} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}
