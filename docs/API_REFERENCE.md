# API Reference

Complete API documentation for the Multi-Agent Observability System.

## Table of Contents

- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [HTTP Endpoints](#http-endpoints)
  - [Events API](#events-api)
  - [Theme API](#theme-api)
- [WebSocket Protocol](#websocket-protocol)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Data Models](#data-models)

---

## Overview

The Multi-Agent Observability System provides a REST API for event management and a WebSocket API for real-time event streaming. The server is built with Bun and uses SQLite for persistence.

**Technology Stack:**
- **Runtime**: Bun (JavaScript/TypeScript runtime)
- **Database**: SQLite with WAL (Write-Ahead Logging) mode
- **Communication**: HTTP REST + WebSocket
- **Data Format**: JSON

---

## Base URL

**Default Local Development:**
```
HTTP: http://localhost:4000
WebSocket: ws://localhost:4000
```

**Configurable via Environment Variable:**
```bash
SERVER_PORT=4000  # Default
```

---

## Authentication

**Current Version**: No authentication required

The system is designed for local development and internal use. Future versions may include:
- API key authentication
- JWT tokens
- OAuth integration

---

## HTTP Endpoints

### Events API

#### POST /events

Create a new event from a Claude Code hook.

**Purpose**: Receive and store hook events from agents

**Request:**

```http
POST /events HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "source_app": "my-project",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "hook_event_type": "PreToolUse",
  "payload": {
    "tool_name": "Bash",
    "tool_input": {
      "command": "ls -la"
    }
  },
  "timestamp": 1705240800000,
  "model_name": "claude-sonnet-4-5",
  "summary": "Agent lists directory contents",
  "chat": [
    {
      "role": "user",
      "content": "Show me the files"
    }
  ]
}
```

**Request Body Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source_app` | string | Yes | Application identifier (e.g., "my-api-server") |
| `session_id` | string | Yes | Unique session UUID from Claude Code |
| `hook_event_type` | string | Yes | Type of hook event (see [Event Types](#event-types)) |
| `payload` | object | Yes | Event-specific data (structure varies by type) |
| `timestamp` | number | No | Unix timestamp in milliseconds (auto-generated if omitted) |
| `model_name` | string | No | AI model identifier (e.g., "claude-sonnet-4-5") |
| `summary` | string | No | AI-generated human-readable summary |
| `chat` | array | No | Full conversation transcript (JSONL format) |
| `humanInTheLoop` | object | No | Human-in-the-loop request data |

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: *

{
  "id": 1234,
  "source_app": "my-project",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "hook_event_type": "PreToolUse",
  "payload": {
    "tool_name": "Bash",
    "tool_input": {
      "command": "ls -la"
    }
  },
  "timestamp": 1705240800000,
  "model_name": "claude-sonnet-4-5",
  "summary": "Agent lists directory contents"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Auto-generated unique event ID |
| All request fields | - | Echoed back in response |

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Event created successfully |
| 400 | Invalid request (missing required fields or invalid JSON) |
| 500 | Server error |

**Example with curl:**

```bash
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{
    "source_app": "test-app",
    "session_id": "test-session-123",
    "hook_event_type": "PreToolUse",
    "payload": {
      "tool_name": "Read",
      "tool_input": {"file_path": "/tmp/test.txt"}
    }
  }'
```

---

#### GET /events/recent

Retrieve recent events with optional pagination.

**Purpose**: Fetch historical events for initial load or refresh

**Request:**

```http
GET /events/recent?limit=100 HTTP/1.1
Host: localhost:4000
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 300 | Maximum number of events to return |

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Origin: *

[
  {
    "id": 1234,
    "source_app": "my-project",
    "session_id": "a1b2c3d4-...",
    "hook_event_type": "PreToolUse",
    "timestamp": 1705240800000,
    "payload": {...},
    "model_name": "claude-sonnet-4-5",
    "summary": "Agent reads file"
  },
  {
    "id": 1235,
    "source_app": "another-project",
    "session_id": "x9y8z7w6-...",
    "hook_event_type": "PostToolUse",
    "timestamp": 1705240805000,
    "payload": {...}
  }
]
```

**Response**: Array of event objects (ordered by timestamp, newest first)

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Events retrieved successfully |
| 500 | Server error |

**Example with curl:**

```bash
curl http://localhost:4000/events/recent?limit=50
```

---

#### GET /events/filter-options

Get available filter values for UI dropdowns.

**Purpose**: Retrieve unique values for source_app, session_id, and hook_event_type

**Request:**

```http
GET /events/filter-options HTTP/1.1
Host: localhost:4000
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "source_apps": [
    "my-api-server",
    "react-app",
    "backend-service"
  ],
  "session_ids": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "x9y8z7w6-v5u4-3210-zyxw-vu9876543210"
  ],
  "hook_event_types": [
    "PreToolUse",
    "PostToolUse",
    "UserPromptSubmit",
    "Notification",
    "Stop"
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `source_apps` | string[] | Unique application identifiers |
| `session_ids` | string[] | Unique session IDs (limited to 300 most recent) |
| `hook_event_types` | string[] | Unique event types |

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Filter options retrieved successfully |
| 500 | Server error |

---

#### POST /events/:id/respond

Respond to a Human-in-the-Loop (HITL) request.

**Purpose**: Send user response back to waiting agent

**Request:**

```http
POST /events/1234/respond HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "response": "Yes, proceed with the operation",
  "permission": true,
  "choice": "Option 1",
  "respondedBy": "engineer@example.com"
}
```

**Request Body Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `response` | string | No | Text response to question |
| `permission` | boolean | No | Approval/denial for permission requests |
| `choice` | string | No | Selected choice from multiple options |
| `respondedBy` | string | No | User identifier |

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 1234,
  "source_app": "my-project",
  "session_id": "abc-123",
  "hook_event_type": "Notification",
  "humanInTheLoop": {
    "question": "Should I proceed?",
    "type": "permission",
    "responseWebSocketUrl": "ws://localhost:9000/hitl"
  },
  "humanInTheLoopStatus": {
    "status": "responded",
    "respondedAt": 1705240850000,
    "response": {
      "permission": true,
      "respondedBy": "engineer@example.com"
    }
  }
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Response sent successfully |
| 404 | Event not found |
| 400 | Invalid request |
| 500 | Server error or failed to reach agent |

---

### Token Metrics API

Track token usage and API costs across sessions.

#### GET /api/metrics/session/:sessionId

Get token metrics for a specific session.

**Purpose**: Retrieve token count and cost data for a single session

**Request:**

```http
GET /api/metrics/session/a1b2c3d4-e5f6-7890 HTTP/1.1
Host: localhost:4000
```

**Response:**

```json
{
  "id": 1,
  "source_app": "my-project",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "total_tokens": 15234,
  "total_cost": 0.0457,
  "message_count": 12,
  "start_time": 1705240800000,
  "end_time": 1705244400000,
  "model_name": "claude-sonnet-4-5"
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 404 | Session not found |
| 500 | Server error |

---

#### GET /api/metrics/sessions

Get metrics for all sessions, optionally filtered by source app.

**Purpose**: Retrieve all session metrics for analysis

**Request:**

```http
GET /api/metrics/sessions?source_app=my-project HTTP/1.1
Host: localhost:4000
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source_app | string | No | Filter by application name |

**Response:**

```json
[
  {
    "id": 1,
    "source_app": "my-project",
    "session_id": "a1b2c3d4-...",
    "total_tokens": 15234,
    "total_cost": 0.0457,
    "message_count": 12,
    "start_time": 1705240800000,
    "end_time": 1705244400000,
    "model_name": "claude-sonnet-4-5"
  },
  {
    "id": 2,
    "source_app": "another-project",
    "total_tokens": 8421,
    "total_cost": 0.0253,
    "message_count": 7,
    "model_name": "claude-haiku-4"
  }
]
```

**Cost Calculation:**

Costs are calculated using the following pricing (per 1M tokens):

| Model | Input Cost | Output Cost |
|-------|------------|-------------|
| claude-sonnet-4-5 | $3.00 | $15.00 |
| claude-opus-4 | $15.00 | $75.00 |
| claude-haiku-4 | $0.25 | $1.25 |

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 500 | Server error |

---

### Tool Analytics API

Track tool success/failure rates and error patterns.

#### POST /api/analytics/tools

Submit tool analytics data.

**Purpose**: Record tool execution results for analysis

**Request:**

```http
POST /api/analytics/tools HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "source_app": "my-project",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tool_name": "Bash",
  "success": false,
  "error_type": "permission_error",
  "error_message": "Permission denied: cannot execute command",
  "timestamp": 1705240800000,
  "event_id": 123
}
```

**Request Body Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| source_app | string | Yes | Application identifier |
| session_id | string | Yes | Session UUID |
| tool_name | string | Yes | Name of the tool used |
| success | boolean | Yes | Whether tool execution succeeded |
| error_type | string | No | Classification of error |
| error_message | string | No | Detailed error message (max 500 chars) |
| timestamp | number | No | Unix timestamp in milliseconds |
| event_id | number | No | Related event ID |

**Error Types:**

| Error Type | Description |
|-----------|-------------|
| permission_error | Permission denied or access forbidden |
| not_found_error | File or resource not found |
| timeout_error | Operation timed out |
| syntax_error | Syntax or parsing error |
| network_error | Network connection issue |
| command_not_found | Command or tool not available |
| memory_error | Out of memory |
| disk_error | Disk space or I/O error |
| invalid_argument | Invalid input or argument |
| unknown_error | Unclassified error |

**Response:**

```json
{
  "success": true
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 201 | Analytics recorded |
| 400 | Missing required fields or invalid data |
| 500 | Server error |

---

#### GET /api/analytics/tools/stats

Get tool usage statistics and success rates.

**Purpose**: Analyze tool reliability across sessions

**Request:**

```http
GET /api/analytics/tools/stats?session_id=abc123&source_app=my-project HTTP/1.1
Host: localhost:4000
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| session_id | string | No | Filter by specific session |
| source_app | string | No | Filter by application |

**Response:**

```json
[
  {
    "tool_name": "Bash",
    "total_uses": 234,
    "successes": 198,
    "failures": 36,
    "success_rate": 84.62,
    "most_common_error": "permission_error"
  },
  {
    "tool_name": "Read",
    "total_uses": 456,
    "successes": 450,
    "failures": 6,
    "success_rate": 98.68,
    "most_common_error": "not_found_error"
  },
  {
    "tool_name": "Write",
    "total_uses": 89,
    "successes": 87,
    "failures": 2,
    "success_rate": 97.75,
    "most_common_error": "permission_error"
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| tool_name | string | Name of the tool |
| total_uses | number | Total number of times used |
| successes | number | Number of successful executions |
| failures | number | Number of failed executions |
| success_rate | number | Percentage of successful uses (0-100) |
| most_common_error | string | Most frequent error type (if any) |

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 500 | Server error |

---

#### GET /api/analytics/errors/summary

Get a summary of the most common errors.

**Purpose**: Identify patterns in tool failures

**Request:**

```http
GET /api/analytics/errors/summary?limit=10 HTTP/1.1
Host: localhost:4000
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Maximum number of errors to return (default: 10) |

**Response:**

```json
[
  {
    "error_type": "permission_error",
    "count": 45,
    "tool_name": "Bash",
    "recent_message": "Permission denied: /usr/local/bin/restricted-command"
  },
  {
    "error_type": "not_found_error",
    "count": 23,
    "tool_name": "Read",
    "recent_message": "File not found: config.json"
  },
  {
    "error_type": "timeout_error",
    "count": 12,
    "tool_name": "WebFetch",
    "recent_message": "Connection timeout after 5000ms"
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| error_type | string | Classification of the error |
| count | number | Number of occurrences |
| tool_name | string | Tool that produced this error |
| recent_message | string | Most recent error message example |

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 500 | Server error |

---

### Session Bookmarking API

Bookmark important sessions for quick access and review.

#### POST /api/bookmarks

Create or update a session bookmark.

**Purpose**: Bookmark a session for later review

**Request:**

```http
POST /api/bookmarks HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "source_app": "my-project",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "bookmarked": true,
  "notes": "Great example of debugging workflow"
}
```

**Request Body Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| source_app | string | Yes | Application identifier |
| session_id | string | Yes | Session UUID |
| bookmarked | boolean | Yes | Whether session is bookmarked |
| notes | string | No | Optional notes about the session |

**Response:**

```json
{
  "success": true
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 201 | Bookmark created/updated |
| 400 | Missing required fields |
| 500 | Server error |

---

#### GET /api/bookmarks

Get all bookmarked sessions.

**Purpose**: Retrieve list of bookmarked sessions

**Request:**

```http
GET /api/bookmarks?source_app=my-project HTTP/1.1
Host: localhost:4000
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source_app | string | No | Filter by application |

**Response:**

```json
[
  {
    "id": 1,
    "source_app": "my-project",
    "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "bookmarked": true,
    "bookmarked_at": 1705240800000,
    "notes": "Great example of debugging workflow"
  },
  {
    "id": 2,
    "source_app": "another-project",
    "session_id": "x9y8z7w6-v5u4-3210-zyxw-vu9876543210",
    "bookmarked": true,
    "bookmarked_at": 1705244400000
  }
]
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 500 | Server error |

---

#### GET /api/bookmarks/:sourceApp/:sessionId

Get bookmark status for a specific session.

**Purpose**: Check if a session is bookmarked

**Request:**

```http
GET /api/bookmarks/my-project/a1b2c3d4-e5f6-7890 HTTP/1.1
Host: localhost:4000
```

**Response:**

```json
{
  "id": 1,
  "source_app": "my-project",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "bookmarked": true,
  "bookmarked_at": 1705240800000,
  "notes": "Great example"
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success (returns {bookmarked: false} if not found) |
| 500 | Server error |

---

#### DELETE /api/bookmarks/:sourceApp/:sessionId

Remove a bookmark.

**Purpose**: Unbookmark a session

**Request:**

```http
DELETE /api/bookmarks/my-project/a1b2c3d4-e5f6-7890 HTTP/1.1
Host: localhost:4000
```

**Response:**

```json
{
  "success": true
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Bookmark removed |
| 404 | Bookmark not found |
| 500 | Server error |

---

### Session Tagging API

Organize sessions with custom tags for categorization and filtering.

#### POST /api/tags

Add a tag to a session.

**Purpose**: Tag a session for organization

**Request:**

```http
POST /api/tags HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "source_app": "my-project",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tag": "debugging",
  "created_at": 1705240800000
}
```

**Request Body Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| source_app | string | Yes | Application identifier |
| session_id | string | Yes | Session UUID |
| tag | string | Yes | Tag name (case-sensitive) |
| created_at | number | No | Unix timestamp (auto-generated if omitted) |

**Response:**

```json
{
  "success": true
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 201 | Tag added (duplicate tags ignored) |
| 400 | Missing required fields |
| 500 | Server error |

---

#### GET /api/tags/session/:sourceApp/:sessionId

Get all tags for a session.

**Purpose**: Retrieve tags associated with a session

**Request:**

```http
GET /api/tags/session/my-project/a1b2c3d4-e5f6-7890 HTTP/1.1
Host: localhost:4000
```

**Response:**

```json
[
  {
    "id": 1,
    "source_app": "my-project",
    "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tag": "debugging",
    "created_at": 1705240800000
  },
  {
    "id": 2,
    "source_app": "my-project",
    "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tag": "successful",
    "created_at": 1705240850000
  }
]
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 500 | Server error |

---

#### GET /api/tags/all

Get all unique tags across all sessions.

**Purpose**: Retrieve complete tag vocabulary

**Request:**

```http
GET /api/tags/all?source_app=my-project HTTP/1.1
Host: localhost:4000
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source_app | string | No | Filter by application |

**Response:**

```json
[
  "debugging",
  "successful",
  "refactoring",
  "testing",
  "production"
]
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 500 | Server error |

---

#### GET /api/tags/:tag/sessions

Get all sessions with a specific tag.

**Purpose**: Find sessions by tag

**Request:**

```http
GET /api/tags/debugging/sessions?source_app=my-project HTTP/1.1
Host: localhost:4000
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source_app | string | No | Filter by application |

**Response:**

```json
[
  {
    "id": 1,
    "source_app": "my-project",
    "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tag": "debugging",
    "created_at": 1705240800000
  },
  {
    "id": 3,
    "source_app": "my-project",
    "session_id": "p9q8r7s6-t5u4-3210-vwxy-z1234567890",
    "tag": "debugging",
    "created_at": 1705244400000
  }
]
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 500 | Server error |

---

#### DELETE /api/tags/:sourceApp/:sessionId/:tag

Remove a tag from a session.

**Purpose**: Untag a session

**Request:**

```http
DELETE /api/tags/my-project/a1b2c3d4-e5f6-7890/debugging HTTP/1.1
Host: localhost:4000
```

**Response:**

```json
{
  "success": true
}
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Tag removed |
| 404 | Tag not found |
| 500 | Server error |

---

### Performance Metrics API

Analyze agent performance with detailed metrics on response time, tool usage, and success rates.

#### GET /api/metrics/performance/:sourceApp/:sessionId

Get performance metrics for a specific session.

**Purpose**: Analyze individual session performance

**Request:**

```http
GET /api/metrics/performance/my-project/a1b2c3d4-e5f6-7890 HTTP/1.1
Host: localhost:4000
```

**Response:**

```json
{
  "id": 1,
  "source_app": "my-project",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "avg_response_time": 1234.5,
  "tools_per_task": 2.5,
  "success_rate": 94.2,
  "session_duration": 3600000,
  "total_events": 45,
  "total_tool_uses": 28,
  "calculated_at": 1705244400000
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| id | number | Metrics record ID |
| source_app | string | Application identifier |
| session_id | string | Session UUID |
| avg_response_time | number | Average time between events (ms) |
| tools_per_task | number | Average tools used per task |
| success_rate | number | Percentage of successful tool uses |
| session_duration | number | Total session time (ms) |
| total_events | number | Total events in session |
| total_tool_uses | number | Total tool executions |
| calculated_at | number | Unix timestamp of calculation |

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 404 | Metrics not found |
| 500 | Server error |

---

#### GET /api/metrics/performance/all

Get performance metrics for all sessions.

**Purpose**: Compare performance across sessions

**Request:**

```http
GET /api/metrics/performance/all?source_app=my-project HTTP/1.1
Host: localhost:4000
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source_app | string | No | Filter by application |

**Response:**

```json
[
  {
    "id": 1,
    "source_app": "my-project",
    "session_id": "a1b2c3d4-...",
    "avg_response_time": 1234.5,
    "tools_per_task": 2.5,
    "success_rate": 94.2,
    "session_duration": 3600000,
    "total_events": 45,
    "total_tool_uses": 28,
    "calculated_at": 1705244400000
  },
  {
    "id": 2,
    "source_app": "another-project",
    "avg_response_time": 892.3,
    "tools_per_task": 1.8,
    "success_rate": 98.5,
    "session_duration": 1800000,
    "total_events": 32,
    "total_tool_uses": 18,
    "calculated_at": 1705248000000
  }
]
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 500 | Server error |

---

#### POST /api/metrics/performance/calculate/:sourceApp/:sessionId

Calculate and store performance metrics for a session.

**Purpose**: Trigger metric calculation for a session

**Request:**

```http
POST /api/metrics/performance/calculate/my-project/a1b2c3d4-e5f6-7890 HTTP/1.1
Host: localhost:4000
```

**Response:**

```json
{
  "id": 1,
  "source_app": "my-project",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "avg_response_time": 1234.5,
  "tools_per_task": 2.5,
  "success_rate": 94.2,
  "session_duration": 3600000,
  "total_events": 45,
  "total_tool_uses": 28,
  "calculated_at": 1705244400000
}
```

**Calculation Method:**

- **avg_response_time**: Time between consecutive events (excludes gaps >5 minutes)
- **tools_per_task**: Total tool uses divided by total events
- **success_rate**: Percentage from tool_analytics table
- **session_duration**: Time from first to last event

**Status Codes:**

| Code | Description |
|------|-------------|
| 201 | Metrics calculated and stored |
| 404 | No events found for session |
| 500 | Server error |

---

### Pattern Detection API

Automatically detect and analyze agent behavior patterns.

#### GET /api/patterns/:sourceApp/:sessionId

Get detected patterns for a specific session.

**Purpose**: View patterns found in a session

**Request:**

```http
GET /api/patterns/my-project/a1b2c3d4-e5f6-7890 HTTP/1.1
Host: localhost:4000
```

**Response:**

```json
[
  {
    "id": 1,
    "source_app": "my-project",
    "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "pattern_type": "workflow",
    "pattern_name": "read-before-edit",
    "description": "Agent reads a file before editing it",
    "occurrences": 5,
    "first_seen": 1705240800000,
    "last_seen": 1705243200000,
    "example_sequence": "[\"Read\", \"Edit\"]",
    "confidence_score": 95
  },
  {
    "id": 2,
    "source_app": "my-project",
    "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "pattern_type": "workflow",
    "pattern_name": "search-then-read",
    "description": "Agent searches for files/content before reading",
    "occurrences": 3,
    "first_seen": 1705240900000,
    "last_seen": 1705242400000,
    "example_sequence": "[\"Grep\", \"Read\"]",
    "confidence_score": 90
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| id | number | Pattern record ID |
| source_app | string | Application identifier |
| session_id | string | Session UUID |
| pattern_type | string | Category (workflow, retry, sequence) |
| pattern_name | string | Pattern identifier |
| description | string | Human-readable description |
| occurrences | number | Times pattern was observed |
| first_seen | number | Unix timestamp of first occurrence |
| last_seen | number | Unix timestamp of last occurrence |
| example_sequence | string | JSON array of event sequence |
| confidence_score | number | Confidence percentage (0-100) |

**Pattern Types:**

| Type | Description | Examples |
|------|-------------|----------|
| workflow | Common work sequences | read-before-edit, search-then-read |
| retry | Repeated tool attempts | tool-retry (same tool 3+ times) |
| sequence | Multi-step patterns | grep-read-edit chain |

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success (empty array if no patterns) |
| 500 | Server error |

---

#### GET /api/patterns/all

Get all detected patterns across all sessions.

**Purpose**: Analyze patterns system-wide

**Request:**

```http
GET /api/patterns/all?source_app=my-project HTTP/1.1
Host: localhost:4000
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| source_app | string | No | Filter by application |

**Response:**

```json
[
  {
    "id": 1,
    "source_app": "my-project",
    "session_id": "a1b2c3d4-...",
    "pattern_type": "workflow",
    "pattern_name": "read-before-edit",
    "description": "Agent reads a file before editing it",
    "occurrences": 5,
    "confidence_score": 95
  }
]
```

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 500 | Server error |

---

#### GET /api/patterns/trending

Get the most common patterns.

**Purpose**: Identify frequent agent behaviors

**Request:**

```http
GET /api/patterns/trending?limit=10&source_app=my-project HTTP/1.1
Host: localhost:4000
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Maximum patterns to return (default: 10) |
| source_app | string | No | Filter by application |

**Response:**

```json
[
  {
    "id": 5,
    "source_app": "my-project",
    "session_id": "various",
    "pattern_type": "workflow",
    "pattern_name": "read-before-edit",
    "description": "Agent reads a file before editing it",
    "occurrences": 234,
    "confidence_score": 95
  },
  {
    "id": 12,
    "source_app": "my-project",
    "pattern_type": "retry",
    "pattern_name": "tool-retry",
    "description": "Agent retried Bash 3 times",
    "occurrences": 89,
    "confidence_score": 85
  }
]
```

**Sorting**: Results ordered by occurrences (descending), then confidence score

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 500 | Server error |

---

#### POST /api/patterns/detect/:sourceApp/:sessionId

Detect and store patterns for a session.

**Purpose**: Trigger pattern detection analysis

**Request:**

```http
POST /api/patterns/detect/my-project/a1b2c3d4-e5f6-7890 HTTP/1.1
Host: localhost:4000
```

**Response:**

```json
[
  {
    "source_app": "my-project",
    "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "pattern_type": "workflow",
    "pattern_name": "read-before-edit",
    "description": "Agent reads a file before editing it",
    "occurrences": 1,
    "first_seen": 1705240800000,
    "last_seen": 1705240850000,
    "example_sequence": "[\"Read\", \"Edit\"]",
    "confidence_score": 95
  }
]
```

**Detection Algorithm:**

1. **read-before-edit**: Read → Edit/Write sequence
2. **search-then-read**: Grep/Glob → Read sequence
3. **tool-retry**: Same tool used 3+ times consecutively

**Note**: Patterns are automatically merged with existing records (occurrences incremented)

**Status Codes:**

| Code | Description |
|------|-------------|
| 201 | Patterns detected and stored |
| 500 | Server error |

---

### Theme API

#### POST /api/themes

Create a new UI theme.

**Request:**

```http
POST /api/themes HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "name": "ocean-blue",
  "displayName": "Ocean Blue",
  "description": "Calm blue theme inspired by the ocean",
  "colors": {
    "primary": "#0066cc",
    "primaryHover": "#0052a3",
    "bgPrimary": "#001a33",
    "textPrimary": "#ffffff"
  },
  "isPublic": true,
  "authorId": "user123",
  "tags": ["blue", "dark", "professional"]
}
```

**Response:**

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "theme-uuid-here",
    "name": "ocean-blue",
    "displayName": "Ocean Blue",
    "createdAt": 1705240800000,
    "updatedAt": 1705240800000
  }
}
```

---

#### GET /api/themes

Search for themes.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Search in name/description |
| `isPublic` | boolean | Filter by public/private |
| `authorId` | string | Filter by author |
| `sortBy` | string | Sort field (name, created, rating) |
| `limit` | number | Max results |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "theme-1",
      "name": "ocean-blue",
      "displayName": "Ocean Blue",
      "rating": 4.5,
      "downloadCount": 42
    }
  ]
}
```

---

#### GET /api/themes/:id

Get a specific theme by ID.

#### PUT /api/themes/:id

Update a theme.

#### DELETE /api/themes/:id

Delete a theme.

#### GET /api/themes/:id/export

Export theme configuration.

#### POST /api/themes/import

Import theme from exported data.

---

## WebSocket Protocol

### Connection

**Endpoint**: `ws://localhost:4000/stream`

**Connect with JavaScript:**

```javascript
const ws = new WebSocket('ws://localhost:4000/stream');

ws.onopen = () => {
  console.log('Connected to event stream');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

---

### Message Types

#### Initial Events

Sent immediately upon connection.

**Message:**

```json
{
  "type": "initial",
  "data": [
    {
      "id": 1,
      "source_app": "app1",
      "session_id": "session1",
      "hook_event_type": "PreToolUse",
      "timestamp": 1705240800000,
      "payload": {}
    }
  ]
}
```

**Purpose**: Load recent events (last 300) into client

---

#### New Event

Broadcast when a new event is created.

**Message:**

```json
{
  "type": "event",
  "data": {
    "id": 1235,
    "source_app": "app2",
    "session_id": "session2",
    "hook_event_type": "PostToolUse",
    "timestamp": 1705240850000,
    "payload": {
      "tool_name": "Read",
      "tool_result": "File contents..."
    }
  }
}
```

**Purpose**: Real-time event notification to all connected clients

---

### Client-to-Server Messages

Currently not implemented. WebSocket is server-to-client only.

**Future Enhancement**: Client could send commands like:
- Subscribe to specific sessions
- Request historical data
- Acknowledge receipt

---

### Connection Management

#### Reconnection Strategy

**Recommended Implementation:**

```javascript
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

function connect() {
  const ws = new WebSocket('ws://localhost:4000/stream');

  ws.onclose = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      reconnectAttempts++;

      console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
      setTimeout(connect, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  };

  ws.onopen = () => {
    reconnectAttempts = 0; // Reset on successful connection
  };
}
```

**Exponential Backoff:**
- Attempt 1: 2 seconds
- Attempt 2: 4 seconds
- Attempt 3: 8 seconds
- Attempt 4: 16 seconds
- Attempt 5+: 30 seconds (capped)

---

## Error Handling

### HTTP Error Responses

**Format:**

```json
{
  "error": "Error description",
  "message": "Additional details",
  "validationErrors": [
    {
      "field": "source_app",
      "message": "Field is required",
      "code": "REQUIRED"
    }
  ]
}
```

### Common Error Codes

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | Missing required fields | Request missing source_app, session_id, or hook_event_type | Include all required fields |
| 400 | Invalid JSON | Malformed JSON in request body | Validate JSON before sending |
| 404 | Event not found | Event ID doesn't exist | Check event ID |
| 500 | Server error | Database error or internal failure | Check server logs |

---

## Rate Limiting

**Current Version**: No rate limiting

**Recommendations for Production:**
- Implement per-IP rate limiting
- Add burst protection
- Use sliding window algorithm
- Suggested limits:
  - 1000 requests per minute per IP
  - 100 WebSocket connections per IP

---

## Data Models

### Event Types

All supported hook event types:

| Type | Description | When Triggered |
|------|-------------|----------------|
| `PreToolUse` | Before tool execution | Claude about to use a tool |
| `PostToolUse` | After tool execution | Tool completes (success or failure) |
| `UserPromptSubmit` | User submits prompt | User sends message to Claude |
| `Notification` | Agent notification | Claude requests user interaction |
| `Stop` | Response completion | Claude finishes responding |
| `SubagentStop` | Subagent completion | Subagent task completes |
| `PreCompact` | Before context compaction | Context about to be compressed |
| `SessionStart` | Session begins | New session starts |
| `SessionEnd` | Session ends | Session terminates |

### HookEvent Interface

```typescript
interface HookEvent {
  id?: number;                    // Auto-generated
  source_app: string;             // Application identifier
  session_id: string;             // Session UUID
  hook_event_type: string;        // Event type
  payload: Record<string, any>;   // Event-specific data
  chat?: any[];                   // Conversation history
  summary?: string;               // AI summary
  timestamp?: number;             // Unix ms
  model_name?: string;            // AI model
  humanInTheLoop?: HumanInTheLoop;
  humanInTheLoopStatus?: HumanInTheLoopStatus;
}
```

### Payload Examples

**PreToolUse - Bash:**
```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "git status"
  }
}
```

**PostToolUse - Read:**
```json
{
  "tool_name": "Read",
  "tool_input": {
    "file_path": "/path/to/file.js"
  },
  "tool_result": "// File contents..."
}
```

**UserPromptSubmit:**
```json
{
  "user_message": "Create a new API endpoint"
}
```

---

## Priority 2 & 3 Features API

### Webhook/Alert System API (Priority 2)

#### POST /api/webhooks
Create a new webhook for event notifications.

**Request:**
```http
POST /api/webhooks HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "name": "Slack Notifications",
  "url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
  "event_type": "*",
  "source_app": "my-app",
  "enabled": true,
  "secret": "your-secret-key",
  "filters": {
    "tool_names": ["Bash", "Edit"],
    "error_types": ["permission_error"]
  }
}
```

**Response:**
```json
{
  "id": 1,
  "success": true
}
```

**Status Codes:**
- 201: Webhook created successfully
- 400: Invalid request (missing required fields)

---

#### GET /api/webhooks
List all webhooks with delivery statistics.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Slack Notifications",
    "url": "https://hooks.slack.com/...",
    "event_type": "*",
    "source_app": "my-app",
    "enabled": true,
    "created_at": 1705240800000,
    "total": 150,
    "success_count": 145,
    "failed_count": 5
  }
]
```

