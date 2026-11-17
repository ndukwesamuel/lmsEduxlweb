import { useEffect, useMemo, useState } from 'react';
import {
  classes as classesApi,
  fees as feesApi,
  reportCards as reportCardsApi,
  resultReleases as releasesApi,
  students as studentsApi,
} from '../api/resources';
import { Fee, ReportCard, ResultRelease, SchoolClass, Student } from '../api/types';
import TermSelect from '../components/TermSelect';
import SheetSaveBar, { confirmDiscard, useWarnOnLeave } from '../components/SheetSaveBar';
import { useHelpFacts } from '../components/HelpContext';
import { useSchool } from '../hooks/useSchool';
import { useWording } from '../hooks/useWording';

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

/** Pick which pupils of one class get their result. Ticked = parent can see it. */
function PupilPicker({
  klass,
  term,
  release,
  onDone,
  onCancel,
}: {
  klass: SchoolClass;
  term: string;
  release: ResultRelease | undefined;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const words = useWording();
  const pupil = words.pupil.toLowerCase();
  const pupils = words.pupils.toLowerCase();
  const [roster, setRoster] = useState<Student[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [held, setHeld] = useState<Set<string>>(new Set(release?.withheldStudentIds ?? []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    studentsApi
      .list()
      .then((all) => setRoster(all.filter((s) => s.classId === klass._id).sort((a, b) => a.name.localeCompare(b.name))))
      .catch((e) => setError(e.message));
    feesApi.list({ term }).then(setFees).catch(() => setFees([]));
  }, [klass._id, term]);

  useEffect(() => setHeld(new Set(release?.withheldStudentIds ?? [])), [release]);

  const feeByStudent = useMemo(() => new Map(fees.map((f) => [f.studentId, f])), [fees]);
  const owing = roster.filter((s) => {
    const f = feeByStudent.get(s._id);
    return f && f.amountPaid < f.amountAssigned;
  });

  function toggle(id: string) {
    setHeld((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    // Only pupils still in the class count; stale ids are dropped.
    const withheld = roster.filter((s) => held.has(s._id)).map((s) => s._id);
    try {
      if (release) await releasesApi.updateWithheld(klass._id, term, withheld);
      else await releasesApi.release(klass._id, term, withheld);
      const released = roster.length - withheld.length;
      onDone(
        `${klass.name}, ${term}: results released to ${released} ${released === 1 ? pupil : pupils}` +
          (withheld.length > 0 ? `, ${withheld.length} held back.` : '.')
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  }

  const releasing = roster.length - roster.filter((s) => held.has(s._id)).length;

  return (
    <div className="card mb-4">
      <div className="info-card-top mb-2">
        <h2 className="!mb-0">
          {klass.name} — {term}
        </h2>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Close
        </button>
      </div>
      <p className="info-card-sub mb-3">
        <strong className="text-ink">Ticked</strong> {pupils}' parents will see the result.{' '}
        <strong className="text-ink">Untick</strong> a {pupil} to hold their result back (for example, until fees are paid) —
        their parent sees "Result withheld, please contact the school". You can change this at any time.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <button type="button" className="btn-secondary" onClick={() => setHeld(new Set())}>
          Tick everyone
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setHeld(new Set(owing.map((s) => s._id)))}
          disabled={owing.length === 0}
        >
          Hold back everyone who owes fees ({owing.length})
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {roster.length === 0 ? (
        <p className="info-card-empty">This class has no students yet.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table score-sheet">
            <thead>
              <tr>
                <th>Release</th>
                <th>{words.pupil}</th>
                <th>Fees ({term})</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((s) => {
                const fee = feeByStudent.get(s._id);
                const isHeld = held.has(s._id);
                return (
                  <tr key={s._id} className={isHeld ? 'row-problem' : undefined}>
                    <td>
                      <input type="checkbox" checked={!isHeld} onChange={() => toggle(s._id)} aria-label={`Release ${s.name}'s result`} />
                    </td>
                    <td>
                      {s.name}
                      {isHeld && <div className="text-xs text-red-600">Held back</div>}
                    </td>
                    <td className="text-sm">
                      {!fee ? (
                        <span className="text-ink-soft">No fee set</span>
                      ) : fee.amountPaid >= fee.amountAssigned ? (
                        <span className="status-badge fee-paid">paid</span>
                      ) : (
                        <span className="text-red-600 font-semibold">Owes {formatNaira(fee.amountAssigned - fee.amountPaid)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="save-bar">
        <span className="text-sm text-ink-soft">
          {releasing} of {roster.length} {pupils} will see their result
        </span>
        <button type="button" onClick={save} disabled={busy || roster.length === 0}>
          {busy ? 'Saving…' : release ? 'Save changes' : `Release to ${releasing} ${releasing === 1 ? pupil : pupils}`}
        </button>
      </div>
    </div>
  );
}

function ReleasePanel() {
  const { school } = useSchool();
  const words = useWording();
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [releases, setReleases] = useState<ResultRelease[]>([]);
  const [term, setTerm] = useState('');
  const [pickingClassId, setPickingClassId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  useEffect(() => {
    if (school && !term) setTerm(school.currentTerm);
  }, [school, term]);

  const releaseFor = (classId: string) => releases.find((r) => r.classId === classId && r.term === term);
  const pickingClass = classList.find((c) => c._id === pickingClassId);

  async function unrelease(klass: SchoolClass) {
    if (!window.confirm(`Hide ${klass.name}'s ${term} results from all parents again?`)) return;
    setBusy(klass._id);
    setError(null);
    setMessage(null);
    try {
      await releasesApi.unrelease(klass._id, term);
      setMessage(`${klass.name}'s ${term} results are hidden from parents again.`);
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
        Results stay hidden from parents until you release them. Choose the {words.pupils.toLowerCase()} for each class —
        you can hold back individual {words.pupils.toLowerCase()}, for example until their school fees are paid. Attendance
        is always visible.
      </p>

      <div className="inline-form">
        <label className="filter-field">
          <span>Term</span>
          <TermSelect
            school={school}
            value={term}
            onChange={(t) => {
              setTerm(t);
              setPickingClassId(null);
            }}
          />
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success mb-3">{message}</p>}

      {pickingClass && term && (
        <PupilPicker
          klass={pickingClass}
          term={term}
          release={releaseFor(pickingClass._id)}
          onCancel={() => setPickingClassId(null)}
          onDone={(msg) => {
            setMessage(msg);
            setPickingClassId(null);
            refresh();
          }}
        />
      )}

      <div className="card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Status ({term})</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {classList.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty-cell">
                    No classes yet.
                  </td>
                </tr>
              )}
              {classList.map((c) => {
                const release = releaseFor(c._id);
                const heldCount = release?.withheldStudentIds.length ?? 0;
                return (
                  <tr key={c._id}>
                    <td>{c.name}</td>
                    <td>
                      {release ? (
                        <>
                          <span className="status-badge status-Active">Released</span>
                          {heldCount > 0 && <span className="text-xs text-red-600 ml-2">{heldCount} held back</span>}
                        </>
                      ) : (
                        <span className="status-badge status-Applied">Hidden from parents</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <button type="button" onClick={() => setPickingClassId(c._id)} disabled={!term}>
                          {release ? `Change ${words.pupils.toLowerCase()}` : `Choose ${words.pupils.toLowerCase()} & release`}
                        </button>
                        {release && (
                          <button type="button" className="btn-secondary" onClick={() => unrelease(c)} disabled={busy === c._id}>
                            Unrelease
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
