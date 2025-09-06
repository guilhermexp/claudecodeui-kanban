# MainContent.jsx - Mapeamento de Responsabilidades

## 📊 MÉTRICAS
- **Linhas totais**: 1.056
- **Props recebidas**: 34 props
- **Estado local**: 16 variáveis useState
- **Efeitos**: 7 useEffect hooks
- **Handlers**: 8+ funções

---

## 🏗️ RESPONSABILIDADES IDENTIFICADAS

### 1. 📂 **FILE_MANAGEMENT** (Linhas 71-72, 187-217)
**Estado:**
- `editingFile` - Arquivo sendo editado
- `forceMdPreview` - Forçar preview markdown

**Handlers:**
- `handleFileOpen()` - Abre arquivo no editor
- `handleCloseEditor()` - Fecha editor
- `window.__openMarkdown` - Global handler para markdown

**Componentes relacionados:**
- `CodeEditor` (linhas 969-976)

### 2. 🔄 **CONTEXT_WINDOW_MANAGEMENT** (Linhas 74, 96, 115-168)
**Estado:**
- `contextWindowPercentage` - % de contexto usado
- `ctxUsed` - Tokens usados por provider

**Efeitos:**
- Context window WebSocket listener (115-151)
- Session reset listener (153-168)

### 3. 📱 **SIDE_PANEL_MANAGEMENT** (Linhas 77-78, 171-175, 237-255, 883-933)
**Estado:**
- `activeSidePanel` - Panel ativo ('claude-chat' | 'codex-chat')
- `hasPreviewOpen` - Se preview está aberto
- `shellVisible` - Se terminal está visível

**Handlers:**
- `ensureClaudeOpen()` - Garante Claude panel aberto
- `ensureCodexOpen()` - Garante Codex panel aberto

**Componentes:**
- Codex Chat Panel (882-906)
- Claude Chat Panel (908-933)

### 4. 🏷️ **MODAL_MANAGEMENT** (Linhas 82-89, 428-442, 978-1016)
**Estado:**
- `showProjectsModal`
- `showGitModal` 
- `showPromptsModal`
- `showPromptEnhancer`

**Componentes:**
- ProjectsModal (978-992)
- GitPanel Modal (996-1009)
- PromptsModal (1011-1016)
- PromptEnhancer (1018-1040)

### 5. 🔌 **WEBSOCKET_SESSION_MANAGEMENT** (Linhas 90-96, 98-114)
**Estado:**
- `claudeOverlaySessionId`
- `claudeOverlayControls`
- `codexOverlayControls`
- `chatActivity`

**Efeitos:**
- Debug logging (98-105)
- Global prompt enhancer (107-113)

### 6. 🎛️ **UI_STATE_MANAGEMENT** (Linhas 75, 79, 88, 93-94)
**Estado:**
- `shellResizeTrigger` - Trigger para resize do shell
- `toast` - Mensagens toast
- `productivityMode` - Modo produtividade

### 7. 🌐 **GLOBAL_HANDLERS** (Linhas 179-185, 205-217, 219-224, 257-296)
**Handlers:**
- `window.switchToTab` - Global tab switching
- `window.__openMarkdown` - Global markdown opener
- `handleShellSessionStateChange()` - Shell session handler
- `handleExecutePrompt()` - Execute prompt em diferentes contexts

### 8. 🎨 **LAYOUT_RENDERING** (Linhas 447-1056)
**Seções principais:**
- Header com tabs (449-778)
- Main content area (780-877) 
- Side panels (881-933)
- Mobile overlays (938-963)
- Modals (967-1041)

---

## 📋 ESTRUTURA DE RENDERIZAÇÃO

### Header (449-778)
- **Chat overlay header** (452-461)
- **Left controls** (463-546)
  - Mobile projects button
  - Preview toggle
  - Project name & badge
- **Centered tabs** (553-721) - 200+ linhas!
  - Projects, Files, Prompts, Git, Codex, Claude buttons
- **Right controls** (723-777)
  - Timer, Productivity mode, Settings, Dark mode

### Main Content (780-877)
- **Productivity mode** (782-849) - 3-column layout
- **Normal mode** (851-876) - Shell + side panels

### Side Panels (881-933)
- Codex chat panel
- Claude chat panel

### Mobile Support (938-963)
- Files overlay
- Git overlay
- Dashboard overlay

---

## 🔗 DEPENDENCIES EXTERNAS

### Props Dependencies (33-69)
34 props passadas do App.jsx - muitas são pass-through

### Global Window Objects
- `window.switchToTab`
- `window.openPromptEnhancer` 
- `window.__openMarkdown`
- `window.__shellControls`

### Context Dependencies
- `useClaudeWebSocket()` - Para WebSocket handlers

---

## 🎯 EXTRACTION TARGETS

### 1. **TabManager** - Extract lines 553-721
- Centered tabs container
- All button click handlers
- Tab state management

### 2. **SidePanelManager** - Extract lines 77-78, 237-255, 881-933
- Side panel state
- Panel open/close logic
- Panel rendering containers

### 3. **ModalManager** - Extract lines 82-89, 978-1041
- All modal state
- Modal components rendering
- Modal open/close handlers

### 4. **FileManager** - Extract lines 71-72, 187-217, 969-976
- File editing state
- File open/close handlers
- CodeEditor component

### 5. **ContextWindowManager** - Extract lines 74, 96, 115-168
- Context tracking state
- WebSocket listeners
- Context percentage calculation

### 6. **SessionManager** - Extract lines 90-96, 98-114
- Session IDs and controls
- Chat activity tracking
- Session lifecycle

---

## ⚠️ CRITICAL NOTES

### Props Pass-through Problem
MainContent recebe 34 props apenas para repassar para componentes filhos. Isso indica forte acoplamento.

### Global State Pollution
Múltiplos `window.*` handlers indicam falta de proper state management.

### Mega Component Signs
- 1.056 linhas
- 16 useState variables
- 7 useEffect hooks
- Responsible for layout, state, events, rendering

### Mobile vs Desktop Duplication
Mobile e desktop têm lógicas similares mas implementações diferentes (linhas 938-963).
