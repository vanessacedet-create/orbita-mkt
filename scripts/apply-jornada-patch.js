const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', 'src', 'App.js')
let s = fs.readFileSync(file, 'utf8')

function once(before, after) {
  if (s.includes(after)) return
  if (!s.includes(before)) throw new Error(`Trecho não encontrado em App.js: ${before.slice(0, 60)}`)
  s = s.replace(before, after)
}

once("  Building2,\n} from 'lucide-react'", "  Building2,\n  TimerReset,\n} from 'lucide-react'")
once("const BlocoNotas             = lazy(() => import('./pages/BlocoNotas'))", "const BlocoNotas             = lazy(() => import('./pages/BlocoNotas'))\nconst ControleJornadaParceiras = lazy(() => import('./pages/ControleJornadaParceiras'))")
once("  { path: '/agenda',                label: 'Agenda',             icon: CalendarRange,   modulo: 'tarefas_parceiras' },", "  { path: '/agenda',                label: 'Agenda',             icon: CalendarRange,   modulo: 'tarefas_parceiras' },\n  { path: '/jornada-parceiras',     label: 'Controle de Jornada', icon: TimerReset,      modulo: 'jornada_parceiras' },")
once("                <Route path=\"/agenda\" element={<RequireAuth modulo=\"tarefas_parceiras\"><Agenda /></RequireAuth>} />", "                <Route path=\"/agenda\" element={<RequireAuth modulo=\"tarefas_parceiras\"><Agenda /></RequireAuth>} />\n                <Route path=\"/jornada-parceiras\" element={<RequireAuth modulo=\"jornada_parceiras\"><ControleJornadaParceiras /></RequireAuth>} />")

fs.writeFileSync(file, s)
console.log('Integração da página de jornada aplicada.')
