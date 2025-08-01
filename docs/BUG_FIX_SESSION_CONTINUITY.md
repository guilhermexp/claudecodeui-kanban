# Bug Fix: Session Continuity Issue in Chat Interface

## Problem Description
When users clicked "New Session" or started a new chat, the system was incorrectly maintaining the previous session ID, causing messages to be sent to the wrong session or creating duplicate sessions.

## Root Cause
The `handleNewSession` function in `ChatInterface.jsx` was clearing chat messages but not resetting the `currentSessionId` state. This caused the following issues:

1. New messages were sent with `resume: true` and the old session ID
2. Claude CLI would create a new session (unable to resume the old one)
3. The UI would become confused about which session was active
4. Users would lose their conversation context

## Solution Applied

### 1. Fixed `handleNewSession` function
```javascript
const handleNewSession = () => {
  // Clear current session ID to ensure new session is created
  setCurrentSessionId(null);
  setChatMessages([]);
  setInput('');
  setIsLoading(false);
  setCanAbortSession(false);
  // Clear any pending session IDs
  sessionStorage.removeItem('pendingSessionId');
};
```

### 2. Added cleanup for old temporary sessions
A cleanup function was added that runs on component mount to remove stale temporary session IDs older than 5 minutes. This prevents conflicts without affecting user settings.

## Important Notes

### What IS cleaned up:
- Old `pendingSessionId` entries in sessionStorage (older than 5 minutes)
- Temporary session markers that are no longer valid

### What is NOT affected:
- ✅ User's tool settings (allowed/disallowed tools)
- ✅ UI preferences (auto-expand, scroll settings)
- ✅ Selected Claude model
- ✅ Draft messages
- ✅ Active chat history
- ✅ Any other user preferences

## Testing the Fix
1. Start a conversation in a session
2. Click "New Session" or use the button to create a new session
3. Send a message - it should create a new session properly
4. The old session should remain intact and accessible

## Prevention
The session state management now properly coordinates between:
- Frontend session tracking (`currentSessionId`)
- Session protection system (temporary IDs)
- Backend WebSocket session creation

This ensures smooth session transitions without data loss or confusion.