# Roadmap: Multi-Agent Observability System

## Overview

This roadmap outlines planned features for the Multi-Agent Observability System. Each feature is designed with a dual purpose:

1. **User Education**: Help users understand AI agent behavior and agentic coding patterns
2. **Developer Education**: Teach essential patterns for building production agentic applications

All features leverage the existing event infrastructure and are designed as incremental enhancements.

---

## Feature Priority Matrix

| Feature | User Value | Dev Learning | Complexity | Priority |
|---------|-----------|--------------|------------|----------|
| Token Usage & Cost Tracking | High | High | Low | P0 |
| Tool Success/Failure Analytics | High | High | Low | P0 |
| Session Bookmarking & Tagging | Medium | Low | Low | P1 |
| Agent Performance Metrics | High | High | Medium | P1 |
| Event Pattern Detection | High | Medium | Medium | P1 |
| Webhook/Alert System | Medium | High | Low | P2 |
| Session Export & Reports | Medium | Medium | Medium | P2 |
| Session Comparison View | High | Medium | Medium | P2 |
| Decision Tree Visualization | High | High | High | P3 |
| Multi-Agent Collaboration | High | High | High | P3 |

---

## Feature Specifications

### 1. Token Usage & Cost Tracking

**Status**: Planned (P0)
**Estimated Effort**: 1-2 days

#### Description
Track and display token consumption and estimated API costs per session by parsing chat transcripts. Show cumulative costs across projects and sessions.

#### User Benefits
- Understand the real cost of different agentic patterns
- Compare cost efficiency between different prompts and approaches
- Budget and optimize for production usage
- Learn which operations are expensive vs cheap

#### Developer Learning Outcomes
- Token counting algorithms and estimation
- API cost modeling and pricing structures
- Real-time metric aggregation
- Cost optimization patterns for agentic systems

#### Implementation Details

**Database Changes:**
```sql
-- Add to events table or create new metrics table
ALTER TABLE events ADD COLUMN token_count INTEGER;
ALTER TABLE events ADD COLUMN estimated_cost REAL;

-- Session-level metrics
CREATE TABLE IF NOT EXISTS session_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  total_tokens INTEGER DEFAULT 0,
  total_cost REAL DEFAULT 0.0,
  message_count INTEGER DEFAULT 0,
  start_time TEXT,
  end_time TEXT,
  model_name TEXT,
  UNIQUE(source_app, session_id)
);

CREATE INDEX idx_session_metrics ON session_metrics(source_app, session_id);
```

**Backend API:**
```typescript
// apps/server/src/index.ts
GET /api/metrics/tokens?session_id=xxx&source_app=xxx
GET /api/metrics/costs/summary
GET /api/metrics/costs/by-project
```

**Token Extraction:**
```python
# .claude/hooks/token_counter.py
def count_tokens_in_transcript(chat_transcript):
    """Extract token counts from chat messages"""
    total_tokens = 0
    for message in chat_transcript:
        # Count using tiktoken or estimate
        if 'usage' in message:
            total_tokens += message['usage'].get('total_tokens', 0)
    return total_tokens

def estimate_cost(tokens, model_name):
    """Calculate estimated cost based on model pricing"""
    pricing = {
        'claude-sonnet-4-5': {'input': 0.003, 'output': 0.015},
        'claude-opus-4': {'input': 0.015, 'output': 0.075},
        'claude-haiku-4': {'input': 0.00025, 'output': 0.00125},
    }
    # Return estimated cost per 1K tokens
```

**UI Components:**
```vue
<!-- apps/client/src/components/CostMetricsDashboard.vue -->
<template>
  <div class="cost-metrics">
    <div class="metric-card">
      <h3>Session Cost</h3>
      <p class="cost">{{ formatCost(sessionCost) }}</p>
      <p class="tokens">{{ formatNumber(sessionTokens) }} tokens</p>
    </div>

    <div class="metric-card">
      <h3>Project Total</h3>
      <p class="cost">{{ formatCost(projectCost) }}</p>
    </div>

    <div class="cost-chart">
      <!-- Cost over time visualization -->
    </div>
  </div>
</template>
```

**Integration Points:**
- Hook into `send_event.py` to calculate tokens from chat_transcript
- Update session metrics on SessionEnd events
- Display cost widget in dashboard header
- Add cost column to event timeline (optional)

---

### 2. Agent Performance Metrics Dashboard

**Status**: Planned (P1)
**Estimated Effort**: 2-3 days

#### Description
Display key performance indicators: average response time, tools-per-task ratio, success/failure rates, and efficiency metrics across sessions and projects.

#### User Benefits
- Identify which agent approaches are most efficient
- Compare model performance (Sonnet vs Haiku vs Opus)
- Understand typical task completion patterns
- Optimize prompts based on measured performance

#### Developer Learning Outcomes
- Performance monitoring patterns for agentic systems
- Metric aggregation and computation strategies
- Time-series data handling
- Dashboard design for observability

#### Implementation Details

**Metrics to Track:**
1. **Response Time**: Time from UserPromptSubmit to Stop event
2. **Tools Per Task**: Average number of tool uses per user request
3. **Success Rate**: Percentage of tool uses that succeed
4. **Session Duration**: Total time from SessionStart to SessionEnd
5. **Tool Distribution**: Which tools are used most frequently
6. **Error Rate**: Percentage of events with errors
7. **Efficiency Score**: Tasks completed per minute

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,  -- 'response_time', 'tool_count', etc.
  metric_value REAL NOT NULL,
  measured_at TEXT DEFAULT (datetime('now')),
  metadata TEXT  -- JSON for additional context
);

CREATE INDEX idx_perf_metrics ON performance_metrics(source_app, session_id, metric_type);
```

**Backend Endpoints:**
```typescript
GET /api/metrics/performance/session/:sessionId
GET /api/metrics/performance/project/:sourceApp
GET /api/metrics/performance/comparison?sessions[]=id1&sessions[]=id2
GET /api/metrics/performance/trends?timeframe=7d
```

**Computation Logic:**
```typescript
// apps/server/src/metrics.ts
export function calculateSessionMetrics(events: Event[]) {
  const userPrompts = events.filter(e => e.hook_event_type === 'UserPromptSubmit');
  const stops = events.filter(e => e.hook_event_type === 'Stop');
  const toolUses = events.filter(e => e.hook_event_type === 'PreToolUse');

  const avgResponseTime = calculateAverageResponseTime(userPrompts, stops);
  const toolsPerTask = toolUses.length / userPrompts.length;
  const successRate = calculateSuccessRate(events);

  return {
    avgResponseTime,
    toolsPerTask,
    successRate,
    totalTasks: userPrompts.length,
    totalTools: toolUses.length
  };
}
```

**UI Components:**
```vue
<!-- apps/client/src/components/PerformanceMetricsDashboard.vue -->
<template>
  <div class="performance-dashboard">
    <div class="metrics-grid">
      <MetricCard
        title="Avg Response Time"
        :value="metrics.avgResponseTime"
        unit="seconds"
        icon="⚡"
      />
      <MetricCard
        title="Tools Per Task"
        :value="metrics.toolsPerTask"
        unit="tools"
        icon="🔧"
      />
      <MetricCard
        title="Success Rate"
        :value="metrics.successRate"
        unit="%"
        icon="✅"
      />
      <MetricCard
        title="Total Tasks"
        :value="metrics.totalTasks"
        icon="📋"
      />
    </div>

    <div class="charts">
      <PerformanceTrendChart :data="trendData" />
      <ToolDistributionChart :data="toolDistribution" />
    </div>
  </div>
</template>
```

---

### 3. Session Bookmarking & Tagging System

**Status**: Planned (P1)
**Estimated Effort**: 1-2 days

#### Description
Allow users to bookmark interesting sessions and add custom tags (e.g., "excellent-example", "bug-fix", "refactoring", "learning") for future reference.

#### User Benefits
- Build a personal library of learning examples
- Quickly find similar past sessions
- Organize sessions by task type or pattern
- Share interesting examples with others

#### Developer Learning Outcomes
- CRUD operations in full-stack applications
- Tag-based filtering and search
- User-generated metadata management
- Simple but effective organizational patterns

#### Implementation Details

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS session_bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  title TEXT,
  description TEXT,
  bookmarked_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_app, session_id)
);

CREATE TABLE IF NOT EXISTS session_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(source_app, session_id, tag)
);

CREATE INDEX idx_session_tags ON session_tags(tag);
CREATE INDEX idx_bookmark_sessions ON session_bookmarks(source_app, session_id);
```

