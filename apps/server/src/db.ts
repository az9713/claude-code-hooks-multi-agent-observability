import { Database } from 'bun:sqlite';
import type {
  HookEvent,
  FilterOptions,
  Theme,
  ThemeSearchQuery,
  SessionBookmark,
  SessionTag,
  PerformanceMetrics,
  DetectedPattern,
  Webhook,
  WebhookDelivery,
  SessionComparison,
  ComparisonNote,
  AgentRelationship,
  CollaborationMetric
} from './types';

let db: Database;

export function initDatabase(): void {
  db = new Database('events.db');
  
  // Enable WAL mode for better concurrent performance
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  
  // Create events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_app TEXT NOT NULL,
      session_id TEXT NOT NULL,
      hook_event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      chat TEXT,
      summary TEXT,
      timestamp INTEGER NOT NULL
    )
  `);
  
  // Check if chat column exists, add it if not (for migration)
  try {
    const columns = db.prepare("PRAGMA table_info(events)").all() as any[];
    const hasChatColumn = columns.some((col: any) => col.name === 'chat');
    if (!hasChatColumn) {
      db.exec('ALTER TABLE events ADD COLUMN chat TEXT');
    }

    // Check if summary column exists, add it if not (for migration)
    const hasSummaryColumn = columns.some((col: any) => col.name === 'summary');
    if (!hasSummaryColumn) {
      db.exec('ALTER TABLE events ADD COLUMN summary TEXT');
    }

    // Check if humanInTheLoop column exists, add it if not (for migration)
    const hasHumanInTheLoopColumn = columns.some((col: any) => col.name === 'humanInTheLoop');
    if (!hasHumanInTheLoopColumn) {
      db.exec('ALTER TABLE events ADD COLUMN humanInTheLoop TEXT');
    }

    // Check if humanInTheLoopStatus column exists, add it if not (for migration)
    const hasHumanInTheLoopStatusColumn = columns.some((col: any) => col.name === 'humanInTheLoopStatus');
    if (!hasHumanInTheLoopStatusColumn) {
      db.exec('ALTER TABLE events ADD COLUMN humanInTheLoopStatus TEXT');
    }

    // Check if model_name column exists, add it if not (for migration)
    const hasModelNameColumn = columns.some((col: any) => col.name === 'model_name');
    if (!hasModelNameColumn) {
      db.exec('ALTER TABLE events ADD COLUMN model_name TEXT');
    }

    // Check if token_count column exists, add it if not (for migration)
    const hasTokenCountColumn = columns.some((col: any) => col.name === 'token_count');
    if (!hasTokenCountColumn) {
      db.exec('ALTER TABLE events ADD COLUMN token_count INTEGER');
    }

    // Check if estimated_cost column exists, add it if not (for migration)
    const hasEstimatedCostColumn = columns.some((col: any) => col.name === 'estimated_cost');
    if (!hasEstimatedCostColumn) {
      db.exec('ALTER TABLE events ADD COLUMN estimated_cost REAL');
    }
  } catch (error) {
    // If the table doesn't exist yet, the CREATE TABLE above will handle it
  }
  
  // Create indexes for common queries
  db.exec('CREATE INDEX IF NOT EXISTS idx_source_app ON events(source_app)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_id ON events(session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_hook_event_type ON events(hook_event_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp)');
  
  // Create themes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      displayName TEXT NOT NULL,
      description TEXT,
      colors TEXT NOT NULL,
      isPublic INTEGER NOT NULL DEFAULT 0,
      authorId TEXT,
      authorName TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      tags TEXT,
      downloadCount INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      ratingCount INTEGER DEFAULT 0
    )
  `);
  
  // Create theme shares table
  db.exec(`
    CREATE TABLE IF NOT EXISTS theme_shares (
      id TEXT PRIMARY KEY,
      themeId TEXT NOT NULL,
      shareToken TEXT NOT NULL UNIQUE,
      expiresAt INTEGER,
      isPublic INTEGER NOT NULL DEFAULT 0,
      allowedUsers TEXT,
      createdAt INTEGER NOT NULL,
      accessCount INTEGER DEFAULT 0,
      FOREIGN KEY (themeId) REFERENCES themes (id) ON DELETE CASCADE
    )
  `);
  
  // Create theme ratings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS theme_ratings (
      id TEXT PRIMARY KEY,
      themeId TEXT NOT NULL,
      userId TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      createdAt INTEGER NOT NULL,
      UNIQUE(themeId, userId),
      FOREIGN KEY (themeId) REFERENCES themes (id) ON DELETE CASCADE
    )
  `);
  
  // Create indexes for theme tables
  db.exec('CREATE INDEX IF NOT EXISTS idx_themes_name ON themes(name)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_themes_isPublic ON themes(isPublic)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_themes_createdAt ON themes(createdAt)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_theme_shares_token ON theme_shares(shareToken)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_theme_ratings_theme ON theme_ratings(themeId)');

  // Create session_metrics table for token tracking
  db.exec(`
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
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_session_metrics ON session_metrics(source_app, session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_metrics_session ON session_metrics(session_id)');

  // Create tool_analytics table for tool success/failure tracking
  db.exec(`
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
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_tool_analytics ON tool_analytics(tool_name, success)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tool_errors ON tool_analytics(error_type) WHERE success = 0');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tool_session ON tool_analytics(session_id)');

  // Create session_bookmarks table for bookmarking sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_app TEXT NOT NULL,
      session_id TEXT NOT NULL,
      bookmarked INTEGER NOT NULL DEFAULT 1,
      bookmarked_at INTEGER,
      notes TEXT,
      UNIQUE(source_app, session_id)
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_session_bookmarks ON session_bookmarks(source_app, session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_bookmarked ON session_bookmarks(bookmarked) WHERE bookmarked = 1');

  // Create session_tags table for tagging sessions
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_app TEXT NOT NULL,
      session_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(source_app, session_id, tag)
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_session_tags ON session_tags(source_app, session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tags ON session_tags(tag)');

  // Create performance_metrics table for agent performance tracking
  db.exec(`
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
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_performance_metrics ON performance_metrics(source_app, session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_success_rate ON performance_metrics(success_rate)');

  // Create detected_patterns table for event pattern detection
  db.exec(`
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
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_detected_patterns ON detected_patterns(source_app, session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_pattern_type ON detected_patterns(pattern_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_pattern_name ON detected_patterns(pattern_name)');

  // Priority 2: Webhooks table for alert system
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      event_type TEXT NOT NULL,
      source_app TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      secret TEXT,
      created_at INTEGER NOT NULL,
      filters TEXT
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_webhooks_event_type ON webhooks(event_type)');

  // Priority 2: Webhook deliveries for tracking delivery status
  db.exec(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webhook_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      response_code INTEGER,
      response_body TEXT,
      attempted_at INTEGER NOT NULL,
      retry_count INTEGER DEFAULT 0,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id),
      FOREIGN KEY (event_id) REFERENCES events(id)
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_webhook_deliveries ON webhook_deliveries(webhook_id, status)');

  // Priority 2: Session comparisons
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_comparisons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      session_ids TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      created_by TEXT
    )
  `);

  // Priority 2: Comparison notes
  db.exec(`
    CREATE TABLE IF NOT EXISTS comparison_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comparison_id INTEGER NOT NULL,
      note TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (comparison_id) REFERENCES session_comparisons(id)
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_comparison_notes ON comparison_notes(comparison_id)');

  // Priority 3: Agent relationships for multi-agent collaboration tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_source_app TEXT NOT NULL,
      parent_session_id TEXT NOT NULL,
      child_source_app TEXT NOT NULL,
      child_session_id TEXT NOT NULL,
      relationship_type TEXT DEFAULT 'subagent',
      task_description TEXT,
      delegation_reason TEXT,
      started_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_parent_session ON agent_relationships(parent_session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_child_session ON agent_relationships(child_session_id)');

  // Priority 3: Collaboration metrics
  db.exec(`
    CREATE TABLE IF NOT EXISTS collaboration_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      relationship_id INTEGER NOT NULL,
      metric_type TEXT NOT NULL,
      metric_value REAL NOT NULL,
      FOREIGN KEY (relationship_id) REFERENCES agent_relationships(id)
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_collaboration_metrics ON collaboration_metrics(relationship_id)');
}

export function insertEvent(event: HookEvent): HookEvent {
  const stmt = db.prepare(`
    INSERT INTO events (source_app, session_id, hook_event_type, payload, chat, summary, timestamp, humanInTheLoop, humanInTheLoopStatus, model_name, token_count, estimated_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const timestamp = event.timestamp || Date.now();

  // Initialize humanInTheLoopStatus to pending if humanInTheLoop exists
  let humanInTheLoopStatus = event.humanInTheLoopStatus;
  if (event.humanInTheLoop && !humanInTheLoopStatus) {
    humanInTheLoopStatus = { status: 'pending' };
  }

  const result = stmt.run(
    event.source_app,
    event.session_id,
    event.hook_event_type,
    JSON.stringify(event.payload),
    event.chat ? JSON.stringify(event.chat) : null,
    event.summary || null,
    timestamp,
    event.humanInTheLoop ? JSON.stringify(event.humanInTheLoop) : null,
    humanInTheLoopStatus ? JSON.stringify(humanInTheLoopStatus) : null,
    event.model_name || null,
    event.token_count || null,
    event.estimated_cost || null
  );

  return {
    ...event,
    id: result.lastInsertRowid as number,
    timestamp,
    humanInTheLoopStatus
  };
}

export function getFilterOptions(): FilterOptions {
  const sourceApps = db.prepare('SELECT DISTINCT source_app FROM events ORDER BY source_app').all() as { source_app: string }[];
  const sessionIds = db.prepare('SELECT DISTINCT session_id FROM events ORDER BY session_id DESC LIMIT 300').all() as { session_id: string }[];
  const hookEventTypes = db.prepare('SELECT DISTINCT hook_event_type FROM events ORDER BY hook_event_type').all() as { hook_event_type: string }[];
  
  return {
    source_apps: sourceApps.map(row => row.source_app),
    session_ids: sessionIds.map(row => row.session_id),
    hook_event_types: hookEventTypes.map(row => row.hook_event_type)
  };
}

export function getRecentEvents(limit: number = 300): HookEvent[] {
  const stmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp, humanInTheLoop, humanInTheLoopStatus, model_name, token_count, estimated_cost
    FROM events
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp,
    humanInTheLoop: row.humanInTheLoop ? JSON.parse(row.humanInTheLoop) : undefined,
    humanInTheLoopStatus: row.humanInTheLoopStatus ? JSON.parse(row.humanInTheLoopStatus) : undefined,
    model_name: row.model_name || undefined,
    token_count: row.token_count || undefined,
    estimated_cost: row.estimated_cost || undefined
  })).reverse();
}

// Theme database functions
export function insertTheme(theme: Theme): Theme {
  const stmt = db.prepare(`
    INSERT INTO themes (id, name, displayName, description, colors, isPublic, authorId, authorName, createdAt, updatedAt, tags, downloadCount, rating, ratingCount)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    theme.id,
    theme.name,
    theme.displayName,
    theme.description || null,
    JSON.stringify(theme.colors),
    theme.isPublic ? 1 : 0,
    theme.authorId || null,
    theme.authorName || null,
    theme.createdAt,
    theme.updatedAt,
    JSON.stringify(theme.tags),
    theme.downloadCount || 0,
    theme.rating || 0,
    theme.ratingCount || 0
  );
  
  return theme;
}

export function updateTheme(id: string, updates: Partial<Theme>): boolean {
  const allowedFields = ['displayName', 'description', 'colors', 'isPublic', 'updatedAt', 'tags'];
  const setClause = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .map(key => `${key} = ?`)
    .join(', ');
  
  if (!setClause) return false;
  
  const values = Object.keys(updates)
    .filter(key => allowedFields.includes(key))
    .map(key => {
      if (key === 'colors' || key === 'tags') {
        return JSON.stringify(updates[key as keyof Theme]);
      }
      if (key === 'isPublic') {
        return updates[key as keyof Theme] ? 1 : 0;
      }
      return updates[key as keyof Theme];
    });
  
  const stmt = db.prepare(`UPDATE themes SET ${setClause} WHERE id = ?`);
  const result = stmt.run(...values, id);
  
  return result.changes > 0;
}

export function getTheme(id: string): Theme | null {
  const stmt = db.prepare('SELECT * FROM themes WHERE id = ?');
  const row = stmt.get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    colors: JSON.parse(row.colors),
    isPublic: Boolean(row.isPublic),
    authorId: row.authorId,
    authorName: row.authorName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags: JSON.parse(row.tags || '[]'),
    downloadCount: row.downloadCount,
    rating: row.rating,
    ratingCount: row.ratingCount
  };
}

export function getThemes(query: ThemeSearchQuery = {}): Theme[] {
  let sql = 'SELECT * FROM themes WHERE 1=1';
  const params: any[] = [];
  
  if (query.isPublic !== undefined) {
    sql += ' AND isPublic = ?';
    params.push(query.isPublic ? 1 : 0);
  }
  
  if (query.authorId) {
    sql += ' AND authorId = ?';
    params.push(query.authorId);
  }
  
  if (query.query) {
    sql += ' AND (name LIKE ? OR displayName LIKE ? OR description LIKE ?)';
    const searchTerm = `%${query.query}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }
  
  // Add sorting
  const sortBy = query.sortBy || 'created';
  const sortOrder = query.sortOrder || 'desc';
  const sortColumn = {
    name: 'name',
    created: 'createdAt',
    updated: 'updatedAt',
    downloads: 'downloadCount',
    rating: 'rating'
  }[sortBy] || 'createdAt';
  
  sql += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;
  
  // Add pagination
  if (query.limit) {
    sql += ' LIMIT ?';
    params.push(query.limit);
    
    if (query.offset) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }
  }
  
  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    description: row.description,
    colors: JSON.parse(row.colors),
    isPublic: Boolean(row.isPublic),
    authorId: row.authorId,
    authorName: row.authorName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tags: JSON.parse(row.tags || '[]'),
    downloadCount: row.downloadCount,
    rating: row.rating,
    ratingCount: row.ratingCount
  }));
}

export function deleteTheme(id: string): boolean {
  const stmt = db.prepare('DELETE FROM themes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function incrementThemeDownloadCount(id: string): boolean {
  const stmt = db.prepare('UPDATE themes SET downloadCount = downloadCount + 1 WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// HITL helper functions
export function updateEventHITLResponse(id: number, response: any): HookEvent | null {
  const status = {
    status: 'responded',
    respondedAt: response.respondedAt,
    response
  };

  const stmt = db.prepare('UPDATE events SET humanInTheLoopStatus = ? WHERE id = ?');
  stmt.run(JSON.stringify(status), id);

  const selectStmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp, humanInTheLoop, humanInTheLoopStatus, model_name, token_count, estimated_cost
    FROM events
    WHERE id = ?
  `);
  const row = selectStmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp,
    humanInTheLoop: row.humanInTheLoop ? JSON.parse(row.humanInTheLoop) : undefined,
    humanInTheLoopStatus: row.humanInTheLoopStatus ? JSON.parse(row.humanInTheLoopStatus) : undefined,
    model_name: row.model_name || undefined,
    token_count: row.token_count || undefined,
    estimated_cost: row.estimated_cost || undefined
  };
}

// Session Metrics functions
export function upsertSessionMetrics(metrics: SessionMetrics): void {
  const stmt = db.prepare(`
    INSERT INTO session_metrics (source_app, session_id, total_tokens, total_cost, message_count, start_time, end_time, model_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_app, session_id) DO UPDATE SET
      total_tokens = total_tokens + excluded.total_tokens,
      total_cost = total_cost + excluded.total_cost,
      message_count = message_count + excluded.message_count,
      end_time = excluded.end_time,
      model_name = COALESCE(excluded.model_name, model_name)
  `);

  stmt.run(
    metrics.source_app,
    metrics.session_id,
    metrics.total_tokens,
    metrics.total_cost,
    metrics.message_count,
    metrics.start_time || null,
    metrics.end_time || null,
    metrics.model_name || null
  );
}

export function getSessionMetrics(sessionId: string): SessionMetrics | null {
  const stmt = db.prepare('SELECT * FROM session_metrics WHERE session_id = ?');
  const row = stmt.get(sessionId) as any;

  if (!row) return null;

  return {
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    total_tokens: row.total_tokens,
    total_cost: row.total_cost,
    message_count: row.message_count,
    start_time: row.start_time,
    end_time: row.end_time,
    model_name: row.model_name
  };
}

export function getAllSessionMetrics(sourceApp?: string): SessionMetrics[] {
  let sql = 'SELECT * FROM session_metrics';
  const params: any[] = [];

  if (sourceApp) {
    sql += ' WHERE source_app = ?';
    params.push(sourceApp);
  }

  sql += ' ORDER BY end_time IS NULL, end_time DESC, start_time IS NULL, start_time DESC';

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    total_tokens: row.total_tokens,
    total_cost: row.total_cost,
    message_count: row.message_count,
    start_time: row.start_time,
    end_time: row.end_time,
    model_name: row.model_name
  }));
}

