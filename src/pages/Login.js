import { useState } from 'react'
import { signIn, resetPassword } from '../lib/supabase'
import { Orbit, Eye, EyeOff, Mail, Lock } from 'lucide-react'

export default function Login() {
  const [modo, setModo]         = useState('login') // 'login' | 'forgot' | 'enviado'
  const [email, setEmail]       = useState('')
  const [senha, setSenha]       = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [erro, setErro]         = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    if (!email.trim() || !senha.trim()) return
    setErro(''); setLoading(true)
    try {
      await signIn(email.trim(), senha)
    } catch(err) {
      setErro('E-mail ou senha incorretos. Verifique seus dados.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    if (!email.trim()) return
    setErro(''); setLoading(true)
    try {
      await resetPassword(email.trim())
      setModo('enviado')
    } catch(err) {
      setErro('Não foi possível enviar o e-mail. Verifique o endereço informado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg)', padding:'20px'
    }}>
      <div style={{
        width:'100%', maxWidth:400,
        background:'var(--surface)', border:'1px solid var(--border)',
        borderRadius:16, padding:'40px 36px',
        boxShadow:'0 24px 64px rgba(0,0,0,0.4)'
      }}>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:32}}>
          <div style={{
            width:44,height:44,borderRadius:12,
            background:'var(--accent-glow)',border:'1px solid rgba(224,96,48,0.3)',
            display:'flex',alignItems:'center',justifyContent:'center'
          }}>
            <Orbit size={22} color="var(--accent)" strokeWidth={1.5}/>
          </div>
          <div>
            <div style={{fontSize:18,fontWeight:800,color:'var(--text)'}}>Orbita MKT</div>
            <div style={{fontSize:12,color:'var(--accent)',fontWeight:600}}>CEDET</div>
          </div>
        </div>

        {/* ── LOGIN ── */}
        {modo === 'login' && (
          <>
            <div style={{marginBottom:28}}>
              <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',margin:0,marginBottom:4}}>
                Bem-vindo
              </h1>
              <p style={{fontSize:13,color:'var(--text-muted)',margin:0}}>
                Entre com suas credenciais para acessar
              </p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="form-group" style={{marginBottom:16}}>
                <label className="form-label">E-mail</label>
                <div style={{position:'relative'}}>
                  <Mail size={15} color="var(--text-muted)" style={{
                    position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'
                  }}/>
                  <input
                    className="form-input"
                    type="email"
                    value={email}
                    onChange={e=>{ setEmail(e.target.value); setErro('') }}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    style={{paddingLeft:36}}
                  />
                </div>
              </div>

              <div className="form-group" style={{marginBottom:8}}>
                <label className="form-label">Senha</label>
                <div style={{position:'relative'}}>
                  <Lock size={15} color="var(--text-muted)" style={{
                    position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'
                  }}/>
                  <input
                    className="form-input"
                    type={mostrarSenha ? 'text' : 'password'}
                    value={senha}
                    onChange={e=>{ setSenha(e.target.value); setErro('') }}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    style={{paddingLeft:36,paddingRight:40}}
                  />
                  <button type="button"
                    onClick={()=>setMostrarSenha(p=>!p)}
                    style={{
                      position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                      background:'none',border:'none',cursor:'pointer',
                      color:'var(--text-muted)',display:'flex',padding:4
                    }}>
                    {mostrarSenha ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>

              {/* Esqueci minha senha */}
              <div style={{textAlign:'right',marginBottom:20}}>
                <button type="button"
                  onClick={()=>{ setModo('forgot'); setErro('') }}
                  style={{
                    background:'none',border:'none',cursor:'pointer',
                    fontSize:12,color:'var(--accent)',fontWeight:600,padding:0
                  }}>
                  Esqueci minha senha
                </button>
              </div>

              {erro && (
                <div style={{
                  background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',
                  borderRadius:8,padding:'10px 14px',fontSize:13,color:'#ef4444',marginBottom:16
                }}>
                  {erro}
                </div>
              )}

              <button type="submit" className="btn btn-primary"
                disabled={loading||!email.trim()||!senha.trim()}
                style={{width:'100%',justifyContent:'center',height:42,fontSize:14}}>
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          </>
        )}

        {/* ── ESQUECI MINHA SENHA ── */}
        {modo === 'forgot' && (
          <>
            <div style={{marginBottom:28}}>
              <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',margin:0,marginBottom:4}}>
                Recuperar senha
              </h1>
              <p style={{fontSize:13,color:'var(--text-muted)',margin:0}}>
                Digite seu e-mail e enviaremos um link para redefinir sua senha.
              </p>
            </div>

            <form onSubmit={handleForgot}>
              <div className="form-group" style={{marginBottom:20}}>
                <label className="form-label">E-mail</label>
                <div style={{position:'relative'}}>
                  <Mail size={15} color="var(--text-muted)" style={{
                    position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'
                  }}/>
                  <input
                    className="form-input"
                    type="email"
                    value={email}
                    onChange={e=>{ setEmail(e.target.value); setErro('') }}
                    placeholder="seu@email.com"
                    autoComplete="email"
                    style={{paddingLeft:36}}
                    autoFocus
                  />
                </div>
              </div>

              {erro && (
                <div style={{
                  background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',
                  borderRadius:8,padding:'10px 14px',fontSize:13,color:'#ef4444',marginBottom:16
                }}>
                  {erro}
                </div>
              )}

              <button type="submit" className="btn btn-primary"
                disabled={loading||!email.trim()}
                style={{width:'100%',justifyContent:'center',height:42,fontSize:14,marginBottom:12}}>
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>

              <button type="button"
                onClick={()=>{ setModo('login'); setErro('') }}
                style={{
                  width:'100%',background:'none',border:'none',cursor:'pointer',
                  fontSize:13,color:'var(--text-muted)',padding:'8px 0'
                }}>
                ← Voltar para o login
              </button>
            </form>
          </>
        )}

        {/* ── E-MAIL ENVIADO ── */}
        {modo === 'enviado' && (
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:48,marginBottom:16}}>📧</div>
            <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',margin:0,marginBottom:8}}>
              E-mail enviado!
            </h1>
            <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:24,lineHeight:1.6}}>
              Enviamos um link de recuperação para<br/>
              <strong style={{color:'var(--text)'}}>{email}</strong>.<br/>
              Verifique sua caixa de entrada e o spam.
            </p>
            <button
              onClick={()=>{ setModo('login'); setSenha(''); setErro('') }}
              className="btn btn-primary"
              style={{width:'100%',justifyContent:'center',height:42,fontSize:14}}>
              Voltar para o login
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
