import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Orbit, Eye, EyeOff, CheckCircle, Loader2, AlertCircle } from 'lucide-react'

export default function ResetPassword() {
  const [senha, setSenha]         = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mostrar, setMostrar]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [erro, setErro]           = useState('')
  const [concluido, setConcluido] = useState(false)

  // Estados da sessão
  const [sessaoOk, setSessaoOk]       = useState(false)
  const [sessaoErro, setSessaoErro]   = useState('')
  const [verificando, setVerificando] = useState(true)

  useEffect(() => {
    let subscription = null

    async function inicializar() {
      setVerificando(true)

      // ── Fluxo PKCE: link de convite/reset chega com ?code= na URL ──
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error && data?.session) {
          setSessaoOk(true)
        } else {
          setSessaoErro('Link inválido ou expirado. Solicite um novo link de acesso.')
        }
        setVerificando(false)
        return
      }

      // ── Fluxo implícito: tokens no hash da URL (legado) ──
      const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (
            (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') &&
            session
          ) {
            setSessaoOk(true)
            setVerificando(false)
          }
        }
      )
      subscription = sub

      // Verifica se já há sessão ativa (ex: usuário recarregou a página)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setSessaoOk(true)
        setVerificando(false)
        return
      }

      // Se nenhum indicador de token na URL e sem sessão, link inválido
      const temHash = window.location.hash.includes('access_token')
      if (!temHash) {
        setSessaoErro('Link inválido ou expirado. Solicite um novo link de acesso.')
        setVerificando(false)
      }
    }

    inicializar()

    // Timeout de segurança: se após 5s nada resolver, exibe erro
    const timeout = setTimeout(() => {
      setVerificando(prev => {
        if (prev) {
          setSessaoErro('Tempo esgotado ao verificar o link. Solicite um novo link de acesso.')
          return false
        }
        return prev
      })
    }, 5000)

    return () => {
      subscription?.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  async function handleReset(e) {
    e.preventDefault()
    if (!sessaoOk) return
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return }
    if (senha.length < 6)   { setErro('A senha deve ter pelo menos 6 caracteres.'); return }

    setErro('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      setConcluido(true)
      setTimeout(() => { window.location.href = '/' }, 3000)
    } catch {
      setErro('Não foi possível redefinir a senha. O link pode ter expirado — solicite um novo.')
    } finally {
      setLoading(false)
    }
  }

  const forca = !senha.length ? 0
    : senha.length < 6  ? 1
    : senha.length < 8  ? 2
    : senha.length < 10 ? 3 : 4

  const forcaLabel = ['', 'Senha muito curta', 'Senha fraca', 'Senha boa', 'Senha forte'][forca]
  const forcaCores = ['var(--border)', '#ef4444', '#f97316', '#eab308', '#22c55e']

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: '40px 36px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'var(--accent-glow)', border: '1px solid rgba(224,96,48,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Orbit size={22} color="var(--accent)" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Orbita MKT</div>
            <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>CEDET</div>
          </div>
        </div>

        {/* ── Verificando sessão ── */}
        {verificando && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Loader2 size={32} color="var(--accent)"
              style={{ animation: 'spin 1s linear infinite', marginBottom: 16 }} />
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>
              Verificando seu link de acesso...
            </p>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {/* ── Link inválido / expirado ── */}
        {!verificando && sessaoErro && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <AlertCircle size={28} color="#ef4444" />
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px' }}>
              Link inválido
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 24px' }}>
              {sessaoErro}
            </p>
            <a href="/login" style={{
              display: 'inline-block',
              background: 'var(--accent)', color: 'white',
              padding: '10px 24px', borderRadius: 8,
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
            }}>
              Ir para o login
            </a>
          </div>
        )}

        {/* ── Senha redefinida com sucesso ── */}
        {!verificando && !sessaoErro && concluido && (
          <div style={{ textAlign: 'center' }}>
            <CheckCircle size={48} color="#22c55e" style={{ marginBottom: 16 }} />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
              Senha criada!
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Sua senha foi definida com sucesso.<br />
              Você será redirecionado para o login em instantes...
            </p>
          </div>
        )}

        {/* ── Formulário ── */}
        {!verificando && !sessaoErro && !concluido && sessaoOk && (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
                Nova senha
              </h1>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                Digite e confirme sua nova senha de acesso.
              </p>
            </div>

            <form onSubmit={handleReset}>
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Nova senha</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="form-input"
                    type={mostrar ? 'text' : 'password'}
                    value={senha}
                    onChange={e => { setSenha(e.target.value); setErro('') }}
                    placeholder="Mínimo 6 caracteres"
                    autoFocus
                    style={{ paddingRight: 40 }}
                  />
                  <button type="button" onClick={() => setMostrar(p => !p)}
                    style={{
                      position: 'absolute', right: 10, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', display: 'flex', padding: 4,
                    }}>
                    {mostrar ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 20 }}>
                <label className="form-label">Confirmar senha</label>
                <input
                  className="form-input"
                  type={mostrar ? 'text' : 'password'}
                  value={confirmar}
                  onChange={e => { setConfirmar(e.target.value); setErro('') }}
                  placeholder="Digite a senha novamente"
                />
              </div>

              {/* Indicador de força */}
              {senha.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4].map(n => (
                      <div key={n} style={{
                        flex: 1, height: 3, borderRadius: 99,
                        background: forca >= n ? forcaCores[forca] : 'var(--border)',
                        transition: 'background 0.2s',
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{forcaLabel}</div>
                </div>
              )}

              {erro && (
                <div style={{
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8, padding: '10px 14px',
                  fontSize: 13, color: '#ef4444', marginBottom: 16,
                }}>
                  {erro}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !senha || !confirmar || forca < 2}
                style={{ width: '100%', justifyContent: 'center', height: 42, fontSize: 14 }}
              >
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
