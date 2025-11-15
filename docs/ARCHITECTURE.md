# Architecture Deep Dive

## Table of Contents
- [System Overview](#system-overview)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Database Schema](#database-schema)
- [Communication Protocols](#communication-protocols)
- [Agent Identification](#agent-identification)
- [Event Processing Pipeline](#event-processing-pipeline)
- [Real-Time Synchronization](#real-time-synchronization)
- [State Management](#state-management)
- [Security Architecture](#security-architecture)

---

## System Overview

The Multi-Agent Observability System is a **distributed, event-driven architecture** designed to monitor Claude Code agents in real-time. It consists of three main layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Vue 3 Client (Browser)                                   │  │
│  │  - Event Timeline Component                               │  │
│  │  - Filter Panel Component                                 │  │
│  │  - Live Pulse Chart Component                             │  │
│  │  - Chat Transcript Modal                                  │  │
│  │  - Theme Manager                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ WebSocket + HTTP
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     APPLICATION LAYER                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Bun Server                                               │  │
│  │  - HTTP REST API                                          │  │
│  │  - WebSocket Server                                       │  │
│  │  - Event Validator                                        │  │
│  │  - Database Manager                                       │  │
│  │  - Theme Manager                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │ SQL
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      PERSISTENCE LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SQLite Database (WAL Mode)                               │  │
│  │  - events table                                           │  │
│  │  - themes table                                           │  │
│  │  - Indexes on source_app, session_id, hook_event_type    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      AGENT LAYER (External)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Claude Code Agents                                       │  │
│  │  ├── Agent 1 (Project A)                                  │  │
│  │  ├── Agent 2 (Project B)                                  │  │
│  │  └── Agent N (Project N)                                  │  │
│  │       │                                                    │  │
│  │       └──> Hook System (.claude/hooks/)                   │  │
│  │            ├── pre_tool_use.py                            │  │
│  │            ├── post_tool_use.py                           │  │
│  │            ├── notification.py                            │  │
│  │            ├── user_prompt_submit.py                      │  │
│  │            ├── stop.py                                    │  │
│  │            └── send_event.py (Universal Sender)           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP POST (JSON)
                         │
                         └──────────> Application Layer
```

### Key Design Principles

1. **Event-Driven**: All state changes are events
2. **Real-Time**: WebSocket for instant updates
3. **Stateless Server**: No session storage on server
4. **Client-Side Filtering**: Server sends all, client filters
5. **Append-Only**: Events are immutable
6. **Multi-Tenant**: Support multiple concurrent agents

---

## Component Architecture

### 1. Hook System Architecture

```
Claude Code Process
       │
       ├──> Before Tool Use
       │         │
       │         ├──> pre_tool_use.py
       │         │     ├── Validate command
       │         │     ├── Check dangerous patterns
       │         │     └── Allow/Block execution
       │         │
       │         └──> send_event.py
       │               ├── Extract context
       │               ├── Build event payload
       │               └── POST to server
       │
       ├──> After Tool Use
       │         │
       │         ├──> post_tool_use.py
       │         │     ├── Capture output
       │         │     └── Log results
       │         │
       │         └──> send_event.py
       │
       ├──> User Prompt
       │         │
       │         └──> user_prompt_submit.py
       │               └──> send_event.py
       │
       └──> ... (other hooks)
```

**Hook Script Structure:**
```python
# 1. Inline Script Metadata (for uv)
# /// script
# dependencies = ["anthropic", "python-dotenv"]
# ///

# 2. Imports
import json, sys, os
from pathlib import Path

# 3. Configuration
SERVER_URL = "http://localhost:4000/events"
SOURCE_APP = "my-app"

# 4. Event Data Extraction
def extract_event_data(args):
    # Parse command line args
    # Extract relevant fields
    return event_data

# 5. HTTP POST
def send_event(event_data):
    # POST to server
    # Handle errors

# 6. Main
if __name__ == "__main__":
    data = extract_event_data(sys.argv)
    send_event(data)
```

### 2. Server Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Bun Server Process                    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │              HTTP Server (Bun.serve)            │    │
│  │                                                 │    │
│  │  ┌───────────────────────────────────────┐    │    │
│  │  │         Request Router                 │    │    │
│  │  │                                        │    │    │
│  │  │  POST /events                          │    │    │
│  │  │  ├──> Validate JSON                    │    │    │
│  │  │  ├──> Insert to DB                     │    │    │
│  │  │  └──> Broadcast via WebSocket          │    │    │
│  │  │                                        │    │    │
│  │  │  GET /events/recent                    │    │    │
│  │  │  ├──> Query DB with filters            │    │    │
│  │  │  └──> Return JSON array                │    │    │
│  │  │                                        │    │    │
│  │  │  GET /events/filter-options            │    │    │
│  │  │  ├──> Query distinct values            │    │    │
│  │  │  └──> Return options                   │    │    │
│  │  │                                        │    │    │
│  │  │  WS /stream (Upgrade to WebSocket)     │    │    │
│  │  │  ├──> Add client to subscribers        │    │    │
│  │  │  └──> Broadcast new events             │    │    │
│  │  │                                        │    │    │
│  │  │  Theme API (/api/themes/*)             │    │    │
│  │  │  └──> CRUD operations                  │    │    │
│  │  └───────────────────────────────────────┘    │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │          Database Module (db.ts)                │    │
│  │                                                 │    │
│  │  ┌──────────────────────────────────────┐     │    │
│  │  │      SQLite Connection (WAL)         │     │    │
│  │  └──────────────────────────────────────┘     │    │
│  │                                                 │    │
│  │  Functions:                                     │    │
│  │  ├── insertEvent(event)                        │    │
│  │  ├── getRecentEvents(limit, offset, filters)   │    │
│  │  ├── getFilterOptions()                        │    │
│  │  ├── createTheme(theme)                        │    │
│  │  ├── updateTheme(id, theme)                    │    │
│  │  ├── deleteTheme(id)                           │    │
│  │  └── searchThemes(query)                       │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │        WebSocket Manager                        │    │
│  │                                                 │    │
│  │  clients: Set<WebSocket>                        │    │
│  │                                                 │    │
│  │  broadcast(event):                              │    │
│  │    for each client in clients:                  │    │
│  │      client.send(JSON.stringify(event))         │    │
│  └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

**Key Files:**

- **`src/index.ts`**: Main server entry point
  - HTTP request handling
  - WebSocket upgrade handling
  - CORS configuration
  - Error handling

- **`src/db.ts`**: Database abstraction layer
  - Connection management
  - CRUD operations
  - Migrations
  - Query builders

- **`src/types.ts`**: TypeScript interfaces
  - Type safety
  - Interface definitions
  - Shared types between server and client

### 3. Client Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Vue 3 Application                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              App.vue (Root Component)               │    │
│  │                                                     │    │
│  │  State:                                             │    │
│  │  ├── events: Event[]                                │    │
│  │  ├── filteredEvents: Event[]                        │    │
│  │  ├── filters: FilterOptions                         │    │
│  │  ├── isConnected: boolean                           │    │
│  │  └── currentTheme: Theme                            │    │
│  │                                                     │    │
│  │  Lifecycle:                                         │    │
│  │  ├── onMounted()                                    │    │
│  │  │   ├──> connectWebSocket()                        │    │
│  │  │   └──> fetchRecentEvents()                       │    │
│  │  │                                                   │    │
│  │  └── onUnmounted()                                  │    │
│  │      └──> disconnectWebSocket()                     │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Composables (Business Logic)           │    │
│  │                                                     │    │
│  │  useWebSocket.ts                                    │    │
│  │  ├── connect()                                      │    │
│  │  ├── disconnect()                                   │    │
│  │  ├── on('message', handler)                         │    │
│  │  └── reconnect logic                                │    │
│  │                                                     │    │
│  │  useEventColors.ts                                  │    │
│  │  ├── getAppColor(source_app): string                │    │
│  │  ├── getSessionColor(session_id): string            │    │
│  │  └── colorCache: Map<string, string>                │    │
│  │                                                     │    │
│  │  useChartData.ts                                    │    │
│  │  ├── aggregateByTimeWindow(events, windowMs)        │    │
│  │  ├── getEventsBySession(events)                     │    │
│  │  └── chartData: ComputedRef<ChartData>              │    │
│  │                                                     │    │
│  │  useEventEmojis.ts                                  │    │
│  │  └── getEmojiForEventType(type): string             │    │
│  │                                                     │    │
│  │  useThemes.ts                                       │    │
│  │  ├── loadThemes()                                   │    │
│  │  ├── createTheme(theme)                             │    │
│  │  ├── applyTheme(theme)                              │    │
│  │  └── shareTheme(themeId)                            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │               UI Components                         │    │
│  │                                                     │    │
│  │  EventTimeline.vue                                  │    │
│  │  ├── Displays event list                            │    │
│  │  ├── Auto-scroll to bottom                          │    │
│  │  └── Virtual scrolling for performance              │    │
│  │                                                     │    │
│  │  EventRow.vue                                       │    │
│  │  ├── Dual-color border system                       │    │
│  │  ├── Event emoji                                    │    │
│  │  ├── Timestamp                                      │    │
│  │  ├── Event details                                  │    │
│  │  └── "View Chat" button (if transcript available)   │    │
│  │                                                     │    │
│  │  FilterPanel.vue                                    │    │
│  │  ├── Multi-select for source_app                    │    │
│  │  ├── Multi-select for session_id                    │    │
│  │  ├── Multi-select for event_type                    │    │
│  │  └── "Select All" / "Clear All" buttons             │    │
│  │                                                     │    │
│  │  LivePulseChart.vue                                 │    │
│  │  ├── Canvas-based rendering                         │    │
│  │  ├── Time window selection                          │    │
│  │  ├── Session-colored bars                           │    │
│  │  ├── Event type emojis                              │    │
│  │  └── Smooth animations                              │    │
│  │                                                     │    │
│  │  ChatTranscriptModal.vue                            │    │
│  │  ├── Modal overlay                                  │    │
│  │  ├── Syntax highlighted conversation                │    │
│  │  └── Close button                                   │    │
│  │                                                     │    │
│  │  TokenMetricsDashboard.vue                          │    │
│  │  ├── Displays token usage and cost metrics          │    │
│  │  ├── Total tokens and costs across all sessions     │    │
│  │  ├── Per-session breakdown with model names         │    │
│  │  ├── Refresh button for manual updates              │    │
│  │  └── Model-specific pricing display                 │    │
│  │                                                     │    │
│  │  ToolAnalyticsDashboard.vue                         │    │
│  │  ├── Tool success/failure analytics                 │    │
│  │  ├── Overall success rate statistics                │    │
│  │  ├── Per-tool reliability metrics                   │    │
│  │  ├── Error type classification                      │    │
│  │  ├── Color-coded success rate indicators            │    │
│  │  └── Top errors summary with counts                 │    │
│  │                                                     │    │
│  │  BookmarkButton.vue                                 │    │
│  │  ├── Star icon for bookmarking sessions             │    │
│  │  ├── Toggle bookmark state (☆ / ★)                  │    │
│  │  ├── Loading state during API calls                 │    │
│  │  └── Auto-checks bookmark status on mount           │    │
│  │                                                     │    │
│  │  TagEditor.vue                                      │    │
│  │  ├── Tag list with remove buttons                   │    │
│  │  ├── Add tag input with validation                  │    │
│  │  ├── Color-coded tag display                        │    │
│  │  ├── Error handling and feedback                    │    │
│  │  └── Auto-loads tags on component mount             │    │
│  │                                                     │    │
│  │  BookmarksView.vue                                  │    │
│  │  ├── List of all bookmarked sessions                │    │
│  │  ├── Session ID and source app display              │    │
│  │  ├── Bookmark timestamps and notes                  │    │
│  │  ├── Remove bookmark functionality                  │    │
│  │  └── Refresh button for manual updates              │    │
│  │                                                     │    │
│  │  PerformanceMetricsDashboard.vue                    │    │
│  │  ├── Agent performance metrics display              │    │
│  │  ├── Summary cards (avg response time, success      │    │
│  │  │   rate, tools per task, sessions analyzed)       │    │
│  │  ├── Per-session performance breakdown              │    │
│  │  ├── Response time, tools/task, success rate,       │    │
│  │  │   and duration metrics                           │    │
│  │  ├── Color-coded success rate indicators            │    │
│  │  └── Trend analysis across sessions                 │    │
│  │                                                     │    │
│  │  PatternInsights.vue                                │    │
│  │  ├── Detected pattern visualization                 │    │
│  │  ├── Summary cards (total patterns, occurrences,    │    │
│  │  │   most common pattern)                           │    │
│  │  ├── Pattern type filtering (all, workflow,         │    │
│  │  │   retry, sequence)                               │    │
│  │  ├── Pattern details with confidence scores         │    │
│  │  ├── Example sequence display (visual tool flow)    │    │
│  │  └── Pattern occurrence counts and timestamps       │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Event Creation Flow

```
┌──────────────────────────────────────────────────────────┐
│  1. User Action or Agent Action                          │
│     - User submits prompt                                │
│     - Agent uses a tool                                  │
│     - Agent sends notification                           │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  2. Claude Code Triggers Hook                            │
│     - Reads .claude/settings.json                        │
│     - Finds matching hook command                        │
│     - Executes hook script                               │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────┐
│  3. Hook Script Execution                                │
│     ┌────────────────────────────────────────────────┐  │
│     │  pre_tool_use.py / post_tool_use.py / etc.    │  │
│     │                                                │  │
│     │  a) Parse command line arguments              │  │
│     │  b) Extract context from JSON                 │  │
│     │  c) Perform validation (if pre-hook)          │  │
│     │  d) Call send_event.py                        │  │
│     └────────────────┬───────────────────────────────┘  │
│                      │                                   │
│                      ▼                                   │
│     ┌────────────────────────────────────────────────┐  │
│     │  send_event.py                                 │  │
│     │                                                │  │
│     │  a) Build event payload:                      │  │
│     │     {                                          │  │
│     │       source_app: "my-app",                   │  │
│     │       session_id: "uuid-here",                │  │
│     │       hook_event_type: "PreToolUse",          │  │
│     │       timestamp: "ISO-8601",                  │  │
│     │       payload: { ... },                       │  │
│     │       chat_transcript: [...] (optional)       │  │
│     │     }                                          │  │
│     │                                                │  │
│     │  b) Extract model name from transcript        │  │
│     │  c) Generate AI summary (if --summarize)      │  │
│     │  d) POST to http://localhost:4000/events      │  │
│     └────────────────┬───────────────────────────────┘  │
└──────────────────────┼──────────────────────────────────┘
                       │
                       │ HTTP POST
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  4. Server Receives Event                                │
│                                                          │
│  index.ts: POST /events handler                          │
│  ┌────────────────────────────────────────────────┐    │
│  │  a) Parse JSON body                             │    │
│  │  b) Validate required fields:                   │    │
│  │     - source_app                                │    │
│  │     - session_id                                │    │
│  │     - hook_event_type                           │    │
│  │     - timestamp                                 │    │
│  │                                                 │    │
│  │  c) Generate unique event ID                    │    │
│  │  d) Call db.insertEvent(event)                  │    │
│  │  e) Broadcast to WebSocket clients              │    │
│  │  f) Return 201 Created                          │    │
│  └────────────────────────────────────────────────┘    │
└────────────────┬─────────────────────────────────────────┘
                 │
                 ├──> SQLite Database
                 │    INSERT INTO events (...)
                 │
                 └──> WebSocket Broadcast
                      │
                      ▼
