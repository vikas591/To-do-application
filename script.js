document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const STORAGE_KEY = 'premium_tasks_v3';
    const GAMIFICATION_KEY = 'premium_gamification_v1';

    // --- DOM Elements ---
    const taskInput = document.getElementById('taskInput');
    const priorityInput = document.getElementById('priorityInput');
    const categoryInput = document.getElementById('categoryInput');
    const dueDateInput = document.getElementById('dueDateInput');
    const searchInput = document.getElementById('searchInput');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskList = document.getElementById('taskList');
    const dateDisplay = document.getElementById('dateDisplay');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const clearCompletedBtn = document.getElementById('clearCompletedBtn');
    const emptyState = document.getElementById('emptyState');
    const themeToggle = document.getElementById('themeToggle');
    const toastContainer = document.getElementById('toast-container');

    // User Stats Elements
    const levelDisplay = document.getElementById('levelDisplay');
    const xpBarFill = document.getElementById('xpBarFill');
    const xpText = document.getElementById('xpText');
    const streakDisplay = document.getElementById('streakDisplay');

    // Data Elements
    const exportBtn = document.getElementById('exportBtn');
    const importDisplayBtn = document.getElementById('importDisplayBtn');
    const importInput = document.getElementById('importInput');
    const resetStatsBtn = document.getElementById('resetStatsBtn');

    // --- State ---
    let tasks = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let isDarkMode = localStorage.getItem('theme') !== 'light';

    // --- Init Flatpickr ---
    flatpickr("#dueDateInput", {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        minDate: "today",
        time_24hr: false
    });

    // --- Gamification System ---
    class Gamification {
        constructor() {
            const saved = JSON.parse(localStorage.getItem(GAMIFICATION_KEY)) || {};
            this.xp = saved.xp || 0;
            this.level = saved.level || 1;
            this.streak = saved.streak || 0;
            this.lastTaskDate = saved.lastTaskDate || null;
            this.updateUI();
        }

        addXP(amount) {
            this.xp += amount;
            const xpForNextLevel = this.level * 100;

            if (this.xp >= xpForNextLevel) {
                this.xp -= xpForNextLevel;
                this.level++;
                playSound('levelup');
                showToast(`Level Up! Welcome to Level ${this.level} 🎉`, 'success');
                fireConfetti();
            }

            this.save();
            this.updateUI();
        }

        updateStreak() {
            const today = new Date().toDateString();
            if (this.lastTaskDate !== today) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                if (this.lastTaskDate === yesterday.toDateString()) {
                    this.streak++;
                } else {
                    if (this.lastTaskDate !== today) this.streak = 1;
                }
                this.lastTaskDate = today;
                this.save();
                this.updateUI();
            }
        }

        reset() {
            this.xp = 0;
            this.level = 1;
            this.streak = 0;
            this.lastTaskDate = null;
            this.save();
            this.updateUI();
            showToast('Streak and Stats reset.', 'info');
        }

        save() {
            localStorage.setItem(GAMIFICATION_KEY, JSON.stringify({
                xp: this.xp,
                level: this.level,
                streak: this.streak,
                lastTaskDate: this.lastTaskDate
            }));
        }

        updateUI() {
            levelDisplay.textContent = `Lvl ${this.level}`;
            const xpForNextLevel = this.level * 100;
            const percentage = (this.xp / xpForNextLevel) * 100;
            xpBarFill.style.width = `${percentage}%`;
            xpText.textContent = `${this.xp} / ${xpForNextLevel} XP`;
            streakDisplay.textContent = `🔥 ${this.streak} Day Streak`;
        }
    }

    const game = new Gamification();

    // --- Audio Context ---
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContext();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'complete') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, now);
            osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start();
            osc.stop(now + 0.3);
        } else if (type === 'delete') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(150, now);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.linearRampToValueAtTime(0.01, now + 0.15);
            osc.start();
            osc.stop(now + 0.15);
        } else if (type === 'notify') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start();
            osc.stop(now + 0.2);
        } else if (type === 'levelup') {
            const notes = [440, 554, 659, 880];
            notes.forEach((freq, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.connect(g);
                g.connect(audioCtx.destination);
                o.type = 'square';
                o.frequency.value = freq;
                g.gain.setValueAtTime(0.1, now + i * 0.1);
                g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
                o.start(now + i * 0.1);
                o.stop(now + i * 0.1 + 0.2);
            });
        }
    }

    // --- Core Logic ---
    function loadTasks() {
        let stored = localStorage.getItem(STORAGE_KEY);
        if (!stored && localStorage.getItem('premium_tasks_v3')) {
            // Migration if needed
            stored = localStorage.getItem('premium_tasks_v3');
        }

        if (stored) {
            tasks = JSON.parse(stored);
        }
        renderTasks();
    }

    function saveTasks() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
        checkEmptyState();
    }

    function init() {
        applyTheme();
        displayDate();
        loadTasks();
        setupDragAndDrop();
        requestNotificationPermission();

        setInterval(checkReminders, 30000);
        setInterval(updateCountdowns, 60000);
        setTimeout(checkReminders, 2000);
        updateCountdowns();

        // Data Events
        exportBtn.addEventListener('click', exportData);
        importDisplayBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', importData);
        resetStatsBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to reset your Streak and Stats?')) {
                game.reset();
            }
        });
    }

    // --- Reminder System ---
    function requestNotificationPermission() {
        if ('Notification' in window && Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }

    function checkReminders() {
        const now = new Date();
        tasks.forEach(task => {
            if (!task.completed && task.dueDate) {
                const due = new Date(task.dueDate);
                const timeDiff = due - now;
                const minutesDiff = timeDiff / 60000;

                // Trigger 5 minutes before (allow range 4-6 minutes to be safe and reliable)
                if (minutesDiff > 4 && minutesDiff <= 6) {
                    if (!task.reminded) {
                        if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('Task Due Soon! ⏰', {
                                body: `"${task.text}" is due in 5 minutes!`,
                                icon: 'https://cdn-icons-png.flaticon.com/512/762/762696.png'
                            });
                            playSound('notify');
                        }
                        task.reminded = true;
                        saveTasks();
                    }
                }
            }
        });
    }

    function updateCountdowns() {
        tasks.forEach(task => {
            if (!task.completed && task.dueDate) {
                const badge = document.getElementById(`timer-${task.id}`);
                if (badge) {
                    const diff = new Date(task.dueDate) - new Date();
                    if (diff > 0) {
                        const hours = Math.floor(diff / (1000 * 60 * 60));
                        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

                        let text = '';
                        if (hours > 24) text = `${Math.floor(hours / 24)}d left`;
                        else if (hours > 0) text = `${hours}h ${minutes}m`;
                        else text = `${minutes}m`;

                        badge.textContent = `⏳ ${text}`;
                        if (diff < 5 * 60000) badge.classList.add('urgent');
                        else badge.classList.remove('urgent');
                    } else {
                        badge.textContent = '⚠️ Late';
                        badge.classList.add('urgent');
                    }
                }
            }
        });
    }

    // ... (Theme, Date, Etc - unchanged) ...
    function applyTheme() {
        if (isDarkMode) document.body.removeAttribute('data-theme');
        else document.body.setAttribute('data-theme', 'light');
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            isDarkMode = !isDarkMode;
            localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
            applyTheme();
            showToast(isDarkMode ? 'Dark Mode' : 'Light Mode', 'info');
        });
    }

    function displayDate() {
        const date = new Date();
        const options = { weekday: 'long', month: 'short', day: 'numeric' };
        if (dateDisplay) dateDisplay.textContent = date.toLocaleDateString('en-US', options);
    }

    function checkEmptyState() {
        const visibleTasks = taskList.children.length;
        if (visibleTasks === 0) {
            emptyState.style.display = 'block';
            emptyState.querySelector('p').textContent =
                searchQuery ? `No tasks match "${searchQuery}"` :
                    currentFilter !== 'all' ? `No ${currentFilter} tasks.` :
                        'No tasks found. Add a new task!';
        } else {
            emptyState.style.display = 'none';
        }
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        const due = new Date(dateString);
        const today = new Date();
        const isToday = due.toDateString() === today.toDateString();
        const timeStr = due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (isToday) return `Today, ${timeStr}`;
        const dateStr = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${dateStr}, ${timeStr}`;
    }

    function isOverdue(dateString) {
        if (!dateString) return false;
        return new Date(dateString) < new Date();
    }

    // --- Render ---
    function createTaskElement(task) {
        const li = document.createElement('li');
        li.className = `task-item ${task.completed ? 'completed' : ''}`;
        li.draggable = true;
        li.dataset.id = task.id;

        const overdueClass = !task.completed && isOverdue(task.dueDate) ? 'overdue' : '';

        li.innerHTML = `
            <div class="drag-handle">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"></circle><circle cx="9" cy="5" r="1"></circle><circle cx="9" cy="19" r="1"></circle><circle cx="15" cy="12" r="1"></circle><circle cx="15" cy="5" r="1"></circle><circle cx="15" cy="19" r="1"></circle></svg>
            </div>
            
            <div class="custom-checkbox">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            
            <div class="task-content-wrapper">
                <div class="task-main">
                    <span class="task-text" contenteditable="${!task.completed}">${escapeHtml(task.text)}</span>
                </div>
                <div class="task-meta">
                    <span class="badge category-badge category-${task.category}">${task.category}</span>
                    <span class="badge priority-${task.priority}">${task.priority}</span>
                    ${task.dueDate ? `
                        <span style="display:flex;align-items:center;gap:4px;color:${overdueClass ? 'var(--danger)' : 'inherit'}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            ${formatDate(task.dueDate)}
                        </span>
                        <span class="countdown-badge" id="timer-${task.id}"></span>
                    ` : ''}
                </div>
            </div>

            <button class="delete-btn" aria-label="Delete task">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>
        `;

        li.querySelector('.custom-checkbox').addEventListener('click', () => toggleTask(task.id));

        const textSpan = li.querySelector('.task-text');
        textSpan.addEventListener('blur', () => updateTaskText(task.id, textSpan.textContent));
        textSpan.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); textSpan.blur(); }
        });

        // Delete button logic
        li.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTask(task.id, li);
        });

        li.addEventListener('dragstart', handleDragStart);
        li.addEventListener('dragend', handleDragEnd);

        setTimeout(() => {
            const badge = li.querySelector(`#timer-${task.id}`);
            if (badge) updateCountdowns();
        }, 0);

        return li;
    }

    function renderTasks() {
        taskList.innerHTML = '';
        const filteredTasks = tasks.filter(task => {
            if (currentFilter === 'active' && task.completed) return false;
            if (currentFilter === 'completed' && !task.completed) return false;
            if (searchQuery) {
                const lower = searchQuery.toLowerCase();
                if (!task.text.toLowerCase().includes(lower) && !task.category.toLowerCase().includes(lower)) return false;
            }
            return true;
        });
        filteredTasks.forEach(task => taskList.appendChild(createTaskElement(task)));
        checkEmptyState();
        updateCountdowns();
    }

    // --- Actions ---
    function exportData() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "my_tasks_" + new Date().toISOString().slice(0, 10) + ".json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showToast('Tasks exported successfully', 'success');
    }
    function importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (event) {
            try {
                const importedTasks = JSON.parse(event.target.result);
                if (Array.isArray(importedTasks)) {
                    tasks = importedTasks.map(t => {
                        const { subtasks, ...rest } = t;
                        return { ...rest, reminded: false, smsSent: false };
                    });
                    saveTasks();
                    renderTasks();
                    showToast('Tasks imported successfully!', 'success');
                } else { showToast('Invalid file format', 'error'); }
            } catch (err) { console.error(err); showToast('Error parsing file', 'error'); }
        };
        reader.readAsText(file);
        e.target.value = '';
    }
    function addTask() {
        const text = taskInput.value.trim();
        const priority = priorityInput.value;
        const category = categoryInput.value;
        const dueDate = dueDateInput.value;

        if (text === '') {
            showToast('Please enter a task name!', 'error');
            return;
        }

        const newTask = {
            id: Date.now().toString(),
            text: text,
            priority: priority,
            category: category,
            dueDate: dueDate || null,
            completed: false,
            reminded: false
        };

        tasks.unshift(newTask);
        saveTasks();
        renderTasks();

        showToast('Task added +10 XP', 'success');
        game.addXP(10);
        taskInput.value = '';
    }
    function toggleTask(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            saveTasks();
            renderTasks();
            if (task.completed) {
                playSound('complete');
                game.addXP(20);
                game.updateStreak();
                showToast(`Task Complete! +20 XP`, 'success');
                fireConfetti();
            }
        }
    }
    function updateTaskText(id, newText) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.text = newText.trim();
            saveTasks();
        }
    }
    function deleteTask(id, element) {
        playSound('delete');
        element.classList.add('removing');
        setTimeout(() => {
            tasks = tasks.filter(t => t.id !== id);
            saveTasks();
            renderTasks();
            showToast('Task removed', 'error');
        }, 300);
    }
    function clearCompleted() {
        const completedCount = tasks.filter(t => t.completed).length;
        if (completedCount === 0) return;
        const completedElements = document.querySelectorAll('.task-item.completed');
        playSound('delete');
        completedElements.forEach(el => el.classList.add('removing'));
        setTimeout(() => {
            tasks = tasks.filter(t => !t.completed);
            saveTasks();
            renderTasks();
            showToast('Cleared completed tasks', 'success');
        }, 300);
    }
    function setFilter(filter, btn) {
        currentFilter = filter;
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTasks();
    }

    let draggedItem = null;
    function setupDragAndDrop() {
        taskList.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(taskList, e.clientY);
            const draggable = document.querySelector('.task-item.dragging');
            if (draggable) {
                if (afterElement == null) taskList.appendChild(draggable);
                else taskList.insertBefore(draggable, afterElement);
            }
        });
    }
    function handleDragStart(e) { draggedItem = this; this.classList.add('dragging'); setTimeout(() => (this.style.opacity = '0.5'), 0); }
    function handleDragEnd(e) { this.classList.remove('dragging'); this.style.opacity = '1'; draggedItem = null; updateTaskOrder(); }
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
            else return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    function updateTaskOrder() {
        const newOrderIds = [...taskList.querySelectorAll('.task-item')].map(item => item.dataset.id);
        const reorderedTasks = [];
        newOrderIds.forEach(id => { const task = tasks.find(t => t.id === id); if (task) reorderedTasks.push(task); });
        const invisibleTasks = tasks.filter(t => !newOrderIds.includes(t.id));
        tasks = [...reorderedTasks, ...invisibleTasks];
        saveTasks();
    }
    function escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span style="font-weight:bold">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span> <span>${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => { toast.classList.add('hiding'); toast.addEventListener('transitionend', () => toast.remove()); }, 3000);
    }
    function fireConfetti() {
        const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];
        for (let i = 0; i < 30; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti');
            document.body.appendChild(confetti);
            const x = Math.random() * window.innerWidth;
            confetti.style.left = `${x}px`;
            confetti.style.top = `-10px`;
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            const duration = Math.random() * 2 + 2;
            confetti.style.animationDuration = `${duration}s`;
            setTimeout(() => confetti.remove(), duration * 1000);
        }
    }

    // Event Listeners (Main)
    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });
    clearCompletedBtn.addEventListener('click', clearCompleted);
    filterBtns.forEach(btn => btn.addEventListener('click', () => setFilter(btn.dataset.filter, btn)));
    searchInput.addEventListener('input', (e) => { searchQuery = e.target.value.trim(); renderTasks(); });

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Failed:', err));
    }

    // --- PWA Install Logic ---
    let deferredPrompt;
    const installAppBtn = document.getElementById('installAppBtn');
    const installModal = document.getElementById('installModal');
    const modalInstallBtn = document.getElementById('modalInstallBtn');
    const modalNotNowBtn = document.getElementById('modalNotNowBtn');

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = e;

        // Show the install button in header
        if (installAppBtn) installAppBtn.style.display = 'flex';

        // Check if user dismissed recently (wait 24h)
        const lastDismissed = localStorage.getItem('installPromptDismissed');
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        if (!lastDismissed || (now - parseInt(lastDismissed) > oneDay)) {
            // Show the modal popup immediately if not dismissed recently
            if (installModal) installModal.style.display = 'flex';
        }
    });

    async function triggerInstall() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;

            // Hide everything
            if (installAppBtn) installAppBtn.style.display = 'none';
            if (installModal) installModal.style.display = 'none';
        }
    }

    if (installAppBtn) installAppBtn.addEventListener('click', triggerInstall);

    if (modalInstallBtn) modalInstallBtn.addEventListener('click', triggerInstall);

    if (modalNotNowBtn) {
        modalNotNowBtn.addEventListener('click', () => {
            if (installModal) installModal.style.display = 'none';
            // Save dismissal time
            localStorage.setItem('installPromptDismissed', Date.now().toString());
            showToast('Reminder set for tomorrow', 'info');
        });
    }

    window.addEventListener('appinstalled', () => {
        console.log('PWA was installed');
        if (installAppBtn) installAppBtn.style.display = 'none';
        if (installModal) installModal.style.display = 'none';
        showToast('App installed successfully!', 'success');
    });

    init();
});
