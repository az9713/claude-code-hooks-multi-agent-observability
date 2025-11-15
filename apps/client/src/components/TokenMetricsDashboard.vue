<template>
  <div class="token-metrics-dashboard">
    <div class="metrics-header">
      <h3>💰 Token Usage & Cost Tracking</h3>
      <button @click="refreshMetrics" class="refresh-btn" :disabled="loading">
        {{ loading ? '↻' : '🔄' }} Refresh
      </button>
    </div>

    <div v-if="loading" class="loading">Loading metrics...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else-if="metrics.length === 0" class="empty">
      No session metrics available yet. Token tracking will appear here once sessions with chat transcripts are processed.
    </div>

    <div v-else class="metrics-grid">
      <div class="metric-card total">
        <div class="metric-icon">🌍</div>
        <div class="metric-content">
          <div class="metric-label">Total Tokens</div>
          <div class="metric-value">{{ formatNumber(totalTokens) }}</div>
        </div>
      </div>

      <div class="metric-card cost">
        <div class="metric-icon">💵</div>
        <div class="metric-content">
          <div class="metric-label">Total Cost</div>
          <div class="metric-value">${{ formatCost(totalCost) }}</div>
        </div>
      </div>

      <div class="metric-card sessions">
        <div class="metric-icon">📊</div>
        <div class="metric-content">
          <div class="metric-label">Sessions Tracked</div>
          <div class="metric-value">{{ metrics.length }}</div>
        </div>
      </div>

      <div class="metric-card average">
        <div class="metric-icon">📈</div>
        <div class="metric-content">
          <div class="metric-label">Avg Cost/Session</div>
          <div class="metric-value">${{ formatCost(avgCost) }}</div>
        </div>
      </div>
    </div>

    <div v-if="metrics.length > 0" class="sessions-list">
      <h4>Recent Sessions</h4>
      <div class="session-items">
        <div v-for="session in recentSessions" :key="session.session_id" class="session-item">
          <div class="session-info">
            <div class="session-id">{{ truncateSessionId(session.session_id) }}</div>
            <div class="session-app">{{ session.source_app }}</div>
          </div>
          <div class="session-stats">
            <span class="stat tokens">{{ formatNumber(session.total_tokens) }} tokens</span>
            <span class="stat cost">${{ formatCost(session.total_cost) }}</span>
            <span v-if="session.model_name" class="stat model">{{ formatModel(session.model_name) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface SessionMetrics {
  id: number;
  source_app: string;
  session_id: string;
  total_tokens: number;
  total_cost: number;
  message_count: number;
  start_time?: number;
  end_time?: number;
  model_name?: string;
}

const metrics = ref<SessionMetrics[]>([]);
const loading = ref(false);
const error = ref('');

const totalTokens = computed(() => {
  return metrics.value.reduce((sum, m) => sum + m.total_tokens, 0);
});

const totalCost = computed(() => {
  return metrics.value.reduce((sum, m) => sum + m.total_cost, 0);
});

const avgCost = computed(() => {
  return metrics.value.length > 0 ? totalCost.value / metrics.value.length : 0;
});

const recentSessions = computed(() => {
  return metrics.value.slice(0, 10);
});

async function refreshMetrics() {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('http://localhost:4000/api/metrics/sessions');

    if (!response.ok) {
      throw new Error(`Failed to fetch metrics: ${response.statusText}`);
    }

    const data = await response.json();
    metrics.value = data;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load metrics';
    console.error('Error fetching metrics:', err);
  } finally {
    loading.value = false;
  }
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatCost(cost: number): string {
  return cost.toFixed(4);
}

function truncateSessionId(sessionId: string): string {
  return sessionId.slice(0, 8);
}

function formatModel(modelName: string): string {
  // Shorten model names for display
  return modelName.replace('claude-', '').replace('-20', '');
}

onMounted(() => {
  refreshMetrics();
});
</script>

<style scoped>
.token-metrics-dashboard {
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

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.metric-card {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.metric-icon {
  font-size: 2rem;
}

.metric-content {
  flex: 1;
}

.metric-label {
  font-size: 0.85rem;
  color: var(--text-secondary, #666);
  margin-bottom: 0.25rem;
}

.metric-value {
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
  gap: 0.5rem;
}

.session-item {
  background: white;
  padding: 0.8rem;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.session-id {
  font-family: monospace;
  font-size: 0.9rem;
  color: var(--text-primary, #333);
}

.session-app {
  font-size: 0.8rem;
  color: var(--text-secondary, #666);
}

.session-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat {
  font-size: 0.85rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  background: var(--bg-tertiary, #e0e0e0);
}

.stat.tokens {
  color: #1976d2;
  background: #e3f2fd;
}

.stat.cost {
  color: #388e3c;
  background: #e8f5e9;
}

.stat.model {
  color: #7b1fa2;
  background: #f3e5f5;
}
</style>
