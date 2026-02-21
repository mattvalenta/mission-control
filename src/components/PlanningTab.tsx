'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle, Circle, ArrowRight, User, Bot, Loader2, X, AlertCircle } from 'lucide-react';

interface PlanningOption {
  id: string;
  label: string;
}

interface BatchQuestion {
  id: string;
  question: string;
  options: PlanningOption[];
}

interface BatchAnswer {
  questionId: string;
  answer: string;
}

interface PlanningTabProps {
  taskId: string;
  onSpecLocked?: () => void;
}

export function PlanningTab({ taskId, onSpecLocked }: PlanningTabProps) {
  // Batch mode state
  const [questions, setQuestions] = useState<BatchQuestion[]>([]);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [otherText, setOtherText] = useState('');
  const [planningStage, setPlanningStage] = useState<string>('user_planning');

  // SSE ref for cleanup
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load batch state
  const loadBatchState = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/planning/questions/batch`);
      if (res.ok) {
        const data = await res.json();
        
        if (data.questions) {
          setQuestions(data.questions);
          // Restore answers
          const answerMap = new Map<string, string>();
          for (const a of data.answers || []) {
            answerMap.set(a.questionId, a.answer);
          }
          setAnswers(answerMap);
          setIsComplete(data.isComplete);
          setPlanningStage(data.planningStage || 'user_planning');
          // Set current index to first unanswered question
          const firstUnanswered = data.questions.findIndex(
            (q: BatchQuestion) => !answerMap.has(q.id)
          );
          setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : data.questions.length - 1);
        }
      }
    } catch (err) {
      console.error('Failed to load batch state:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // Start batch planning
  const startBatchPlanning = async () => {
    setStarting(true);
    setError(null);

    try {
      const res = await fetch(`/api/tasks/${taskId}/planning/questions/batch`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        if (data.status === 'generating') {
          // Questions being generated, start polling
          setLoading(true);
          setStarting(false);
        } else {
          setQuestions(data.questions || []);
          setCurrentIndex(0);
          setAnswers(new Map());
          setStarting(false);
        }
      } else {
        setError(data.error || 'Failed to start planning');
        setStarting(false);
      }
    } catch (err) {
      setError('Failed to start planning');
      setStarting(false);
    }
  };

  // Poll for questions when generating
  useEffect(() => {
    if (!loading && !starting) return;
    if (questions.length > 0) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}/planning/questions/batch`);
        const data = await res.json();

        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          setCurrentIndex(0);
          setAnswers(new Map());
          setLoading(false);
          clearInterval(pollInterval);
        } else if (data.isComplete) {
          setIsComplete(true);
          setLoading(false);
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [loading, starting, questions.length, taskId]);

  // Handle answer selection - moves to next question instantly
  const handleAnswer = (optionLabel: string, isOther: boolean) => {
    if (!questions[currentIndex]) return;

    const questionId = questions[currentIndex].id;
    const answer = isOther ? otherText : optionLabel;

    // Store answer locally
    setAnswers(prev => {
      const newMap = new Map(prev);
      newMap.set(questionId, answer);
      return newMap;
    });

    // Clear selection for next question
    setSelectedOption(null);
    setOtherText('');

    // Move to next question instantly
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  // Submit all answers at once
  const submitAllAnswers = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const answersArray = Array.from(answers.entries()).map(([questionId, answer]) => ({
        questionId,
        answer,
      }));

      const res = await fetch(`/api/tasks/${taskId}/planning/questions/batch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArray }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsComplete(true);
        if (onSpecLocked) {
          onSpecLocked();
        }
      } else {
        setError(data.error || 'Failed to submit answers');
      }
    } catch (err) {
      setError('Failed to submit answers');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel planning
  const cancelPlanning = async () => {
    if (!confirm('Are you sure you want to cancel planning?')) return;

    try {
      await fetch(`/api/tasks/${taskId}/planning`, { method: 'DELETE' });
      setQuestions([]);
      setAnswers(new Map());
      setCurrentIndex(0);
      setIsComplete(false);
    } catch (err) {
      setError('Failed to cancel planning');
    }
  };

  // Initial load
  useEffect(() => {
    loadBatchState();
  }, [loadBatchState]);

  // SSE for real-time updates (optimization complete, etc.)
  useEffect(() => {
    eventSourceRef.current = new EventSource('/api/events/stream');
    
    eventSourceRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'task_updated' && data.payload?.id === taskId) {
          loadBatchState();
        }
      } catch {
        // Ignore non-JSON messages
      }
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [taskId, loadBatchState]);

  // Stage indicator
  const StageIndicator = () => (
    <div className="flex items-center gap-2 mb-4 p-3 bg-mc-bg-secondary rounded-lg">
      <div className={`flex items-center gap-2 ${planningStage === 'user_planning' ? 'text-mc-accent' : 'text-mc-text-secondary'}`}>
        <User className="w-4 h-4" />
        <span className="text-sm font-medium">User Planning</span>
        {planningStage === 'user_planning' && <Circle className="w-2 h-2 fill-mc-accent" />}
      </div>
      <ArrowRight className="w-4 h-4 text-mc-text-secondary" />
      <div className={`flex items-center gap-2 ${planningStage === 'agent_planning' ? 'text-mc-accent' : 'text-mc-text-secondary'}`}>
        <Bot className="w-4 h-4" />
        <span className="text-sm font-medium">Agent Planning</span>
        {planningStage === 'agent_planning' && <Circle className="w-2 h-2 fill-mc-accent" />}
      </div>
      <ArrowRight className="w-4 h-4 text-mc-text-secondary" />
      <div className={`flex items-center gap-2 ${planningStage === 'complete' ? 'text-green-400' : 'text-mc-text-secondary'}`}>
        <CheckCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Ready</span>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-mc-accent" />
        <span className="ml-2 text-mc-text-secondary">Loading...</span>
      </div>
    );
  }

  // Planning complete - show transition UI
  if (isComplete && planningStage === 'user_planning') {
    return (
      <div className="p-4 space-y-6">
        <StageIndicator />
        
        <div className="bg-mc-bg-secondary border border-mc-accent/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-mc-accent" />
            <span className="font-medium">Questions Complete</span>
          </div>
          <p className="text-sm text-mc-text-secondary mb-4">
            Skippy is now optimizing your task and will assign it to the right manager.
          </p>
          <div className="flex items-center gap-2 text-sm text-mc-text-secondary">
            <Loader2 className="w-4 h-4 animate-spin text-mc-accent" />
            <span>Processing answers...</span>
          </div>
        </div>
      </div>
    );
  }

  // Agent planning - waiting for agent to generate questions or Skippy to answer
  if (planningStage === 'agent_planning') {
    return (
      <div className="p-4 space-y-6">
        <StageIndicator />
        
        <div className="bg-mc-bg-secondary border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-5 h-5 text-blue-400" />
            <span className="font-medium">Agent Planning Phase</span>
          </div>
          
          {questions.length === 0 ? (
            <>
              <p className="text-sm text-mc-text-secondary mb-4">
                The assigned agent is generating follow-up questions. Skippy will answer them automatically.
              </p>
              <div className="flex items-center gap-2 text-sm text-mc-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span>Waiting for agent questions...</span>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-mc-text-secondary mb-4">
                Agent has generated {questions.length} questions. Skippy is answering them...
              </p>
              <div className="flex items-center gap-2 text-sm text-mc-text-secondary">
                <Loader2 className="w-4 h-4 animate-spin text-mc-accent" />
                <span>Skippy answering questions...</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Not started - show start button or generating message
  if (questions.length === 0) {
    return (
      <div className="p-4">
        <StageIndicator />
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">User Planning</h3>
            <p className="text-mc-text-secondary text-sm max-w-md">
              Answer a few quick questions to help me understand exactly what you need.
              Questions are simple and you can fly through them.
            </p>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          {starting || loading ? (
            <div className="flex items-center gap-2 text-mc-accent">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Generating questions for your task...</span>
            </div>
          ) : (
            <button
              onClick={startBatchPlanning}
              disabled={starting}
              className="px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90 disabled:opacity-50 flex items-center gap-2"
            >
              <>📋 Start Planning</>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Current question
  const currentQuestion = questions[currentIndex];
  const answeredCount = answers.size;
  const totalQuestions = questions.length;
  const allAnswered = answeredCount === totalQuestions;

  return (
    <div className="flex flex-col h-full">
      {/* Stage indicator */}
      <div className="p-4 border-b border-mc-border">
        <StageIndicator />
      </div>

      {/* Progress bar */}
      <div className="p-4 border-b border-mc-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-mc-text-secondary">
            Question {currentIndex + 1} of {totalQuestions}
          </span>
          <button
            onClick={cancelPlanning}
            className="text-xs text-mc-accent-red hover:underline"
          >
            Cancel
          </button>
        </div>
        <div className="w-full bg-mc-bg-tertiary rounded-full h-2">
          <div
            className="bg-mc-accent h-2 rounded-full transition-all duration-300"
            style={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
          />
        </div>
      </div>

      {/* Question area */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl mx-auto">
          <h3 className="text-lg font-medium mb-6">
            {currentQuestion.question}
          </h3>

          <div className="space-y-3">
            {currentQuestion.options.map((option) => {
              const isSelected = selectedOption === option.label;
              const isOther = option.id === 'other' || option.label.toLowerCase() === 'other';

              return (
                <div key={option.id}>
                  <button
                    onClick={() => {
                      setSelectedOption(option.label);
                      if (!isOther) {
                        // Instant transition for non-Other options
                        handleAnswer(option.label, false);
                      }
                    }}
                    className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'border-mc-accent bg-mc-accent/10'
                        : 'border-mc-border hover:border-mc-accent/50'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold ${
                      isSelected ? 'bg-mc-accent text-mc-bg' : 'bg-mc-bg-tertiary'
                    }`}>
                      {option.id.toUpperCase()}
                    </span>
                    <span className="flex-1">{option.label}</span>
                    {isSelected && <CheckCircle className="w-5 h-5 text-mc-accent" />}
                  </button>

                  {/* Other text input */}
                  {isOther && isSelected && (
                    <div className="mt-2 ml-11 flex gap-2">
                      <input
                        type="text"
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        placeholder="Please specify..."
                        className="flex-1 bg-mc-bg border border-mc-border rounded px-3 py-2 text-sm focus:outline-none focus:border-mc-accent"
                        autoFocus
                      />
                      <button
                        onClick={() => handleAnswer(otherText, true)}
                        disabled={!otherText.trim()}
                        className="px-4 py-2 bg-mc-accent text-mc-bg rounded text-sm font-medium hover:bg-mc-accent/90 disabled:opacity-50"
                      >
                        OK
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Navigation buttons */}
          <div className="mt-6 flex gap-3">
            {currentIndex > 0 && (
              <button
                onClick={() => setCurrentIndex(prev => prev - 1)}
                className="px-4 py-2 border border-mc-border rounded-lg text-sm hover:bg-mc-bg-tertiary"
              >
                ← Back
              </button>
            )}
            
            <div className="flex-1" />
            
            {allAnswered ? (
              <button
                onClick={submitAllAnswers}
                disabled={submitting}
                className="px-6 py-3 bg-mc-accent text-mc-bg rounded-lg font-medium hover:bg-mc-accent/90 disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Submit All Answers
                  </>
                )}
              </button>
            ) : (
              currentIndex < totalQuestions - 1 && !selectedOption && (
                <button
                  onClick={() => setCurrentIndex(prev => prev + 1)}
                  className="px-4 py-2 border border-mc-border rounded-lg text-sm hover:bg-mc-bg-tertiary"
                >
                  Skip →
                </button>
              )
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary of answered questions */}
      {answeredCount > 0 && (
        <div className="border-t border-mc-border p-3 bg-mc-bg-secondary">
          <details>
            <summary className="text-sm text-mc-text-secondary cursor-pointer">
              View your answers ({answeredCount}/{totalQuestions})
            </summary>
            <div className="mt-2 space-y-1">
              {questions.map((q, i) => {
                const answer = answers.get(q.id);
                return (
                  <div key={q.id} className="text-xs flex gap-2">
                    <span className="text-mc-text-secondary">Q{i + 1}:</span>
                    <span className="text-mc-accent">{answer || 'Not answered'}</span>
                  </div>
                );
              })}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
