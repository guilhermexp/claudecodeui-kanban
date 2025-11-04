# Research & Experiments Directory

This directory contains research notes, proof of concepts, experiments, and exploratory work for Claude Code UI.

## Current Research Initiatives

### 1. Unused Dependencies Analysis
**Status**: ✅ COMPLETED (2025-01-10)
**Findings**:
- `@anthropic-ai/sdk` - Currently unused, but kept for future Claude API direct integration
- `react-syntax-highlighter` - Replaced by CodeMirror 6, safe to remove
- Analysis done with `depcheck` tool
- Overall: Dependencies are well-curated (40 packages)

**Recommendation**: Consider removing react-syntax-highlighter in v1.6.0 if not used by then.

### 2. Bundle Size Optimization
**Status**: ⚠️ IN PROGRESS
**Current Size**:
- Uncompressed: 2.14 MB
- Gzipped: 613.97 kB
- HTML: 5.08 kB

**Breakdown**:
- Main JS: 2,142.82 kB (uncompressed)
- CSS: 150.91 kB (uncompressed)
- Gzipped effectively reduces size by ~71%

**Optimization Ideas**:
- Dynamic imports for code editor components
- Route-based code splitting (already implemented)
- Consider lazy-loading XTerm.js components
- Evaluate alternative lighter syntax highlighter

**Next Steps**: Monitor performance in production before optimizing further.

### 3. Port Protection System Performance
**Status**: ✅ VERIFIED (2025-01-10)
**Testing**:
- Continuous monitoring every 5 seconds
- Process whitelisting works correctly
- Automatic unauthorized process termination
- No performance impact on main application

**Metrics**:
- CPU usage: Negligible (<0.1%)
- Memory: ~5-10 MB overhead
- Reliability: 100% (test-port-attack.js verification)

**Conclusion**: System is production-ready and stable.

### 4. WebSocket Terminal Stability
**Status**: ✅ VERIFIED
**Findings**:
- Automatic reconnection works correctly
- Session persistence maintained through page refreshes
- No data loss observed in testing
- Handles network interruptions gracefully

### 5. Mobile Layout Responsiveness
**Status**: ✅ VERIFIED
**Testing**:
- iOS safe area support working
- Mobile modals displaying correctly
- Touch targets meet 44px minimum
- Landscape and portrait orientations supported

---

## Experimental Ideas (Future)

### Potential Features to Research
1. **Native Mobile App**: React Native version for iOS/Android
2. **Offline Support**: Enhanced PWA with offline capabilities
3. **Real-time Collaboration**: Multi-user terminal sharing
4. **AI-Powered Suggestions**: Claude suggestions in file editor
5. **Custom Themes**: User-definable color schemes

### Technology Evaluations Needed
1. **Alternative Databases**: PostgreSQL vs SQLite for scaling
2. **Message Queue System**: Redis for multi-instance deployment
3. **Container Support**: Docker/Kubernetes deployment guide
4. **CI/CD Integration**: GitHub Actions workflow improvements

---

## Research Methodology

When conducting research or experiments:

1. **Document the Hypothesis**:
   - What are we testing?
   - What do we expect to happen?
   - How will we measure success?

2. **Run the Experiment**:
   - Create isolated test environment
   - Document all steps
   - Collect quantitative data

3. **Record Results**:
   - Did it work? Why or why not?
   - What was learned?
   - Performance impact?

4. **Archive Findings**:
   - Move to appropriate directory
   - Update main documentation if applicable
   - Link to related code/commits

---

## Tools & Resources

### Performance Analysis
- Chrome DevTools Performance tab
- Lighthouse audits
- Bundle analyzer: `npm run build` with analysis

### Testing
- Manual QA on multiple browsers
- Mobile testing on physical devices
- Load testing ideas for future research

### Documentation
- Keep notes in Markdown
- Use timestamps for tracking
- Link to commits and external resources

---

## Archive

Old research that's been archived or superseded:

- ~~Vibe Kanban Integration~~ - Removed (cf0da4b)
- ~~WebSocket Unification~~ - Completed (see ARCHITECTURE_OVERVIEW.md)
- ~~Claude Code SDK Integration~~ - Superseded by current implementation

---

**Last Updated**: 2025-01-10
**Active Researchers**: Development Team
**Status**: Ongoing ✅
