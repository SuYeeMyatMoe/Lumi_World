import { updateLocal } from './storage/storage';

export function isOverlayHidden(hiddenOrigins: string[], origin = location.origin): boolean {
  return Array.isArray(hiddenOrigins) && hiddenOrigins.includes(origin);
}

export async function hideOverlay(origin = location.origin): Promise<void> {
  await updateLocal('hiddenOrigins', (list) => {
    const origins = Array.isArray(list) ? list : [];
    return origins.includes(origin) ? origins : [...origins, origin];
  });
}

export async function showOverlay(origin = location.origin): Promise<void> {
  await updateLocal('hiddenOrigins', (list) => (Array.isArray(list) ? list : []).filter((item) => item !== origin));
}
