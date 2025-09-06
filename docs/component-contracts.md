# Component Contracts - Manager Components

## 🎯 DESIGN PHILOSOPHY

### Principles
1. **Single Responsibility** - Each manager handles one specific domain
2. **Context First** - Use React Context for cross-component communication
3. **Event-Driven** - Managers emit events, not direct prop drilling
4. **Minimal Props** - Only essential data passed as props
5. **Composable** - Managers wrap children, don't own rendering

### Communication Pattern
```jsx
// GOOD: Context-based communication
const { openModal, closeModal } = useModalManager();
const { activeSidePanel, openPanel } = useSidePanelManager();

// BAD: Props drilling
<Component 
  showModal={showModal} 
  onModalClose={onModalClose}
  activeSidePanel={activeSidePanel}
  onPanelOpen={onPanelOpen}
  // ... 30+ more props
/>
```

---

## 🏷️ MODAL MANAGER

### Purpose
Centralize all modal state and rendering logic.

### Context API
```typescript
interface ModalManagerContext {
  // State
  activeModal: 'projects' | 'git' | 'prompts' | 'enhancer' | null;
  modals: {
    projects: boolean;
    git: boolean; 
    prompts: boolean;
    enhancer: boolean;
  };
  
  // Actions
  showModal: (modal: ModalType) => void;
  hideModal: (modal?: ModalType) => void;
  hideAllModals: () => void;
  
  // Props for modal components
  modalProps: Record<string, any>;
  setModalProps: (modal: ModalType, props: any) => void;
}
```

### Usage
```jsx
// Provider level
<ModalManager>
  <App />
</ModalManager>

// Consumer level
function SomeComponent() {
  const { showModal, hideModal } = useModalManager();
  
  return (
    <button onClick={() => showModal('projects')}>
      Open Projects
    </button>
  );
}
```

### Props Required
```typescript
interface ModalManagerProps {
  children: React.ReactNode;
  // Modal-specific props passed from App
  projects?: Project[];
  selectedProject?: Project;
  onProjectSelect?: (project: Project) => void;
  // ... other modal props
}
```

---

## 📱 SIDE PANEL MANAGER

### Purpose 
Manage side panel visibility, animations, and state.

### Context API
```typescript
interface SidePanelManagerContext {
  // State
  activeSidePanel: 'claude-chat' | 'codex-chat' | null;
  panels: {
    'claude-chat': {
      isOpen: boolean;
      sessionId: string | null;
      controls: any;
    };
    'codex-chat': {
      isOpen: boolean;
      controls: any;
    };
  };
  
  // Actions
  openPanel: (panel: PanelType) => void;
  closePanel: (panel?: PanelType) => void;
  togglePanel: (panel: PanelType) => void;
  
  // Panel controls
  setPanelControls: (panel: PanelType, controls: any) => void;
  getPanelControls: (panel: PanelType) => any;
  
  // Animation state
  isAnimating: boolean;
}
```

### Events Emitted
```typescript
// Custom events for loose coupling
'sidepanel:opened' - { panel: PanelType }
'sidepanel:closed' - { panel: PanelType }
'sidepanel:animation-end' - { panel: PanelType }
```

### Usage
```jsx
// Provider
<SidePanelManager>
  <MainLayout />
</SidePanelManager>

// Consumer
function HeaderButton() {
  const { togglePanel, activeSidePanel } = useSidePanelManager();
  
  return (
    <button 
      onClick={() => togglePanel('claude-chat')}
      className={activeSidePanel === 'claude-chat' ? 'active' : ''}
    >
      Claude
    </button>
  );
}
```

---

## 📂 FILE MANAGER

### Purpose
Handle file editing state, CodeEditor integration, and file operations.

### Context API
```typescript
interface FileManagerContext {
  // State  
  editingFile: EditingFile | null;
  openFiles: EditingFile[];
  unsavedFiles: Set<string>;
  
  // Actions
  openFile: (filePath: string, options?: OpenFileOptions) => void;
  closeFile: (filePath: string) => void;
  saveFile: (filePath: string) => Promise<boolean>;
  
  // File options
  setMdPreview: (filePath: string, force: boolean) => void;
  
  // File content
  getFileContent: (filePath: string) => string;
  setFileContent: (filePath: string, content: string) => void;
}

interface EditingFile {
  name: string;
  path: string;
  projectName?: string;
  diffInfo?: any;
  content?: string;
  isDirty?: boolean;
  forceMdPreview?: boolean;
}
```

### Global Handlers (Temporary)
```javascript
// These will be managed by FileManager
window.__openMarkdown = (path) => fileManager.openFile(path, { forceMd: true });
```

### Usage
```jsx
// Provider
<FileManager selectedProject={selectedProject}>
  <App />  
</FileManager>

// Consumer  
function FileButton({ filePath }) {
  const { openFile } = useFileManager();
  
  return (
    <button onClick={() => openFile(filePath)}>
      Open {filePath}
    </button>
  );
}
```

---

## 🔄 CONTEXT WINDOW MANAGER

### Purpose
Track Claude/Codex context usage and provide visual feedback.

