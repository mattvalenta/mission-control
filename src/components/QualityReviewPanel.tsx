'use client';

import { useState, useEffect } from 'react';

interface Review {
  id: string;
  task_id: string;
  reviewer_id: string | null;
  reviewer_name: string | null;
  reviewer_emoji: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface QualityReviewPanelProps {
  taskId: string;
  taskStatus: string;
  currentAgentId?: string;
  onReviewComplete?: () => void;
}

export function QualityReviewPanel({ 
  taskId, 
  taskStatus, 
  currentAgentId,
  onReviewComplete 
}: QualityReviewPanelProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected' | 'changes_requested'>('approved');
  const [notes, setNotes] = useState('');

  const canReview = ['review', 'quality_review'].includes(taskStatus);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}/reviews`);
      if (!response.ok) throw new Error('Failed to fetch reviews');
      
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [taskId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: reviewStatus,
          notes: notes || null,
          reviewer_id: currentAgentId || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit review');
      }

      // Reset form
      setNotes('');
      setReviewStatus('approved');

      // Refresh reviews
      await fetchReviews();

      // Notify parent
      if (onReviewComplete) {
        onReviewComplete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      approved: 'bg-green-100 text-green-800 border-green-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      changes_requested: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      pending: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    const labels: Record<string, string> = {
      approved: '✓ Approved',
      rejected: '✗ Rejected',
      changes_requested: '⟳ Changes Requested',
      pending: '⏳ Pending',
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Quality Reviews</h3>

      {/* Review History */}
      {reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="bg-gray-50 border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {review.reviewer_emoji && <span className="text-lg">{review.reviewer_emoji}</span>}
                  <span className="font-medium">{review.reviewer_name || 'Unknown Reviewer'}</span>
                </div>
                {getStatusBadge(review.status)}
              </div>
              {review.notes && (
                <p className="text-sm text-gray-600 mt-2">{review.notes}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {review.reviewed_at 
                  ? new Date(review.reviewed_at).toLocaleString()
                  : 'Pending review'
                }
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm">No reviews yet.</p>
      )}

      {/* Submit Review Form */}
      {canReview && (
        <form onSubmit={handleSubmitReview} className="bg-white border rounded-lg p-4 mt-4">
          <h4 className="font-medium mb-3">Submit Review</h4>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-3 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Decision</label>
              <select
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value as any)}
                className="w-full border rounded px-3 py-2"
                disabled={submitting}
              >
                <option value="approved">Approve</option>
                <option value="changes_requested">Request Changes</option>
                <option value="rejected">Reject</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border rounded px-3 py-2"
                rows={3}
                placeholder="Add review notes..."
                disabled={submitting}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      )}

      {/* Task not in reviewable state */}
      {!canReview && (
        <p className="text-sm text-gray-500 italic">
          Task must be in "review" or "quality_review" state to submit a review.
          Current status: {taskStatus}
        </p>
      )}
    </div>
  );
}

export default QualityReviewPanel;
