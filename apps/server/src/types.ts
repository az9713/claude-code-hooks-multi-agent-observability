// New interface for human-in-the-loop requests
export interface HumanInTheLoop {
  question: string;
  responseWebSocketUrl: string;
  type: 'question' | 'permission' | 'choice';
  choices?: string[]; // For multiple choice questions
  timeout?: number; // Optional timeout in seconds
  requiresResponse?: boolean; // Whether response is required or optional
}

// Response interface
export interface HumanInTheLoopResponse {
  response?: string;
  permission?: boolean;
  choice?: string; // Selected choice from options
  hookEvent: HookEvent;
  respondedAt: number;
  respondedBy?: string; // Optional user identifier
}

// Status tracking interface
export interface HumanInTheLoopStatus {
  status: 'pending' | 'responded' | 'timeout' | 'error';
  respondedAt?: number;
  response?: HumanInTheLoopResponse;
}

export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp?: number;
  model_name?: string;
  token_count?: number;
  estimated_cost?: number;

  // NEW: Optional HITL data
  humanInTheLoop?: HumanInTheLoop;
  humanInTheLoopStatus?: HumanInTheLoopStatus;
}

export interface FilterOptions {
  source_apps: string[];
  session_ids: string[];
  hook_event_types: string[];
}

// Theme-related interfaces for server-side storage and API
export interface ThemeColors {
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryDark: string;
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgQuaternary: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textQuaternary: string;
  borderPrimary: string;
  borderSecondary: string;
  borderTertiary: string;
  accentSuccess: string;
  accentWarning: string;
  accentError: string;
  accentInfo: string;
  shadow: string;
  shadowLg: string;
  hoverBg: string;
  activeBg: string;
  focusRing: string;
}

export interface Theme {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  colors: ThemeColors;
  isPublic: boolean;
  authorId?: string;
  authorName?: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  downloadCount?: number;
  rating?: number;
  ratingCount?: number;
}

export interface ThemeSearchQuery {
  query?: string;
  tags?: string[];
  authorId?: string;
  isPublic?: boolean;
  sortBy?: 'name' | 'created' | 'updated' | 'downloads' | 'rating';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ThemeShare {
  id: string;
  themeId: string;
  shareToken: string;
  expiresAt?: number;
  isPublic: boolean;
  allowedUsers: string[];
  createdAt: number;
  accessCount: number;
}

export interface ThemeRating {
  id: string;
  themeId: string;
  userId: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: number;
}

export interface ThemeValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  validationErrors?: ThemeValidationError[];
}

// Session Metrics interfaces
export interface SessionMetrics {
  id?: number;
  source_app: string;
  session_id: string;
  total_tokens: number;
  total_cost: number;
  message_count: number;
  start_time?: number;
  end_time?: number;
  model_name?: string;
}

// Tool Analytics interfaces
export interface ToolAnalytics {
  id?: number;
  source_app: string;
  session_id: string;
  tool_name: string;
  success: boolean;
  error_type?: string;
  error_message?: string;
  timestamp: number;
  event_id?: number;
}

export interface ToolStats {
  tool_name: string;
  total_uses: number;
  successes: number;
  failures: number;
  success_rate: number;
  most_common_error?: string;
}

export interface ErrorSummary {
  error_type: string;
  count: number;
  tool_name: string;
  recent_message?: string;
}

// Session Bookmarking & Tagging interfaces
export interface SessionBookmark {
  id?: number;
  source_app: string;
  session_id: string;
  bookmarked: boolean;
  bookmarked_at?: number;
  notes?: string;
}

export interface SessionTag {
  id?: number;
  source_app: string;
  session_id: string;
  tag: string;
  created_at: number;
}

// Agent Performance Metrics interfaces
export interface PerformanceMetrics {
  id?: number;
  source_app: string;
  session_id: string;
  avg_response_time?: number; // milliseconds
  tools_per_task?: number;
  success_rate?: number; // percentage
  session_duration?: number; // milliseconds
  total_events: number;
  total_tool_uses: number;
  calculated_at: number;
}

