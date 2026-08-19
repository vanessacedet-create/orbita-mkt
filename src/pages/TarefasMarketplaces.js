import TarefasEquipe from './TarefasParceiras'

// Página independente da equipe de Marketplaces.
// Reutiliza o motor genérico de tarefas, mas fixa o grupo para impedir
// mistura com Influencers, Próprias e Editoras Parceiras.
export default function TarefasMarketplaces() {
  return <TarefasEquipe grupo="marketplaces" titulo="Tarefas — Marketplaces" />
}
