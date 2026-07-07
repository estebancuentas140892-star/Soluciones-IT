import { forwardRef, type InputHTMLAttributes } from 'react'

// ¿El navegador puede enmascarar un input de texto normal? Cuando
// puede, los campos de secreto usan type="text" enmascarado por CSS
// (.enmascarado) en vez de type="password". Asi el gestor de
// contraseñas del sistema operativo NO los reconoce como campos de
// login y no ofrece guardarlos ni autocompletarlos, que es la fuga
// principal en movil (llavero de iOS, Google/Android). Si el navegador
// no lo soporta (algunos muy viejos) se cae a type="password", que
// queda enmascarado igual aunque el sistema pueda ofrecer guardarlo.
const SOPORTA_ENMASCARADO =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('-webkit-text-security', 'disc')

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  // Si true, el valor se muestra en claro (para el botón "Mostrar").
  revelado?: boolean
}

// Campo para ESCRIBIR un secreto (contraseña de login, contraseña
// maestra, contraseña de una credencial, bloqueo de la app...). Evita
// que el dispositivo lo guarde o lo autocomplete. Para MOSTRAR un
// secreto ya guardado se usa CampoSecreto (texto, sin input).
export const CampoContrasena = forwardRef<HTMLInputElement, Props>(function CampoContrasena(
  { revelado = false, className = '', ...resto },
  ref,
) {
  const enmascararConCss = SOPORTA_ENMASCARADO && !revelado
  const type = SOPORTA_ENMASCARADO ? 'text' : revelado ? 'text' : 'password'
  return (
    <input
      {...resto}
      ref={ref}
      type={type}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      // Pistas para que los gestores de terceros (1Password, LastPass,
      // Bitwarden) tampoco intervengan sobre estos campos.
      data-1p-ignore=""
      data-lpignore="true"
      data-bwignore=""
      className={`${enmascararConCss ? 'enmascarado ' : ''}${className}`}
    />
  )
})