┌──────────────────────────────────────────────────────────┐
│  5. Client Receives Event                                │
│                                                          │
│  App.vue: WebSocket 'message' handler                    │
│  ┌────────────────────────────────────────────────┐    │
│  │  a) Parse JSON message                          │    │
│  │  b) Add to events array                         │    │
│  │  c) Trigger reactive update                     │    │
│  │  d) Re-compute filtered events                  │    │
│  │  e) Update chart data                           │    │
│  │  f) Scroll to bottom (if auto-scroll enabled)   │    │
│  └────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────┐
│  6. UI Update                                            │
│     - New event appears in timeline                      │
│     - Chart updates with new data point                  │
│     - Filter options refresh                             │
└──────────────────────────────────────────────────────────┘
```

### Filter Application Flow

```
User Selects Filter
       │
       ▼
Filter Panel Component
  └──> Updates filter state
       │
       ▼
App.vue Reactive System
  └──> Computes filteredEvents
       │
       │  filteredEvents = events.filter(event => {
       │    return (
       │      selectedApps.includes(event.source_app) &&
       │      selectedSessions.includes(event.session_id) &&
       │      selectedTypes.includes(event.hook_event_type)
       │    )
       │  })
       │
       ▼
Event Timeline Component
  └──> Re-renders with filtered events
       │
       ▼
