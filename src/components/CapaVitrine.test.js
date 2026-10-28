import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import CapaVitrine, { propsCapaOtimizada } from './CapaVitrine';

const src = 'https://cedet-publico.s3.amazonaws.com/produtos_imagem_principal/38248.jpg';

test('endereços externos e imagens locais continuam usando o original', () => {
  for (const url of ['https://outro.exemplo/capa.jpg', '/capa.jpg', `${src}?token=privado`]) {
    expect(propsCapaOtimizada(url, 'catalogo', true)).toEqual({ src: url });
  }
});

test('tamanhos e qualidade enviados ao otimizador estão autorizados na configuração', () => {
  const config = require('../../vercel.json').images;
  for (const tamanho of ['catalogo', 'detalhe', 'miniatura']) {
    const props = propsCapaOtimizada(src, tamanho, true);
    const urls = [props.src, ...(props.srcSet || '').split(', ').filter(Boolean).map(item => item.split(' ')[0])];
    for (const url of urls) {
      const params = new URL(url, 'https://orbita-mkt.vercel.app').searchParams;
      expect(config.sizes).toContain(Number(params.get('w')));
      expect(config.qualities).toContain(Number(params.get('q')));
      expect(params.get('url')).toBe(src);
    }
  }
});

test('falha no otimizador tenta o original e só depois informa falha da capa', async () => {
  const ambiente = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const div = document.createElement('div');
  const root = createRoot(div);
  const onError = jest.fn();
  try {
    await act(async () => root.render(<CapaVitrine src={src} alt="Capa" onError={onError} />));
    expect(div.querySelector('img').getAttribute('src')).toMatch(/^\/_vercel\/image/);
    await act(async () => Simulate.error(div.querySelector('img')));
    expect(div.querySelector('img').getAttribute('src')).toBe(src);
    expect(div.querySelector('img').hasAttribute('srcset')).toBe(false);
    expect(onError).not.toHaveBeenCalled();
    await act(async () => Simulate.error(div.querySelector('img')));
    expect(onError).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    process.env.NODE_ENV = ambiente;
  }
});
