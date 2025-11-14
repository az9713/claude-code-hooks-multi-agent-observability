# Hook Development Guide

Learn how to create custom hooks for Claude Code with the Multi-Agent Observability System.

## Table of Contents

- [Overview](#overview)
- [Hook System Architecture](#hook-system-architecture)
- [Getting Started](#getting-started)
- [Creating Your First Hook](#creating-your-first-hook)
- [Hook Types](#hook-types)
- [Best Practices](#best-practices)
- [Testing Hooks](#testing-hooks)
- [Common Patterns](#common-patterns)
- [Error Handling](#error-handling)
- [Performance Considerations](#performance-considerations)
- [Advanced Topics](#advanced-topics)

---

## Overview

Claude Code hooks allow you to intercept and react to agent actions at various lifecycle points. The observability system provides a framework for creating hooks that:

1. **Monitor** agent behavior
2. **Validate** actions before execution
3. **Block** dangerous operations
4. **Enhance** events with additional context
5. **Transmit** events to the observability server

---

## Hook System Architecture

### How Hooks Work

```
Claude Code Action → Hook Trigger → Your Script → Response → Action Allowed/Blocked
                                          ↓
                                    Observability Event
```

### Hook Execution Flow

1. **Claude Code** detects an action (tool use, user prompt, etc.)
2. **Settings check**: Looks for matching hooks in `.claude/settings.json`
3. **Hook execution**: Runs your script with action data via stdin
4. **Exit code check**:
   - `0` = Allow action to proceed
   - `1` or `2` = Block action and show error
5. **Observability**: Send event to server (if configured)

---

## Getting Started

### Prerequisites

1. **Claude Code CLI** installed
2. **Astral uv** for Python package management
3. **Basic Python** knowledge
4. **Observability server** running (optional for testing)

### Project Structure

```
your-project/
├── .claude/
│   ├── hooks/
│   │   ├── pre_tool_use.py           # Before tools execute
│   │   ├── post_tool_use.py          # After tools execute
│   │   ├── user_prompt_submit.py     # When user sends prompt
│   │   ├── send_event.py             # Universal event sender
│   │   └── utils/
│   │       ├── summarizer.py         # AI summarization
│   │       └── constants.py          # Shared configuration
│   └── settings.json                 # Hook configuration
```

---

## Creating Your First Hook

### Step 1: Create the Hook Script

Create a new file: `.claude/hooks/my_first_hook.py`

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = []
# ///

"""
My First Hook - A simple example
"""

import json
import sys

def main():
    try:
        # Read hook data from stdin
        input_data = json.load(sys.stdin)

        # Extract information
        tool_name = input_data.get('tool_name', '')
        session_id = input_data.get('session_id', 'unknown')

        # Log to stderr (won't interfere with stdout)
        print(f"Hook triggered! Tool: {tool_name}, Session: {session_id}",
              file=sys.stderr)

        # Allow action to proceed
        sys.exit(0)

    except Exception as e:
        # Log error but don't block
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)

if __name__ == '__main__':
    main()
```

### Step 2: Make Script Executable

```bash
chmod +x .claude/hooks/my_first_hook.py
```

### Step 3: Register in settings.json

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "uv run .claude/hooks/my_first_hook.py"
          }
        ]
      }
    ]
  }
}
```

### Step 4: Test

Run Claude Code and use any tool. Your hook will execute!

---

## Hook Types

### PreToolUse

**When**: Before Claude executes a tool

**Purpose**:
- Validate tool inputs
- Block dangerous commands
- Log tool usage
- Modify tool parameters (advanced)

**Input Data Structure:**

```json
{
  "tool_name": "Bash",
  "tool_input": {
    "command": "ls -la"
  },
  "session_id": "uuid-here",
  "transcript_path": "/path/to/transcript.jsonl"
}
```

**Example Use Cases:**
- Block `rm -rf /` commands
- Prevent access to sensitive files
- Require approval for destructive operations
- Log all file system operations

**Example Implementation:**

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# ///

import json
import sys

DANGEROUS_PATTERNS = [
    'rm -rf /',
    'mkfs',
    'dd if=/dev/zero'
]

def is_dangerous(command):
    return any(pattern in command.lower() for pattern in DANGEROUS_PATTERNS)

def main():
    try:
        data = json.load(sys.stdin)

        if data.get('tool_name') == 'Bash':
            command = data.get('tool_input', {}).get('command', '')

            if is_dangerous(command):
                print(f"⛔ BLOCKED: Dangerous command: {command}", file=sys.stderr)
                sys.exit(2)  # Exit code 2 blocks execution

        sys.exit(0)  # Allow execution

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(0)  # Don't block on errors

if __name__ == '__main__':
    main()
```

---

### PostToolUse

**When**: After Claude executes a tool

**Purpose**:
- Capture execution results
- Log outputs
- Analyze tool effectiveness
- Trigger follow-up actions

**Input Data Structure:**

```json
{
  "tool_name": "Read",
  "tool_input": {
    "file_path": "/path/to/file.js"
  },
  "tool_result": "// File contents here...",
  "session_id": "uuid-here"
}
```

**Example Use Cases:**
- Log all file modifications
- Track API calls
- Measure execution time
- Archive command outputs

---

### UserPromptSubmit

**When**: User submits a prompt to Claude

**Purpose**:
- Log user requests
- Validate prompts
- Inject context
- Track conversation flow

**Input Data Structure:**

```json
{
  "user_message": "Create a REST API endpoint",
  "session_id": "uuid-here",
  "transcript_path": "/path/to/transcript.jsonl"
}
```

**Example Use Cases:**
- Track all user requests
- Validate prompt safety
- Add project context automatically
- Generate prompt embeddings

---

### Notification

**When**: Claude sends a notification to the user

**Purpose**:
- Log notifications
- Implement human-in-the-loop
- Track agent questions
- Measure interaction points

**Input Data Structure:**

```json
{
  "notification_message": "I need approval to delete files",
  "session_id": "uuid-here"
}
```

---

### Stop

**When**: Claude finishes a response

**Purpose**:
- Capture final output
- Log complete conversations
- Measure response time
- Archive sessions

**Input Data Structure:**

```json
{
  "final_text": "Task completed successfully",
  "session_id": "uuid-here",
  "transcript_path": "/path/to/transcript.jsonl"
}
```

---

### SubagentStop

**When**: A subagent completes its task

**Purpose**:
- Track subagent usage
- Measure delegation patterns
- Log subagent results

---

### SessionStart / SessionEnd

**When**: Session begins or ends

**Purpose**:
- Initialize session context
- Load project-specific data
- Clean up resources
- Archive session data

---

## Best Practices

### 1. Always Exit with 0 for Observability

```python
# ✅ GOOD - Don't block on observability failures
try:
    send_event_to_server(event_data)
except Exception as e:
    print(f"Failed to send event: {e}", file=sys.stderr)
finally:
    sys.exit(0)  # Always allow Claude to continue

# ❌ BAD - Blocks Claude on network issues
send_event_to_server(event_data)
sys.exit(0)
```

### 2. Use Exit Code 2 to Block Actions

```python
# ✅ GOOD - Clear blocking
if is_dangerous_operation():
    print("⛔ BLOCKED: Operation not allowed", file=sys.stderr)
    sys.exit(2)  # Claude shows error and blocks

# ❌ BAD - Unclear why it failed
if is_dangerous_operation():
    sys.exit(1)  # Generic failure
```

### 3. Log to stderr, Not stdout

```python
# ✅ GOOD - Won't interfere with Claude's output
print("Hook executed successfully", file=sys.stderr)

# ❌ BAD - Might corrupt Claude's output
print("Hook executed successfully")  # Goes to stdout
```

### 4. Handle JSON Parsing Errors

```python
# ✅ GOOD - Graceful error handling
try:
    data = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print(f"Invalid JSON: {e}", file=sys.stderr)
    sys.exit(0)  # Don't block on parse errors

# ❌ BAD - Crashes on invalid JSON
data = json.load(sys.stdin)  # Will raise exception
```

### 5. Use Timeouts for External Calls

```python
# ✅ GOOD - Timeout prevents hanging
import urllib.request

try:
    with urllib.request.urlopen(url, timeout=5) as response:
        data = response.read()
except Exception as e:
    print(f"Request failed: {e}", file=sys.stderr)

# ❌ BAD - Can hang indefinitely
with urllib.request.urlopen(url) as response:
    data = response.read()
```

### 6. Cache Expensive Operations

```python
# ✅ GOOD - Cache model extraction
from functools import lru_cache

@lru_cache(maxsize=100)
def get_model_name(transcript_path):
    # Expensive: Read and parse file
    return extract_model_from_transcript(transcript_path)

# ❌ BAD - Re-reads file every time
def get_model_name(transcript_path):
    return extract_model_from_transcript(transcript_path)
```

---

## Testing Hooks

### Manual Testing

**1. Test with echo:**

```bash
echo '{"tool_name": "Bash", "tool_input": {"command": "ls"}}' | \
  uv run .claude/hooks/pre_tool_use.py
```

**2. Test with file:**

```bash
cat test_data.json | uv run .claude/hooks/pre_tool_use.py
```

**3. Check exit code:**

```bash
echo '{"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}}' | \
  uv run .claude/hooks/pre_tool_use.py
echo "Exit code: $?"
```

### Automated Testing

Create `test_hooks.py`:

```python
import subprocess
import json
import sys

def test_hook(script_path, input_data, expected_exit_code):
    """Test a hook script with given input."""
    result = subprocess.run(
        ['uv', 'run', script_path],
        input=json.dumps(input_data),
        capture_output=True,
        text=True
    )

    assert result.returncode == expected_exit_code, \
        f"Expected exit code {expected_exit_code}, got {result.returncode}"

    return result

# Test dangerous command blocking
test_hook(
    '.claude/hooks/pre_tool_use.py',
    {
        'tool_name': 'Bash',
        'tool_input': {'command': 'rm -rf /'}
    },
    expected_exit_code=2  # Should block
)

# Test safe command
test_hook(
    '.claude/hooks/pre_tool_use.py',
    {
        'tool_name': 'Bash',
        'tool_input': {'command': 'ls -la'}
    },
    expected_exit_code=0  # Should allow
)

print("✅ All tests passed!")
```

Run tests:

```bash
python test_hooks.py
```

---

## Common Patterns

### Pattern 1: Conditional Blocking

```python
def should_block(tool_name, tool_input):
    """Decide whether to block based on conditions."""

    # Block dangerous Bash commands
    if tool_name == 'Bash':
        command = tool_input.get('command', '')
        if is_dangerous_command(command):
            return True, "Dangerous command detected"

    # Block access to .env files
    if tool_name in ['Read', 'Edit', 'Write']:
        file_path = tool_input.get('file_path', '')
        if '.env' in file_path and not file_path.endswith('.env.sample'):
            return True, "Access to .env files is prohibited"

    # Block large file operations
    if tool_name == 'Read':
        file_path = tool_input.get('file_path', '')
        if os.path.getsize(file_path) > 10 * 1024 * 1024:  # 10MB
            return True, "File too large (>10MB)"

    return False, None

# Usage in main()
should_block_action, reason = should_block(tool_name, tool_input)
if should_block_action:
    print(f"⛔ BLOCKED: {reason}", file=sys.stderr)
    sys.exit(2)
```

### Pattern 2: Event Enrichment

```python
def enrich_event(event_data):
    """Add additional context to events."""

    # Add git branch
    try:
        branch = subprocess.check_output(
            ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
            text=True,
            timeout=1
        ).strip()
        event_data['git_branch'] = branch
    except:
        pass

    # Add environment
    event_data['environment'] = os.getenv('ENV', 'development')

    # Add user
    event_data['user'] = os.getenv('ENGINEER_NAME', 'unknown')

    return event_data
```

### Pattern 3: Rate Limiting

```python
import time
from collections import deque

class RateLimiter:
    def __init__(self, max_calls, time_window):
        self.max_calls = max_calls
        self.time_window = time_window
        self.calls = deque()

    def is_allowed(self):
        now = time.time()

        # Remove old calls outside window
        while self.calls and self.calls[0] < now - self.time_window:
            self.calls.popleft()

        # Check if limit exceeded
        if len(self.calls) >= self.max_calls:
            return False

        # Record this call
        self.calls.append(now)
        return True

# Usage
limiter = RateLimiter(max_calls=100, time_window=60)  # 100 per minute

if not limiter.is_allowed():
    print("⛔ Rate limit exceeded", file=sys.stderr)
    sys.exit(2)
```

### Pattern 4: Context Injection

```python
def inject_project_context(event_data):
    """Add project-specific context to help Claude."""

    context = {
        'project_name': 'my-api-server',
        'tech_stack': ['Python', 'FastAPI', 'PostgreSQL'],
        'coding_standards': 'PEP 8',
        'test_framework': 'pytest'
    }

    event_data['project_context'] = context
    return event_data
```

---

## Error Handling

### Error Categories

1. **Critical Errors**: Block execution
2. **Soft Errors**: Log but allow
3. **Hook Errors**: Don't block Claude

### Error Handling Template

```python
def main():
    try:
        # Parse input
        try:
            data = json.load(sys.stdin)
        except json.JSONDecodeError as e:
            print(f"❌ JSON parse error: {e}", file=sys.stderr)
            sys.exit(0)  # Don't block on parse errors

        # Validate action
        try:
            should_block, reason = validate_action(data)
            if should_block:
                print(f"⛔ BLOCKED: {reason}", file=sys.stderr)
                sys.exit(2)  # Block execution
        except Exception as e:
            print(f"⚠️  Validation error: {e}", file=sys.stderr)
            sys.exit(0)  # Allow on validation errors

        # Send to observability (optional)
        try:
            send_event(data)
        except Exception as e:
            print(f"⚠️  Failed to send event: {e}", file=sys.stderr)
            # Continue anyway

        sys.exit(0)  # Allow execution

    except Exception as e:
        print(f"❌ Unexpected error: {e}", file=sys.stderr)
        sys.exit(0)  # Don't block on unexpected errors
```

---

## Performance Considerations

### 1. Keep Hooks Fast

**Target**: < 100ms per hook execution

**Slow Operations to Avoid:**
- Network requests without timeouts
- Reading large files
- Complex computations
- Database queries without indexes

**Optimization Techniques:**

```python
# ✅ GOOD - Fast file check
if os.path.exists(file_path) and file_path.endswith('.env'):
    sys.exit(2)

# ❌ BAD - Reads entire file
with open(file_path) as f:
    if 'API_KEY' in f.read():
        sys.exit(2)
```

### 2. Use Async for I/O

```python
import asyncio

async def send_event_async(event_data):
    """Non-blocking event transmission."""
    # Use aiohttp or similar
    pass

# Don't wait for completion
asyncio.create_task(send_event_async(event_data))
sys.exit(0)
```

### 3. Cache Aggressively

```python
import functools
import pickle
import os

def disk_cache(func):
    """Cache function results to disk."""
    cache_dir = '.cache'
    os.makedirs(cache_dir, exist_ok=True)

    @functools.wraps(func)
    def wrapper(*args):
        cache_key = str(args)
        cache_file = f"{cache_dir}/{hash(cache_key)}.pkl"

        if os.path.exists(cache_file):
            with open(cache_file, 'rb') as f:
                return pickle.load(f)

        result = func(*args)

        with open(cache_file, 'wb') as f:
            pickle.dump(result, f)

        return result

    return wrapper

@disk_cache
def expensive_operation(input_data):
    # Complex computation
    pass
```

---

## Advanced Topics

### Human-in-the-Loop (HITL)

Request human approval before proceeding:

```python
import uuid
import socket

def request_human_approval(question):
    """Ask human for approval via WebSocket."""

    # Start WebSocket server for response
    ws_port = 9000 + random.randint(0, 999)
    response_url = f"ws://localhost:{ws_port}/response"

    # Send HITL event
    event_data = {
        'source_app': 'my-app',
        'session_id': session_id,
        'hook_event_type': 'Notification',
        'payload': {},
        'humanInTheLoop': {
            'question': question,
            'type': 'permission',
            'responseWebSocketUrl': response_url,
            'timeout': 300
        }
    }

    send_event(event_data)

    # Wait for response
    response = wait_for_response(ws_port)

    return response.get('permission', False)

# Usage
if requires_approval(operation):
    approved = request_human_approval("Delete 100 files?")
    if not approved:
        print("⛔ Operation denied by user", file=sys.stderr)
        sys.exit(2)
```

### Multi-Hook Composition

Chain multiple hooks together:

```python
# .claude/settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "uv run .claude/hooks/validate.py"
          },
          {
            "type": "command",
            "command": "uv run .claude/hooks/log.py"
          },
          {
            "type": "command",
            "command": "uv run .claude/hooks/send_event.py --source-app my-app --event-type PreToolUse"
          }
        ]
      }
    ]
  }
}
```

**Execution Order**: Sequential. First hook failure stops the chain.

### Custom Event Types

Create project-specific events:

```python
def send_custom_event(event_type, data):
    """Send custom observability event."""
    event = {
        'source_app': 'my-app',
        'session_id': get_session_id(),
        'hook_event_type': f'Custom_{event_type}',
        'payload': data,
        'timestamp': int(time.time() * 1000)
    }

    send_event_to_server(event)

# Examples
send_custom_event('DeploymentStarted', {'environment': 'production'})
send_custom_event('TestsPassed', {'test_count': 42})
send_custom_event('SecurityScan', {'vulnerabilities': 0})
```

---

## Resources

- **Official Docs**: [Claude Code Hooks Documentation](https://docs.anthropic.com/en/docs/claude-code/hooks)
- **Video Tutorial**: [Mastering Claude Code Hooks](https://github.com/disler/claude-code-hooks-mastery)
- **Example Hooks**: Check `.claude/hooks/` in this repository
- **Support**: GitHub Issues or YouTube comments

---

## Quick Reference

### Hook Template

```python
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.8"
# dependencies = []
# ///

import json
import sys

def main():
    try:
        data = json.load(sys.stdin)

        # Your logic here

        sys.exit(0)  # Allow

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(0)  # Don't block

if __name__ == '__main__':
    main()
```

### Exit Codes

| Code | Meaning | Use Case |
|------|---------|----------|
| 0 | Success, allow | Default case |
| 1 | Generic failure | Rarely used |
| 2 | Block execution | Dangerous operations |

### Common Imports

```python
import json          # Parse stdin data
import sys           # Exit codes, stderr
import os            # File operations
import subprocess    # Run commands
import urllib.request  # HTTP requests
import time          # Timestamps
import re            # Pattern matching
```

Happy hook development!
