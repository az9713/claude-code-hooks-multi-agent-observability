# Code Walkthrough: Line-by-Line Explanation

## Table of Contents
- [Hook Scripts](#hook-scripts)
  - [send_event.py](#send_eventpy)
  - [pre_tool_use.py](#pre_tool_usepy)
- [Server Code](#server-code)
  - [index.ts](#indexts)
  - [db.ts](#dbts)
- [Client Code](#client-code)
  - [App.vue](#appvue)
  - [EventTimeline.vue](#eventtimelinevue)
  - [useWebSocket.ts](#usewebsocketcomposable)
- [Utilities](#utilities)

---

## Hook Scripts

### send_event.py

This is the **universal event sender** used by all hooks to transmit events to the observability server.

**File**: `.claude/hooks/send_event.py`

#### Shebang and Script Metadata (Lines 1-8)

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "anthropic",
#     "python-dotenv",
# ]
# ///
```

**Explanation:**
- **Line 1**: Shebang tells the system to execute this script using `uv run --script`
  - `uv` is Astral's fast Python package manager
  - `--script` mode reads inline metadata and installs dependencies automatically
- **Lines 2-8**: Inline script metadata (PEP 723)
  - Specifies Python version requirement (3.8+)
  - Lists dependencies that `uv` will install:
    - `anthropic`: For AI summarization
    - `python-dotenv`: For loading environment variables

**Why this matters**: This makes the script self-contained. No need to manually install dependencies or manage virtual environments. `uv` handles everything automatically.

#### Imports (Lines 15-23)

```python
import json
import sys
import os
import argparse
import urllib.request
import urllib.error
from datetime import datetime
from utils.summarizer import generate_event_summary
from utils.model_extractor import get_model_from_transcript
```

**Explanation:**
- **json**: Parse and serialize JSON data
- **sys**: Access command-line arguments and exit codes
- **os**: File system operations
- **argparse**: Parse command-line arguments
- **urllib.request/error**: HTTP requests (no external dependencies)
- **datetime**: Generate timestamps
- **utils.summarizer**: AI-powered event summarization
- **utils.model_extractor**: Extract model name from transcripts

#### send_event_to_server Function (Lines 25-51)

```python
def send_event_to_server(event_data, server_url='http://localhost:4000/events'):
    """Send event data to the observability server."""
    try:
        # Prepare the request
        req = urllib.request.Request(
            server_url,
            data=json.dumps(event_data).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'User-Agent': 'Claude-Code-Hook/1.0'
            }
        )
```

**Explanation:**
- **Function purpose**: POST event data to the server via HTTP
- **Parameters**:
  - `event_data`: Dictionary containing event information
  - `server_url`: Target server URL (default: localhost:4000)
- **Request preparation**:
  - Serialize `event_data` to JSON string
  - Encode as UTF-8 bytes
  - Set headers:
    - `Content-Type: application/json`: Tell server we're sending JSON
    - `User-Agent`: Identify the client

```python
        # Send the request
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                return True
            else:
                print(f"Server returned status: {response.status}", file=sys.stderr)
                return False
```

**Explanation:**
- **urlopen**: Send HTTP request
- **timeout=5**: Fail if no response in 5 seconds (prevents hanging)
- **with statement**: Automatically close connection
- **Success check**: 200 status code means success
- **Error reporting**: Print to stderr (not stdout) so it doesn't interfere with Claude's output

```python
    except urllib.error.URLError as e:
        print(f"Failed to send event: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        return False
```

**Explanation:**
- **URLError**: Network errors (connection refused, timeout, etc.)
- **Generic Exception**: Catch any other errors
- **Always return False**: Indicate failure but don't crash
- **stderr output**: Log errors without breaking the hook

**Design principle**: Hooks should **never** block Claude Code execution, even if the server is down.

#### main Function (Lines 53-120)

```python
def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Send Claude Code hook events to observability server')
    parser.add_argument('--source-app', required=True, help='Source application name')
    parser.add_argument('--event-type', required=True, help='Hook event type (PreToolUse, PostToolUse, etc.)')
    parser.add_argument('--server-url', default='http://localhost:4000/events', help='Server URL')
    parser.add_argument('--add-chat', action='store_true', help='Include chat transcript if available')
    parser.add_argument('--summarize', action='store_true', help='Generate AI summary of the event')

    args = parser.parse_args()
```

**Explanation:**
- **ArgumentParser**: Parse command-line flags
- **--source-app** (required): Identifies which application sent this event
  - Example: `--source-app my-project`
- **--event-type** (required): Type of hook event
  - Example: `--event-type PreToolUse`
- **--server-url** (optional): Override default server URL
- **--add-chat** (flag): Include full conversation history
- **--summarize** (flag): Generate AI summary using Claude

**How it's called** (from `.claude/settings.json`):
```json
{
  "command": "uv run .claude/hooks/send_event.py --source-app my-app --event-type PreToolUse --summarize"
}
```

```python
    try:
        # Read hook data from stdin
        input_data = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON input: {e}", file=sys.stderr)
        sys.exit(1)
```

**Explanation:**
- **stdin**: Claude Code passes hook data via standard input
- **json.load**: Parse JSON from stdin
- **Error handling**: If JSON is invalid, log error and exit with code 1

**Why stdin?** Claude Code sends hook data this way by design. The hook receives structured JSON data about the event.

```python
    # Extract model name from transcript (with caching)
    session_id = input_data.get('session_id', 'unknown')
    transcript_path = input_data.get('transcript_path', '')
    model_name = ''
    if transcript_path:
        model_name = get_model_from_transcript(session_id, transcript_path)
```

**Explanation:**
- **session_id**: Unique identifier for this Claude Code session
- **transcript_path**: Path to the `.jsonl` file containing conversation history
- **model_name extraction**: Read the transcript to find which model is being used
  - Uses caching to avoid reading the file multiple times
  - Example model names: `claude-sonnet-4-5`, `claude-opus-4`

**Why extract model name?** Useful for:
- Comparing behavior between different models
- Filtering events by model
- Analytics on model usage

```python
    # Prepare event data for server
    event_data = {
        'source_app': args.source_app,
        'session_id': session_id,
        'hook_event_type': args.event_type,
        'payload': input_data,
        'timestamp': int(datetime.now().timestamp() * 1000),
        'model_name': model_name
    }
```

**Explanation:**
- **source_app**: Application identifier (from command-line arg)
- **session_id**: Session UUID (from stdin data)
- **hook_event_type**: Event type (from command-line arg)
- **payload**: Complete hook data (from stdin)
- **timestamp**: Current time in milliseconds since epoch
  - `datetime.now().timestamp()` gives seconds as float
  - Multiply by 1000 and convert to int for milliseconds
- **model_name**: Extracted model identifier

**Event structure example**:
```json
{
  "source_app": "my-project",
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "hook_event_type": "PreToolUse",
  "payload": {
    "tool_name": "Bash",
    "tool_input": {"command": "ls -la"}
  },
  "timestamp": 1705240800000,
  "model_name": "claude-sonnet-4-5"
}
```

```python
    # Handle --add-chat option
    if args.add_chat and 'transcript_path' in input_data:
        transcript_path = input_data['transcript_path']
        if os.path.exists(transcript_path):
            # Read .jsonl file and convert to JSON array
            chat_data = []
            try:
                with open(transcript_path, 'r') as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            try:
                                chat_data.append(json.loads(line))
                            except json.JSONDecodeError:
                                pass  # Skip invalid lines

                # Add chat to event data
                event_data['chat'] = chat_data
            except Exception as e:
                print(f"Failed to read transcript: {e}", file=sys.stderr)
```

**Explanation:**
- **Conditional**: Only add chat if `--add-chat` flag is set AND transcript exists
- **JSONL format**: Transcript is JSON Lines format (one JSON object per line)
- **Reading process**:
  1. Open transcript file
  2. Read each line
  3. Parse each line as JSON
  4. Append to chat_data array
  5. Skip invalid lines (defensive programming)
- **Add to event**: Attach complete conversation history to event

**Chat transcript structure**:
```json
{
  "chat": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "content": "Hi! How can I help?"},
    ...
  ]
}
```

**Use cases**:
- Debugging: See full context that led to an action
- Learning: Understand agent reasoning
- Auditing: Complete conversation record

```python
    # Generate summary if requested
    if args.summarize:
        summary = generate_event_summary(event_data)
        if summary:
            event_data['summary'] = summary
        # Continue even if summary generation fails
```

**Explanation:**
- **Conditional**: Only summarize if `--summarize` flag is set
- **generate_event_summary**: Uses Claude API to create human-readable summary
  - Analyzes event type, tool used, and context
  - Generates concise description (e.g., "Agent reads package.json file")
- **Graceful degradation**: If summarization fails, continue without summary
  - Summarization requires API call (can fail)
  - Don't block event transmission

**Example summaries**:
- PreToolUse + Bash: "Running bash command to list directory contents"
- PostToolUse + Read: "Successfully read configuration file"
- Notification: "Agent requesting user confirmation"

```python
    # Send to server
    success = send_event_to_server(event_data, args.server_url)

    # Always exit with 0 to not block Claude Code operations
    sys.exit(0)
```

**Explanation:**
- **send_event_to_server**: POST event data to server
- **sys.exit(0)**: **ALWAYS** exit successfully (code 0)
  - Even if sending failed
  - Critical: Non-zero exit code would block Claude Code
  - Observability shouldn't interfere with agent operation

**Design principle**: The observability system is **non-intrusive**. If it fails, Claude Code continues normally.

---

### pre_tool_use.py

This hook runs **before** Claude uses a tool. It implements safety controls.

**File**: `.claude/hooks/pre_tool_use.py`

#### Key Sections

```python
# Dangerous command patterns
DANGEROUS_COMMANDS = [
    'rm -rf /',
    'rm -rf ~',
    'mkfs',
    'dd if=/dev/zero',
    ':(){ :|:& };:',  # Fork bomb
    'chmod -R 777 /',
    'chown -R',
]

# Sensitive file patterns
SENSITIVE_FILES = [
    '.env',
    'private_key',
    'id_rsa',
    'id_dsa',
    'id_ecdsa',
    'credentials.json',
    'secrets.json',
]
```

**Explanation:**
- **DANGEROUS_COMMANDS**: Patterns that could cause system damage
  - `rm -rf /`: Delete entire filesystem
  - `mkfs`: Format disk
  - `dd if=/dev/zero`: Overwrite disk with zeros
  - `:(){ :|:& };:`: Fork bomb (crash system)
- **SENSITIVE_FILES**: Files containing secrets
  - API keys, SSH keys, credentials

```python
def is_dangerous_command(command: str) -> bool:
    """Check if command contains dangerous patterns."""
    command_lower = command.lower()

    for pattern in DANGEROUS_COMMANDS:
        if pattern.lower() in command_lower:
            return True

    # Check for suspicious file operations
    for sensitive_file in SENSITIVE_FILES:
        if sensitive_file in command_lower and any(op in command_lower for op in ['cat', 'less', 'more', 'head', 'tail']):
            return True

    return False
```

**Explanation:**
- **Case-insensitive matching**: Convert to lowercase for comparison
- **Pattern matching**: Check if any dangerous pattern appears in command
- **File operation check**: Block reading of sensitive files
  - Only block if both: sensitive filename AND reading command
  - Example: `cat .env` is blocked, but `.env` in other context is okay

```python
def main():
    try:
        input_data = json.load(sys.stdin)

        # Extract tool information
        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})

        # Check Bash commands
        if tool_name == 'Bash':
            command = tool_input.get('command', '')

            if is_dangerous_command(command):
                print(f"⛔ BLOCKED: Dangerous command detected: {command}", file=sys.stderr)
                print("This command has been blocked for safety reasons.", file=sys.stderr)
                sys.exit(1)  # Non-zero exit blocks the tool use

        # If safe, exit successfully
        sys.exit(0)

    except Exception as e:
        print(f"Error in pre_tool_use hook: {e}", file=sys.stderr)
        sys.exit(0)  # Don't block on hook errors
```

**Explanation:**
- **Parse input**: Read tool use data from stdin
- **Extract tool info**: Get tool name and inputs
- **Bash-specific check**: Only validate Bash commands
  - Other tools (Read, Write, Edit) have their own validations
- **Blocking logic**:
  - If dangerous: Print error and exit with code 1 (blocks execution)
  - If safe: Exit with code 0 (allows execution)
- **Error handling**: If hook itself errors, don't block (exit 0)

**Flow diagram**:
```
Claude wants to run: rm -rf /tmp/data
    ↓
pre_tool_use.py executes
    ↓
Checks if "rm -rf /" in command
    ↓
Matches dangerous pattern
    ↓
Exit code 1 (BLOCK)
    ↓
Claude Code shows error to user
    ↓
Command does NOT execute
```

---

## Server Code

### index.ts

This is the **main server file** that handles HTTP requests and WebSocket connections.

**File**: `apps/server/src/index.ts`

#### Imports and Initialization (Lines 1-18)

```typescript
import { initDatabase, insertEvent, getFilterOptions, getRecentEvents, updateEventHITLResponse } from './db';
import type { HookEvent, HumanInTheLoopResponse } from './types';
import {
  createTheme,
  updateThemeById,
  getThemeById,
  searchThemes,
  deleteThemeById,
  exportThemeById,
  importTheme,
  getThemeStats
} from './theme';

// Initialize database
initDatabase();

// Store WebSocket clients
const wsClients = new Set<any>();
```

**Explanation:**
- **Database imports**: Functions for DB operations
- **Type imports**: TypeScript interfaces for type safety
- **Theme imports**: Theme management functions
- **initDatabase()**: Create tables, run migrations
- **wsClients**: Set of active WebSocket connections
  - `Set` automatically handles duplicates
  - Easy to add/remove clients

#### HITL Response Handler (Lines 21-102)

```typescript
async function sendResponseToAgent(
  wsUrl: string,
  response: HumanInTheLoopResponse
): Promise<void> {
  console.log(`[HITL] Connecting to agent WebSocket: ${wsUrl}`);

  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    let isResolved = false;
```

**Explanation:**
- **Purpose**: Send human response back to the agent via WebSocket
- **Parameters**:
  - `wsUrl`: WebSocket URL provided by the agent
  - `response`: User's response (answer, choice, approval)
- **Promise-based**: Async operation with proper cleanup
- **isResolved flag**: Prevent multiple resolutions (race condition protection)

```typescript
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (isResolved) return;
        console.log('[HITL] WebSocket connection opened, sending response...');

        try {
          ws!.send(JSON.stringify(response));
          console.log('[HITL] Response sent successfully');

          // Wait 500ms to ensure message fully transmits before closing
          setTimeout(() => {
            cleanup();
            if (!isResolved) {
              isResolved = true;
              resolve();
            }
          }, 500);
        } catch (error) {
          console.error('[HITL] Error sending message:', error);
          cleanup();
          if (!isResolved) {
            isResolved = true;
            reject(error);
          }
        }
      };
```

**Explanation:**
- **WebSocket creation**: Connect to agent's WebSocket endpoint
- **onopen handler**: Triggered when connection establishes
- **send**: Transmit response as JSON
- **setTimeout delay**: Wait 500ms before closing
  - Ensures message fully transmits
  - WebSocket buffering can delay actual send
- **Cleanup**: Close connection and resolve promise

```typescript
      // Timeout after 5 seconds
      setTimeout(() => {
        if (!isResolved) {
          console.error('[HITL] Timeout sending response to agent');
          cleanup();
          isResolved = true;
          reject(new Error('Timeout sending response to agent'));
        }
      }, 5000);
```

**Explanation:**
- **5-second timeout**: Fail if response not sent
- **Prevents hanging**: If agent is unreachable, don't wait forever
- **Cleanup**: Always clean up resources

**HITL flow**:
```
Agent asks question → Event created with WebSocket URL
    ↓
User responds in UI → POST /events/:id/respond
    ↓
Server receives response → sendResponseToAgent()
    ↓
Connect to agent's WebSocket → Send response JSON
    ↓
Agent receives response → Continues execution
```

#### Bun Server Configuration (Lines 105-447)

```typescript
const server = Bun.serve({
  port: parseInt(process.env.SERVER_PORT || '4000'),

  async fetch(req: Request) {
    const url = new URL(req.url);
```

**Explanation:**
- **Bun.serve**: Bun's built-in HTTP server
  - No Express or other framework needed
  - WebSocket support built-in
  - Very fast (written in Zig)
- **port**: Read from environment variable or default to 4000
- **fetch**: Handle HTTP requests (modern Fetch API)
- **url parsing**: Extract pathname and query parameters

#### CORS Headers (Lines 112-121)

```typescript
    // Handle CORS
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers });
    }
```

**Explanation:**
- **CORS**: Cross-Origin Resource Sharing
  - Allows client (port 5173) to call server (port 4000)
  - Required for browser security
- **Wildcard origin**: Allow requests from any origin (`*`)
  - Fine for local development
  - Production should restrict this
- **Allowed methods**: GET, POST, PUT, DELETE, OPTIONS
- **OPTIONS preflight**: Browser sends OPTIONS before actual request
  - Return headers immediately
  - No processing needed

#### POST /events Endpoint (Lines 124-160)

```typescript
    if (url.pathname === '/events' && req.method === 'POST') {
      try {
        const event: HookEvent = await req.json();

        // Validate required fields
        if (!event.source_app || !event.session_id || !event.hook_event_type || !event.payload) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }
```

**Explanation:**
- **Route matching**: Check URL path and HTTP method
- **Parse JSON**: Extract event from request body
- **Validation**: Ensure required fields present
  - `source_app`: Application identifier
  - `session_id`: Session UUID
  - `hook_event_type`: Event type
  - `payload`: Event data
- **Error response**: Return 400 Bad Request if validation fails

```typescript
        // Insert event into database
        const savedEvent = insertEvent(event);

        // Broadcast to all WebSocket clients
        const message = JSON.stringify({ type: 'event', data: savedEvent });
        wsClients.forEach(client => {
          try {
            client.send(message);
          } catch (err) {
            // Client disconnected, remove from set
            wsClients.delete(client);
          }
        });
```

**Explanation:**
- **insertEvent**: Save to SQLite database
  - Adds auto-increment ID
  - Adds server timestamp
  - Returns complete event object
- **Broadcast**: Send to all connected WebSocket clients
  - Serialize to JSON
  - Iterate through all clients
  - Send message to each
  - Remove disconnected clients
- **Error handling**: If send fails, client is disconnected

```typescript
        return new Response(JSON.stringify(savedEvent), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error processing event:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
```

**Explanation:**
- **Success response**: Return saved event
  - HTTP 200 (default)
  - JSON content type
  - Complete event object
- **Error handling**: Catch any processing errors
  - Log to console
  - Return 400 error

**Request/Response example**:
```http
POST /events HTTP/1.1
Content-Type: application/json

{
  "source_app": "my-app",
  "session_id": "abc-123",
  "hook_event_type": "PreToolUse",
  "payload": {"tool_name": "Bash"}
}

HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 1234,
  "source_app": "my-app",
  "session_id": "abc-123",
  "hook_event_type": "PreToolUse",
  "payload": {"tool_name": "Bash"},
  "timestamp": 1705240800000,
  "created_at": "2025-01-14T10:00:00.000Z"
}
```

#### WebSocket Configuration (Lines 422-446)

```typescript
  websocket: {
    open(ws) {
      console.log('WebSocket client connected');
      wsClients.add(ws);

      // Send recent events on connection
      const events = getRecentEvents(300);
      ws.send(JSON.stringify({ type: 'initial', data: events }));
    },
```

**Explanation:**
- **open callback**: When client connects
- **Add to set**: Track this client
- **Send initial data**: Last 300 events
  - Client gets current state immediately
  - No need to wait for new events
  - Message type: `'initial'` (vs `'event'` for new events)

```typescript
    message(ws, message) {
      // Handle any client messages if needed
      console.log('Received message:', message);
    },
```

**Explanation:**
- **message callback**: When client sends message
- **Currently unused**: Server doesn't expect client messages
- **Future use**: Could implement client commands

```typescript
    close(ws) {
      console.log('WebSocket client disconnected');
      wsClients.delete(ws);
    },

    error(ws, error) {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
    }
  }
});
```

**Explanation:**
- **close callback**: Client disconnects (intentional or network failure)
- **error callback**: WebSocket error occurred
- **Cleanup**: Remove from set in both cases
  - Prevents sending to dead connections
  - Automatic garbage collection

#### Server Startup (Lines 449-451)

```typescript
console.log(`🚀 Server running on http://localhost:${server.port}`);
console.log(`📊 WebSocket endpoint: ws://localhost:${server.port}/stream`);
console.log(`📮 POST events to: http://localhost:${server.port}/events`);
```

**Explanation:**
- **Startup messages**: Print useful URLs
- **server.port**: Actual port being used
- **Helpful for debugging**: Copy-paste URLs

---

## Client Code

### App.vue

This is the **root Vue component** that manages the entire application.

**File**: `apps/client/src/App.vue`

#### Template Structure (Lines 1-135)

```vue
<template>
  <div class="h-screen flex flex-col bg-[var(--theme-bg-secondary)]">
```

**Explanation:**
- **h-screen**: Full viewport height (Tailwind CSS)
- **flex flex-col**: Vertical flexbox layout
- **bg-[var(--theme-bg-secondary)]**: Background color from CSS variable
  - Supports theming (dark/light modes)
  - CSS custom properties for dynamic values

#### Header Section (Lines 4-64)

```vue
    <header class="short:hidden bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)] shadow-lg border-b-2 border-[var(--theme-primary-dark)]">
      <div class="px-3 py-4 mobile:py-1.5 mobile:px-2 flex items-center justify-between mobile:gap-2">
        <!-- Title Section - Hidden on mobile -->
        <div class="mobile:hidden">
          <h1 class="text-2xl font-bold text-white drop-shadow-lg">
            Multi-Agent Observability
          </h1>
        </div>
```

**Explanation:**
- **short:hidden**: Hidden on short screens (Tailwind custom breakpoint)
- **Gradient background**: Primary color gradient
  - `from-[var(--theme-primary)]`: Start color
  - `to-[var(--theme-primary-light)]`: End color
- **Responsive design**:
  - `mobile:hidden`: Hide title on mobile
  - `mobile:py-1.5`: Smaller padding on mobile
  - Custom `mobile` breakpoint defined in Tailwind config

```vue
        <!-- Connection Status -->
        <div class="flex items-center mobile:space-x-1 space-x-1.5">
          <div v-if="isConnected" class="flex items-center mobile:space-x-0.5 space-x-1.5">
            <span class="relative flex mobile:h-2 mobile:w-2 h-3 w-3">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full mobile:h-2 mobile:w-2 h-3 w-3 bg-green-500"></span>
            </span>
            <span class="text-base mobile:text-xs text-white font-semibold drop-shadow-md mobile:hidden">Connected</span>
          </div>
```

**Explanation:**
- **v-if="isConnected"**: Conditional rendering
  - Show if WebSocket connected
  - Otherwise show disconnected state
- **Ping animation**: Two overlapping circles
  - **Outer**: `animate-ping` creates pulse effect
  - **Inner**: Solid circle
  - Creates "live" indicator effect
- **Color coding**:
  - Green = Connected
  - Red = Disconnected

#### Script Setup (Lines 138-235)

```vue
<script setup lang="ts">
import { ref, watch } from 'vue';
import type { TimeRange } from './types';
import { useWebSocket } from './composables/useWebSocket';
import { useThemes } from './composables/useThemes';
import { useEventColors } from './composables/useEventColors';
```

**Explanation:**
- **setup lang="ts"**: Composition API with TypeScript
  - Modern Vue 3 style
  - Type safety
  - Better autocomplete
- **Imports**:
  - `ref, watch`: Vue reactivity primitives
  - `TimeRange`: TypeScript type
  - Composables: Reusable logic

```vue
// WebSocket connection
const { events, isConnected, error, clearEvents } = useWebSocket(WS_URL);

// Theme management (sets up theme system)
useThemes();

// Event colors
const { getHexColorForApp } = useEventColors();
```

**Explanation:**
- **useWebSocket**: Reactive WebSocket connection
  - Returns: `events` (event array), `isConnected` (boolean), `error` (string)
  - `clearEvents`: Function to clear all events
- **useThemes**: Initialize theme system
  - Sets up CSS variables
  - Loads saved theme
  - Watches for theme changes
- **useEventColors**: Color generation utilities
  - `getHexColorForApp`: Generate color from app name

```vue
// Filters
const filters = ref({
  sourceApp: '',
  sessionId: '',
  eventType: ''
});

// UI state
const stickToBottom = ref(true);
const showThemeManager = ref(false);
const showFilters = ref(false);
```

**Explanation:**
- **ref()**: Create reactive state
  - Vue 3 Composition API
  - Changes trigger re-renders
- **filters**: Filter criteria
  - Empty string = no filter
  - Populated = filter active
- **UI flags**: Toggle various UI elements

```vue
// Watch for new agents and show toast
watch(uniqueAppNames, (newAppNames) => {
  // Find agents that are new (not in seenAgents set)
  newAppNames.forEach(appName => {
    if (!seenAgents.has(appName)) {
      seenAgents.add(appName);
      // Show toast for new agent
      const toast: Toast = {
        id: toastIdCounter++,
        agentName: appName,
        agentColor: getHexColorForApp(appName)
      };
      toasts.value.push(toast);
    }
  });
}, { deep: true });
```

**Explanation:**
- **watch**: React to state changes
  - Vue 3 Composition API
  - Triggers when `uniqueAppNames` changes
- **New agent detection**:
  - Compare new list to `seenAgents` set
  - If agent not seen before, show toast
- **Toast notification**:
  - Brief popup notification
  - Shows agent name and color
  - Auto-dismisses after timeout

```vue
// Handle agent tag clicks for swim lanes
const toggleAgentLane = (agentName: string) => {
  const index = selectedAgentLanes.value.indexOf(agentName);
  if (index >= 0) {
    // Remove from comparison
    selectedAgentLanes.value.splice(index, 1);
  } else {
    // Add to comparison
    selectedAgentLanes.value.push(agentName);
  }
};
```

**Explanation:**
- **toggleAgentLane**: Add/remove agent from swim lane view
- **Toggle logic**:
  - If already selected: Remove
  - If not selected: Add
- **splice vs push**: Array manipulation
  - `splice`: Remove element at index
  - `push`: Add element to end

---

### useWebSocket Composable

This **composable** handles WebSocket connection logic.

**File**: `apps/client/src/composables/useWebSocket.ts`

```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import type { HookEvent } from '../types';

export function useWebSocket(url: string) {
  const events = ref<HookEvent[]>([]);
  const isConnected = ref(false);
  const error = ref<string | null>(null);
  let ws: WebSocket | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 10;
```

**Explanation:**
- **Composable pattern**: Reusable logic
  - Extract complex logic from components
  - Share between multiple components
  - Easier to test
- **Reactive state**:
  - `events`: Array of events
  - `isConnected`: Connection status
  - `error`: Error message
- **WebSocket instance**: `ws` variable
- **Reconnection logic**: Track attempts

```typescript
  function connect() {
    try {
      ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('WebSocket connected');
        isConnected.value = true;
        error.value = null;
        reconnectAttempts = 0;
      };
```

**Explanation:**
- **connect function**: Establish WebSocket connection
- **new WebSocket**: Create connection
- **onopen**: Connection established
  - Set `isConnected` to true
  - Clear error
  - Reset reconnect counter

```typescript
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === 'initial') {
            // Initial events on connection
            events.value = message.data;
          } else if (message.type === 'event') {
            // New event
            events.value.push(message.data);

            // Limit events
            const maxEvents = parseInt(import.meta.env.VITE_MAX_EVENTS_TO_DISPLAY || '100');
            if (events.value.length > maxEvents) {
              events.value.shift(); // Remove oldest
            }
          }
        } catch (err) {
          console.error('Error parsing message:', err);
        }
      };
```

**Explanation:**
- **onmessage**: Receive data from server
- **Parse JSON**: Convert string to object
- **Message types**:
  - `initial`: Full event list (on connect)
  - `event`: New event (broadcast)
- **Initial load**: Replace entire array
- **New event**: Append to array
- **Event limiting**:
  - Check against max (from env var)
  - If exceeded, remove oldest (`shift`)
  - Prevents memory issues

```typescript
      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        error.value = 'Connection error';
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        isConnected.value = false;

        // Attempt reconnection
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts})`);
          setTimeout(connect, delay);
        } else {
          error.value = 'Max reconnection attempts reached';
        }
      };
    } catch (err) {
      console.error('Error creating WebSocket:', err);
      error.value = 'Failed to connect';
    }
  }
```

**Explanation:**
- **onerror**: Connection error occurred
- **onclose**: Connection closed
- **Reconnection logic**:
  - Track attempt number
  - Exponential backoff: 2^n seconds
  - Max delay: 30 seconds
  - Give up after 10 attempts
- **Exponential backoff**:
  - Attempt 1: 2s
  - Attempt 2: 4s
  - Attempt 3: 8s
  - Attempt 4: 16s
  - Attempt 5: 30s (capped)

```typescript
  onMounted(() => {
    connect();
  });

  onUnmounted(() => {
    if (ws) {
      ws.close();
    }
  });

  return {
    events,
    isConnected,
    error,
    clearEvents: () => { events.value = []; }
  };
}
```

**Explanation:**
- **onMounted**: Vue lifecycle hook
  - Called when component mounts
  - Connect to WebSocket
- **onUnmounted**: Cleanup
  - Called when component unmounts
  - Close WebSocket
  - Prevent memory leaks
- **Return object**: Expose reactive state and methods
  - `events`: Reactive array
  - `isConnected`: Reactive boolean
  - `error`: Reactive string
  - `clearEvents`: Method to reset

---

## Key Architectural Patterns

### 1. Event-Driven Architecture

```
Event Source (Hook) → Event Bus (HTTP POST) → Event Store (SQLite) → Event Consumers (WebSocket clients)
```

**Benefits:**
- Decoupling: Sources and consumers independent
- Scalability: Add consumers without changing sources
- Reliability: Events persisted in database

### 2. Real-Time Synchronization

```
Database Write → WebSocket Broadcast → Client Update
```

**No polling needed:**
- Server pushes updates
- Instant propagation
- Reduced network traffic

### 3. Reactive UI

```
State Change → Vue Reactivity → DOM Update
```

**Vue 3 Composition API:**
- `ref()` creates reactive values
- Changes trigger re-renders
- Computed values auto-update

### 4. Composables Pattern

```
Reusable Logic → Composable Function → Multiple Components
```

**Benefits:**
- Code reuse
- Separation of concerns
- Easier testing

### 5. Type Safety

```
TypeScript Interfaces → Compile-Time Checking → Runtime Safety
```

**Shared types:**
- Server and client use same interfaces
- Catch errors at compile time
- Better developer experience

---

This code walkthrough provides a detailed explanation of how the system works from the inside out. Each component is designed to be robust, maintainable, and performant.
