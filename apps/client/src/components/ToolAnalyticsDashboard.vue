<template>
  <div class="tool-analytics-dashboard">
    <div class="analytics-header">
      <h3>🔧 Tool Success/Failure Analytics</h3>
      <button @click="refreshAnalytics" class="refresh-btn" :disabled="loading">
        {{ loading ? '↻' : '🔄' }} Refresh
      </button>
    </div>

    <div v-if="loading" class="loading">Loading analytics...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else-if="toolStats.length === 0" class="empty">
      No tool analytics available yet. Data will appear here once tools are used.
    </div>

    <div v-else class="analytics-content">
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-icon">✅</div>
          <div class="summary-content">
            <div class="summary-label">Overall Success Rate</div>
            <div class="summary-value">{{ overallSuccessRate.toFixed(1) }}%</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-icon">🔧</div>
          <div class="summary-content">
            <div class="summary-label">Total Tool Uses</div>
            <div class="summary-value">{{ totalUses }}</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-icon">❌</div>
          <div class="summary-content">
            <div class="summary-label">Total Failures</div>
            <div class="summary-value">{{ totalFailures }}</div>
          </div>
        </div>
      </div>

      <div class="tool-stats-list">
        <h4>Tool Reliability</h4>
        <div class="tool-stats-items">
          <div v-for="tool in toolStats" :key="tool.tool_name" class="tool-stat-item">
            <div class="tool-header">
              <div class="tool-name">
                <span class="tool-icon">{{ getToolIcon(tool.tool_name) }}</span>
                {{ tool.tool_name }}
              </div>
              <div class="tool-usage">{{ tool.total_uses }} uses</div>
            </div>

            <div class="tool-progress">
              <div class="progress-bar">
                <div
                  class="progress-fill"
                  :style="{
                    width: `${tool.success_rate}%`,
                    backgroundColor: getSuccessColor(tool.success_rate)
                  }"
                ></div>
              </div>
              <div class="progress-label">{{ tool.success_rate.toFixed(1) }}%</div>
            </div>

            <div class="tool-stats-details">
              <span class="stat success">✓ {{ tool.successes }} success</span>
              <span class="stat failure">✗ {{ tool.failures }} failure</span>
              <span v-if="tool.most_common_error" class="stat error-type">
                {{ formatErrorType(tool.most_common_error) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="errorSummary.length > 0" class="error-summary">
        <h4>Top Errors</h4>
        <div class="error-items">
          <div v-for="error in errorSummary" :key="error.error_type + error.tool_name" class="error-item">
            <div class="error-icon">⚠️</div>
            <div class="error-details">
              <div class="error-type">{{ formatErrorType(error.error_type) }}</div>
              <div class="error-tool">{{ error.tool_name }} - {{ error.count }} occurrences</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface ToolStats {
  tool_name: string;
  total_uses: number;
  successes: number;
  failures: number;
  success_rate: number;
  most_common_error?: string;
}

interface ErrorSummary {
  error_type: string;
  count: number;
  tool_name: string;
  recent_message?: string;
}

const toolStats = ref<ToolStats[]>([]);
const errorSummary = ref<ErrorSummary[]>([]);
const loading = ref(false);
const error = ref('');

const totalUses = computed(() => {
  return toolStats.value.reduce((sum, t) => sum + t.total_uses, 0);
});

const totalFailures = computed(() => {
  return toolStats.value.reduce((sum, t) => sum + t.failures, 0);
});

const overallSuccessRate = computed(() => {
  if (totalUses.value === 0) return 0;
  const totalSuccesses = toolStats.value.reduce((sum, t) => sum + t.successes, 0);
  return (totalSuccesses / totalUses.value) * 100;
});

async function refreshAnalytics() {
  loading.value = true;
  error.value = '';

  try {
    // Fetch tool stats
    const statsResponse = await fetch('http://localhost:4000/api/analytics/tools/stats');
    if (!statsResponse.ok) {
      throw new Error(`Failed to fetch stats: ${statsResponse.statusText}`);
    }
    toolStats.value = await statsResponse.json();

    // Fetch error summary
    const errorsResponse = await fetch('http://localhost:4000/api/analytics/errors/summary?limit=5');
    if (!errorsResponse.ok) {
      throw new Error(`Failed to fetch errors: ${errorsResponse.statusText}`);
    }
    errorSummary.value = await errorsResponse.json();

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load analytics';
    console.error('Error fetching analytics:', err);
  } finally {
    loading.value = false;
  }
}

function getToolIcon(toolName: string): string {
  const icons: Record<string, string> = {
    'Bash': '💻',
    'Read': '📖',
    'Write': '✍️',
    'Edit': '✏️',
    'Grep': '🔍',
    'Glob': '📁',
    'Task': '📋',
    'Skill': '🎯',
    'WebFetch': '🌐',
  };
  return icons[toolName] || '🔧';
}

function getSuccessColor(rate: number): string {
  if (rate >= 90) return '#4CAF50'; // Green
  if (rate >= 70) return '#FFC107'; // Yellow
  if (rate >= 50) return '#FF9800'; // Orange
  return '#F44336'; // Red
}

function formatErrorType(errorType: string): string {
  return errorType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

onMounted(() => {
  refreshAnalytics();
});
</script>

<style scoped>
.tool-analytics-dashboard {
  padding: 1rem;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.analytics-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.analytics-header h3 {
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

.tool-stats-list h4,
.error-summary h4 {
  margin: 0 0 0.8rem 0;
  color: var(--text-primary, #333);
}

.tool-stats-items {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-bottom: 1.5rem;
}

.tool-stat-item {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tool-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.8rem;
}

.tool-name {
  font-weight: 600;
  color: var(--text-primary, #333);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tool-icon {
  font-size: 1.2rem;
}

.tool-usage {
  font-size: 0.85rem;
  color: var(--text-secondary, #666);
}

.tool-progress {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  margin-bottom: 0.8rem;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--bg-tertiary, #e0e0e0);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.progress-label {
  font-weight: 600;
  font-size: 0.9rem;
  min-width: 50px;
  text-align: right;
}

.tool-stats-details {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
}

.stat {
  font-size: 0.8rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.stat.success {
  color: #2e7d32;
  background: #e8f5e9;
}

.stat.failure {
  color: #c62828;
  background: #ffebee;
}

.stat.error-type {
  color: #f57c00;
  background: #fff3e0;
}

.error-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.error-item {
  background: white;
  padding: 0.8rem;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.error-icon {
  font-size: 1.5rem;
}

.error-details {
  flex: 1;
}

.error-type {
  font-weight: 600;
  color: var(--text-primary, #333);
  margin-bottom: 0.2rem;
}

.error-tool {
  font-size: 0.85rem;
  color: var(--text-secondary, #666);
}
</style>
