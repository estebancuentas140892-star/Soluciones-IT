import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { cachearSiHaceFalta, obtenerUrlOffline } from '../lib/adjuntosOffline'

const UNA_HORA = 60 * 60

// Resuelve la URL para mostrar un archivo de Supabase Storage a
// partir de su referencia. Si ya se descargo para offline se sirve
// desde el telefono sin tocar la red; si no, se pide una URL firmada
// (requiere conexion) y de paso se guarda para la proxima vez. Lo
// usan la galeria de adjuntos y las capturas de los pasos.
export function useUrlAdjunto(referencia: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    setUrl(null)
    if (!referencia) return

    let vigente = true
    let urlLocal: string | null = null

    async function cargar(ref: string) {
      const offline = await obtenerUrlOffline(ref)
      if (!vigente) return
      if (offline) {
        urlLocal = offline
        setUrl(offline)
        return
      }
      if (!supabase) return
      const { data } = await supabase.storage.from('adjuntos').createSignedUrl(ref, UNA_HORA)
      if (!vigente) return
      if (data) {
        setUrl(data.signedUrl)
        void cachearSiHaceFalta(ref, data.signedUrl)
      }
    }
    void cargar(referencia)

    return () => {
      vigente = false
      if (urlLocal) URL.revokeObjectURL(urlLocal)
    }
  }, [referencia])

  return url
}
