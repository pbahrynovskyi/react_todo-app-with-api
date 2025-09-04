/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useEffect, useRef, useState } from 'react';
import { UserWarning } from './UserWarning';
import { addTodo, deleteTodo, getTodos, USER_ID } from './api/todos';
import { Todo } from './types/Todo';
import { client } from './utils/fetchClient';
import classNames from 'classnames';

export const App: React.FC = () => {
  const [todosList, setTodosList] = useState<Todo[]>([]);
  const [currentFilter, setCurrentFilter] = useState('All');
  const [errorMsg, setErrorMsg] = useState('');

  const [newTitle, setNewTitle] = useState('');
  const newTitleRef = useRef<HTMLInputElement>(null);
  const [pendingTodo, setPendingTodo] = useState<Todo | null>(null);

  const [deletingTodoId, setDeletingTodoId] = useState<number | null>(null);
  const [deletingTodosIds, setDeletingTodosIds] = useState<number[]>([]);

  const [updatingIds, setUpdatingIds] = useState<number[]>([]);
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const remainingItems = todosList.filter(todo => !todo.completed);

  const updateTodo = (id: number, data: Partial<Todo>) => {
    return client.patch<Todo>(`/todos/${id}`, data);
  };

  useEffect(() => {
    newTitleRef.current?.focus();
    const fetchTodos = async () => {
      try {
        const todos = await getTodos();

        setTodosList(todos);
      } catch {
        setErrorMsg('Unable to load todos');
      }
    };

    fetchTodos();
  }, []);

  useEffect(() => {
    if (editingTodoId !== null) {
      const input = document.querySelector<HTMLInputElement>(
        `[data-cy="TodoTitleField"]`,
      );

      input?.focus();
    }
  }, [editingTodoId]);

  useEffect(() => {
    if (!errorMsg) {
      return;
    }

    const timer = setTimeout(() => setErrorMsg(''), 3000);

    return () => clearTimeout(timer);
  }, [errorMsg]);

  const filterTodos = (todos: Todo[], filter: string) => {
    if (filter === 'Active') {
      return todos.filter(todo => !todo.completed);
    }

    if (filter === 'Completed') {
      return todos.filter(todo => todo.completed);
    }

    return todos;
  };

  const todosToDisplay = pendingTodo ? [...todosList, pendingTodo] : todosList;
  const visibleTodos = filterTodos(todosToDisplay, currentFilter);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewTitle(e.target.value);
  };

  const handleAddTodo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setErrorMsg('Title should not be empty');

      return;
    }

    const temp = {
      id: 0,
      userId: USER_ID,
      title: newTitle.trim(),
      completed: false,
    };

    setPendingTodo(temp);

    try {
      const addedTodo = await addTodo(temp);

      setTodosList(list => [...list, addedTodo]);
      setNewTitle('');
    } catch {
      setErrorMsg('Unable to add a todo');
    } finally {
      setPendingTodo(null);

      if (newTitleRef.current) {
        setTimeout(() => {
          newTitleRef.current?.focus();
        }, 0);
      }
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      setDeletingTodoId(id);
      await deleteTodo(id);
      setTodosList(list => list.filter(todo => todo.id !== id));
    } catch {
      setErrorMsg('Unable to delete a todo');
    } finally {
      setDeletingTodoId(null);

      if (newTitleRef.current) {
        setTimeout(() => {
          newTitleRef.current?.focus();
        }, 0);
      }
    }
  };

  const handleDeleteCompleted = async () => {
    const completedTodos = todosList.filter(todo => todo.completed);
    const completedIds = completedTodos.map(todo => todo.id);

    setDeletingTodosIds(ids => [...ids, ...completedIds]);

    try {
      const results = await Promise.allSettled(completedIds.map(deleteTodo));
      const successfulIds = completedTodos
        .filter((_todo, i) => results[i].status === 'fulfilled')
        .map(todo => todo.id);

      if (results.some(r => r.status === 'rejected')) {
        setErrorMsg('Unable to delete a todo');
      }

      if (successfulIds.length > 0) {
        setTodosList(list =>
          list.filter(todo => !successfulIds.includes(todo.id)),
        );
      }
    } finally {
      setDeletingTodosIds(ids => ids.filter(id => !completedIds.includes(id)));

      if (newTitleRef.current) {
        setTimeout(() => {
          newTitleRef.current?.focus();
        }, 0);
      }
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    setUpdatingIds(ids => [...ids, todo.id]);

    try {
      const updated = await updateTodo(todo.id, { completed: !todo.completed });

      setTodosList(list => list.map(t => (t.id === todo.id ? updated : t)));
    } catch {
      setErrorMsg('Unable to update a todo');
    } finally {
      setUpdatingIds(ids => ids.filter(id => id !== todo.id));
    }
  };

  const handleToggleAll = async () => {
    const allCompleted = todosList.every(t => t.completed);
    const toUpdate = todosList.filter(t => t.completed === allCompleted);

    setUpdatingIds(ids => [...ids, ...toUpdate.map(t => t.id)]);

    try {
      const results = await Promise.allSettled(
        toUpdate.map(todo => updateTodo(todo.id, { completed: !allCompleted })),
      );

      const successful = results
        .map((r, i) => (r.status === 'fulfilled' ? toUpdate[i].id : null))
        .filter(Boolean) as number[];

      if (successful.length > 0) {
        setTodosList(list =>
          list.map(todo =>
            successful.includes(todo.id)
              ? { ...todo, completed: !allCompleted }
              : todo,
          ),
        );
      }

      if (results.some(r => r.status === 'rejected')) {
        setErrorMsg('Unable to update a todo');
      }
    } finally {
      setUpdatingIds(ids =>
        ids.filter(id => !toUpdate.map(t => t.id).includes(id)),
      );
    }
  };

  const startEditing = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditingTitle(todo.title);
  };

  const cancelEditing = () => {
    setEditingTodoId(null);
    setEditingTitle('');
  };

  const handleEditSubmit = async (todo: Todo) => {
    if (updatingIds.includes(todo.id)) {
      return;
    }

    const trimmed = editingTitle.trim();

    if (trimmed === todo.title) {
      cancelEditing();

      return;
    }

    if (!trimmed) {
      handleDeleteTodo(todo.id);

      return;
    }

    setUpdatingIds(ids => [...ids, todo.id]);

    try {
      const updated = await updateTodo(todo.id, { title: trimmed });

      setTodosList(list => list.map(t => (t.id === todo.id ? updated : t)));
      cancelEditing();
    } catch {
      setErrorMsg('Unable to update a todo');
    } finally {
      setUpdatingIds(ids => ids.filter(id => id !== todo.id));
    }
  };

  if (!USER_ID) {
    return <UserWarning />;
  }

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>
      <div className="todoapp__content">
        <header className="todoapp__header">
          {todosList.length > 0 && (
            <button
              type="button"
              className={classNames('todoapp__toggle-all', {
                active:
                  todosList.length > 0 && todosList.every(t => t.completed),
              })}
              data-cy="ToggleAllButton"
              onClick={handleToggleAll}
            />
          )}
          <form onSubmit={handleAddTodo}>
            <input
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              value={newTitle}
              onChange={handleTitleChange}
              ref={newTitleRef}
              disabled={!!pendingTodo}
            />
          </form>
        </header>

        <section className="todoapp__main" data-cy="TodoList">
          {visibleTodos.map(todo => (
            <div
              key={todo.id}
              data-cy="Todo"
              className={classNames('todo', { completed: todo.completed })}
              onDoubleClick={() => startEditing(todo)}
            >
              <label className="todo__status-label">
                <input
                  data-cy="TodoStatus"
                  type="checkbox"
                  className="todo__status"
                  checked={todo.completed}
                  onChange={() => handleToggleTodo(todo)}
                />
              </label>

              {editingTodoId === todo.id ? (
                <form
                  onSubmit={e => {
                    e.preventDefault();
                    handleEditSubmit(todo);
                  }}
                >
                  <input
                    type="text"
                    className="todo__title-field"
                    data-cy="TodoTitleField"
                    value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    onBlur={() => {
                      if (!updatingIds.includes(todo.id)) {
                        handleEditSubmit(todo);
                      }
                    }}
                    onKeyUp={e => {
                      if (e.key === 'Escape') {
                        cancelEditing();
                      }
                    }}
                    autoFocus
                  />
                </form>
              ) : (
                <span data-cy="TodoTitle" className="todo__title">
                  {todo.title}
                </span>
              )}

              {editingTodoId !== todo.id && (
                <button
                  type="button"
                  className="todo__remove"
                  data-cy="TodoDelete"
                  onClick={() => handleDeleteTodo(todo.id)}
                >
                  ×
                </button>
              )}

              <div
                data-cy="TodoLoader"
                className={classNames('modal overlay', {
                  'is-active':
                    todo.id === 0 ||
                    todo.id === deletingTodoId ||
                    deletingTodosIds.includes(todo.id) ||
                    updatingIds.includes(todo.id),
                })}
              >
                <div className="modal-background has-background-white-ter" />
                <div className="loader" />
              </div>
            </div>
          ))}
        </section>

        {todosList.length > 0 && (
          <footer className="todoapp__footer" data-cy="Footer">
            <span
              className="todo-count"
              data-cy="TodosCounter"
            >{`${remainingItems.length} items left`}</span>
            <nav className="filter" data-cy="Filter">
              {['All', 'Active', 'Completed'].map(option => (
                <a
                  key={option}
                  href="#/"
                  className={classNames('filter__link', {
                    selected: currentFilter === option,
                  })}
                  data-cy={`FilterLink${option}`}
                  onClick={() => setCurrentFilter(option)}
                >
                  {option}
                </a>
              ))}
            </nav>
            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              onClick={handleDeleteCompleted}
              disabled={todosList.every(todo => !todo.completed)}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      <div
        data-cy="ErrorNotification"
        className={classNames(
          'notification is-danger is-light has-text-weight-normal',
          { hidden: !errorMsg },
        )}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          onClick={() => setErrorMsg('')}
        />
        {errorMsg}
      </div>
    </div>
  );
};
