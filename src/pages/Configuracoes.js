import { useState } from 'react'
import { Settings, Sun, Moon, Palette, Check, User, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/client'

const CORES_DESTAQUE = [
  { label: 'Laranja',  h: 21,  s: '73%', l: '53%', hex: '#e06030' },
  { label: 'Vermelho', h: 0,   s: '72%', l: '51%', hex: '#e03030' },
  { label: 'Rosa',     h: 338, s: '75%', l: '55%', hex: '#e0306a' },
  { label: 'Roxo',     h: 262, s: '70%', l: '58%', hex: '#8b5cf6' },
  { label: 'Azul',     h: 217, s: '80%', l: '55%', hex: '#3b82f6' },
  { label: 'Ciano',    h: 188, s: '75%', l: '42%', hex: '#0e9cb5' },
  { label: 'Verde',    h: 152, s: '60%', l: '40%', hex: '#29a065' },
  { label: 'Amarelo',  h: 38,  s: '90%', l: '48%', hex: '#d4860a' },
]

function useToast() {
  const [toast, setToast] = useState(null)
  function show(msg, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3500) }
  return [toast, show]
}

export default function Configuracoes({ tema, corDestaque, onTemaChange, onCorChange }) {
  const { usuario } = useAuth()
  const [toast, showToast] = useToast()

  // Troca de senha
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [showSenhaAtual, setShowSenhaAtual] = useState(false)
  const [showSenhaNova, setShowSenhaNova] = useState(false)
  const [showSenhaConfirm, setShowSenhaConfirm] = useState(false)
  const [salvandoSenha, setSalvandoSenha] = useState(false)

  async function trocarSenha() {
    if (!senhaNova || senhaNova.length < 6) { showToast('A nova senha deve ter pelo menos 6 caracteres.', 'error'); return }
    if (senhaNova !== senhaConfirm) { showToast('As senhas não coincidem.', 'error'); return }
    setSalvandoSenha(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senhaNova })
      if (error) throw error
      showToast('Senha alterada com sucesso!')
      setSenhaAtual(''); setSenhaNova(''); setSenhaConfirm('')
    } catch (e) {
      showToast('Erro ao alterar senha: ' + (e?.message || 'Tente novamente.'), 'error')
    } finally { setSalvandoSenha(false) }
  }

  const cardStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 560, marginBottom: 20 }
  const secaoLabel = { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Settings size={22} color="var(--accent)" />
        <h1 className="page-title" style={{ margin: 0 }}>Configurações</h1>
      </div>

      {/* Perfil */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <User size={16} color="var(--accent)" />
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Perfil</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <p style={secaoLabel}>Nome</p>
            <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{usuario?.nome || '—'}</p>
          </div>
          <div>
            <p style={secaoLabel}>E-mail</p>
            <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{usuario?.email || '—'}</p>
          </div>
          <div>
            <p style={secaoLabel}>Perfil de acesso</p>
            <p style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600, textTransform: 'capitalize' }}>{usuario?.perfil?.replace(/_/g, ' ') || '—'}</p>
          </div>
        </div>
      </div>

      {/* Troca de senha */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Lock size={16} color="var(--accent)" />
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Alterar senha</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Nova senha', value: senhaNova, set: setSenhaNova, show: showSenhaNova, setShow: setShowSenhaNova },
            { label: 'Confirmar nova senha', value: senhaConfirm, set: setSenhaConfirm, show: showSenhaConfirm, setShow: setShowSenhaConfirm },
          ].map(({ label, value, set, show, setShow }) => (
            <div key={label} className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{label}</label>
              <div style={{ position: 'relative' }}>
                <input className="form-input" type={show ? 'text' : 'password'} value={value}
                  onChange={e => set(e.target.value)} placeholder="••••••••"
                  style={{ paddingRight: 40 }} />
                <button onClick={() => setShow(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ))}
          <button className="btn btn-primary" onClick={trocarSenha} disabled={salvandoSenha || !senhaNova || !senhaConfirm}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}>
            {salvandoSenha ? 'Salvando...' : 'Alterar senha'}
          </button>
        </div>
      </div>

      {/* Aparência */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Palette size={16} color="var(--accent)" />
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Aparência</h2>
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={secaoLabel}>Tema</p>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { value: 'light', label: 'Claro', Icon: Sun },
              { value: 'dark',  label: 'Escuro', Icon: Moon },
            ].map(({ value, label, Icon }) => {
              const ativo = tema === value
              return (
                <button key={value} onClick={() => onTemaChange(value)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '16px 28px', borderRadius: 10, border: `2px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`, background: ativo ? 'var(--accent-glow)' : 'var(--surface-2)', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <Icon size={20} color={ativo ? 'var(--accent)' : 'var(--text-muted)'} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: ativo ? 'var(--accent)' : 'var(--text-muted)' }}>{label}</span>
                  {ativo && <Check size={13} color="var(--accent)" />}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p style={secaoLabel}>Cor de destaque</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {CORES_DESTAQUE.map(cor => {
              const ativo = corDestaque === cor.hex
              return (
                <button key={cor.hex} onClick={() => onCorChange(cor)} title={cor.label} style={{ width: 36, height: 36, borderRadius: '50%', background: cor.hex, border: ativo ? '3px solid var(--text)' : '3px solid transparent', outline: ativo ? `3px solid ${cor.hex}` : 'none', outlineOffset: 2, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {ativo && <Check size={16} color="#fff" strokeWidth={3} />}
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
            Cor selecionada: <strong style={{ color: 'var(--accent)' }}>{CORES_DESTAQUE.find(c => c.hex === corDestaque)?.label || 'Laranja'}</strong>
          </p>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <p style={secaoLabel}>Preview</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>Botão principal</button>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }}>Botão secundário</button>
            <span className="badge badge-accent">Badge</span>
            <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>Texto destaque</span>
          </div>
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