**Backend API:**
```typescript
// Bookmark operations
POST   /api/bookmarks                    // Create bookmark
GET    /api/bookmarks                    // List all bookmarks
GET    /api/bookmarks/:sourceApp/:sessionId
PUT    /api/bookmarks/:id                // Update title/description
DELETE /api/bookmarks/:id

// Tag operations
POST   /api/tags                         // Add tag to session
GET    /api/tags                         // List all unique tags
GET    /api/tags/:tag/sessions           // Get sessions with tag
DELETE /api/tags/:id                     // Remove tag from session

// Search
GET    /api/sessions/search?q=keyword&tags[]=tag1&tags[]=tag2
```

**UI Components:**
```vue
<!-- apps/client/src/components/BookmarkButton.vue -->
<template>
  <button
    @click="toggleBookmark"
    :class="{ bookmarked: isBookmarked }"
    class="bookmark-btn"
  >
    {{ isBookmarked ? '⭐' : '☆' }} Bookmark
  </button>
</template>

<!-- apps/client/src/components/TagEditor.vue -->
<template>
  <div class="tag-editor">
    <div class="existing-tags">
      <span
        v-for="tag in tags"
        :key="tag.id"
        class="tag"
      >
        {{ tag.tag }}
        <button @click="removeTag(tag.id)">×</button>
      </span>
    </div>

    <input
      v-model="newTag"
      @keyup.enter="addTag"
      placeholder="Add tag..."
      class="tag-input"
    />
  </div>
</template>

<!-- apps/client/src/views/BookmarksView.vue -->
<template>
  <div class="bookmarks-view">
    <h2>Bookmarked Sessions</h2>

    <div class="filter-bar">
      <TagFilter v-model="selectedTags" :available-tags="allTags" />
      <SearchInput v-model="searchQuery" />
    </div>

    <div class="bookmarks-list">
      <BookmarkCard
        v-for="bookmark in filteredBookmarks"
        :key="bookmark.id"
        :bookmark="bookmark"
        @click="viewSession(bookmark)"
      />
    </div>
  </div>
</template>
```

**Features:**
- Star icon on each event row/session header
- Tag input with autocomplete from existing tags
- Bookmarks page with filtering by tags
- Search across bookmark titles and descriptions
- Export bookmarked sessions

---

### 4. Tool Success/Failure Analytics

**Status**: Planned (P0)
**Estimated Effort**: 1-2 days

#### Description
Track and visualize which tools (Bash, Read, Edit, Write, etc.) succeed or fail most often, including failure reasons and patterns.

#### User Benefits
- Understand agent reliability for different operations
- Identify common failure points in workflows
- Learn which tool combinations work best
- Recognize when to intervene manually

#### Developer Learning Outcomes
- Error tracking and classification in agentic systems
- Reliability metrics and patterns
- Failure analysis techniques
- Building robust error handling

#### Implementation Details

**Data Collection:**
```python
# .claude/hooks/post_tool_use.py enhancement
def analyze_tool_result(data):
    """Extract success/failure and reason"""
    tool_name = data.get('tool_name')
    tool_result = data.get('tool_output', {})

    # Determine success/failure
    is_error = 'error' in str(tool_result).lower()
    error_type = classify_error(tool_result) if is_error else None

    return {
        'tool_name': tool_name,
        'success': not is_error,
        'error_type': error_type,
        'error_message': extract_error_message(tool_result)
    }

def classify_error(result):
    """Categorize error types"""
    result_str = str(result).lower()

    if 'permission denied' in result_str:
        return 'permission_error'
    elif 'not found' in result_str or 'no such file' in result_str:
        return 'not_found_error'
    elif 'timeout' in result_str:
        return 'timeout_error'
    elif 'syntax error' in result_str:
        return 'syntax_error'
    else:
        return 'unknown_error'
```

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS tool_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_type TEXT,
  error_message TEXT,
  timestamp TEXT NOT NULL,
  event_id INTEGER,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX idx_tool_analytics ON tool_analytics(tool_name, success);
