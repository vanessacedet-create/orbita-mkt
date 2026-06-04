import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  RefreshCw,
  Users,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Crown,
  Clock,
  Activity,
} from 'lucide-react'

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const number = new Intl.NumberFormat('pt-BR')

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'R$ 0,00'
  }

  return currency.format(Number(value))
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0'
  }

  return number.format(Number(value))
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0%'
  }

  return `${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleDateString('pt-BR')
}

function Card({ title, value, subtitle, icon: Icon }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        background: 'var(--surface, #111827)',
        borderRadius: 16,
        padding: 18,
        minHeight: 112,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{title}</span>

        {Icon && (
          <span
            style={{
              width: 34,
              height: 34,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              background: 'rgba(255,255,255,.05)',
              border: '1px solid var(--border)',
            }}
          >
            <Icon size={17} />
          </span>
        )}
      </div>

      <div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.02em' }}>
          {value}
        </div>

        {subtitle && (
          <div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>
            {subtitle}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, description, children, action }) {
  return (
    <section
      style={{
        border: '1px solid var(--border)',
        background: 'var(--surface, #111827)',
        borderRadius: 16,
        padding: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'flex-start',
          marginBottom: 14,
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>

          {description && (
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {description}
            </p>
          )}
        </div>

        {action}
      </div>

      {children}
    </section>
  )
}

function SimpleBarChart({ data, labelKey, valueKey, valueFormatter = formatCurrency, maxItems = 8 }) {
  const rows = useMemo(() => {
    return (data || []).slice(0, maxItems)
  }, [data, maxItems])

  const max = useMemo(() => {
    return Math.max(...rows.map((item) => Number(item[valueKey]) || 0), 1)
  }, [rows, valueKey])

  if (!rows.length) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
        Nenhum dado encontrado.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rows.map((item, index) => {
        const value = Number(item[valueKey]) || 0
        const width = Math.max(4, Math.round((value / max) * 100))

        return (
          <div key={`${item[labelKey]}-${index}`}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: 13,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 260,
                }}
              >
                {item[labelKey] || 'Não informado'}
              </span>

              <strong>{valueFormatter(value)}</strong>
            </div>

            <div
              style={{
                height: 9,
                borderRadius: 999,
                background: 'rgba(255,255,255,.07)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${width}%`,
                  height: '100%',
                  borderRadius: 999,
                  background: 'var(--accent, #8b5cf6)',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Table({ columns, data, empty = 'Nenhum registro encontrado.' }) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 14 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: 'var(--surface-2, rgba(255,255,255,.04))' }}>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  textAlign: 'left',
                  padding: '11px 10px',
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  fontWeight: 700,
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {!data?.length ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: 22,
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                {empty}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr key={row.id || row.cliente_chave || index}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{
                      padding: '10px',
                      borderBottom: '1px solid var(--border)',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'middle',
                    }}
                  >
                    {column.render ? column.render(row) : row[column.key] || '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function CRMInteligencia() {
  const [loading, setLoading] = useState(true)
  const [recalculando, setRecalculando] = useState(false)
  const [erro, setErro] = useState('')
  const [toast, setToast] = useState('')

  const [kpis, setKpis] = useState(null)
  const [recompra, setRecompra] = useState(null)
  const [livrarias, setLivrarias] = useState([])
  const [estados, setEstados] = useState([])
  const [rfm, setRfm] = useState([])
  const [topClientes, setTopClientes] = useState([])
  const [clientesVip, setClientesVip] = useState([])
  const [clientesRisco, setClientesRisco] = useState([])
  const [clientesPerdidos, setClientesPerdidos] = useState([])

  function showToast(message) {
    setToast(message)
    setTimeout(() => setToast(''), 4000)
  }

  async function fetchData() {
    setLoading(true)
    setErro('')

    try {
      const [
        kpisRes,
        recompraRes,
        livrariasRes,
        estadosRes,
        rfmRes,
        topRes,
        vipRes,
        riscoRes,
        perdidosRes,
      ] = await Promise.all([
        supabase.from('vw_crm_kpis_executivos').select('*').single(),
        supabase.from('vw_crm_recompra').select('*').single(),
        supabase.from('vw_crm_receita_por_livraria').select('*').limit(10),
        supabase.from('vw_crm_receita_por_estado').select('*').limit(10),
        supabase.from('vw_crm_distribuicao_rfm').select('*').limit(12),
        supabase.from('vw_crm_top_100_clientes').select('*').limit(20),
        supabase.from('vw_crm_clientes_vip').select('*').limit(20),
        supabase.from('vw_crm_clientes_em_risco').select('*').limit(20),
        supabase.from('vw_crm_clientes_perdidos').select('*').limit(20),
      ])

      const responses = [
        kpisRes,
        recompraRes,
        livrariasRes,
        estadosRes,
        rfmRes,
        topRes,
        vipRes,
        riscoRes,
        perdidosRes,
      ]

      const firstError = responses.find((res) => res.error)?.error

      if (firstError) throw firstError

      setKpis(kpisRes.data)
      setRecompra(recompraRes.data)
      setLivrarias(livrariasRes.data || [])
      setEstados(estadosRes.data || [])
      setRfm(rfmRes.data || [])
      setTopClientes(topRes.data || [])
      setClientesVip(vipRes.data || [])
      setClientesRisco(riscoRes.data || [])
      setClientesPerdidos(perdidosRes.data || [])
    } catch (err) {
      setErro(err.message || 'Erro ao carregar dados do CRM.')
    } finally {
      setLoading(false)
    }
  }

  async function recalcularCRM() {
    setRecalculando(true)
    setErro('')

    try {
      const { error } = await supabase.rpc('rpc_crm_recalcular')

      if (error) throw error

      showToast('CRM recalculado com sucesso.')
      await fetchData()
    } catch (err) {
      setErro(err.message || 'Erro ao recalcular CRM.')
    } finally {
      setRecalculando(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const clienteColumns = [
    {
      key: 'nome',
      label: 'Cliente',
      render: (row) => row.nome || '—',
    },
    {
      key: 'email',
      label: 'E-mail',
      render: (row) => row.email || '—',
    },
    {
      key: 'estado',
      label: 'Estado',
      render: (row) => row.estado || '—',
    },
    {
      key: 'total_pedidos',
      label: 'Pedidos',
      render: (row) => formatNumber(row.total_pedidos),
    },
    {
      key: 'valor_total',
      label: 'Receita',
      render: (row) => formatCurrency(row.valor_total),
    },
    {
      key: 'ticket_medio',
      label: 'Ticket médio',
      render: (row) => formatCurrency(row.ticket_medio),
    },
    {
      key: 'ultima_compra',
      label: 'Última compra',
      render: (row) => formatDate(row.ultima_compra),
    },
    {
      key: 'status_cliente',
      label: 'Status',
      render: (row) => row.status_cliente || '—',
    },
    {
      key: 'segmento_rfm',
      label: 'RFM',
      render: (row) => row.segmento_rfm || '—',
    },
  ]

  return (
    <div className="page">
      {toast && (
        <div
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 9999,
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid var(--border)',
            background: 'rgba(22, 101, 52, 0.95)',
            color: '#fff',
            boxShadow: '0 12px 30px rgba(0,0,0,.25)',
            fontSize: 14,
          }}
        >
          {toast}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'flex-start',
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 6 }}>CRM Inteligência</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Visão estratégica de clientes, recompra, retenção, RFM e receita.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn-secondary" type="button" onClick={fetchData} disabled={loading}>
            <RefreshCw size={16} />
            Atualizar dados
          </button>

          <button className="btn-primary" type="button" onClick={recalcularCRM} disabled={recalculando}>
            <Activity size={16} />
            {recalculando ? 'Recalculando...' : 'Recalcular CRM'}
          </button>
        </div>
      </div>

      {erro && (
        <div
          style={{
            marginBottom: 18,
            padding: 14,
            borderRadius: 12,
            background: 'rgba(239, 68, 68, .12)',
            border: '1px solid rgba(239, 68, 68, .28)',
            color: '#fecaca',
            fontSize: 14,
          }}
        >
          {erro}
        </div>
      )}

      {loading ? (
        <div
          style={{
            padding: 24,
            border: '1px solid var(--border)',
            borderRadius: 16,
            color: 'var(--text-muted)',
          }}
        >
          Carregando inteligência de clientes...
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 14,
              marginBottom: 18,
            }}
          >
            <Card
              title="Total de clientes"
              value={formatNumber(kpis?.total_clientes)}
              subtitle="Clientes identificados por e-mail ou telefone"
              icon={Users}
            />

            <Card
              title="Clientes ativos"
              value={formatNumber(kpis?.clientes_ativos)}
              subtitle="Compraram nos últimos 60 dias"
              icon={TrendingUp}
            />

            <Card
              title="Clientes em risco"
              value={formatNumber(kpis?.clientes_em_risco)}
              subtitle="Sem compra entre 121 e 180 dias"
              icon={AlertTriangle}
            />

            <Card
              title="Clientes perdidos"
              value={formatNumber(kpis?.clientes_perdidos)}
              subtitle="Sem compra há mais de 180 dias"
              icon={Clock}
            />

            <Card
              title="Taxa de recompra"
              value={formatPercent(kpis?.taxa_recompra_percentual)}
              subtitle="Clientes com 2 ou mais compras"
              icon={ShoppingCart}
            />

            <Card
              title="Ticket médio"
              value={formatCurrency(kpis?.ticket_medio)}
              subtitle="Média por cliente consolidado"
              icon={DollarSign}
            />

            <Card
              title="LTV médio"
              value={formatCurrency(kpis?.ltv_medio)}
              subtitle="Valor médio acumulado por cliente"
              icon={Crown}
            />

            <Card
              title="Receita total"
              value={formatCurrency(kpis?.receita_total)}
              subtitle="Receita consolidada na base CRM"
              icon={DollarSign}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 14,
              marginBottom: 18,
            }}
          >
            <Section title="Recompra" description="Distribuição dos clientes por quantidade de compras.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <Card
                  title="Clientes com 1 compra"
                  value={formatNumber(recompra?.clientes_1_compra)}
                  subtitle="Ainda sem recompra"
                />

                <Card
                  title="Clientes com 2 compras"
                  value={formatNumber(recompra?.clientes_2_compras)}
                  subtitle="Primeira recompra realizada"
                />

                <Card
                  title="Clientes com 3+ compras"
                  value={formatNumber(recompra?.clientes_3_mais_compras)}
                  subtitle="Base com maior potencial de retenção"
                />

                <Card
                  title="Média de pedidos"
                  value={formatNumber(recompra?.media_pedidos_por_cliente)}
                  subtitle="Pedidos por cliente"
                />
              </div>
            </Section>

            <Section title="Receita por livraria" description="Canais com maior faturamento.">
              <SimpleBarChart
                data={livrarias}
                labelKey="livraria"
                valueKey="receita"
                valueFormatter={formatCurrency}
              />
            </Section>

            <Section title="Receita por estado" description="Distribuição geográfica da receita.">
              <SimpleBarChart
                data={estados}
                labelKey="estado"
                valueKey="receita"
                valueFormatter={formatCurrency}
              />
            </Section>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              marginBottom: 18,
            }}
          >
            <Section title="Distribuição RFM" description="Quantidade de clientes por segmento RFM.">
              <SimpleBarChart
                data={rfm}
                labelKey="segmento_rfm"
                valueKey="clientes"
                valueFormatter={formatNumber}
                maxItems={10}
              />
            </Section>

            <Section title="Clientes VIP" description="Top 10% por faturamento acumulado.">
              <Table
                columns={clienteColumns}
                data={clientesVip.slice(0, 8)}
              />
            </Section>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
            <Section title="Top clientes" description="Clientes com maior receita acumulada.">
              <Table columns={clienteColumns} data={topClientes} />
            </Section>

            <Section title="Clientes em risco" description="Clientes com boa chance de recuperação.">
              <Table columns={clienteColumns} data={clientesRisco} />
            </Section>

            <Section title="Clientes perdidos" description="Clientes sem compra há mais de 180 dias.">
              <Table columns={clienteColumns} data={clientesPerdidos} />
            </Section>
          </div>
        </>
      )}
    </div>
  )
}
