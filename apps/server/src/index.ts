import {
  initDatabase,
  insertEvent,
  getFilterOptions,
  getRecentEvents,
  updateEventHITLResponse,
  upsertSessionMetrics,
  getSessionMetrics,
  getAllSessionMetrics,
  insertToolAnalytics,
  getToolStats,
  getErrorSummary,
  upsertSessionBookmark,
  getSessionBookmark,
  getAllBookmarkedSessions,
  deleteSessionBookmark,
  insertSessionTag,
  getSessionTags,
  getAllTags,
  getSessionsByTag,
  deleteSessionTag,
  upsertPerformanceMetrics,
  getPerformanceMetrics,
  getAllPerformanceMetrics,
  calculateAndStorePerformanceMetrics,
  upsertDetectedPattern,
  getDetectedPatterns,
  getAllDetectedPatterns,
  getTrendingPatterns,
  detectAndStorePatterns,
  // Priority 2 & 3 functions
  createWebhook,
  getWebhook,
  getAllWebhooks,
  updateWebhook,
  deleteWebhook,
  getWebhooksForEvent,
  createWebhookDelivery,
  getWebhookDeliveries,
  getWebhookDeliveryStats,
  createSessionComparison,
  getSessionComparison,
  getAllSessionComparisons,
  deleteSessionComparison,
  addComparisonNote,
  getComparisonNotes,
  deleteComparisonNote,
  createAgentRelationship,
  getChildSessions,
  getParentSession,
  getAllAgentRelationships,
  createCollaborationMetric,
  getCollaborationMetrics,
  getSessionExportData
} from './db';
import type {
  HookEvent,
  HumanInTheLoopResponse,
  SessionMetrics,
  ToolAnalytics,
  SessionBookmark,
  SessionTag,
  PerformanceMetrics,
  DetectedPattern
} from './types';
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

// Helper function to send response to agent via WebSocket
async function sendResponseToAgent(
  wsUrl: string,
  response: HumanInTheLoopResponse
): Promise<void> {
  console.log(`[HITL] Connecting to agent WebSocket: ${wsUrl}`);

  return new Promise((resolve, reject) => {
    let ws: WebSocket | null = null;
    let isResolved = false;

    const cleanup = () => {
      if (ws) {
        try {
          ws.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    };

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (isResolved) return;
        console.log('[HITL] WebSocket connection opened, sending response...');

        try {
          ws!.send(JSON.stringify(response));
          console.log('[HITL] Response sent successfully');

          // Wait longer to ensure message fully transmits before closing
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

      ws.onerror = (error) => {
        console.error('[HITL] WebSocket error:', error);
        cleanup();
        if (!isResolved) {
          isResolved = true;
          reject(error);
        }
      };

      ws.onclose = () => {
        console.log('[HITL] WebSocket connection closed');
      };

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!isResolved) {
          console.error('[HITL] Timeout sending response to agent');
          cleanup();
          isResolved = true;
          reject(new Error('Timeout sending response to agent'));
        }
      }, 5000);

    } catch (error) {
      console.error('[HITL] Error creating WebSocket:', error);
      cleanup();
      if (!isResolved) {
        isResolved = true;
        reject(error);
      }
    }
  });
}

// ========================================
// Priority 2 & 3 Helper Functions
// ========================================

// Generate Markdown report for session export
function generateMarkdownReport(sessionData: any): string {
  const formatTimestamp = (ts: number) => new Date(ts).toLocaleString();
  const formatDuration = (ms: number) => `${(ms / 1000 / 60).toFixed(2)} minutes`;

  let markdown = `# Session Report: ${sessionData.source_app}\n\n`;
  markdown += `**Session ID:** ${sessionData.session_id}\n`;
  markdown += `**Events:** ${sessionData.events.length}\n`;

  if (sessionData.events.length > 0) {
    markdown += `**Start Time:** ${formatTimestamp(sessionData.events[0].timestamp)}\n`;
    const lastEvent = sessionData.events[sessionData.events.length - 1];
    markdown += `**End Time:** ${formatTimestamp(lastEvent.timestamp)}\n`;
    const duration = lastEvent.timestamp - sessionData.events[0].timestamp;
    markdown += `**Duration:** ${formatDuration(duration)}\n`;
  }

  if (sessionData.metrics) {
    markdown += `\n## Metrics\n\n`;
    markdown += `- **Total Tokens:** ${sessionData.metrics.total_tokens || 'N/A'}\n`;
    markdown += `- **Total Cost:** $${(sessionData.metrics.total_cost || 0).toFixed(4)}\n`;
    markdown += `- **Message Count:** ${sessionData.metrics.message_count || 'N/A'}\n`;
    markdown += `- **Model:** ${sessionData.metrics.model_name || 'N/A'}\n`;
  }

  if (sessionData.performance) {
    markdown += `\n## Performance\n\n`;
    markdown += `- **Avg Response Time:** ${sessionData.performance.avg_response_time || 'N/A'} ms\n`;
    markdown += `- **Tools Per Task:** ${sessionData.performance.tools_per_task || 'N/A'}\n`;
    markdown += `- **Success Rate:** ${sessionData.performance.success_rate || 'N/A'}%\n`;
  }

  if (sessionData.patterns && sessionData.patterns.length > 0) {
    markdown += `\n## Detected Patterns\n\n`;
    sessionData.patterns.forEach((p: any) => {
      markdown += `### ${p.pattern_name}\n`;
      markdown += `- **Description:** ${p.description}\n`;
      markdown += `- **Occurrences:** ${p.occurrences}\n`;
      markdown += `- **Confidence:** ${p.confidence_score || 'N/A'}%\n\n`;
    });
  }

  markdown += `\n## Event Timeline\n\n`;
  sessionData.events.forEach((event: any, idx: number) => {
    markdown += `### ${idx + 1}. ${event.hook_event_type}\n`;
    markdown += `**Time:** ${formatTimestamp(event.timestamp)}\n\n`;
    if (event.summary) {
      markdown += `**Summary:** ${event.summary}\n\n`;
    }
    markdown += `---\n\n`;
  });

  markdown += `\n*Generated by Multi-Agent Observability System*\n`;
  markdown += `*Timestamp: ${new Date().toISOString()}*\n`;

  return markdown;
}

