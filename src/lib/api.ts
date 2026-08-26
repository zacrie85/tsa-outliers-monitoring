import { useAppStore } from '@/store/app-store';

/**
 * Fetch wrapper that automatically appends projectId from the global store.
 * Usage: apiFetch('/api/monitoring') → '/api/monitoring?projectId=default'
 */
export function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const { activeProjectId } = useAppStore.getState();
  const sep = url.includes('?') ? '&' : '?';
  return fetch(`${url}${sep}projectId=${activeProjectId}`, options);
}

/**
 * Get projectId query string: '?projectId=default'
 */
export function getProjectQuery(): string {
  return `?projectId=${useAppStore.getState().activeProjectId}`;
}