// Tool Analytics functions
export function insertToolAnalytics(analytics: ToolAnalytics): void {
  const stmt = db.prepare(`
    INSERT INTO tool_analytics (source_app, session_id, tool_name, success, error_type, error_message, timestamp, event_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    analytics.source_app,
    analytics.session_id,
    analytics.tool_name,
    analytics.success ? 1 : 0,
    analytics.error_type || null,
    analytics.error_message || null,
    analytics.timestamp,
    analytics.event_id || null
  );
}

export function getToolStats(sessionId?: string, sourceApp?: string): ToolStats[] {
  let sql = `
    SELECT
      tool_name,
      COUNT(*) as total_uses,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failures,
      ROUND(100.0 * SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
    FROM tool_analytics
    WHERE 1=1
  `;

  const params: any[] = [];

  if (sessionId) {
    sql += ' AND session_id = ?';
    params.push(sessionId);
  }

  if (sourceApp) {
    sql += ' AND source_app = ?';
    params.push(sourceApp);
  }

  sql += ' GROUP BY tool_name ORDER BY total_uses DESC';

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => {
    // Get most common error for this tool
    const errorStmt = db.prepare(`
      SELECT error_type
      FROM tool_analytics
      WHERE tool_name = ? AND success = 0 AND error_type IS NOT NULL
      ${sessionId ? 'AND session_id = ?' : ''}
      ${sourceApp ? 'AND source_app = ?' : ''}
      GROUP BY error_type
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `);

    const errorParams: any[] = [row.tool_name];
    if (sessionId) errorParams.push(sessionId);
    if (sourceApp) errorParams.push(sourceApp);

    const errorRow = errorStmt.get(...errorParams) as any;

    return {
      tool_name: row.tool_name,
      total_uses: row.total_uses,
      successes: row.successes,
      failures: row.failures,
      success_rate: row.success_rate,
      most_common_error: errorRow?.error_type
    };
  });
}

export function getErrorSummary(limit: number = 10): ErrorSummary[] {
  const stmt = db.prepare(`
    SELECT
      error_type,
      tool_name,
      COUNT(*) as count,
      MAX(error_message) as recent_message
    FROM tool_analytics
    WHERE success = 0 AND error_type IS NOT NULL
    GROUP BY error_type, tool_name
    ORDER BY count DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as any[];

  return rows.map(row => ({
    error_type: row.error_type,
    count: row.count,
    tool_name: row.tool_name,
    recent_message: row.recent_message
  }));
}

// Session Bookmarking functions
export function upsertSessionBookmark(bookmark: SessionBookmark): void {
  const stmt = db.prepare(`
    INSERT INTO session_bookmarks (source_app, session_id, bookmarked, bookmarked_at, notes)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(source_app, session_id) DO UPDATE SET
      bookmarked = excluded.bookmarked,
      bookmarked_at = excluded.bookmarked_at,
      notes = excluded.notes
  `);

  stmt.run(
    bookmark.source_app,
    bookmark.session_id,
    bookmark.bookmarked ? 1 : 0,
    bookmark.bookmarked_at || Date.now(),
    bookmark.notes || null
  );
}

export function getSessionBookmark(sourceApp: string, sessionId: string): SessionBookmark | null {
  const stmt = db.prepare('SELECT * FROM session_bookmarks WHERE source_app = ? AND session_id = ?');
  const row = stmt.get(sourceApp, sessionId) as any;

  if (!row) return null;

  return {
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    bookmarked: Boolean(row.bookmarked),
    bookmarked_at: row.bookmarked_at,
    notes: row.notes
  };
}

export function getAllBookmarkedSessions(sourceApp?: string): SessionBookmark[] {
  let sql = 'SELECT * FROM session_bookmarks WHERE bookmarked = 1';
  const params: any[] = [];

  if (sourceApp) {
    sql += ' AND source_app = ?';
    params.push(sourceApp);
  }

  sql += ' ORDER BY bookmarked_at DESC';

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    bookmarked: Boolean(row.bookmarked),
    bookmarked_at: row.bookmarked_at,
    notes: row.notes
  }));
}

