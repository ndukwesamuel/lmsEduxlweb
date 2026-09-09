import { FormEvent, useEffect, useState } from 'react';
import { expenses as expensesApi, fees as feesApi, students as studentsApi } from '../api/resources';
import { Expense, Fee, Student } from '../api/types';

const DEFAULT_TERM = '2026 Term 1';

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export default function FinancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [feeList, setFeeList] = useState<Fee[]>([]);
  const [expenseList, setExpenseList] = useState<Expense[]>([]);
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [error, setError] = useState<string | null>(null);

  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignAmount, setAssignAmount] = useState('');

  const [expenseCategory, setExpenseCategory] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');

  function refreshFees() {
    feesApi.list({ term }).then(setFeeList).catch((err) => setError(err.message));
  }

  useEffect(() => {
    studentsApi.list().then(setStudents).catch((err) => setError(err.message));
    expensesApi.list().then(setExpenseList).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    refreshFees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  function studentName(id: string) {
    return students.find((s) => s._id === id)?.name ?? id;
  }

  async function handleAssignFee(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await feesApi.assign(assignStudentId, term, Number(assignAmount));
      setAssignStudentId('');
      setAssignAmount('');
      refreshFees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign fee');
    }
  }

  async function handleRecordPayment(fee: Fee) {
    const input = window.prompt(`Amount paid so far for ${studentName(fee.studentId)} (of ${formatNaira(fee.amountAssigned)}):`, String(fee.amountPaid));
    if (input === null) return;
    const amountPaid = Number(input);
    if (Number.isNaN(amountPaid) || amountPaid < 0) return;
    try {
      await feesApi.recordPayment(fee._id, amountPaid);
      refreshFees();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    }
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
  const totalExpense = expenseList.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <h1>Finance</h1>
      <p className="page-subtitle">Fees collected per student, alongside expenses and operational costs.</p>

      <section className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Fees Collected ({term})</span>
          <span className="stat-value text-brand-700">{formatNaira(totalIncome)}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Expenses (all time)</span>
          <span className="stat-value text-red-600">{formatNaira(totalExpense)}</span>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <h2>Student fees</h2>
      <div className="inline-form">
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term" />
      </div>
      <form className="inline-form" onSubmit={handleAssignFee}>
        <select value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)} required>
          <option value="" disabled>
            Select student
          </option>
          {students.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          placeholder="Fee amount (₦)"
          value={assignAmount}
          onChange={(e) => setAssignAmount(e.target.value)}
          className="w-40"
          required
        />
        <button type="submit">Assign fee</button>
      </form>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Assigned</th>
              <th>Paid</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {feeList.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-cell">
                  No fees assigned for {term} yet.
                </td>
              </tr>
            )}
            {feeList.map((f) => (
              <tr key={f._id}>
                <td>{studentName(f.studentId)}</td>
                <td>{formatNaira(f.amountAssigned)}</td>
                <td>{formatNaira(f.amountPaid)}</td>
                <td>
                  <span className={`status-badge fee-${f.status}`}>{f.status}</span>
                </td>
                <td>
                  <button onClick={() => handleRecordPayment(f)}>Record payment</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-8">Expenses</h2>
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
    </div>
  );
}
