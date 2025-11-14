# Integration Guide

Complete guide to integrating the Multi-Agent Observability System into your projects.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Step-by-Step Integration](#step-by-step-integration)
- [Configuration](#configuration)
- [Multi-Project Setup](#multi-project-setup)
- [Environment Configuration](#environment-configuration)
- [Deployment](#deployment)
- [Verification](#verification)
- [Customization](#customization)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Multi-Agent Observability System allows you to monitor Claude Code agents across multiple projects simultaneously. This guide walks you through integrating it into your development workflow.

**What You'll Achieve:**
- Real-time visibility into all Claude Code agent actions
- Multi-project monitoring from a single dashboard
- Historical event tracking and analysis
- Custom hooks for project-specific needs

**Architecture Overview:**

```
Your Projects (with .claude/hooks/) → HTTP POST → Observability Server → WebSocket → Dashboard
```

---

## Prerequisites

Before starting, ensure you have:

### Required Software

1. **Claude Code CLI**
   ```bash
   # Check installation
   claude --version
   ```
   Install from: [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)

2. **Astral uv** (Python package manager)
   ```bash
   # Install on macOS/Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh

   # Verify installation
   uv --version
   ```

3. **Bun** (JavaScript runtime)
   ```bash
   # Install on macOS/Linux
   curl -fsSL https://bun.sh/install | bash

   # Verify installation
   bun --version
   ```

4. **Git** (for cloning the repository)
   ```bash
   git --version
   ```

### Required API Keys

Set these in your environment:

```bash
export ANTHROPIC_API_KEY="your-key-here"  # Required
export OPENAI_API_KEY="your-key-here"     # Optional (for multi-model support)
export ELEVEN_API_KEY="your-key-here"     # Optional (for audio features)
```

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) for persistence.

---

## Quick Start

**For the impatient**: Get up and running in 5 minutes.

### 1. Clone and Start the Observability System

```bash
# Clone the repository
git clone https://github.com/your-org/claude-code-hooks-multi-agent-observability.git
cd claude-code-hooks-multi-agent-observability

# Install dependencies
cd apps/server && bun install && cd ../..
cd apps/client && bun install && cd ../..

# Start both server and client
./scripts/start-system.sh
```

The dashboard will open at: **http://localhost:5173**

### 2. Integrate into Your Project

```bash
# Navigate to your project
cd /path/to/your/project

# Copy the .claude directory
cp -R /path/to/observability/.claude .

# Edit settings.json to set your project name
nano .claude/settings.json
```

Change `source-app` to your project name:

```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "uv run .claude/hooks/send_event.py --source-app YOUR_PROJECT_NAME --event-type PreToolUse"
      }]
    }]
  }
}
```

### 3. Test It

```bash
# In your project directory, run Claude
claude

# In Claude, try:
> Run git status to show the current repository state

# Check the dashboard - you should see the event!
```

---

## Step-by-Step Integration

### Step 1: Set Up the Observability System

#### 1.1 Clone the Repository

```bash
git clone https://github.com/your-org/claude-code-hooks-multi-agent-observability.git
cd claude-code-hooks-multi-agent-observability
```

#### 1.2 Install Dependencies

**Server:**
```bash
cd apps/server
bun install
```

**Client:**
```bash
cd ../client
bun install
cd ../..
```

#### 1.3 Configure Environment

Create `.env` in the project root:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Optional
ENGINEER_NAME="Your Name"
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
ELEVEN_API_KEY=...
```

Create `apps/client/.env`:

```bash
# Maximum events to display (prevents memory bloat)
VITE_MAX_EVENTS_TO_DISPLAY=100
```

#### 1.4 Start the System

```bash
# Option 1: Use the script (recommended)
./scripts/start-system.sh

# Option 2: Start manually
cd apps/server && bun run dev &
cd apps/client && bun run dev &
```

**Verify the system is running:**
- Server: http://localhost:4000/events/filter-options
- Client: http://localhost:5173

---

### Step 2: Integrate into Your First Project

#### 2.1 Copy the .claude Directory

```bash
# From your project directory
cp -R /path/to/observability/.claude .
```

**What you're copying:**
```
.claude/
├── hooks/                    # Hook scripts
│   ├── send_event.py         # Universal event sender
│   ├── pre_tool_use.py       # Pre-execution validation
│   ├── post_tool_use.py      # Post-execution logging
│   ├── user_prompt_submit.py # User prompt tracking
│   ├── notification.py       # Notification logging
│   ├── stop.py               # Response completion
│   ├── subagent_stop.py      # Subagent tracking
│   ├── pre_compact.py        # Context compaction
│   ├── session_start.py      # Session initialization
│   ├── session_end.py        # Session cleanup
│   └── utils/                # Shared utilities
└── settings.json             # Hook configuration
```

#### 2.2 Configure Your Project Name

Edit `.claude/settings.json` and replace all instances of the source-app:

**Before:**
```json
"command": "uv run .claude/hooks/send_event.py --source-app cc-hook-multi-agent-obvs --event-type PreToolUse"
```

**After:**
```json
"command": "uv run .claude/hooks/send_event.py --source-app my-awesome-project --event-type PreToolUse"
```

**Use a descriptive name:**
- ✅ `my-api-server`
- ✅ `react-frontend`
- ✅ `ml-training-pipeline`
- ❌ `project1` (not descriptive)
- ❌ `test` (too generic)

#### 2.3 Update Paths (If Needed)

If you see errors about paths, use absolute paths:

**Option 1: Use environment variable (recommended)**

Claude Code sets `$CLAUDE_PROJECT_DIR` automatically:

```json
{
  "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/send_event.py --source-app my-project --event-type PreToolUse"
}
```

**Option 2: Use the conversion command**

From Claude Code:
```
/convert_paths_absolute
```

This automatically converts all relative paths to absolute paths.

#### 2.4 Test the Integration

```bash
# Start Claude Code in your project
cd /path/to/your/project
claude

# Inside Claude, run a simple command
> Run git ls-files to see all tracked files
```

**Check the dashboard** (http://localhost:5173):
- You should see events appearing
- Source app should show "my-awesome-project"
- Session ID should be unique

---

### Step 3: Customize for Your Project

#### 3.1 Choose Which Hooks to Enable

You don't need all hooks. Edit `.claude/settings.json`:

**Minimal Setup** (just basic tracking):
```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "uv run .claude/hooks/send_event.py --source-app my-project --event-type PreToolUse"
      }]
    }],
    "PostToolUse": [{
      "hooks": [{
        "type": "command",
        "command": "uv run .claude/hooks/send_event.py --source-app my-project --event-type PostToolUse"
      }]
    }]
  }
}
```

**Full Setup** (all hooks):
```json
{
  "hooks": {
    "PreToolUse": [...],
    "PostToolUse": [...],
    "UserPromptSubmit": [...],
    "Notification": [...],
    "Stop": [...],
    "SubagentStop": [...],
    "PreCompact": [...],
    "SessionStart": [...],
    "SessionEnd": [...]
  }
}
```

#### 3.2 Enable AI Summarization

Add `--summarize` flag to get human-readable event descriptions:

```json
{
  "command": "uv run .claude/hooks/send_event.py --source-app my-project --event-type PreToolUse --summarize"
}
```

**Before (no summary):**
```
PreToolUse: {"tool_name": "Bash", "tool_input": {"command": "git status"}}
```

**After (with summary):**
```
PreToolUse: Checking git repository status
```

**Note**: Requires `ANTHROPIC_API_KEY` and makes API calls (slight delay).

#### 3.3 Enable Chat Transcript Capture

Add `--add-chat` flag to include full conversation history:

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "uv run .claude/hooks/stop.py --chat"
      }, {
        "type": "command",
        "command": "uv run .claude/hooks/send_event.py --source-app my-project --event-type Stop --add-chat"
      }]
    }]
  }
}
```

