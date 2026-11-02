import { FormEvent, useEffect, useMemo, useState } from 'react';
import { classes as classesApi, expenses as expensesApi, fees as feesApi, students as studentsApi } from '../api/resources';
import { Expense, Fee, SchoolClass, Student } from '../api/types';
import TermSelect from '../components/TermSelect';
import SheetSaveBar, { confirmDiscard, useWarnOnLeave } from '../components/SheetSaveBar';
import { useHelpFacts } from '../components/HelpContext';
import { useSchool } from '../hooks/useSchool';

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

type FeeDraft = Record<string, { fee: string; paid: string }>;

function parseAmount(value: string): number | null | 'invalid' {
  if (value.trim() === '') return null;
  const n = Number(value.replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 'invalid';
}

/* ---------------------------------------------------------------- */
/* School fees: one row per student in the chosen class              */
/* ---------------------------------------------------------------- */

function FeeSheet({
  term,
  roster,
  fees,
  onSaved,
  onUnsavedChange,
}: {
  term: string;
  roster: Student[];
  fees: Fee[];
  onSaved: () => void;
  onUnsavedChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState<FeeDraft>({});
  const [sameFee, setSameFee] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const feeByStudent = useMemo(() => new Map(fees.map((f) => [f.studentId, f])), [fees]);

  function resetDraft() {
    const next: FeeDraft = {};
    for (const f of fees) next[f.studentId] = { fee: String(f.amountAssigned), paid: String(f.amountPaid) };
    setDraft(next);
  }

  useEffect(resetDraft, [fees]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = roster.map((student) => {
    const d = draft[student._id] ?? { fee: '', paid: '' };
    const saved = feeByStudent.get(student._id);
    const fee = parseAmount(d.fee);
    const paid = parseAmount(d.paid);
    const changed = saved
      ? d.fee !== String(saved.amountAssigned) || d.paid !== String(saved.amountPaid)
      : d.fee.trim() !== '' || d.paid.trim() !== '';
    let problem: string | null = null;
    if (fee === 'invalid' || paid === 'invalid') problem = 'Amounts must be numbers, 0 or more';
    else if (changed && fee === null) problem = saved ? 'Use Remove to delete a fee' : 'Enter the fee first';
    const balance = typeof fee === 'number' ? fee - (typeof paid === 'number' ? paid : 0) : null;
    return { student, d, saved, fee, paid, changed, problem, balance };
  });

  const changedRows = rows.filter((r) => r.changed);
  const hasProblems = changedRows.some((r) => r.problem);

  useEffect(() => onUnsavedChange(changedRows.length), [changedRows.length, onUnsavedChange]);

  const expected = rows.reduce((sum, r) => sum + (typeof r.fee === 'number' ? r.fee : 0), 0);
  const collected = rows.reduce((sum, r) => sum + (typeof r.paid === 'number' ? r.paid : 0), 0);

  function setCell(studentId: string, field: 'fee' | 'paid', value: string) {
    setMessage(null);
    setDraft((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] ?? { fee: '', paid: '' }), [field]: value } }));
  }

  function applySameFee() {
    const amount = parseAmount(sameFee);
    if (typeof amount !== 'number') return;
    setMessage(null);
    setDraft((prev) => {
      const next = { ...prev };
      for (const s of roster) next[s._id] = { fee: String(amount), paid: prev[s._id]?.paid ?? '' };
      return next;
    });
  }

  async function saveAll() {
    if (changedRows.length === 0 || hasProblems) return;
    setBusy(true);
    setError(null);
    try {
      await feesApi.saveSheet(
        term,
        changedRows.map((r) => ({
          studentId: r.student._id,
          amountAssigned: r.fee as number,
          amountPaid: typeof r.paid === 'number' ? r.paid : 0,
        }))
      );
      setMessage(`Saved fees for ${changedRows.length} student${changedRows.length === 1 ? '' : 's'}.`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save fees');
    } finally {
      setBusy(false);
    }
  }

  async function removeFee(student: Student, fee: Fee) {
    if (!window.confirm(`Remove ${student.name}'s fee for ${term} (${formatNaira(fee.amountAssigned)}, paid ${formatNaira(fee.amountPaid)})?`)) return;
    setBusy(true);
    setError(null);
    try {
      await feesApi.remove(fee._id);
      setMessage(`Removed ${student.name}'s fee.`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove fee');
    } finally {
      setBusy(false);
    }
  }

  if (roster.length === 0) return <p className="info-card-empty">This class has no students yet.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 mb-3">
        <label className="filter-field">
          <span>Same fee for the whole class (₦)</span>
          <input
            type="number"
            min={0}
            value={sameFee}
            onChange={(e) => setSameFee(e.target.value)}
            placeholder="e.g. 45000"
            className="sheet-input w-40"
          />
        </label>
        <button type="button" className="btn-secondary" onClick={applySameFee} disabled={typeof parseAmount(sameFee) !== 'number'}>
          Fill every row
        </button>
      </div>
      <p className="info-card-sub mb-3">
        For each student, type the term's fee and the <strong className="text-ink">total paid so far</strong>. When a parent pays
        again, increase "Paid so far", then click <strong className="text-ink">Save all</strong>.
      </p>

      {error && <p className="error">{error}</p>}
      {message && <p className="success mb-3">{message}</p>}

      <div className="table-scroll">
        <table className="data-table score-sheet">
          <thead>
            <tr>
              <th>Student</th>
              <th>Fee (₦)</th>
              <th>Paid so far (₦)</th>
              <th>Balance</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student._id} className={r.problem ? 'row-problem' : r.changed ? 'row-changed' : undefined}>
                <td>
                  {r.student.name}
                  {r.problem ? (
                    <div className="text-xs text-red-600">{r.problem}</div>
                  ) : r.changed ? (
                    <div className="text-xs text-amber-700">Not saved yet</div>
                  ) : null}
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={r.d.fee}
                    onChange={(e) => setCell(r.student._id, 'fee', e.target.value)}
                    className={r.fee === 'invalid' ? 'input-invalid w-28' : 'w-28'}
                    aria-label={`Fee for ${r.student.name}`}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={r.d.paid}
                    onChange={(e) => setCell(r.student._id, 'paid', e.target.value)}
                    className={r.paid === 'invalid' ? 'input-invalid w-28' : 'w-28'}
                    aria-label={`Amount paid by ${r.student.name}`}
                  />
                </td>
                <td className={r.balance !== null && r.balance < 0 ? 'text-amber-700 font-semibold' : 'font-semibold'}>
                  {r.balance === null ? '—' : r.balance < 0 ? `Overpaid ${formatNaira(-r.balance)}` : formatNaira(r.balance)}
                </td>
                <td>
                  {r.balance === null ? (
                    '—'
                  ) : r.balance <= 0 ? (
                    <span className="status-badge fee-paid">paid</span>
                  ) : typeof r.paid === 'number' && r.paid > 0 ? (
                    <span className="status-badge fee-partial">partial</span>
                  ) : (
                    <span className="status-badge fee-unpaid">unpaid</span>
                  )}
                </td>
                <td className="text-right">
                  {r.saved ? (
                    <button type="button" className="btn-danger-soft" onClick={() => removeFee(r.student, r.saved!)} disabled={busy}>
                      Remove
                    </button>
                  ) : r.changed ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setDraft((prev) => {
                          const next = { ...prev };
                          delete next[r.student._id];
                          return next;
                        })
                      }
                    >
                      Clear
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td>Class total</td>
              <td>{formatNaira(expected)}</td>
              <td>{formatNaira(collected)}</td>
              <td>{formatNaira(Math.max(expected - collected, 0))} owed</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <SheetSaveBar unsaved={changedRows.length} hasProblems={hasProblems} busy={busy} onUndo={resetDraft} onSave={saveAll} />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                              */
/* ---------------------------------------------------------------- */

export default function FinancePage() {
  const { school } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [classList, setClassList] = useState<SchoolClass[]>([]);
  const [feeList, setFeeList] = useState<Fee[]>([]);
  const [expenseList, setExpenseList] = useState<Expense[]>([]);
  const [term, setTerm] = useState('');
  const [classId, setClassId] = useState('');
  const [tab, setTab] = useState<'fees' | 'expenses'>('fees');
  const [unsaved, setUnsaved] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  useWarnOnLeave(unsaved);

  useEffect(() => {
    if (school && !term) setTerm(school.currentTerm);
  }, [school, term]);

  function refreshFees() {
    if (!term) return;
    feesApi.list({ term }).then(setFeeList).catch((err) => setError(err.message));
  }

  useEffect(() => {
    studentsApi.list().then(setStudents).catch((err) => setError(err.message));
    expensesApi.list().then(setExpenseList).catch((err) => setError(err.message));
    classesApi
      .list()
      .then((cs) => {
        setClassList(cs);
        if (cs.length > 0) setClassId(cs[0]._id);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refreshFees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const roster = useMemo(
    () => students.filter((s) => s.classId === classId).sort((a, b) => a.name.localeCompare(b.name)),
    [students, classId]
  );
  const classFees = useMemo(() => {
    const ids = new Set(roster.map((s) => s._id));
    return feeList.filter((f) => ids.has(f.studentId));
  }, [feeList, roster]);

  function guarded<T>(set: (v: T) => void) {
    return (value: T) => {
      if (!confirmDiscard(unsaved)) return;
      setUnsaved(0);
      set(value);
    };
  }

  async function handleAddExpense(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await expensesApi.create({ category: expenseCategory, description: expenseDescription, amount: Number(expenseAmount) });
      setExpenseCategory('');
      setExpenseDescription('');
      setExpenseAmount('');
      expensesApi.list().then(setExpenseList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add expense');
    }
  }

  const totalIncome = feeList.reduce((sum, f) => sum + f.amountPaid, 0);
  const totalOwed = feeList.reduce((sum, f) => sum + Math.max(f.amountAssigned - f.amountPaid, 0), 0);
  const totalExpense = expenseList.reduce((sum, e) => sum + e.amount, 0);
  const selectedClass = classList.find((c) => c._id === classId);

  useHelpFacts([
    `Open tab: ${tab === 'fees' ? 'School fees' : 'Expenses'}`,
    term && `Selected term: ${term}`,
    tab === 'fees' && selectedClass && `Selected class: ${selectedClass.name} (${roster.length} students, ${classFees.length} with a fee set)`,
    classList.length === 0 && 'The school has no classes yet',
    unsaved > 0 && `There are ${unsaved} unsaved changes on screen`,
  ]);

  return (
    <div>
      <h1>Finance</h1>
      <p className="page-subtitle">School fees per class and term, and the school's expenses.</p>

      <section className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Fees collected ({term})</span>
          <span className="stat-value text-brand-700">{formatNaira(totalIncome)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Still owed ({term})</span>
          <span className="stat-value text-amber-700">{formatNaira(totalOwed)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total expenses (all time)</span>
          <span className="stat-value text-red-600">{formatNaira(totalExpense)}</span>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <div className="tab-bar" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'fees'}
          className={tab === 'fees' ? 'tab tab-active' : 'tab'}
          onClick={() => guarded(setTab)('fees')}
        >
          School fees
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'expenses'}
          className={tab === 'expenses' ? 'tab tab-active' : 'tab'}
          onClick={() => guarded(setTab)('expenses')}
        >
          Expenses
        </button>
      </div>

      {tab === 'fees' ? (
        <>
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
          <div className="card">
            {classList.length === 0 ? (
              <p className="info-card-empty">Create classes and add students first, then set their fees here.</p>
            ) : (
              term && <FeeSheet term={term} roster={roster} fees={classFees} onSaved={refreshFees} onUnsavedChange={setUnsaved} />
            )}
          </div>
        </>
      ) : (
        <>
          <form className="inline-form" onSubmit={handleAddExpense}>
            <input placeholder="Category, e.g. Supplies" value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} required />
            <input
              placeholder="Description"
              value={expenseDescription}
              onChange={(e) => setExpenseDescription(e.target.value)}
              className="flex-1 min-w-[200px]"
              required
            />
            <input
              type="number"
              min={0}
              placeholder="Amount (₦)"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              className="w-40"
              required
            />
            <button type="submit">Add expense</button>
          </form>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenseList.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-cell">
                      No expenses recorded yet.
                    </td>
                  </tr>
                )}
                {expenseList.map((exp) => (
                  <tr key={exp._id}>
                    <td>{new Date(exp.date).toLocaleDateString()}</td>
                    <td>{exp.category}</td>
                    <td>{exp.description}</td>
                    <td>{formatNaira(exp.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
