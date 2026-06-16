import { useEffect, useState } from 'react'
import { getUsuarios, updateUsuario } from '../lib/supabase'
import { useAuth, PERFIL_GRUPO } from '../context/AuthContext'
import { ShieldCheck, Settings2, X } from 'lucide-react'

// Todas as abas do Órbita que podem ser concedidas como acesso extra.
// As abas de gestão de acesso (Usuários e a própria Acessos da Equipe) ficam
// de fora de propósito, para um supervisor não conseguir criar outros gestores.
const ABAS_CONCEDIVEIS = [
  { value: 'dashboard',        label: 'Dashboard' },
  { value: 'crm_influencers',  label: 'CRM Influencers' },
  { value: 'crm_parceiras',    label: 'CRM Parceiras' },
  { value: 'cortesias',        label: 'Cortesias' },
  { value: 'campanhas',        label: 'Campanhas' },
  { value: 'monitoramento',    label: 'Monitoramento' },
  { value: 'lancamentos',      label: 'Lançamentos' },
  { value: 'tarefas',          label: 'Tarefas' },
  { value: 'tarefas_parceiras',label: 'Tarefas Parceiras' },
  { value: 'eventos',          label: 'Eventos' },
  { value: 'treinamentos',     label: 'Treinamentos' },
  { value: 'pda',              label: 'PDA' },
  { value: 'rh',               label: 'RH' },
  { value: 'parceiros',        label: 'Vitrine' },
]

const NOME_GRUPO = {
  parceiras: 'Parceiras',
  influencers: 'Influencers',
  marketplaces: 'Mkt & Eventos',
  proprias: 'Próprias',
}

function ModalAbas({ membro, onSave, onClose }) {
  const [selecionadas, setSelecionadas] = useState(membro.abas_extras || [])
  const [saving, setSaving] = useState(false)

  function toggle(value) {
    setSelecionadas(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    )
  }

  async function salvar() {
    setSaving(true)
    try { await onSave(membro.id, selecionadas) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Abas liberadas — {membro.nome?.split(' ')[0]}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          Marque as abas que esta pessoa poderá acessar, além do que o perfil dela já permite.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {ABAS_CONCEDIVEIS.map(aba => {
            const ativo = selecionadas.includes(aba.value)
            return (
              <label key={aba.value} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                background: ativo ? 'var(--accent-glow)' : 'var(--surface-2)',
                border: `1px solid ${ativo ? 'var(--accent)' : 'var(--border)'}`,
                transition: 'all 0.15s',
              }}>
                <input type="checkbox" checked={ativo} onChange={() => toggle(aba.value)}
                  style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                <span style={{ fontSize: 13, fontWeight: ativo ? 600 : 400,
                  color: ativo ? 'var(--accent)' : 'var(--text)' }}>
                  {aba.label}
                </span>
              </label>
            )
          })}
        </div>
        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AcessosEquipe() {
  const { usuario } = useAuth()
  const [membros, setMembros] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')

  // Escopo: a equipe do supervisor logado. Admin/gerente caem em Parceiras por padrão.
  const meuGrupo = PERFIL_GRUPO[usuario?.perfil]
  const grupoAlvo = (meuGrupo && meuGrupo !== 'admin') ? meuGrupo : 'parceiras'

  async function carregar() {
    setLoading(true)
    try {
      const todos = await getUsuarios()
      setMembros((todos || []).filter(u => PERFIL_GRUPO[u.perfil] === grupoAlvo))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [grupoAlvo]) // eslint-disable-line

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function handleSalvar(userId, abas) {
    try {
      const upd = await updateUsuario(userId, { abas_extras: abas })
      setMembros(prev => prev.map(u => u.id === userId ? { ...u, abas_extras: upd.abas_extras } : u))
      setModal(null)
      showToast('Abas atualizadas!')
    } catch (e) {
      console.error(e)
      showToast('Não foi possível salvar. Verifique suas permissões.')
    }
  }

  if (loading) return <div className="loading"><div className="spinner" /></div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
        <ShieldCheck size={22} color="var(--accent)" />
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Acessos da Equipe</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Equipe {NOME_GRUPO[grupoAlvo] || grupoAlvo} · {membros.length} {membros.length === 1 ? 'pessoa' : 'pessoas'}
          </p>
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 620, marginBottom: 24 }}>
        Aqui você decide quais abas cada pessoa da sua equipe pode acessar.
      </p>

      {/* Lista */}
      {membros.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Nenhuma pessoa encontrada na sua equipe.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 620 }}>
          {membros.map(m => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderRadius: 12,
              border: '1px solid var(--border, #e5e7eb)', background: 'var(--surface)',
            }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{m.nome}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {(m.abas_extras?.length || 0) === 0
                    ? 'Nenhuma aba extra'
                    : `${m.abas_extras.length} aba${m.abas_extras.length !== 1 ? 's' : ''} extra${m.abas_extras.length !== 1 ? 's' : ''}`}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setModal(m)}>
                <Settings2 size={14} /> Gerenciar abas
              </button>
            </div>
          ))}
        </div>
      )}

      {modal && <ModalAbas membro={modal} onSave={handleSalvar} onClose={() => setModal(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