CREATE INDEX idx_tool_errors ON tool_analytics(error_type) WHERE success = 0;
```

**Backend API:**
```typescript
GET /api/analytics/tools/summary
GET /api/analytics/tools/:toolName/stats
GET /api/analytics/errors/by-type
GET /api/analytics/errors/recent?limit=20
```

**Response Example:**
```json
{
  "tool_summary": [
    {
      "tool_name": "Bash",
      "total_uses": 234,
      "successes": 198,
      "failures": 36,
      "success_rate": 84.6,
      "most_common_error": "permission_error"
    },
    {
      "tool_name": "Read",
      "total_uses": 456,
      "successes": 450,
      "failures": 6,
      "success_rate": 98.7,
      "most_common_error": "not_found_error"
    }
  ]
}
```

**UI Components:**
```vue
<!-- apps/client/src/components/ToolAnalyticsDashboard.vue -->
<template>
  <div class="tool-analytics">
    <h2>Tool Reliability Analysis</h2>

    <div class="tool-grid">
      <div
        v-for="tool in toolStats"
        :key="tool.tool_name"
        class="tool-card"
      >
        <div class="tool-header">
          <span class="tool-icon">{{ getToolIcon(tool.tool_name) }}</span>
          <h3>{{ tool.tool_name }}</h3>
        </div>

        <div class="tool-stats">
          <div class="success-rate">
            <CircularProgress :value="tool.success_rate" />
            <span>{{ tool.success_rate.toFixed(1) }}% success</span>
          </div>

          <div class="usage-stats">
            <p>{{ tool.total_uses }} uses</p>
            <p class="failures">{{ tool.failures }} failures</p>
          </div>

          <div v-if="tool.failures > 0" class="common-errors">
            <p class="error-type">
              Most common: {{ formatErrorType(tool.most_common_error) }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="error-trends">
      <h3>Error Trends</h3>
      <ErrorTrendChart :data="errorTrends" />
    </div>

    <div class="recent-failures">
      <h3>Recent Failures</h3>
      <FailureList :failures="recentFailures" />
    </div>
  </div>
</template>
```

**Visualizations:**
- Success rate gauge per tool
- Error distribution pie chart
- Failure timeline
- Most common error messages
- Tool reliability rankings

---

### 5. Event Pattern Detection & Insights

**Status**: Planned (P1)
**Estimated Effort**: 2-3 days

#### Description
Automatically detect and highlight common patterns in agent behavior, such as "always reads before editing", "uses grep before read", or "retries after failure".

#### User Benefits
- Learn best practices from observed agent patterns
- Understand common workflows and sequences
- Identify anti-patterns and inefficiencies
- Get insights into agent decision-making logic

#### Developer Learning Outcomes
- Sequence pattern matching algorithms
- Workflow analysis in agentic systems
- Pattern recognition and classification
- Insight generation from behavioral data

#### Implementation Details

**Pattern Definitions:**
```typescript
// apps/server/src/patterns.ts
interface Pattern {
  id: string;
  name: string;
  description: string;
  sequence: string[];  // Event types or tool names
  minOccurrences: number;
  insight: string;
}

const KNOWN_PATTERNS: Pattern[] = [
  {
    id: 'read-before-edit',
    name: 'Read Before Edit',
    description: 'Agent reads file before modifying it',
    sequence: ['Read', 'Edit'],
    minOccurrences: 3,
    insight: 'Good practice: Reading files before editing reduces errors'
  },
  {
    id: 'grep-then-read',
    name: 'Search Then Read',
    description: 'Agent searches for content before reading specific files',
    sequence: ['Grep', 'Read'],
    minOccurrences: 2,
    insight: 'Efficient pattern: Searching narrows down which files to read'
  },
  {
    id: 'edit-then-bash',
    name: 'Edit Then Test',
    description: 'Agent edits code then runs tests/verification',
    sequence: ['Edit', 'Bash'],
    minOccurrences: 2,
    insight: 'Best practice: Verifying changes after editing'
  },
  {
    id: 'triple-tool-retry',
    name: 'Retry Pattern',
    description: 'Agent retries the same tool multiple times',
    sequence: ['[SAME_TOOL]', '[SAME_TOOL]', '[SAME_TOOL]'],
    minOccurrences: 1,
    insight: 'Warning: Repeated retries may indicate a stuck agent'
  },
  {
    id: 'glob-read-edit',
    name: 'Find-Read-Modify',
    description: 'Complete workflow: find files, read them, then edit',
    sequence: ['Glob', 'Read', 'Edit'],
    minOccurrences: 2,
    insight: 'Complete workflow: Systematic approach to file modification'
  },
  {
    id: 'write-without-read',
    name: 'Write Without Read',
    description: 'Agent writes to file without reading it first',
    sequence: ['Write'],  // Without preceding Read
    minOccurrences: 3,
    insight: 'Caution: Writing without reading may overwrite content'
  }
];
```

**Pattern Detection Algorithm:**
```typescript
export function detectPatterns(events: Event[]): DetectedPattern[] {
  const toolSequence = events
    .filter(e => e.hook_event_type === 'PreToolUse')
    .map(e => JSON.parse(e.payload).tool_name);

  const detected: DetectedPattern[] = [];

  for (const pattern of KNOWN_PATTERNS) {
    const occurrences = findSequenceOccurrences(toolSequence, pattern.sequence);

    if (occurrences.length >= pattern.minOccurrences) {
      detected.push({
        pattern: pattern,
        occurrences: occurrences.length,
        examples: occurrences.slice(0, 3),  // First 3 examples
        confidence: calculateConfidence(occurrences.length, pattern.minOccurrences)
      });
    }
  }

  return detected.sort((a, b) => b.occurrences - a.occurrences);
}

function findSequenceOccurrences(sequence: string[], pattern: string[]): number[][] {
  const matches: number[][] = [];

  for (let i = 0; i <= sequence.length - pattern.length; i++) {
    let match = true;
    const matchIndices: number[] = [];

    for (let j = 0; j < pattern.length; j++) {
      if (pattern[j] === '[SAME_TOOL]') {
        // Check if next tool is same as current
        if (i + j + 1 < sequence.length && sequence[i + j] !== sequence[i + j + 1]) {
          match = false;
          break;
        }
      } else if (sequence[i + j] !== pattern[j]) {
        match = false;
        break;
      }
      matchIndices.push(i + j);
    }

    if (match) {
      matches.push(matchIndices);
    }
  }

  return matches;
}
```

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS detected_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_app TEXT NOT NULL,
  session_id TEXT NOT NULL,
  pattern_id TEXT NOT NULL,
  occurrences INTEGER NOT NULL,
  detected_at TEXT DEFAULT (datetime('now')),
  examples TEXT,  -- JSON array of example indices
  UNIQUE(source_app, session_id, pattern_id)
);

CREATE INDEX idx_patterns ON detected_patterns(pattern_id, occurrences);
```

**Backend API:**
```typescript
GET /api/patterns/session/:sessionId          // Patterns in specific session
GET /api/patterns/trending                    // Most common patterns across all sessions
GET /api/patterns/by-app/:sourceApp          // Patterns for a specific project
POST /api/patterns/analyze/:sessionId        // Trigger pattern analysis
```

**UI Components:**
```vue
<!-- apps/client/src/components/PatternInsights.vue -->
<template>
  <div class="pattern-insights">
    <h2>🔍 Detected Patterns & Insights</h2>

    <div v-if="patterns.length === 0" class="no-patterns">
      <p>No significant patterns detected yet. Continue working to build insights.</p>
    </div>

    <div v-else class="patterns-list">
      <div
        v-for="detected in patterns"
        :key="detected.pattern.id"
        class="pattern-card"
        :class="getPatternClass(detected.pattern.id)"
      >
        <div class="pattern-header">
          <h3>{{ detected.pattern.name }}</h3>
          <span class="badge">{{ detected.occurrences }}× detected</span>
        </div>

        <p class="description">{{ detected.pattern.description }}</p>

        <div class="sequence-visual">
          <span
            v-for="(step, idx) in detected.pattern.sequence"
            :key="idx"
            class="sequence-step"
          >
            {{ getToolIcon(step) }} {{ step }}
            <span v-if="idx < detected.pattern.sequence.length - 1" class="arrow">→</span>
          </span>
        </div>

        <div class="insight" :class="getInsightType(detected.pattern.id)">
          <span class="insight-icon">{{ getInsightIcon(detected.pattern.id) }}</span>
          <p>{{ detected.pattern.insight }}</p>
        </div>

        <button @click="showExamples(detected)" class="view-examples">
          View Examples
        </button>
      </div>
    </div>

    <div class="pattern-summary">
      <h3>Session Summary</h3>
      <p>Most common pattern: <strong>{{ topPattern?.pattern.name }}</strong></p>
      <p>Pattern diversity: {{ patterns.length }} unique patterns</p>
    </div>
  </div>
</template>

<script setup lang="ts">
function getPatternClass(patternId: string): string {
  if (patternId.includes('warning') || patternId.includes('retry')) {
    return 'warning-pattern';
  }
  if (patternId.includes('best') || patternId.includes('good')) {
    return 'positive-pattern';
  }
  return 'neutral-pattern';
}

function getInsightType(patternId: string): string {
  if (patternId.includes('warning') || patternId.includes('caution')) {
    return 'warning';
  }
  if (patternId.includes('best') || patternId.includes('good')) {
    return 'success';
  }
  return 'info';
}

function getInsightIcon(patternId: string): string {
  const type = getInsightType(patternId);
  const icons = {
    warning: '⚠️',
    success: '✅',
    info: '💡'
  };
  return icons[type] || '💡';
}
</script>
```

**Pattern Visualization:**
- Visual sequence diagram with arrows
- Color-coded insights (green for best practices, yellow for warnings)
- Examples with direct links to events
- Trend analysis over time

---

### 6. Webhook/Alert System for Critical Events

**Status**: Planned (P2)
**Estimated Effort**: 1-2 days

#### Description
Configure webhooks and notifications to trigger when specific events occur (dangerous commands blocked, errors encountered, sessions ending, etc.).

#### User Benefits
- Get notified of critical events in real-time
- Integrate with Slack, Discord, email, or custom systems
- Set up monitoring for production agentic systems
- Learn about event-driven architectures

#### Developer Learning Outcomes
- Webhook implementation patterns
- Event-driven integration architecture
- Notification systems for observability
- Production monitoring for agentic apps

#### Implementation Details

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  event_type TEXT NOT NULL,  -- 'PreToolUse', 'Stop', 'Error', '*' for all
  source_app TEXT,           -- Optional: filter by app
  enabled BOOLEAN DEFAULT 1,
  secret TEXT,               -- For signature verification
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  webhook_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  status TEXT NOT NULL,      -- 'pending', 'success', 'failed'
  response_code INTEGER,
  response_body TEXT,
  attempted_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX idx_webhook_deliveries ON webhook_deliveries(webhook_id, status);
```

**Webhook Configuration:**
```typescript
interface WebhookConfig {
  id: number;
  name: string;
  url: string;
  eventType: string;
  sourceApp?: string;
  enabled: boolean;
  secret?: string;
  filters?: {
    toolNames?: string[];      // Only trigger for specific tools
    errorTypes?: string[];     // Only trigger for specific errors
    sessionIds?: string[];     // Only trigger for specific sessions
  };
}
```

**Backend API:**
```typescript
// Webhook management
POST   /api/webhooks                     // Create webhook
GET    /api/webhooks                     // List all webhooks
GET    /api/webhooks/:id                 // Get webhook details
PUT    /api/webhooks/:id                 // Update webhook
DELETE /api/webhooks/:id                 // Delete webhook
POST   /api/webhooks/:id/test            // Send test payload

// Delivery logs
GET    /api/webhooks/:id/deliveries      // Get delivery history
POST   /api/webhooks/:id/retry/:deliveryId  // Retry failed delivery
```

**Webhook Delivery:**
```typescript
// apps/server/src/webhooks.ts
import crypto from 'crypto';

export async function deliverWebhook(
  webhook: WebhookConfig,
  event: Event
): Promise<WebhookDelivery> {
  const payload = {
    webhook_id: webhook.id,
    event_id: event.id,
    event_type: event.hook_event_type,
    source_app: event.source_app,
    session_id: event.session_id,
    timestamp: event.timestamp,
    payload: event.payload,
    delivered_at: new Date().toISOString()
  };

  const signature = webhook.secret
    ? generateSignature(payload, webhook.secret)
    : undefined;

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature || '',
        'X-Event-Type': event.hook_event_type,
        'User-Agent': 'MultiAgentObservability/1.0'
      },
      body: JSON.stringify(payload)
    });

    return {
      webhook_id: webhook.id,
      event_id: event.id,
      status: response.ok ? 'success' : 'failed',
      response_code: response.status,
      response_body: await response.text()
    };
  } catch (error) {
    return {
      webhook_id: webhook.id,
      event_id: event.id,
      status: 'failed',
      response_code: 0,
      response_body: error.message
    };
  }
}

