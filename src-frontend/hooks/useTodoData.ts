import { useState, useEffect, useCallback } from 'react';
import { SessionTodoData } from '@/lib/api';
import { api } from '@/lib/api';
import { logger } from '@/lib/logger';

/**
 * Custom hook for fetching and managing session todo data with real-time updates
 */
export function useTodoData(sessionId: string | null) {
  const [todoData, setTodoData] = useState<SessionTodoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch todo data from API
  const fetchTodoData = useCallback(async (id: string) => {
    if (!id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      logger.debug('Fetching todo data for session:', id);
      const data = await api.getSessionTodos(id);
      setTodoData(data);
      logger.debug('Todo data fetched successfully:', data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch todo data';
      logger.error('Failed to fetch todo data:', err);
      setError(errorMessage);
      setTodoData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh todo data
  const refreshTodos = useCallback(() => {
    if (sessionId) {
      fetchTodoData(sessionId);
    }
  }, [sessionId, fetchTodoData]);

  // Initial fetch when session ID changes
  useEffect(() => {
    if (sessionId) {
      fetchTodoData(sessionId);
    } else {
      setTodoData(null);
      setLoading(false);
      setError(null);
    }
  }, [sessionId, fetchTodoData]);

  // TODO: Add real-time event subscription here when event system is ready
  // useEffect(() => {
  //   if (!sessionId) return;
  //   
  //   // Subscribe to todo events for this session
  //   const unsubscribe = subscribeTodoEvents(sessionId, (event) => {
  //     handleTodoEvent(event, setTodoData);
  //   });
  //
  //   return unsubscribe;
  // }, [sessionId]);

  // Helper to check if session has any todos
  const hasTodos = todoData?.total_counts.total ?? 0 > 0;
  
  // Helper to check if session has active (open) todos
  const hasActiveTodos = todoData?.total_counts.open ?? 0 > 0;
  
  // Helper to check if session has in-progress todos
  const hasInProgressTodos = todoData?.agent_todos.some(agent => 
    agent.todos.some(todo => todo.status === 'in_progress')
  ) ?? false;

  return {
    data: todoData,
    loading,
    error,
    hasTodos,
    hasActiveTodos,
    hasInProgressTodos,
    refreshTodos,
  };
}