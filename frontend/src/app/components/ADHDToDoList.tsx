import { FormEvent, useMemo, useState } from "react";
import { Clock3, Play, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

type TodoItem = {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  durationMinutes: number;
  done: boolean;
  subtasks: Array<{
    id: string;
    text: string;
    done: boolean;
  }>;
};

function nextTodoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ADHDToDoList() {
  const { t } = useTranslation();
  const [items, setItems] = useState<TodoItem[]>([
    {
      id: nextTodoId(),
      title: "Complete Algebra lesson",
      priority: "high",
      durationMinutes: 25,
      done: false,
      subtasks: [
        { id: nextTodoId(), text: "Watch video introduction", done: true },
        { id: nextTodoId(), text: "Read examples", done: false },
        { id: nextTodoId(), text: "Complete practice problems", done: false },
      ],
    },
    {
      id: nextTodoId(),
      title: "Review History notes",
      priority: "medium",
      durationMinutes: 15,
      done: false,
      subtasks: [],
    },
    {
      id: nextTodoId(),
      title: "Science homework",
      priority: "low",
      durationMinutes: 30,
      done: false,
      subtasks: [],
    },
  ]);
  const [activeTimerTaskId, setActiveTimerTaskId] = useState<string | null>(null);
  const [isTaskComposerOpen, setIsTaskComposerOpen] = useState(false);
  const [taskDraftTitle, setTaskDraftTitle] = useState("");
  const [taskDraftDuration, setTaskDraftDuration] = useState("25");
  const [subtaskEditorTaskId, setSubtaskEditorTaskId] = useState<string | null>(null);
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({});

  const completedCount = useMemo(() => items.filter((item) => item.done).length, [items]);
  const completionPercent = useMemo(() => {
    if (!items.length) return 0;
    return Math.round((completedCount / items.length) * 100);
  }, [completedCount, items.length]);

  const openTaskComposer = () => {
    setIsTaskComposerOpen(true);
  };

  const cancelTaskComposer = () => {
    setTaskDraftTitle("");
    setTaskDraftDuration("25");
    setIsTaskComposerOpen(false);
  };

  const submitTaskComposer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = taskDraftTitle.trim();
    if (!title) {
      return;
    }

    const parsedDuration = Number.parseInt(taskDraftDuration, 10);
    const durationMinutes = Number.isFinite(parsedDuration) ? Math.max(5, Math.min(180, parsedDuration)) : 25;

    setItems((prev) => [
      ...prev,
      {
        id: nextTodoId(),
        title,
        priority: "medium",
        durationMinutes,
        done: false,
        subtasks: [],
      },
    ]);

    cancelTaskComposer();
  };

  const setPriority = (id: string, priority: TodoItem["priority"]) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, priority } : item)));
  };

  const toggleTask = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const nextDone = !item.done;
        return {
          ...item,
          done: nextDone,
          subtasks: item.subtasks.map((subtask) => ({ ...subtask, done: nextDone })),
        };
      }),
    );
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== taskId) {
          return item;
        }

        const subtasks = item.subtasks.map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
        );
        const isDone = subtasks.length > 0 && subtasks.every((subtask) => subtask.done);
        return {
          ...item,
          subtasks,
          done: isDone,
        };
      }),
    );
  };

  const openSubtaskEditor = (taskId: string) => {
    setSubtaskEditorTaskId(taskId);
    setSubtaskDrafts((prev) => ({ ...prev, [taskId]: prev[taskId] ?? "" }));
  };

  const cancelSubtaskEditor = (taskId: string) => {
    setSubtaskEditorTaskId((prev) => (prev === taskId ? null : prev));
    setSubtaskDrafts((prev) => ({ ...prev, [taskId]: "" }));
  };

  const submitSubtaskEditor = (taskId: string) => {
    const text = (subtaskDrafts[taskId] ?? "").trim();
    if (!text) return;

    setItems((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? {
              ...item,
              subtasks: [...item.subtasks, { id: nextTodoId(), text: text.trim(), done: false }],
            }
          : item,
      ),
    );

    cancelSubtaskEditor(taskId);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setActiveTimerTaskId((prev) => (prev === id ? null : prev));
  };

  const toggleTimer = (id: string) => {
    setActiveTimerTaskId((prev) => (prev === id ? null : id));
  };

  const priorityLabel = (priority: TodoItem["priority"]) => {
    if (priority === "high") return t("dashboards.studentV2.taskWidget.priorityHigh");
    if (priority === "medium") return t("dashboards.studentV2.taskWidget.priorityMedium");
    return t("dashboards.studentV2.taskWidget.priorityLow");
  };

  const itemToggleStateLabel = (done: boolean) =>
    done ? t("dashboards.studentV2.taskWidget.stateNotDone") : t("dashboards.studentV2.taskWidget.stateDone");

  return (
    <section className="card adhd-todo-list adhd-compact-board" aria-label={t("dashboards.studentV2.taskWidget.ariaLabel")}>
      <div className="adhd-compact-head">
        <div>
          <h3>{t("dashboards.studentV2.myTasks")}</h3>
          <p className="muted">
            {t("dashboards.studentV2.taskWidget.completedOf", { completed: completedCount, total: items.length })}
          </p>
        </div>
        <div className="adhd-compact-head-right">
          <strong>
            {completedCount} / {items.length}
          </strong>
          <button
            type="button"
            className="todo-add-button compact-add-btn"
            onClick={openTaskComposer}
            aria-label={t("dashboards.studentV2.taskWidget.addTaskAria")}
          >
            <Plus className="todo-action-icon" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="adhd-compact-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completionPercent}>
        <span style={{ width: `${completionPercent}%` }} />
      </div>

      {isTaskComposerOpen ? (
        <form className="adhd-task-editor" onSubmit={submitTaskComposer}>
          <input
            type="text"
            className="todo-input adhd-task-editor-input"
            placeholder={t("dashboards.studentV2.taskWidget.taskTitlePlaceholder")}
            value={taskDraftTitle}
            onChange={(event) => setTaskDraftTitle(event.target.value)}
            autoFocus
          />
          <label className="adhd-task-editor-label" htmlFor="task-duration-input">
            {t("dashboards.studentV2.taskWidget.durationLabel")}
          </label>
          <div className="adhd-task-editor-actions">
            <input
              id="task-duration-input"
              type="number"
              min={5}
              max={180}
              className="todo-input adhd-duration-input"
              value={taskDraftDuration}
              onChange={(event) => setTaskDraftDuration(event.target.value)}
            />
            <button type="submit" className="adhd-task-action-btn primary" disabled={!taskDraftTitle.trim()}>
              {t("dashboards.studentV2.taskWidget.add")}
            </button>
            <button type="button" className="adhd-task-action-btn secondary" onClick={cancelTaskComposer}>
              {t("dashboards.studentV2.taskWidget.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      <ul className="todo-list adhd-compact-list" aria-live="polite">
        {items.length === 0 ? <li className="todo-empty muted">{t("dashboards.studentV2.taskWidget.empty")}</li> : null}
        {items.map((item) => (
          <li key={item.id} className="todo-row adhd-compact-task">
            <div className="adhd-task-head">
              <label className="todo-checkbox-wrap adhd-task-title-wrap">
                <input
                  type="checkbox"
                  className="adhd-checkbox"
                  checked={item.done}
                  onChange={() => toggleTask(item.id)}
                  aria-label={t("dashboards.studentV2.taskWidget.markItemAria", {
                    item: item.title,
                    state: itemToggleStateLabel(item.done),
                  })}
                />
                <span className={item.done ? "todo-text todo-text-done adhd-task-title done" : "todo-text adhd-task-title"}>{item.title}</span>
              </label>
              <button
                type="button"
                className="todo-delete adhd-task-delete"
                onClick={() => removeItem(item.id)}
                aria-label={t("dashboards.studentV2.taskWidget.deleteItemAria", { item: item.title })}
              >
                <Trash2 className="todo-action-icon" aria-hidden="true" />
              </button>
            </div>

            <div className="adhd-task-meta">
              <div className="todo-priority-group" role="group" aria-label={t("dashboards.studentV2.taskWidget.priorityForAria", { item: item.title })}>
                {(["low", "medium", "high"] as const).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    className={
                      item.priority === priority
                        ? `todo-priority-chip is-${priority} is-active`
                        : `todo-priority-chip is-${priority}`
                    }
                    onClick={() => setPriority(item.id, priority)}
                    aria-pressed={item.priority === priority}
                  >
                    {priorityLabel(priority)}
                  </button>
                ))}
              </div>
              <span className="todo-duration-chip">
                <Clock3 className="todo-action-icon" aria-hidden="true" />
                {t("dashboards.studentV2.taskWidget.minutes", { value: item.durationMinutes })}
              </span>
            </div>

            {item.subtasks.length > 0 ? (
              <ul className="adhd-subtasks">
                {item.subtasks.map((subtask) => (
                  <li key={subtask.id} className="adhd-subtask-row">
                    <label className="todo-checkbox-wrap adhd-subtask-label">
                      <input
                        type="checkbox"
                        className="adhd-checkbox"
                        checked={subtask.done}
                        onChange={() => toggleSubtask(item.id, subtask.id)}
                        aria-label={t("dashboards.studentV2.taskWidget.markItemAria", {
                          item: subtask.text,
                          state: itemToggleStateLabel(subtask.done),
                        })}
                      />
                      <span className={subtask.done ? "adhd-subtask-text done" : "adhd-subtask-text"}>{subtask.text}</span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="adhd-subtask-summary muted">
              {t("dashboards.studentV2.taskWidget.subtasksCompleted", {
                done: item.subtasks.filter((subtask) => subtask.done).length,
                total: item.subtasks.length,
              })}
            </p>

            {subtaskEditorTaskId === item.id ? (
              <form
                className="adhd-subtask-editor"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitSubtaskEditor(item.id);
                }}
              >
                <input
                  type="text"
                  className="todo-input adhd-subtask-editor-input"
                  placeholder={t("dashboards.studentV2.taskWidget.subtaskTitlePlaceholder")}
                  value={subtaskDrafts[item.id] ?? ""}
                  onChange={(event) =>
                    setSubtaskDrafts((prev) => ({
                      ...prev,
                      [item.id]: event.target.value,
                    }))
                  }
                  autoFocus
                />
                <button type="submit" className="adhd-task-action-btn primary" disabled={!(subtaskDrafts[item.id] ?? "").trim()}>
                  {t("dashboards.studentV2.taskWidget.add")}
                </button>
                <button type="button" className="adhd-task-action-btn secondary" onClick={() => cancelSubtaskEditor(item.id)}>
                  {t("dashboards.studentV2.taskWidget.cancel")}
                </button>
              </form>
            ) : null}

            <div className="adhd-task-actions">
              <button
                type="button"
                className={
                  activeTimerTaskId === item.id
                    ? "adhd-task-action-btn primary is-running"
                    : "adhd-task-action-btn primary"
                }
                onClick={() => toggleTimer(item.id)}
              >
                <Play className="todo-action-icon" aria-hidden="true" />
                {activeTimerTaskId === item.id
                  ? t("dashboards.studentV2.taskWidget.stopTimer")
                  : t("dashboards.studentV2.taskWidget.startTimer")}
              </button>
              <button type="button" className="adhd-task-action-btn secondary" onClick={() => openSubtaskEditor(item.id)}>
                <Plus className="todo-action-icon" aria-hidden="true" />
                {t("dashboards.studentV2.taskWidget.addSubtask")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
