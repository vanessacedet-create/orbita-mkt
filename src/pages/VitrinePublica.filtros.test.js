import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import VitrinePublica from './VitrinePublica';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

const livros = [
  { id: 1, titulo: 'Novembro atual Ecclesiae', editora: 'Ecclesiae', data_lancamento: '2026-11-01' },
  { id: 2, titulo: 'Novembro anterior Ecclesiae', editora: 'Ecclesiae', data_lancamento: '2025-11-30' },
  { id: 3, titulo: 'Outubro atual Ecclesiae', editora: 'Ecclesiae', data_lancamento: '2026-10-01' },
  { id: 4, titulo: 'Novembro atual Texugo', editora: 'Texugo', data_lancamento: '2026-11-02' },
  { id: 5, titulo: 'Livro sem data Ecclesiae', editora: 'Ecclesiae', data_lancamento: null },
  { id: 6, titulo: 'Dezembro anterior Texugo', editora: 'Texugo', data_lancamento: '2025-12-31' },
];
let div, root;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.history.replaceState({}, '', '/vitrine');
  supabase.rpc.mockImplementation(nome => {
    if (nome === 'vitrine_catalogo') return { range: async () => ({ data: livros }) };
    if (nome === 'vitrine_identificar') return Promise.resolve({ data: [{ id: 1, nome: 'Parceiro de teste', grupo: 'A' }] });
    return Promise.resolve({ data: nome === 'vitrine_saldo_mes' ? 0 : [] });
  });
  div = document.createElement('div');
  document.body.appendChild(div);
  root = createRoot(div);
});

afterEach(async () => {
  await act(async () => root.unmount());
  div.remove();
});

async function entrar() {
  await act(async () => root.render(<VitrinePublica />));
  await act(async () => Simulate.change(div.querySelector('input[type="email"]'), { target: { value: 'teste@example.com' } }));
  await act(async () => Simulate.submit(div.querySelector('form')));
}
async function escolher(id, valor) {
  await act(async () => Simulate.change(div.querySelector(`#${id}`), { target: { value: valor } }));
}
function botao(texto) { return [...div.querySelectorAll('button')].find(b => b.textContent.includes(texto)); }

test('mês e ano combinam com editora, e limpar período mantém a editora', async () => {
  await entrar();
  expect(div.textContent).toContain('6 livros disponíveis');
  await escolher('vitrine-mes-lancamento', '11');
  expect(div.textContent).toContain('3 livros disponíveis');
  await escolher('vitrine-ano-lancamento', '2026');
  expect(div.textContent).toContain('2 livros disponíveis');
  expect(div.textContent).toContain('01/11/2026');
  expect(div.textContent).not.toContain('Novembro anterior Ecclesiae');
  await act(async () => Simulate.click(botao('Filtros')));
  const editora = [...div.querySelectorAll('select')].find(s => s.options[0].text === 'Todas as editoras');
  await act(async () => Simulate.change(editora, { target: { value: 'Ecclesiae' } }));
  expect(div.textContent).toContain('1 livro disponível');
  await act(async () => Simulate.click(botao('Limpar período')));
  expect(div.textContent).toContain('4 livros disponíveis');
  expect(editora.value).toBe('Ecclesiae');
  expect(div.textContent).toContain('Livro sem data Ecclesiae');
});

test('ano funciona sozinho e livros sem data voltam quando o período é limpo', async () => {
  await entrar();
  expect([...div.querySelector('#vitrine-ano-lancamento').options].map(o => o.value)).toEqual(['', '2026', '2025']);
  await escolher('vitrine-ano-lancamento', '2025');
  expect(div.textContent).toContain('2 livros disponíveis');
  expect(div.textContent).not.toContain('Livro sem data Ecclesiae');
  await act(async () => Simulate.click(botao('Limpar período')));
  expect(div.textContent).toContain('6 livros disponíveis');
});

test('link de editora permite filtrar datas e preserva a seleção ao esconder um livro', async () => {
  window.history.replaceState({}, '', '/vitrine?editora=Ecclesiae');
  await entrar();
  expect(div.textContent).toContain('4 livros disponíveis');
  await escolher('vitrine-mes-lancamento', '11');
  await escolher('vitrine-ano-lancamento', '2026');
  expect(div.textContent).toContain('1 livro disponível');
  await act(async () => Simulate.click(botao('Selecionar')));
  await escolher('vitrine-mes-lancamento', '10');
  expect(div.textContent).toContain('Outubro atual Ecclesiae');
  expect(div.textContent).not.toContain('Novembro atual Ecclesiae');
  expect(div.textContent).toContain('Ver seleção (1 livro)');
  await act(async () => Simulate.click(botao('Limpar período')));
  expect(div.textContent).toContain('4 livros disponíveis');
  expect(div.textContent).not.toContain('Novembro atual Texugo');
});