**Use cases:**
- Debugging: See full context of decisions
- Learning: Understand agent reasoning
- Auditing: Complete conversation records

**Warning**: Sends entire transcript (can be large).

---

## Configuration

### Settings.json Structure

```json
{
  "statusLine": {
    "type": "command",
    "command": "uv run $CLAUDE_PROJECT_DIR/.claude/status_lines/status_line_main.py",
    "padding": 0
  },
  "hooks": {
    "HOOK_TYPE": [
      {
        "matcher": "PATTERN",  // Optional: filter which tools
        "hooks": [
          {
            "type": "command",
            "command": "SCRIPT_PATH ARGS"
          }
        ]
      }
    ]
  }
}
```

### Hook Configuration Options

**Pattern Matching:**

```json
{
  "PreToolUse": [
    {
      "matcher": "Bash",  // Only for Bash tool
      "hooks": [...]
    },
    {
      "matcher": "Read|Write|Edit",  // Multiple tools (regex)
      "hooks": [...]
    },
    {
      "matcher": "",  // All tools (empty = match all)
      "hooks": [...]
    }
  ]
}
```

**Multiple Hooks per Event:**

```json
{
  "PreToolUse": [
    {
      "hooks": [
        {
          "type": "command",
          "command": "uv run .claude/hooks/validate.py"  // Run first
        },
        {
          "type": "command",
          "command": "uv run .claude/hooks/log.py"       // Then this
        },
        {
          "type": "command",
          "command": "uv run .claude/hooks/send_event.py --source-app my-app --event-type PreToolUse"  // Finally this
        }
      ]
    }
  ]
}
```

