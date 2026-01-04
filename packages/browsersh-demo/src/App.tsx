import React, { useEffect, useState } from 'react';
import { Shell, IframeRuntime } from '@mongosh/browser-repl';
import { InMemoryServiceProvider } from './inMemoryServiceProvider';

const stringifyOutputValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object') {
    if ('message' in value && typeof value.message === 'string') {
      return `Error: ${value.message}`;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

type OutputEntry = {
  key: string | number;
  format: string;
  value: unknown;
  type?: string | null;
};

const formatEntries = (entries: OutputEntry[]) => {
  return entries
    .filter((entry) => entry.format !== 'input')
    .map((entry) => stringifyOutputValue(entry.value))
    .join('\n\n');
};

export const App: React.FC = () => {
  const [runtime, setRuntime] = useState<IframeRuntime | null>(null);

  const [output, setOutput] = useState<OutputEntry[]>([
    {
      key: 'welcome',
      format: 'output',
      value: {
        message:
          'Type mongosh CRUD commands like db.items.insertOne({ name: "apple" }) or db.items.find()',
      },
    },
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);

  const handleOutputChanged = (entries: OutputEntry[]) => {
    setOutput(entries);
  };

  useEffect(() => {
    let isMounted = true;
    const instance = new IframeRuntime(new InMemoryServiceProvider() as any);
    void instance.initialize().then(() => {
      if (isMounted) {
        setRuntime(instance);
      }
    });
    return () => {
      isMounted = false;
      void instance.destroy();
      setRuntime(null);
    };
  }, []);

  return (
    <div className="app">
      <div className="input-panel shell-output-hidden">
        {runtime ? (
          <Shell
            runtime={runtime}
            output={output}
            history={history}
            isOperationInProgress={isOperationInProgress}
            onOutputChanged={handleOutputChanged}
            onHistoryChanged={setHistory}
            onOperationStarted={() => setIsOperationInProgress(true)}
            onOperationEnd={() => setIsOperationInProgress(false)}
          />
        ) : (
          <div className="status">Initializing runtime…</div>
        )}
      </div>
      <div className="output-panel">
        <h2>Result</h2>
        <pre>{formatEntries(output)}</pre>
      </div>
    </div>
  );
};
