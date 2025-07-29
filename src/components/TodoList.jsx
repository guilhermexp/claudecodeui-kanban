import React from 'react';
import { Badge } from './ui/badge';
import { CheckCircle2, Clock, Circle } from 'lucide-react';

const TodoList = ({ todos, isResult = false }) => {
  if (!todos || !Array.isArray(todos)) {
    return null;
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'pending':
      default:
        return <Circle className="w-4 h-4 text-gray-400 dark:text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700/50';
      case 'in_progress':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/50';
      case 'pending':
      default:
        return 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600/50';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/50';
      case 'medium':
        return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/50';
      case 'low':
      default:
        return 'bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600/50';
    }
  };

  return (
    <div className="space-y-1">
      {isResult && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5 px-1">
          Todo List ({todos.length} {todos.length === 1 ? 'item' : 'items'})
        </div>
      )}
      
      {todos.map((todo) => (
        <div
          key={todo.id}
          className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 rounded-lg shadow-sm hover:shadow-md dark:shadow-black/20 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-all duration-200"
        >
          <div className="flex-shrink-0 mt-0.5">
            {getStatusIcon(todo.status)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-medium ${todo.status === 'completed' ? 'line-through text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-gray-200'}`}>
                {todo.content}
              </p>
              
              <div className="flex gap-1 flex-shrink-0">
                <Badge
                  variant="outline"
                  className={`text-xs px-1.5 py-0.5 font-medium rounded-md ${getPriorityColor(todo.priority)}`}
                >
                  {todo.priority}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-xs px-1.5 py-0.5 font-medium rounded-md ${getStatusColor(todo.status)}`}
                >
                  {todo.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TodoList;