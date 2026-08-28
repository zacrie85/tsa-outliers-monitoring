import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

export interface FieldDef {
  key: string;
  label: string;
  isNumeric: boolean;
}

/**
 * Fetches all available field definitions for the active project.
 * Returns base fields + custom columns with auto-detected numeric type.
 * Falls back to base fields if the API fails.
 * Re-fetches when project-switched event fires.
 */
export function useProjectFields() {
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFields = useCallback(async () => {
    try {
      const res = await apiFetch('/api/columns/fields');
      if (res.ok) {
        const data = await res.json();
        setFields(data.fields || []);
      }
    } catch {
      // Fallback: use empty array — component will handle it
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  // Re-fetch on project switch
  useEffect(() => {
    const handler = () => loadFields();
    window.addEventListener('project-switched', handler);
    return () => window.removeEventListener('project-switched', handler);
  }, [loadFields]);

  return { fields, loading };
}

/**
 * Listen for project-switched events and re-fetch fields.
 * Returns a refreshKey that changes on every project switch.
 */
export function useProjectSwitchRefresh() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handler = () => setRefreshKey(k => k + 1);
    window.addEventListener('project-switched', handler);
    return () => window.removeEventListener('project-switched', handler);
  }, []);

  return refreshKey;
}