'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Linkedin, 
  Twitter, 
  Check, 
  X, 
  Edit2, 
  Save, 
  Calendar,
  Filter,
  RefreshCw,
  ExternalLink,
  Clock,
  Send
} from 'lucide-react';

interface SocialPost {
  id: number;
  week_start_date: string;
  platform: 'linkedin' | 'x';
  account: 'paramount' | 'trafficdriver' | 'matt_valenta';
  scheduled_date: string;
  content_category: string;
  content: string;
  approved: boolean;
  sent: boolean;
  created_at: string;
  approved_at?: string;
  sent_at?: string;
  post_url?: string;
  notes?: string;
  group_id?: number;
  group_theme?: string;
  paired_post_id?: number;
}

const platformIcons = {
  linkedin: Linkedin,
  x: Twitter,
};

const platformColors = {
  linkedin: 'bg-blue-600',
  x: 'bg-slate-800',
};

const accountColors = {
  paramount: 'text-amber-400',
  trafficdriver: 'text-blue-400',
  matt_valenta: 'text-purple-400',
};

export default function SocialMediaPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [weeks, setWeeks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedApproved, setSelectedApproved] = useState<string>('all');
  const [editingPost, setEditingPost] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchWeeks();
    fetchPosts();
  }, [selectedWeek, selectedPlatform, selectedAccount, selectedApproved]);

  const fetchWeeks = async () => {
    try {
      const res = await fetch('/api/social/weeks');
      const data = await res.json();
      if (data.success) {
        setWeeks(data.weeks);
      }
    } catch (error) {
      console.error('Failed to fetch weeks:', error);
    }
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedWeek !== 'all') params.append('week', selectedWeek);
      if (selectedPlatform !== 'all') params.append('platform', selectedPlatform);
      if (selectedAccount !== 'all') params.append('account', selectedAccount);
      if (selectedApproved !== 'all') params.append('approved', selectedApproved);

      const res = await fetch(`/api/social?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPosts(data.posts);
      }
    } catch (error) {
      console.error('Failed to fetch posts:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedWeek, selectedPlatform, selectedAccount, selectedApproved]);

  const approvePost = async (id: number) => {
    try {
      const res = await fetch(`/api/social/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true }),
      });
      if (res.ok) {
        fetchPosts();
      }
    } catch (error) {
      console.error('Failed to approve post:', error);
    }
  };

  const markSent = async (id: number) => {
    try {
      const res = await fetch(`/api/social/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sent: true }),
      });
      if (res.ok) {
        fetchPosts();
      }
    } catch (error) {
      console.error('Failed to mark sent:', error);
    }
  };

  const saveEdit = async (id: number) => {
    try {
      const res = await fetch(`/api/social/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        setEditingPost(null);
        fetchPosts();
      }
    } catch (error) {
      console.error('Failed to save edit:', error);
    }
  };

  const startEdit = (post: SocialPost) => {
    setEditingPost(post.id);
    setEditContent(post.content);
  };

  const cancelEdit = () => {
    setEditingPost(null);
    setEditContent('');
  };

  // Group posts by scheduled date
  const postsByDate = posts.reduce((acc, post) => {
    const date = post.scheduled_date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(post);
    return acc;
  }, {} as Record<string, SocialPost[]>);

  const stats = {
    total: posts.length,
    approved: posts.filter(p => p.approved).length,
    sent: posts.filter(p => p.sent).length,
    pending: posts.filter(p => !p.approved).length,
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-2">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-white">Social Media Content</h2>
          <div className="flex gap-2 text-xs">
            <span className="px-2 py-1 bg-slate-700 rounded text-slate-300">
              {stats.total} total
            </span>
            <span className="px-2 py-1 bg-green-900/50 rounded text-green-400">
              {stats.approved} approved
            </span>
            <span className="px-2 py-1 bg-blue-900/50 rounded text-blue-400">
              {stats.sent} sent
            </span>
            <span className="px-2 py-1 bg-amber-900/50 rounded text-amber-400">
              {stats.pending} pending
            </span>
          </div>
        </div>
        <button
          onClick={fetchPosts}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 px-2">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Week</label>
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 text-sm"
          >
            <option value="all">All Weeks</option>
            {weeks.map((week) => (
              <option key={week} value={week}>{week}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Platform</label>
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 text-sm"
          >
            <option value="all">All Platforms</option>
            <option value="linkedin">LinkedIn</option>
            <option value="x">X (Twitter)</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Account</label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 text-sm"
          >
            <option value="all">All Accounts</option>
            <option value="paramount">Paramount</option>
            <option value="trafficdriver">TrafficDriver</option>
            <option value="matt_valenta">Matt Valenta</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Status</label>
          <select
            value={selectedApproved}
            onChange={(e) => setSelectedApproved(e.target.value)}
            className="bg-slate-700 text-white rounded px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="false">Pending Approval</option>
            <option value="true">Approved</option>
          </select>
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="text-center text-slate-400 py-8">Loading posts...</div>
        ) : Object.keys(postsByDate).length === 0 ? (
          <div className="text-center text-slate-400 py-8">No posts found</div>
        ) : (
          Object.entries(postsByDate).map(([date, datePosts]) => (
            <div key={date} className="mb-6">
              <h3 className="text-sm font-medium text-slate-400 mb-3 px-2 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(date).toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {datePosts.map((post) => {
                  const PlatformIcon = platformIcons[post.platform];
                  const isEditing = editingPost === post.id;

                  return (
                    <div
                      key={post.id}
                      className={`bg-slate-800 rounded-lg border-2 overflow-hidden ${
                        post.sent 
                          ? 'border-blue-600/50 opacity-60' 
                          : post.approved 
                            ? 'border-green-600/50' 
                            : 'border-amber-600/50'
                      }`}
                    >
                      {/* Header */}
                      <div className="p-3 bg-slate-700/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded ${platformColors[post.platform]}`}>
                            <PlatformIcon className="w-4 h-4 text-white" />
                          </span>
                          <span className={`text-sm font-medium ${accountColors[post.account]}`}>
                            {post.account.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {post.sent ? (
                            <span className="text-xs text-blue-400 flex items-center gap-1">
                              <Send className="w-3 h-3" /> Sent
                            </span>
                          ) : post.approved ? (
                            <span className="text-xs text-green-400 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Approved
                            </span>
                          ) : (
                            <span className="text-xs text-amber-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content */}
                      <div className="p-4">
                        <p className="text-xs text-slate-400 mb-2">{post.content_category}</p>
                        {isEditing ? (
                          <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full bg-slate-700 text-white rounded p-2 text-sm min-h-[120px] resize-none"
                          />
                        ) : (
                          <p className="text-sm text-slate-200 whitespace-pre-wrap line-clamp-6">
                            {post.content}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="p-3 bg-slate-700/30 flex items-center justify-between">
                        {isEditing ? (
                          <>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1.5 bg-slate-600 text-white rounded text-sm hover:bg-slate-500"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(post.id)}
                              className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-500 flex items-center gap-1"
                            >
                              <Save className="w-3 h-3" /> Save
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEdit(post)}
                                className="p-1.5 text-slate-400 hover:text-white transition-colors"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              {post.post_url && (
                                <a
                                  href={post.post_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-slate-400 hover:text-white transition-colors"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {!post.approved && !post.sent && (
                                <button
                                  onClick={() => approvePost(post.id)}
                                  className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-500 flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" /> Approve
                                </button>
                              )}
                              {post.approved && !post.sent && (
                                <button
                                  onClick={() => markSent(post.id)}
                                  className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" /> Mark Sent
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