Live Pulse Chart Component
  └──> Updates chart with filtered data
```

---

## Database Schema

### Events Table

```sql
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  hook_event_type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  payload TEXT,
  chat_transcript TEXT,
  model_name TEXT,
  summary TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_source_app ON events(source_app);
CREATE INDEX IF NOT EXISTS idx_session_id ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_hook_event_type ON events(hook_event_type);
CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_created_at ON events(created_at);
```

**Field Descriptions:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | INTEGER | Auto-incrementing primary key | `1234` |
| `source_app` | TEXT | Application identifier | `"my-project"` |
| `session_id` | TEXT | Unique session UUID | `"a1b2c3d4-..."` |
| `hook_event_type` | TEXT | Type of event | `"PreToolUse"` |
| `timestamp` | TEXT | ISO-8601 timestamp | `"2025-01-14T10:30:00.000Z"` |
| `payload` | TEXT | JSON event data | `'{"tool_name":"Bash"}'` |
| `chat_transcript` | TEXT | JSON chat history | `'[{"role":"user",...}]'` |
| `model_name` | TEXT | AI model used | `"claude-sonnet-4-5"` |
| `summary` | TEXT | AI-generated summary | `"Agent reads package.json"` |
| `created_at` | TEXT | Server receipt time | `"2025-01-14T10:30:00.123Z"` |

### Themes Table

```sql
CREATE TABLE IF NOT EXISTS themes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  colors TEXT NOT NULL,
  is_public INTEGER DEFAULT 0,
  creator TEXT,
  downloads INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  share_token TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_public_themes ON themes(is_public);
