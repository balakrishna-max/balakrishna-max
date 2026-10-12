import React, { useState } from 'react';
import FormLibrary from './pages/FormLibrary';
import FormBuilder from './pages/FormBuilder';
import { reloadLibrary } from './api/navigation';
import { AppContext } from './config/AppContext';

export default function App({ config }) {
  const [view, setView] = useState({ name: 'library' });
  const [savedSomething, setSavedSomething] = useState(false);

  const backToLibrary = () => {
    if (savedSomething && !config.standalone) {
      reloadLibrary();
      return;
    }
    setView({ name: 'library' });
    window.scrollTo(0, 0);
  };

  const open = (v) => { setView(v); window.scrollTo(0, 0); };

  return (
    <AppContext.Provider value={{ contextPath: config.contextPath || '' }}>
    <div className="dfb">
      {view.name === 'library' ? (
        <FormLibrary
          forms={config.forms || []}
          onCreate={(layout) => open({ name: 'builder', mode: 'new', layout, n: Date.now() })}
          onEdit={(id) => open({ name: 'builder', mode: 'edit', id, n: Date.now() })}
          onClone={(id) => open({ name: 'builder', mode: 'clone', id, n: Date.now() })}
        />
      ) : (
        <FormBuilder
          key={view.n}
          mode={view.mode}
          sourceFormId={view.id}
          initialLayout={view.layout}
          config={config}
          onExit={backToLibrary}
          onSavedOnce={() => setSavedSomething(true)}
        />
      )}
    </div>
    </AppContext.Provider>
  );
}
