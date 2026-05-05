export const CUSTOM_ACTION_PERMISSION_SLUG_MAP: Record<string, readonly string[]> = {
  approve: ['approve', 'approved'],
  decline: ['decline', 'reject', 'rejected'],
  pdf: ['pdf', 'download_pdf'],
  edit: ['edit'],
  see_history: ['history', 'view_history', 'see_history'],
  see_attachments: ['see_attachments', 'see_attachment', 'see_atachments', 'see_atachment', 'view_attachments', 'view_attachment'],
  history: ['history', 'view_history'],
  delete: ['delete'],
};

export function getPermissionSlugsForCustomAction(actionKey?: string): readonly string[] {
  if (!actionKey) {
    return [];
  }

  return CUSTOM_ACTION_PERMISSION_SLUG_MAP[actionKey] ?? [actionKey];
}