CREATE INDEX IF NOT EXISTS idx_share_token ON themes(share_token);
```

### Session Metrics Table

**Purpose**: Track token usage and API costs per session

```sql
CREATE TABLE IF NOT EXISTS session_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0.0,
  message_count INTEGER DEFAULT 0,
  start_time INTEGER,
  end_time INTEGER,
  model_name TEXT,
  UNIQUE(source_app, session_id)
);

CREATE INDEX IF NOT EXISTS idx_session_metrics ON session_metrics(source_app, session_id);
CREATE INDEX IF NOT EXISTS idx_session_metrics_session ON session_metrics(session_id);
```

**Field Descriptions:**

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `total_tokens` | INTEGER | Total tokens used in session | `15234` |
| `total_cost` | REAL | Estimated API cost (USD) | `0.0457` |
| `message_count` | INTEGER | Number of messages | `12` |
| `start_time` | INTEGER | Unix timestamp (ms) | `1705240800000` |
| `end_time` | INTEGER | Unix timestamp (ms) | `1705244400000` |

### Tool Analytics Table

**Purpose**: Track tool success/failure rates and error patterns

```sql
CREATE TABLE IF NOT EXISTS tool_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  success INTEGER NOT NULL,
  error_type TEXT,
  error_message TEXT,
  timestamp INTEGER NOT NULL,
  event_id INTEGER,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS idx_tool_analytics ON tool_analytics(tool_name, success);
