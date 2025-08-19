# Product Requirements Document: Shell Preview Panel Integration

## Executive Summary
This PRD outlines the implementation of an integrated preview panel within the Claude Code UI Shell tab, allowing users to instantly preview server outputs (localhost URLs) without leaving the terminal interface. This feature enhances the development workflow by providing immediate visual feedback for web development tasks.

## Problem Statement
Currently, when developers run local servers in the Claude Code UI Shell, they must:
1. Manually copy URLs from the terminal output
2. Open a new browser tab
3. Navigate to the URL
4. Switch context between terminal and browser

This context switching disrupts workflow and reduces productivity, especially during rapid iterative development.

## Solution Overview
Implement a seamless preview panel that:
- Automatically detects localhost URLs in the terminal output
- Provides a "Preview" button in the Shell interface
- Opens a side panel with an embedded iframe showing the server output
- Allows clicking on any localhost URL to instantly preview it

## Technical Architecture

### 1. Component Structure
```
Shell Tab
├── Shell Toolbar
│   ├── Existing controls (Connect/Disconnect/Bypass)
│   └── Preview Toggle Button (NEW)
├── Shell Container (Split Pane)
│   ├── Terminal Panel (XTerm.js)
│   └── Preview Panel (NEW - Conditional)
│       ├── Preview Toolbar
│       │   ├── URL Display
│       │   ├── Refresh Button
│       │   ├── Open External Button
│       │   └── Close Button
│       └── Preview IFrame
```

### 2. Key Components

#### 2.1 Shell.jsx Modifications
```javascript
// Add state for preview management
const [showPreview, setShowPreview] = useState(false);
const [previewUrl, setPreviewUrl] = useState('');
const [detectedPorts, setDetectedPorts] = useState(new Set());

// Custom WebLinksAddon configuration
const webLinksAddon = new WebLinksAddon({
  handler: (event, uri) => {
    // Custom handler for localhost URLs
    if (isLocalhostUrl(uri)) {
      handlePreviewUrl(uri);
      return false; // Prevent default behavior
    }
    return true; // Allow default for non-localhost URLs
  }
});
```

#### 2.2 New PreviewPanel Component
```javascript
// src/components/PreviewPanel.jsx
function PreviewPanel({ url, onClose, onRefresh, onOpenExternal }) {
  // Component implementation
}
```

#### 2.3 URL Detection Logic
```javascript
function detectLocalhostUrls(text) {
  const patterns = [
    /https?:\/\/localhost:\d+/gi,
    /https?:\/\/127\.0\.0\.1:\d+/gi,
    /https?:\/\/0\.0\.0\.0:\d+/gi,
    /https?:\/\/\[::1\]:\d+/gi,
    /Server running on port (\d+)/gi,
    /Listening on .*:(\d+)/gi
  ];
  // Extract and return URLs
}
```

### 3. User Interface Design

#### 3.1 Preview Button
- Location: Shell toolbar, next to existing controls
- Icon: External link or preview icon
- States:
  - Default: Grayed out (no URLs detected)
  - Active: Highlighted (URLs detected)
  - Pressed: Shows preview panel is open

#### 3.2 Preview Panel Layout
- **Desktop**: 50/50 split with resizable divider
- **Mobile**: Full-screen overlay with back button
- **Responsive**: Minimum width 320px for preview panel

#### 3.3 Visual Design
```css
/* Preview panel styling */
.preview-panel {
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  height: 100%;
}

.preview-toolbar {
  height: 40px;
  background: var(--toolbar-bg);
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-bottom: 1px solid var(--border-color);
}

.preview-iframe {
  flex: 1;
  width: 100%;
  border: none;
  background: white;
}
```

### 4. Implementation Steps

#### Phase 1: Core Infrastructure
1. Modify Shell.jsx to support split-pane layout
2. Create PreviewPanel component
3. Implement URL detection logic
4. Add preview state management

#### Phase 2: XTerm.js Integration
1. Configure WebLinksAddon with custom handler
2. Implement click-to-preview functionality
3. Add URL highlighting in terminal

#### Phase 3: User Experience
1. Add preview toggle button
2. Implement responsive layout
3. Add keyboard shortcuts (Cmd/Ctrl+P for preview)
4. Save preview state in localStorage

#### Phase 4: Advanced Features
1. Multiple preview tabs
2. Preview history
3. Port auto-detection
4. Hot reload support

### 5. Security Considerations

#### 5.1 IFrame Sandboxing
```html
<iframe
  src={previewUrl}
  sandbox="allow-scripts allow-same-origin allow-forms"
  referrerpolicy="no-referrer"
/>
```

#### 5.2 URL Validation
- Only allow localhost/127.0.0.1/0.0.0.0 URLs
- Validate port numbers (1-65535)
- Prevent navigation to external URLs

#### 5.3 Content Security Policy
- Implement CSP headers for preview iframe
- Restrict external resource loading