**Execution order**: Sequential. First failure stops the chain.

---

## Multi-Project Setup

Monitor multiple projects simultaneously.

### Strategy 1: Shared Observability System

**Architecture:**
```
Project A (.claude/hooks/) ──┐
Project B (.claude/hooks/) ──┼──> Observability Server ──> Dashboard
Project C (.claude/hooks/) ──┘
```

**Setup:**

1. **Start observability system once:**
   ```bash
   cd /path/to/observability
   ./scripts/start-system.sh
   ```

2. **Integrate into each project:**
   ```bash
   # Project A
   cd /path/to/project-a
   cp -R /path/to/observability/.claude .
   # Edit .claude/settings.json: --source-app project-a

   # Project B
   cd /path/to/project-b
   cp -R /path/to/observability/.claude .
   # Edit .claude/settings.json: --source-app project-b

   # Project C
   cd /path/to/project-c
   cp -R /path/to/observability/.claude .
   # Edit .claude/settings.json: --source-app project-c
   ```

3. **Use Claude in any project:**
   ```bash
   cd /path/to/project-a
   claude

   # Events appear in dashboard with source_app: "project-a"
   ```

**Benefits:**
- Single dashboard for all projects
- Compare agent behavior across projects
- Unified event history

---

### Strategy 2: Project-Specific Configurations

Customize hooks per project:

**Project A** (API server - strict validation):
```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [
        {"type": "command", "command": "uv run .claude/hooks/api_validator.py"},
        {"type": "command", "command": "uv run .claude/hooks/security_check.py"},
        {"type": "command", "command": "uv run .claude/hooks/send_event.py --source-app api-server --event-type PreToolUse"}
      ]
    }]
  }
}
```

**Project B** (Frontend - minimal tracking):
```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [
        {"type": "command", "command": "uv run .claude/hooks/send_event.py --source-app frontend --event-type PreToolUse"}
      ]
    }]
  }
}
```

**Project C** (ML pipeline - detailed logging):
```json
{
  "hooks": {
    "PreToolUse": [{
      "hooks": [
        {"type": "command", "command": "uv run .claude/hooks/pre_tool_use.py"},
        {"type": "command", "command": "uv run .claude/hooks/send_event.py --source-app ml-pipeline --event-type PreToolUse --summarize --add-context"}
      ]
    }],
    "PostToolUse": [{
      "hooks": [
        {"type": "command", "command": "uv run .claude/hooks/performance_tracker.py"},
        {"type": "command", "command": "uv run .claude/hooks/send_event.py --source-app ml-pipeline --event-type PostToolUse"}
      ]
    }]
  }
}
```

---

## Environment Configuration

### Server Configuration

**apps/server/.env** (or project root):

```bash
# Server Port
SERVER_PORT=4000

# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# User Info (for logging)
ENGINEER_NAME="Your Name"
```

### Client Configuration

**apps/client/.env:**

```bash
# Maximum events to display (prevents memory issues)
VITE_MAX_EVENTS_TO_DISPLAY=100

# Server URL (if different from default)
VITE_SERVER_URL=http://localhost:4000

# WebSocket URL (if different from default)
VITE_WS_URL=ws://localhost:4000/stream
```

### Hook Configuration

Create `.claude/hooks/.env` for hook-specific settings:

```bash
# Observability server URL
OBSERVABILITY_SERVER=http://localhost:4000/events

# Enable/disable features
ENABLE_SUMMARIZATION=true
ENABLE_CHAT_LOGGING=false

# Performance settings
HOOK_TIMEOUT=5
MAX_RETRIES=3
```

---

## Deployment

### Local Development

**Recommended**: Default setup works great for local development.

```bash
# Start once per machine
./scripts/start-system.sh

# Access from any project
# No changes needed
```

---

### Team Deployment

**Scenario**: Multiple developers on a team want shared observability.

**Option 1: Central Server**

1. **Deploy server to internal host:**
   ```bash
   # On server machine
   cd apps/server
   SERVER_PORT=4000 bun run dev
   ```

2. **Update client to connect to server:**
   ```bash
   # apps/client/.env
   VITE_SERVER_URL=http://internal-server:4000
   VITE_WS_URL=ws://internal-server:4000/stream
   ```

3. **Update hooks to point to server:**
   ```bash
   # Each developer's .claude/hooks/send_event.py
   # Change server URL
   SERVER_URL = "http://internal-server:4000/events"
   ```

