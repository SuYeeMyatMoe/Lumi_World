import { updateLocal } from './storage/storage';

export function isOverlayHidden(hiddenOrigins: string[], origin = location.origin): boolean {
  return hiddenOrigins.includes(origin);
}

export async function hideOverlay(origin = location.origin): Promise<void> {
  await updateLocal('hiddenOrigins', (list) => (list.includes(origin) ? list : [...list, origin]));
}

export async function showOverlay(origin = location.origin): Promise<void> {
  await updateLocal('hiddenOrigins', (list) => list.filter((item) => item !== origin));
}
