import { useState } from 'react'
import { signIn } from '../lib/supabase'
import { Orbit } from 'lucide-react'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [senha, setSenha]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [erro, setErro]         = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setErro('')
    setLoading(true)
    try {
      await signIn(email, senha)
      // AuthContext detecta automaticamente e redireciona
    } catch (err) {
      setErro('E-mail ou senha incorretos. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">
            <Orbit size={22} strokeWidth={1.5} />
          </div>
          <div className="login-brand-text">
            <div className="login-brand-name">Orbita MKT</div>
            <div className="login-brand-sub">CEDET</div>
          </div>
        </div>

        <h1 className="login-title">Bem-vinda de volta</h1>
        <p className="login-subtitle">Entre com seu e-mail e senha para acessar o sistema.</p>

        {erro && <div className="login-error">{erro}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">E-mail</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">Senha</label>
              <input
                className="form-input"
                type="password"
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
              disabled={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
