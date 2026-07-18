// Genera src/components/iconos.tsx a partir de los SVG de
// @phosphor-icons/core (instalado temporalmente con --no-save).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const raiz = process.argv[2]
const salida = process.argv[3]

// nombre de componente -> [peso, nombre de archivo phosphor]
const ICONOS = {
  ArrowDown: ['regular', 'arrow-down'],
  ArrowElbowDownRight: ['regular', 'arrow-elbow-down-right'],
  ArrowLeft: ['regular', 'arrow-left'],
  ArrowRight: ['regular', 'arrow-right'],
  ArrowSquareOut: ['regular', 'arrow-square-out'],
  ArrowUp: ['regular', 'arrow-up'],
  BookOpen: ['regular', 'book-open'],
  BookOpenFill: ['fill', 'book-open'],
  CaretDown: ['regular', 'caret-down'],
  CaretLeft: ['regular', 'caret-left'],
  CaretRight: ['regular', 'caret-right'],
  CaretUp: ['regular', 'caret-up'],
  Camera: ['regular', 'camera'],
  CameraSlash: ['regular', 'camera-slash'],
  Check: ['regular', 'check'],
  CheckCircle: ['regular', 'check-circle'],
  CheckCircleFill: ['fill', 'check-circle'],
  Circle: ['regular', 'circle'],
  Clock: ['regular', 'clock'],
  ClockCounterClockwise: ['regular', 'clock-counter-clockwise'],
  CloudArrowUp: ['regular', 'cloud-arrow-up'],
  CloudCheck: ['regular', 'cloud-check'],
  CloudSlash: ['regular', 'cloud-slash'],
  Code: ['regular', 'code'],
  Copy: ['regular', 'copy'],
  DotsThreeBold: ['bold', 'dots-three'],
  DotsThreeCircle: ['regular', 'dots-three-circle'],
  DotsThreeOutline: ['regular', 'dots-three-outline'],
  DownloadSimple: ['regular', 'download-simple'],
  Eye: ['regular', 'eye'],
  EyeSlash: ['regular', 'eye-slash'],
  FlagBanner: ['regular', 'flag-banner'],
  Flashlight: ['regular', 'flashlight'],
  FlashlightFill: ['fill', 'flashlight'],
  FloppyDisk: ['regular', 'floppy-disk'],
  House: ['regular', 'house'],
  HouseFill: ['fill', 'house'],
  Info: ['regular', 'info'],
  Key: ['regular', 'key'],
  Lightbulb: ['regular', 'lightbulb'],
  LinkSimple: ['regular', 'link-simple'],
  ListPlus: ['regular', 'list-plus'],
  LockSimple: ['regular', 'lock-simple'],
  MagnifyingGlass: ['regular', 'magnifying-glass'],
  Monitor: ['regular', 'monitor'],
  MonitorFill: ['fill', 'monitor'],
  PencilSimple: ['regular', 'pencil-simple'],
  Play: ['regular', 'play'],
  PlugsConnected: ['regular', 'plugs-connected'],
  Plus: ['regular', 'plus'],
  Printer: ['regular', 'printer'],
  Question: ['regular', 'question'],
  QrCode: ['regular', 'qr-code'],
  SealCheck: ['regular', 'seal-check'],
  ShareNetwork: ['regular', 'share-network'],
  Sliders: ['regular', 'sliders'],
  Sparkle: ['regular', 'sparkle'],
  Square: ['regular', 'square'],
  Storefront: ['regular', 'storefront'],
  TrashSimple: ['regular', 'trash-simple'],
  TreeStructure: ['regular', 'tree-structure'],
  TreeStructureFill: ['fill', 'tree-structure'],
  Vault: ['regular', 'vault'],
  VaultFill: ['fill', 'vault'],
  VideoCamera: ['regular', 'video-camera'],
  Warning: ['regular', 'warning'],
  WarningCircle: ['regular', 'warning-circle'],
  WarningOctagon: ['regular', 'warning-octagon'],
  Wrench: ['regular', 'wrench'],
  X: ['regular', 'x'],
  XCircle: ['regular', 'x-circle'],
  XCircleFill: ['fill', 'x-circle'],
}

const funciones = []
for (const [nombre, [peso, archivo]] of Object.entries(ICONOS)) {
  const ruta = join(raiz, 'assets', peso, `${archivo}${peso === 'regular' ? '' : `-${peso}`}.svg`)
  const svg = readFileSync(ruta, 'utf8')
  const paths = [...svg.matchAll(/<path d="([^"]+)"\s*\/>/g)].map((m) => m[1])
  const resto = svg.replace(/<\/?svg[^>]*>/g, '').replace(/<path d="[^"]+"\s*\/>/g, '').trim()
  if (paths.length === 0 || resto !== '') {
    throw new Error(`SVG inesperado en ${ruta}: ${paths.length} paths, resto "${resto.slice(0, 80)}"`)
  }
  const cuerpo = paths.map((d) => `      <path d="${d}" />`).join('\n')
  funciones.push(
    `export function ${nombre}(props: IconoProps) {\n  return (\n    <IconoBase {...props}>\n${cuerpo}\n    </IconoBase>\n  )\n}`,
  )
}

const encabezado = `import type { ReactNode, SVGProps } from 'react'

// Iconos del sistema Nocturne: el subconjunto de Phosphor Icons
// (https://phosphoricons.com, licencia MIT) que usa el rediseño,
// inlineado como componentes propios. Asi la app no carga la fuente
// de iconos desde un CDN (que romperia el modo offline) ni arrastra
// el paquete completo: solo los trazados que realmente se usan.
// Los nombres calcan los de Phosphor (el sufijo Fill es la variante
// rellena de la pestaña activa) para que el mapa de iconos de
// 08_ESTILO.md del proyecto de diseño se traduzca 1 a 1.
// Regenerable con @phosphor-icons/core instalado temporalmente
// (npm install --no-save, mismo patron que el icono de la app).

export type IconoProps = SVGProps<SVGSVGElement> & { size?: number }

function IconoBase({ size = 16, children, ...props }: IconoProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor" aria-hidden {...props}>
      {children}
    </svg>
  )
}
`

writeFileSync(salida, `${encabezado}\n${funciones.join('\n\n')}\n`)
console.log(`OK: ${Object.keys(ICONOS).length} iconos generados en ${salida}`)