**Option 2: Docker Deployment**

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  server:
    build: ./apps/server
    ports:
      - "4000:4000"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - ./events.db:/app/events.db

  client:
    build: ./apps/client
    ports:
      - "5173:5173"
    environment:
      - VITE_SERVER_URL=http://localhost:4000
      - VITE_WS_URL=ws://localhost:4000/stream
    depends_on:
      - server
```

Deploy:
```bash
docker-compose up -d
```

---

### Production Deployment

**Warning**: Current version is designed for development. For production:

1. **Add authentication**
2. **Use HTTPS/WSS**
3. **Implement rate limiting**
4. **Set up database backups**
5. **Configure logging**
6. **Add monitoring**

---

## Verification

### Check Installation

**1. Server Running:**
```bash
curl http://localhost:4000/events/filter-options
# Should return: {"source_apps":[],"session_ids":[],"hook_event_types":[]}
```

**2. Client Running:**
```bash
curl http://localhost:5173
# Should return HTML content
```

**3. WebSocket Working:**
```bash
# Install wscat: npm install -g wscat
wscat -c ws://localhost:4000/stream
# Should connect and receive initial events
```

---

### Test Event Flow

**Manual Event Test:**

```bash
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{
    "source_app": "test",
    "session_id": "test-123",
    "hook_event_type": "PreToolUse",
    "payload": {
      "tool_name": "Bash",
      "tool_input": {"command": "echo hello"}
    }
  }'
```

**Check dashboard**: Event should appear immediately.

---

### Test Hook Integration

**1. Create test file:**
```bash
# In your project
echo '{"tool_name": "Bash", "tool_input": {"command": "ls"}, "session_id": "test"}' > test_input.json
```

**2. Test hook manually:**
```bash
cat test_input.json | uv run .claude/hooks/send_event.py --source-app test --event-type PreToolUse
```

**3. Check server logs:**
```bash
# Should see POST request logged
```

**4. Check dashboard:**
- Event should appear
- Source app: "test"
- Event type: "PreToolUse"

---

## Customization

### Custom Hook Scripts

Create project-specific hooks:

**.claude/hooks/my_custom_hook.py:**

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

import json
import sys

def main():
    data = json.load(sys.stdin)

    # Your custom logic
    if data.get('tool_name') == 'Bash':
        command = data.get('tool_input', {}).get('command', '')

        # Example: Log all git commands
        if command.startswith('git '):
            print(f"Git command: {command}", file=sys.stderr)

    sys.exit(0)

if __name__ == '__main__':
    main()
```

**Add to settings.json:**

```json
{
  "PreToolUse": [{
    "hooks": [
      {"type": "command", "command": "uv run .claude/hooks/my_custom_hook.py"},
      {"type": "command", "command": "uv run .claude/hooks/send_event.py --source-app my-app --event-type PreToolUse"}
    ]
  }]
}
```

---

### Custom Event Fields

Add project-specific data:

```python
# In your hook script
import os
import subprocess

def get_git_info():
    try:
        branch = subprocess.check_output(
            ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
            text=True
        ).strip()

        commit = subprocess.check_output(
            ['git', 'rev-parse', '--short', 'HEAD'],
            text=True
        ).strip()

        return {'branch': branch, 'commit': commit}
    except:
        return {}

# Add to event payload
event_data['payload']['git_info'] = get_git_info()
event_data['payload']['environment'] = os.getenv('ENV', 'development')
```

---

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed solutions.

**Quick Fixes:**

**Events not appearing:**
```bash
# Check server is running
curl http://localhost:4000/events/filter-options

# Check hook paths
cat .claude/settings.json | grep "command"

# Test hook manually
echo '{}' | uv run .claude/hooks/send_event.py --source-app test --event-type PreToolUse
```

**Hooks not executing:**
```bash
# Convert to absolute paths
/convert_paths_absolute

# Check permissions
chmod +x .claude/hooks/*.py

# Test with uv directly
uv run .claude/hooks/pre_tool_use.py < test_input.json
```

**WebSocket disconnections:**
```bash
# Check client logs
# Browser console (F12) → Network → WS

# Check server logs
# Terminal where server is running
```

---

## Next Steps

1. **Explore the Dashboard**: Filter by app, session, and event type
2. **Customize Hooks**: Create project-specific validation
3. **Add More Projects**: Monitor your entire codebase
4. **Learn Advanced Features**: Check HOOK_DEVELOPMENT.md
5. **Join the Community**: Share your use cases!

---

## Resources

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Hook Development](./HOOK_DEVELOPMENT.md) - Create custom hooks
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
- [Architecture](./ARCHITECTURE.md) - System design deep dive
- [Code Walkthrough](./CODE_WALKTHROUGH.md) - Line-by-line explanations

---

Happy monitoring!