CREATE INDEX IF NOT EXISTS idx_tool_errors ON tool_analytics(error_type) WHERE success = 0;
CREATE INDEX IF NOT EXISTS idx_tool_session ON tool_analytics(session_id);
```

**Error Types:**
- `permission_error`, `not_found_error`, `timeout_error`, `syntax_error`
- `network_error`, `command_not_found`, `memory_error`, `disk_error`
- `invalid_argument`, `unknown_error`

### Session Bookmarks Table

**Purpose**: Store bookmarked sessions for quick access

```sql
CREATE TABLE IF NOT EXISTS session_bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  bookmarked INTEGER NOT NULL DEFAULT 1,
  bookmarked_at INTEGER,
  notes TEXT,
  UNIQUE(source_app, session_id)
);

CREATE INDEX IF NOT EXISTS idx_session_bookmarks ON session_bookmarks(source_app, session_id);
CREATE INDEX IF NOT EXISTS idx_bookmarked ON session_bookmarks(bookmarked) WHERE bookmarked = 1;
```

### Session Tags Table

**Purpose**: Categorize sessions with custom tags

```sql
CREATE TABLE IF NOT EXISTS session_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(source_app, session_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_session_tags ON session_tags(source_app, session_id);
CREATE INDEX IF NOT EXISTS idx_tags ON session_tags(tag);
```

### Performance Metrics Table

**Purpose**: Store calculated performance metrics for sessions

```sql
CREATE TABLE IF NOT EXISTS performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  avg_response_time REAL,
  tools_per_task REAL,
  success_rate REAL,
  session_duration INTEGER,
  total_events INTEGER NOT NULL,
  total_tool_uses INTEGER NOT NULL,
  calculated_at INTEGER NOT NULL,
  UNIQUE(source_app, session_id)
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics ON performance_metrics(source_app, session_id);
CREATE INDEX IF NOT EXISTS idx_success_rate ON performance_metrics(success_rate);
```

**Calculated Metrics:**
- `avg_response_time`: Average milliseconds between events
- `tools_per_task`: Tools used per event (efficiency metric)
- `success_rate`: Percentage of successful tool uses
- `session_duration`: Total time from start to end (ms)

### Detected Patterns Table

**Purpose**: Store automatically detected agent behavior patterns

```sql
CREATE TABLE IF NOT EXISTS detected_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  pattern_type TEXT NOT NULL,
  pattern_name TEXT NOT NULL,
  description TEXT NOT NULL,
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  example_sequence TEXT,
  confidence_score REAL,
  UNIQUE(source_app, session_id, pattern_type, pattern_name)
);

