export interface ScopeFields {
  is_generic?: boolean | number;
  target_companies?: string | null;
}

// A block written for one employer must not surface on another employer's CV or cover letter.
// Loaders that predate the is_generic column leave it undefined, which is treated as generic so
// existing callers keep working; explicit scoping is what opts a block out.
export function blockAppliesToCompany(block: ScopeFields, company?: string | null): boolean {
  const generic = block.is_generic === undefined || block.is_generic === true || block.is_generic === 1;
  if (generic) return true;

  const targets = (block.target_companies || '')
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  if (!targets.length || !company) return false;

  const hiring = company.trim().toLowerCase();
  return targets.some(t => hiring.includes(t) || t.includes(hiring));
}
