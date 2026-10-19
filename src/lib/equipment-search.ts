export const MAX_EQUIPMENT_SEARCH_LENGTH = 100;

function escapeLikeTerm(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * PostgREST OR expression for the equipment search box: name, manufacturer,
 * model and serial number. LIKE wildcards typed by the user are escaped so `%`
 * and `_` match literally.
 */
export function buildEquipmentSearchFilter(searchTerm: string): string {
  const pattern = quotePostgrestValue(`%${escapeLikeTerm(searchTerm)}%`);
  return ['equipment_name', 'manufacturer', 'model_number', 'serial_number']
    .map((column) => `${column}.ilike.${pattern}`)
    .join(',');
}
