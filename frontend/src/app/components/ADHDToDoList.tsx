import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { Plus } from "lucide-react";

type TodoItem = {
  id: string;
  text: string;
  done: boolean;
};

function nextTodoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ADHDToDoList() {
  const [items, setItems] = useState<TodoItem[]>([]);
  const [draft, setDraft] = useState("");

  const remainingCount = useMemo(() => items.filter((item) => !item.done).length, [items]);

  const addItem = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }

    setItems((prev) => [...prev, { id: nextTodoId(), text, done: false }]);
    setDraft("");
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addItem();
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addItem();
    }
  };

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <section className="card adhd-todo-list" aria-label="Task list">
      <div className="todo-header">
        <h3>My Tasks</h3>
        <p className="muted">{remainingCount} remaining</p>
      </div>

      <form className="todo-add-row" onSubmit={onSubmit}>
        <label className="todo-label" htmlFor="todo-item-input">
          Add task
        </label>
        <div className="todo-add-controls">
          <input
            id="todo-item-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Add one small task"
            autoComplete="off"
            className="todo-input"
          />
          <button type="submit" className="todo-add-button" disabled={!draft.trim()} aria-label="Add task">
            <Plus className="todo-action-icon" aria-hidden="true" />
          </button>
        </div>
      </form>

      <ul className="todo-list" aria-live="polite">
        {items.length === 0 ? <li className="todo-empty muted">No tasks yet</li> : null}
        {items.map((item) => (
          <li key={item.id} className="todo-row">
            <label className="todo-checkbox-wrap">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleItem(item.id)}
                aria-label={`Mark ${item.text} as ${item.done ? "not done" : "done"}`}
              />
              <span className={item.done ? "todo-text todo-text-done" : "todo-text"}>{item.text}</span>
            </label>
            <button
              type="button"
              className="todo-delete"
              onClick={() => removeItem(item.id)}
              aria-label={`Delete ${item.text}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
