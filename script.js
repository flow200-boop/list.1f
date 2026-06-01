// ===== State =====
let todos = [];
let currentFilter = "all";
let editingId = null;

// ===== DOM Refs =====
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const todoList = document.getElementById("todo-list");
const filters = document.getElementById("filters");
const itemsCount = document.getElementById("items-count");
const clearBtn = document.getElementById("clear-btn");
const emptyState = document.getElementById("empty-state");
const addBtn = document.getElementById("add-btn");
const exportBtn = document.getElementById("export-btn");
const importBtn = document.getElementById("import-btn");
const importFile = document.getElementById("import-file");
const backupStatus = document.getElementById("backup-status");

// ===== Storage =====
const BACKUP_KEY = "todos_auto_backup";

function loadTodos() {
  try {
    const data = localStorage.getItem("todos");
    todos = data ? JSON.parse(data) : [];
    updateBackupStatus();
  } catch (e) {
    console.warn("[Todo] Main data corrupt, trying backup...");
    try {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) {
        const parsed = JSON.parse(backup);
        if (Array.isArray(parsed) && parsed.length > 0) {
          todos = parsed;
          saveTodos();
          showToast("Data restored from backup", "success");
        } else {
          todos = [];
        }
      } else {
        todos = [];
      }
    } catch {
      todos = [];
    }
  }
}

function saveTodos() {
  localStorage.setItem("todos", JSON.stringify(todos));
  // Auto-backup to secondary key
  localStorage.setItem(BACKUP_KEY, JSON.stringify(todos));
  updateBackupStatus();
}

function updateBackupStatus() {
  if (!backupStatus) return;
  const count = todos.length;
  backupStatus.title = `${count} todo${count !== 1 ? "s" : ""} saved & auto-backed up`;
}

// ===== Helpers =====
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getFilteredTodos() {
  if (currentFilter === "active") return todos.filter((t) => !t.completed);
  if (currentFilter === "completed") return todos.filter((t) => t.completed);
  return todos;
}

function formatDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getActiveCount() {
  return todos.filter((t) => !t.completed).length;
}

function getCompletedCount() {
  return todos.filter((t) => t.completed).length;
}

// ===== Render =====
function render() {
  const filtered = getFilteredTodos();
  const activeCount = getActiveCount();
  const completedCount = getCompletedCount();

  // Update empty state
  if (todos.length === 0) {
    emptyState.classList.add("visible");
  } else {
    emptyState.classList.remove("visible");
  }

  // Update count
  itemsCount.textContent = `${activeCount} item${activeCount !== 1 ? "s" : ""} left`;

  // Show/hide clear button
  clearBtn.style.display = completedCount > 0 ? "block" : "none";

  // Render list
  if (filtered.length === 0 && todos.length > 0) {
    // Show empty state for filter
    todoList.innerHTML = `
      <div class="empty-state visible" style="display:block;padding:32px 24px;">
        <div class="empty-icon">🎉</div>
        <p class="empty-text">No ${currentFilter} todos</p>
      </div>
    `;
    return;
  }

  todoList.innerHTML = filtered
    .map(
      (todo) => `
    <li class="todo-item ${todo.completed ? "completed" : ""}" data-id="${todo.id}">
      <div class="checkbox-wrapper">
        <input type="checkbox" class="todo-checkbox" id="check-${todo.id}" ${todo.completed ? "checked" : ""} />
        <label class="checkbox-label" for="check-${todo.id}"></label>
      </div>
      <div class="todo-content">
        ${
          editingId === todo.id
            ? `<input type="text" class="todo-edit-input" value="${escapeHtml(todo.text)}" data-edit-id="${todo.id}" autofocus />`
            : `<span class="todo-text">${escapeHtml(todo.text)}</span>`
        }
        <div class="todo-meta">
          <span class="meta-created">Created ${formatDate(todo.createdAt)}</span>
          ${todo.completed && todo.completedAt ? `<span class="meta-completed">Completed ${formatDate(todo.completedAt)}</span>` : ""}
        </div>
      </div>
      <button class="delete-btn" data-delete-id="${todo.id}" title="Delete todo">×</button>
    </li>
  `
    )
    .join("");

  // Focus edit input if present
  const editInput = document.querySelector(".todo-edit-input");
  if (editInput) {
    const len = editInput.value.length;
    editInput.setSelectionRange(len, len);
    editInput.focus();
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===== Actions =====
function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const todo = {
    id: generateId(),
    text: trimmed,
    completed: false,
    createdAt: Date.now(),
    completedAt: null,
  };

  todos.unshift(todo);
  saveTodos();
  render();
  return true;
}

function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    todo.completedAt = todo.completed ? Date.now() : null;
    saveTodos();
    render();
  }
}