export function deleteSessionBookmark(sourceApp: string, sessionId: string): boolean {
  const stmt = db.prepare('DELETE FROM session_bookmarks WHERE source_app = ? AND session_id = ?');
  const result = stmt.run(sourceApp, sessionId);
  return result.changes > 0;
}

// Session Tagging functions
export function insertSessionTag(tag: SessionTag): void {
  const stmt = db.prepare(`
    INSERT INTO session_tags (source_app, session_id, tag, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(source_app, session_id, tag) DO NOTHING
  `);

  stmt.run(
    tag.source_app,
    tag.session_id,
    tag.tag,
    tag.created_at || Date.now()
  );
}

export function getSessionTags(sourceApp: string, sessionId: string): SessionTag[] {
  const stmt = db.prepare('SELECT * FROM session_tags WHERE source_app = ? AND session_id = ? ORDER BY created_at DESC');
  const rows = stmt.all(sourceApp, sessionId) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    tag: row.tag,
    created_at: row.created_at
  }));
}

export function getAllTags(sourceApp?: string): string[] {
  let sql = 'SELECT DISTINCT tag FROM session_tags';
  const params: any[] = [];

  if (sourceApp) {
    sql += ' WHERE source_app = ?';
    params.push(sourceApp);
  }

  sql += ' ORDER BY tag';

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => row.tag);
}

