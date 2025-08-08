# Vibe Kanban Panel Documentation

## Overview

The Vibe Kanban Panel provides quick access to task management directly from the main interface, allowing you to create and manage tasks without navigating away from your current work.

## Access Methods

### Tasks Tab Button
Click the "Tasks" button in the main navigation tabs to open/close the panel. The panel slides in from the right side of the screen.

### Responsive Design
- **Desktop**: Panel appears as a sidebar (420-480px width)
- **Tablet**: Optimized width for medium screens
- **Mobile**: Full-width panel for touch interaction

## Panel Features

### Project Selection
- Dropdown menu shows all available Vibe Kanban projects
- Auto-selects first project on load
- Displays project name, description, and creation date
- Project ID shown for reference

### Task List View
- Shows all tasks for selected project
- Visual status indicators with colors:
  - **Todo** (Gray) - Not started
  - **In Progress** (Blue) - Currently working
  - **In Review** (Amber) - Awaiting review
  - **Done** (Green) - Completed
  - **Cancelled** (Red) - Cancelled task
- Displays task title, description, status, and date
- Click any task to view details

### Task Details View
- Opens inline within the same panel
- No modal overlay - keeps context
- Shows full task information:
  - Title and description
  - Current status
  - Timestamps
  - Related commits
  - Subtasks
- Edit capabilities (when implemented)
- Back button returns to task list

### Quick Task Creation
- **Create Task** button at bottom of panel
- Opens task creation dialog
- Fields:
  - Task title (required)
  - Description (optional)
  - Executor selection
- Options:
  - Create task (adds to backlog)
  - Create and start (immediately begins work)

### Quick Actions
- **Open in Vibe Kanban** - Opens full board in new tab
- **All Projects** - Navigate to project list
- **Refresh** button - Reload tasks

## Integration Features

### Shell Resizing
When the panel opens:
1. Main content area shrinks to accommodate panel
2. Shell terminal automatically resizes
3. Smooth 350ms transition
4. No content overlap

### Sidebar Interaction
- On desktop: Sidebar can remain open
- Panel doesn't overlap navigation tabs
- Clean visual hierarchy maintained

### State Persistence
- Panel state preserved during navigation
- Selected project remembered
- Task list position maintained
- Smooth transitions between states

## UI Components

### Panel Header
- "Vibe Kanban" title
- "Create tasks quickly" subtitle
- Close button (X) to hide panel

### Task Cards
- Compact design for quick scanning
- Status dot for visual identification
- Truncated text with ellipsis
- Hover effect for interactivity

### Loading States
- Spinner during data fetch
- "Loading..." text feedback
- Graceful error handling

### Empty States
- "No projects" message with instructions
- "No tasks yet" for empty projects
- Clear call-to-action buttons

## Technical Implementation

### Component Structure
```
VibeTaskPanel
├── Project Selection
├── Task List
│   └── Task Cards
├── Task Details (inline)
├── Create Task Button
└── Quick Actions
```

### State Management
- `selectedProject` - Current project
- `tasks` - Task list for project
- `selectedTask` - Currently viewing task
- `showTaskDetails` - Detail view toggle
- `showTaskList` - List visibility control

### API Integration
```javascript
// Fetch projects
projectsApi.getAll()

// Fetch tasks
tasksApi.getAll(projectId)

// Create task
tasksApi.create(projectId, taskData)

// Create and start
tasksApi.createAndStart(projectId, taskData)
```

## Performance Optimizations

### Lazy Loading
- Tasks load only when project selected
- Details load on demand
- Minimal initial payload

### Caching
- Projects cached for session
- Tasks refresh on panel open
- Manual refresh available

### Animations
- CSS transitions for smooth sliding
- 300ms panel animation
- No JavaScript animation loops

## Accessibility

### Keyboard Navigation
- Tab through all controls
- Enter to select/activate
- Escape to close panel
- Arrow keys in dropdowns

### Screen Readers
- Proper ARIA labels
- Status announcements
- Focus management

### Touch Support
- Large touch targets (44x44px minimum)
- Swipe gestures (planned)
- Touch-friendly spacing

## Error Handling

### Network Errors
- Clear error messages
- Retry button available
- Fallback to cached data

### Backend Failures
- "Vibe Kanban backend not running" message
- Instructions to start backend
- Graceful degradation

### Validation
- Required fields marked
- Inline validation messages
- Prevent invalid submissions

## Best Practices

### When to Use Panel
- Quick task creation
- Status checks
- Brief task reviews
- Context switching

### When to Use Full Board
- Detailed planning
- Drag-and-drop organization
- Bulk operations
- Team collaboration

## Configuration

### Backend Requirements
- Vibe Kanban backend running (port 8081)
- SQLite database configured
- Proper CORS settings

### Frontend Settings
- No specific configuration needed
- Follows app theme automatically
- Responsive breakpoints built-in

## Troubleshooting

### Panel Not Opening
1. Check if Tasks button is visible
2. Verify no JavaScript errors
3. Clear browser cache
4. Restart development server

### Tasks Not Loading
1. Verify Vibe Kanban backend is running
2. Check network tab for API calls
3. Ensure project exists
4. Try manual refresh

### Layout Issues
1. Check browser zoom level (100%)
2. Clear CSS cache
3. Test in different browser
4. Report specific device/browser

## Future Enhancements

- Drag-and-drop in panel
- Inline task editing
- Quick filters
- Task templates
- Keyboard shortcuts
- Notifications
- Task assignments
- Due dates
- Labels and tags
- Search functionality

## Related Documentation

- [Vibe Kanban Guide](VIBE_KANBAN.md)
- [User Guide](USER_GUIDE.md)
- [Architecture](ARCHITECTURE.md)