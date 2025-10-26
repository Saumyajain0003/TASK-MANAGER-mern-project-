import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL;

function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  // Task states
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('general');
  const [tags, setTags] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editingId, setEditingId] = useState(null);

  // Filter & UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCompleted, setFilterCompleted] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState(null);

  const [categories, setCategories] = useState([]);

  // Fetch tasks function
  const fetchTasks = useCallback(async (token = null) => {
    try {
      const authToken = token || localStorage.getItem('token');
      const params = new URLSearchParams({
        ...(searchQuery && { search: searchQuery }),
        ...(filterCategory !== 'all' && { category: filterCategory }),
        ...(filterPriority !== 'all' && { priority: filterPriority }),
        ...(filterCompleted !== 'all' && { completed: filterCompleted }),
        sortBy,
      });

      const response = await fetch(`${API_URL}/tasks?${params}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      } else {
        console.error('Failed to fetch tasks');
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  }, [searchQuery, filterCategory, filterPriority, filterCompleted, sortBy]);

  const fetchCategories = async (token = null) => {
    try {
      const authToken = token || localStorage.getItem('token');
      const response = await fetch(`${API_URL}/categories`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/tasks/stats/summary`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setShowStats(true);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  // Check for stored token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const storedDarkMode = localStorage.getItem('darkMode');

    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(storedUser));
      fetchTasks(token);
      fetchCategories(token);
    }

    if (storedDarkMode === 'true') {
      setDarkMode(true);
      document.body.classList.add('dark-mode');
    }
  }, [fetchTasks]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTasks();
    }
  }, [isAuthenticated, fetchTasks]);

  // Auth functions
  const handleAuth = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
    const body = authMode === 'login' ? { email, password } : { username, email, password };
    const url = `${API_URL}${endpoint}`;
    console.log(url);
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      console.error('Non-JSON response from backend:', await response.text());
    }

    if (!response.ok || !data) {
      alert(data?.message || 'Authentication failed or backend URL is wrong');
      setLoading(false);
      return;
    }

    if (!data.token || !data.user) {
      alert('Invalid response from server');
      setLoading(false);
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setIsAuthenticated(true);
    setUser(data.user);
    setEmail('');
    setPassword('');
    setUsername('');

    fetchTasks(data.token);
    fetchCategories(data.token);
  } catch (err) {
    console.error('Auth error:', err);
    alert('Network error. Check backend URL.');
  }
  setLoading(false);
};


  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    setTasks([]);
  };

  // Task CRUD
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      const taskData = {
        title,
        description,
        priority,
        category,
        tags: tags.split(',').map((t) => t.trim()).filter((t) => t),
        dueDate: dueDate || undefined,
      };

      if (editingId) {
        const response = await fetch(`${API_URL}/tasks/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(taskData),
        });
        if (response.ok) {
          const updatedTask = await response.json();
          setTasks(tasks.map((t) => (t._id === editingId ? updatedTask : t)));
          setEditingId(null);
        }
      } else {
        const response = await fetch(`${API_URL}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(taskData),
        });
        if (response.ok) {
          const newTask = await response.json();
          setTasks([newTask, ...tasks]);
        }
      }

      resetForm();
      fetchCategories();
    } catch (err) {
      console.error('Error saving task:', err);
      alert('Failed to save task');
    }
    setLoading(false);
  };

  const toggleComplete = async (id, completed) => {
    try {
      const response = await fetch(`${API_URL}/tasks/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ completed: !completed }),
      });
      if (response.ok) {
        const updatedTask = await response.json();
        setTasks(tasks.map((t) => (t._id === id ? updatedTask : t)));
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;

    try {
      const response = await fetch(`${API_URL}/tasks/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        setTasks(tasks.filter((t) => t._id !== id));
        fetchCategories();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const editTask = (task) => {
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setCategory(task.category);
    setTags(task.tags.join(', '));
    setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    setEditingId(task._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('general');
    setTags('');
    setDueDate('');
    setEditingId(null);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', (!darkMode).toString());
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#dc3545';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && !tasks.find((t) => t.dueDate === dueDate)?.completed;
  };

  // Render
  if (!isAuthenticated) {
    return (
      <div className="App auth-page">
        <div className="auth-container">
          <h1>📝 Task Manager</h1>
          <div className="auth-tabs">
            <button className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>
              Login
            </button>
            <button className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>
              Register
            </button>
          </div>
          <form onSubmit={handleAuth} className="auth-form">
            {authMode === 'register' && (
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength="3"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="6"
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Register'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`App ${darkMode ? 'dark-mode' : ''}`}>
      <div className="container">
        <header className="app-header">
          <h1>📝 Task Manager</h1>
          <div className="header-actions">
            <button onClick={fetchStats} className="stats-btn">📊 Stats</button>
            <button onClick={toggleDarkMode} className="theme-btn">{darkMode ? '☀️' : '🌙'}</button>
            <div className="user-info">
              <span>👤 {user?.username}</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          </div>
        </header>

        {showStats && stats && (
          <div className="stats-panel">
            <button className="close-stats" onClick={() => setShowStats(false)}>✕</button>
            <h3>📊 Task Statistics</h3>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{stats.total}</div>
                <div className="stat-label">Total Tasks</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.completed}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{stats.pending}</div>
                <div className="stat-label">Pending</div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="task-form">
          <input type="text" placeholder="Task title *" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows="2" />

          <div className="form-row">
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">🟢 Low Priority</option>
              <option value="medium">🟡 Medium Priority</option>
              <option value="high">🔴 High Priority</option>
            </select>

            <input type="text" placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} list="categories" />
            <datalist id="categories">
              {categories.map((cat, i) => <option key={i} value={cat} />)}
            </datalist>
          </div>

          <div className="form-row">
            <input type="text" placeholder="Tags (comma separated)" value={tags} onChange={(e) => setTags(e.target.value)} />
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>

          <div className="form-buttons">
            <button type="submit" disabled={loading}>{loading ? 'Saving...' : editingId ? 'Update Task' : 'Add Task'}</button>
            {editingId && <button type="button" onClick={resetForm} className="cancel-btn">Cancel</button>}
          </div>
        </form>

        <div className="filters-section">
          <input type="text" placeholder="🔍 Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
          <div className="filters">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
            </select>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={filterCompleted} onChange={(e) => setFilterCompleted(e.target.value)}>
              <option value="all">All Status</option>
              <option value="false">Pending</option>
              <option value="true">Completed</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="createdAt">Sort: Newest</option>
              <option value="dueDate">Sort: Due Date</option>
              <option value="priority">Sort: Priority</option>
              <option value="title">Sort: Title</option>
            </select>
          </div>
        </div>

        <div className="tasks-list">
          <h2>Tasks ({tasks.length})</h2>
          {tasks.length === 0 ? (
            <p className="empty-state">
              {searchQuery || filterCategory !== 'all' || filterPriority !== 'all' || filterCompleted !== 'all'
                ? 'No tasks match your filters 🔍'
                : 'No tasks yet. Create one above! 🚀'}
            </p>
          ) : (
            tasks.map(task => (
              <div key={task._id} className={`task-item ${task.completed ? 'completed' : ''} ${isOverdue(task.dueDate) ? 'overdue' : ''}`}>
                <div className="task-content">
                  <div className="task-header">
                    <input type="checkbox" checked={task.completed} onChange={() => toggleComplete(task._id, task.completed)} />
                    <h3>{task.title}</h3>
                    <span className="priority-badge" style={{ backgroundColor: getPriorityColor(task.priority) }}>{task.priority}</span>
                  </div>
                  {task.description && <p className="task-description">{task.description}</p>}
                  <div className="task-meta">
                    <span className="category-tag">📁 {task.category}</span>
                    {task.tags.length > 0 && (
                      <div className="tags">
                        {task.tags.map((tag, i) => <span key={i} className="tag">#{tag}</span>)}
                      </div>
                    )}
                    {task.dueDate && (
                      <span className={`due-date ${isOverdue(task.dueDate) ? 'overdue' : ''}`}>
                        📅 {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                    <small className="created-date">Created: {new Date(task.createdAt).toLocaleDateString()}</small>
                  </div>
                </div>
                <div className="task-actions">
                  <button onClick={() => editTask(task)} className="edit-btn">✏️</button>
                  <button onClick={() => deleteTask(task)} className="delete-btn">🗑️</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