function generateSignature(payload: any, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return `sha256=${hmac.digest('hex')}`;
}

// Event handler integration
export async function onEventCreated(event: Event) {
  const webhooks = await db.getWebhooksForEvent(event.hook_event_type, event.source_app);

  for (const webhook of webhooks) {
    if (!webhook.enabled) continue;

    // Apply filters
    if (!matchesFilters(event, webhook.filters)) continue;

    // Deliver asynchronously
    deliverWebhook(webhook, event).then(delivery => {
      db.saveWebhookDelivery(delivery);
    });
  }
}
```

**UI Components:**
```vue
<!-- apps/client/src/components/WebhookManager.vue -->
<template>
  <div class="webhook-manager">
    <div class="header">
      <h2>⚡ Webhooks & Alerts</h2>
      <button @click="showCreateDialog = true" class="btn-primary">
        + New Webhook
      </button>
    </div>

    <div class="webhooks-list">
      <div
        v-for="webhook in webhooks"
        :key="webhook.id"
        class="webhook-card"
      >
        <div class="webhook-header">
          <h3>{{ webhook.name }}</h3>
          <toggle-switch v-model="webhook.enabled" @change="updateWebhook(webhook)" />
        </div>

        <div class="webhook-details">
          <p><strong>URL:</strong> {{ webhook.url }}</p>
          <p><strong>Event Type:</strong> {{ webhook.event_type }}</p>
          <p v-if="webhook.source_app">
            <strong>Source App:</strong> {{ webhook.source_app }}
          </p>
        </div>

        <div class="webhook-stats">
          <span class="stat success">
            ✅ {{ webhook.success_count }} successful
          </span>
          <span class="stat failed">
            ❌ {{ webhook.failed_count }} failed
          </span>
        </div>

        <div class="webhook-actions">
          <button @click="testWebhook(webhook)" class="btn-secondary">
            Test
          </button>
          <button @click="viewDeliveries(webhook)" class="btn-secondary">
            View Deliveries
          </button>
          <button @click="editWebhook(webhook)" class="btn-secondary">
            Edit
          </button>
          <button @click="deleteWebhook(webhook)" class="btn-danger">
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Create/Edit Dialog -->
    <WebhookDialog
      v-if="showCreateDialog"
      @close="showCreateDialog = false"
      @save="saveWebhook"
    />
  </div>
</template>
```

**Pre-built Integrations:**
```typescript
// Common webhook templates
export const WEBHOOK_TEMPLATES = {
  slack: {
    name: 'Slack Notification',
    transformPayload: (event) => ({
      text: `Agent Event: ${event.hook_event_type}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${event.hook_event_type}* in ${event.source_app}`
          }
        }
      ]
    })
  },
  discord: {
    name: 'Discord Notification',
    transformPayload: (event) => ({
      content: `Agent event detected`,
      embeds: [{
        title: event.hook_event_type,
        description: `Session: ${event.session_id}`,
        color: getColorForEventType(event.hook_event_type)
      }]
    })
  }
};
```

**Example Use Cases:**
1. Slack notification when dangerous command is blocked
2. Email alert when session encounters repeated errors
3. Discord notification when long-running session completes
4. Custom analytics pipeline integration
5. Production monitoring alerts

---

### 7. Session Export & Report Generation

**Status**: Planned (P2)
**Estimated Effort**: 2-3 days

#### Description
Generate comprehensive, shareable reports of entire sessions in multiple formats (Markdown, JSON, PDF, HTML) for documentation, teaching, or debugging.

#### User Benefits
- Document learning examples and case studies
- Share interesting sessions with colleagues
- Create training materials from real sessions
- Generate debugging reports for issues

#### Developer Learning Outcomes
- Report generation patterns and templating
- Multi-format export strategies
- Data transformation and presentation
- Documentation automation

#### Implementation Details

**Export Formats:**
1. **Markdown**: Human-readable, great for documentation
2. **JSON**: Machine-readable, for programmatic analysis
3. **HTML**: Interactive standalone reports
4. **PDF**: Professional presentation format (optional)

**Backend API:**
```typescript
GET /api/export/session/:sessionId?format=markdown
GET /api/export/session/:sessionId?format=json
GET /api/export/session/:sessionId?format=html
GET /api/export/sessions/bulk?ids[]=id1&ids[]=id2&format=markdown

