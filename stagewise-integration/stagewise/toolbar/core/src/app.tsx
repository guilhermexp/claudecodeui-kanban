import './app.css';

import { ContextProviders } from './components/context-providers';
import { HotkeyListener } from './components/hotkey-listener';
import { DefaultLayout } from './layouts/default';
import { AppStateProvider } from './hooks/use-app-state';
import type { InternalToolbarConfig } from './config';
import { MainAppBlocker } from './components/main-app-blocker';
import { UrlSynchronizer } from './components/url-synchronizer';
import { MetaSynchronizer } from './components/meta-synchronizer';

export function App(config?: InternalToolbarConfig) {
  // Get the initial URL from the parent window
  // Ensure we have a valid path (default to '/' if empty)
  const pathname = window.location.pathname || '/';
  const search = window.location.search || '';
  const hash = window.location.hash || '';
  const initialUrl = pathname + search + hash;

  return (
    <>
      <iframe
        src={initialUrl}
        title="Main user app"
        className="fixed inset-0 m-0 size-full p-0"
        id="user-app-iframe"
      />
      <UrlSynchronizer
        appPort={config?.appPort}
        urlSyncConfig={config?.urlSync}
      />
      <MetaSynchronizer />
      <AppStateProvider>
        <MainAppBlocker />
        <ContextProviders config={config}>
          <HotkeyListener />
          {/* Depending on the screen size, load either the mobile or the desktop companion layout */}
          {/* Until the mobile layout is ready, we will always load the desktop layout */}
          <DefaultLayout />
        </ContextProviders>
      </AppStateProvider>
    </>
  );
}