---

#### PUT /api/webhooks/:id
Update an existing webhook.

**Request:**
```json
{
  "name": "Updated Webhook Name",
  "enabled": false
}
```

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- 200: Webhook updated
- 404: Webhook not found

---

#### DELETE /api/webhooks/:id
Delete a webhook.

**Status Codes:**
- 200: Webhook deleted
- 404: Webhook not found

---

#### GET /api/webhooks/:id/deliveries
Get delivery history for a webhook.

**Query Parameters:**
- `limit` (optional): Number of deliveries to return (default: 50)

**Response:**
```json
[
  {
    "id": 1,
    "webhook_id": 1,
    "event_id": 234,
    "status": "success",
    "response_code": 200,
    "attempted_at": 1705240800000,
    "retry_count": 0
  }
]
```

---

### Session Export API (Priority 2)

#### GET /api/export/session/:sessionId
Export session data in multiple formats.

**Query Parameters:**
- `format`: Export format (`json`, `markdown`, `html`) - default: `json`
- `source_app` (optional): Filter by source application

**Examples:**

**Export as JSON:**
```http
GET /api/export/session/abc123?format=json HTTP/1.1
```

**Export as Markdown:**
```http
GET /api/export/session/abc123?format=markdown HTTP/1.1
```

**Export as HTML:**
```http
GET /api/export/session/abc123?format=html HTTP/1.1
```

