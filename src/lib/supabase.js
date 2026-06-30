// ── ARQUIVO DE COMPATIBILIDADE ─────────────────────────────
// Este arquivo re-exporta tudo dos módulos especializados para que
// os imports existentes continuem funcionando sem alterações.
//
// Estrutura nova:
//   lib/client.js        — instância do Supabase
//   lib/auth.js          — autenticação e usuários
//   lib/parceiros.js     — parceiros e CRM de influencers
//   lib/livros.js        — livros, envios e lançamentos
//   lib/campanhas.js     — campanhas, divulgações e dashboard
//   lib/tarefas.js       — tarefas, checklist e importações
//   lib/monitoramento.js — monitoramento mensal
//   lib/crm-literario.js — CRM literário, contatos e divulgadores

export { supabase } from './client'

export {
  signIn, resetPassword, signOut, getSession,
  getUsuarioPerfil, getUsuarios, updateUsuario, createUsuarioAdmin,
} from './auth'

// ============================================================
// ADICIONAR AO src/lib/supabase.js
// Na seção de imports de './parceiros', incluir as novas funções:
// ============================================================

// Localizar a linha que importa de './parceiros' e ADICIONAR:
//
//   TIERS, TIER_ORDER, SITUACOES,
//   getParceirosComTier, verificarPromocao, progressoTier,
//   updateTier, updateSituacao, updatePerformance,
//   getTierHistory, ativarParceiroBronze,
//
// Exemplo de como ficaria o import completo:

export {
  saveParceiroCPF, getParceiroCPF,
  getParceiros, getParceirosAtivos, getTodosParceiros, getParceirosComPontuacao,
  createParceiro, updateParceiro, deleteParceiro, updateParceirosLote,
  createParceiroCRM, createParceirosLote, getCRMParceiros, updateParceiroCRM,
  getStatusHistory, addStatusHistory,
  vincularDivulgadorComoParceiro,
  // ── NOVAS FUNÇÕES (Escada de Crescimento) ──
  TIERS, TIER_ORDER, SITUACOES, MODELOS_COM_ESCADA,
  getParceirosComTier, verificarPromocao, progressoTier,
  updateTier, updateSituacao, updatePerformance,
  getTierHistory, ativarParceiroBronze,
} from './parceiros'


export {
  getLivros, createLivro, updateLivro, deleteLivro,
  buscarLivroPorISBN, getEditoras,
  getEnvios, getEnvioCompleto, createEnvio, updateEnvio, updateEnvioStatus, deleteEnvio,
  updateEnvioLivroDivulgacao, getStats,
  getLivrosLancamento, importarLancamentos,
} from './livros'

export {
  getCampanhas, getCampanha, createCampanha, updateCampanha, reordenarCampanhas, deleteCampanha,
  addParceiroCampanha, updateParceiroCampanha, removeParceiroCampanha,
  addLivroCampanha, removeLivroCampanha,
  getFollowUps, registrarContato,
  getDivulgacoesParceiro, createDivulgacaoCampanha, updateDivulgacaoCampanha, deleteDivulgacaoCampanha,
  getLancamentoLivros, addLancamentoLivro, removeLancamentoLivro,
  addLancamentoParceiro, updateLancamentoParceiro, getLancamentoParceiro, removeLancamentoParceiro,
  getLivrosDestaqueParceiro, addLivroDestaqueParceiro, removeLivroDestaqueParceiro, importarLivrosDestaquePlanilha,
  getDivulgacoesLibraria, createDivulgacaoLibraria, updateDivulgacaoLibraria, deleteDivulgacaoLibraria,
  importarDivulgacoesPromocao,
  getDashboardStats,
} from './campanhas'

export {
  getTarefas, createTarefa, updateTarefa, deleteTarefa,
  addChecklistItem, updateChecklistItem, deleteChecklistItem,
  addLivroTarefa, removeLivroTarefa,
  importarTarefasLote, desfazerImportacao, getLotesRecentes,
  addComentario,
  gerarProximaOcorrencia, calcularProximoPrazo,
  setResponsaveisTarefa, toggleParteResponsavel, concluirTodasAsPartes,
} from './tarefas'

export {
  getRegistrosMonitoramento, createRegistroMonitoramento,
  updateRegistroMonitoramento, deleteRegistroMonitoramento,
  getLancamentosMonitoramento, marcarDivulgacaoPublicada,
} from './monitoramento'

export {
  getLivrosCRM, createLivroCRM, updateLivroCRM,
  getContatosCRM, createContatoCRM, updateContatoCRM,
  getCampanhaLiteraria, addContatosCampanha, updateStatusCampanha,
  bulkUpdateStatusCampanha, removeContatoCampanha,
  getDivulgadores, createDivulgador, updateDivulgador,
  getDivulgacaoLivro, addDivulgadoresLivro, updateDivulgacaoStatus,
  bulkUpdateDivulgacao, removeDivulgacaoLivro,
} from './crm-literario'

export {
  getCRMStatusConfig, saveCRMStatusConfig, corParaBg,
} from './crm-status'

export {
  getMarcas,
  getConversas, getConversa, upsertConversa, updateConversa, vincularParceiro,
  getMensagens, addMensagem, marcarLidas, getContagemNaoLidas,
  enviarMensagemMeta,
  subscribeConversa, subscribeConversas,
} from './inbox'
