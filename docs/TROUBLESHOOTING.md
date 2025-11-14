# Troubleshooting Guide

Solutions to common issues with the Multi-Agent Observability System.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Connection Issues](#connection-issues)
- [Hook Problems](#hook-problems)
- [Events Not Appearing](#events-not-appearing)
- [WebSocket Issues](#websocket-issues)
- [Database Problems](#database-problems)
- [Performance Issues](#performance-issues)
- [Debugging Techniques](#debugging-techniques)
- [Error Messages](#error-messages)
- [FAQ](#faq)

---

## Quick Diagnostics

Run these checks first to identify the issue:

### System Health Check

```bash
#!/bin/bash
echo "=== Multi-Agent Observability Health Check ==="

# 1. Check server is running
echo -n "Server status: "
if curl -s http://localhost:4000/events/filter-options > /dev/null; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# 2. Check client is running
echo -n "Client status: "
if curl -s http://localhost:5173 > /dev/null; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# 3. Check database exists
echo -n "Database: "
if [ -f apps/server/events.db ]; then
    echo "✅ Found"
else
    echo "❌ Missing"
fi

# 4. Check hooks directory
echo -n "Hooks directory: "
if [ -d .claude/hooks ]; then
    echo "✅ Found"
else
    echo "❌ Missing"
fi

# 5. Check uv is installed
echo -n "uv installation: "
if command -v uv &> /dev/null; then
    echo "✅ Installed ($(uv --version))"
else
    echo "❌ Not installed"
fi

# 6. Check bun is installed
echo -n "Bun installation: "
if command -v bun &> /dev/null; then
    echo "✅ Installed ($(bun --version))"
else
    echo "❌ Not installed"
fi
```

Save as `health-check.sh`, make executable with `chmod +x health-check.sh`, and run:

```bash
./health-check.sh
```

---

## Connection Issues

### Server Not Starting

**Symptom**: `./scripts/start-system.sh` fails or server doesn't respond

**Causes & Solutions:**

#### 1. Port Already in Use

**Check:**
```bash
lsof -i :4000
# or
netstat -an | grep 4000
```

**Solution:**
```bash
# Option 1: Kill existing process
kill -9 $(lsof -ti :4000)

# Option 2: Use different port
SERVER_PORT=4001 ./scripts/start-system.sh
```

#### 2. Missing Dependencies

**Check:**
```bash
cd apps/server
bun install --dry-run
```

**Solution:**
```bash
cd apps/server
rm -rf node_modules
bun install
```

#### 3. Database Locked

**Check:**
```bash
cd apps/server
sqlite3 events.db "PRAGMA integrity_check;"
```

**Solution:**
```bash
# Backup and remove lock
cp events.db events.db.backup
rm events.db-shm events.db-wal  # Remove lock files
```

#### 4. Missing Environment Variables

**Check:**
```bash
echo $ANTHROPIC_API_KEY
```

**Solution:**
```bash
# Add to .env file
cat > .env << EOF
ANTHROPIC_API_KEY=your-key-here
EOF

# Or export directly
export ANTHROPIC_API_KEY="your-key-here"
```

---

### Client Not Starting

**Symptom**: Client fails to load or shows blank page

**Causes & Solutions:**

#### 1. Port Conflict

**Check:**
```bash
lsof -i :5173
```

**Solution:**
```bash
# Use different port
VITE_PORT=5174 bun run dev
```

#### 2. Build Errors

**Check:**
```bash
cd apps/client
bun run dev
# Look for TypeScript errors
```

**Solution:**
```bash
# Clear cache and rebuild
rm -rf node_modules .vite
bun install
bun run dev
```

#### 3. Environment Variable Issues

**Check:**
```bash
cd apps/client
cat .env
```

**Solution:**
```bash
# Create or fix .env
cat > .env << EOF
VITE_MAX_EVENTS_TO_DISPLAY=100
VITE_SERVER_URL=http://localhost:4000
VITE_WS_URL=ws://localhost:4000/stream
EOF
```

---

### Cannot Connect to Server

**Symptom**: Client shows "Disconnected" status

**Diagnostic Steps:**

1. **Verify server is running:**
   ```bash
   curl http://localhost:4000/events/filter-options
   ```

2. **Check firewall:**
   ```bash
   # macOS
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

   # Linux
   sudo ufw status
   ```

3. **Check CORS headers:**
   ```bash
   curl -I http://localhost:4000/events/filter-options
   # Should include: Access-Control-Allow-Origin: *
   ```

**Solutions:**

```bash
# 1. Restart server
./scripts/reset-system.sh
./scripts/start-system.sh

# 2. Check server logs
cd apps/server
bun run dev
# Look for errors

# 3. Test with curl
curl -X POST http://localhost:4000/events \
  -H "Content-Type: application/json" \
  -d '{"source_app":"test","session_id":"test","hook_event_type":"test","payload":{}}'
```

---

## Hook Problems

### Hooks Not Executing

**Symptom**: Events not appearing in dashboard, no activity logs

**Diagnostic Steps:**

1. **Check settings.json exists:**
   ```bash
   ls -la .claude/settings.json
   ```

2. **Validate JSON syntax:**
   ```bash
   cat .claude/settings.json | jq .
   # If jq not installed: cat .claude/settings.json | python -m json.tool
   ```

3. **Test hook manually:**
   ```bash
   echo '{"tool_name":"Bash","tool_input":{"command":"ls"},"session_id":"test"}' | \
     uv run .claude/hooks/send_event.py --source-app test --event-type PreToolUse
   ```

**Common Causes:**

#### 1. Relative Paths Not Working

**Check:**
```bash
cat .claude/settings.json | grep "command"
```

**Solution:**
```bash
# Option 1: Use environment variable
# Replace: uv run .claude/hooks/send_event.py
# With:    uv run $CLAUDE_PROJECT_DIR/.claude/hooks/send_event.py

# Option 2: Use Claude's converter
/convert_paths_absolute

# Option 3: Use absolute paths manually
# Replace: uv run .claude/hooks/send_event.py
# With:    uv run /full/path/to/project/.claude/hooks/send_event.py
```

#### 2. Script Not Executable

**Check:**
```bash
ls -l .claude/hooks/*.py
# Should show: -rwxr-xr-x (x = executable)
```

**Solution:**
```bash
chmod +x .claude/hooks/*.py
```

#### 3. uv Not in PATH

**Check:**
```bash
which uv
```

**Solution:**
```bash
# Add to PATH
export PATH="$HOME/.local/bin:$PATH"

# Or use full path in settings.json
# Replace: uv run
# With:    ~/.local/bin/uv run
```

#### 4. Python Dependencies Missing

**Check:**
```bash
uv run .claude/hooks/send_event.py --help
# If it installs packages, dependencies are missing
```

**Solution:**
```bash
# uv automatically installs dependencies
# If it fails, check internet connection
ping pypi.org
```

---

### Hooks Blocking Claude

**Symptom**: Claude freezes or shows "Hook execution failed"

**Causes:**

1. **Hook exits with non-zero code**
2. **Hook hangs indefinitely**
3. **Hook crashes without exit**

**Diagnostic:**

```bash
# Test hook exit code
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"},"session_id":"test"}' | \
  uv run .claude/hooks/pre_tool_use.py
echo "Exit code: $?"
# Should be 2 for blocked, 0 for allowed
```

**Solutions:**

```python
# Fix 1: Always exit with 0 for observability
try:
    send_event(event)
except Exception as e:
    print(f"Failed: {e}", file=sys.stderr)
finally:
    sys.exit(0)  # Don't block Claude

# Fix 2: Add timeout for network calls
import urllib.request
try:
    with urllib.request.urlopen(url, timeout=5) as response:
        data = response.read()
except Exception as e:
    print(f"Timeout: {e}", file=sys.stderr)

# Fix 3: Catch all exceptions
try:
    main()
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(0)
```

---

### Hook Executes But No Events Appear

**Symptom**: Hook runs (visible in logs) but events don't show in dashboard

**Diagnostic Steps:**

1. **Check server received event:**
   ```bash
   # Watch server logs
   cd apps/server
   bun run dev
   # Look for POST /events
   ```

2. **Check event structure:**
   ```bash
   # Manual test
   curl -X POST http://localhost:4000/events \
     -H "Content-Type: application/json" \
     -d '{"source_app":"test","session_id":"test","hook_event_type":"PreToolUse","payload":{}}'
   # Should return: {"id":...}
   ```

3. **Check required fields:**
   ```python
   # In send_event.py, verify:
   event_data = {
       'source_app': args.source_app,      # Required
       'session_id': session_id,            # Required
       'hook_event_type': args.event_type,  # Required
       'payload': input_data,               # Required
       'timestamp': int(datetime.now().timestamp() * 1000)
   }
   ```

**Solutions:**

```bash
# 1. Add debug logging
# Edit .claude/hooks/send_event.py
print(f"Sending event: {json.dumps(event_data)}", file=sys.stderr)
success = send_event_to_server(event_data)
print(f"Send result: {success}", file=sys.stderr)

# 2. Check server URL
# In send_event.py, verify:
SERVER_URL = 'http://localhost:4000/events'  # Correct
# Not: http://localhost:4000                 # Incorrect

# 3. Restart both server and client
./scripts/reset-system.sh
./scripts/start-system.sh
```

---

## Events Not Appearing

### Events Sent But Not Visible

**Symptom**: Server receives events (logs show POST requests) but dashboard is empty

**Diagnostic Steps:**

1. **Check WebSocket connection:**
   ```javascript
   // Browser console (F12)
   // Network tab → WS → should show connection to ws://localhost:4000/stream
   ```

2. **Check database:**
   ```bash
   cd apps/server
   sqlite3 events.db "SELECT COUNT(*) FROM events;"
   # Should show > 0
   ```

3. **Check client filters:**
   - Open dashboard
   - Look at filter panel
   - Ensure "Select All" is checked

**Solutions:**

```bash
# 1. Clear filters in UI
# Click "Select All" for each filter category

# 2. Check WebSocket in browser
# F12 → Console
# Look for: "Connected to event stream" or "WebSocket error"

# 3. Restart WebSocket connection
# Refresh browser page (F5)

# 4. Check for JavaScript errors
# F12 → Console → Look for errors

# 5. Clear browser cache
# F12 → Application → Clear storage
```

---

### Old Events Not Loading

**Symptom**: New events appear, but history is empty

**Cause**: Database or initial load issue

**Solutions:**

```bash
# 1. Check database has events
cd apps/server
sqlite3 events.db "SELECT COUNT(*) FROM events;"

# 2. Check initial WebSocket message
# F12 → Network → WS → Messages
# Should see: {"type":"initial","data":[...]}

# 3. Increase event limit
# Edit apps/client/.env
VITE_MAX_EVENTS_TO_DISPLAY=300

# 4. Check server recent events endpoint
curl http://localhost:4000/events/recent?limit=10
```

---

## WebSocket Issues

### WebSocket Keeps Disconnecting

**Symptom**: "Reconnecting..." message appears frequently

**Diagnostic Steps:**

1. **Check connection in browser:**
   ```javascript
   // F12 → Console
   // Look for: "WebSocket disconnected" messages
   ```

2. **Check server logs:**
   ```bash
   # Server terminal
   # Look for: "WebSocket error" or "WebSocket client disconnected"
   ```

3. **Test WebSocket directly:**
   ```bash
   # Install wscat
   npm install -g wscat

   # Test connection
   wscat -c ws://localhost:4000/stream
   # Should connect and receive messages
   ```

**Common Causes:**

#### 1. Server Restart

**Solution**: Client will auto-reconnect. Wait 30 seconds.

#### 2. Network Issues

**Check:**
```bash
ping localhost
```

**Solution**: Check firewall settings.

#### 3. Too Many Connections

**Check:**
```bash
# Server logs should show connection count
```

**Solution**: Close other browser tabs.

#### 4. Browser Tab Inactive

**Solution**: Keep tab active. Browsers throttle inactive tabs.

---

### WebSocket Not Connecting at All

**Symptom**: "Disconnected" status, never connects

**Diagnostic Steps:**

1. **Verify WebSocket endpoint:**
   ```bash
   curl -i -N \
     -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Host: localhost:4000" \
     -H "Origin: http://localhost:5173" \
     http://localhost:4000/stream
   # Should return: 101 Switching Protocols
   ```

2. **Check client WebSocket URL:**
   ```javascript
   // apps/client/src/App.vue
   const WS_URL = 'ws://localhost:4000/stream';
   ```

3. **Check server WebSocket config:**
   ```typescript
   // apps/server/src/index.ts
   if (url.pathname === '/stream') {
     const success = server.upgrade(req);
     // ...
   }
   ```

**Solutions:**

```bash
# 1. Verify URL matches
# Client: ws://localhost:4000/stream
# Server: Listening on port 4000

# 2. Check for HTTPS/WSS mismatch
# Local dev should use: ws:// (not wss://)

# 3. Restart both services
./scripts/reset-system.sh
./scripts/start-system.sh

# 4. Check browser console for specific error
# F12 → Console → Look for WebSocket error details
```

---

## Database Problems

### Database Locked

**Symptom**: "database is locked" error

**Cause**: Multiple processes accessing database simultaneously

**Solution:**

```bash
cd apps/server

# 1. Stop all processes
./scripts/reset-system.sh

# 2. Remove lock files
rm -f events.db-shm events.db-wal

# 3. Verify no processes are using it
lsof events.db

# 4. Restart
bun run dev
```

---

### Database Corrupted

**Symptom**: "database disk image is malformed"

**Diagnostic:**
```bash
cd apps/server
sqlite3 events.db "PRAGMA integrity_check;"
```

**Solutions:**

```bash
# Option 1: Export and reimport
sqlite3 events.db ".dump" > backup.sql
rm events.db
sqlite3 events.db < backup.sql

# Option 2: Start fresh (CAUTION: loses data)
rm events.db events.db-shm events.db-wal
bun run dev  # Will recreate database

# Option 3: Recover what you can
sqlite3 events.db ".recover" | sqlite3 recovered.db
mv events.db events.db.corrupted
mv recovered.db events.db
```

---

### Database Too Large

**Symptom**: Slow performance, large file size

**Check Size:**
```bash
cd apps/server
ls -lh events.db
# If > 100MB, consider cleaning
```

**Solution:**

```bash
# 1. Count events
sqlite3 events.db "SELECT COUNT(*) FROM events;"

# 2. Delete old events (keep last 7 days)
sqlite3 events.db "DELETE FROM events WHERE timestamp < (strftime('%s', 'now') - 604800) * 1000;"

# 3. Vacuum to reclaim space
sqlite3 events.db "VACUUM;"

# 4. Check new size
ls -lh events.db
```

---

## Performance Issues

### Slow Event Loading

**Symptom**: Dashboard takes long to load events

**Diagnostic:**

```bash
# 1. Check event count
cd apps/server
sqlite3 events.db "SELECT COUNT(*) FROM events;"

# 2. Check database indexes
sqlite3 events.db ".schema events"
# Should show indexes
```

**Solutions:**

```bash
# 1. Reduce max events
# Edit apps/client/.env
VITE_MAX_EVENTS_TO_DISPLAY=50  # Reduce from 100

# 2. Clean old events
sqlite3 events.db "DELETE FROM events WHERE timestamp < (strftime('%s', 'now') - 86400) * 1000;"

# 3. Rebuild indexes
sqlite3 events.db "REINDEX;"

# 4. Analyze database
sqlite3 events.db "ANALYZE;"
```

---

### High CPU Usage

**Symptom**: Fan running, system slow

**Diagnostic:**

```bash
# 1. Check process CPU
top -pid $(pgrep -f "bun.*server")
top -pid $(pgrep -f "bun.*client")

# 2. Check event frequency
# Dashboard → Count events in last minute
```

**Solutions:**

```bash
# 1. Reduce hook frequency
# Disable PostToolUse if not needed
# Edit .claude/settings.json, remove PostToolUse section

# 2. Disable AI summarization
# Remove --summarize flag from hooks

# 3. Limit WebSocket updates
# Edit apps/server/src/index.ts
# Add debouncing to broadcasts

# 4. Restart services
./scripts/reset-system.sh
./scripts/start-system.sh
```

---

### Memory Leaks

**Symptom**: Memory usage increases over time

**Diagnostic:**

```bash
# Monitor memory
watch -n 1 'ps aux | grep bun'
```

**Solutions:**

```bash
# 1. Limit stored events
# Edit apps/client/.env
VITE_MAX_EVENTS_TO_DISPLAY=50

# 2. Restart periodically
# Add to cron
0 */6 * * * cd /path/to/project && ./scripts/reset-system.sh && ./scripts/start-system.sh

# 3. Clear old events
# Run daily
sqlite3 events.db "DELETE FROM events WHERE timestamp < (strftime('%s', 'now') - 604800) * 1000;"
```

---

## Debugging Techniques

### Enable Verbose Logging

**Server:**

```typescript
// apps/server/src/index.ts

// Add at top
const DEBUG = true;

// Before each operation
if (DEBUG) console.log('[DEBUG] Received event:', event);
```

**Client:**

```javascript
// apps/client/src/composables/useWebSocket.ts

// Add logging
ws.onmessage = (event) => {
  console.log('[DEBUG] WebSocket message:', event.data);
  // ... rest of code
};
```

**Hooks:**

```python
# .claude/hooks/send_event.py

# Add at top
import sys
DEBUG = True

# Before operations
if DEBUG:
    print(f"[DEBUG] Event data: {json.dumps(event_data)}", file=sys.stderr)
```

---

### Trace Request Flow

**1. Hook Execution:**
```bash
# Add to hook
echo "[TRACE] Hook started" >&2
echo "[TRACE] Data: $input_data" >&2
echo "[TRACE] Hook completed" >&2
```

**2. Server Reception:**
```typescript
// index.ts
console.log('[TRACE] POST /events received');
console.log('[TRACE] Event data:', event);
console.log('[TRACE] Broadcasting to', wsClients.size, 'clients');
```

**3. Client Reception:**
```javascript
// useWebSocket.ts
console.log('[TRACE] WebSocket message received');
console.log('[TRACE] Event count:', events.value.length);
```

**4. UI Update:**
```vue
<!-- EventTimeline.vue -->
<template>
  <div>
    {{ console.log('[TRACE] Rendering', filteredEvents.length, 'events') }}
    <!-- ... -->
  </div>
</template>
```

---

### Network Traffic Analysis

**1. Chrome DevTools:**
- F12 → Network tab
- Filter: XHR (HTTP requests) or WS (WebSocket)
- Click request → Preview → See data

**2. Command Line:**
```bash
# Monitor HTTP traffic
sudo tcpdump -i lo0 -A 'tcp port 4000'

# Monitor WebSocket
wscat -c ws://localhost:4000/stream
```

---

## Error Messages

### "EADDRINUSE: address already in use"

**Cause**: Port is already occupied

**Solution:**
```bash
# Kill process on port
kill -9 $(lsof -ti :4000)

# Or use different port
SERVER_PORT=4001 ./scripts/start-system.sh
```

---

### "Cannot find module 'bun:sqlite'"

**Cause**: Wrong runtime (using Node instead of Bun)

**Solution:**
```bash
# Use bun, not node
bun run dev

# Check Bun is installed
bun --version
```

---

### "uv: command not found"

**Cause**: uv not installed or not in PATH

**Solution:**
```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Add to PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

---

### "Failed to parse JSON input"

**Cause**: Hook receiving invalid JSON from Claude Code

**Solution:**
```bash
# Test hook with valid JSON
echo '{"tool_name":"Bash","tool_input":{"command":"ls"},"session_id":"test"}' | \
  uv run .claude/hooks/send_event.py --source-app test --event-type PreToolUse

# Add error handling
try:
    data = json.load(sys.stdin)
except json.JSONDecodeError as e:
    print(f"Invalid JSON: {e}", file=sys.stderr)
    sys.exit(0)  # Don't block
```

---

### "WebSocket connection failed"

**Cause**: Server not running or wrong URL

**Solution:**
```bash
# 1. Verify server is running
curl http://localhost:4000/events/filter-options

# 2. Check WebSocket URL
# Should be: ws://localhost:4000/stream
# Not: wss:// or http://

# 3. Restart server
./scripts/reset-system.sh
./scripts/start-system.sh
```

---

## FAQ

### Q: Events only appear after refreshing the page

**A**: WebSocket not connected. Check browser console (F12) for errors.

```bash
# Fix
./scripts/reset-system.sh
./scripts/start-system.sh
# Refresh browser
```

---

### Q: Some hooks work, others don't

**A**: Check hook-specific configuration.

```bash
# Test each hook individually
echo '{}' | uv run .claude/hooks/pre_tool_use.py
echo '{}' | uv run .claude/hooks/post_tool_use.py
echo '{}' | uv run .claude/hooks/user_prompt_submit.py
```

---

### Q: Dashboard shows old events from days ago

**A**: Database retention. Events are stored permanently by default.

```bash
# Clear old events
cd apps/server
sqlite3 events.db "DELETE FROM events WHERE timestamp < (strftime('%s', 'now') - 86400) * 1000;"
```

---

### Q: Can I use this with multiple Claude Code windows?

**A**: Yes! Each window creates a unique session_id.

```bash
# Each session appears separately in dashboard
# Filter by session_id to focus on one
```

---

### Q: How do I backup my events?

**A**: Export database.

```bash
cd apps/server

# Option 1: Copy database file
cp events.db events.db.backup

# Option 2: SQL dump
sqlite3 events.db ".dump" > events_backup.sql

# Option 3: JSON export
sqlite3 events.db "SELECT json_group_array(json_object('id', id, 'source_app', source_app, 'session_id', session_id, 'hook_event_type', hook_event_type, 'timestamp', timestamp, 'payload', payload)) FROM events;" > events.json
```

---

### Q: Can I delete specific events?

**A**: Yes, use SQL.

```bash
cd apps/server

# Delete by source_app
sqlite3 events.db "DELETE FROM events WHERE source_app = 'test';"

# Delete by session_id
sqlite3 events.db "DELETE FROM events WHERE session_id = 'abc-123';"

# Delete by time range
sqlite3 events.db "DELETE FROM events WHERE timestamp BETWEEN 1705240800000 AND 1705244400000;"
```

---

## Getting Help

If you're still stuck:

1. **Check logs**:
   - Server: Terminal where `bun run dev` is running
   - Client: Browser console (F12)
   - Hooks: stderr output

2. **Run health check**: Use the script at the top of this guide

3. **Search existing issues**: [GitHub Issues](https://github.com/your-repo/issues)

4. **Create new issue**: Include:
   - Health check output
   - Error messages
   - Steps to reproduce
   - Environment (OS, versions)

5. **Ask on YouTube**: Comment on [tutorial videos](https://www.youtube.com/@indydevdan)

---

## Useful Commands

```bash
# Restart everything
./scripts/reset-system.sh && ./scripts/start-system.sh

# Check ports
lsof -i :4000  # Server
lsof -i :5173  # Client

# Test server
curl http://localhost:4000/events/filter-options

# Test WebSocket
wscat -c ws://localhost:4000/stream

# Test hook
echo '{"tool_name":"Bash","tool_input":{"command":"ls"},"session_id":"test"}' | uv run .claude/hooks/send_event.py --source-app test --event-type PreToolUse

# Database stats
cd apps/server
sqlite3 events.db "SELECT COUNT(*), hook_event_type FROM events GROUP BY hook_event_type;"

# Clear all events
sqlite3 events.db "DELETE FROM events;"

# Vacuum database
sqlite3 events.db "VACUUM;"
```

---

Still having issues? Don't give up! Check the other documentation files or reach out for help.
