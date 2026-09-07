import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboard } from '../api/resources';
import { TeacherClassSummary } from '../api/types';

export default function TeacherDashboardPage() {
  const [classes, setClasses] = useState<TeacherClassSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboard
      .teacher()
      .then((d) => setClasses(d.classes))
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!classes) return <p>Loading...</p>;

  return (
    <div>
      <h1>My Classes</h1>
      {classes.length === 0 ? (
        <p>You're not attached to any class yet.</p>
      ) : (
        <div className="card-grid">
          {classes.map((c) => (
            <div className="info-card" key={c.classId}>
              <div className="info-card-top">
                <span className="info-card-title">{c.name}</span>
                <span className={c.isFormTeacher ? 'role-chip role-chip-form' : 'role-chip'}>
                  {c.isFormTeacher ? 'Form Teacher' : 'Subject Teacher'}
                </span>
              </div>
              <p className="info-card-sub">{c.term}</p>
              <div className="info-card-stats">
                <div>
                  <span className="stat-value-sm">{c.studentCount}</span>
                  <span className="stat-label">Students</span>
                </div>
                <div>
                  <span className="stat-value-sm">
                    {c.todaysAttendance.totalMarked}/{c.studentCount}
                  </span>
                  <span className="stat-label">Marked Today</span>
                </div>
              </div>
              {c.isFormTeacher && (
                <Link to="/attendance" className="info-card-link">
                  Mark attendance →
                </Link>
              )}
              <Link to="/grades" className="info-card-link">
                Enter grades →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