CREATE INDEX IF NOT EXISTS idx_detected_patterns ON detected_patterns(source_app, session_id);
CREATE INDEX IF NOT EXISTS idx_pattern_type ON detected_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_pattern_name ON detected_patterns(pattern_name);
```

**Pattern Types:**
- `workflow`: Common sequences (read-before-edit, search-then-read)
- `retry`: Tool retry patterns (same tool 3+ times)
- `sequence`: Multi-step operation patterns

---

## Communication Protocols

### HTTP REST API

#### POST /events
**Purpose**: Receive new events from agents

**Request:**
```http
POST /events HTTP/1.1
Host: localhost:4000
Content-Type: application/json

{
  "source_app": "my-project",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "hook_event_type": "PreToolUse",
  "timestamp": "2025-01-14T10:30:00.000Z",
  "payload": {
    "tool_name": "Bash",
    "tool_input": {
      "command": "ls -la"
    }
  },
  "chat_transcript": [...],  // optional
  "model_name": "claude-sonnet-4-5",  // optional
  "summary": "Agent lists directory contents"  // optional
}
```

**Response:**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "id": 1234
}
```

#### GET /events/recent
**Purpose**: Retrieve recent events with optional filtering

**Request:**
```http
GET /events/recent?limit=100&offset=0&source_app=my-project&session_id=a1b2c3d4 HTTP/1.1
Host: localhost:4000
```

