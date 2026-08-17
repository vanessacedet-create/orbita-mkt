from pathlib import Path
import re

p = Path('src/pages/TarefasInfluencersOrganizadas.js')
s = p.read_text(encoding='utf-8')

# 1) Constantes de prioridade.
anchor = "const INFLUENCER_PERFIS = ['supervisor_influencers', 'analista_influencers', 'estagiario_influencers']\n"
insert = anchor + "const PRIORIDADES = {\n  urgente: { label:'Urgente', ordem:0, color:'#dc2626' },\n  alta:    { label:'Alta',    ordem:1, color:'#f97316' },\n  media:   { label:'Média',   ordem:2, color:'#eab308' },\n  baixa:   { label:'Baixa',   ordem:3, color:'#64748b' },\n}\n"
if 'const PRIORIDADES = {' not in s:
    if anchor not in s: raise SystemExit('anchor PRIORIDADES não encontrado')
    s = s.replace(anchor, insert, 1)

# 2) Parser de detalhes: prioridade passa a ser metadado persistido em especificidade/descricao.
old = """function separarDetalhes(especificidade) {
  const linhas = (especificidade || '').split('\\n')
  return {
    livro: linhas.find(l => l.startsWith('Livro: '))?.replace('Livro: ', '') || '',
    observacao: linhas.filter(l => !l.startsWith('Livro: ')).join('\\n').trim(),
  }
}
"""
new = """function separarDetalhes(especificidade) {
  const linhas = (especificidade || '').split('\\n')
  const prioridadeRaw = (linhas.find(l => l.startsWith('Prioridade: '))?.replace('Prioridade: ', '') || 'media').trim().toLowerCase()
  const prioridade = Object.prototype.hasOwnProperty.call(PRIORIDADES, prioridadeRaw) ? prioridadeRaw : 'media'
  return {
    livro: linhas.find(l => l.startsWith('Livro: '))?.replace('Livro: ', '') || '',
    prioridade,
    observacao: linhas.filter(l => !l.startsWith('Livro: ') && !l.startsWith('Prioridade: ')).join('\\n').trim(),
  }
}
function prioridadeDa(tarefa) { return separarDetalhes(tarefa?.especificidade || tarefa?.descricao || '').prioridade }
function compararPrioridade(a, b) {
  const pa = PRIORIDADES[prioridadeDa(a)]?.ordem ?? PRIORIDADES.media.ordem
  const pb = PRIORIDADES[prioridadeDa(b)]?.ordem ?? PRIORIDADES.media.ordem
  if (pa !== pb) return pa - pb
  const da = a.data_prazo || '9999-12-31'
  const db = b.data_prazo || '9999-12-31'
  if (da !== db) return String(da).localeCompare(String(db))
  return String(a.banco_tarefa?.nome || a.titulo || '').localeCompare(String(b.banco_tarefa?.nome || b.titulo || ''))
}
"""
if 'function prioridadeDa(tarefa)' not in s:
    if old not in s: raise SystemExit('função separarDetalhes não encontrada')
    s = s.replace(old, new, 1)

