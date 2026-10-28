import React, { useEffect, useState } from 'react';

const LARGURAS = [256, 384, 640, 960];

export function propsCapaOtimizada(src, tamanho = 'catalogo', otimizar = process.env.NODE_ENV === 'production') {
  if (!otimizar || !/^https:\/\/cedet-publico\.s3\.amazonaws\.com\/produtos_imagem_principal\/\d+\.jpg$/.test(src || '')) {
    return { src };
  }
  const url = largura => `/_vercel/image?url=${encodeURIComponent(src)}&w=${largura}&q=75`;
  if (tamanho === 'miniatura') return { src: url(256) };
  const larguras = tamanho === 'detalhe' ? [640, 960] : LARGURAS;
  return {
    src: url(tamanho === 'detalhe' ? 640 : 384),
    srcSet: larguras.map(largura => `${url(largura)} ${largura}w`).join(', '),
    sizes: tamanho === 'detalhe' ? '(max-width: 600px) 90vw, 500px' : '(max-width: 480px) calc(100vw - 48px), 240px',
  };
}

// Se o otimizador estiver indisponível, tenta o original antes do placeholder.
export default function CapaVitrine({ src, tamanho, onError, ...props }) {
  const [usarOriginal, setUsarOriginal] = useState(false);
  useEffect(() => setUsarOriginal(false), [src]);
  const imagem = usarOriginal ? { src } : propsCapaOtimizada(src, tamanho);
  return <img {...props} {...imagem} onError={evento => {
    if (!usarOriginal && imagem.src !== src) setUsarOriginal(true);
    else onError?.(evento);
  }} />;
}
