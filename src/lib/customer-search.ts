export const MAX_CUSTOMER_SEARCH_LENGTH = 100;

function escapeLikeTerm(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Build a PostgREST OR expression for the four customer search fields. Values
 * are quoted/escaped for the filter grammar, and LIKE wildcards are escaped so
 * user-entered percent/underscore characters are matched literally.
 */
export function buildCustomerSearchFilter(searchTerm: string): string {
  const pattern = quotePostgrestValue(`%${escapeLikeTerm(searchTerm)}%`);
  return ['first_name', 'last_name', 'email', 'phone']
    .map((column) => `${column}.ilike.${pattern}`)
    .join(',');
}
