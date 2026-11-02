import { useEffect, useMemo, useState } from 'react';
import {
  classes as classesApi,
  reportCards as reportCardsApi,
  resultReleases as releasesApi,
  students as studentsApi,
} from '../api/resources';
import { ReportCard, ResultRelease, SchoolClass, Student } from '../api/types';
import TermSelect from '../components/TermSelect';
import SheetSaveBar, { confirmDiscard, useWarnOnLeave } from '../components/SheetSaveBar';
import { useHelpFacts } from '../components/HelpContext';
import { useSchool } from '../hooks/useSchool';

function ReleasePanel() {
  const { school } = useSchool();
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
      .then(setClassList)
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
                const term = terms[c._id] ?? school?.currentTerm ?? '';
                const key = `${c._id}::${term}`;
                const released = releasedSet.has(key);
                return (
                  <tr key={c._id}>
                    <td>{c.name}</td>
                    <td>
                      <TermSelect
                        school={school}
                        value={term}
                        onChange={(t) => setTerms({ ...terms, [c._id]: t })}
                        className="!py-1.5 text-xs"
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
                        disabled={busy === key || !term}
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

/* ---------------------------------------------------------------- */
/* Admin remarks for a whole class                                   */
/* ---------------------------------------------------------------- */

function RemarksPanel({ onUnsavedChange }: { onUnsavedChange: (n: number) => void }) {
  const { school } = useSchool();
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState('');
  const [cards, setCards] = useState<ReportCard[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    classesApi
      .list()
      .then((cs) => {
        setClassList(cs);
        if (cs.length > 0) setClassId(cs[0]._id);
      })
      .catch((e) => setError(e.message));
    studentsApi.list().then(setStudents).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (school && !term) setTerm(school.currentTerm);
  }, [school, term]);

  const roster = useMemo(
    () => students.filter((s) => s.classId === classId).sort((a, b) => a.name.localeCompare(b.name)),
    [students, classId]
  );
  const cardByStudent = useMemo(() => new Map(cards.map((c) => [c.studentId, c])), [cards]);

  function resetDraft(list: ReportCard[]) {
    setDraft(Object.fromEntries(list.map((c) => [c.studentId, c.adminRemark ?? ''])));
  }

  function load() {
    if (!classId || !term) return;
    setLoading(true);
    reportCardsApi
      .listForClass(classId, term)
      .then((list) => {
        setCards(list);
        resetDraft(list);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setMessage(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, term]);

  const changed = roster.filter((s) => (draft[s._id] ?? '').trim() !== (cardByStudent.get(s._id)?.adminRemark ?? '').trim());

  useEffect(() => onUnsavedChange(changed.length), [changed.length, onUnsavedChange]);

  function guarded<T>(set: (v: T) => void) {
    return (value: T) => {
      if (!confirmDiscard(changed.length)) return;
      set(value);
    };
  }

  async function saveAll() {
    if (changed.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await reportCardsApi.saveSheet({
        classId,
        term,
        entries: changed.map((s) => ({ studentId: s._id, adminRemark: draft[s._id] ?? '' })),
      });
      setMessage(`Saved remarks for ${changed.length} student${changed.length === 1 ? '' : 's'}.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save remarks');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="info-card-sub mb-3">
        Write the head teacher's / admin's remark for every student in a class. It appears on the result card under the
        teacher's comment.
      </p>
      <div className="inline-form">
        <label className="filter-field">
          <span>Class</span>
          <select value={classId} onChange={(e) => guarded(setClassId)(e.target.value)}>
            {classList.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          <span>Term</span>
          <TermSelect school={school} value={term} onChange={guarded(setTerm)} />
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success mb-3">{message}</p>}

      <div className="card">
        {roster.length === 0 ? (
          <p className="info-card-empty">This class has no students yet.</p>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table score-sheet">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Teacher's conduct &amp; comment</th>
                    <th>Admin remark</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="empty-cell">
                        Loading…
                      </td>
                    </tr>
                  ) : (
                    roster.map((s) => {
                      const card = cardByStudent.get(s._id);
                      const isChanged = changed.includes(s);
                      return (
                        <tr key={s._id} className={isChanged ? 'row-changed' : undefined}>
                          <td>
                            {s.name}
                            {isChanged && <div className="text-xs text-amber-700">Not saved yet</div>}
                          </td>
                          <td className="text-sm text-ink-soft max-w-[260px]">
                            {card?.conductRating || card?.teacherComment ? (
                              <>
                                {card.conductRating && <strong className="text-ink">{card.conductRating}. </strong>}
                                {card.teacherComment}
                              </>
                            ) : (
                              'Not written yet'
                            )}
                          </td>
                          <td className="w-full">
                            <input
                              value={draft[s._id] ?? ''}
                              onChange={(e) => {
                                setMessage(null);
                                setDraft((prev) => ({ ...prev, [s._id]: e.target.value }));
                              }}
                              placeholder="e.g. Promoted to the next class"
                              maxLength={500}
                              className="w-full min-w-[200px]"
                              aria-label={`Admin remark for ${s.name}`}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <SheetSaveBar unsaved={changed.length} busy={busy} onUndo={() => resetDraft(cards)} onSave={saveAll} />
          </>
        )}
      </div>
    </div>
  );
}

export default function ResultsReleasePage() {
  const [tab, setTab] = useState<'release' | 'remarks'>('release');
  const [unsaved, setUnsaved] = useState(0);

  useWarnOnLeave(unsaved);

  useHelpFacts([
    `Open tab: ${tab === 'release' ? 'Release results' : 'Admin remarks'}`,
    unsaved > 0 && `There are ${unsaved} unsaved remarks on screen`,
  ]);

  function switchTab(next: 'release' | 'remarks') {
    if (!confirmDiscard(unsaved)) return;
    setUnsaved(0);
    setTab(next);
  }

  return (
    <div>
      <h1>Results</h1>
      <div className="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'release'}
          className={tab === 'release' ? 'tab tab-active' : 'tab'}
          onClick={() => switchTab('release')}
        >
          Release results
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'remarks'}
          className={tab === 'remarks' ? 'tab tab-active' : 'tab'}
          onClick={() => switchTab('remarks')}
        >
          Admin remarks
        </button>
      </div>
      {tab === 'release' ? <ReleasePanel /> : <RemarksPanel onUnsavedChange={setUnsaved} />}
    </div>
  );
}
