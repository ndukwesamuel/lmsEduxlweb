import { useEffect, useState } from 'react';
import { school as schoolApi } from '../api/resources';
import { School } from '../api/types';

// The school's terms and grading scale are needed on most screens, so fetch
// them once per login and share the result. Keyed on the token so a
// different login never sees the previous school's settings.
let cache: { token: string | null; promise: Promise<School> } | null = null;
const listeners = new Set<(s: School) => void>();

function load(): Promise<School> {
  const token = localStorage.getItem('smis_token');
  if (!cache || cache.token !== token) {
    const promise = schoolApi.get();
    cache = { token, promise };
    promise.catch(() => {
      if (cache?.promise === promise) cache = null;
    });
  }
  return cache.promise;
}

/** Call after saving settings so every open screen picks up the change. */
export function setSchoolCache(updated: School) {
  cache = { token: localStorage.getItem('smis_token'), promise: Promise.resolve(updated) };
  listeners.forEach((fn) => fn(updated));
}

export function useSchool(): { school: School | null; error: string | null } {
  const [school, setSchool] = useState<School | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    load()
      .then((s) => alive && setSchool(s))
      .catch((err) => alive && setError(err instanceof Error ? err.message : 'Failed to load school settings'));
    listeners.add(setSchool);
    return () => {
      alive = false;
      listeners.delete(setSchool);
    };
  }, []);

  return { school, error };
}
