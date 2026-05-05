import { AppNotification } from '../../data/interfaces/Notification';

function normalizeValue(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function getRawNotification(notification: AppNotification): Record<string, unknown> {
  return notification as Record<string, unknown>;
}

export function getNotificationTypeCandidates(notification: AppNotification): string[] {
  const raw = getRawNotification(notification);

  return [
    normalizeValue(notification.type),
    normalizeValue(raw['event']),
    normalizeValue(raw['notificationType']),
    normalizeValue(raw['notification_type']),
    normalizeValue(raw['category'])
  ].filter((value) => value.length > 0);
}

export function isAssignedRequestNotification(notification: AppNotification): boolean {
  return getNotificationTypeCandidates(notification).includes('assigned_request');
}

export function isAssignedRequestBulkNotification(notification: AppNotification): boolean {
  return getNotificationTypeCandidates(notification).includes('assigned_request_bulk');
}

export function isBulkUploadNotification(notification: AppNotification): boolean {
  const raw = getRawNotification(notification);
  const composedText = [
    String(notification.type ?? ''),
    String(notification.title ?? ''),
    String(notification.message ?? ''),
    String(raw['event'] ?? ''),
    String(raw['category'] ?? ''),
  ].join(' ').toLowerCase();

  return composedText.includes('batch') || composedText.includes('bulk');
}

export function normalizeRequestNumber(rawRequestNumber: string): string {
  return rawRequestNumber.replace(/^#+/, '').trim().toUpperCase();
}

export function extractRequestNumberFromNotification(notification: AppNotification): string | null {
  const raw = getRawNotification(notification);
  const data = (raw['data'] ?? null) as Record<string, unknown> | null;

  const directCandidates = [
    raw['requestNumber'],
    raw['request_number'],
    data?.['requestNumber'],
    data?.['request_number'],
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizeRequestNumber(String(candidate ?? ''));
    if (normalized.length > 0) {
      return normalized;
    }
  }

  const textCandidates = [
    String(notification.message ?? ''),
    String(notification.title ?? ''),
    String(notification.body ?? ''),
  ];

  for (const text of textCandidates) {
    const match = text.match(/#\s*([A-Za-z]+-?\d+)/);
    if (!match?.[1]) {
      continue;
    }

    const normalized = normalizeRequestNumber(match[1]);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return null;
}
