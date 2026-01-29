$(document).ready(function() {
    // State
    let tasks = [];
    let editingTaskId = null;
    let deletingTaskId = null;

    // Initialize
    loadTasks();
    initializeSortable();
    bindEvents();

    // Load tasks from server
    function loadTasks() {
        $.ajax({
            url: '/api/tasks',
            method: 'GET',
            success: function(data) {
                tasks = data.tasks || [];
                renderAllTasks();
            },
            error: function(err) {
                console.error('Error loading tasks:', err);
            }
        });
    }

    // Render all tasks
    function renderAllTasks() {
        $('#todo-tasks').empty();
        $('#doing-tasks').empty();
        $('#done-tasks').empty();

        const columns = { todo: [], doing: [], done: [] };

        tasks.forEach(task => {
            if (columns[task.column]) {
                columns[task.column].push(task);
            }
        });

        // Render each column
        Object.keys(columns).forEach(column => {
            const columnTasks = columns[column];
            const container = $(`#${column}-tasks`);

            if (columnTasks.length === 0) {
                container.html(getEmptyState(column));
            } else {
                columnTasks.forEach(task => {
                    container.append(createTaskCard(task));
                });
            }

            $(`#${column}-count`).text(columnTasks.length);
        });

        // Refresh sortable after rendering
        $('.column-content').sortable('refresh');
    }

    // Create task card HTML
    function createTaskCard(task) {
        const date = new Date(task.created_at);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });

        return `
            <div class="task-card" data-id="${task.id}">
                <div class="task-header">
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    <div class="task-actions">
                        <button class="task-action-btn edit-btn" title="Edit">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="task-action-btn delete-btn" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
                <div class="task-footer">
                    <span class="task-priority priority-${task.priority}">${task.priority}</span>
                    <span class="task-date">${formattedDate}</span>
                </div>
            </div>
        `;
    }

    // Get empty state HTML
    function getEmptyState(column) {
        const icons = {
            todo: 'fa-clipboard-list',
            doing: 'fa-hourglass-half',
            done: 'fa-check-circle'
        };
        const messages = {
            todo: 'No tasks to do',
            doing: 'No tasks in progress',
            done: 'No completed tasks'
        };
        return `
            <div class="empty-state">
                <i class="fas ${icons[column]}"></i>
                <p>${messages[column]}</p>
            </div>
        `;
    }

    // Initialize jQuery UI Sortable
    function initializeSortable() {
        $('.column-content').sortable({
            connectWith: '.column-content',
            placeholder: 'task-card ui-sortable-placeholder',
            items: '> .task-card',
            tolerance: 'pointer',
            cursor: 'grabbing',
            opacity: 0.8,
            revert: 150,
            cancel: '.task-action-btn',
            start: function(e, ui) {
                ui.placeholder.height(ui.item.outerHeight());
                ui.item.addClass('ui-sortable-helper');
            },
            stop: function(e, ui) {
                ui.item.removeClass('ui-sortable-helper');
            },
            receive: function(e, ui) {
                const taskId = ui.item.data('id');
                const newColumn = $(this).closest('.column').data('column');
                moveTask(taskId, newColumn);
            },
            over: function(e, ui) {
                $(this).addClass('drag-over');
            },
            out: function(e, ui) {
                $(this).removeClass('drag-over');
            }
        });
    }

    // Bind events
    function bindEvents() {
        // Add task button
        $('#addTaskBtn').on('click', function() {
            openModal();
        });

        // Close modals
        $('#closeModal, #cancelBtn').on('click', closeModal);
        $('#closeDeleteModal, #cancelDeleteBtn').on('click', closeDeleteModal);

        // Click outside modal to close
        $('.modal').on('click', function(e) {
            if ($(e.target).hasClass('modal')) {
                closeModal();
                closeDeleteModal();
            }
        });

        // Form submit
        $('#taskForm').on('submit', function(e) {
            e.preventDefault();
            saveTask();
        });

        // Edit task
        $(document).on('click', '.edit-btn', function(e) {
            e.stopPropagation();
            const taskId = $(this).closest('.task-card').data('id');
            openModal(taskId);
        });

        // Delete task
        $(document).on('click', '.delete-btn', function(e) {
            e.stopPropagation();
            const taskId = $(this).closest('.task-card').data('id');
            openDeleteModal(taskId);
        });

        // Confirm delete
        $('#confirmDeleteBtn').on('click', function() {
            if (deletingTaskId) {
                deleteTask(deletingTaskId);
            }
        });

        // Keyboard shortcuts
        $(document).on('keydown', function(e) {
            if (e.key === 'Escape') {
                closeModal();
                closeDeleteModal();
            }
        });
    }

    // Open add/edit modal
    function openModal(taskId = null) {
        editingTaskId = taskId;

        if (taskId) {
            // Edit mode
            const task = tasks.find(t => t.id === taskId);
            if (task) {
                $('#modalTitle').text('Edit Task');
                $('#taskId').val(task.id);
                $('#taskTitle').val(task.title);
                $('#taskDescription').val(task.description);
                $('#taskPriority').val(task.priority);
                $('#taskColumn').val(task.column);
                $('#columnSelectGroup').show();
                $('#saveTaskBtn').text('Update Task');
            }
        } else {
            // Add mode
            $('#modalTitle').text('Add New Task');
            $('#taskForm')[0].reset();
            $('#taskId').val('');
            $('#columnSelectGroup').hide();
            $('#saveTaskBtn').text('Add Task');
        }

        $('#taskModal').addClass('active');
        $('#taskTitle').focus();
    }

    // Close add/edit modal
    function closeModal() {
        $('#taskModal').removeClass('active');
        editingTaskId = null;
        $('#taskForm')[0].reset();
    }

    // Open delete confirmation modal
    function openDeleteModal(taskId) {
        deletingTaskId = taskId;
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            $('#deleteTaskTitle').text(task.title);
            $('#deleteModal').addClass('active');
        }
    }

    // Close delete modal
    function closeDeleteModal() {
        $('#deleteModal').removeClass('active');
        deletingTaskId = null;
    }

    // Save task (create or update)
    function saveTask() {
        const taskData = {
            title: $('#taskTitle').val().trim(),
            description: $('#taskDescription').val().trim(),
            priority: $('#taskPriority').val()
        };

        if (!taskData.title) {
            alert('Please enter a task title');
            return;
        }

        if (editingTaskId) {
            // Update existing task
            taskData.column = $('#taskColumn').val();
            $.ajax({
                url: `/api/tasks/${editingTaskId}`,
                method: 'PUT',
                contentType: 'application/json',
                data: JSON.stringify(taskData),
                success: function(updatedTask) {
                    const index = tasks.findIndex(t => t.id === editingTaskId);
                    if (index !== -1) {
                        tasks[index] = updatedTask;
                    }
                    renderAllTasks();
                    closeModal();
                },
                error: function(err) {
                    console.error('Error updating task:', err);
                    alert('Failed to update task');
                }
            });
        } else {
            // Create new task
            taskData.column = 'todo';
            $.ajax({
                url: '/api/tasks',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(taskData),
                success: function(newTask) {
                    tasks.push(newTask);
                    renderAllTasks();
                    closeModal();
                },
                error: function(err) {
                    console.error('Error creating task:', err);
                    alert('Failed to create task');
                }
            });
        }
    }

    // Move task to different column
    function moveTask(taskId, newColumn) {
        $.ajax({
            url: `/api/tasks/${taskId}/move`,
            method: 'PUT',
            contentType: 'application/json',
            data: JSON.stringify({ column: newColumn }),
            success: function(updatedTask) {
                const index = tasks.findIndex(t => t.id === taskId);
                if (index !== -1) {
                    tasks[index] = updatedTask;
                }
                updateTaskCounts();
            },
            error: function(err) {
                console.error('Error moving task:', err);
                loadTasks(); // Reload to sync state
            }
        });
    }

    // Delete task
    function deleteTask(taskId) {
        $.ajax({
            url: `/api/tasks/${taskId}`,
            method: 'DELETE',
            success: function() {
                tasks = tasks.filter(t => t.id !== taskId);
                renderAllTasks();
                closeDeleteModal();
            },
            error: function(err) {
                console.error('Error deleting task:', err);
                alert('Failed to delete task');
            }
        });
    }

    // Update task counts
    function updateTaskCounts() {
        const counts = { todo: 0, doing: 0, done: 0 };
        tasks.forEach(task => {
            if (counts[task.column] !== undefined) {
                counts[task.column]++;
            }
        });
        Object.keys(counts).forEach(column => {
            $(`#${column}-count`).text(counts[column]);
        });
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});
