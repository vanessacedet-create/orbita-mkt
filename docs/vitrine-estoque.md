# Estoque da Vitrine

O estoque da Vitrine é independente de outros projetos. A fonte é uma planilha importada no próprio Admin do Órbita.

## Formato aceito

Arquivo Excel `.xlsx` ou `.xls`. A primeira planilha do arquivo deve ter:

| EAN | Quantidade |
| --- | ---: |
| 9780000000000 | 20 |
| 9780000000001 | 0 |

Também são reconhecidos os cabeçalhos `ISBN`, `ISBN/EAN`, `EAN/ISBN` e, para quantidade, `Qtd`, `Estoque`, `Quantidade disponível` ou `Saldo`.

A importação é tratada como um retrato completo do estoque da Vitrine: títulos cadastrados na Vitrine que não aparecem na planilha recebem quantidade zero.

## Regra de disponibilidade

Um título só pode aparecer ao parceiro quando:

1. está ativo na Vitrine; e
2. `estoque_disponivel > 0`.

O Admin continua enxergando todos os títulos e a quantidade registrada.

## Nuvem e atualização automática

A importação manual é a primeira etapa e funciona sem integração externa. A atualização automática ao meio-dia deve ser conectada depois que a URL/formato da planilha em nuvem estiver definido. Essa integração deve permanecer dentro do fluxo da Vitrine do Órbita.