# 3) Card: separar permissão de editar/excluir e mostrar badge de prioridade.
s = s.replace(
    'function TaskCard({ tarefa, onStatus, onEdit, onDelete, podeGerenciar }) {',
    'function TaskCard({ tarefa, onStatus, onEdit, onDelete, podeEditar, podeExcluir }) {',
    1,
)
s = s.replace(
    "  const { livro, observacao } = separarDetalhes(tarefa.especificidade)\n",
    "  const { livro, observacao, prioridade } = separarDetalhes(tarefa.especificidade)\n  const prioridadeInfo = PRIORIDADES[prioridade] || PRIORIDADES.media\n",
    1,
)
old_buttons = """<div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ fontSize:10, fontWeight:700, color:status.color, background:`${status.color}18`, border:`1px solid ${status.color}45`, borderRadius:99, padding:'3px 8px' }}>{status.label}</span>{podeGerenciar && <button className=\"btn btn-ghost btn-icon btn-sm\" onClick={() => onEdit(tarefa)} title=\"Editar tarefa\"><Pencil size={13}/></button>}{podeGerenciar && <button className=\"btn btn-danger btn-icon btn-sm\" onClick={() => onDelete(tarefa)} title=\"Excluir tarefa\"><Trash2 size={13}/></button>}</div>"""
new_buttons = """<div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}><span style={{ fontSize:10, fontWeight:800, color:prioridadeInfo.color, background:`${prioridadeInfo.color}18`, border:`1px solid ${prioridadeInfo.color}45`, borderRadius:99, padding:'3px 8px' }}>Prioridade {prioridadeInfo.label}</span><span style={{ fontSize:10, fontWeight:700, color:status.color, background:`${status.color}18`, border:`1px solid ${status.color}45`, borderRadius:99, padding:'3px 8px' }}>{status.label}</span>{podeEditar && <button className=\"btn btn-ghost btn-icon btn-sm\" onClick={() => onEdit(tarefa)} title=\"Editar tarefa\"><Pencil size={13}/></button>}{podeExcluir && <button className=\"btn btn-danger btn-icon btn-sm\" onClick={() => onDelete(tarefa)} title=\"Excluir tarefa\"><Trash2 size={13}/></button>}</div>"""
if old_buttons in s:
    s = s.replace(old_buttons, new_buttons, 1)
elif 'Prioridade {prioridadeInfo.label}' not in s:
    raise SystemExit('bloco de botões do card não encontrado')

# 4) Nova tarefa: prioridade média por padrão, persistência e seletor.
s = s.replace(
    "const [form, setForm] = useState({ modelo_id:'', parceiro_id:'', livro_id:'', responsavel_ids:[], data_prazo:'', observacao:'' })",
    "const [form, setForm] = useState({ modelo_id:'', parceiro_id:'', livro_id:'', responsavel_ids:[], prioridade:'media', data_prazo:'', observacao:'' })",
    1,
)
s = s.replace(
    "especificidade:[identificacao ? `Livro: ${identificacao}` : '', form.observacao.trim()].filter(Boolean).join('\\n'),",
    "especificidade:[`Prioridade: ${form.prioridade}`, identificacao ? `Livro: ${identificacao}` : '', form.observacao.trim()].filter(Boolean).join('\\n'),",
    1,
)
new_priority_field = """<div className=\"form-group\"><label className=\"form-label\">5. Prioridade *</label><select className=\"form-select\" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade:e.target.value }))}>{Object.entries(PRIORIDADES).map(([v,p]) => <option key={v} value={v}>{p.label}</option>)}</select></div>"""
needle_new_deadline = "<div className=\"form-group\"><label className=\"form-label\">5. Prazo final</label>"
if new_priority_field not in s:
    if needle_new_deadline not in s: raise SystemExit('campo prazo da nova tarefa não encontrado')
    s = s.replace(needle_new_deadline, new_priority_field + "<div className=\"form-group\"><label className=\"form-label\">6. Prazo final</label>", 1)

# 5) Edição: carregar/salvar prioridade e mostrar seletor.
old_edit_form = "const [form, setForm] = useState({ titulo:tarefa.banco_tarefa?.nome || tarefa.titulo || '', parceiro_id:tarefa.parceiro?.id || '', livro_id:livroAtual?.id || '', responsavel_ids:responsaveisDa(tarefa).map(r => r.id), data_prazo:tarefa.data_prazo || '', status:tarefa.status || 'a_fazer', observacao:detalhes.observacao || '' })"
new_edit_form = "const [form, setForm] = useState({ titulo:tarefa.banco_tarefa?.nome || tarefa.titulo || '', parceiro_id:tarefa.parceiro?.id || '', livro_id:livroAtual?.id || '', responsavel_ids:responsaveisDa(tarefa).map(r => r.id), prioridade:detalhes.prioridade || 'media', data_prazo:tarefa.data_prazo || '', status:tarefa.status || 'a_fazer', observacao:detalhes.observacao || '' })"
if old_edit_form in s:
    s = s.replace(old_edit_form, new_edit_form, 1)