export function getSessionsByTag(tag: string, sourceApp?: string): SessionTag[] {
  let sql = 'SELECT * FROM session_tags WHERE tag = ?';
  const params: any[] = [tag];

  if (sourceApp) {
    sql += ' AND source_app = ?';
    params.push(sourceApp);
  }

  sql += ' ORDER BY created_at DESC';

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    tag: row.tag,
    created_at: row.created_at
  }));
}

export function deleteSessionTag(sourceApp: string, sessionId: string, tag: string): boolean {
  const stmt = db.prepare('DELETE FROM session_tags WHERE source_app = ? AND session_id = ? AND tag = ?');
  const result = stmt.run(sourceApp, sessionId, tag);
  return result.changes > 0;
}

// Performance Metrics functions
export function upsertPerformanceMetrics(metrics: PerformanceMetrics): void {
  const stmt = db.prepare(`
    INSERT INTO performance_metrics (
      source_app, session_id, avg_response_time, tools_per_task,
      success_rate, session_duration, total_events, total_tool_uses, calculated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_app, session_id) DO UPDATE SET
      avg_response_time = excluded.avg_response_time,
      tools_per_task = excluded.tools_per_task,
      success_rate = excluded.success_rate,
      session_duration = excluded.session_duration,
      total_events = excluded.total_events,
      total_tool_uses = excluded.total_tool_uses,
      calculated_at = excluded.calculated_at
  `);

  stmt.run(
    metrics.source_app,
    metrics.session_id,
    metrics.avg_response_time || null,
    metrics.tools_per_task || null,
    metrics.success_rate || null,
    metrics.session_duration || null,
    metrics.total_events,
    metrics.total_tool_uses,
    metrics.calculated_at || Date.now()
  );
}

