/**
 * Outlook Sync Manager - Enhanced Event to Task Conversion
 * Handles user-controlled synchronization between Outlook events and tasks
 */

window.outlookSyncManager = {
    events: [],
    syncedEvents: new Set(),
    isInitialized: false,

    // Initialize the sync manager
    init: function() {
        if (this.isInitialized) return;
        console.log('Initializing Outlook Sync Manager...');
        this.setupEventListeners();
        this.loadSyncedEvents();
        this.isInitialized = true;
    },

    // Setup event listeners
    setupEventListeners: function() {
        // Listen for sync button clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('#sync-outlook-events')) {
                this.showEventSyncModal();
            }
            if (e.target.matches('.convert-event-btn')) {
                const eventId = e.target.dataset.eventId;
                const kanbanColumn = e.target.dataset.column;
                this.convertEventToTask(eventId, kanbanColumn);
            }
            if (e.target.matches('.remove-event-btn')) {
                const eventId = e.target.dataset.eventId;
                this.removeEventFromSync(eventId);
            }
        });
    },

    // Load previously synced events from localStorage
    loadSyncedEvents: function() {
        const stored = localStorage.getItem('syncedOutlookEvents');
        if (stored) {
            this.syncedEvents = new Set(JSON.parse(stored));
        }
    },

    // Save synced events to localStorage
    saveSyncedEvents: function() {
        localStorage.setItem('syncedOutlookEvents', JSON.stringify([...this.syncedEvents]));
    },

    // Show event sync modal with user control
    showEventSyncModal: function() {
        if (!window.microsoftGraphIntegration || !window.microsoftGraphIntegration.isAuthenticated) {
            window.showNotification('Please connect to Microsoft 365 first', 'warning');
            return;
        }

        this.fetchOutlookEvents().then(events => {
            this.events = events;
            this.renderEventSyncModal(events);
        }).catch(error => {
            console.error('Failed to fetch events:', error);
            window.showNotification('Failed to fetch Outlook events', 'error');
        });
    },

    // Fetch events from Microsoft Graph
    fetchOutlookEvents: function() {
        return new Promise((resolve, reject) => {
            if (!window.microsoftGraphIntegration) {
                reject(new Error('Microsoft Graph integration not available'));
                return;
            }

            window.microsoftGraphIntegration.getCalendarEvents()
                .then(events => {
                    // Filter out all-day events and very short events for task conversion
                    const taskableEvents = events.filter(event => {
                        const duration = (event.end - event.start) / (1000 * 60); // minutes
                        return !event.isAllDay && duration >= 15; // At least 15 minutes
                    });
                    resolve(taskableEvents);
                })
                .catch(reject);
        });
    },

    // Render the event sync modal
    renderEventSyncModal: function(events) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'event-sync-modal';
        
        modal.innerHTML = `
            <div class="modal large-modal glass-strong">
                <div class="modal-header">
                    <h2>
                        <i data-lucide="calendar-plus"></i>
                        Sync Outlook Events to Tasks
                    </h2>
                    <button type="button" class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                        <i data-lucide="x"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="sync-instructions">
                        <p>Select Outlook events to convert to tasks. Choose which Kanban column each task should start in.</p>
                    </div>
                    <div class="events-grid" id="events-grid">
                        ${this.renderEventsList(events)}
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">
                        Cancel
                    </button>
                    <button type="button" class="btn btn-primary" onclick="outlookSyncManager.convertSelectedEvents()">
                        <i data-lucide="plus"></i>
                        Convert Selected Events
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Initialize Lucide icons in the modal
        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Add modal styles
        this.addSyncModalStyles();
    },

    // Render events list
    renderEventsList: function(events) {
        if (events.length === 0) {
            return '<div class="no-events">No suitable events found for task conversion.</div>';
        }

        return events.map(event => {
            const isAlreadySynced = this.syncedEvents.has(event.id);
            const eventDate = new Date(event.start).toLocaleDateString();
            const eventTime = `${this.formatTime(event.start)} - ${this.formatTime(event.end)}`;
            
            return `
                <div class="event-sync-item ${isAlreadySynced ? 'already-synced' : ''}" data-event-id="${event.id}">
                    <div class="event-details">
                        <div class="event-title">${this.escapeHtml(event.title)}</div>
                        <div class="event-meta">
                            <span class="event-date">${eventDate}</span>
                            <span class="event-time">${eventTime}</span>
                            ${event.location ? `<span class="event-location">${this.escapeHtml(event.location)}</span>` : ''}
                        </div>
                    </div>
                    <div class="event-controls">
                        ${!isAlreadySynced ? `
                            <select class="kanban-column-select" data-event-id="${event.id}">
                                <option value="todo">To Do</option>
                                <option value="in-progress">In Progress</option>
                                <option value="done">Done</option>
                            </select>
                            <label class="sync-checkbox">
                                <input type="checkbox" data-event-id="${event.id}">
                                <span>Convert to Task</span>
                            </label>
                        ` : `
                            <span class="already-synced-label">Already synced</span>
                            <button type="button" class="btn btn-sm btn-danger remove-event-btn" data-event-id="${event.id}">
                                Remove
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    },

    // Convert selected events to tasks
    convertSelectedEvents: function() {
        const modal = document.getElementById('event-sync-modal');
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
        
        if (checkboxes.length === 0) {
            window.showNotification('Please select at least one event to convert', 'warning');
            return;
        }

        checkboxes.forEach(checkbox => {
            const eventId = checkbox.dataset.eventId;
            const select = modal.querySelector(`select[data-event-id="${eventId}"]`);
            const kanbanColumn = select ? select.value : 'todo';
            
            this.convertEventToTask(eventId, kanbanColumn);
        });

        modal.remove();
        window.showNotification(`Converted ${checkboxes.length} events to tasks`, 'success');
    },

    // Convert individual event to task
    convertEventToTask: function(eventId, kanbanColumn = 'todo') {
        const event = this.events.find(e => e.id === eventId);
        if (!event) {
            console.error('Event not found:', eventId);
            return;
        }

        // Map event properties to task properties
        const task = {
            title: event.title,
            description: `Synced from Outlook Calendar\n\nLocation: ${event.location || 'Not specified'}\nOriginal Event ID: ${event.id}`,
            priority: 'medium',
            category: 'Meeting',
            status: kanbanColumn,
            startDate: this.formatDate(event.start),
            dueDate: this.formatDate(event.end),
            assignedUsers: [window.auth.currentUser], // Assign to current user
            outlookEventId: event.id, // Track the original event
            isOutlookSync: true // Mark as synced from Outlook
        };

        // Add task to the system
        if (window.taskManager) {
            window.taskManager.addTask(task).then(() => {
                // Mark event as synced
                this.syncedEvents.add(eventId);
                this.saveSyncedEvents();
                
                // Update views
                window.taskManager.refreshUI();
                
                window.showNotification(`Event "${event.title}" converted to task`, 'success');
            }).catch(error => {
                console.error('Failed to create task:', error);
                window.showNotification('Failed to create task from event', 'error');
            });
        }
    },

    // Remove event from sync
    removeEventFromSync: function(eventId) {
        // Find and remove the corresponding task
        if (window.taskManager && window.taskManager.tasks) {
            const syncedTask = window.taskManager.tasks.find(task => task.outlookEventId === eventId);
            if (syncedTask) {
                window.taskManager.deleteTask(syncedTask.id).then(() => {
                    this.syncedEvents.delete(eventId);
                    this.saveSyncedEvents();
                    window.showNotification('Event removed from sync', 'success');
                });
            }
        }
    },

    // Update Outlook event when task changes (two-way sync)
    updateOutlookEvent: function(task) {
        if (!task.isOutlookSync || !task.outlookEventId) return;

        if (!window.microsoftGraphIntegration || !window.microsoftGraphIntegration.isAuthenticated) {
            console.warn('Cannot sync to Outlook: not authenticated');
            return;
        }

        // Prepare event update data
        const eventUpdate = {
            subject: task.title,
            start: {
                dateTime: new Date(task.startDate + 'T09:00:00').toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            end: {
                dateTime: new Date(task.dueDate + 'T17:00:00').toISOString(),
                timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
            },
            body: {
                contentType: 'text',
                content: task.description || ''
            }
        };

        // Update the event in Outlook
        this.updateEventInOutlook(task.outlookEventId, eventUpdate);
    },

    // Update event in Outlook Calendar
    updateEventInOutlook: function(eventId, eventData) {
        if (!window.microsoftGraphIntegration) return;

        const cleanEventId = eventId.replace('outlook-', '');
        
        window.microsoftGraphIntegration.makeGraphRequest(
            `https://graph.microsoft.com/v1.0/me/events/${cleanEventId}`,
            'PATCH',
            eventData
        ).then(() => {
            console.log('Event updated in Outlook successfully');
        }).catch(error => {
            console.error('Failed to update Outlook event:', error);
        });
    },

    // Add styles for the sync modal
    addSyncModalStyles: function() {
        if (document.getElementById('sync-modal-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'sync-modal-styles';
        styles.textContent = `
            .events-grid {
                max-height: 400px;
                overflow-y: auto;
                margin: 20px 0;
            }

            .event-sync-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 15px;
                margin: 10px 0;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                border-left: 4px solid #0078d4;
            }

            .event-sync-item.already-synced {
                border-left-color: #28a745;
                opacity: 0.7;
            }

            .event-details {
                flex: 1;
            }

            .event-title {
                font-weight: 600;
                font-size: 16px;
                margin-bottom: 5px;
            }

            .event-meta {
                display: flex;
                gap: 15px;
                font-size: 14px;
                opacity: 0.8;
            }

            .event-controls {
                display: flex;
                align-items: center;
                gap: 15px;
            }

            .kanban-column-select {
                padding: 5px 10px;
                border-radius: 4px;
                border: 1px solid rgba(255, 255, 255, 0.3);
                background: rgba(255, 255, 255, 0.1);
                color: inherit;
            }

            .sync-checkbox {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }

            .already-synced-label {
                color: #28a745;
                font-weight: 500;
            }

            .no-events {
                text-align: center;
                padding: 40px;
                opacity: 0.7;
            }

            .sync-instructions {
                background: rgba(0, 120, 212, 0.1);
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                border-left: 4px solid #0078d4;
            }

            /* Outlook event styling in calendar and kanban */
            .task-card.outlook-synced {
                border-left: 4px solid #0078d4;
                background: linear-gradient(135deg, rgba(0, 120, 212, 0.1), rgba(16, 110, 190, 0.1));
            }

            .task-card.outlook-synced::before {
                content: "📅";
                position: absolute;
                top: 8px;
                right: 8px;
                font-size: 12px;
            }

            .outlook-event-badge {
                background: #0078d4;
                color: white;
                padding: 2px 6px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 500;
                display: inline-block;
                margin-left: 8px;
            }
        `;

        document.head.appendChild(styles);
    },

    // Utility functions
    formatTime: function(date) {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    formatDate: function(date) {
        return new Date(date).toISOString().split('T')[0];
    },

    escapeHtml: function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.outlookSyncManager.init();
    });
} else {
    window.outlookSyncManager.init();
}