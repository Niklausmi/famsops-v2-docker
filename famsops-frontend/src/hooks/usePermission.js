import { useAppStore } from '../store';

/**
 * usePermission(module, action)
 * Returns true if the current user has the given permission.
 * Admin always returns true.
 *
 * Usage:
 *   const canCreate = usePermission('quotations', 'create');
 *   const canApprove = usePermission('quotations', 'approve');
 */
export function usePermission(module, action) {
  const can = useAppStore(s => s.can);
  return can(module, action);
}

/**
 * usePermissions(...pairs)
 * Returns an object of boolean flags for multiple checks at once.
 *
 * Usage:
 *   const p = usePermissions(['quotations','create'], ['quotations','approve']);
 *   if (p['quotations.create']) ...
 */
export function usePermissions(...pairs) {
  const can = useAppStore(s => s.can);
  return Object.fromEntries(
    pairs.map(([mod, act]) => [`${mod}.${act}`, can(mod, act)])
  );
}
