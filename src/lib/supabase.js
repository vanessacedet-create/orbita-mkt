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

export {
  saveParceiroCPF, getParceiroCPF,
  getParceiros, getParceirosAtivos, getTodosParceiros, getParceirosComPontuacao,
  createParceiro, updateParceiro, deleteParceiro,
  createParceiroCRM, getCRMParceiros, updateParceiroCRM,
  getStatusHistory, addStatusHistory,
  vincularDivulgadorComoParceiro,
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
} from './tarefas'

export {
  getRegistrosMonitoramento, createRegistroMonitoramento,
  updateRegistroMonitoramento, deleteRegistroMonitoramento,
  getLancamentosMonitoramento,
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