export function getPerformanceMetrics(sourceApp: string, sessionId: string): PerformanceMetrics | null {
  const stmt = db.prepare('SELECT * FROM performance_metrics WHERE source_app = ? AND session_id = ?');
  const row = stmt.get(sourceApp, sessionId) as any;

  if (!row) return null;

  return {
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    avg_response_time: row.avg_response_time,
    tools_per_task: row.tools_per_task,
    success_rate: row.success_rate,
    session_duration: row.session_duration,
    total_events: row.total_events,
    total_tool_uses: row.total_tool_uses,
    calculated_at: row.calculated_at
  };
}

export function getAllPerformanceMetrics(sourceApp?: string): PerformanceMetrics[] {
  let sql = 'SELECT * FROM performance_metrics';
  const params: any[] = [];

  if (sourceApp) {
    sql += ' WHERE source_app = ?';
    params.push(sourceApp);
  }

  sql += ' ORDER BY calculated_at DESC';

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    avg_response_time: row.avg_response_time,
    tools_per_task: row.tools_per_task,
    success_rate: row.success_rate,
    session_duration: row.session_duration,
    total_events: row.total_events,
    total_tool_uses: row.total_tool_uses,
    calculated_at: row.calculated_at
  }));
}

export function calculateAndStorePerformanceMetrics(sourceApp: string, sessionId: string): PerformanceMetrics | null {
  // Get all events for this session
  const eventsStmt = db.prepare(`
    SELECT timestamp, hook_event_type
    FROM events
    WHERE source_app = ? AND session_id = ?
    ORDER BY timestamp ASC
  `);
  const events = eventsStmt.all(sourceApp, sessionId) as any[];

  if (events.length === 0) return null;

  // Get tool analytics for this session
  const toolStatsStmt = db.prepare(`
    SELECT COUNT(*) as total_uses, SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successes
    FROM tool_analytics
    WHERE source_app = ? AND session_id = ?
  `);
  const toolStats = toolStatsStmt.get(sourceApp, sessionId) as any;

  // Calculate metrics
  const totalEvents = events.length;
  const totalToolUses = toolStats?.total_uses || 0;
  const successes = toolStats?.successes || 0;

  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  const sessionDuration = lastEvent.timestamp - firstEvent.timestamp;

  // Calculate success rate
  const successRate = totalToolUses > 0 ? (successes / totalToolUses) * 100 : null;

  // Calculate tools per task (rough estimate: events that use tools)
  const toolsPerTask = totalEvents > 0 ? totalToolUses / totalEvents : null;

  // Calculate average response time (time between consecutive events)
  let totalResponseTime = 0;
  let responseCount = 0;
  for (let i = 1; i < events.length; i++) {
    const timeDiff = events[i].timestamp - events[i - 1].timestamp;
    if (timeDiff < 300000) { // Only count if less than 5 minutes (filters out long pauses)
      totalResponseTime += timeDiff;
      responseCount++;
    }
  }
  const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : null;

  const metrics: PerformanceMetrics = {
    source_app: sourceApp,
    session_id: sessionId,
    avg_response_time: avgResponseTime,
    tools_per_task: toolsPerTask,
    success_rate: successRate,
    session_duration: sessionDuration,
    total_events: totalEvents,
    total_tool_uses: totalToolUses,
    calculated_at: Date.now()
  };

  upsertPerformanceMetrics(metrics);
  return metrics;
}

// Event Pattern Detection functions
export function upsertDetectedPattern(pattern: DetectedPattern): void {
  const stmt = db.prepare(`
    INSERT INTO detected_patterns (
      source_app, session_id, pattern_type, pattern_name, description,
      occurrences, first_seen, last_seen, example_sequence, confidence_score
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_app, session_id, pattern_type, pattern_name) DO UPDATE SET
      occurrences = occurrences + 1,
      last_seen = excluded.last_seen,
      example_sequence = excluded.example_sequence,
      confidence_score = excluded.confidence_score
  `);

  stmt.run(
    pattern.source_app,
    pattern.session_id,
    pattern.pattern_type,
    pattern.pattern_name,
    pattern.description,
    pattern.occurrences || 1,
    pattern.first_seen || Date.now(),
    pattern.last_seen || Date.now(),
    pattern.example_sequence || null,
    pattern.confidence_score || null
  );
}

