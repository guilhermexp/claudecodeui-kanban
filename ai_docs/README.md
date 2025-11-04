# AI Documentation Directory

This directory contains comprehensive technical documentation for Claude Code UI development and maintenance.

## Document Index

### Core Documentation
- **ARCHITECTURE_OVERVIEW.md** - Complete system architecture, design decisions, and deployment modes
  - Frontend/Backend separation
  - Port protection system
  - Security considerations
  - Performance optimizations

### Additional Documentation (To Be Added)
- Development guidelines and best practices
- API reference and endpoint documentation
- Database schema and data models
- Integration guides
- Troubleshooting and common issues
- Performance benchmarks

## Project Status: ✅ STABLE v1.5.0

- **Last Major Update**: 2025-01-10 (Comprehensive cleanup)
- **Build Status**: ✅ Passing
- **Test Coverage**: Maintained
- **Production Ready**: Yes

## Quick Navigation

**For Development**:
- See `CLAUDE.md` for development setup and commands
- See `ARCHITECTURE_OVERVIEW.md` for system design
- Check `ai_issues/` for known problems and solutions

**For Deployment**:
- Development: `npm run dev`
- Production: `./start-background-prod.sh`
- See deployment section in ARCHITECTURE_OVERVIEW.md

**For Troubleshooting**:
- Port conflicts: `npm run port-status` and `npm run stop-all`
- Terminal issues: Check WebSocket connection in browser console
- See ai_issues/ for documented problems

## Key Metrics

| Metric | Status |
|--------|--------|
| Build | ✅ Passing |
| Frontend Size | 41.13 kB (gzipped) |
| Backend Port | 7347 |
| Frontend Port | 5892 (dev) |
| Total Dependencies | ~40 packages |
| Test Coverage | Maintained |

## Guidelines for Adding Documentation

1. **Choose the Right Directory**:
   - Architecture/Design → `ai_docs/`
   - Bug reports → `ai_issues/`
   - Experiments → `ai_research/`
   - Specifications → `ai_specs/`
   - Changes → `ai_changelog/`

2. **Format Standards**:
   - Use Markdown for all documents
   - Start with status indicator (✅/⚠️/❌)
   - Include date of last update
   - Link to related files and commits
   - Use clear headings and sections

3. **Keep Updated**:
   - Review quarterly for accuracy
   - Update when code changes
   - Archive outdated information
   - Cross-reference with CLAUDE.md and README.md

---

**Last Updated**: 2025-01-10
**Maintainer**: Development Team
**Status**: Actively Maintained ✅
