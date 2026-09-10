import { useEffect, useMemo, useState } from 'react';
import { classes as classesApi, resultReleases as releasesApi } from '../api/resources';
import { ResultRelease, SchoolClass } from '../api/types';

export default function ResultsReleasePage() {
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [releases, setReleases] = useState<ResultRelease[]>([]);
  const [terms, setTerms] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    releasesApi.list().then(setReleases).catch((e) => setError(e.message));
  }

  useEffect(() => {
    classesApi
      .list()
      .then((cs) => {
        setClassList(cs);
        setTerms(Object.fromEntries(cs.map((c) => [c._id, c.term])));
      })
      .catch((e) => setError(e.message));
    refresh();
  }, []);

  const releasedSet = useMemo(
    () => new Set(releases.map((r) => `${r.classId}::${r.term}`)),
    [releases]
  );
  const classById = useMemo(() => Object.fromEntries(classList.map((c) => [c._id, c])), [classList]);

  async function toggle(classId: string, term: string, currentlyReleased: boolean) {
    setBusy(`${classId}::${term}`);
    setError(null);
    try {
      if (currentlyReleased) await releasesApi.unrelease(classId, term);
      else await releasesApi.release(classId, term);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update release');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <h1>Results Release</h1>
      <p className="info-card-sub mb-3">
        Academic results stay hidden from parents until you release them here, per class and term. Attendance is always
        visible.
      </p>
      {error && <p className="error">{error}</p>}

      <div className="card mb-4">
        <h2 className="text-base font-display font-semibold mb-2">Release a class + term</h2>
        <div className="table-scroll">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Class</th>
                <th>Term</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {classList.map((c) => {
                const term = terms[c._id] ?? c.term;
                const key = `${c._id}::${term}`;
                const released = releasedSet.has(key);
                return (
                  <tr key={c._id}>
                    <td>{c.name}</td>
                    <td>
                      <input
                        value={term}
                        onChange={(e) => setTerms({ ...terms, [c._id]: e.target.value })}
                        className="!py-1.5 text-xs w-40"
                      />
                    </td>
                    <td>
                      {released ? (
                        <span className="status-badge status-Active">Released</span>
                      ) : (
                        <span className="status-badge status-Applied">Hidden</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={released ? '!bg-stone-100 !text-ink hover:!bg-stone-200' : ''}
                        disabled={busy === key}
                        onClick={() => toggle(c._id, term, released)}
                      >
                        {busy === key ? '…' : released ? 'Unrelease' : 'Release'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-display font-semibold mb-2">Currently released</h2>
        {releases.length === 0 ? (
          <p className="info-card-empty">Nothing released yet.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Term</th>
                  <th>Released</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((r) => (
                  <tr key={r._id}>
                    <td>{classById[r.classId]?.name ?? r.classId}</td>
                    <td>{r.term}</td>
                    <td>{new Date(r.releasedAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        type="button"
                        className="!bg-stone-100 !text-ink hover:!bg-stone-200"
                        disabled={busy === `${r.classId}::${r.term}`}
                        onClick={() => toggle(r.classId, r.term, true)}
                      >
                        Unrelease
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