export function getDetectedPatterns(sourceApp: string, sessionId: string): DetectedPattern[] {
  const stmt = db.prepare('SELECT * FROM detected_patterns WHERE source_app = ? AND session_id = ? ORDER BY occurrences DESC');
  const rows = stmt.all(sourceApp, sessionId) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    pattern_type: row.pattern_type,
    pattern_name: row.pattern_name,
    description: row.description,
    occurrences: row.occurrences,
    first_seen: row.first_seen,
    last_seen: row.last_seen,
    example_sequence: row.example_sequence,
    confidence_score: row.confidence_score
  }));
}

export function getAllDetectedPatterns(sourceApp?: string): DetectedPattern[] {
  let sql = 'SELECT * FROM detected_patterns';
  const params: any[] = [];

  if (sourceApp) {
    sql += ' WHERE source_app = ?';
    params.push(sourceApp);
  }

  sql += ' ORDER BY occurrences DESC, last_seen DESC';

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    pattern_type: row.pattern_type,
    pattern_name: row.pattern_name,
    description: row.description,
    occurrences: row.occurrences,
    first_seen: row.first_seen,
    last_seen: row.last_seen,
    example_sequence: row.example_sequence,
    confidence_score: row.confidence_score
  }));
}

export function getTrendingPatterns(limit: number = 10, sourceApp?: string): DetectedPattern[] {
  let sql = `
    SELECT *
    FROM detected_patterns
    WHERE 1=1
  `;
  const params: any[] = [];

  if (sourceApp) {
    sql += ' AND source_app = ?';
    params.push(sourceApp);
  }

  sql += ' ORDER BY occurrences DESC, confidence_score IS NULL, confidence_score DESC LIMIT ?';
  params.push(limit);

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    pattern_type: row.pattern_type,
    pattern_name: row.pattern_name,
    description: row.description,
    occurrences: row.occurrences,
    first_seen: row.first_seen,
    last_seen: row.last_seen,
    example_sequence: row.example_sequence,
    confidence_score: row.confidence_score
  }));
}

export function detectAndStorePatterns(sourceApp: string, sessionId: string): DetectedPattern[] {
  // Get all events for this session in order
  const stmt = db.prepare(`
    SELECT hook_event_type, timestamp
    FROM events
    WHERE source_app = ? AND session_id = ?
    ORDER BY timestamp ASC
  `);
  const events = stmt.all(sourceApp, sessionId) as any[];

  if (events.length < 2) return [];

  const detectedPatterns: DetectedPattern[] = [];
  const eventTypes = events.map(e => e.hook_event_type);

  // Pattern 1: Read-before-Edit pattern
  for (let i = 0; i < eventTypes.length - 1; i++) {
    if (eventTypes[i] === 'PostToolUse' && eventTypes[i + 1] === 'PostToolUse') {
      // Check if it's a Read followed by Edit pattern
      const firstRow = db.prepare('SELECT payload FROM events WHERE source_app = ? AND session_id = ? ORDER BY timestamp LIMIT 1 OFFSET ?').get(sourceApp, sessionId, i) as any;
      const secondRow = db.prepare('SELECT payload FROM events WHERE source_app = ? AND session_id = ? ORDER BY timestamp LIMIT 1 OFFSET ?').get(sourceApp, sessionId, i + 1) as any;

      const firstPayload = firstRow ? JSON.parse(firstRow.payload) : null;
      const secondPayload = secondRow ? JSON.parse(secondRow.payload) : null;

      if (firstPayload && secondPayload) {
        const firstTool = firstPayload.tool_name;
        const secondTool = secondPayload.tool_name;

        if (firstTool === 'Read' && (secondTool === 'Edit' || secondTool === 'Write')) {
          detectedPatterns.push({
            source_app: sourceApp,
            session_id: sessionId,
            pattern_type: 'workflow',
            pattern_name: 'read-before-edit',
            description: 'Agent reads a file before editing it',
            occurrences: 1,
            first_seen: events[i].timestamp,
            last_seen: events[i + 1].timestamp,
            example_sequence: JSON.stringify(['Read', secondTool]),
            confidence_score: 95
          });
        }
      }
    }
  }

  // Pattern 2: Grep-then-Read pattern
  for (let i = 0; i < eventTypes.length - 1; i++) {
    if (eventTypes[i] === 'PostToolUse' && eventTypes[i + 1] === 'PostToolUse') {
      const firstRow = db.prepare('SELECT payload FROM events WHERE source_app = ? AND session_id = ? ORDER BY timestamp LIMIT 1 OFFSET ?').get(sourceApp, sessionId, i) as any;
      const secondRow = db.prepare('SELECT payload FROM events WHERE source_app = ? AND session_id = ? ORDER BY timestamp LIMIT 1 OFFSET ?').get(sourceApp, sessionId, i + 1) as any;

      const firstPayload = firstRow ? JSON.parse(firstRow.payload) : null;
      const secondPayload = secondRow ? JSON.parse(secondRow.payload) : null;

      if (firstPayload && secondPayload) {
        const firstTool = firstPayload.tool_name;
        const secondTool = secondPayload.tool_name;

        if ((firstTool === 'Grep' || firstTool === 'Glob') && secondTool === 'Read') {
          detectedPatterns.push({
            source_app: sourceApp,
            session_id: sessionId,
            pattern_type: 'workflow',
            pattern_name: 'search-then-read',
            description: 'Agent searches for files/content before reading',
            occurrences: 1,
            first_seen: events[i].timestamp,
            last_seen: events[i + 1].timestamp,
            example_sequence: JSON.stringify([firstTool, 'Read']),
            confidence_score: 90
          });
        }
      }
    }
  }

  // Pattern 3: Retry pattern (same tool used multiple times in sequence)
  let currentTool = null;
  let retryCount = 0;
  let retryStart = 0;

  for (let i = 0; i < events.length; i++) {
    if (eventTypes[i] === 'PostToolUse') {
      const row = db.prepare('SELECT payload FROM events WHERE source_app = ? AND session_id = ? ORDER BY timestamp LIMIT 1 OFFSET ?').get(sourceApp, sessionId, i) as any;
      const payload = row ? JSON.parse(row.payload) : null;
      if (payload) {
        const toolName = payload.tool_name;

        if (toolName === currentTool) {
          retryCount++;
        } else {
          if (retryCount >= 2) {
            detectedPatterns.push({
              source_app: sourceApp,
              session_id: sessionId,
              pattern_type: 'retry',
              pattern_name: 'tool-retry',
              description: `Agent retried ${currentTool} ${retryCount + 1} times`,
              occurrences: retryCount,
              first_seen: events[retryStart].timestamp,
              last_seen: events[i - 1].timestamp,
              example_sequence: JSON.stringify(Array(retryCount + 1).fill(currentTool)),
              confidence_score: 85
            });
          }

          currentTool = toolName;
          retryCount = 0;
          retryStart = i;
        }
      }
    }
  }

  // Store all detected patterns
  detectedPatterns.forEach(pattern => upsertDetectedPattern(pattern));

  return detectedPatterns;
}

