import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

// Pages describe what's on screen right now ("This class has no subjects
// yet") so the help assistant can answer about the user's actual situation.
// Facts must never include student names, scores or contact details.

const HelpFactsContext = createContext<{ facts: string[]; setFacts: (f: string[]) => void }>({
  facts: [],
  setFacts: () => {},
});

export function HelpProvider({ children }: { children: ReactNode }) {
  const [facts, setFacts] = useState<string[]>([]);
  return <HelpFactsContext.Provider value={{ facts, setFacts }}>{children}</HelpFactsContext.Provider>;
}

export function useHelpFactsValue(): string[] {
  return useContext(HelpFactsContext).facts;
}

export function useHelpFacts(facts: (string | false | null | undefined)[]) {
  const { setFacts } = useContext(HelpFactsContext);
  const list = facts.filter((f): f is string => Boolean(f));
  const key = JSON.stringify(list);
  useEffect(() => {
    setFacts(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setFacts]);
  useEffect(() => () => setFacts([]), [setFacts]);
}