**Query Parameters:**
- `limit`: Number of events to return (default: 300)
- `offset`: Number of events to skip (default: 0)
- `source_app`: Filter by application (optional)
- `session_id`: Filter by session (optional)
- `hook_event_type`: Filter by event type (optional)

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "id": 1234,
    "source_app": "my-project",
    "session_id": "a1b2c3d4-...",
    "hook_event_type": "PreToolUse",
    "timestamp": "2025-01-14T10:30:00.000Z",
    "payload": {...},
    "chat_transcript": [...],
    "model_name": "claude-sonnet-4-5",
    "summary": "Agent lists directory contents",
    "created_at": "2025-01-14T10:30:00.123Z"
  },
  ...
]
```

### WebSocket Protocol

#### Connection
```javascript
const ws = new WebSocket('ws://localhost:4000/stream');

ws.onopen = () => {
  console.log('Connected to event stream');
};

ws.onmessage = (event) => {
  const newEvent = JSON.parse(event.data);
  // Handle new event
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from event stream');
  // Implement reconnection logic
};
```

#### Message Format
Server broadcasts new events immediately:
```json
{
  "id": 1234,
  "source_app": "my-project",
  "session_id": "a1b2c3d4-...",
  "hook_event_type": "PostToolUse",
  "timestamp": "2025-01-14T10:30:05.000Z",
  "payload": {
    "tool_name": "Bash",
    "tool_result": "..."
  },
  "created_at": "2025-01-14T10:30:05.123Z"
}
```

---

## Agent Identification

### Unique Identification System

**Every agent is uniquely identified by the combination of:**

1. **`source_app`**: Application/project name
2. **`session_id`**: UUID generated by Claude Code

**Display Format:**
```
{source_app}:{session_id_first_8_chars}
```

**Example:**
```
Input:
  source_app = "my-api-server"
  session_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"

Display:
  "my-api-server:a1b2c3d4"
```

### Color Assignment

**App Color** (Left border):
```javascript
function getAppColor(source_app: string): string {
  const hash = hashString(source_app);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}
```

**Session Color** (Second border):
```javascript
function getSessionColor(session_id: string): string {
  const hash = hashString(session_id);
  const hue = hash % 360;
  return `hsl(${hue}, 80%, 60%)`;
}
```

This creates a **unique visual signature** for each agent based on deterministic hashing.

---

## Event Processing Pipeline

```
Event Arrival
     │
     ├──> Validation
     │    ├── Check required fields
     │    ├── Validate JSON structure
     │    └── Sanitize inputs
     │
     ├──> Enrichment
     │    ├── Generate ID
     │    ├── Add server timestamp
     │    └── Extract metadata
     │
     ├──> Persistence
     │    ├── Begin transaction
     │    ├── INSERT INTO events
     │    └── Commit transaction
     │
     ├──> Broadcasting
     │    ├── Serialize to JSON
     │    └── Send to all WebSocket clients
     │
     └──> Response
          └── Return 201 Created
```

---

## Real-Time Synchronization

### Connection Management

**Client connects:**
1. Client initiates WebSocket connection
2. Server adds client to subscribers set
3. Server sends connection confirmation

**Client disconnects:**
1. Client closes connection (intentional or network issue)
2. Server removes client from subscribers set
3. Client attempts reconnection (exponential backoff)

**Event broadcast:**
```typescript
const clients = new Set<WebSocket>();

function broadcast(event: Event) {
  const message = JSON.stringify(event);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Failed to send to client:', error);
        clients.delete(client);
      }
    }
  }
}
```

### Reconnection Strategy

```javascript
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const baseDelay = 1000; // 1 second

