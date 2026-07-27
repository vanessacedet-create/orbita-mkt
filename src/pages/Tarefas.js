import { Navigate } from 'react-router-dom'

// A tela antiga foi consolidada em Tarefas Influencers.
// Mantemos esta rota apenas para preservar favoritos e links já compartilhados.
export default function Tarefas() {
  return <Navigate to="/tarefas-influencers" replace />
}
