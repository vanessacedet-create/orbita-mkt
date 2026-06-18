import { Settings, Sun, Moon, Palette, Check } from 'lucide-react'

// ── Cores de destaque disponíveis ──────────────────────────
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

export default function Configuracoes({ tema, corDestaque, onTemaChange, onCorChange }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Settings size={22} color="var(--accent)" />
        <h1 className="page-title" style={{ margin: 0 }}>Configurações</h1>
      </div>

      {/* Aparência */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <Palette size={16} color="var(--accent)" />
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Aparência</h2>
        </div>

        {/* Tema */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>Tema</p>
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

        {/* Cor de destaque */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 10 }}>Cor de destaque</p>
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

        {/* Preview */}
        <div style={{ marginTop: 24, padding: 16, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12 }}>Preview</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>Botão principal</button>
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 14px' }}>Botão secundário</button>
            <span className="badge badge-accent">Badge</span>
            <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>Texto destaque</span>
          </div>
        </div>
      </div>
    </div>
  )
}
