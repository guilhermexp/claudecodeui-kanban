# Issues & Known Problems Directory

This directory tracks active issues, bugs, and known limitations in the Claude Code UI project.

## Current Status: ✅ No Critical Issues

**Last Review**: 2025-01-10
**Active Issues**: 0
**Resolved**: 5

## Known Limitations

### 1. Large File Handling
- **Status**: ✅ Acceptable
- **Description**: Very large files (>50MB) may have slower editing performance
- **Workaround**: Use terminal for large file operations
- **Impact**: Low - rare in typical development

### 2. Bundle Size Warning
- **Status**: ⚠️ Noted
- **Description**: Main JS bundle is 2.14 MB (uncompressed), triggers Vite warning for chunks >500 kB
- **Cause**: CodeMirror dependencies and xterm.js add size
- **Mitigation**: Already using gzip compression (613.97 kB gzipped)
- **Action**: Consider dynamic imports for code editor if needed

### 3. Unused Dependencies
- **Status**: ✅ Tracked (Not Critical)
- **Packages**:
  - `@anthropic-ai/sdk` - Kept for future Claude API integration
  - `react-syntax-highlighter` - Replaced by CodeMirror, safe to remove later
- **Impact**: Low - only affects bundle size slightly
- **Next Steps**: Safe to remove in future release if not needed

## Resolved Issues

### ✅ Deprecated Component Removal (2025-01-10)
- **Issue**: Obsolete chat components and utilities cluttering codebase
- **Solution**: Removed 56 files, eliminated 7,357 lines of dead code
- **Status**: RESOLVED
- **Commit**: 3e1b7d3

### ✅ Port Conflicts
- **Issue**: Running dev and prod simultaneously caused EADDRINUSE errors
- **Solution**: Implemented port protection system with automatic monitoring
- **Status**: RESOLVED
- **Reference**: See `ARCHITECTURE_OVERVIEW.md` - Port Protection System

### ✅ WebSocket Terminal Connection
- **Issue**: Terminal losing connection on page refresh
- **Solution**: Implemented automatic reconnection and session persistence
- **Status**: RESOLVED

### ✅ Mobile Responsiveness
- **Issue**: Mobile layout not adapting properly
- **Solution**: Implemented mobile-first CSS with safe area support
- **Status**: RESOLVED

### ✅ Dark Mode Support
- **Issue**: Inconsistent theming across components
- **Solution**: Implemented semantic CSS custom properties
- **Status**: RESOLVED

## Issue Template

When creating a new issue, use this format:

```markdown
## [ISSUE TITLE]

### Status
- **Severity**: Critical / High / Medium / Low
- **Type**: Bug / Enhancement / Question
- **Affected Component**: [Component/Module name]

### Description
[Detailed description of the issue]

### Reproduction Steps
1. Step 1
2. Step 2
3. Step 3

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happens]

### Environment
- OS: [macOS/Linux/Windows]
- Browser: [Chrome/Firefox/Safari]
- Node Version: [version]
- Commit: [commit hash]

### Possible Solution
[If known, describe potential fix]

### Related Files
- [File paths]

### Created
[Date]
```

## Issue Tracking Guidelines

1. **New Issues**:
   - Check existing issues first (avoid duplicates)
   - Use template provided above
   - Include all reproduction details
   - Link to related commits or documentation

2. **Resolving Issues**:
   - Update status to RESOLVED
   - Link to commit that fixed it
   - Move to "Resolved" section
   - Archive if issue is old (>6 months)

3. **Review Cycle**:
   - Monthly review of open issues
   - Prioritize by severity
   - Update if problem persists
   - Close if workaround is provided

---

**Last Updated**: 2025-01-10
**Maintainer**: Development Team
**Status**: Actively Monitored ✅
