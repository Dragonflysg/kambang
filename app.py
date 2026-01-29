from flask import Flask, render_template, jsonify, request
import json
import os
from datetime import datetime
import uuid

app = Flask(__name__)

DATA_FILE = 'data/tasks.json'

def ensure_data_file():
    """Ensure the data directory and file exist."""
    os.makedirs('data', exist_ok=True)
    if not os.path.exists(DATA_FILE):
        default_data = {
            'tasks': [],
            'columns': ['todo', 'doing', 'done']
        }
        save_data(default_data)
    return load_data()

def load_data():
    """Load tasks from JSON file."""
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {'tasks': [], 'columns': ['todo', 'doing', 'done']}

def save_data(data):
    """Save tasks to JSON file."""
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

@app.route('/')
def index():
    """Render the main Kanban board."""
    return render_template('index.html')

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """Get all tasks."""
    data = ensure_data_file()
    return jsonify(data)

@app.route('/api/tasks', methods=['POST'])
def create_task():
    """Create a new task."""
    data = load_data()
    task_data = request.json

    new_task = {
        'id': str(uuid.uuid4()),
        'title': task_data.get('title', 'New Task'),
        'description': task_data.get('description', ''),
        'column': task_data.get('column', 'todo'),
        'priority': task_data.get('priority', 'medium'),
        'created_at': datetime.now().isoformat(),
        'updated_at': datetime.now().isoformat()
    }

    data['tasks'].append(new_task)
    save_data(data)
    return jsonify(new_task), 201

@app.route('/api/tasks/<task_id>', methods=['PUT'])
def update_task(task_id):
    """Update an existing task."""
    data = load_data()
    task_data = request.json

    for task in data['tasks']:
        if task['id'] == task_id:
            task['title'] = task_data.get('title', task['title'])
            task['description'] = task_data.get('description', task['description'])
            task['column'] = task_data.get('column', task['column'])
            task['priority'] = task_data.get('priority', task['priority'])
            task['updated_at'] = datetime.now().isoformat()
            save_data(data)
            return jsonify(task)

    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a task."""
    data = load_data()
    original_length = len(data['tasks'])
    data['tasks'] = [t for t in data['tasks'] if t['id'] != task_id]

    if len(data['tasks']) < original_length:
        save_data(data)
        return jsonify({'message': 'Task deleted'}), 200

    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks/<task_id>/move', methods=['PUT'])
def move_task(task_id):
    """Move a task to a different column."""
    data = load_data()
    new_column = request.json.get('column')

    for task in data['tasks']:
        if task['id'] == task_id:
            task['column'] = new_column
            task['updated_at'] = datetime.now().isoformat()
            save_data(data)
            return jsonify(task)

    return jsonify({'error': 'Task not found'}), 404

if __name__ == '__main__':
    ensure_data_file()
    app.run(debug=True, port=5000)
