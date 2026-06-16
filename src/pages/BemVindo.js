import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function BemVindo({ menu = [] }) {
  const { usuario } = useAuth()
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const primeiroNome = usuario?.nome?.split(' ')[0] || ''

  // Atalhos = abas que o usuário realmente acessa (menos a própria tela inicial)
  const atalhos = (menu || []).filter(m => m.path !== '/')

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '32px 0' }}>
      {/* Cabeçalho */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 4, lineHeight: 1 }}>🪐</div>
        <h1 className="page-title" style={{ margin: 0, fontSize: 30 }}>
          {saudacao}{primeiroNome ? `, ${primeiroNome}` : ''} 👋
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, marginTop: 10 }}>
          Bem-vindo(a) ao Órbita MKT. Escolha por onde começar ou use o menu ao lado.
        </p>
      </div>

      {/* Atalhos */}
      {atalhos.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
          gap: 14,
        }}>
          {atalhos.map(({ path, label, icon: Icon }) => (
            <Link key={path} to={path} style={{ textDecoration: 'none' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '16px 18px', borderRadius: 12,
                  border: '1px solid var(--border, #e5e7eb)',
                  background: 'var(--surface)',
                  transition: 'transform .15s, border-color .15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border, #e5e7eb)'
                  e.currentTarget.style.transform = 'none'
                }}
              >
                {Icon && <Icon size={20} color="var(--accent)" />}
                <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>{label}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
