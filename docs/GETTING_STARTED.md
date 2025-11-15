# Getting Started

A beginner-friendly tutorial for the Multi-Agent Observability System.

## Table of Contents

- [What Is This?](#what-is-this)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [First-Time Setup](#first-time-setup)
- [Running Your First Agent](#running-your-first-agent)
- [Understanding the UI](#understanding-the-ui)
- [Your First Custom Hook](#your-first-custom-hook)
- [Common Tasks](#common-tasks)
- [Next Steps](#next-steps)
- [Learning Resources](#learning-resources)

---

## What Is This?

The Multi-Agent Observability System lets you **see what Claude Code is doing** in real-time.

### Why Do You Need This?

When Claude Code works on your projects, it:
- Reads files
- Runs commands
- Modifies code
- Makes decisions

**But you can't see what's happening!**

This system solves that by:
1. **Capturing** every action Claude takes
2. **Displaying** them in a beautiful dashboard
3. **Tracking** multiple agents across projects
4. **Preventing** dangerous operations

### What You'll Learn

By the end of this tutorial, you'll be able to:
- ✅ Monitor Claude Code agents in real-time
- ✅ Track actions across multiple projects
- ✅ Create custom safety rules
- ✅ Understand agent behavior patterns

**Time required**: 30 minutes

---

## Prerequisites

### Check Your System

Before starting, let's verify you have what you need.

#### 1. Claude Code CLI

```bash
claude --version
```

**If not installed:**
- Visit: [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- Follow installation instructions
- Return here when installed

#### 2. Astral uv (Python package manager)

```bash
uv --version
```

**If not installed:**

```bash
# macOS / Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
irm https://astral.sh/uv/install.ps1 | iex

# Verify
uv --version
```

#### 3. Bun (JavaScript runtime)

```bash
bun --version
```

**If not installed:**

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# Windows
# Download from: https://bun.sh

# Verify
bun --version
```

#### 4. Git

```bash
git --version
```

**If not installed:**
- macOS: Install Xcode Command Line Tools
- Linux: `sudo apt install git` (Ubuntu) or `sudo yum install git` (RHEL)
- Windows: Download from [git-scm.com](https://git-scm.com)

---

### Get Your API Key

You need an Anthropic API key to use Claude.

**Steps:**

1. Go to: [https://console.anthropic.com](https://console.anthropic.com)
2. Sign in or create account
3. Navigate to: API Keys
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-...`)

**Set it in your environment:**

```bash
# macOS / Linux
echo 'export ANTHROPIC_API_KEY="sk-ant-YOUR-KEY-HERE"' >> ~/.bashrc
source ~/.bashrc

# Or for zsh
echo 'export ANTHROPIC_API_KEY="sk-ant-YOUR-KEY-HERE"' >> ~/.zshrc
source ~/.zshrc

# Windows (PowerShell)
[System.Environment]::SetEnvironmentVariable('ANTHROPIC_API_KEY', 'sk-ant-YOUR-KEY-HERE', 'User')
```

**Verify:**

```bash
echo $ANTHROPIC_API_KEY
# Should output: sk-ant-...
```

---

## Installation

### Step 1: Clone the Repository

```bash
# Navigate to where you keep projects
cd ~/projects  # or wherever you prefer

# Clone the repository
git clone https://github.com/your-org/claude-code-hooks-multi-agent-observability.git

# Enter the directory
cd claude-code-hooks-multi-agent-observability

# See what's inside
ls -la
```

**You should see:**
```
.claude/          # Hook scripts
apps/             # Server and client
scripts/          # Utility scripts
README.md         # Main documentation
```

---

### Step 2: Install Dependencies

**Install server dependencies:**

```bash
cd apps/server
bun install
```

**You'll see:**
```
+ @types/bun@latest
+ bun-types@latest
✨ Done in 2.3s
```

**Install client dependencies:**

```bash
cd ../client
bun install
```

**You'll see:**
```
+ vue@latest
+ @vitejs/plugin-vue@latest
+ tailwindcss@latest
...
✨ Done in 4.1s
```

**Return to project root:**

```bash
cd ../..
pwd  # Should show: .../claude-code-hooks-multi-agent-observability
```

---

### Step 3: Configure Environment

**Create environment file:**

```bash
# Copy the example
cp .env.sample .env

# Edit with your API key
nano .env
# Or use your preferred editor: code .env, vim .env, etc.
```

**Add your API key:**

```bash
# .env file
ANTHROPIC_API_KEY=sk-ant-YOUR-ACTUAL-KEY-HERE
ENGINEER_NAME=Your Name
```

**Save and exit** (Ctrl+X, then Y, then Enter in nano)

**Verify:**

```bash
cat .env | grep ANTHROPIC_API_KEY
# Should show your key
```

---

## First-Time Setup

### Start the System

**Run the start script:**

```bash
./scripts/start-system.sh
```

**You'll see:**

```
🚀 Starting Multi-Agent Observability System
===========================================

Configuration:
  Server Port: 4000
  Client Port: 5173

Checking for existing server on port 4000...
✅ Port 4000 is available

Checking for existing client on port 5173...
✅ Port 5173 is available

Starting server on port 4000...
Waiting for server to start...
✅ Server is ready!

Starting client on port 5173...
Waiting for client to start...
✅ Client is ready!

============================================
✅ Multi-Agent Observability System Started
============================================

🖥️  Client URL: http://localhost:5173
🔌 Server API: http://localhost:4000
📡 WebSocket: ws://localhost:4000/stream

📝 Process IDs:
   Server PID: 12345
   Client PID: 12346

To stop the system, run: ./scripts/reset-system.sh
Press Ctrl+C to stop both processes
```

---

### Open the Dashboard

**In your browser:**

1. Open: **http://localhost:5173**
2. You should see the Multi-Agent Observability dashboard
3. It will show "Connected" in green (top right)

**If you see "Disconnected":**
- Wait 10 seconds (WebSocket connecting)
- If still disconnected, see [Troubleshooting](./TROUBLESHOOTING.md)

---

### Verify Everything Works

**Test with curl:**

```bash
# Open a new terminal (keep the system running)

# Test the server
curl http://localhost:4000/events/filter-options
```

**You should see:**

```json
{
  "source_apps": [],
  "session_ids": [],
  "hook_event_types": []
}
```

**This is normal!** No events yet because we haven't run any agents.

---

## Running Your First Agent

Now let's see it in action!

### Set Up a Test Project

**Create a simple test project:**

```bash
# Create test directory
mkdir -p ~/test-observability
cd ~/test-observability

# Initialize git (required for Claude Code)
git init

# Create a simple file
echo "Hello, World!" > hello.txt
```

---

### Copy the Hooks

**Copy the .claude directory:**

```bash
# From your test project directory
cp -R ~/projects/claude-code-hooks-multi-agent-observability/.claude .

# Verify
ls -la .claude/
```

**You should see:**

```
.claude/
├── hooks/
│   ├── send_event.py
│   ├── pre_tool_use.py
│   ├── post_tool_use.py
│   └── ...
└── settings.json
```

---

### Configure the Project

**Edit settings.json:**

```bash
nano .claude/settings.json
# Or: code .claude/settings.json
```

**Find and replace:**

Look for all lines with `--source-app` and change the value:

**Before:**
```json
"command": "... --source-app cc-hook-multi-agent-obvs ..."
```

**After:**
```json
"command": "... --source-app my-test-project ..."
```

**Quick find & replace (in nano):**
- Press: Ctrl+\ (backslash)
- Search for: `cc-hook-multi-agent-obvs`
- Replace with: `my-test-project`
- Press: A (to replace all)

**Save and exit** (Ctrl+X, Y, Enter)

---

### Start Claude

**In your test project:**

```bash
claude
```

**You'll see:**

```
Claude Code CLI v1.x.x
Working directory: /Users/you/test-observability

>
```

---

### Run Your First Command

**In Claude, type:**

```
List all files in this directory using git ls-files
```

**Claude will respond:**

```
I'll list all files in the repository using git ls-files.

[Uses Bash tool]
Command: git ls-files
Output: hello.txt

The repository contains one file: hello.txt
```

---

### Watch the Dashboard

**Switch to your browser** (http://localhost:5173)

**You should see events appearing!**

Example events:
1. **UserPromptSubmit** - Your prompt: "List all files..."
2. **PreToolUse** - Before running `git ls-files`
3. **PostToolUse** - After running command
4. **Stop** - Claude finished responding

**Congratulations!** 🎉 You just monitored your first Claude Code agent!

---

## Understanding the UI

Let's explore the dashboard.

### Header

**Top bar shows:**
- 🟢 **Connected** - WebSocket status (green = connected, red = disconnected)
- **Multi-Agent Observability** - Title
- **Filter icon** - Toggle filter panel
- **Theme icon** - Switch dark/light mode

---

### Filter Panel

**Left sidebar (if visible):**

**Source Apps:**
- Shows all projects sending events
- Select to filter by project
- Example: "my-test-project"

**Sessions:**
- Shows all Claude sessions
- Each session = one Claude Code window
- Session IDs are truncated (first 8 chars)
- Example: "a1b2c3d4"

**Event Types:**
- Shows all hook event types
- Examples: PreToolUse, PostToolUse, UserPromptSubmit
- Select to filter by type

**Buttons:**
- **Select All** - Show all events
- **Clear All** - Hide all events

---

### Event Timeline

**Main area shows events:**

**Each event card displays:**

```
┌─────────────────────────────────────────┐
│ 🔧 PreToolUse                    12:34  │
│ Source: my-test-project:a1b2c3d4        │
│ Tool: Bash                              │
│ Command: git ls-files                   │
│ [If AI summary enabled] Running git ... │
└─────────────────────────────────────────┘
```

**Color coding:**
- **Left border** - Project color (same color = same project)
- **Second border** - Session color (same color = same session)

**This helps you visually track different agents!**

---

### Live Pulse Chart

**Bottom area shows activity:**

- **Real-time** visualization of events
- **Bars** represent event frequency
- **Colors** match sessions
- **Emojis** show event types
- **Time range** selector (1m, 3m, 5m)

---

### Event Details

**Click on an event to see more:**

- Full payload
- Chat transcript (if enabled)
- Timestamps
- Session details

---

## Your First Custom Hook

Let's create a hook that blocks dangerous commands.

### Create the Hook Script

**Create a new file:**

```bash
cd ~/test-observability
nano .claude/hooks/my_safety_check.py
```

**Add this code:**

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

"""
My Safety Check - Blocks dangerous git commands
"""

import json
import sys

DANGEROUS_COMMANDS = [
    'git push --force',
    'git reset --hard',
    'git clean -fdx'
]

def main():
    try:
        # Read input from Claude Code
        data = json.load(sys.stdin)

        # Check if it's a Bash command
        if data.get('tool_name') == 'Bash':
            command = data.get('tool_input', {}).get('command', '')

            # Check if command is dangerous
            for dangerous in DANGEROUS_COMMANDS:
                if dangerous in command:
                    print(f"⛔ BLOCKED: Dangerous command: {command}",
                          file=sys.stderr)
                    print(f"Reason: {dangerous} is not allowed",
                          file=sys.stderr)
                    sys.exit(2)  # Exit code 2 blocks execution

        # If not dangerous, allow
        sys.exit(0)

    except Exception as e:
        # Don't block on errors
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)

if __name__ == '__main__':
    main()
```

**Save and exit** (Ctrl+X, Y, Enter)

**Make executable:**

```bash
chmod +x .claude/hooks/my_safety_check.py
```

---

### Register the Hook

**Edit settings.json:**

```bash
nano .claude/settings.json
```

**Find the PreToolUse section:**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/pre_tool_use.py"
          },
          {
            "type": "command",
            "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/my_safety_check.py"
          },
          {
            "type": "command",
            "command": "uv run $CLAUDE_PROJECT_DIR/.claude/hooks/send_event.py --source-app my-test-project --event-type PreToolUse --summarize"
          }
        ]
      }
    ]
  }
}
```

**We added the middle line** to run our safety check before sending events.

**Save and exit** (Ctrl+X, Y, Enter)

---

### Test the Hook

**Start Claude (if not running):**

```bash
claude
```

**Try a dangerous command:**

```
Force push to the main branch using git push --force
```

**Claude will try, but your hook blocks it:**

```
❌ Tool use failed: pre_tool_use.py exited with code 2
⛔ BLOCKED: Dangerous command: git push --force
Reason: git push --force is not allowed
```

**Success!** Your hook protected your repository!

**Try a safe command:**

```
Show git status
```

**This works fine:**

```
[Uses Bash tool successfully]
Command: git status
Output: ...
```

---

## Common Tasks

### Task 1: Monitor Multiple Projects

**Set up another project:**

```bash
# Create second project
mkdir -p ~/test-project-2
cd ~/test-project-2
git init

# Copy hooks
cp -R ~/projects/claude-code-hooks-multi-agent-observability/.claude .

# Change source-app name
nano .claude/settings.json
# Change to: --source-app project-2

# Run Claude
claude
```

**In the dashboard:**
- You'll see both "my-test-project" and "project-2"
- Different colors for each project
- Filter to focus on one

---

### Task 2: Enable AI Summaries

**Edit settings.json:**

```bash
nano .claude/settings.json
```

**Add `--summarize` flag:**

```json
{
  "command": "uv run .claude/hooks/send_event.py --source-app my-test-project --event-type PreToolUse --summarize"
}
```

**Now events show human-readable descriptions:**

Before: `{"tool_name":"Bash","tool_input":{"command":"git status"}}`

After: `Checking git repository status`

---

### Task 3: Capture Full Conversations

**Edit settings.json:**

```bash
nano .claude/settings.json
```

**Add `--add-chat` to Stop hook:**

```json
{
  "Stop": [{
    "hooks": [
      {
        "type": "command",
        "command": "uv run .claude/hooks/stop.py --chat"
      },
      {
        "type": "command",
        "command": "uv run .claude/hooks/send_event.py --source-app my-test-project --event-type Stop --add-chat"
      }
    ]
  }]
}
```

**Now Stop events include full chat history.**

**Click "View Chat" button** in dashboard to see conversation.

---

### Task 4: Clean Old Events

**Database grows over time. Clean periodically:**

```bash
cd ~/projects/claude-code-hooks-multi-agent-observability/apps/server

# Delete events older than 7 days
sqlite3 events.db "DELETE FROM events WHERE timestamp < (strftime('%s', 'now') - 604800) * 1000;"

# Reclaim space
sqlite3 events.db "VACUUM;"
```

---

### Task 5: Export Events

**Export for analysis:**

```bash
cd ~/projects/claude-code-hooks-multi-agent-observability/apps/server

# Export to JSON
sqlite3 events.db "SELECT json_group_array(json_object('id', id, 'source_app', source_app, 'timestamp', timestamp, 'hook_event_type', hook_event_type)) FROM events;" > events.json

# Export to CSV
sqlite3 events.db << EOF
.mode csv
.headers on
.output events.csv
SELECT id, source_app, session_id, hook_event_type, timestamp FROM events;
.quit
EOF
```

---

### Task 6: Bookmark Important Sessions

**Scenario**: You found an interesting agent session and want to save it for later.

**Using the UI:**

1. **Open the Dashboard** at `http://localhost:5173`
2. **Find the session** you want to bookmark in the event timeline
3. **Click the star icon** (☆) next to the session ID
4. **The star turns gold** (★) indicating it's bookmarked
5. **Access bookmarks** via the Bookmarks dashboard tab

**Via API:**

```bash
# Bookmark a session
curl -X POST http://localhost:4000/api/bookmarks \
  -H "Content-Type: application/json" \
  -d '{
    "source_app": "my-project",
    "session_id": "abc123456",
    "bookmarked": true,
    "notes": "Great debugging example"
  }'

# View all bookmarks
curl http://localhost:4000/api/bookmarks

# Remove a bookmark
curl -X DELETE http://localhost:4000/api/bookmarks/my-project/abc123456
```

**Why bookmark sessions?**
- Save interesting debugging workflows
- Mark successful task completions
- Flag sessions that need review
- Quick access to reference examples

---

### Task 7: Tag and Organize Sessions

**Scenario**: You want to categorize sessions by type (debugging, testing, production, etc.)

**Add tags via UI:**

1. **Find a session** in the timeline
2. **Open the Tag Editor** component
3. **Type a tag name** (e.g., "debugging")
4. **Press Enter** or click "Add"
5. **Tags appear** with color coding

**Manage tags via API:**

```bash
# Add a tag to a session
curl -X POST http://localhost:4000/api/tags \
  -H "Content-Type: application/json" \
  -d '{
    "source_app": "my-project",
    "session_id": "abc123456",
    "tag": "debugging"
  }'

# Get all tags for a session
curl http://localhost:4000/api/tags/session/my-project/abc123456

# Find sessions with a specific tag
curl http://localhost:4000/api/tags/debugging/sessions

# Get all available tags
curl http://localhost:4000/api/tags/all

# Remove a tag
curl -X DELETE http://localhost:4000/api/tags/my-project/abc123456/debugging
```

**Common tags:**
- `debugging` - Troubleshooting sessions
- `successful` - Completed tasks
- `error` - Failed attempts
- `testing` - Test runs
- `production` - Production deployments
- `refactoring` - Code refactoring work

---

### Task 8: Analyze Agent Performance

**Scenario**: You want to see how fast and efficient your agents are.

**View performance metrics:**

1. **Open the Performance Dashboard** tab
2. **See overall metrics**:
   - Average response time
   - Success rate
   - Tools per task
3. **Compare sessions** side-by-side
4. **Identify bottlenecks** and optimization opportunities

**Calculate metrics via API:**

```bash
# Calculate metrics for a session
curl -X POST http://localhost:4000/api/metrics/performance/calculate/my-project/abc123456

# View metrics for a specific session
curl http://localhost:4000/api/metrics/performance/my-project/abc123456

# View all performance metrics
curl http://localhost:4000/api/metrics/performance/all
```

**Response example:**

```json
{
  "source_app": "my-project",
  "session_id": "abc123456",
  "avg_response_time": 1234.5,
  "tools_per_task": 2.5,
  "success_rate": 94.2,
  "session_duration": 3600000,
  "total_events": 45,
  "total_tool_uses": 28
}
```

**What the metrics mean:**

- **avg_response_time**: How long between agent actions (ms) - Lower is faster
- **tools_per_task**: Tools used per task - Shows efficiency
- **success_rate**: Percentage of successful tool uses - Higher is better
- **session_duration**: Total time from start to finish (ms)
- **total_events**: Total actions taken
- **total_tool_uses**: Total tools executed

**Use cases:**
- Compare agent models (Sonnet vs Haiku)
- Optimize prompt engineering
- Identify slow operations
- Track improvements over time

---

### Task 9: Detect Agent Behavior Patterns

**Scenario**: You want to understand common workflows your agents use.

**View detected patterns:**

1. **Open the Pattern Insights** dashboard
2. **See trending patterns** across all sessions
3. **Filter by pattern type** (workflow, retry, sequence)
4. **View example sequences** to understand the pattern

**Detect patterns via API:**

```bash
# Trigger pattern detection for a session
curl -X POST http://localhost:4000/api/patterns/detect/my-project/abc123456

# View patterns for a session
curl http://localhost:4000/api/patterns/my-project/abc123456

# Get trending patterns
curl http://localhost:4000/api/patterns/trending?limit=10

# View all patterns
curl http://localhost:4000/api/patterns/all
```

**Common patterns detected:**

**1. read-before-edit** (Workflow)
```
Read → Edit
```
Agent reads a file before editing it (safe practice)

**2. search-then-read** (Workflow)
```
Grep/Glob → Read
```
Agent searches for files before reading them (efficient)

**3. tool-retry** (Retry)
```
Bash → Bash → Bash
```
Agent retried same tool 3+ times (potential issue)

**Pattern response example:**

```json
{
  "pattern_type": "workflow",
  "pattern_name": "read-before-edit",
  "description": "Agent reads a file before editing it",
  "occurrences": 15,
  "confidence_score": 95,
  "example_sequence": "[\"Read\", \"Edit\"]"
}
```

**Why patterns matter:**
- **Best practices**: See which workflows succeed
- **Anti-patterns**: Detect retry loops and inefficiencies
- **Learning**: Understand how agents solve problems
- **Optimization**: Improve prompts based on patterns

---

### Task 10: Monitor Token Usage and Costs

**Scenario**: You want to track API costs across your projects.

**View cost dashboard:**

1. **Open the Token Metrics** dashboard
2. **See total costs** across all sessions
3. **View per-session breakdown** with model names
4. **Monitor spending** in real-time

**Query via API:**

```bash
# Get all session metrics
curl http://localhost:4000/api/metrics/sessions

# Get metrics for specific session
curl http://localhost:4000/api/metrics/session/abc123456
```

**Cost tracking is automatic** when using `--summarize` or `--add-chat` flags.

**Pricing (per 1M tokens):**
| Model | Input | Output |
|-------|-------|--------|
| Sonnet 4.5 | $3.00 | $15.00 |
| Opus 4 | $15.00 | $75.00 |
| Haiku 4 | $0.25 | $1.25 |

**Example output:**

```json
{
  "session_id": "abc123456",
  "total_tokens": 15234,
  "total_cost": 0.0457,
  "message_count": 12,
  "model_name": "claude-sonnet-4-5"
}
```

**Use cost data to:**
- Budget API spending
- Compare model costs
- Optimize prompt efficiency
- Track costs per project

---

## Next Steps

### Learn More

**Read the documentation:**

1. [API Reference](./API_REFERENCE.md) - Complete API documentation
2. [Hook Development](./HOOK_DEVELOPMENT.md) - Create advanced hooks
3. [Integration Guide](./INTEGRATION_GUIDE.md) - Multi-project setup
4. [Architecture](./ARCHITECTURE.md) - System design deep dive
5. [Troubleshooting](./TROUBLESHOOTING.md) - Fix common issues

---

### Watch Tutorials

**Video resources:**

- [Full System Breakdown](https://youtu.be/9ijnN985O_c)
- [Haiku 4.5 vs Sonnet 4.5 Comparison](https://youtu.be/aA9KP7QIQvM)
- [Mastering Claude Code Hooks](https://github.com/disler/claude-code-hooks-mastery)
- [IndyDevDan YouTube Channel](https://www.youtube.com/@indydevdan)

---

### Experiment

**Try these ideas:**

1. **Create a logging hook** that saves all commands to a file
2. **Add approval requirement** for file deletions
3. **Track token usage** across sessions
4. **Compare agent performance** between models
5. **Build custom visualizations** using exported data

---

### Join the Community

**Share your creations:**

- Post on YouTube videos
- Create GitHub issues with suggestions
- Share hooks you've created
- Help others troubleshoot

---

### Advanced Features

**When you're ready:**

- **Human-in-the-Loop (HITL)**: Require approval for actions
- **Multi-model comparison**: Track different AI models
- **Custom themes**: Create your own UI themes
- **Agent swim lanes**: Compare agents side-by-side
- **Performance analytics**: Measure agent efficiency

---

## Quick Reference

### Start System

```bash
cd ~/projects/claude-code-hooks-multi-agent-observability
./scripts/start-system.sh
```

### Stop System

```bash
./scripts/reset-system.sh
```

### Restart System

```bash
./scripts/reset-system.sh && ./scripts/start-system.sh
```

### Test Hook

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"ls"},"session_id":"test"}' | \
  uv run .claude/hooks/send_event.py --source-app test --event-type PreToolUse
```

### Check Dashboard

Open: **http://localhost:5173**

### Check Server

```bash
curl http://localhost:4000/events/filter-options
```

### Clean Database

```bash
cd apps/server
sqlite3 events.db "DELETE FROM events WHERE timestamp < (strftime('%s', 'now') - 604800) * 1000;"
```

---

## Troubleshooting

**Common issues:**

| Problem | Solution |
|---------|----------|
| Server won't start | Check port 4000: `lsof -i :4000` |
| Dashboard shows "Disconnected" | Refresh browser, check server is running |
| Hooks not executing | Use absolute paths: `/convert_paths_absolute` |
| Events not appearing | Test with curl, check server logs |

**For detailed help:** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Congratulations! 🎉

You've successfully:
- ✅ Installed the Multi-Agent Observability System
- ✅ Monitored your first Claude Code agent
- ✅ Created a custom safety hook
- ✅ Explored the dashboard UI

**You're now ready to:**
- Monitor multiple projects
- Create advanced hooks
- Understand agent behavior
- Improve your AI coding workflow

---

## Keep Learning

**Next tutorials:**

1. **Beginner → Intermediate**: Read [HOOK_DEVELOPMENT.md](./HOOK_DEVELOPMENT.md)
2. **Intermediate → Advanced**: Read [ARCHITECTURE.md](./ARCHITECTURE.md)
3. **Production Setup**: Read [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)

**Master AI agentic coding:**
- [Tactical Agentic Coding Course](https://agenticengineer.com/tactical-agentic-coding)
- [IndyDevDan YouTube](https://www.youtube.com/@indydevdan)

---

Welcome to the world of AI agent observability! 🚀
