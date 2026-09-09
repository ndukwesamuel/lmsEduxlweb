import { useEffect, useState } from 'react';
import { dashboard } from '../api/resources';
import { DashboardSummary } from '../api/types';

const STAGE_ORDER = [
  'Applied',
  'Reviewed',
  'Interview',
  'Approved',
  'Registered',
  'Active',
  'Rejected',
  'Not Admitted',
  'Withdrawn',
];

function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboard
      .summary()
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!summary) return <p>Loading dashboard...</p>;

  const rate = summary.todaysAttendance.rate;

  return (
    <div>
      <h1>Admin Dashboard</h1>

      <section className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Total Active Students</span>
          <span className="stat-value">{summary.totalActiveStudents}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Today's Attendance Rate</span>
          <span className="stat-value">{rate === null ? 'No data yet' : `${Math.round(rate * 100)}%`}</span>
          <span className="stat-sub">
            {summary.todaysAttendance.present} / {summary.todaysAttendance.totalMarked} marked present
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Income</span>
          <span className="stat-value text-brand-700">{formatNaira(summary.finance.totalIncome)}</span>
          <span className="stat-sub">Fees collected to date</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Expense</span>
          <span className="stat-value text-red-600">{formatNaira(summary.finance.totalExpense)}</span>
          <span className="stat-sub">Operational costs to date</span>
        </div>
      </section>

      <div className="card-grid">
        <div className="info-card">
          <h2 className="info-card-title">Applicants by Stage</h2>
          <div className="table-scroll">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {STAGE_ORDER.map((stage) => (
                  <tr key={stage}>
                    <td>{stage}</td>
                    <td>{summary.admissionsByStage[stage] ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="info-card">
          <h2 className="info-card-title">Students Per Class</h2>
          {summary.studentsPerClass.length === 0 ? (
            <p className="info-card-empty">No active students enrolled yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Enrolled students</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.studentsPerClass.map((row) => (
                    <tr key={row.classId}>
                      <td>{row.name}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