// Event Pattern Detection interfaces
export interface DetectedPattern {
  id?: number;
  source_app: string;
  session_id: string;
  pattern_type: string;
  pattern_name: string;
  description: string;
  occurrences: number;
  first_seen: number;
  last_seen: number;
  example_sequence?: string; // JSON string of event types
  confidence_score?: number; // 0-100
}

// Webhook/Alert System interfaces (P2)
export interface Webhook {
  id?: number;
  name: string;
  url: string;
  event_type: string; // 'PreToolUse', 'Stop', 'Error', '*' for all
  source_app?: string; // Optional: filter by app
  enabled: boolean;
  secret?: string; // For signature verification
  created_at: number;
  filters?: WebhookFilters;
}

export interface WebhookFilters {
  tool_names?: string[]; // Only trigger for specific tools
  error_types?: string[]; // Only trigger for specific errors
  session_ids?: string[]; // Only trigger for specific sessions
}

export interface WebhookDelivery {
  id?: number;
  webhook_id: number;
  event_id: number;
  status: 'pending' | 'success' | 'failed';
  response_code?: number;
  response_body?: string;
  attempted_at: number;
  retry_count?: number;
}

// Session Export interfaces (P2)
export interface ExportOptions {
  includeChat?: boolean;
  includeMetrics?: boolean;
  includePatterns?: boolean;
  includeAnalytics?: boolean;
}

// Session Comparison interfaces (P2)
export interface SessionComparison {
  id?: number;
  name: string;
  description?: string;
  session_ids: string; // JSON array
  created_at: number;
  created_by?: string;
}

export interface ComparisonNote {
  id?: number;
  comparison_id: number;
  note: string;
  timestamp: number;
}

export interface ComparisonResult {
  sessions: SessionSummary[];
  metrics_comparison: MetricsComparison;
  pattern_differences: PatternDifference[];
  tool_usage_comparison: ToolUsageComparison;
  efficiency_score: EfficiencyScore;
  recommendations: string[];
}

export interface SessionSummary {
  source_app: string;
  session_id: string;
  model_name?: string;
  duration: number;
  event_count: number;
  prompt_count: number;
  tool_count: number;
  start_time: number;
  end_time?: number;
}

export interface MetricsComparison {
  response_times: number[];
  token_usage: number[];
  costs: number[];
  tool_counts: number[];
  success_rates: number[];
  winner?: string; // session_id of best overall
}

export interface PatternDifference {
  pattern_id: string;
  occurrences_by_session: number[];
  variance: number;
}

export interface ToolUsageComparison {
  tools: string[];
  usage_by_session: { [tool: string]: number[] };
}

export interface EfficiencyScore {
  by_session: number[];
  overall_winner?: string;
}

// Decision Tree interfaces (P3)
export interface DecisionNode {
  id: string;
  type: 'prompt' | 'decision' | 'tool' | 'result' | 'completion';
  label: string;
  timestamp: number;
  event_id?: number;
  metadata?: any;
}

export interface DecisionEdge {
  from: string;
  to: string;
  type: 'triggers' | 'uses' | 'produces' | 'leads_to';
  label?: string;
}

export interface DecisionTree {
  nodes: DecisionNode[];
  edges: DecisionEdge[];
  root: string;
}

// Multi-Agent Collaboration interfaces (P3)
export interface AgentRelationship {
  id?: number;
  parent_source_app: string;
  parent_session_id: string;
  child_source_app: string;
  child_session_id: string;
  relationship_type: string; // 'subagent', 'parallel', 'sequential'
  task_description?: string;
  delegation_reason?: string;
  started_at?: number;
  completed_at?: number;
  created_at: number;
}

export interface AgentNode {
  source_app: string;
  session_id: string;
  children: AgentNode[];
  metrics: {
    total_events: number;
    duration: number;
    tool_count: number;
    depth: number;
  };
  task_description?: string;
}

export interface CollaborationAnalysis {
  max_depth: number;
  total_agents: number;
  avg_children_per_node: number;
  parallel_work_detected: boolean;
  task_decomposition_quality: number;
  collaboration_efficiency: number;
}

export interface CollaborationMetric {
  id?: number;
  relationship_id: number;
  metric_type: string; // 'duration', 'depth', 'breadth', 'efficiency'
  metric_value: number;
}