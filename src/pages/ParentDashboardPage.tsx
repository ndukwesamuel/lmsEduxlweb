import { useEffect, useState } from 'react';
import { dashboard } from '../api/resources';
import { ParentChildSummary } from '../api/types';

export default function ParentDashboardPage() {
  const [children, setChildren] = useState<ParentChildSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboard
      .parent()
      .then((d) => setChildren(d.children))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!children) return <p>Loading...</p>;

  return (
    <div>
      <h1>My Children</h1>
      {children.length === 0 ? (
        <p>No children are linked to your account yet — ask the school admin to link a student to you.</p>
      ) : (
        <div className="card-grid">
          {children.map((child) => (
            <div className="info-card" key={child.studentId}>
              <div className="info-card-top">
                <span className="info-card-title">{child.name}</span>
                {child.presentToday === null ? (
                  <span className="role-chip">Not marked yet</span>
                ) : (
                  <span className={child.presentToday ? 'role-chip role-chip-present' : 'role-chip role-chip-absent'}>
                    {child.presentToday ? 'Present today' : 'Absent today'}
                  </span>
                )}
              </div>

              <p className="info-card-sub">Recent grades</p>
              {child.recentGrades.length === 0 ? (
                <p className="info-card-empty">No grades posted yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table compact">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Term</th>
                        <th>Score</th>
                        <th>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {child.recentGrades.map((g, i) => (
                        <tr key={i}>
                          <td>{g.subject}</td>
                          <td>{g.term}</td>
                          <td>{g.score}</td>
                          <td>
                            <span className={`status-badge grade-${g.letterGrade}`}>{g.letterGrade}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
