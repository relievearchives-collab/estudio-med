import { useEffect, useMemo } from 'react'

/** URL temporal de un Blob (se libera sola). */
export function useUrlBlob(b?: Blob) {
  const url = useMemo(() => (b ? URL.createObjectURL(b) : ''), [b])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return url
}
