import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Orbit, Eye, EyeOff, CheckCircle } from 'lucide-react'

export default function ResetPassword() {
  const [senha, setSenha]             = useState('')
  const [confirmar, setConfirmar]     = useState('')
  const [mostrar, setMostrar]         = useState(false)
  const [loading, setLoading]         = useState(false)
  const [erro, setErro]               = useState('')
  const [concluido, setConcluido]     = useState(false)
  const [sessaoOk, setSessaoOk]       = useState(false)

  // O Supabase injeta o token na URL — precisa capturar a sessão
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setSessaoOk(true)
    })
  }, [])
  useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) setSessaoOk(true)
  })
}, [])

  async function handleReset(e) {
    e.preventDefault()
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return }
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    setErro(''); setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) throw error
      setConcluido(true)
      // Redireciona para login após 3 segundos
      setTimeout(() => { window.location.href = '/' }, 3000)
    } catch(err) {
      setErro('Não foi possível redefinir a senha. Tente solicitar um novo link.')
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

        {concluido ? (
          <div style={{textAlign:'center'}}>
            <CheckCircle size={48} color="#22c55e" style={{marginBottom:16}}/>
            <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',margin:0,marginBottom:8}}>
              Senha redefinida!
            </h1>
            <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:0,lineHeight:1.6}}>
              Sua senha foi atualizada com sucesso.<br/>
              Você será redirecionado para o login em instantes...
            </p>
          </div>
        ) : (
          <>
            <div style={{marginBottom:28}}>
              <h1 style={{fontSize:20,fontWeight:700,color:'var(--text)',margin:0,marginBottom:4}}>
                Nova senha
              </h1>
              <p style={{fontSize:13,color:'var(--text-muted)',margin:0}}>
                Digite e confirme sua nova senha de acesso.
              </p>
            </div>

            <form onSubmit={handleReset}>
              <div className="form-group" style={{marginBottom:16}}>
                <label className="form-label">Nova senha</label>
                <div style={{position:'relative'}}>
                  <input
                    className="form-input"
                    type={mostrar ? 'text' : 'password'}
                    value={senha}
                    onChange={e=>{ setSenha(e.target.value); setErro('') }}
                    placeholder="Mínimo 6 caracteres"
                    autoFocus
                    style={{paddingRight:40}}
                  />
                  <button type="button" onClick={()=>setMostrar(p=>!p)}
                    style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',
                      background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',display:'flex',padding:4}}>
                    {mostrar ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{marginBottom:20}}>
                <label className="form-label">Confirmar senha</label>
                <input
                  className="form-input"
                  type={mostrar ? 'text' : 'password'}
                  value={confirmar}
                  onChange={e=>{ setConfirmar(e.target.value); setErro('') }}
                  placeholder="Digite a senha novamente"
                />
              </div>

              {/* Indicador de força */}
              {senha.length > 0 && (
                <div style={{marginBottom:16}}>
                  <div style={{display:'flex',gap:4,marginBottom:4}}>
                    {[1,2,3,4].map(n=>(
                      <div key={n} style={{
                        flex:1,height:3,borderRadius:99,
                        background: senha.length >= n*2
                          ? n<=2 ? '#ef4444' : n===3 ? '#f97316' : '#22c55e'
                          : 'var(--border)'
                      }}/>
                    ))}
                  </div>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>
                    {senha.length < 6 ? 'Senha muito curta' : senha.length < 8 ? 'Senha fraca' : senha.length < 10 ? 'Senha boa' : 'Senha forte'}
                  </div>
                </div>
              )}

              {erro && (
                <div style={{
                  background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',
                  borderRadius:8,padding:'10px 14px',fontSize:13,color:'#ef4444',marginBottom:16
                }}>
                  {erro}
                </div>
              )}

              <button type="submit" className="btn btn-primary"
                disabled={loading||!senha||!confirmar}
                style={{width:'100%',justifyContent:'center',height:42,fontSize:14}}>
                {loading ? 'Salvando...' : 'Redefinir senha'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