### 6. Performance Optimizations

#### 6.1 Lazy Loading
- Load PreviewPanel component only when needed
- Use React.lazy() for code splitting

#### 6.2 Resource Management
- Limit number of simultaneous preview panels
- Clean up iframe resources on unmount
- Implement debouncing for URL detection

#### 6.3 Memory Management
- Clear preview history periodically
- Limit stored URLs to prevent memory leaks

### 7. Error Handling

#### 7.1 Connection Errors
- Display "Unable to connect" message
- Provide retry button
- Show helpful troubleshooting tips

#### 7.2 Invalid URLs
- Graceful fallback for malformed URLs
- Clear error messages
- Suggest corrections

#### 7.3 Port Conflicts
- Detect and warn about port conflicts
- Suggest alternative ports
- Provide conflict resolution tools

### 8. Testing Strategy

#### 8.1 Unit Tests
- URL detection logic
- Preview state management
- Security validation

#### 8.2 Integration Tests
- XTerm.js addon integration
- Preview panel rendering
- Split-pane functionality

#### 8.3 E2E Tests
- Complete user workflows
- Mobile responsiveness
- Keyboard navigation

### 9. Accessibility

#### 9.1 Keyboard Navigation
- Tab navigation between panels
- Escape key to close preview
- Arrow keys for panel resizing

#### 9.2 Screen Reader Support
- ARIA labels for all controls
- Announce preview state changes
- Descriptive button labels

#### 9.3 Visual Accessibility
- High contrast mode support
- Focus indicators
- Resizable text

### 10. Migration Plan

#### 10.1 Feature Flag
- Implement behind feature flag initially
- Gradual rollout to users
- A/B testing for performance

#### 10.2 Backward Compatibility
- Ensure no breaking changes
- Graceful degradation for older browsers
- Maintain existing shell functionality

### 11. Success Metrics

#### 11.1 User Engagement
- Preview panel usage rate
- Average preview session duration
- Click-through rate on detected URLs

#### 11.2 Performance Metrics
- Preview load time
- Memory usage impact
- CPU usage during preview

#### 11.3 User Satisfaction
- Feature adoption rate
- User feedback scores
- Support ticket reduction

## Appendix A: Code Examples

### A.1 URL Detection Implementation
```javascript
class UrlDetector {
  constructor() {
    this.patterns = {
      explicit: /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d+)/gi,
      implicit: /(?:Server|Listening|Running).*?(?:on|at).*?(?:port\s+)?(\d+)/gi
    };
  }

  detect(text) {
    const urls = new Set();
    
    // Detect explicit URLs
    let match;
    while ((match = this.patterns.explicit.exec(text)) !== null) {
      urls.add(match[0]);
    }
    
    // Detect implicit port mentions
    while ((match = this.patterns.implicit.exec(text)) !== null) {
      const port = match[1];
      if (port >= 1 && port <= 65535) {
        urls.add(`http://localhost:${port}`);
      }
    }
    
    return Array.from(urls);
  }
}
```

### A.2 Preview Panel Integration
```javascript
function ShellWithPreview() {
  const [splitRatio, setSplitRatio] = useState(0.5);
  
  return (
    <SplitPane
      split="vertical"
      size={showPreview ? `${splitRatio * 100}%` : '100%'}
      onChange={setSplitRatio}
      resizerStyle={{
        background: 'var(--border-color)',
        width: '3px',
        cursor: 'col-resize'
      }}
    >
      <Shell {...shellProps} />
      {showPreview && (
        <PreviewPanel
          url={previewUrl}
          onClose={() => setShowPreview(false)}
        />
      )}
    </SplitPane>
  );
}
```

## Appendix B: Dependencies

### Required Packages
```json
{
  "dependencies": {
    "react-split-pane": "^0.1.92",
    "@xterm/addon-web-links": "^0.9.0",
    "url-regex": "^5.0.0"
  }
}
```

### Browser Requirements
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Appendix C: Risk Assessment

### Technical Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| IFrame security vulnerabilities | High | Low | Strict sandboxing, CSP |
| Performance degradation | Medium | Medium | Lazy loading, resource limits |
| XTerm.js compatibility issues | Medium | Low | Thorough testing, fallbacks |
| Mobile layout issues | Low | Medium | Responsive design, testing |

### Business Risks
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Low user adoption | Medium | Medium | User education, intuitive UI |
| Increased support burden | Low | Low | Clear documentation, error handling |
| Feature complexity | Medium | Low | Phased rollout, feature flags |

## Conclusion

The Shell Preview Panel integration will significantly enhance the Claude Code UI development experience by eliminating context switching and providing immediate visual feedback. The implementation prioritizes security, performance, and user experience while maintaining backward compatibility and accessibility standards.

The phased implementation approach allows for iterative development and user feedback integration, ensuring a robust and well-tested feature that meets developer needs.