elif "prioridade:detalhes.prioridade" not in s:
    raise SystemExit('estado do modal editar não encontrado')

s = s.replace(
    "descricao:form.observacao.trim() || null, data_prazo:form.data_prazo || null, status:form.status === 'concluida' ? 'concluido' : form.status",
    "descricao:[`Prioridade: ${form.prioridade}`, form.observacao.trim()].filter(Boolean).join('\\n') || null, data_prazo:form.data_prazo || null, status:form.status === 'concluida' ? 'concluido' : form.status",
    1,
)
s = s.replace(
    "especificidade:[identificacao ? `Livro: ${identificacao}` : '', form.observacao.trim()].filter(Boolean).join('\\n'), _responsaveisIds:form.responsavel_ids",
    "especificidade:[`Prioridade: ${form.prioridade}`, identificacao ? `Livro: ${identificacao}` : '', form.observacao.trim()].filter(Boolean).join('\\n'), _responsaveisIds:form.responsavel_ids",
    1,
)
edit_priority = """<div className=\"form-group\"><label className=\"form-label\">Prioridade</label><select className=\"form-select\" value={form.prioridade} onChange={e => setForm(f => ({ ...f, prioridade:e.target.value }))}>{Object.entries(PRIORIDADES).map(([v,p]) => <option key={v} value={v}>{p.label}</option>)}</select></div>"""
needle_edit_row = "<div className=\"form-row\"><div className=\"form-group\"><label className=\"form-label\">Prazo</label>"
if edit_priority not in s:
    if needle_edit_row not in s: raise SystemExit('linha prazo/status do modal editar não encontrada')
    s = s.replace(needle_edit_row, edit_priority + needle_edit_row, 1)

# 6) Ordenar lista por prioridade e depois prazo.
old_filter_end = "  }), [base, filtro, responsavelFiltro])"
new_filter_end = "  }).sort(compararPrioridade), [base, filtro, responsavelFiltro])"
if old_filter_end in s:
    s = s.replace(old_filter_end, new_filter_end, 1)
elif '.sort(compararPrioridade)' not in s:
    raise SystemExit('fim do filtro de tarefas não encontrado')

# 7) Permissões: estagiário de influencers pode editar, mas não excluir/configurar modelos.
perm_anchor = "  const isAdmin = ADMIN_PERFIS.includes(usuario?.perfil)\n  const podeCriar = isAdmin || INFLUENCER_PERFIS.includes(usuario?.perfil)\n"
perm_new = "  const isAdmin = ADMIN_PERFIS.includes(usuario?.perfil)\n  const podeCriar = isAdmin || INFLUENCER_PERFIS.includes(usuario?.perfil)\n  const podeEditar = isAdmin || usuario?.perfil === 'estagiario_influencers'\n"
if 'const podeEditar =' not in s:
    if perm_anchor not in s: raise SystemExit('bloco de permissões não encontrado')
    s = s.replace(perm_anchor, perm_new, 1)

old_card_call = "<TaskCard key={t.id} tarefa={t} onStatus={mudarStatus} onEdit={setTarefaEditando} onDelete={excluir} podeGerenciar={isAdmin}/>"
new_card_call = "<TaskCard key={t.id} tarefa={t} onStatus={mudarStatus} onEdit={setTarefaEditando} onDelete={excluir} podeEditar={podeEditar} podeExcluir={isAdmin}/>"
if old_card_call in s:
    s = s.replace(old_card_call, new_card_call, 1)
elif 'podeEditar={podeEditar}' not in s:
    raise SystemExit('chamada de TaskCard não encontrada')

p.write_text(s, encoding='utf-8')
print('Patch aplicado com sucesso.')
