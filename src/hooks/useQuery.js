import { useState, useEffect, useCallback, useRef } from 'react'

// Hook para buscar dados do Supabase com estado padronizado de loading/error.
// Elimina o padrão repetido de useEffect + setState espalhado pelas páginas.
//
// Uso básico:
//   const { data, loading, error, reload } = useQuery(() => getParceiros())
//
// Com dependências (re-executa quando mudam):
//   const { data } = useQuery(() => getCampanhas(), [filtro])
//
// Com valor inicial:
//   const { data: parceiros } = useQuery(() => getParceiros(), [], [])
//
export function useQuery(fn, deps = [], initialData = null) {
  const [data, setData]       = useState(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const mountedRef = useRef(true)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn()
      if (mountedRef.current) setData(result)
    } catch (err) {
      if (mountedRef.current) setError(err?.message || 'Erro ao carregar dados')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    execute()
    return () => { mountedRef.current = false }
  }, [execute])

  return { data, loading, error, reload: execute, setData }
}

// Versão para mutations (create, update, delete) — não executa automaticamente.
//
// Uso:
//   const { execute: salvar, loading, error } = useMutation(
//     (payload) => createParceiro(payload),
//     { onSuccess: (data) => setParceiros(p => [...p, data]) }
//   )
//   <button onClick={() => salvar(formData)}>Salvar</button>
//
export function useMutation(fn, { onSuccess, onError } = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const execute = useCallback(async (...args) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fn(...args)
      onSuccess?.(result)
      return result
    } catch (err) {
      const msg = err?.message || 'Ocorreu um erro'
      setError(msg)
      onError?.(msg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [fn, onSuccess, onError])

  return { execute, loading, error }
}
