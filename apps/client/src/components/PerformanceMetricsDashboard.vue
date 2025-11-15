<template>
  <div class="performance-metrics-dashboard">
    <div class="metrics-header">
      <h3>Agent Performance Metrics</h3>
      <button @click="refreshMetrics" class="refresh-btn" :disabled="loading">
        {{ loading ? '↻' : '🔄' }} Refresh
      </button>
    </div>

    <div v-if="loading" class="loading">Loading performance metrics...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else-if="metrics.length === 0" class="empty">
      No performance metrics available yet. Metrics are calculated automatically when sessions complete.
    </div>

    <div v-else class="metrics-content">
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-icon">⚡</div>
          <div class="summary-content">
            <div class="summary-label">Avg Response Time</div>
            <div class="summary-value">{{ formatTime(avgResponseTime) }}</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-icon">✅</div>
          <div class="summary-content">
            <div class="summary-label">Avg Success Rate</div>
            <div class="summary-value">{{ avgSuccessRate.toFixed(1) }}%</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-icon">🔧</div>
          <div class="summary-content">
            <div class="summary-label">Avg Tools/Task</div>
            <div class="summary-value">{{ avgToolsPerTask.toFixed(2) }}</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-icon">📊</div>
          <div class="summary-content">
            <div class="summary-label">Sessions Analyzed</div>
            <div class="summary-value">{{ metrics.length }}</div>
          </div>
        </div>
      </div>

      <div class="sessions-list">
        <h4>Session Performance</h4>
        <div class="session-items">
          <div v-for="session in recentSessions" :key="session.id" class="session-item">
            <div class="session-info">
              <div class="session-id">{{ truncateSessionId(session.session_id) }}</div>
              <div class="session-app">{{ session.source_app }}</div>
            </div>

            <div class="session-metrics">
              <div class="metric">
                <span class="metric-label">Response Time:</span>
                <span class="metric-value">{{ formatTime(session.avg_response_time) }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Success Rate:</span>
                <span class="metric-value" :class="getSuccessClass(session.success_rate)">
                  {{ session.success_rate?.toFixed(1) || 'N/A' }}%
                </span>
              </div>
              <div class="metric">
                <span class="metric-label">Tools/Task:</span>
                <span class="metric-value">{{ session.tools_per_task?.toFixed(2) || 'N/A' }}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Duration:</span>
                <span class="metric-value">{{ formatDuration(session.session_duration) }}</span>
              </div>
            </div>

            <div class="session-stats">
              <span class="stat">{{ session.total_events }} events</span>
              <span class="stat">{{ session.total_tool_uses }} tools</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface PerformanceMetrics {
  id?: number;
  source_app: string;
  session_id: string;
  avg_response_time?: number;
  tools_per_task?: number;
  success_rate?: number;
  session_duration?: number;
  total_events: number;
  total_tool_uses: number;
  calculated_at: number;
}

const metrics = ref<PerformanceMetrics[]>([]);
const loading = ref(false);
const error = ref('');

const avgResponseTime = computed(() => {
  const validMetrics = metrics.value.filter(m => m.avg_response_time != null);
  if (validMetrics.length === 0) return 0;
  return validMetrics.reduce((sum, m) => sum + (m.avg_response_time || 0), 0) / validMetrics.length;
});

const avgSuccessRate = computed(() => {
  const validMetrics = metrics.value.filter(m => m.success_rate != null);
  if (validMetrics.length === 0) return 0;
  return validMetrics.reduce((sum, m) => sum + (m.success_rate || 0), 0) / validMetrics.length;
});

const avgToolsPerTask = computed(() => {
  const validMetrics = metrics.value.filter(m => m.tools_per_task != null);
  if (validMetrics.length === 0) return 0;
  return validMetrics.reduce((sum, m) => sum + (m.tools_per_task || 0), 0) / validMetrics.length;
});

const recentSessions = computed(() => {
  return metrics.value.slice(0, 10);
});

async function refreshMetrics() {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('http://localhost:4000/api/metrics/performance/all');

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }

    metrics.value = await response.json();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load performance metrics';
    console.error('Error fetching metrics:', err);
  } finally {
    loading.value = false;
  }
}

function formatTime(ms?: number): string {
  if (ms == null) return 'N/A';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatDuration(ms?: number): string {
  if (ms == null) return 'N/A';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function truncateSessionId(sessionId: string): string {
  return sessionId.slice(0, 8);
}

function getSuccessClass(rate?: number): string {
  if (rate == null) return '';
  if (rate >= 90) return 'success-high';
  if (rate >= 70) return 'success-medium';
  return 'success-low';
}

onMounted(() => {
  refreshMetrics();
});
</script>

<style scoped>
.performance-metrics-dashboard {
  padding: 1rem;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.metrics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.metrics-header h3 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--text-primary, #333);
}

.refresh-btn {
  padding: 0.4rem 0.8rem;
  background: var(--primary, #4CAF50);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--primary-hover, #45a049);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading, .error, .empty {
  padding: 2rem;
  text-align: center;
  color: var(--text-secondary, #666);
}

.error {
  color: var(--accent-error, #f44336);
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.summary-card {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.summary-icon {
  font-size: 2rem;
}

.summary-content {
  flex: 1;
}

.summary-label {
  font-size: 0.85rem;
  color: var(--text-secondary, #666);
  margin-bottom: 0.25rem;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--text-primary, #333);
}

.sessions-list h4 {
  margin: 0 0 0.8rem 0;
  color: var(--text-primary, #333);
}

.session-items {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.session-item {
  background: white;
  padding: 1rem;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  margin-bottom: 0.8rem;
}

.session-id {
  font-family: monospace;
  font-size: 1rem;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.session-app {
  font-size: 0.85rem;
  color: var(--text-secondary, #666);
}

.session-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
  margin-bottom: 0.8rem;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.metric-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #999);
}

.metric-value {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary, #333);
}

.metric-value.success-high {
  color: #4CAF50;
}

.metric-value.success-medium {
  color: #FF9800;
}

.metric-value.success-low {
  color: #F44336;
}

.session-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat {
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: var(--bg-tertiary, #e0e0e0);
  color: var(--text-primary, #333);
}
</style>