// Report templates
GET /api/export/templates
POST /api/export/session/:sessionId/custom  // With custom template
```

**Markdown Template:**
```typescript
// apps/server/src/exporters/markdown.ts
export function generateMarkdownReport(session: SessionData): string {
  const { events, metrics, patterns } = session;

  return `
# Session Report: ${session.source_app}

**Session ID:** ${session.session_id}
**Start Time:** ${session.start_time}
**End Time:** ${session.end_time}
**Duration:** ${session.duration}
**Model:** ${session.model_name}

---

## Summary

- **Total Events:** ${events.length}
- **User Prompts:** ${metrics.prompt_count}
- **Tools Used:** ${metrics.tool_count}
- **Success Rate:** ${metrics.success_rate}%
- **Total Cost:** $${metrics.total_cost.toFixed(4)}

---

## Detected Patterns

${patterns.map(p => `
### ${p.pattern.name}
${p.pattern.description}

**Occurrences:** ${p.occurrences}
**Insight:** ${p.pattern.insight}
`).join('\n')}

---

## Event Timeline

${events.map((event, idx) => `
### ${idx + 1}. ${event.hook_event_type} - ${formatTime(event.timestamp)}

${formatEventDetails(event)}

${event.summary ? `**AI Summary:** ${event.summary}` : ''}

---
`).join('\n')}

## Chat Transcript

${formatChatTranscript(session.chat_transcript)}

---

*Generated by Multi-Agent Observability System*
*Timestamp: ${new Date().toISOString()}*
  `.trim();
}
```

**JSON Export:**
```typescript
export function generateJSONReport(session: SessionData): object {
  return {
    metadata: {
      source_app: session.source_app,
      session_id: session.session_id,
      start_time: session.start_time,
      end_time: session.end_time,
      duration_ms: session.duration,
      model_name: session.model_name,
      exported_at: new Date().toISOString()
    },
    metrics: {
      total_events: session.events.length,
      prompt_count: session.metrics.prompt_count,
      tool_count: session.metrics.tool_count,
      success_rate: session.metrics.success_rate,
      total_tokens: session.metrics.total_tokens,
      total_cost: session.metrics.total_cost
    },
    patterns: session.patterns,
    events: session.events.map(e => ({
      id: e.id,
      type: e.hook_event_type,
      timestamp: e.timestamp,
      payload: JSON.parse(e.payload),
      summary: e.summary
    })),
    chat_transcript: session.chat_transcript,
    bookmarks: session.bookmarks,
    tags: session.tags
  };
}
```

**HTML Template:**
```typescript
export function generateHTMLReport(session: SessionData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Session Report: ${session.source_app}</title>
  <style>
    ${getReportStyles()}
  </style>
</head>
<body>
  <div class="report-container">
    <header>
      <h1>Session Report</h1>
      <div class="metadata">
        <span class="app-name">${session.source_app}</span>
        <span class="session-id">${session.session_id}</span>
      </div>
    </header>

    <section class="summary">
      <h2>Summary</h2>
      ${generateSummaryHTML(session.metrics)}
    </section>

    <section class="patterns">
      <h2>Detected Patterns</h2>
      ${generatePatternsHTML(session.patterns)}
    </section>

    <section class="timeline">
      <h2>Event Timeline</h2>
      ${generateTimelineHTML(session.events)}
    </section>

    <section class="transcript">
      <h2>Chat Transcript</h2>
      ${generateTranscriptHTML(session.chat_transcript)}
    </section>
  </div>

  <script>
    ${getInteractiveScripts()}
  </script>
</body>
</html>
  `;
}
```

**UI Components:**
```vue
<!-- apps/client/src/components/ExportDialog.vue -->
<template>
  <dialog-modal v-if="visible" @close="$emit('close')">
    <h2>Export Session Report</h2>

    <div class="export-options">
      <div class="format-selector">
        <h3>Select Format</h3>
        <div class="format-options">
          <label class="format-option">
            <input type="radio" v-model="selectedFormat" value="markdown" />
            <span class="format-icon">📝</span>
            <span>Markdown</span>
            <p class="format-desc">Human-readable documentation format</p>
          </label>

          <label class="format-option">
            <input type="radio" v-model="selectedFormat" value="json" />
            <span class="format-icon">{ }</span>
            <span>JSON</span>
            <p class="format-desc">Machine-readable data format</p>
          </label>

          <label class="format-option">
            <input type="radio" v-model="selectedFormat" value="html" />
            <span class="format-icon">🌐</span>
            <span>HTML</span>
            <p class="format-desc">Interactive standalone report</p>
          </label>
        </div>
      </div>

      <div class="export-settings">
        <h3>Include</h3>
        <label>
          <input type="checkbox" v-model="includeChat" />
          Chat Transcript
        </label>
        <label>
          <input type="checkbox" v-model="includeMetrics" />
          Performance Metrics
        </label>
        <label>
          <input type="checkbox" v-model="includePatterns" />
          Detected Patterns
        </label>
        <label>
          <input type="checkbox" v-model="includeAnalytics" />
          Tool Analytics
        </label>
      </div>
    </div>

    <div class="actions">
      <button @click="downloadReport" class="btn-primary">
        Download Report
      </button>
      <button @click="copyToClipboard" class="btn-secondary">
        Copy to Clipboard
      </button>
      <button @click="previewReport" class="btn-secondary">
        Preview
      </button>
    </div>
  </dialog-modal>
</template>

<script setup lang="ts">
async function downloadReport() {
  const url = `/api/export/session/${props.sessionId}?format=${selectedFormat.value}`;
  const params = new URLSearchParams({
    includeChat: includeChat.value.toString(),
    includeMetrics: includeMetrics.value.toString(),
    includePatterns: includePatterns.value.toString()
  });

  const response = await fetch(`${url}&${params}`);
  const blob = await response.blob();

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `session-${props.sessionId}.${selectedFormat.value}`;
  link.click();
}
</script>
```

**Bulk Export:**
```typescript
// Export multiple sessions at once
POST /api/export/bulk
{
  "session_ids": ["id1", "id2", "id3"],
  "format": "markdown",
  "options": {
    "combine": true,        // Single file or separate files
    "include_index": true,  // Add index/table of contents
    "include_comparison": true  // Add comparison section
  }
}
```

---

### 8. Session Comparison View

**Status**: Planned (P2)
**Estimated Effort**: 2-3 days

#### Description
Side-by-side comparison of two or more sessions to analyze different approaches to similar tasks, compare model performance, or study prompt variations.

#### User Benefits
- Compare how different prompts affect agent behavior
- Evaluate model performance (Sonnet vs Haiku vs Opus)
- Learn from A/B testing different approaches
- Identify the most efficient workflow patterns

#### Developer Learning Outcomes
- A/B testing patterns for agentic systems
- Comparative analysis UI design
- Metrics comparison and visualization
- Multi-session data correlation

#### Implementation Details

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS session_comparisons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  session_ids TEXT NOT NULL,  -- JSON array
  created_at TEXT DEFAULT (datetime('now')),
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS comparison_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comparison_id INTEGER NOT NULL,
  note TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (comparison_id) REFERENCES session_comparisons(id)
);
```

**Backend API:**
```typescript
// Comparison operations
POST   /api/comparisons                          // Create comparison
GET    /api/comparisons                          // List saved comparisons
GET    /api/comparisons/:id                      // Get comparison details
DELETE /api/comparisons/:id                      // Delete comparison

// Analysis endpoints
GET    /api/comparisons/analyze?sessions[]=id1&sessions[]=id2
GET    /api/comparisons/:id/metrics
GET    /api/comparisons/:id/timeline-sync       // Synchronized timeline view
```

**Comparison Analysis:**
```typescript
// apps/server/src/comparison.ts
interface ComparisonResult {
  sessions: SessionSummary[];
  metrics_comparison: MetricsComparison;
  pattern_differences: PatternDifference[];
  tool_usage_comparison: ToolUsageComparison;
  efficiency_score: EfficiencyScore;
  recommendations: string[];
}

export function compareSessions(sessionIds: string[]): ComparisonResult {
  const sessions = sessionIds.map(id => loadSession(id));

  return {
    sessions: sessions.map(s => summarizeSession(s)),
    metrics_comparison: compareMetrics(sessions),
    pattern_differences: comparePatterns(sessions),
    tool_usage_comparison: compareToolUsage(sessions),
    efficiency_score: calculateEfficiencyScores(sessions),
    recommendations: generateRecommendations(sessions)
  };
}

function compareMetrics(sessions: SessionData[]): MetricsComparison {
  return {
    response_times: sessions.map(s => s.metrics.avg_response_time),
    token_usage: sessions.map(s => s.metrics.total_tokens),
    costs: sessions.map(s => s.metrics.total_cost),
    tool_counts: sessions.map(s => s.metrics.tool_count),
    success_rates: sessions.map(s => s.metrics.success_rate),
    winner: determineWinner(sessions)  // Best overall performance
  };
}

function comparePatterns(sessions: SessionData[]): PatternDifference[] {
  const allPatterns = new Set();
  sessions.forEach(s => {
    s.patterns.forEach(p => allPatterns.add(p.pattern.id));
  });

  return Array.from(allPatterns).map(patternId => {
    const occurrences = sessions.map(s => {
      const pattern = s.patterns.find(p => p.pattern.id === patternId);
      return pattern ? pattern.occurrences : 0;
    });

    return {
      pattern_id: patternId,
      occurrences_by_session: occurrences,
      variance: calculateVariance(occurrences)
    };
  });
}
```

**UI Components:**
```vue
<!-- apps/client/src/views/SessionComparison.vue -->
<template>
  <div class="session-comparison">
    <div class="comparison-header">
      <h1>Session Comparison</h1>
      <div class="session-selector">
        <session-picker
          v-model="selectedSessions"
          :max="4"
          placeholder="Select sessions to compare..."
        />
        <button
          @click="runComparison"
          :disabled="selectedSessions.length < 2"
          class="btn-primary"
        >
          Compare
        </button>
      </div>
    </div>

    <div v-if="comparisonResult" class="comparison-results">
      <!-- Side-by-side metadata -->
      <div class="sessions-overview">
        <div
          v-for="session in comparisonResult.sessions"
          :key="session.session_id"
          class="session-column"
        >
          <div class="session-header" :style="{ borderColor: getSessionColor(session.session_id) }">
            <h3>{{ session.source_app }}</h3>
            <p class="session-id">{{ truncateSessionId(session.session_id) }}</p>
            <p class="model">{{ session.model_name }}</p>
          </div>

          <div class="session-stats">
            <stat-item label="Duration" :value="formatDuration(session.duration)" />
            <stat-item label="Events" :value="session.event_count" />
            <stat-item label="Prompts" :value="session.prompt_count" />
            <stat-item label="Tools" :value="session.tool_count" />
          </div>
        </div>
      </div>

      <!-- Metrics comparison charts -->
      <div class="metrics-comparison">
        <h2>Performance Metrics</h2>

        <div class="metric-charts">
          <comparison-bar-chart
            title="Response Time"
            :data="comparisonResult.metrics_comparison.response_times"
            :labels="sessionLabels"
            unit="seconds"
          />

          <comparison-bar-chart
            title="Token Usage"
            :data="comparisonResult.metrics_comparison.token_usage"
            :labels="sessionLabels"
          />

          <comparison-bar-chart
            title="Cost"
            :data="comparisonResult.metrics_comparison.costs"
            :labels="sessionLabels"
            unit="$"
            :decimals="4"
          />

          <comparison-bar-chart
            title="Success Rate"
            :data="comparisonResult.metrics_comparison.success_rates"
            :labels="sessionLabels"
            unit="%"
          />
        </div>

        <div class="winner-badge" v-if="comparisonResult.metrics_comparison.winner">
          <h3>🏆 Overall Winner</h3>
          <p>{{ getSessionLabel(comparisonResult.metrics_comparison.winner) }}</p>
          <p class="reason">Best balance of speed, cost, and success rate</p>
        </div>
      </div>

      <!-- Pattern comparison -->
      <div class="pattern-comparison">
        <h2>Pattern Analysis</h2>
        <pattern-comparison-table
          :patterns="comparisonResult.pattern_differences"
          :sessions="comparisonResult.sessions"
        />
      </div>

      <!-- Tool usage comparison -->
      <div class="tool-comparison">
        <h2>Tool Usage</h2>
        <tool-usage-chart
          :data="comparisonResult.tool_usage_comparison"
          :sessions="comparisonResult.sessions"
        />
      </div>

      <!-- Synchronized timeline view -->
      <div class="timeline-comparison">
        <h2>Timeline Comparison</h2>
        <p class="description">Events aligned by relative time from session start</p>

        <div class="sync-timelines">
          <div
            v-for="session in comparisonResult.sessions"
            :key="session.session_id"
            class="timeline-column"
          >
            <h4>{{ session.source_app }}</h4>
            <mini-timeline
              :events="getSessionEvents(session.session_id)"
              :color="getSessionColor(session.session_id)"
            />
          </div>
        </div>
      </div>

      <!-- AI-generated recommendations -->
      <div class="recommendations">
        <h2>💡 Insights & Recommendations</h2>
        <ul class="recommendation-list">
          <li
            v-for="(rec, idx) in comparisonResult.recommendations"
            :key="idx"
            class="recommendation"
          >
            {{ rec }}
          </li>
        </ul>
      </div>

      <!-- Comparison notes -->
      <div class="notes-section">
        <h2>Notes</h2>
        <comparison-notes
          v-model="notes"
          :comparison-id="currentComparisonId"
        />
      </div>

      <!-- Actions -->
      <div class="comparison-actions">
        <button @click="saveComparison" class="btn-primary">
          Save Comparison
        </button>
        <button @click="exportComparison" class="btn-secondary">
          Export Report
        </button>
        <button @click="shareComparison" class="btn-secondary">
          Share Link
        </button>
      </div>
    </div>
  </div>