// Generate HTML report for session export
function generateHTMLReport(sessionData: any): string {
  const formatTimestamp = (ts: number) => new Date(ts).toLocaleString();

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Session Report: ${sessionData.source_app}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    h1 { color: #333; border-bottom: 3px solid #4CAF50; padding-bottom: 10px; }
    h2 { color: #666; border-bottom: 2px solid #ddd; padding-bottom: 5px; margin-top: 30px; }
    .metadata { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
    .metric { display: inline-block; margin-right: 20px; }
    .event { border-left: 4px solid #4CAF50; padding-left: 15px; margin: 15px 0; }
    .pattern { background: #e8f5e9; padding: 10px; border-radius: 5px; margin: 10px 0; }
    .timestamp { color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <h1>Session Report</h1>
  <div class="metadata">
    <h3>Session Information</h3>
    <div class="metric"><strong>App:</strong> ${sessionData.source_app}</div>
    <div class="metric"><strong>Session ID:</strong> ${sessionData.session_id}</div>
    <div class="metric"><strong>Events:</strong> ${sessionData.events.length}</div>
  </div>

  ${sessionData.metrics ? `
  <h2>Metrics</h2>
  <div class="metadata">
    <div class="metric"><strong>Total Tokens:</strong> ${sessionData.metrics.total_tokens || 'N/A'}</div>
    <div class="metric"><strong>Total Cost:</strong> $${(sessionData.metrics.total_cost || 0).toFixed(4)}</div>
    <div class="metric"><strong>Model:</strong> ${sessionData.metrics.model_name || 'N/A'}</div>
  </div>
  ` : ''}

  ${sessionData.patterns && sessionData.patterns.length > 0 ? `
  <h2>Detected Patterns</h2>
  ${sessionData.patterns.map((p: any) => `
    <div class="pattern">
      <strong>${p.pattern_name}</strong>
      <p>${p.description}</p>
      <p><small>Occurrences: ${p.occurrences} | Confidence: ${p.confidence_score || 'N/A'}%</small></p>
    </div>
  `).join('')}
  ` : ''}

  <h2>Event Timeline</h2>
  ${sessionData.events.map((event: any, idx: number) => `
    <div class="event">
      <h4>${idx + 1}. ${event.hook_event_type}</h4>
      <div class="timestamp">${formatTimestamp(event.timestamp)}</div>
      ${event.summary ? `<p>${event.summary}</p>` : ''}
    </div>
  `).join('')}

  <p style="text-align: center; color: #999; margin-top: 40px;">
    Generated by Multi-Agent Observability System<br>
    ${new Date().toISOString()}
  </p>
</body>
</html>
  `.trim();
}

// Compare multiple sessions
function compareSessions(sessionIds: string[]): any {
  const sessions = sessionIds.map(id => getSessionExportData(id)).filter(Boolean);

  if (sessions.length < 2) {
    throw new Error('At least 2 valid sessions required');
  }

  // Calculate session summaries
  const summaries = sessions.map(s => ({
    source_app: s.source_app,
    session_id: s.session_id,
    model_name: s.metrics?.model_name,
    duration: s.events[s.events.length - 1].timestamp - s.events[0].timestamp,
    event_count: s.events.length,
    prompt_count: s.events.filter((e: any) => e.hook_event_type === 'UserPromptSubmit').length,
    tool_count: s.events.filter((e: any) => e.hook_event_type === 'PreToolUse').length,
    start_time: s.events[0].timestamp,
    end_time: s.events[s.events.length - 1].timestamp
  }));

  // Compare metrics
  const metricsComparison = {
    response_times: sessions.map(s => s.performance?.avg_response_time || 0),
    token_usage: sessions.map(s => s.metrics?.total_tokens || 0),
    costs: sessions.map(s => s.metrics?.total_cost || 0),
    tool_counts: summaries.map(s => s.tool_count),
    success_rates: sessions.map(s => s.performance?.success_rate || 0),
    winner: null as string | null
  };

  // Determine winner based on multiple factors
  const scores = sessions.map((s, idx) => {
    const cost = s.metrics?.total_cost || 0;
    const time = s.performance?.avg_response_time || 0;
    const success = s.performance?.success_rate || 0;
    // Lower cost and time is better, higher success is better
    return -(cost * 100) - (time / 10) + (success * 10);
  });
  const winnerIdx = scores.indexOf(Math.max(...scores));
  metricsComparison.winner = sessions[winnerIdx].session_id;

  // Compare patterns
  const allPatternTypes = new Set<string>();
  sessions.forEach(s => {
    (s.patterns || []).forEach((p: any) => allPatternTypes.add(p.pattern_name));
  });

  const patternDifferences = Array.from(allPatternTypes).map(patternName => {
    const occurrences = sessions.map(s => {
      const pattern = (s.patterns || []).find((p: any) => p.pattern_name === patternName);
      return pattern ? pattern.occurrences : 0;
    });

    const avg = occurrences.reduce((a, b) => a + b, 0) / occurrences.length;
    const variance = occurrences.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / occurrences.length;

    return {
      pattern_id: patternName,
      occurrences_by_session: occurrences,
      variance
    };
  });

  // Tool usage comparison
  const allTools = new Set<string>();
  sessions.forEach(s => {
    s.events.filter((e: any) => e.hook_event_type === 'PreToolUse').forEach((e: any) => {
      allTools.add(e.payload.tool_name);
    });
  });

  const toolUsageComparison = {
    tools: Array.from(allTools),
    usage_by_session: {} as any
  };

  allTools.forEach(tool => {
    toolUsageComparison.usage_by_session[tool] = sessions.map(s =>
      s.events.filter((e: any) => e.hook_event_type === 'PreToolUse' && e.payload.tool_name === tool).length
    );
  });

  // Efficiency scores (simple calculation based on tools/time ratio)
  const efficiencyScores = summaries.map(s =>
    s.tool_count / (s.duration / 1000 / 60) // tools per minute
  );

  return {
    sessions: summaries,
    metrics_comparison: metricsComparison,
    pattern_differences: patternDifferences,
    tool_usage_comparison: toolUsageComparison,
    efficiency_score: {
      by_session: efficiencyScores,
      overall_winner: summaries[efficiencyScores.indexOf(Math.max(...efficiencyScores))].session_id
    },
    recommendations: [
      `Session "${summaries[winnerIdx].source_app}:${summaries[winnerIdx].session_id.substring(0, 8)}" had the best overall performance`,
      `Average cost across sessions: $${(metricsComparison.costs.reduce((a, b) => a + b, 0) / sessions.length).toFixed(4)}`,
      `Average success rate: ${(metricsComparison.success_rates.reduce((a, b) => a + b, 0) / sessions.length).toFixed(1)}%`
    ]
  };
}

// Build decision tree from session events
function buildDecisionTree(sessionId: string, sourceApp?: string): any {
  const sessionData = getSessionExportData(sessionId, sourceApp);

  if (!sessionData || !sessionData.events) {
    return null;
  }

  const nodes: any[] = [];
  const edges: any[] = [];
  let previousNodeId: string | null = null;

  sessionData.events.forEach((event: any, idx: number) => {
    const nodeId = `node_${idx}`;

    if (event.hook_event_type === 'UserPromptSubmit') {
      nodes.push({
        id: nodeId,
        type: 'prompt',
        label: event.payload.prompt ? event.payload.prompt.substring(0, 50) + '...' : 'User Prompt',
        timestamp: event.timestamp,
        event_id: event.id
      });
    } else if (event.hook_event_type === 'PreToolUse') {
      nodes.push({
        id: nodeId,
        type: 'tool',
        label: event.payload.tool_name || 'Tool',
        timestamp: event.timestamp,
        event_id: event.id,
        metadata: event.payload.tool_input
      });
    } else if (event.hook_event_type === 'PostToolUse') {
      nodes.push({
        id: nodeId,
        type: 'result',
        label: 'Tool Result',
        timestamp: event.timestamp,
        event_id: event.id,
        metadata: event.payload
      });
    } else if (event.hook_event_type === 'Stop') {
      nodes.push({
        id: nodeId,
        type: 'completion',
        label: 'Response Complete',
        timestamp: event.timestamp,
        event_id: event.id
      });
    }

    if (previousNodeId && nodes.length > 0) {
      const edgeType = event.hook_event_type === 'PreToolUse' ? 'uses' :
                       event.hook_event_type === 'PostToolUse' ? 'produces' :
                       event.hook_event_type === 'Stop' ? 'leads_to' : 'triggers';

      edges.push({
        from: previousNodeId,
        to: nodeId,
        type: edgeType,
        label: nodes[nodes.length - 1].label
      });
    }

    previousNodeId = nodeId;
  });

  return {
    nodes,
    edges,
    root: nodes.length > 0 ? nodes[0].id : ''
  };
}

// Build agent hierarchy from relationships
function buildAgentHierarchy(sessionId: string): any {
  // This is a simplified version - would need to be recursive in production
  const children = getChildSessions(sessionId);

  return {
    source_app: 'unknown', // Would need to look this up from events
    session_id: sessionId,
    children: children.map((child: any) => ({
      source_app: child.child_source_app,
      session_id: child.child_session_id,
      children: [],
      metrics: {
        total_events: 0,
        duration: 0,
        tool_count: 0,
        depth: 1
      },
      task_description: child.task_description
    })),
    metrics: {
      total_events: 0,
      duration: 0,
      tool_count: 0,
      depth: 0
    }
  };
}

// Create Bun server with HTTP and WebSocket support
const server = Bun.serve({
  port: parseInt(process.env.SERVER_PORT || '4000'),
  
  async fetch(req: Request) {
    const url = new URL(req.url);
    
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
    
    // POST /events - Receive new events
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

        // Insert event into database
        const savedEvent = insertEvent(event);

        // Update session metrics if we have token/cost data
        if (event.token_count || event.estimated_cost) {
          const metrics: SessionMetrics = {
            source_app: event.source_app,
            session_id: event.session_id,
            total_tokens: event.token_count || 0,
            total_cost: event.estimated_cost || 0,
            message_count: 1,
            model_name: event.model_name
          };

          // Set start/end times based on event type
          if (event.hook_event_type === 'SessionStart') {
            metrics.start_time = event.timestamp || Date.now();
          } else if (event.hook_event_type === 'SessionEnd' || event.hook_event_type === 'Stop') {
            metrics.end_time = event.timestamp || Date.now();
          }

          upsertSessionMetrics(metrics);
        }

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
    
    // GET /events/filter-options - Get available filter options
    if (url.pathname === '/events/filter-options' && req.method === 'GET') {
      const options = getFilterOptions();
      return new Response(JSON.stringify(options), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // GET /events/recent - Get recent events
    if (url.pathname === '/events/recent' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '300');
      const events = getRecentEvents(limit);
      return new Response(JSON.stringify(events), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // POST /events/:id/respond - Respond to HITL request
    if (url.pathname.match(/^\/events\/\d+\/respond$/) && req.method === 'POST') {
      const id = parseInt(url.pathname.split('/')[2]);

      try {
        const response: HumanInTheLoopResponse = await req.json();
        response.respondedAt = Date.now();

        // Update event in database
        const updatedEvent = updateEventHITLResponse(id, response);

        if (!updatedEvent) {
          return new Response(JSON.stringify({ error: 'Event not found' }), {
            status: 404,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        // Send response to agent via WebSocket
        if (updatedEvent.humanInTheLoop?.responseWebSocketUrl) {
          try {
            await sendResponseToAgent(
              updatedEvent.humanInTheLoop.responseWebSocketUrl,
              response
            );
          } catch (error) {
            console.error('Failed to send response to agent:', error);
            // Don't fail the request if we can't reach the agent
          }
        }

        // Broadcast updated event to all connected clients
        const message = JSON.stringify({ type: 'event', data: updatedEvent });
        wsClients.forEach(client => {
          try {
            client.send(message);
          } catch (err) {
            wsClients.delete(client);
          }
        });

        return new Response(JSON.stringify(updatedEvent), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error processing HITL response:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // Theme API endpoints
    
    // POST /api/themes - Create a new theme
    if (url.pathname === '/api/themes' && req.method === 'POST') {
      try {
        const themeData = await req.json();
        const result = await createTheme(themeData);
        
        const status = result.success ? 201 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error creating theme:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid request body' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /api/themes - Search themes
    if (url.pathname === '/api/themes' && req.method === 'GET') {
      const query = {
        query: url.searchParams.get('query') || undefined,
        isPublic: url.searchParams.get('isPublic') ? url.searchParams.get('isPublic') === 'true' : undefined,
        authorId: url.searchParams.get('authorId') || undefined,
        sortBy: url.searchParams.get('sortBy') as any || undefined,
        sortOrder: url.searchParams.get('sortOrder') as any || undefined,
        limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
        offset: url.searchParams.get('offset') ? parseInt(url.searchParams.get('offset')!) : undefined,
      };
      
      const result = await searchThemes(query);
      return new Response(JSON.stringify(result), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // GET /api/themes/:id - Get a specific theme
    if (url.pathname.startsWith('/api/themes/') && req.method === 'GET') {
      const id = url.pathname.split('/')[3];
      if (!id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Theme ID is required' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      const result = await getThemeById(id);
      const status = result.success ? 200 : 404;
      return new Response(JSON.stringify(result), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // PUT /api/themes/:id - Update a theme
    if (url.pathname.startsWith('/api/themes/') && req.method === 'PUT') {
      const id = url.pathname.split('/')[3];
      if (!id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Theme ID is required' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const updates = await req.json();
        const result = await updateThemeById(id, updates);
        
        const status = result.success ? 200 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error updating theme:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid request body' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // DELETE /api/themes/:id - Delete a theme
    if (url.pathname.startsWith('/api/themes/') && req.method === 'DELETE') {
      const id = url.pathname.split('/')[3];
      if (!id) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Theme ID is required' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      const authorId = url.searchParams.get('authorId');
      const result = await deleteThemeById(id, authorId || undefined);
      
      const status = result.success ? 200 : (result.error?.includes('not found') ? 404 : 403);
      return new Response(JSON.stringify(result), {
        status,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
    
    // GET /api/themes/:id/export - Export a theme
    if (url.pathname.match(/^\/api\/themes\/[^\/]+\/export$/) && req.method === 'GET') {
      const id = url.pathname.split('/')[3];
      
      const result = await exportThemeById(id);
      if (!result.success) {
        const status = result.error?.includes('not found') ? 404 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify(result.data), {
        headers: { 
          ...headers, 
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${result.data.theme.name}.json"`
        }
      });
    }
    
    // POST /api/themes/import - Import a theme
    if (url.pathname === '/api/themes/import' && req.method === 'POST') {
      try {
        const importData = await req.json();
        const authorId = url.searchParams.get('authorId');
        
        const result = await importTheme(importData, authorId || undefined);
        
        const status = result.success ? 201 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error importing theme:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Invalid import data' 
        }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // GET /api/themes/stats - Get theme statistics
    if (url.pathname === '/api/themes/stats' && req.method === 'GET') {
      const result = await getThemeStats();
      return new Response(JSON.stringify(result), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Token Metrics API endpoints

    // GET /api/metrics/session/:sessionId - Get session metrics
    if (url.pathname.match(/^\/api\/metrics\/session\/[^\/]+$/) && req.method === 'GET') {
      const sessionId = url.pathname.split('/')[4];
      const metrics = getSessionMetrics(sessionId);

      if (!metrics) {
        return new Response(JSON.stringify({ error: 'Session metrics not found' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(metrics), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/metrics/sessions - Get all session metrics
    if (url.pathname === '/api/metrics/sessions' && req.method === 'GET') {
      const sourceApp = url.searchParams.get('source_app') || undefined;
      const metrics = getAllSessionMetrics(sourceApp);

      return new Response(JSON.stringify(metrics), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Tool Analytics API endpoints

    // POST /api/analytics/tools - Insert tool analytics
    if (url.pathname === '/api/analytics/tools' && req.method === 'POST') {
      try {
        const analytics: ToolAnalytics = await req.json();

        // Validate required fields
        if (!analytics.source_app || !analytics.session_id || !analytics.tool_name || analytics.success === undefined) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        // Set timestamp if not provided
        if (!analytics.timestamp) {
          analytics.timestamp = Date.now();
        }

        insertToolAnalytics(analytics);

        return new Response(JSON.stringify({ success: true }), {
          status: 201,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error inserting tool analytics:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/analytics/tools/stats - Get tool statistics
    if (url.pathname === '/api/analytics/tools/stats' && req.method === 'GET') {
      const sessionId = url.searchParams.get('session_id') || undefined;
      const sourceApp = url.searchParams.get('source_app') || undefined;

      const stats = getToolStats(sessionId, sourceApp);

      return new Response(JSON.stringify(stats), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/analytics/errors/summary - Get error summary
    if (url.pathname === '/api/analytics/errors/summary' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const errors = getErrorSummary(limit);

      return new Response(JSON.stringify(errors), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Session Bookmarking API endpoints

    // POST /api/bookmarks - Create or update a bookmark
    if (url.pathname === '/api/bookmarks' && req.method === 'POST') {
      try {
        const bookmark: SessionBookmark = await req.json();

        if (!bookmark.source_app || !bookmark.session_id) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        upsertSessionBookmark(bookmark);

        return new Response(JSON.stringify({ success: true }), {
          status: 201,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error creating bookmark:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/bookmarks - Get all bookmarked sessions
    if (url.pathname === '/api/bookmarks' && req.method === 'GET') {
      const sourceApp = url.searchParams.get('source_app') || undefined;
      const bookmarks = getAllBookmarkedSessions(sourceApp);

      return new Response(JSON.stringify(bookmarks), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/bookmarks/:sourceApp/:sessionId - Get a specific bookmark
    if (url.pathname.match(/^\/api\/bookmarks\/[^\/]+\/[^\/]+$/) && req.method === 'GET') {
      const parts = url.pathname.split('/');
      const sourceApp = parts[3];
      const sessionId = parts[4];

      const bookmark = getSessionBookmark(sourceApp, sessionId);

      if (!bookmark) {
        return new Response(JSON.stringify({ bookmarked: false }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(bookmark), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // DELETE /api/bookmarks/:sourceApp/:sessionId - Delete a bookmark
    if (url.pathname.match(/^\/api\/bookmarks\/[^\/]+\/[^\/]+$/) && req.method === 'DELETE') {
      const parts = url.pathname.split('/');
      const sourceApp = parts[3];
      const sessionId = parts[4];

      const success = deleteSessionBookmark(sourceApp, sessionId);

      return new Response(JSON.stringify({ success }), {
        status: success ? 200 : 404,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Session Tagging API endpoints

    // POST /api/tags - Add a tag to a session
    if (url.pathname === '/api/tags' && req.method === 'POST') {
      try {
        const tag: SessionTag = await req.json();

        if (!tag.source_app || !tag.session_id || !tag.tag) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        insertSessionTag(tag);

        return new Response(JSON.stringify({ success: true }), {
          status: 201,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('Error creating tag:', error);
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/tags/session/:sourceApp/:sessionId - Get tags for a session
    if (url.pathname.match(/^\/api\/tags\/session\/[^\/]+\/[^\/]+$/) && req.method === 'GET') {
      const parts = url.pathname.split('/');
      const sourceApp = parts[4];
      const sessionId = parts[5];

      const tags = getSessionTags(sourceApp, sessionId);

      return new Response(JSON.stringify(tags), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/tags/all - Get all unique tags
    if (url.pathname === '/api/tags/all' && req.method === 'GET') {
      const sourceApp = url.searchParams.get('source_app') || undefined;
      const tags = getAllTags(sourceApp);

      return new Response(JSON.stringify(tags), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/tags/:tag/sessions - Get sessions with a specific tag
    if (url.pathname.match(/^\/api\/tags\/[^\/]+\/sessions$/) && req.method === 'GET') {
      const tag = url.pathname.split('/')[3];
      const sourceApp = url.searchParams.get('source_app') || undefined;

      const sessions = getSessionsByTag(tag, sourceApp);

      return new Response(JSON.stringify(sessions), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // DELETE /api/tags/:sourceApp/:sessionId/:tag - Delete a tag from a session
    if (url.pathname.match(/^\/api\/tags\/[^\/]+\/[^\/]+\/[^\/]+$/) && req.method === 'DELETE') {
      const parts = url.pathname.split('/');
      const sourceApp = parts[3];
      const sessionId = parts[4];
      const tag = parts[5];

      const success = deleteSessionTag(sourceApp, sessionId, tag);

      return new Response(JSON.stringify({ success }), {
        status: success ? 200 : 404,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Performance Metrics API endpoints

    // GET /api/metrics/performance/:sourceApp/:sessionId - Get performance metrics for a session
    if (url.pathname.match(/^\/api\/metrics\/performance\/[^\/]+\/[^\/]+$/) && req.method === 'GET') {
      const parts = url.pathname.split('/');
      const sourceApp = parts[4];
      const sessionId = parts[5];

      const metrics = getPerformanceMetrics(sourceApp, sessionId);

      if (!metrics) {
        return new Response(JSON.stringify({ error: 'Performance metrics not found' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(metrics), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/metrics/performance/all - Get all performance metrics
    if (url.pathname === '/api/metrics/performance/all' && req.method === 'GET') {
      const sourceApp = url.searchParams.get('source_app') || undefined;
      const metrics = getAllPerformanceMetrics(sourceApp);

      return new Response(JSON.stringify(metrics), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/metrics/performance/calculate/:sourceApp/:sessionId - Calculate and store performance metrics
    if (url.pathname.match(/^\/api\/metrics\/performance\/calculate\/[^\/]+\/[^\/]+$/) && req.method === 'POST') {
      const parts = url.pathname.split('/');
      const sourceApp = parts[5];
      const sessionId = parts[6];

      const metrics = calculateAndStorePerformanceMetrics(sourceApp, sessionId);

      if (!metrics) {
        return new Response(JSON.stringify({ error: 'No events found for session' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(metrics), {
        status: 201,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // Event Pattern Detection API endpoints

    // GET /api/patterns/:sourceApp/:sessionId - Get detected patterns for a session
    if (url.pathname.match(/^\/api\/patterns\/[^\/]+\/[^\/]+$/) && req.method === 'GET') {
      const parts = url.pathname.split('/');
      const sourceApp = parts[3];
      const sessionId = parts[4];

      const patterns = getDetectedPatterns(sourceApp, sessionId);

      return new Response(JSON.stringify(patterns), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/patterns/all - Get all detected patterns
    if (url.pathname === '/api/patterns/all' && req.method === 'GET') {
      const sourceApp = url.searchParams.get('source_app') || undefined;
      const patterns = getAllDetectedPatterns(sourceApp);

      return new Response(JSON.stringify(patterns), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/patterns/trending - Get trending patterns
    if (url.pathname === '/api/patterns/trending' && req.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const sourceApp = url.searchParams.get('source_app') || undefined;

      const patterns = getTrendingPatterns(limit, sourceApp);

      return new Response(JSON.stringify(patterns), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/patterns/detect/:sourceApp/:sessionId - Detect and store patterns
    if (url.pathname.match(/^\/api\/patterns\/detect\/[^\/]+\/[^\/]+$/) && req.method === 'POST') {
      const parts = url.pathname.split('/');
      const sourceApp = parts[4];
      const sessionId = parts[5];

      const patterns = detectAndStorePatterns(sourceApp, sessionId);

      return new Response(JSON.stringify(patterns), {
        status: 201,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // ========================================
    // Priority 2: Webhook API endpoints
    // ========================================

    // POST /api/webhooks - Create webhook
    if (url.pathname === '/api/webhooks' && req.method === 'POST') {
      try {
        const webhook = await req.json();

        if (!webhook.name || !webhook.url || !webhook.event_type) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const id = createWebhook(webhook);

        return new Response(JSON.stringify({ id, success: true }), {
          status: 201,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/webhooks - List all webhooks
    if (url.pathname === '/api/webhooks' && req.method === 'GET') {
      const webhooks = getAllWebhooks();

      // Add delivery stats to each webhook
      const webhooksWithStats = webhooks.map(webhook => {
        const stats = getWebhookDeliveryStats(webhook.id);
        return { ...webhook, ...stats };
      });

      return new Response(JSON.stringify(webhooksWithStats), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/webhooks/:id - Get webhook by ID
    if (url.pathname.match(/^\/api\/webhooks\/\d+$/) && req.method === 'GET') {
      const id = parseInt(url.pathname.split('/')[3]);
      const webhook = getWebhook(id);

      if (!webhook) {
        return new Response(JSON.stringify({ error: 'Webhook not found' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(webhook), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // PUT /api/webhooks/:id - Update webhook
    if (url.pathname.match(/^\/api\/webhooks\/\d+$/) && req.method === 'PUT') {
      try {
        const id = parseInt(url.pathname.split('/')[3]);
        const updates = await req.json();

        const success = updateWebhook(id, updates);

        if (!success) {
          return new Response(JSON.stringify({ error: 'Webhook not found' }), {
            status: 404,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // DELETE /api/webhooks/:id - Delete webhook
    if (url.pathname.match(/^\/api\/webhooks\/\d+$/) && req.method === 'DELETE') {
      const id = parseInt(url.pathname.split('/')[3]);
      const success = deleteWebhook(id);

      if (!success) {
        return new Response(JSON.stringify({ error: 'Webhook not found' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/webhooks/:id/deliveries - Get webhook deliveries
    if (url.pathname.match(/^\/api\/webhooks\/\d+\/deliveries$/) && req.method === 'GET') {
      const id = parseInt(url.pathname.split('/')[3]);
      const limit = parseInt(url.searchParams.get('limit') || '50');

      const deliveries = getWebhookDeliveries(id, limit);

      return new Response(JSON.stringify(deliveries), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // ========================================
    // Priority 2: Session Export API endpoints
    // ========================================

    // GET /api/export/session/:sessionId - Export session in various formats
    if (url.pathname.match(/^\/api\/export\/session\/[^\/]+$/) && req.method === 'GET') {
      const sessionId = url.pathname.split('/')[4];
      const format = url.searchParams.get('format') || 'json';
      const sourceApp = url.searchParams.get('source_app') || undefined;

      const sessionData = getSessionExportData(sessionId, sourceApp);

      if (!sessionData) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      if (format === 'markdown') {
        const markdown = generateMarkdownReport(sessionData);
        return new Response(markdown, {
          headers: { ...headers, 'Content-Type': 'text/markdown', 'Content-Disposition': `attachment; filename="session-${sessionId}.md"` }
        });
      } else if (format === 'html') {
        const html = generateHTMLReport(sessionData);
        return new Response(html, {
          headers: { ...headers, 'Content-Type': 'text/html', 'Content-Disposition': `attachment; filename="session-${sessionId}.html"` }
        });
      } else {
        // JSON format
        return new Response(JSON.stringify(sessionData, null, 2), {
          headers: { ...headers, 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="session-${sessionId}.json"` }
        });
      }
    }

    // ========================================
    // Priority 2: Session Comparison API endpoints
    // ========================================

    // POST /api/comparisons - Create session comparison
    if (url.pathname === '/api/comparisons' && req.method === 'POST') {
      try {
        const comparison = await req.json();

        if (!comparison.name || !comparison.session_ids || !Array.isArray(comparison.session_ids)) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const id = createSessionComparison(comparison);

        return new Response(JSON.stringify({ id, success: true }), {
          status: 201,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/comparisons - List all comparisons
    if (url.pathname === '/api/comparisons' && req.method === 'GET') {
      const comparisons = getAllSessionComparisons();

      return new Response(JSON.stringify(comparisons), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/comparisons/:id - Get comparison by ID
    if (url.pathname.match(/^\/api\/comparisons\/\d+$/) && req.method === 'GET') {
      const id = parseInt(url.pathname.split('/')[3]);
      const comparison = getSessionComparison(id);

      if (!comparison) {
        return new Response(JSON.stringify({ error: 'Comparison not found' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(comparison), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // DELETE /api/comparisons/:id - Delete comparison
    if (url.pathname.match(/^\/api\/comparisons\/\d+$/) && req.method === 'DELETE') {
      const id = parseInt(url.pathname.split('/')[3]);
      const success = deleteSessionComparison(id);

      if (!success) {
        return new Response(JSON.stringify({ error: 'Comparison not found' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/comparisons/analyze - Analyze and compare sessions
    if (url.pathname === '/api/comparisons/analyze' && req.method === 'GET') {
      const sessionIds = url.searchParams.getAll('sessions');

      if (sessionIds.length < 2) {
        return new Response(JSON.stringify({ error: 'At least 2 sessions required' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      const result = compareSessions(sessionIds);

      return new Response(JSON.stringify(result), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/comparisons/:id/notes - Add note to comparison
    if (url.pathname.match(/^\/api\/comparisons\/\d+\/notes$/) && req.method === 'POST') {
      try {
        const id = parseInt(url.pathname.split('/')[3]);
        const { note } = await req.json();

        if (!note) {
          return new Response(JSON.stringify({ error: 'Note is required' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const noteId = addComparisonNote(id, note);

        return new Response(JSON.stringify({ id: noteId, success: true }), {
          status: 201,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/comparisons/:id/notes - Get notes for comparison
    if (url.pathname.match(/^\/api\/comparisons\/\d+\/notes$/) && req.method === 'GET') {
      const id = parseInt(url.pathname.split('/')[3]);
      const notes = getComparisonNotes(id);

      return new Response(JSON.stringify(notes), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // ========================================
    // Priority 3: Decision Tree API endpoints
    // ========================================

    // GET /api/decision-tree/session/:sessionId - Get decision tree for session
    if (url.pathname.match(/^\/api\/decision-tree\/session\/[^\/]+$/) && req.method === 'GET') {
      const sessionId = url.pathname.split('/')[4];
      const sourceApp = url.searchParams.get('source_app') || undefined;

      const tree = buildDecisionTree(sessionId, sourceApp);

      if (!tree) {
        return new Response(JSON.stringify({ error: 'Session not found' }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(tree), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // ========================================
    // Priority 3: Agent Collaboration API endpoints
    // ========================================

    // POST /api/collaboration/relationships - Create agent relationship
    if (url.pathname === '/api/collaboration/relationships' && req.method === 'POST') {
      try {
        const relationship = await req.json();

        if (!relationship.parent_session_id || !relationship.child_session_id) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), {
            status: 400,
            headers: { ...headers, 'Content-Type': 'application/json' }
          });
        }

        const id = createAgentRelationship(relationship);

        return new Response(JSON.stringify({ id, success: true }), {
          status: 201,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Invalid request' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }
    }

    // GET /api/collaboration/session/:sessionId/hierarchy - Get agent hierarchy
    if (url.pathname.match(/^\/api\/collaboration\/session\/[^\/]+\/hierarchy$/) && req.method === 'GET') {
      const sessionId = url.pathname.split('/')[4];

      const hierarchy = buildAgentHierarchy(sessionId);

      return new Response(JSON.stringify(hierarchy), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/collaboration/session/:sessionId/children - Get child sessions
    if (url.pathname.match(/^\/api\/collaboration\/session\/[^\/]+\/children$/) && req.method === 'GET') {
      const sessionId = url.pathname.split('/')[4];

      const children = getChildSessions(sessionId);

      return new Response(JSON.stringify(children), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/collaboration/relationships/all - Get all relationships
    if (url.pathname === '/api/collaboration/relationships/all' && req.method === 'GET') {
      const relationships = getAllAgentRelationships();

      return new Response(JSON.stringify(relationships), {
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    // WebSocket upgrade
    if (url.pathname === '/stream') {
      const success = server.upgrade(req);
      if (success) {
        return undefined;
      }
    }
    
    // Default response
    return new Response('Multi-Agent Observability Server', {
      headers: { ...headers, 'Content-Type': 'text/plain' }
    });
  },
  
  websocket: {
    open(ws) {
      console.log('WebSocket client connected');
      wsClients.add(ws);
      
      // Send recent events on connection
      const events = getRecentEvents(300);
      ws.send(JSON.stringify({ type: 'initial', data: events }));
    },
    
    message(ws, message) {
      // Handle any client messages if needed
      console.log('Received message:', message);
    },
    
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

console.log(`🚀 Server running on http://localhost:${server.port}`);
console.log(`📊 WebSocket endpoint: ws://localhost:${server.port}/stream`);
console.log(`📮 POST events to: http://localhost:${server.port}/events`);