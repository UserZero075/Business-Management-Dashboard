export type PlaceholderMap = Record<string, string>;

// Substitui {{chave}} pelos valores do mapa. Chaves ausentes viram string vazia.
export function resolvePlaceholders(text: string, values: PlaceholderMap): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? '');
}

// Monta o mapa a partir dos valores de campos-chave + embutidos.
export function buildPlaceholderMap(
  fieldValues: { fieldKey: string; value: string }[],
  builtins: { cliente?: string; total?: string; validade?: string },
): PlaceholderMap {
  const map: PlaceholderMap = {};
  for (const fv of fieldValues) map[fv.fieldKey] = fv.value;
  if (builtins.cliente !== undefined) map.cliente = builtins.cliente;
  if (builtins.total !== undefined) map.total = builtins.total;
  if (builtins.validade !== undefined) map.validade = builtins.validade;
  return map;
}
