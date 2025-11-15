<template>
  <div class="bookmarks-view">
    <div class="bookmarks-header">
      <h3>Bookmarked Sessions</h3>
      <button @click="refreshBookmarks" class="refresh-btn" :disabled="loading">
        {{ loading ? '↻' : '🔄' }} Refresh
      </button>
    </div>

    <div v-if="loading" class="loading">Loading bookmarks...</div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else-if="bookmarks.length === 0" class="empty">
      No bookmarked sessions yet. Star sessions to bookmark them!
    </div>

    <div v-else class="bookmarks-list">
      <div v-for="bookmark in bookmarks" :key="bookmark.id" class="bookmark-item">
        <div class="bookmark-header">
          <div class="session-info">
            <span class="session-id">{{ formatSessionId(bookmark.session_id) }}</span>
            <span class="source-app">{{ bookmark.source_app }}</span>
          </div>
          <button
            @click="removeBookmark(bookmark.source_app, bookmark.session_id)"
            class="remove-btn"
            title="Remove bookmark"
          >
            ★
          </button>
        </div>

        <div v-if="bookmark.bookmarked_at" class="bookmark-date">
          Bookmarked {{ formatDate(bookmark.bookmarked_at) }}
        </div>

        <div v-if="bookmark.notes" class="bookmark-notes">
          {{ bookmark.notes }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface SessionBookmark {
  id?: number;
  source_app: string;
  session_id: string;
  bookmarked: boolean;
  bookmarked_at?: number;
  notes?: string;
}

const bookmarks = ref<SessionBookmark[]>([]);
const loading = ref(false);
const error = ref('');

async function refreshBookmarks() {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('http://localhost:4000/api/bookmarks');

    if (!response.ok) {
      throw new Error(`Failed to fetch bookmarks: ${response.statusText}`);
    }

    bookmarks.value = await response.json();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load bookmarks';
    console.error('Error fetching bookmarks:', err);
  } finally {
    loading.value = false;
  }
}

async function removeBookmark(sourceApp: string, sessionId: string) {
  try {
    const response = await fetch(`http://localhost:4000/api/bookmarks/${sourceApp}/${sessionId}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      await refreshBookmarks();
    }
  } catch (err) {
    console.error('Error removing bookmark:', err);
  }
}

function formatSessionId(sessionId: string): string {
  return sessionId.slice(0, 8);
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

onMounted(() => {
  refreshBookmarks();
});
</script>

<style scoped>
.bookmarks-view {
  padding: 1rem;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 8px;
  margin-bottom: 1rem;
}

.bookmarks-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.bookmarks-header h3 {
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

.bookmarks-list {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}

.bookmark-item {
  background: white;
  padding: 1rem;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.bookmark-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.session-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.session-id {
  font-family: monospace;
  font-size: 1rem;
  color: var(--text-primary, #333);
  font-weight: 600;
}

.source-app {
  font-size: 0.85rem;
  color: var(--text-secondary, #666);
}

.remove-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  color: var(--primary, #FFD700);
}

.remove-btn:hover {
  opacity: 0.7;
}

.bookmark-date {
  font-size: 0.8rem;
  color: var(--text-secondary, #999);
  margin-bottom: 0.3rem;
}

.bookmark-notes {
  font-size: 0.9rem;
  color: var(--text-primary, #333);
  padding: 0.5rem;
  background: var(--bg-tertiary, #f0f0f0);
  border-radius: 4px;
  margin-top: 0.5rem;
}
</style>
