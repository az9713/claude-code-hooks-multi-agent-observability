<template>
  <button
    @click="toggleBookmark"
    class="bookmark-btn"
    :class="{ bookmarked: isBookmarked }"
    :disabled="loading"
    :title="isBookmarked ? 'Remove bookmark' : 'Bookmark this session'"
  >
    {{ isBookmarked ? '★' : '☆' }}
  </button>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

interface Props {
  sourceApp: string;
  sessionId: string;
}

const props = defineProps<Props>();
const isBookmarked = ref(false);
const loading = ref(false);

async function checkBookmark() {
  try {
    const response = await fetch(`http://localhost:4000/api/bookmarks/${props.sourceApp}/${props.sessionId}`);

    if (response.ok) {
      const data = await response.json();
      isBookmarked.value = data.bookmarked === true;
    }
  } catch (error) {
    console.error('Error checking bookmark:', error);
  }
}

async function toggleBookmark() {
  loading.value = true;

  try {
    if (isBookmarked.value) {
      // Remove bookmark
      const response = await fetch(`http://localhost:4000/api/bookmarks/${props.sourceApp}/${props.sessionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        isBookmarked.value = false;
      }
    } else {
      // Add bookmark
      const response = await fetch('http://localhost:4000/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_app: props.sourceApp,
          session_id: props.sessionId,
          bookmarked: true
        })
      });

      if (response.ok) {
        isBookmarked.value = true;
      }
    }
  } catch (error) {
    console.error('Error toggling bookmark:', error);
  } finally {
    loading.value = false;
  }
}

// Watch for prop changes
watch(() => [props.sourceApp, props.sessionId], () => {
  checkBookmark();
});

onMounted(() => {
  checkBookmark();
});
</script>

<style scoped>
.bookmark-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
  color: var(--text-secondary, #999);
  transition: all 0.2s ease;
}

.bookmark-btn:hover:not(:disabled) {
  color: var(--primary, #4CAF50);
  transform: scale(1.1);
}

.bookmark-btn.bookmarked {
  color: var(--primary, #FFD700);
}

.bookmark-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
