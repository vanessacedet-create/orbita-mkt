import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import Pagina from './TarefasInfluencersOrganizadas'
import { salvarFilaYasminInf } from '../lib/tarefas-influencers'

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ usuario:{ id:'gestao', perfil:'administrador' } }) }))
jest.mock('./TarefasInfluencers', () => () => null)
jest.mock('../lib/banco-tarefas', () => ({ removerResponsavelAbertoPorNome:jest.fn() }))
jest.mock('../lib/client', () => ({ supabase:{ from:() => ({ select:() => ({ eq:() => ({ order:async () => ({data:[],error:null}) }) }) }) } }))
jest.mock('../lib/supabase', () => ({ getUsuarios:async () => [{id:'yasmin',nome:'Yasmin',perfil:'estagiario_influencers'}], getLivros:async () => ({data:[]}), getTarefas:async () => [] }))
jest.mock('../lib/tarefas-influencers', () => ({
 getFilaYasminInf:async () => ({responsavel_id:'yasmin',ordem:[],versao:0,agenda:{}}),
 getRecorrenciasYasminInf:async () => [],
 getBancoTarefasInf:async () => [],
 getAtribuicoesInf:async () => ['a','b'].map(id => ({ id,status:'a_fazer',responsavel_id:'yasmin',banco_tarefa:{nome:id},responsaveis:[{usuario:{id:'yasmin',nome:'Yasmin'}}],checklist:[] })),
 salvarFilaYasminInf:jest.fn(async ordem => ({responsavel_id:'yasmin',ordem,versao:1,agenda:{}})),
}))

test('arrastar o cartão completo na Lista salva a ordem e muda a posição visível', async () => {
 salvarFilaYasminInf.mockImplementation(async ordem => ({responsavel_id:'yasmin',ordem,versao:1,agenda:{}}))
 global.IS_REACT_ACT_ENVIRONMENT = true
 sessionStorage.setItem('orbita_cleanup_anny_v1','1')
 const div=document.createElement('div');document.body.appendChild(div);const root=createRoot(div)
 await act(async()=>{root.render(<Pagina/>)});
 const cards=div.querySelectorAll('[draggable="true"]');expect(cards.length).toBe(2)
 const dados={};const dataTransfer={setData:(k,v)=>{dados[k]=v},getData:k=>dados[k]||''}
 await act(async()=>{Simulate.dragStart(cards[0],{dataTransfer})})
 await act(async()=>{Simulate.dragOver(cards[1],{dataTransfer});Simulate.drop(cards[1],{dataTransfer})})
 expect(dataTransfer.effectAllowed).toBe('move')
 expect(salvarFilaYasminInf).toHaveBeenCalledWith(['b','a'],0)
 expect(div.querySelectorAll('[draggable="true"]')[0].getAttribute('data-tarefa-id')).toBe('b')
 await act(async()=>root.unmount());div.remove()
})

test('digitar posição na Lista salva e reorganiza os cartões', async () => {
 salvarFilaYasminInf.mockImplementation(async ordem => ({responsavel_id:'yasmin',ordem,versao:1,agenda:{}}))
 global.IS_REACT_ACT_ENVIRONMENT = true
 sessionStorage.setItem('orbita_cleanup_anny_v1','1')
 const div=document.createElement('div');document.body.appendChild(div);const root=createRoot(div)
 await act(async()=>root.render(<Pagina/>))
 const input=div.querySelector('[data-tarefa-id="a"] input[aria-label="Posição da tarefa"]')
 await act(async()=>Simulate.change(input,{target:{value:'2'}}))
 await act(async()=>Simulate.submit(input.closest('form')))
 expect(salvarFilaYasminInf).toHaveBeenCalledWith(['b','a'],0)
 expect(div.querySelector('[data-tarefa-id]').getAttribute('data-tarefa-id')).toBe('b')
 await act(async()=>root.unmount());div.remove()
})

test('posição fora da faixa não altera a sequência', async () => {
 global.IS_REACT_ACT_ENVIRONMENT = true
 sessionStorage.setItem('orbita_cleanup_anny_v1','1')
 const div=document.createElement('div');document.body.appendChild(div);const root=createRoot(div)
 await act(async()=>root.render(<Pagina/>))
 const input=div.querySelector('input[aria-label="Posição da tarefa"]')
 for (const valor of ['0','3','1.5','']) {
  await act(async()=>Simulate.change(input,{target:{value:valor}}))
  await act(async()=>Simulate.submit(input.closest('form')))
  expect(salvarFilaYasminInf).not.toHaveBeenCalled()
  expect(div.querySelector('[role="alert"]').textContent).toContain('entre 1 e 2')
 }
 await act(async()=>root.unmount());div.remove()
})
