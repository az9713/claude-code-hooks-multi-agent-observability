<template>
  <div class="pattern-insights">
    <div class="insights-header">
      <h3>Event Pattern Detection & Insights</h3>
      <button @click="refreshPatterns" class="refresh-btn" :disabled="loading">
        {{ loading ? '↻' : '🔄' }} Refresh
      </button>
    </div>

    <div v-if="loading" class="loading">Analyzing patterns...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else-if="patterns.length === 0" class="empty">
      No patterns detected yet. Patterns will be identified as agents complete tasks.
    </div>

    <div v-else class="patterns-content">
      <div class="summary-cards">
        <div class="summary-card">
          <div class="summary-icon">🔍</div>
          <div class="summary-content">
            <div class="summary-label">Total Patterns</div>
            <div class="summary-value">{{ patterns.length }}</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-icon">🔄</div>
          <div class="summary-content">
            <div class="summary-label">Total Occurrences</div>
            <div class="summary-value">{{ totalOccurrences }}</div>
          </div>
        </div>

        <div class="summary-card">
          <div class="summary-icon">⭐</div>
          <div class="summary-content">
            <div class="summary-label">Most Common</div>
            <div class="summary-value">{{ mostCommonPattern }}</div>
          </div>
        </div>
      </div>

      <div class="patterns-by-type">
        <h4>Detected Patterns</h4>

        <div class="pattern-types">
          <button
            v-for="type in patternTypes"
            :key="type"
            @click="selectedType = type"
            class="type-btn"
            :class="{ active: selectedType === type }"
          >
            {{ formatType(type) }}
          </button>
        </div>

        <div class="pattern-list">
          <div v-for="pattern in filteredPatterns" :key="pattern.id" class="pattern-item">
            <div class="pattern-header">
              <div class="pattern-name">
                <span class="pattern-icon">{{ getPatternIcon(pattern.pattern_type) }}</span>
                {{ pattern.pattern_name }}
              </div>
              <div class="pattern-count">
                {{ pattern.occurrences }} occurrence{{ pattern.occurrences !== 1 ? 's' : '' }}
              </div>
            </div>

            <div class="pattern-description">
              {{ pattern.description }}
            </div>

            <div v-if="pattern.example_sequence" class="pattern-sequence">
              <span class="sequence-label">Example:</span>
              <span class="sequence-steps">
                <span
                  v-for="(step, index) in parseSequence(pattern.example_sequence)"
                  :key="index"
                  class="sequence-step"
                >
                  {{ step }}
                  <span v-if="index < parseSequence(pattern.example_sequence).length - 1" class="arrow">→</span>
                </span>
              </span>
            </div>

            <div class="pattern-meta">
              <span v-if="pattern.confidence_score" class="confidence">
                Confidence: {{ pattern.confidence_score }}%
              </span>
              <span class="pattern-type-badge">{{ pattern.pattern_type }}</span>
              <span class="session-id">{{ truncateSessionId(pattern.session_id) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

interface DetectedPattern {
  id?: number;
  source_app: string;
  session_id: string;
  pattern_type: string;
  pattern_name: string;
  description: string;
  occurrences: number;
  first_seen: number;
  last_seen: number;
  example_sequence?: string;
  confidence_score?: number;
}

const patterns = ref<DetectedPattern[]>([]);
const loading = ref(false);
const error = ref('');
const selectedType = ref<string>('all');

const totalOccurrences = computed(() => {
  return patterns.value.reduce((sum, p) => sum + p.occurrences, 0);
});

const mostCommonPattern = computed(() => {
  if (patterns.value.length === 0) return 'N/A';
  const sorted = [...patterns.value].sort((a, b) => b.occurrences - a.occurrences);
  return sorted[0].pattern_name;
});

const patternTypes = computed(() => {
  const types = new Set(['all']);
  patterns.value.forEach(p => types.add(p.pattern_type));
  return Array.from(types);
});

const filteredPatterns = computed(() => {
  if (selectedType.value === 'all') {
    return patterns.value;
  }
  return patterns.value.filter(p => p.pattern_type === selectedType.value);
});

async function refreshPatterns() {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('http://localhost:4000/api/patterns/all');

    if (!response.ok) {
      throw new Error(`Failed to fetch patterns: ${response.statusText}`);
    }

    patterns.value = await response.json();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load patterns';
    console.error('Error fetching patterns:', err);
  } finally {
    loading.value = false;
  }
}

function parseSequence(sequence: string): string[] {
  try {
    return JSON.parse(sequence);
  } catch {
    return [sequence];
  }
}

function truncateSessionId(sessionId: string): string {
  return sessionId.slice(0, 8);
}

function formatType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getPatternIcon(type: string): string {
  const icons: Record<string, string> = {
    'workflow': '🔄',
    'retry': '🔁',
    'sequence': '📝',
    'error': '⚠️',
    'optimization': '⚡'
  };
  return icons[type] || '🔍';
}

onMounted(() => {
  refreshPatterns();
});
</script>

<style scoped>
.pattern-insights {
  padding: 1rem;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.insights-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.insights-header h3 {
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

.patterns-by-type h4 {
  margin: 0 0 0.8rem 0;
  color: var(--text-primary, #333);
}

.pattern-types {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.type-btn {
  padding: 0.4rem 0.8rem;
  background: white;
  border: 1px solid var(--border-primary, #ddd);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-primary, #333);
  transition: all 0.2s ease;
}

.type-btn:hover {
  background: var(--bg-tertiary, #f0f0f0);
}

.type-btn.active {
  background: var(--primary, #4CAF50);
  color: white;
  border-color: var(--primary, #4CAF50);
}

.pattern-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.pattern-item {
  background: white;
  padding: 1rem;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.pattern-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.pattern-name {
  font-weight: 600;
  color: var(--text-primary, #333);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
}

.pattern-icon {
  font-size: 1.2rem;
}

.pattern-count {
  font-size: 0.85rem;
  color: var(--text-secondary, #666);
  background: var(--bg-tertiary, #e0e0e0);
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
}

.pattern-description {
  font-size: 0.9rem;
  color: var(--text-secondary, #666);
  margin-bottom: 0.8rem;
}

.pattern-sequence {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
  padding: 0.6rem;
  background: var(--bg-tertiary, #f0f0f0);
  border-radius: 4px;
  flex-wrap: wrap;
}

.sequence-label {
  font-size: 0.8rem;
  color: var(--text-secondary, #999);
  font-weight: 600;
}

.sequence-steps {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.sequence-step {
  font-family: monospace;
  font-size: 0.85rem;
  padding: 0.2rem 0.5rem;
  background: white;
  border: 1px solid var(--border-primary, #ddd);
  border-radius: 4px;
  color: var(--text-primary, #333);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.arrow {
  color: var(--text-secondary, #999);
  font-weight: bold;
}

.pattern-meta {
  display: flex;
  gap: 0.8rem;
  flex-wrap: wrap;
  font-size: 0.8rem;
}

.confidence {
  color: var(--text-secondary, #666);
  background: #e8f5e9;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  color: #2e7d32;
}

.pattern-type-badge {
  background: #e3f2fd;
  color: #1976d2;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.session-id {
  font-family: monospace;
  background: var(--bg-tertiary, #e0e0e0);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  color: var(--text-primary, #666);
}
</style>
