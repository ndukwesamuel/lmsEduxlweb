import { useEffect, useState } from 'react';
import { announcements as announcementsApi, dashboard, reportCards as reportCardsApi } from '../api/resources';
import { Announcement, FullResultCard, ParentChildSummary } from '../api/types';

const DEFAULT_TERM = '2026 Term 1';

function ResultCardPanel({ studentId }: { studentId: string }) {
  const [term, setTerm] = useState(DEFAULT_TERM);
  const [card, setCard] = useState<FullResultCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    reportCardsApi
      .get(studentId, term)
      .then(setCard)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load result card'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-3 pt-3 border-t border-stone-100">
      <div className="inline-form !mb-3 !p-0 !border-0 !shadow-none !bg-transparent">
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term" className="!py-1.5 text-xs" />
        <button type="button" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Load result card'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {card && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div>
              <div className="stat-label">Overall Attendance</div>
              <div className="stat-value-sm">
                {card.attendance.attendanceRate === null ? '—' : `${card.attendance.attendanceRate.toFixed(0)}%`}
              </div>
            </div>
            <div>
              <div className="stat-label">Class Conduct</div>
              <div className="stat-value-sm">
                {card.conductRating ? (
                  <span className={`status-badge conduct-${card.conductRating.replace(' ', '')}`}>{card.conductRating}</span>
                ) : (
                  '—'
                )}
              </div>
            </div>
          </div>

          {card.teacherComment && (
            <p className="info-card-sub mb-1">
              <strong className="text-ink">Teacher comment:</strong> &ldquo;{card.teacherComment}&rdquo;
            </p>
          )}
          {card.adminRemark && (
            <p className="info-card-sub mb-3">
              <strong className="text-ink">Admin remark:</strong> &ldquo;{card.adminRemark}&rdquo;
            </p>
          )}

          {card.subjects.length === 0 ? (
            <p className="info-card-empty">No subject results for this term yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table compact">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>CA</th>
                    <th>Exam</th>
                    <th>Total</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {card.subjects.map((s, i) => (
                    <tr key={i}>
                      <td>{s.subject}</td>
                      <td>{s.caScore}</td>
                      <td>{s.examScore}</td>
                      <td>{s.total}</td>
                      <td>
                        <span className={`status-badge grade-${s.letterGrade}`}>{s.letterGrade}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ParentDashboardPage() {
  const [children, setChildren] = useState<ParentChildSummary[] | null>(null);
  const [announcementsList, setAnnouncementsList] = useState<Announcement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    dashboard
      .parent()
      .then((d) => setChildren(d.children))
      .catch((err) => setError(err.message));
    announcementsApi.list().then(setAnnouncementsList).catch(() => {});
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!children) return <p>Loading...</p>;

  const latestAnnouncement = announcementsList[0];

  return (
    <div>
      <h1>My Children</h1>

      {latestAnnouncement && (
        <div className="announcement-banner">
          <span className="announcement-banner-title">📣 {latestAnnouncement.title}</span>
          <span className="announcement-banner-message">{latestAnnouncement.message}</span>
        </div>
      )}

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
                        <th>Total</th>
                        <th>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {child.recentGrades.map((g, i) => (
                        <tr key={i}>
                          <td>{g.subject}</td>
                          <td>{g.term}</td>
                          <td>{g.total}</td>
                          <td>
                            <span className={`status-badge grade-${g.letterGrade}`}>{g.letterGrade}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                type="button"
                className="!bg-stone-100 !text-ink hover:!bg-stone-200 self-start mt-1"
                onClick={() => setExpanded({ ...expanded, [child.studentId]: !expanded[child.studentId] })}
              >
                {expanded[child.studentId] ? 'Hide full result card' : 'View full result card'}
              </button>
              {expanded[child.studentId] && <ResultCardPanel studentId={child.studentId} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