</template>
```

**Synchronized Timeline Component:**
```vue
<!-- apps/client/src/components/SynchronizedTimeline.vue -->
<template>
  <div class="synchronized-timeline">
    <div class="timeline-controls">
      <button @click="playback.play()">▶️ Play</button>
      <button @click="playback.pause()">⏸️ Pause</button>
      <input
        type="range"
        v-model="playback.position"
        :max="playback.duration"
        class="timeline-scrubber"
      />
    </div>

    <div class="timeline-grid">
      <div class="time-axis">
        <!-- Time markers -->
      </div>

      <div
        v-for="session in sessions"
        :key="session.id"
        class="timeline-row"
      >
        <div class="row-label">{{ session.label }}</div>
        <div class="event-track">
          <div
            v-for="event in session.events"
            :key="event.id"
            class="event-marker"
            :style="{
              left: `${calculatePosition(event.timestamp)}%`,
              backgroundColor: getEventColor(event.type)
            }"
            @click="showEventDetails(event)"
          >
            {{ getEventEmoji(event.type) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

**Key Features:**
- Side-by-side session metadata
- Performance metrics charts
- Pattern occurrence comparison
- Tool usage distribution
- Synchronized timeline visualization
- AI-generated insights and recommendations
- Save and share comparisons
- Export comparison reports

---

### 9. Conversation Decision Tree Visualization

**Status**: Planned (P3)
**Estimated Effort**: 3-4 days

#### Description
Visualize the agent's decision-making process as an interactive flowchart showing the causal chain: user prompt → tools considered → tool selected → results → next decision.

#### User Benefits
- Understand *why* the agent chose specific tools
- See the reasoning chain from prompt to completion
- Identify decision points and alternatives
- Learn agent decision-making patterns

#### Developer Learning Outcomes
- Graph visualization for agentic workflows
- Decision tree construction from event sequences
- Interactive visualization techniques (D3.js, Cytoscape)
- Causal reasoning representation

#### Implementation Details

**Graph Data Structure:**
```typescript
// apps/server/src/decision-tree.ts
interface DecisionNode {
  id: string;
  type: 'prompt' | 'decision' | 'tool' | 'result' | 'completion';
  label: string;
  timestamp: string;
  event_id?: number;
  metadata?: any;
}

interface DecisionEdge {
  from: string;
  to: string;
  type: 'triggers' | 'uses' | 'produces' | 'leads_to';
  label?: string;
}

interface DecisionTree {
  nodes: DecisionNode[];
  edges: DecisionEdge[];
  root: string;
}
```

**Tree Construction Algorithm:**
```typescript
export function buildDecisionTree(events: Event[]): DecisionTree {
  const nodes: DecisionNode[] = [];
  const edges: DecisionEdge[] = [];

  let previousNode: string | null = null;

  for (const event of events) {
    const nodeId = `node_${event.id}`;

    // Create node based on event type
    switch (event.hook_event_type) {
      case 'UserPromptSubmit':
        const promptPayload = JSON.parse(event.payload);
        nodes.push({
          id: nodeId,
          type: 'prompt',
          label: truncate(promptPayload.prompt, 50),
          timestamp: event.timestamp,
          event_id: event.id
        });

        if (previousNode) {
          edges.push({
            from: previousNode,
            to: nodeId,
            type: 'triggers'
          });
        }
        break;

      case 'PreToolUse':
        const prePayload = JSON.parse(event.payload);
        const toolNode = {
          id: nodeId,
          type: 'tool' as const,
          label: `${prePayload.tool_name}`,
          timestamp: event.timestamp,
          event_id: event.id,
          metadata: prePayload.tool_input
        };
        nodes.push(toolNode);

        if (previousNode) {
          edges.push({
            from: previousNode,
            to: nodeId,
            type: 'uses',
            label: prePayload.tool_name
          });
        }
        break;

      case 'PostToolUse':
        const postPayload = JSON.parse(event.payload);
        const resultNode = {
          id: nodeId,
          type: 'result' as const,
          label: summarizeResult(postPayload.tool_result),
          timestamp: event.timestamp,
          event_id: event.id,
          metadata: postPayload
        };
        nodes.push(resultNode);

        if (previousNode) {
          edges.push({
            from: previousNode,
            to: nodeId,
            type: 'produces'
          });
        }
        break;

      case 'Stop':
        nodes.push({
          id: nodeId,
          type: 'completion',
          label: 'Response Complete',
          timestamp: event.timestamp,
          event_id: event.id
        });

        if (previousNode) {
          edges.push({
            from: previousNode,
            to: nodeId,
            type: 'leads_to'
          });
        }
        break;
    }

    previousNode = nodeId;
  }

  return {
    nodes,
    edges,
    root: nodes[0]?.id || ''
  };
}
```

**Backend API:**
```typescript
GET /api/decision-tree/session/:sessionId
GET /api/decision-tree/session/:sessionId/subgraph?start=eventId&end=eventId
```

**UI Component:**
```vue
<!-- apps/client/src/components/DecisionTreeVisualization.vue -->
<template>
  <div class="decision-tree-view">
    <div class="tree-controls">
      <h2>🌳 Decision Tree Visualization</h2>

      <div class="controls">
        <button @click="layout = 'vertical'" :class="{ active: layout === 'vertical' }">
          Vertical
        </button>
        <button @click="layout = 'horizontal'" :class="{ active: layout === 'horizontal' }">
          Horizontal
        </button>
        <button @click="layout = 'radial'" :class="{ active: layout === 'radial' }">
          Radial
        </button>

        <button @click="zoomIn">🔍 +</button>
        <button @click="zoomOut">🔍 −</button>
        <button @click="fitToScreen">Fit</button>

        <button @click="exportSVG">Export SVG</button>
      </div>

      <div class="legend">
        <span class="legend-item prompt">💬 Prompt</span>
        <span class="legend-item tool">🔧 Tool Use</span>
        <span class="legend-item result">📊 Result</span>
        <span class="legend-item completion">🏁 Complete</span>
      </div>
    </div>

    <div ref="treeContainer" class="tree-container">
      <!-- D3/Cytoscape visualization renders here -->
    </div>

    <div v-if="selectedNode" class="node-details">
      <h3>{{ selectedNode.label }}</h3>
      <p><strong>Type:</strong> {{ selectedNode.type }}</p>
      <p><strong>Time:</strong> {{ formatTime(selectedNode.timestamp) }}</p>

      <div v-if="selectedNode.metadata" class="metadata">
        <h4>Details</h4>
        <pre>{{ JSON.stringify(selectedNode.metadata, null, 2) }}</pre>
      </div>

      <button @click="viewEvent(selectedNode.event_id)" class="btn-secondary">
        View Full Event
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import * as d3 from 'd3';
import { onMounted, ref, watch } from 'vue';

const treeContainer = ref<HTMLElement>();
const selectedNode = ref<DecisionNode | null>(null);
const layout = ref<'vertical' | 'horizontal' | 'radial'>('vertical');

onMounted(async () => {
  const tree = await fetchDecisionTree(props.sessionId);
  renderTree(tree);
});

function renderTree(tree: DecisionTree) {
  if (!treeContainer.value) return;

  // Clear existing
  d3.select(treeContainer.value).selectAll('*').remove();

  // Create SVG
  const svg = d3.select(treeContainer.value)
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%');

  const g = svg.append('g');

  // Create hierarchy
  const hierarchy = d3.hierarchy(convertToHierarchy(tree));

  // Create tree layout
  const treeLayout = layout.value === 'radial'
    ? d3.tree().size([2 * Math.PI, 300])
    : d3.tree().size([800, 600]);

  const treeData = treeLayout(hierarchy);

  // Draw links
  g.selectAll('.link')
    .data(treeData.links())
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('d', d => {
      if (layout.value === 'radial') {
        return radialLink(d);
      } else {
        return d3.linkVertical()
          .x(d => d.x)
          .y(d => d.y)(d);
      }
    })
    .attr('stroke', d => getEdgeColor(d.target.data))
    .attr('fill', 'none')
    .attr('stroke-width', 2);

  // Draw nodes
  const nodes = g.selectAll('.node')
    .data(treeData.descendants())
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => {
      if (layout.value === 'radial') {
        const angle = d.x;
        const radius = d.y;
        return `rotate(${angle * 180 / Math.PI - 90}) translate(${radius},0)`;
      } else {
        return `translate(${d.x},${d.y})`;
      }
    })
    .on('click', (event, d) => {
      selectedNode.value = d.data;
    });

  // Add circles
  nodes.append('circle')
    .attr('r', 10)
    .attr('fill', d => getNodeColor(d.data.type))
    .attr('stroke', '#fff')
    .attr('stroke-width', 2);

  // Add labels
  nodes.append('text')
    .attr('dy', 20)
    .attr('text-anchor', 'middle')
    .text(d => truncate(d.data.label, 20))
    .attr('font-size', '12px');

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });

  svg.call(zoom);
}

function getNodeColor(type: string): string {
  const colors = {
    prompt: '#4CAF50',
    tool: '#2196F3',
    result: '#FF9800',
    completion: '#9C27B0'
  };
  return colors[type] || '#999';
}

function getEdgeColor(node: any): string {
  return getNodeColor(node.type);
}
</script>

<style scoped>
.tree-container {
  width: 100%;
  height: 600px;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  background: #f9f9f9;
}

.node {
  cursor: pointer;
}

.node:hover circle {
  stroke: #ff0;
  stroke-width: 3px;
}

.link {
  opacity: 0.6;
  transition: opacity 0.2s;
}

.link:hover {
  opacity: 1;
  stroke-width: 3px !important;
}
</style>
```

**Interactive Features:**
- Click nodes to see details
- Zoom and pan
- Multiple layout options (vertical, horizontal, radial)
- Highlight paths on hover
- Filter by node type
- Time-based playback
- Export as SVG/PNG

---

### 10. Multi-Agent Collaboration Tracking

**Status**: Planned (P3)
**Estimated Effort**: 3-4 days

#### Description
Detect and visualize when multiple agents are working on related tasks through subagent relationships, showing parent-child hierarchies and collaboration patterns.

#### User Benefits
- Understand multi-agent delegation patterns
- See how agents break down complex tasks
- Learn effective task decomposition strategies
- Track collaborative problem-solving

#### Developer Learning Outcomes
- Multi-agent coordination patterns
- Hierarchical task management
- Agent orchestration visualization
- Distributed system observability

#### Implementation Details

**Enhanced Event Tracking:**
```python
# .claude/hooks/subagent_stop.py enhancement
def extract_subagent_relationship(data):
    """Extract parent-child agent relationship"""
    return {
        'parent_session_id': os.getenv('CLAUDE_SESSION_ID'),
        'child_session_id': data.get('subagent_session_id'),
        'parent_source_app': os.getenv('SOURCE_APP'),
        'child_source_app': data.get('subagent_source_app'),
        'task_description': data.get('task_description'),
        'delegation_reason': data.get('reason'),
        'started_at': data.get('started_at'),
        'completed_at': data.get('completed_at')
    }
```

**Database Schema:**
```sql
CREATE TABLE IF NOT EXISTS agent_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_source_app TEXT NOT NULL,
  parent_session_id TEXT NOT NULL,
  child_source_app TEXT NOT NULL,
  child_session_id TEXT NOT NULL,
  relationship_type TEXT DEFAULT 'subagent',  -- 'subagent', 'parallel', 'sequential'
  task_description TEXT,
  delegation_reason TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_parent_session ON agent_relationships(parent_session_id);
CREATE INDEX idx_child_session ON agent_relationships(child_session_id);

CREATE TABLE IF NOT EXISTS collaboration_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  relationship_id INTEGER NOT NULL,
  metric_type TEXT NOT NULL,  -- 'duration', 'depth', 'breadth', 'efficiency'
  metric_value REAL NOT NULL,
  FOREIGN KEY (relationship_id) REFERENCES agent_relationships(id)
);
```

**Backend API:**
```typescript
GET /api/collaboration/session/:sessionId/hierarchy
GET /api/collaboration/session/:sessionId/descendants
GET /api/collaboration/session/:sessionId/ancestors
GET /api/collaboration/active                          // Currently active collaborations
GET /api/collaboration/patterns                        // Common collaboration patterns
GET /api/collaboration/:relationshipId/metrics
```

**Hierarchy Construction:**
```typescript
// apps/server/src/collaboration.ts
interface AgentNode {
  source_app: string;
  session_id: string;
  children: AgentNode[];
  metrics: {
    total_events: number;
    duration: number;
    tool_count: number;
    depth: number;  // How deep in hierarchy
  };
  task_description?: string;
}

export async function buildAgentHierarchy(rootSessionId: string): Promise<AgentNode> {
  const root = await getSessionInfo(rootSessionId);
  const children = await getChildSessions(rootSessionId);

  const node: AgentNode = {
    source_app: root.source_app,
    session_id: root.session_id,
    children: [],
    metrics: await calculateSessionMetrics(root.session_id),
    task_description: root.task_description
  };

  // Recursively build child nodes
  for (const child of children) {
    const childNode = await buildAgentHierarchy(child.child_session_id);
    childNode.metrics.depth = node.metrics.depth + 1;
    node.children.push(childNode);
  }

  return node;
}

export function analyzeCollaborationPattern(hierarchy: AgentNode): CollaborationAnalysis {
  return {
    max_depth: calculateMaxDepth(hierarchy),
    total_agents: countAgents(hierarchy),
    avg_children_per_node: calculateAvgChildren(hierarchy),
    parallel_work_detected: detectParallelWork(hierarchy),
    task_decomposition_quality: assessDecomposition(hierarchy),
    collaboration_efficiency: calculateEfficiency(hierarchy)
  };
}
```

**UI Components:**
```vue
<!-- apps/client/src/components/AgentHierarchyVisualization.vue -->
<template>
  <div class="agent-hierarchy">
    <div class="hierarchy-header">
      <h2>🤝 Multi-Agent Collaboration</h2>

      <div class="view-toggle">
        <button
          @click="viewMode = 'tree'"
          :class="{ active: viewMode === 'tree' }"
        >
          Tree View
        </button>
        <button
          @click="viewMode = 'swimlane'"
          :class="{ active: viewMode === 'swimlane' }"
        >
          Swimlane View
        </button>
        <button
          @click="viewMode = 'timeline'"
          :class="{ active: viewMode === 'timeline' }"
        >
          Timeline View
        </button>
      </div>
    </div>

    <!-- Tree View -->
    <div v-if="viewMode === 'tree'" class="tree-view">
      <div class="collaboration-tree">
        <agent-tree-node
          :node="hierarchyRoot"
          :depth="0"
          @select="selectAgent"
        />
      </div>
    </div>

    <!-- Swimlane View -->
    <div v-else-if="viewMode === 'swimlane'" class="swimlane-view">
      <agent-swimlanes
        :hierarchy="hierarchyRoot"
        :time-range="timeRange"
      />
    </div>

    <!-- Timeline View -->
    <div v-else class="timeline-view">
      <collaboration-timeline
        :agents="flattenHierarchy(hierarchyRoot)"
        :relationships="relationships"
      />
    </div>

    <!-- Collaboration Metrics -->
    <div class="collaboration-metrics">
      <h3>Collaboration Metrics</h3>

      <div class="metrics-grid">
        <metric-card
          title="Total Agents"
          :value="analysisResult.total_agents"
          icon="👥"
        />
        <metric-card
          title="Max Depth"
          :value="analysisResult.max_depth"
          icon="📊"
          description="Levels of delegation"
        />
        <metric-card
          title="Avg Children"
          :value="analysisResult.avg_children_per_node.toFixed(1)"
          icon="🌳"
          description="Task decomposition factor"
        />
        <metric-card
          title="Efficiency Score"
          :value="analysisResult.collaboration_efficiency"
          icon="⚡"
          :color="getEfficiencyColor(analysisResult.collaboration_efficiency)"
        />
      </div>

      <div v-if="analysisResult.parallel_work_detected" class="parallel-work-alert">
        <span class="icon">⚡</span>
        <span>Parallel work detected! Multiple agents working simultaneously.</span>
      </div>
    </div>

    <!-- Agent Details Panel -->
    <div v-if="selectedAgent" class="agent-details-panel">
      <h3>Agent Details</h3>

      <div class="agent-info">
        <p><strong>Source App:</strong> {{ selectedAgent.source_app }}</p>
        <p><strong>Session ID:</strong> {{ selectedAgent.session_id }}</p>
        <p><strong>Task:</strong> {{ selectedAgent.task_description || 'N/A' }}</p>
        <p><strong>Depth:</strong> Level {{ selectedAgent.metrics.depth }}</p>
      </div>

      <div class="agent-metrics">
        <p><strong>Duration:</strong> {{ formatDuration(selectedAgent.metrics.duration) }}</p>
        <p><strong>Events:</strong> {{ selectedAgent.metrics.total_events }}</p>
        <p><strong>Tools Used:</strong> {{ selectedAgent.metrics.tool_count }}</p>
        <p><strong>Children:</strong> {{ selectedAgent.children.length }}</p>
      </div>

      <button @click="viewAgentSession(selectedAgent.session_id)" class="btn-primary">
        View Full Session
      </button>
    </div>
  </div>
</template>

<!-- Agent Tree Node Component -->
<template>
  <div class="tree-node" :style="{ marginLeft: `${depth * 40}px` }">
    <div
      class="node-content"
      :class="{ selected: isSelected }"
      @click="$emit('select', node)"
    >
      <span class="expand-icon" @click.stop="toggleExpand">
        {{ node.children.length > 0 ? (expanded ? '▼' : '▶') : '•' }}
      </span>

      <div class="node-info">
        <span class="app-name">{{ node.source_app }}</span>
        <span class="session-id">{{ truncateId(node.session_id) }}</span>

        <span v-if="node.task_description" class="task">
          {{ truncate(node.task_description, 50) }}
        </span>

        <div class="node-metrics">
          <span>{{ node.metrics.total_events }} events</span>
          <span>{{ node.metrics.tool_count }} tools</span>
          <span>{{ formatDuration(node.metrics.duration) }}</span>
        </div>
      </div>
    </div>

    <div v-if="expanded && node.children.length > 0" class="children">
      <agent-tree-node
        v-for="child in node.children"
        :key="child.session_id"
        :node="child"
        :depth="depth + 1"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>
```

**Swimlane Visualization:**
```vue
<!-- apps/client/src/components/AgentSwimlanes.vue -->
<template>
  <div class="agent-swimlanes">
    <svg ref="swimlaneSvg" width="100%" height="600">
      <!-- Each agent gets a horizontal lane -->
      <g v-for="(agent, idx) in agents" :key="agent.session_id">
        <!-- Lane background -->
        <rect
          :x="0"
          :y="idx * laneHeight"
          :width="totalWidth"
          :height="laneHeight"
          :fill="idx % 2 === 0 ? '#f9f9f9' : '#ffffff'"
        />

        <!-- Lane label -->
        <text
          :x="10"
          :y="idx * laneHeight + laneHeight / 2"
          dominant-baseline="middle"
          class="lane-label"
        >
          {{ agent.source_app }}:{{ truncateId(agent.session_id) }}
        </text>

        <!-- Activity bar -->
        <rect
          :x="timeToX(agent.start_time)"
          :y="idx * laneHeight + 10"
          :width="timeToX(agent.end_time) - timeToX(agent.start_time)"
          :height="laneHeight - 20"
          :fill="getAgentColor(agent.session_id)"
          opacity="0.7"
          class="activity-bar"
        />

        <!-- Event markers -->
        <circle
          v-for="event in agent.events"
          :key="event.id"
          :cx="timeToX(event.timestamp)"
          :cy="idx * laneHeight + laneHeight / 2"
          :r="4"
          :fill="getEventTypeColor(event.hook_event_type)"
        />

        <!-- Delegation arrows to children -->
        <path
          v-for="child in getChildAgents(agent.session_id)"
          :key="child.session_id"
          :d="drawDelegationArrow(agent, child)"
          stroke="#666"
          stroke-width="2"
          fill="none"
          marker-end="url(#arrowhead)"
        />
      </g>

      <!-- Arrowhead marker definition -->
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 10 3, 0 6" fill="#666" />
        </marker>
      </defs>
    </svg>
  </div>
</template>
```

**Key Features:**
- Tree view of agent hierarchy
- Swimlane view showing parallel work
- Timeline view with delegation arrows
- Collaboration metrics and efficiency scoring
- Detect common patterns (fan-out, pipeline, recursive)
- Real-time updates for active collaborations
- Export collaboration graphs

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- Feature 2: Tool Success/Failure Analytics
- Feature 1: Token Usage & Cost Tracking
- Feature 3: Session Bookmarking & Tagging

### Phase 2: Analysis (Weeks 3-4)
- Feature 4: Agent Performance Metrics
- Feature 5: Event Pattern Detection
- Feature 6: Webhook/Alert System

### Phase 3: Comparison & Export (Weeks 5-6)
- Feature 7: Session Export & Reports
- Feature 8: Session Comparison View

### Phase 4: Advanced Visualization (Weeks 7-8)
- Feature 9: Decision Tree Visualization
- Feature 10: Multi-Agent Collaboration Tracking

---

## Success Metrics

**User Adoption:**
- Number of sessions bookmarked
- Comparison views created
- Patterns discovered
- Reports exported

**Educational Value:**
- Time spent analyzing patterns
- Bookmark tags created (indicates learning)
- Comparison usage (indicates experimentation)
- Export frequency (indicates sharing/documentation)

**Developer Learning:**
- Implementation completeness
- Code quality and patterns used
- Documentation created
- Tests written

---

## Contributing

We welcome contributions! Each feature can be developed independently. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**How to contribute:**
1. Pick a feature from the roadmap
2. Create a feature branch
3. Implement with tests
4. Update documentation
5. Submit pull request

---

## Questions?

- 📺 [Watch the tutorial videos](https://www.youtube.com/@indydevdan)
- 📖 [Read the documentation](docs/)
- 💬 [Open a discussion](https://github.com/your-org/repo/discussions)
- 🐛 [Report issues](https://github.com/your-org/repo/issues)

---

*This roadmap is a living document and will be updated based on community feedback and priorities.*