function reconnect() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.error('Max reconnection attempts reached');
    return;
  }

  const delay = baseDelay * Math.pow(2, reconnectAttempts);
  reconnectAttempts++;

  setTimeout(() => {
    console.log(`Reconnecting... (attempt ${reconnectAttempts})`);
    connectWebSocket();
  }, delay);
}
```

---

## State Management

### Client-Side State

**Vue Reactive State:**
```typescript
const state = reactive({
  // Event storage
  events: [] as Event[],

  // Filter state
  selectedApps: [] as string[],
  selectedSessions: [] as string[],
  selectedEventTypes: [] as string[],

  // Connection state
  isConnected: false,
  reconnecting: false,

  // UI state
  autoScroll: true,
  showFilters: true,
  currentTheme: 'dark' as 'dark' | 'light',

  // Chart state
  chartTimeWindow: 60000 as number, // 1 minute
});

// Computed properties
const filteredEvents = computed(() => {
  return state.events.filter(event => {
    const appMatch = state.selectedApps.length === 0 ||
                     state.selectedApps.includes(event.source_app);
    const sessionMatch = state.selectedSessions.length === 0 ||
                         state.selectedSessions.includes(event.session_id);
    const typeMatch = state.selectedEventTypes.length === 0 ||
                      state.selectedEventTypes.includes(event.hook_event_type);

    return appMatch && sessionMatch && typeMatch;
  });
});
```

### Server-Side State

**Minimal State (Stateless Design):**
```typescript
// Only maintain WebSocket connections
const clients = new Set<WebSocket>();

// No session storage
// No event caching
// All state in database
```

**Benefits:**
- Horizontal scalability
- No state synchronization issues
- Easy restarts without state loss
- Simple deployment

---

## Security Architecture

### Input Validation

**Hook Scripts:**
```python
DANGEROUS_COMMANDS = [
    'rm -rf /',
    'mkfs',
    'dd if=/dev/zero',
    ':(){ :|:& };:',  # Fork bomb
    'chmod -R 777 /',
]

SENSITIVE_FILES = [
    '.env',
    'private_key',
    'id_rsa',
    'secrets.json',
]

def is_dangerous(command: str) -> bool:
    for dangerous in DANGEROUS_COMMANDS:
        if dangerous in command:
            return True
    return False

def contains_sensitive_file(command: str) -> bool:
    for sensitive in SENSITIVE_FILES:
        if sensitive in command:
            return True
    return False
```

**Server Validation:**
```typescript
function validateEvent(event: any): boolean {
  // Required fields
  if (!event.source_app || !event.session_id ||
      !event.hook_event_type || !event.timestamp) {
    return false;
  }

  // Field types
  if (typeof event.source_app !== 'string' ||
      typeof event.session_id !== 'string') {
    return false;
  }

  // Timestamp validation
  const timestamp = new Date(event.timestamp);
  if (isNaN(timestamp.getTime())) {
    return false;
  }

  return true;
}
```

### CORS Configuration

```typescript
const server = Bun.serve({
  port: 4000,
  fetch(req) {
    // CORS headers
    const headers = new Headers({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    // ... handle request
  },
});
```

### SQL Injection Prevention

**Using parameterized queries:**
```typescript
// ❌ BAD - Vulnerable to SQL injection
const query = `SELECT * FROM events WHERE source_app = '${userInput}'`;

// ✅ GOOD - Safe parameterized query
const query = db.prepare(
  'SELECT * FROM events WHERE source_app = ?'
);
const results = query.all(userInput);
```

---

## Performance Considerations

### Database Optimization

1. **WAL Mode**: Write-Ahead Logging for concurrent reads
2. **Indexes**: On frequently queried columns
3. **Connection Pooling**: Single connection, proper transaction management
4. **Query Limits**: Default limit of 300 events

### Client Optimization

1. **Virtual Scrolling**: Only render visible events
2. **Event Limiting**: Max events configurable (default: 100)
3. **Debounced Filtering**: Prevent excessive re-renders
4. **Canvas Rendering**: For charts (faster than DOM)
5. **Lazy Loading**: Load chat transcripts on demand

### Network Optimization

1. **WebSocket**: Persistent connection, no polling
2. **JSON Compression**: Minimal payload size
3. **Selective Filtering**: Client-side reduces server load
4. **Batch Updates**: Aggregate multiple events if needed

---

This architecture provides a robust, scalable, and real-time observability system for Claude Code agents with comprehensive event tracking and visualization capabilities.
