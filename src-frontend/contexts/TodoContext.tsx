import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SessionTodoData } from '@/lib/api';
import { logger } from '@/lib/logger';
import { listen } from '@tauri-apps/api/event';

interface TodoContextValue {
  /** Map of session_id -> todo data */
  todosBySession: Map<string, SessionTodoData>;
  /** Get todo data for a specific session */
  getTodoData: (sessionId: string) => SessionTodoData | null;
  /** Load fresh todo data for a specific session */
  loadSessionTodos: (sessionId: string) => Promise<void>;
  /** Check if a session has any todos */
  hasTodos: (sessionId: string) => boolean;
  /** Check if a session has active (open) todos */
  hasActiveTodos: (sessionId: string) => boolean;
  /** Check if a session has in-progress todos */
  hasInProgressTodos: (sessionId: string) => boolean;
  /** Set todo data for a session */
  setSessionTodos: (sessionId: string, data: SessionTodoData) => void;
  /** Remove todo data for a session */
  removeSessionTodos: (sessionId: string) => void;
}

const TodoContext = createContext<TodoContextValue | null>(null);

interface TodoProviderProps {
  children: ReactNode;
}

/**
 * Provider for global todo state management with real-time event handling
 */
export const TodoProvider: React.FC<TodoProviderProps> = ({ children }) => {
  const [todosBySession, setTodosBySession] = useState<Map<string, SessionTodoData>>(new Map());


  // Set up event listener for todo changes
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      try {
        unlisten = await listen<any>('todo-changed', (event) => {
          const eventData = event.payload;

          // Handle todo-specific events
          if (eventData.type === 'TodoCreated' || eventData.type === 'TodoModified') {
            const { session_id, agent_id, todo_counts } = eventData.data;
            
            // Trigger fresh load to get complete todo data instead of just updating counts
            loadSessionTodos(session_id);
            return; // Skip the count-only update below
            
            // Update local todo state
            setTodosBySession(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(session_id);
              
              if (existing) {
                // Update existing session todo data
                const updatedAgentTodos = existing.agent_todos.map(agent => 
                  agent.agent_id === agent_id 
                    ? { ...agent, counts: todo_counts }
                    : agent
                );
                
                // If agent not found, this is a new agent for this session
                if (!updatedAgentTodos.find(a => a.agent_id === agent_id)) {
                  updatedAgentTodos.push({
                    agent_id,
                    file_path: eventData.data.file_path,
                    todos: [], // We'll fetch full todos on demand
                    counts: todo_counts
                  });
                }
                
                // Recalculate total counts
                const total_counts = updatedAgentTodos.reduce(
                  (acc, agent) => ({
                    open: acc.open + agent.counts.open,
                    completed: acc.completed + agent.counts.completed,
                    total: acc.total + agent.counts.total
                  }),
                  { open: 0, completed: 0, total: 0 }
                );
                
                const updated: SessionTodoData = {
                  ...existing,
                  agent_todos: updatedAgentTodos,
                  total_counts,
                  agent_count: updatedAgentTodos.length
                };
                
                newMap.set(session_id, updated);
              } else {
                // Create new session todo data
                const newSessionData: SessionTodoData = {
                  session_id,
                  agent_todos: [{
                    agent_id,
                    file_path: eventData.data.file_path,
                    todos: [], // We'll fetch full todos on demand
                    counts: todo_counts
                  }],
                  total_counts: todo_counts,
                  agent_count: 1
                };
                
                newMap.set(session_id, newSessionData);
              }
              
              return newMap;
            });
          } else if (eventData.type === 'TodoRemoved') {
            const { session_id, agent_id } = eventData.data;
            
            
            setTodosBySession(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(session_id);
              
              if (existing) {
                const updatedAgentTodos = existing.agent_todos.filter(
                  agent => agent.agent_id !== agent_id
                );
                
                if (updatedAgentTodos.length === 0) {
                  // Remove session entirely if no more agents have todos
                  newMap.delete(session_id);
                } else {
                  // Update session with remaining agents
                  const total_counts = updatedAgentTodos.reduce(
                    (acc, agent) => ({
                      open: acc.open + agent.counts.open,
                      completed: acc.completed + agent.counts.completed,
                      total: acc.total + agent.counts.total
                    }),
                    { open: 0, completed: 0, total: 0 }
                  );
                  
                  const updated: SessionTodoData = {
                    ...existing,
                    agent_todos: updatedAgentTodos,
                    total_counts,
                    agent_count: updatedAgentTodos.length
                  };
                  
                  newMap.set(session_id, updated);
                }
              }
              
              return newMap;
            });
          }
        });
        
        
        // Also start the todo watcher on the backend
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('start_todo_watching');
          
          // Check watcher status to verify it's running
          await invoke('get_todo_watching_status');
        } catch (error) {
          logger.error('❌ Failed to start todo watcher:', error);
        }
      } catch (error) {
        logger.error('❌ Failed to set up todo event listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const getTodoData = (sessionId: string): SessionTodoData | null => {
    const data = todosBySession.get(sessionId) || null;
    if (data) {
    }
    return data;
  };

  const hasTodos = (sessionId: string): boolean => {
    const data = todosBySession.get(sessionId);
    return (data?.total_counts.total ?? 0) > 0;
  };

  const hasActiveTodos = (sessionId: string): boolean => {
    const data = todosBySession.get(sessionId);
    return (data?.total_counts.open ?? 0) > 0;
  };

  const hasInProgressTodos = (sessionId: string): boolean => {
    const data = todosBySession.get(sessionId);
    return data?.agent_todos.some(agent => 
      agent.todos.some(todo => todo.status === 'in_progress')
    ) ?? false;
  };

  const setSessionTodos = (sessionId: string, data: SessionTodoData) => {
    setTodosBySession(prev => new Map(prev).set(sessionId, data));
  };

  const removeSessionTodos = (sessionId: string) => {
    setTodosBySession(prev => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });
  };

  const loadSessionTodos = async (sessionId: string): Promise<void> => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const todoData = await invoke<SessionTodoData>('get_session_todos', { sessionId });
      
      setSessionTodos(sessionId, todoData);
    } catch (error) {
      logger.error(`❌ Failed to load todos for session ${sessionId}:`, error);
    }
  };

  const value: TodoContextValue = {
    todosBySession,
    getTodoData,
    loadSessionTodos,
    hasTodos,
    hasActiveTodos,
    hasInProgressTodos,
    setSessionTodos,
    removeSessionTodos,
  };

  return (
    <TodoContext.Provider value={value}>
      {children}
    </TodoContext.Provider>
  );
};

/**
 * Hook to access todo context
 */
export const useTodoContext = (): TodoContextValue => {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error('useTodoContext must be used within a TodoProvider');
  }
  return context;
};