/**
 * Helper to extract projectId from a request.
 * Falls back to 'default' if not provided.
 */
export function getProjectId(url: string | URL): string {
  const u = typeof url === 'string' ? new URL(url, 'http://localhost') : url;
  return u.searchParams.get('projectId') || 'default';
}
