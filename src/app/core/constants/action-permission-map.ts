export const CUSTOM_ACTION_PERMISSION_SLUG_MAP: Record<string, readonly string[]> = {
  approve: ['approve', 'approved'],
  decline: ['decline', 'reject', 'rejected'],
  pdf: ['pdf', 'download_pdf'],
  edit: ['edit'],
  history: ['history', 'view_history'],
  delete: ['delete'],
};

export function getPermissionSlugsForCustomAction(actionKey?: string): readonly string[] {
  if (!actionKey) {
    return [];
  }

  return CUSTOM_ACTION_PERMISSION_SLUG_MAP[actionKey] ?? [actionKey];
}
