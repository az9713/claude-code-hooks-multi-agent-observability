<template>
  <div class="tag-editor">
    <div class="tags-list">
      <span
        v-for="tag in tags"
        :key="tag.tag"
        class="tag"
      >
        {{ tag.tag }}
        <button @click="removeTag(tag.tag)" class="remove-tag" title="Remove tag">×</button>
      </span>
      <span v-if="tags.length === 0" class="no-tags">No tags yet</span>
    </div>

    <div class="add-tag-form">
      <input
        v-model="newTag"
        type="text"
        placeholder="Add tag..."
        @keyup.enter="addTag"
        class="tag-input"
        :disabled="loading"
      />
      <button @click="addTag" class="add-btn" :disabled="loading || !newTag.trim()">
        Add
      </button>
    </div>

    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

interface Props {
  sourceApp: string;
  sessionId: string;
}

interface SessionTag {
  id?: number;
  source_app: string;
  session_id: string;
  tag: string;
  created_at: number;
}

const props = defineProps<Props>();
const tags = ref<SessionTag[]>([]);
const newTag = ref('');
const loading = ref(false);
const error = ref('');

async function loadTags() {
  try {
    const response = await fetch(`http://localhost:4000/api/tags/session/${props.sourceApp}/${props.sessionId}`);

    if (response.ok) {
      tags.value = await response.json();
    }
  } catch (err) {
    console.error('Error loading tags:', err);
  }
}

async function addTag() {
  const tagValue = newTag.value.trim();
  if (!tagValue) return;

  loading.value = true;
  error.value = '';

  try {
    const response = await fetch('http://localhost:4000/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_app: props.sourceApp,
        session_id: props.sessionId,
        tag: tagValue,
        created_at: Date.now()
      })
    });

    if (response.ok) {
      newTag.value = '';
      await loadTags();
    } else {
      error.value = 'Failed to add tag';
    }
  } catch (err) {
    error.value = 'Error adding tag';
    console.error('Error adding tag:', err);
  } finally {
    loading.value = false;
  }
}

async function removeTag(tag: string) {
  loading.value = true;
  error.value = '';

  try {
    const response = await fetch(`http://localhost:4000/api/tags/${props.sourceApp}/${props.sessionId}/${tag}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      await loadTags();
    } else {
      error.value = 'Failed to remove tag';
    }
  } catch (err) {
    error.value = 'Error removing tag';
    console.error('Error removing tag:', err);
  } finally {
    loading.value = false;
  }
}

// Watch for prop changes
watch(() => [props.sourceApp, props.sessionId], () => {
  loadTags();
});

onMounted(() => {
  loadTags();
});
</script>

<style scoped>
.tag-editor {
  padding: 0.8rem;
  background: var(--bg-secondary, #f5f5f5);
  border-radius: 6px;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
  min-height: 28px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  background: var(--primary, #4CAF50);
  color: white;
  border-radius: 4px;
  font-size: 0.85rem;
}

.remove-tag {
  background: none;
  border: none;
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  opacity: 0.8;
}

.remove-tag:hover {
  opacity: 1;
  font-weight: bold;
}

.no-tags {
  color: var(--text-secondary, #999);
  font-size: 0.85rem;
  font-style: italic;
}

.add-tag-form {
  display: flex;
  gap: 0.5rem;
}

.tag-input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border-primary, #ddd);
  border-radius: 4px;
  font-size: 0.9rem;
}

.tag-input:focus {
  outline: none;
  border-color: var(--primary, #4CAF50);
}

.add-btn {
  padding: 0.4rem 1rem;
  background: var(--primary, #4CAF50);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.add-btn:hover:not(:disabled) {
  background: var(--primary-hover, #45a049);
}

.add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error {
  margin-top: 0.5rem;
  color: var(--accent-error, #f44336);
  font-size: 0.85rem;
}
</style>
