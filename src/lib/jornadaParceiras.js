import { supabase } from './client'

export const PERFIS_JORNADA = ['supervisor_parceiras','analista_parceiras','estagiario_parceiras']

export const JORNADAS_PADRAO = {
  'Sarah': { carga_minutos: 480, entrada:'07:00', saida:'16:00', almoco_inicio:'13:00', almoco_fim:'14:00', pausa_minutos:15 },
  'Vanessa': { carga_minutos: 480, entrada:'07:30', saida:'16:30', almoco_inicio:'12:30', almoco_fim:'13:30', pausa_minutos:15 },
  'Gabriela': { carga_minutos: 360, entrada:'08:30', saida:'14:30', almoco_inicio:'13:00', almoco_fim:'13:20', pausa_minutos:20 },
}

const fixos = {
  '01-01':'Confraternização Universal','04-21':'Tiradentes','05-01':'Dia do Trabalho','07-09':'Revolução Constitucionalista','09-07':'Independência do Brasil','10-12':'Nossa Senhora Aparecida','11-02':'Finados','11-15':'Proclamação da República','11-20':'Consciência Negra','12-08':'Imaculada Conceição — Campinas','12-25':'Natal',
}

function pascoa(ano) {
  const a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451)
  const mes=Math.floor((h+l-7*m+114)/31), dia=((h+l-7*m+114)%31)+1
  return new Date(ano,mes-1,dia)
}
function isoLocal(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function addDias(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}

export function motivoBloqueio(dataISO) {
  const d=new Date(`${dataISO}T12:00:00`)
  if ([0,6].includes(d.getDay())) return 'Fim de semana'
  const md=dataISO.slice(5)
  if (fixos[md]) return fixos[md]
  const p=pascoa(d.getFullYear())
  const moveis={
    [isoLocal(addDias(p,-48))]:'Carnaval',
    [isoLocal(addDias(p,-47))]:'Carnaval',
    [isoLocal(addDias(p,-2))]:'Paixão de Cristo',
    [isoLocal(addDias(p,60))]:'Corpus Christi',
  }
  return moveis[dataISO] || null
}

export function minutos(hora){if(!hora)return null;const [h,m]=hora.slice(0,5).split(':').map(Number);return h*60+m}
export function formatarSaldo(total){const sinal=total>0?'+':total<0?'−':'';const n=Math.abs(total||0);return `${sinal}${Math.floor(n/60)}h ${String(n%60).padStart(2,'0')}min`}

export function calcularRegistro(registro,cargaMinutos){
  if (registro.inativo) return { trabalhados:0, saldo:0 }
  const entrada=minutos(registro.entrada), saida=minutos(registro.saida)
  if (entrada==null || saida==null) return { trabalhados:null, saldo:null }
  let trabalhados=saida-entrada
  const ai=minutos(registro.almoco_inicio), af=minutos(registro.almoco_fim)
  if (ai!=null && af!=null && af>ai && !registro.intervalo_remunerado) trabalhados-=af-ai
  return { trabalhados, saldo:trabalhados-cargaMinutos }
}

export async function getEquipeJornada(){
  const {data,error}=await supabase.from('usuarios').select('id,nome,email,perfil').in('perfil',PERFIS_JORNADA).order('nome')
  if(error)throw error;return data||[]
}
export async function getConfiguracoesJornada(){
  const {data,error}=await supabase.from('jornada_config').select('*')
  if(error)throw error;return data||[]
}
export async function salvarConfiguracaoJornada(payload){
  const {data,error}=await supabase.from('jornada_config').upsert(payload,{onConflict:'usuario_id'}).select().single()
  if(error)throw error;return data
}
export async function getRegistrosJornada(usuarioId,inicio,fim){
  let q=supabase.from('jornada_registros').select('*').eq('usuario_id',usuarioId).gte('data',inicio).lte('data',fim).order('data')
  const {data,error}=await q;if(error)throw error;return data||[]
}
export async function salvarRegistroJornada(payload){
  const {data,error}=await supabase.from('jornada_registros').upsert(payload,{onConflict:'usuario_id,data'}).select().single()
  if(error)throw error;return data
}
export async function getDiasInativos(inicio,fim,usuarioId){
  let q=supabase.from('jornada_dias_inativos').select('*').gte('data',inicio).lte('data',fim)
  if(usuarioId)q=q.or(`usuario_id.is.null,usuario_id.eq.${usuarioId}`)
  const {data,error}=await q.order('data');if(error)throw error;return data||[]
}
export async function salvarDiaInativo(payload){
  const {data,error}=await supabase.from('jornada_dias_inativos').insert(payload).select().single()
  if(error)throw error;return data
}
export async function removerDiaInativo(id){const {error}=await supabase.from('jornada_dias_inativos').delete().eq('id',id);if(error)throw error}
