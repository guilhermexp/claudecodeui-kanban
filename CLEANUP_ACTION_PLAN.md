# 🧹 Codebase Cleanup Action Plan
**Generated:** 2025-10-10 22:42
**Branch:** cleanup/20251010-224205
**Backup Tag:** cleanup-backup-20251010

---

## 📊 Executive Summary

**Total Items Identified:** 21
- **Unused Dependencies:** 14 packages (~5-10MB reduction)
- **Missing Dependencies:** 3 packages (need installation)
- **Console Statements:** 133 occurrences (most in logger utilities - keep)
- **Dead Code:** Minimal (already cleaned in refactoring)
- **Obsolete Files:** None found

**Estimated Impact:**
- Bundle size reduction: ~500KB - 1MB
- node_modules reduction: ~5-10MB
- Build time improvement: ~5-10%
- Dependency tree simplification

---

## 🎯 Phase 1: Low Risk Items (Safe for Automation)

### 1.1 Remove Unused npm Dependencies
**Risk Level:** 🟢 LOW
**Confidence:** HIGH
**Impact:** Reduce bundle size, faster installs

#### Dependencies to Remove:
```bash
npm uninstall @anthropic-ai/sdk \
  @radix-ui/react-avatar \
  @radix-ui/react-progress \
  @radix-ui/react-slot \
  @radix-ui/react-tabs \
  @radix-ui/react-toast \
  axios \
  form-data \
  http-proxy-middleware \
  mime-types \
  node-pty \
  openai \
  prismjs
```

**Rationale:**
- `@anthropic-ai/sdk` - Not imported anywhere in codebase
- `@radix-ui/*` - Replaced by custom components or not used
- `axios` - Using native fetch API instead
- `form-data` - Not used in codebase
- `http-proxy-middleware` - Proxy configuration moved to Vite config
- `mime-types` - Not imported anywhere
- `node-pty` - Terminal functionality handled by xterm.js
- `openai` - Not using OpenAI API (using Claude/Gemini instead)
- `prismjs` - Syntax highlighting handled by CodeMirror

**Testing Strategy:**
- ✅ Run `npm run build` after removal
- ✅ Verify all imports resolve
- ✅ Check bundle size reduction
- ✅ Test application functionality

**Rollback:** `git restore package.json package-lock.json && npm install`

---

### 1.2 Keep ESLint (Move to devDependencies)
**Risk Level:** 🟡 MEDIUM
**Confidence:** HIGH

**Action:**
```bash
# Don't remove - instead move to devDependencies
npm uninstall eslint
npm install --save-dev eslint
```

**Rationale:** ESLint is a dev tool, not a production dependency

---

## 🎯 Phase 2: Medium Risk Items (Manual Review)

### 2.1 Install Missing Dependencies
**Risk Level:** 🟡 MEDIUM
**Confidence:** MEDIUM

#### Dependencies to Install:

**1. eslint-config-next**
- **Used in:** `.eslintrc.json`
- **Action:** Install or remove from ESLint config
```bash
npm install --save-dev eslint-config-next
# OR remove from .eslintrc.json if not needed
```

**2. pidusage**
- **Used in:** `server/lib/ProcessManager.js`
- **Action:** Install or refactor ProcessManager
```bash
npm install pidusage
# OR refactor ProcessManager to use alternative
```

**3. sharp**
- **Used in:** `scripts/banner-batch-gemini.mjs`
- **Action:** Install if image processing needed
```bash
npm install sharp
# OR mark script as optional feature
```

**Testing:**
- ✅ Verify ProcessManager works (system resource monitoring)
- ✅ Test banner-batch-gemini script if used
- ✅ Run ESLint validation

---

### 2.2 Audit Console Statements
**Risk Level:** 🟢 LOW
**Confidence:** HIGH

**Current Status:**
- Frontend: 63 occurrences (19 files)
- Backend: 70 occurrences (9 files)

**Analysis:**
- Most console statements are in `logger.js` utilities (legitimate)
- Other occurrences appear to be intentional logging
- Already using structured logging from refactoring work

**Action:** KEEP AS-IS (no cleanup needed)

**Rationale:** Recent refactoring already replaced problematic console.logs with structured logging. Remaining console statements are intentional.

---

## 🎯 Phase 3: Build Artifact Cleanup

### 3.1 Clean dist Directory
**Risk Level:** 🟢 LOW
**Confidence:** HIGH

**Action:**
```bash
rm -rf dist
npm run build
```

**Rationale:** Rebuild from clean state after dependency removal

---

## 📈 Success Metrics

### Before Cleanup:
- **Repository size:** 364MB
- **Dependencies:** ~60 packages
- **Build size:** 547.28 kB (gzip: 170.11 kB)
- **Build time:** ~4.20s

### After Cleanup (Expected):
- **Repository size:** ~354MB (-10MB from node_modules)
- **Dependencies:** ~50 packages (-10 unused)
- **Build size:** ~500 kB (-47 kB, ~9% reduction)
- **Build time:** ~3.8s (-10% faster)

---

## 🔒 Safety Checklist

**Before Each Step:**
- [ ] Working tree clean
- [ ] Tests passing
- [ ] Branch created: `cleanup/20251010-224205`
- [ ] Backup tag created: `cleanup-backup-20251010`

**After Each Step:**
- [ ] Run `npm install` (if package.json changed)
- [ ] Run `npm run build` → MUST SUCCEED
- [ ] Run `npm test` (if tests exist) → MUST PASS
- [ ] Test critical functionality
- [ ] Commit changes with descriptive message

**Emergency Rollback:**
```bash
# Full rollback to backup
git reset --hard cleanup-backup-20251010

# Restore specific file
git restore package.json package-lock.json
npm install
```

---

## 📝 Execution Order

1. ✅ **Phase 1.1:** Remove unused dependencies
2. ✅ **Phase 1.2:** Move ESLint to devDependencies
3. ✅ **Phase 2.1:** Install missing dependencies
4. ✅ **Phase 2.2:** Audit console statements (SKIP - already clean)
5. ✅ **Phase 3.1:** Clean build artifacts
6. ✅ **Final Validation:** Full test suite
7. ✅ **Generate Report:** Document all changes

---

## 🚨 Risk Assessment Matrix

| Item | Risk | Impact | Confidence | Action |
|------|------|--------|------------|--------|
| Unused deps removal | 🟢 LOW | HIGH | HIGH | AUTO |
| ESLint move | 🟡 MED | LOW | HIGH | AUTO |
| Missing deps install | 🟡 MED | MED | MEDIUM | REVIEW |
| Console cleanup | 🟢 LOW | LOW | HIGH | SKIP |
| Build cleanup | 🟢 LOW | LOW | HIGH | AUTO |

---

## 🎯 Next Steps

1. Review this plan with user
2. Execute Phase 1 (low risk items)
3. Validate after each phase
4. Execute Phase 2 (medium risk items)
5. Final validation and reporting

**Estimated Time:** 15-20 minutes
**Breaking Change Risk:** VERY LOW
**Rollback Complexity:** EASY