**Response:** File download with appropriate Content-Type and Content-Disposition headers.

**Status Codes:**
- 200: Session exported successfully
- 404: Session not found

---

### Session Comparison API (Priority 2)

#### POST /api/comparisons
Create a new session comparison.

**Request:**
```json
{
  "name": "Sonnet vs Haiku Performance",
  "description": "Comparing model performance on same task",
  "session_ids": ["session-1", "session-2", "session-3"],
  "created_by": "user@example.com"
}
```

**Response:**
```json
{
  "id": 1,
  "success": true
}
```

---

#### GET /api/comparisons
List all saved comparisons.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Sonnet vs Haiku Performance",
    "description": "Comparing model performance",
    "session_ids": ["session-1", "session-2"],
    "created_at": 1705240800000,
    "created_by": "user@example.com"
  }
]
```

---

#### GET /api/comparisons/analyze
Analyze and compare multiple sessions.

**Query Parameters:**
- `sessions`: Array of session IDs to compare (minimum 2)

**Example:**
```http
GET /api/comparisons/analyze?sessions=session-1&sessions=session-2 HTTP/1.1
```

**Response:**
```json
{
  "sessions": [
    {
      "source_app": "my-app",
      "session_id": "session-1",
      "duration": 120000,
      "event_count": 45,
      "tool_count": 12
    }
  ],
  "metrics_comparison": {
    "response_times": [1200, 850],
    "token_usage": [15000, 12000],
    "costs": [0.045, 0.036],
    "tool_counts": [12, 10],
    "success_rates": [95.5, 98.2],
    "winner": "session-2"
  },
  "pattern_differences": [],
  "tool_usage_comparison": {},
  "efficiency_score": {
    "by_session": [0.1, 0.12],
    "overall_winner": "session-2"
  },
  "recommendations": [
    "Session 'my-app:session-2' had the best overall performance",
    "Average cost across sessions: $0.0405"
  ]
}
```

---

#### POST /api/comparisons/:id/notes
Add a note to a comparison.

**Request:**
```json
{
  "note": "Session 2 performed better due to more efficient tool usage"
}
```

**Response:**
```json
{
  "id": 1,
  "success": true
}
```

---

#### GET /api/comparisons/:id/notes
Get all notes for a comparison.

**Response:**
```json
[
  {
    "id": 1,
    "comparison_id": 1,
    "note": "Session 2 performed better",
    "timestamp": 1705240800000
  }
]
```

---

### Decision Tree API (Priority 3)

#### GET /api/decision-tree/session/:sessionId
Get decision tree visualization data for a session.

**Query Parameters:**
- `source_app` (optional): Filter by source application

**Response:**
```json
{
  "nodes": [
    {
      "id": "node_0",
      "type": "prompt",
      "label": "User Prompt: Fix the bug in...",
      "timestamp": 1705240800000,
      "event_id": 1
    },
    {
      "id": "node_1",
      "type": "tool",
      "label": "Read",
      "timestamp": 1705240801000,
      "event_id": 2,
      "metadata": { "file_path": "src/app.ts" }
    },
    {
      "id": "node_2",
      "type": "result",
      "label": "Tool Result",
      "timestamp": 1705240802000,
      "event_id": 3
    }
  ],
  "edges": [
    {
      "from": "node_0",
      "to": "node_1",
      "type": "uses",
      "label": "Read"
    },
    {
      "from": "node_1",
      "to": "node_2",
      "type": "produces",
      "label": "Tool Result"
    }
  ],
  "root": "node_0"
}
```

**Node Types:**
- `prompt`: User prompt submission
- `tool`: Tool execution
- `result`: Tool result
- `completion`: Response completion

**Edge Types:**
- `triggers`: Prompt triggers action
- `uses`: Uses a tool
- `produces`: Produces a result
- `leads_to`: Leads to completion

---

### Agent Collaboration API (Priority 3)

#### POST /api/collaboration/relationships
Create a parent-child agent relationship.

**Request:**
```json
{
  "parent_source_app": "main-app",
  "parent_session_id": "parent-123",
  "child_source_app": "sub-app",
  "child_session_id": "child-456",
  "relationship_type": "subagent",
  "task_description": "Process user authentication",
  "delegation_reason": "Specialized authentication handling",
  "started_at": 1705240800000,
  "completed_at": 1705240900000
}
```

**Response:**
```json
{
  "id": 1,
  "success": true
}
```

---

#### GET /api/collaboration/session/:sessionId/hierarchy
Get the full agent hierarchy for a session.

**Response:**
```json
{
  "source_app": "main-app",
  "session_id": "parent-123",
  "children": [
    {
      "source_app": "sub-app",
      "session_id": "child-456",
      "children": [],
      "metrics": {
        "total_events": 25,
        "duration": 60000,
        "tool_count": 8,
        "depth": 1
      },
      "task_description": "Process user authentication"
    }
  ],
  "metrics": {
    "total_events": 50,
    "duration": 120000,
    "tool_count": 15,
    "depth": 0
  }
}
```

---

#### GET /api/collaboration/session/:sessionId/children
Get direct child sessions of a parent session.

**Response:**
```json
[
  {
    "id": 1,
    "parent_source_app": "main-app",
    "parent_session_id": "parent-123",
    "child_source_app": "sub-app",
    "child_session_id": "child-456",
    "relationship_type": "subagent",
    "task_description": "Process authentication",
    "created_at": 1705240800000
  }
]
```

---

#### GET /api/collaboration/relationships/all
Get all agent relationships in the system.

**Response:**
```json
[
  {
    "id": 1,
    "parent_source_app": "main-app",
    "parent_session_id": "parent-123",
    "child_source_app": "sub-app",
    "child_session_id": "child-456",
    "relationship_type": "subagent",
    "created_at": 1705240800000
  }
]
```

---

## Best Practices

### For Hook Scripts

1. **Always exit with 0**: Don't block Claude Code on observability failures
2. **Set timeouts**: Don't hang indefinitely
3. **Validate before sending**: Check required fields
4. **Handle errors gracefully**: Log errors but continue

### For API Consumers

1. **Implement retry logic**: Network failures are temporary
2. **Use WebSocket for real-time**: Don't poll HTTP endpoints
3. **Limit stored events**: Prevent memory bloat
4. **Validate responses**: Don't assume structure

### Performance Tips

1. **Batch events**: Send multiple in one array if possible
2. **Compress large payloads**: Use gzip for chat transcripts
3. **Index database**: Events table has indexes on common queries
4. **Use WAL mode**: SQLite configured for concurrent reads

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01 | Initial release |
| 1.1.0 | 2025-01 | Added Theme API |
| 1.2.0 | 2025-01 | Added HITL support |

---

## Support

For issues, questions, or contributions:
- **GitHub Issues**: [Report bugs or request features](https://github.com/your-repo/issues)
- **Documentation**: Check ARCHITECTURE.md and CODE_WALKTHROUGH.md
- **Video Tutorials**: [YouTube Channel](https://www.youtube.com/@indydevdan)
