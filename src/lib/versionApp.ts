// QUÉ VERSIÓN LLEVA ESTE TELÉFONO (encargo del 2026-09-20, punto 4).
//
// Sin esto, "ya actualicé" y "sigo con lo viejo" son indistinguibles: el
// técnico mira la pantalla y no hay nada que comparar contra lo que se
// desplegó. Vercel expone el commit del despliegue en
// `VERCEL_GIT_COMMIT_SHA`; `vite.config.ts` lo recorta a siete
// caracteres y lo hornea en el build como `VITE_VERSION_APP`.
//
// En desarrollo local esa variable no existe, y entonces la versión es
// literalmente "desarrollo": decir un commit falso sería peor que no
// decir nada.

export const VERSION_DESARROLLO = 'desarrollo'

/**
 * La versión corta de esta copia de la app. `valor` se inyecta en las
 * pruebas; en la app real sale del build.
 */
export function versionApp(valor: string | undefined = import.meta.env.VITE_VERSION_APP): string {
  const limpio = (valor ?? '').trim()
  return limpio === '' ? VERSION_DESARROLLO : limpio.slice(0, 7)
}
