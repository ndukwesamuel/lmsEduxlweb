import { useEffect } from 'react';

// Shared pieces for the "sheet" screens (grades, conduct, fees, remarks):
// type into every row, then one Save all.

/** Ask before throwing away typed-in work. */
export function confirmDiscard(unsaved: number): boolean {
  return unsaved === 0 || window.confirm(`You have ${unsaved} unsaved change${unsaved === 1 ? '' : 's'}. Leave without saving?`);
}

/** Warn when closing or reloading the tab with unsaved changes. */
export function useWarnOnLeave(unsaved: number) {
  useEffect(() => {
    if (unsaved === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [unsaved]);
}

export default function SheetSaveBar({
  unsaved,
  hasProblems = false,
  busy,
  onUndo,
  onSave,
}: {
  unsaved: number;
  hasProblems?: boolean;
  busy: boolean;
  onUndo: () => void;
  onSave: () => void;
}) {
  return (
    <div className="save-bar">
      <span className="text-sm text-ink-soft">
        {unsaved === 0
          ? 'All changes saved.'
          : hasProblems
            ? 'Fix the rows marked in red to save.'
            : `${unsaved} unsaved change${unsaved === 1 ? '' : 's'}`}
      </span>
      <div className="flex gap-2">
        {unsaved > 0 && (
          <button type="button" className="btn-secondary" onClick={onUndo} disabled={busy}>
            Undo changes
          </button>
        )}
        <button type="button" onClick={onSave} disabled={busy || unsaved === 0 || hasProblems}>
          {busy ? 'Saving…' : 'Save all'}
        </button>
      </div>
    </div>
  );
}