// ========================================
// Priority 2 & 3 Database Functions
// ========================================

// Webhook Functions (P2)
export function createWebhook(webhook: any): number {
  const stmt = db.prepare(`
    INSERT INTO webhooks (name, url, event_type, source_app, enabled, secret, created_at, filters)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    webhook.name,
    webhook.url,
    webhook.event_type,
    webhook.source_app || null,
    webhook.enabled ? 1 : 0,
    webhook.secret || null,
    Date.now(),
    webhook.filters ? JSON.stringify(webhook.filters) : null
  );

  return result.lastInsertRowid as number;
}

export function getWebhook(id: number): any | null {
  const stmt = db.prepare('SELECT * FROM webhooks WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    event_type: row.event_type,
    source_app: row.source_app,
    enabled: row.enabled === 1,
    secret: row.secret,
    created_at: row.created_at,
    filters: row.filters ? JSON.parse(row.filters) : undefined
  };
}

export function getAllWebhooks(): any[] {
  const stmt = db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC');
  const rows = stmt.all() as any[];

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    url: row.url,
    event_type: row.event_type,
    source_app: row.source_app,
    enabled: row.enabled === 1,
    secret: row.secret,
    created_at: row.created_at,
    filters: row.filters ? JSON.parse(row.filters) : undefined
  }));
}

export function updateWebhook(id: number, updates: any): boolean {
  const stmt = db.prepare(`
    UPDATE webhooks
    SET name = ?, url = ?, event_type = ?, source_app = ?, enabled = ?, secret = ?, filters = ?
    WHERE id = ?
  `);

  const result = stmt.run(
    updates.name,
    updates.url,
    updates.event_type,
    updates.source_app || null,
    updates.enabled ? 1 : 0,
    updates.secret || null,
    updates.filters ? JSON.stringify(updates.filters) : null,
    id
  );

  return result.changes > 0;
}

export function deleteWebhook(id: number): boolean {
  const stmt = db.prepare('DELETE FROM webhooks WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function getWebhooksForEvent(eventType: string, sourceApp?: string): any[] {
  let sql = 'SELECT * FROM webhooks WHERE enabled = 1 AND (event_type = ? OR event_type = ?)';
  const params: any[] = [eventType, '*'];

  if (sourceApp) {
    sql += ' AND (source_app = ? OR source_app IS NULL)';
    params.push(sourceApp);
  }

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    url: row.url,
    event_type: row.event_type,
    source_app: row.source_app,
    enabled: row.enabled === 1,
    secret: row.secret,
    created_at: row.created_at,
    filters: row.filters ? JSON.parse(row.filters) : undefined
  }));
}

export function createWebhookDelivery(delivery: any): number {
  const stmt = db.prepare(`
    INSERT INTO webhook_deliveries (webhook_id, event_id, status, response_code, response_body, attempted_at, retry_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    delivery.webhook_id,
    delivery.event_id,
    delivery.status,
    delivery.response_code || null,
    delivery.response_body || null,
    Date.now(),
    delivery.retry_count || 0
  );

  return result.lastInsertRowid as number;
}

export function getWebhookDeliveries(webhookId: number, limit: number = 50): any[] {
  const stmt = db.prepare(`
    SELECT * FROM webhook_deliveries
    WHERE webhook_id = ?
    ORDER BY attempted_at DESC
    LIMIT ?
  `);

  return stmt.all(webhookId, limit) as any[];
}

export function getWebhookDeliveryStats(webhookId: number): any {
  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count
    FROM webhook_deliveries
    WHERE webhook_id = ?
  `);

  return stmt.get(webhookId);
}

// Session Comparison Functions (P2)
export function createSessionComparison(comparison: any): number {
  const stmt = db.prepare(`
    INSERT INTO session_comparisons (name, description, session_ids, created_at, created_by)
    VALUES (?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    comparison.name,
    comparison.description || null,
    JSON.stringify(comparison.session_ids),
    Date.now(),
    comparison.created_by || null
  );

  return result.lastInsertRowid as number;
}

export function getSessionComparison(id: number): any | null {
  const stmt = db.prepare('SELECT * FROM session_comparisons WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    session_ids: JSON.parse(row.session_ids),
    created_at: row.created_at,
    created_by: row.created_by
  };
}

export function getAllSessionComparisons(): any[] {
  const stmt = db.prepare('SELECT * FROM session_comparisons ORDER BY created_at DESC');
  const rows = stmt.all() as any[];

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    session_ids: JSON.parse(row.session_ids),
    created_at: row.created_at,
    created_by: row.created_by
  }));
}

