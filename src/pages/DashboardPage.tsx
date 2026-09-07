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
      </section>

      <h2>Applicants by Stage</h2>
      <div className="table-scroll">
        <table className="data-table">
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
  );
}
