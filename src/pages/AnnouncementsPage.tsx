import { FormEvent, useEffect, useState } from 'react';
import { announcements as announcementsApi } from '../api/resources';
import { Announcement } from '../api/types';

export default function AnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function refresh() {
    announcementsApi.list().then(setList).catch((err) => setError(err.message));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await announcementsApi.create({ title, message });
      setTitle('');
      setMessage('');
      setSuccess('Announcement posted — every parent has been notified.');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post announcement');
    }
  }

  return (
    <div>
      <h1>Announcements</h1>
      <p className="page-subtitle">Broadcasts to every parent's dashboard and notification inbox — e.g. term dates or schedule changes.</p>

      <form className="inline-form" onSubmit={handleSubmit}>
        <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-56" />
        <input
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="flex-1 min-w-[240px]"
          required
        />
        <button type="submit">Post announcement</button>
      </form>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}

      {list.length === 0 ? (
        <p className="info-card-empty">No announcements posted yet.</p>
      ) : (
        <div className="card-grid">
          {list.map((a) => (
            <div className="info-card" key={a._id}>
              <span className="info-card-title">{a.title}</span>
              <p className="info-card-sub">{new Date(a.createdAt).toLocaleString()}</p>
              <p>{a.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
