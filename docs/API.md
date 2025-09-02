# API Documentation

## Overview

Claude Code UI provides a RESTful API for interaction between the frontend and backend services. The API is built on Express.js and communicates with the Claude CLI.

## Base URLs

- **Development**: `http://localhost:7347/api`
- **Production**: `https://your-domain.com/api`
- **WebSocket**: `ws://localhost:7347` (or `wss://` for production)

## Authentication

All API endpoints (except `/auth/login` and `/auth/register`) require JWT authentication.

### Headers
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## Endpoints

### Authentication

#### POST `/api/auth/login`
Login with username and password.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "jwt_token",
  "user": {
    "id": "number",
    "username": "string",
    "created_at": "timestamp"
  }
}
```

#### POST `/api/auth/register`
Register a new user.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "jwt_token",
  "user": {
    "id": "number",
    "username": "string"
  }
}
```

#### GET `/api/auth/me`
Get current user information.

**Response:**
```json
{
  "id": "number",
  "username": "string",
  "created_at": "timestamp"
}
```

### Projects

#### GET `/api/projects`
List all projects.

**Response:**
```json
[
  {
    "name": "string",
    "path": "string",
    "fullPath": "string",
    "isGitRepo": "boolean",
    "displayName": "string",
    "sessionCount": "number"
  }
]
```

#### POST `/api/projects`
Create a new project.

**Request:**
```json
{
  "name": "string",
  "path": "string"
}
```

#### DELETE `/api/projects/:name`
Delete a project.

### Chat Sessions

#### GET `/api/chat/sessions/:projectName`
Get sessions for a project.

**Response:**
```json
[
  {
    "id": "string",
    "project": "string",
    "summary": "string",
    "created_at": "timestamp",
    "updated_at": "timestamp",
    "token_usage": "number",
    "cost_usd": "number"
  }
]
```

#### POST `/api/chat/message`
Send a message to Claude.

**Request:**
```json
{
  "message": "string",
  "projectPath": "string",
  "sessionId": "string",
  "stream": "boolean"
}
```

**Response (Stream):**
Server-sent events with message chunks.

**Response (Non-stream):**
```json
{
  "response": "string",
  "sessionId": "string"
}
```

#### POST `/api/chat/abort`
Abort current Claude operation.

**Request:**
```json
{
  "projectPath": "string"
}
```

### File Operations

#### GET `/api/files/*`
Read file contents.

**Response:**
```json
{
  "content": "string",
  "language": "string",
  "size": "number"
}
```

#### PUT `/api/files/*`
Update file contents.

**Request:**
```json
{
  "content": "string"
}
```

#### POST `/api/files/tree`
Get file tree for a directory.

**Request:**
```json
{
  "path": "string"
}
```

**Response:**
```json
{
  "name": "string",
  "path": "string",
  "type": "file|directory",
  "children": []
}
```

### Git Operations

#### GET `/api/git/status`
Get Git repository status.

**Query Parameters:**
- `path`: Repository path

**Response:**
```json
{
  "branch": "string",
  "ahead": "number",
  "behind": "number",
  "staged": [],
  "modified": [],
  "untracked": []
}
```

#### GET `/api/git/branches`
List all branches.

**Response:**
```json
{
  "current": "string",
  "branches": ["string"]
}
```

#### POST `/api/git/commit`
Create a commit.

**Request:**
```json
{
  "message": "string",
  "files": ["string"],
  "projectPath": "string"
}
```

### Terminal (WebSocket)

#### WebSocket `/shell`
Terminal shell connection.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:7347/shell?token=<jwt_token>');
```

**Messages:**

Initialize:
```json
{
  "type": "init",
  "projectPath": "string",
  "sessionId": "string",
  "bypassPermissions": "boolean",
  "cols": "number",
  "rows": "number"
}
```

Input:
```json
{
  "type": "input",
  "data": "string"
}
```

Resize:
```json
{
  "type": "resize",
  "cols": "number",
  "rows": "number"
}
```


### Text-to-Speech (TTS)

#### POST `/api/tts/gemini-summarize`
Generate audio from text using Google Gemini AI with summarization.

**Request:**
```json
{
  "text": "string",
  "voiceName": "string (optional, default: Zephyr)",
  "maxSeconds": "number (optional, default: 30)"
}
```

**Response:**
```json
{
  "url": "/api/audios/<audio-id>"
}
```

**Requirements:**
- Requires `GEMINI_API_KEY` or `GOOGLE_API_KEY` environment variable
- Python 3 with `google-genai` package installed

#### GET `/api/audios/:id`
Retrieve generated audio file.

**Response:**
Binary audio file (audio/wav)

### Whisper Transcription

#### POST `/api/transcribe`
Transcribe audio to text.

**Request:**
Multipart form data with audio file.

**Form Fields:**
- `audio`: Audio file (webm, mp4, wav)
- `mode`: Transcription mode (default, prompt, vibe, instructions)

**Response:**
```json
{
  "text": "string"
}
```

### Tools & Settings

#### GET `/api/tools/status`
Get tool permission status.

**Response:**
```json
{
  "write": "boolean",
  "edit": "boolean",
  "bash": "boolean",
  "web_fetch": "boolean"
}
```

#### PUT `/api/tools/toggle`
Toggle tool permission.

**Request:**
```json
{
  "tool": "write|edit|bash|web_fetch",
  "enabled": "boolean"
}
```

## Error Responses

All errors follow this format:

```json
{
  "error": "string",
  "message": "string",
  "statusCode": "number"
}
```

### Common Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Authentication**: 5 requests per minute
- **Chat**: 30 requests per minute
- **File operations**: 100 requests per minute
- **Other endpoints**: 60 requests per minute

## WebSocket Events

### Chat WebSocket

**Events from server:**
- `message` - Claude response chunks
- `error` - Error messages
- `done` - Stream complete
- `session_update` - Session information

**Events to server:**
- `abort` - Cancel current operation

### Shell WebSocket

**Events from server:**
- `output` - Terminal output
- `error` - Error messages
- `exit` - Shell terminated

**Events to server:**
- `init` - Initialize shell
- `input` - Terminal input
- `resize` - Terminal resize
- `bypassPermissions` - Toggle bypass mode
