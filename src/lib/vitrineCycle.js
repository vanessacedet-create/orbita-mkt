import { supabase } from './supabase';

export const VITRINE_CYCLE_MARKER_PREFIX = '[ORBITA:NOVO_CICLO_LIBERADO|';
const MARKER_REGEX = /\s*\[ORBITA:NOVO_CICLO_LIBERADO\|[^\]]+\]\s*/g;

export function hasVitrineCycleMarker(value) {
  return (value || '').includes(VITRINE_CYCLE_MARKER_PREFIX);
}

export function cleanVitrineCycleMarkers(value) {
  return (value || '').replace(MARKER_REGEX, ' ').trim();
}

export function createVitrineCycleMarker() {
  return `${VITRINE_CYCLE_MARKER_PREFIX}${new Date().toISOString()}]`;
}

function cleanResultObservations(data) {
  if (Array.isArray(data)) {
    return data.map(row => (
      row && typeof row === 'object' && Object.prototype.hasOwnProperty.call(row, 'observacoes')
        ? { ...row, observacoes: cleanVitrineCycleMarkers(row.observacoes) }
        : row
    ));
  }
  if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'observacoes')) {
    return { ...data, observacoes: cleanVitrineCycleMarkers(data.observacoes) };
  }
  return data;
}

function applyCycleToQuotaRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];

  let cutoff = null;
  for (const row of rows) {
    if (!hasVitrineCycleMarker(row?.observacoes)) continue;
    const timestamp = new Date(row.created_at).getTime();
    if (!Number.isNaN(timestamp) && (cutoff === null || timestamp > cutoff)) cutoff = timestamp;
  }

  if (cutoff === null) return rows;
  return rows.filter(row => {
    const timestamp = new Date(row?.created_at).getTime();
    return !Number.isNaN(timestamp) && timestamp > cutoff;
  });
}

/**
 * Mantém a implementação atual da Vitrine intacta e intercepta apenas as
 * consultas de vitrine_pedidos. A consulta usada para calcular a cota mensal
 * passa a considerar somente os pedidos feitos depois da última liberação
 * manual registrada pela equipe.
 */
export function installVitrineCycleQueryPatch() {
  if (supabase.__orbitaVitrineCyclePatchInstalled) return;

  const originalFrom = supabase.from.bind(supabase);

  supabase.from = function patchedFrom(table) {
    const builder = originalFrom(table);
    if (table !== 'vitrine_pedidos' || !builder?.select) return builder;

    const originalSelect = builder.select.bind(builder);
    builder.select = function patchedSelect(columns = '*', options) {
      const quotaQuery = columns === 'vitrine_pedido_itens(quantidade)';
      const selectedColumns = quotaQuery
        ? 'created_at, observacoes, vitrine_pedido_itens(quantidade)'
        : columns;

      const query = originalSelect(selectedColumns, options);
      if (!query?.then) return query;

      const originalThen = query.then.bind(query);
      query.then = function patchedThen(onFulfilled, onRejected) {
        return originalThen(result => {
          if (!result || result.error) {
            return onFulfilled ? onFulfilled(result) : result;
          }

          const cycledData = quotaQuery ? applyCycleToQuotaRows(result.data) : result.data;
          const nextResult = { ...result, data: cleanResultObservations(cycledData) };
          return onFulfilled ? onFulfilled(nextResult) : nextResult;
        }, onRejected);
      };

      return query;
    };

    return builder;
  };

  Object.defineProperty(supabase, '__orbitaVitrineCyclePatchInstalled', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}
