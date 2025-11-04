# Changelog - Claude Code UI

All notable changes to this project are documented here, following [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- AI documentation infrastructure (ai_changelog, ai_docs, ai_issues, ai_research, ai_specs)
- Comprehensive cleanup report and codebase analysis

### Changed
- Repository structure improved with dedicated AI documentation directories

### Removed
- Debug artifacts (.playwright-mcp screenshots)
- Deprecated overlay chat components and contexts
- Old chat utilities and hooks (useActivityTimer, useMessageFeedback)
- Obsolete documentation files (CLAUDE_CODE_INTEGRATION.md, CLAUDE_CODE_SDK.md, WEBSOCKET_UNIFICATION.md)
- Test files for deprecated SDK versions

---

## [1.5.0] - 2025-01-10

### Added
- Comprehensive codebase cleanup with automated detection
- AI documentation directory structure for long-term organization
- Cleanup safety protocols with git backup tags

### Changed
- Repository cleaned: 56 files deleted, 7,357 lines removed
- Improved code quality by removing dead code

### Fixed
- Build now succeeds with smaller bundle size
- Removed unused dependencies flagged for future cleanup

**Commit**: `3e1b7d3` - chore: Remove obsolete files and deprecated components

---

## [Previous Releases]

See git history for earlier releases and changes.

---

## Directory Legend

- **v1.5.0+**: Modern implementation with focus on stability and performance
- **Previous versions**: Available in git history

---

**Last Updated**: 2025-01-10
**Maintainer**: Development Team
**Status**: Actively Maintained ✅