function deleteTodo(id) {
  const item = document.querySelector(`[data-id="${id}"]`);
  if (item) {
    item.classList.add("removing");
    setTimeout(() => {
      todos = todos.filter((t) => t.id !== id);
      if (editingId === id) editingId = null;
      saveTodos();
      render();
    }, 250);
  } else {
    todos = todos.filter((t) => t.id !== id);
    if (editingId === id) editingId = null;
    saveTodos();
    render();
  }
}

function startEdit(id) {
  editingId = id;
  render();
}

function saveEdit(id, newText) {
  const trimmed = newText.trim();
  if (!trimmed) {
    deleteTodo(id);
    return;
  }

  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.text = trimmed;
    saveTodos();
  }
  editingId = null;
  render();
}

function cancelEdit() {
  editingId = null;
  render();
}

function clearCompleted() {
  const completed = todos.filter((t) => t.completed);
  if (completed.length === 0) return;

  if (!confirm(`Delete ${completed.length} completed todo${completed.length !== 1 ? "s" : ""}? This can't be undone.`)) {
    return;
  }

  todos = todos.filter((t) => !t.completed);
  if (editingId && !todos.find((t) => t.id === editingId)) {
    editingId = null;
  }
  saveTodos();
  render();
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  render();
}

// ===== Event Listeners =====

// Add todo
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value;
  if (addTodo(text)) {
    input.value = "";
    input.focus();
  }
});

// Keyboard shortcut: Escape cancels editing
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && editingId) {
    cancelEdit();
  }
});

// Delegate events on the todo list
todoList.addEventListener("click", (e) => {
  // Toggle checkbox
  const checkbox = e.target.closest(".todo-checkbox");
  if (checkbox) {
    const id = checkbox.id.replace("check-", "");
    toggleTodo(id);
    return;
  }

  // Delete button
  const deleteBtn = e.target.closest(".delete-btn");
  if (deleteBtn) {
    const id = deleteBtn.dataset.deleteId;
    deleteTodo(id);
    return;
  }

  // Start edit on text click
  const textEl = e.target.closest(".todo-text");
  if (textEl) {
    const item = textEl.closest(".todo-item");
    if (item) {
      startEdit(item.dataset.id);
    }
  }
});

// Save edit on Enter, blur, or click outside
todoList.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const editInput = e.target.closest(".todo-edit-input");
    if (editInput) {
      const id = editInput.dataset.editId;
      saveEdit(id, editInput.value);
    }
  }
});

todoList.addEventListener("blur", (e) => {
  const editInput = e.target.closest(".todo-edit-input");
  if (editInput) {
    const id = editInput.dataset.editId;
    saveEdit(id, editInput.value);
  }
}, true);

// Filter buttons
filters.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-btn");
  if (btn) {
    setFilter(btn.dataset.filter);
  }
});

// Clear completed
clearBtn.addEventListener("click", clearCompleted);

// Export backup
exportBtn.addEventListener("click", exportBackup);

// Import backup (trigger file picker)
importBtn.addEventListener("click", () => {
  importFile.click();
});

importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  importBackup(file);
  importFile.value = "";
});

// ===== Data Safety =====

function exportBackup() {
  if (todos.length === 0) {
    showToast("No todos to export", "warning");
    return;
  }

  const data = JSON.stringify(todos, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const date = new Date().toISOString().split("T")[0];
  a.download = `todos-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Exported ${todos.length} todos`, "success");
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data) || data.length === 0) {
        showToast("Invalid backup file", "error");
        return;
      }

      // Validate basic structure
      const valid = data.every((t) => t.id && t.text && typeof t.completed === "boolean");
      if (!valid) {
        showToast("Backup file has invalid format", "error");
        return;
      }

      if (!confirm(`Replace current ${todos.length} todos with ${data.length} from backup?`)) {
        return;
      }

      todos = data;
      editingId = null;
      saveTodos();
      render();
      showToast(`Restored ${data.length} todos from backup`, "success");
    } catch {
      showToast("Could not read backup file", "error");
    }
  };
  reader.readAsText(file);
}

// ===== Toast Notifications =====

function showToast(message, type = "info") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("toast-visible");
  });

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
loadTodos();
render();
input.focus();