### Context API
```typescript
interface ContextWindowManagerContext {
  // State
  contextUsage: {
    claude: number;
    codex: number;
  };
  contextLimits: {
    claude: number;
    codex: number;
  };
  contextPercentage: number;
  
  // Actions
  resetContext: (provider: 'claude' | 'codex') => void;
  updateUsage: (provider: string, used: number) => void;
  
  // WebSocket integration
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected';
}
```

### WebSocket Integration
```typescript
// ContextWindowManager will handle these internally
registerMessageHandler('ctx-window', handleContextUpdate);
registerMessageHandler('ctx-reset', handleContextReset);
```

### Usage
```jsx
// Provider (wraps WebSocket)
<ClaudeWebSocketProvider>
  <ContextWindowManager>
    <App />
  </ContextWindowManager>
</ClaudeWebSocketProvider>

// Consumer
function ContextChip() {
  const { contextPercentage } = useContextWindowManager();
  
  return (
    <div className={`context-chip ${contextPercentage > 80 ? 'warning' : ''}`}>
      {contextPercentage}%
    </div>
  );
}
```

---

## 🔌 SESSION MANAGER

### Purpose
Manage session state, overlay controls, and chat activity.

### Context API
```typescript
interface SessionManagerContext {
  // Session state
  sessions: {
    claude: {
      id: string | null;
      controls: any;
      isActive: boolean;
    };
    codex: {
      controls: any;
      isActive: boolean;
    };
  };
  
  // Activity tracking
  chatActivity: boolean;
  
  // Actions
  setSessionId: (provider: 'claude' | 'codex', id: string) => void;
  setSessionControls: (provider: 'claude' | 'codex', controls: any) => void;
  setChatActivity: (active: boolean) => void;
  
  // Utilities
  ensureProviderReady: (provider: 'claude' | 'codex') => Promise<boolean>;
}
```

### Props Required
```typescript
interface SessionManagerProps {
  children: React.ReactNode;
  // Session callbacks from App
  onSessionActive?: () => void;
  onSessionInactive?: () => void;
  onReplaceTemporarySession?: (oldId: string, newId: string) => void;
  onNavigateToSession?: (sessionId: string) => void;
}
```

---

## 🎛️ TAB MANAGER

### Purpose  
Handle tab navigation and state (currently minimal since only Shell tab active).

### Context API
```typescript
interface TabManagerContext {
  // State
  activeTab: 'shell' | 'files' | 'git' | 'dashboard';
  availableTabs: TabConfig[];
  
  // Actions
  setActiveTab: (tab: TabType) => void;
  
  // Mobile support
  isMobile: boolean;
}

interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}
```

### Global Integration
```javascript
// TabManager will handle this
window.switchToTab = (tab) => tabManager.setActiveTab(tab);
```

---

## 🌐 UI STATE MANAGER

### Purpose
Handle miscellaneous UI state like toast, productivity mode, etc.

### Context API
```typescript
interface UIStateManagerContext {
  // State
  toast: { message: string; type?: 'info' | 'error' | 'success' } | null;
  productivityMode: boolean;
  shellResizeTrigger: number;
  
  // Actions
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  hideToast: () => void;
  toggleProductivityMode: () => void;
  triggerShellResize: () => void;
}
```

---

## 🔗 INTEGRATION PATTERN

### Main Layout Composition
```jsx
function App() {
  return (
    <UIStateManager>
      <SessionManager>
        <ContextWindowManager>
          <FileManager>
            <ModalManager>
              <SidePanelManager>
                <TabManager>
                  <MainContent />
                </TabManager>
              </SidePanelManager>
            </ModalManager>
          </FileManager>
        </ContextWindowManager>
      </SessionManager>
    </UIStateManager>
  );
}
```

### Refactored MainContent
```jsx
function MainContent() {
  // No internal state - just layout
  const { activeModal } = useModalManager();
  const { activeSidePanel } = useSidePanelManager();
  const { activeTab } = useTabManager();
  
  return (
    <div className="main-layout">
      <Header />
      <MainArea>
        <Shell />
        <SidePanels />
      </MainArea>
      <Modals />
    </div>
  );
}
```

### Event System (Optional)
```typescript
// Lightweight event system for loose coupling
interface EventSystem {
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (data?: any) => void) => () => void;
  off: (event: string, handler: (data?: any) => void) => void;
}

// Usage
const events = useEventSystem();
events.on('file:opened', (file) => {
  console.log('File opened:', file.path);
});
```

---

## 🚦 MIGRATION STRATEGY

### Phase 1: Create Managers
1. Create blank manager components
2. Implement Context APIs
3. Create useManager hooks
4. Add provider wrappers

### Phase 2: Extract Logic
1. Move state from MainContent to managers
2. Replace useState with context calls
3. Move useEffect logic to managers
4. Test each extraction

### Phase 3: Clean MainContent  
1. Remove extracted logic
2. Replace with context calls
3. Simplify component structure
4. Test full integration

### Phase 4: Optimize
1. Add event system if needed
2. Optimize re-renders
3. Add error boundaries
4. Performance testing
