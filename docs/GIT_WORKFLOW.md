# Git Workflow Documentation

## Repository Status (2025-08-04)

### Current State
- **Main Branch**: `main` - Up to date with origin
- **Remote**: `https://github.com/guilhermexp/claudecodeui-kanban.git`
- **Recent Activity**: 7 commits pushed covering dark theme, code cleanup, and UX improvements

### Recent Major Changes
1. **Dark Theme Implementation** - Pure black background system
2. **Code Cleanup** - Removed unused dependencies, extracted utilities
3. **Documentation** - Comprehensive guides for theme system and MCP servers
4. **UX Improvements** - Input during processing, responsive modals
5. **Branch Cleanup** - Removed 13 merged feature branches

## Branch Management Strategy

### Branch Naming Convention
- **Feature branches**: `vk-[4char-hash]-[short-description]`
- **Bug fixes**: `fix/[issue-description]`
- **Documentation**: `docs/[topic]`
- **Experiments**: `experiment/[name]`

### Current Active Branches
```
* main                              - Primary development branch
  terragon/fix-chat-scrollbar-issue - External contribution (UI fixes)
  terragon/fix-chat-ui-scroll       - External contribution (scroll fixes)
  vk-[hash]-*                       - Various feature branches (some in temp dirs)
```

### Branch Lifecycle
1. **Create** feature branch from `main`
2. **Develop** feature with focused commits
3. **Test** thoroughly before merge
4. **Merge** to main with descriptive commit
5. **Delete** feature branch after merge
6. **Push** main to origin regularly

## Commit Message Standards

### Format
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring
- `style`: Formatting changes
- `test`: Adding tests
- `chore`: Maintenance tasks

### Recent Examples
```
feat: enable input during Claude processing
refactor: code cleanup and optimization
docs: add comprehensive dark theme documentation
fix: update QuickSettingsPanel to pure black background
```

## Workflow Recommendations

### Daily Development
1. **Start with clean main**:
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create feature branch**:
   ```bash
   git checkout -b vk-[short-hash]-[feature-name]
   ```

3. **Regular commits**:
   ```bash
   git add .
   git commit -m "feat: implement feature X"
   ```

4. **Push frequently**:
   ```bash
   git push origin main
   ```

### Branch Cleanup
```bash
# List merged branches
git branch --merged main

# Delete merged branches (safe)
git branch --merged main | grep -v "main\|*\|+" | xargs -n1 git branch -d

# Force delete if needed (careful!)
git branch -D branch-name
```

### Emergency Procedures

#### Rollback Last Commit
```bash
git reset --soft HEAD~1  # Keep changes staged
git reset --hard HEAD~1  # Discard changes
```

#### Cherry-pick from Branch
```bash
git cherry-pick <commit-hash>
```

#### Stash Work in Progress
```bash
git stash push -m "Work in progress on feature X"
git stash pop  # When ready to continue
```

## Integration with Vibe Kanban

The repository includes integrated Vibe Kanban task management:
- Task-based branches follow `vk-[task-id]-[description]` pattern
- Each task generates its own branch for isolated development
- Completed tasks merge back to main and clean up branches

## Best Practices

### Before Committing
- [ ] Run tests if available
- [ ] Check for console errors
- [ ] Verify responsive design
- [ ] Test in both light and dark themes
- [ ] Review git diff for unintended changes

### Commit Guidelines
- Keep commits atomic (one logical change)
- Write descriptive commit messages
- Reference issues/tasks when applicable
- Avoid committing debug code or console.log statements

### Branch Management
- Delete merged branches promptly
- Use descriptive branch names
- Don't let branches live too long
- Rebase feature branches if needed

## Troubleshooting

### Common Issues
1. **Branch conflicts**: Use `git rebase main` before merging
2. **Large history**: Consider `git rebase -i` to squash commits
3. **Wrong branch**: `git checkout main` then create new branch
4. **Uncommitted changes**: Use `git stash` to save work

### Recovery Commands
```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard local changes
git checkout -- filename
git reset --hard HEAD

# Find lost commits
git reflog
git cherry-pick <lost-commit-hash>
```

## Repository Health Metrics

- **Total branches cleaned**: 13 merged branches deleted
- **Commits ahead of origin**: 0 (up to date)
- **Working directory**: Clean
- **Documentation coverage**: High (theme, MCP, workflow guides)
- **Code organization**: Recently optimized with shared utilities