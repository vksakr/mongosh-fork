import React, { useEffect, useMemo, useState } from 'react';
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
  const runtime = useMemo(() => {
    return new IframeRuntime(new InMemoryServiceProvider() as any);
  }, []);

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
    void runtime.initialize();
    return () => {
      void runtime.destroy();
    };
  }, [runtime]);

  return (
    <div className="app">
      <div className="input-panel shell-output-hidden">
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
      </div>
      <div className="output-panel">
        <h2>Result</h2>
        <pre>{formatEntries(output)}</pre>
      </div>
    </div>
  );
};
