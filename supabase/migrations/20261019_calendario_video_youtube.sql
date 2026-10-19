alter table public.calendario_divulgacoes drop constraint if exists calendario_divulgacoes_tipo_check;
alter table public.calendario_divulgacoes add constraint calendario_divulgacoes_tipo_check check (tipo in ('Reels','Stories','Carrossel','Post','Live','Vídeo no YouTube','Outro'));
