// src/components/crm/BadgeTier.js
// Badge visual do tier da Escada de Crescimento
// Uso: <BadgeTier tier="bronze" /> ou <BadgeTier tier="prata" size="lg" />

import { TIERS } from '../../lib/supabase'
import { ArrowUp } from 'lucide-react'

const SIZES = {
  sm: { padding: '2px 8px',  fontSize: 10, gap: 4, iconSize: 10 },
  md: { padding: '3px 12px', fontSize: 12, gap: 5, iconSize: 12 },
  lg: { padding: '5px 16px', fontSize: 13, gap: 6, iconSize: 14 },
}

export default function BadgeTier({ tier, size = 'md', prontoParaSubir = false }) {
  if (!tier || !TIERS[tier]) {
    return (
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Sem tier
      </span>
    )
  }

  const t = TIERS[tier]
  const s = SIZES[size] || SIZES.md

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: s.gap,
      background: t.bg,
      border: `1px solid ${t.border}`,
      borderRadius: 20,
      padding: s.padding,
      fontSize: s.fontSize,
      fontWeight: 700,
      color: t.cor,
      whiteSpace: 'nowrap',
      transition: 'all 0.15s',
    }}>
      {t.label}
      {prontoParaSubir && (
        <ArrowUp
          size={s.iconSize}
          style={{
            color: '#22c55e',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      )}
    </span>
  )
}

// Badge de situação (Ativo / Pausado / Encerrado)
export function BadgeSituacao({ situacao }) {
  const map = {
    ativo:     { label: 'Ativo',     cor: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
    pausado:   { label: 'Pausado',   cor: '#eab308', bg: 'rgba(234,179,8,0.12)' },
    encerrado: { label: 'Encerrado', cor: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  }
  const s = map[situacao] || map.ativo

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 20,
      color: s.cor,
      background: s.bg,
      border: `1px solid ${s.cor}30`,
    }}>
      {s.label}
    </span>
  )
}

// Barra de progresso até o próximo tier
export function ProgressoTier({ parceiro }) {
  const { tier, vendas_total, vendas_mes } = parceiro
  if (!tier || !TIERS[tier]) return null

  const tierInfo = TIERS[tier]
  if (!tierInfo.proximoTier) {
    return (
      <span style={{ fontSize: 11, color: TIERS.ouro.cor, fontWeight: 600 }}>
        Tier máximo
      </span>
    )
  }

  let progresso = 0
  let label = ''

  if (tier === 'bronze') {
    progresso = Math.min(100, Math.round(((vendas_total || 0) / 10) * 100))
    label = `${vendas_total || 0}/10 vendas`
  } else if (tier === 'prata') {
    progresso = Math.min(100, Math.round(((vendas_mes || 0) / 30) * 100))
    label = `${vendas_mes || 0}/30 vendas/mês`
  }

  const corBarra = progresso >= 100 ? '#22c55e' : TIERS[tierInfo.proximoTier].cor

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{
        flex: 1,
        height: 6,
        background: 'var(--surface-2)',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        <div style={{
          width: `${progresso}%`,
          height: '100%',
          background: corBarra,
          borderRadius: 3,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  )
}
