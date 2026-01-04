import React, { useEffect, useMemo, useState } from 'react';
import { ThemeProvider, Theme, css } from '@mongodb-js/compass-components';
import { Shell, IframeRuntime } from '@mongosh/browser-repl';
import { InMemoryServiceProvider } from './inMemoryServiceProvider';

const appContainer = css({
  height: '100vh',
  width: '100vw',
});

const shellContainer = css({
  height: '100%',
});

export const App: React.FC = () => {
  const runtime = useMemo(() => {
    return new IframeRuntime(new InMemoryServiceProvider() as any);
  }, []);

  const [output, setOutput] = useState<any[]>([
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

  useEffect(() => {
    void runtime.initialize();
    return () => {
      void runtime.destroy();
    };
  }, [runtime]);

  return (
    <div className={appContainer}>
      <ThemeProvider theme={{ theme: Theme.Light, enabled: true }}>
        <div className={shellContainer}>
          <Shell
            runtime={runtime}
            output={output}
            history={history}
            isOperationInProgress={isOperationInProgress}
            onOutputChanged={setOutput}
            onHistoryChanged={setHistory}
            onOperationStarted={() => setIsOperationInProgress(true)}
            onOperationEnd={() => setIsOperationInProgress(false)}
          />
        </div>
      </ThemeProvider>
    </div>
  );
};
