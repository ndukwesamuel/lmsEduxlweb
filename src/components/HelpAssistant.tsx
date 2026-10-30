import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { help as helpApi, HelpPage } from '../api/resources';
import { UserRole } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useHelpFactsValue } from './HelpContext';

const PAGE_BY_PATH: Record<string, HelpPage> = {
  '/': 'dashboard',
  '/students': 'students',
  '/admissions': 'admissions',
  '/classes': 'classes',
  '/subjects': 'subjects',
  '/results': 'results',
  '/finance': 'finance',
  '/announcements': 'announcements',
  '/users': 'users',
  '/settings': 'settings',
  '/attendance': 'attendance',
  '/grades': 'grades',
};

// Starter questions, so people see what they can ask.
const SUGGESTIONS: Partial<Record<HelpPage, Partial<Record<UserRole, string[]>>>> = {
  dashboard: {
    admin: ['How do I set up my school?', 'What should I do first?'],
    teacher: ['What can I do here?', 'Why is my class not showing?'],
    parent: ['How do I see my child’s result?', 'Why can’t I see the results?'],
  },
  grades: {
    admin: ['How do I enter grades?', 'Why is the subject list empty?'],
    teacher: ['How do I enter grades?', 'What is the CA score?', 'Why can’t I see my subject?'],
  },
  attendance: {
    admin: ['How do I mark attendance?'],
    teacher: ['How do I mark a student absent?', 'Why can’t I mark attendance?'],
  },
  classes: { admin: ['How do I add subjects to a class?', 'What is a subject teacher?'] },
  subjects: { admin: ['What should I do after adding subjects?', 'What does Deactivate do?'] },
  settings: { admin: ['How do I start a new term?', 'How does the grading scale work?'] },
  results: { admin: ['When should I release results?', 'What do parents see?'] },
  students: { admin: ['How do I link a student to a parent?'] },
  admissions: { admin: ['How do I enrol an applicant?', 'How do parents apply?'] },
  finance: { admin: ['How do I record a fee payment?'] },
  announcements: { admin: ['Who sees announcements?'] },
  users: { admin: ['How do I add a teacher?', 'How does a parent log in?'] },
};

type Message = { role: 'user' | 'assistant'; content: string };

// Renders **bold** and line breaks from the model's reply; everything else as text.
function renderAnswer(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part
  );
}

export default function HelpAssistant() {
  const { user } = useAuth();
  const location = useLocation();
  const facts = useHelpFactsValue();
  const page = PAGE_BY_PATH[location.pathname];

  const [open, setOpen] = useState(false);
  // One conversation per page, kept while the user moves around the app.
  const [conversations, setConversations] = useState<Partial<Record<HelpPage, Message[]>>>({});
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = (page && conversations[page]) || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, busy, open]);

  useEffect(() => setError(null), [page]);

  if (!user || user.role === 'superadmin' || !page) return null;

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy || !page) return;
    setError(null);
    setQuestion('');
    const history = messages.slice(-10);
    setConversations((c) => ({ ...c, [page]: [...history, { role: 'user', content: q }] }));
    setBusy(true);
    try {
      const { answer } = await helpApi.ask({ page, question: q, history, facts });
      setConversations((c) => ({ ...c, [page]: [...(c[page] ?? []), { role: 'assistant', content: answer }] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an answer. Please try again.');
      // Put the question back so they don't have to retype it.
      setConversations((c) => ({ ...c, [page]: history }));
      setQuestion(q);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    ask(question);
  }

  const suggestions = SUGGESTIONS[page]?.[user.role] ?? ['What is this page for?'];

  return (
    <>
      {!open && (
        <button type="button" className="help-fab" onClick={() => setOpen(true)} aria-label="Ask for help">
          <span className="help-fab-icon">?</span>
          <span>Ask for help</span>
        </button>
      )}

      {open && (
        <div className="help-panel" role="dialog" aria-label="Help assistant">
          <div className="help-panel-header">
            <div>
              <div className="font-display font-semibold text-ink">Help</div>
              <div className="text-xs text-ink-soft">Ask anything about this page</div>
            </div>
            <button type="button" className="btn-secondary !px-2.5 !py-1" onClick={() => setOpen(false)} aria-label="Close help">
              ✕
            </button>
          </div>

          <div className="help-panel-body">
            {messages.length === 0 && (
              <div>
                <p className="text-sm text-ink-soft mb-3">
                  Not sure what to do here? Ask a question in your own words, or tap one below.
                </p>
                <div className="flex flex-col items-start gap-2">
                  {suggestions.map((s) => (
                    <button key={s} type="button" className="chip-button !text-left" onClick={() => ask(s)} disabled={busy}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'help-msg help-msg-user' : 'help-msg help-msg-assistant'}>
                {m.role === 'assistant' ? renderAnswer(m.content) : m.content}
              </div>
            ))}
            {busy && <div className="help-msg help-msg-assistant text-ink-soft">Thinking…</div>}
            {error && <p className="error !mb-0">{error}</p>}
            <div ref={bottomRef} />
          </div>

          <form className="help-panel-input" onSubmit={handleSubmit}>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type your question…"
              maxLength={500}
              disabled={busy}
              aria-label="Your question"
            />
            <button type="submit" disabled={busy || !question.trim()}>
              Ask
            </button>
          </form>
        </div>
      )}
    </>
  );
}