export function deleteSessionComparison(id: number): boolean {
  // Delete associated notes first
  db.prepare('DELETE FROM comparison_notes WHERE comparison_id = ?').run(id);

  // Delete comparison
  const stmt = db.prepare('DELETE FROM session_comparisons WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function addComparisonNote(comparisonId: number, note: string): number {
  const stmt = db.prepare(`
    INSERT INTO comparison_notes (comparison_id, note, timestamp)
    VALUES (?, ?, ?)
  `);

  const result = stmt.run(comparisonId, note, Date.now());
  return result.lastInsertRowid as number;
}

export function getComparisonNotes(comparisonId: number): any[] {
  const stmt = db.prepare(`
    SELECT * FROM comparison_notes
    WHERE comparison_id = ?
    ORDER BY timestamp DESC
  `);

  return stmt.all(comparisonId) as any[];
}

export function deleteComparisonNote(id: number): boolean {
  const stmt = db.prepare('DELETE FROM comparison_notes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// Agent Relationship Functions (P3)
export function createAgentRelationship(relationship: any): number {
  const stmt = db.prepare(`
    INSERT INTO agent_relationships (
      parent_source_app, parent_session_id, child_source_app, child_session_id,
      relationship_type, task_description, delegation_reason, started_at, completed_at, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    relationship.parent_source_app,
    relationship.parent_session_id,
    relationship.child_source_app,
    relationship.child_session_id,
    relationship.relationship_type || 'subagent',
    relationship.task_description || null,
    relationship.delegation_reason || null,
    relationship.started_at || null,
    relationship.completed_at || null,
    Date.now()
  );

  return result.lastInsertRowid as number;
}

export function getChildSessions(parentSessionId: string): any[] {
  const stmt = db.prepare(`
    SELECT * FROM agent_relationships
    WHERE parent_session_id = ?
    ORDER BY created_at ASC
  `);

  return stmt.all(parentSessionId) as any[];
}

export function getParentSession(childSessionId: string): any | null {
  const stmt = db.prepare(`
    SELECT * FROM agent_relationships
    WHERE child_session_id = ?
    LIMIT 1
  `);

  return stmt.get(childSessionId) as any;
}

export function getAllAgentRelationships(): any[] {
  const stmt = db.prepare('SELECT * FROM agent_relationships ORDER BY created_at DESC');
  return stmt.all() as any[];
}

export function createCollaborationMetric(metric: any): number {
  const stmt = db.prepare(`
    INSERT INTO collaboration_metrics (relationship_id, metric_type, metric_value)
    VALUES (?, ?, ?)
  `);

  const result = stmt.run(
    metric.relationship_id,
    metric.metric_type,
    metric.metric_value
  );

  return result.lastInsertRowid as number;
}

export function getCollaborationMetrics(relationshipId: number): any[] {
  const stmt = db.prepare(`
    SELECT * FROM collaboration_metrics
    WHERE relationship_id = ?
  `);

  return stmt.all(relationshipId) as any[];
}

// Export helper function to get session data for export
export function getSessionExportData(sessionId: string, sourceApp?: string): any {
  let eventsSql = 'SELECT * FROM events WHERE session_id = ?';
  let params: any[] = [sessionId];

  if (sourceApp) {
    eventsSql += ' AND source_app = ?';
    params.push(sourceApp);
  }

  eventsSql += ' ORDER BY timestamp ASC';

  const events = db.prepare(eventsSql).all(...params) as any[];

  if (events.length === 0) {
    return null;
  }

  // Use the source_app from the first event to ensure consistency
  const actualSourceApp = events[0].source_app;

  // Get metrics - filter by both session_id and source_app
  const metricsStmt = db.prepare('SELECT * FROM session_metrics WHERE session_id = ? AND source_app = ? LIMIT 1');
  const metrics = metricsStmt.get(sessionId, actualSourceApp) as any;

  // Get performance metrics - filter by both session_id and source_app
  const perfStmt = db.prepare('SELECT * FROM performance_metrics WHERE session_id = ? AND source_app = ? LIMIT 1');
  const performance = perfStmt.get(sessionId, actualSourceApp) as any;

  // Get patterns - filter by both session_id and source_app
  const patternsStmt = db.prepare('SELECT * FROM detected_patterns WHERE session_id = ? AND source_app = ?');
  const patterns = patternsStmt.all(sessionId, actualSourceApp) as any[];

  // Get tool analytics - filter by both session_id and source_app
  const analyticsStmt = db.prepare('SELECT * FROM tool_analytics WHERE session_id = ? AND source_app = ?');
  const analytics = analyticsStmt.all(sessionId, actualSourceApp) as any[];

  // Get bookmarks and tags - filter by both session_id and source_app
  const bookmarkStmt = db.prepare('SELECT * FROM session_bookmarks WHERE session_id = ? AND source_app = ? LIMIT 1');
  const bookmark = bookmarkStmt.get(sessionId, actualSourceApp) as any;

  const tagsStmt = db.prepare('SELECT * FROM session_tags WHERE session_id = ? AND source_app = ?');
  const tags = tagsStmt.all(sessionId, actualSourceApp) as any[];

  return {
    source_app: actualSourceApp,
    session_id: sessionId,
    events: events.map(e => ({
      ...e,
      payload: JSON.parse(e.payload),
      chat: e.chat ? JSON.parse(e.chat) : undefined
    })),
    metrics,
    performance,
    patterns,
    analytics,
    bookmark,
    tags
  };
}

export { db };