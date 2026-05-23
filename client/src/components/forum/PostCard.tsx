import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUp, MessageSquare, ArrowDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ForumPost, forumApi } from "@/api/forumApi";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface PostCardProps {
  post: ForumPost;
  onVoteChange?: () => void;
}

export function PostCard({ post, onVoteChange }: PostCardProps) {
  const { user } = useAuth();
  
  const handleVote = async (e: React.MouseEvent, voteType: 'up' | 'down') => {
    e.preventDefault(); // prevent navigation
    e.stopPropagation();
    if (!user) {
      toast.error("Please login to vote");
      return;
    }
    try {
      await forumApi.votePost(post._id, voteType);
      if (onVoteChange) onVoteChange();
    } catch (error) {
      toast.error("Failed to register vote");
    }
  };

  const isUpvoted = post.viewerVote === 'up';
  const isDownvoted = post.viewerVote === 'down';

  return (
    <Link
      to={`/forum/$id`}
      params={{ id: post._id }}
      className="group block rounded-3xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:-translate-y-0.5 cursor-pointer relative overflow-hidden"
    >
      {post.isPinned && (
        <div className="absolute top-0 right-0 rounded-bl-xl bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
          Pinned
        </div>
      )}
      
      <div className="flex gap-4">
        {/* Voting Sidebar (Desktop-ish) */}
        <div className="hidden sm:flex flex-col items-center gap-1 shrink-0 bg-surface/30 p-2 rounded-2xl self-start">
          <button 
            onClick={(e) => handleVote(e, 'up')}
            className={`p-1.5 rounded-full hover:bg-surface transition-colors ${isUpvoted ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <span className={`text-sm font-bold ${isUpvoted ? 'text-primary' : isDownvoted ? 'text-destructive' : 'text-foreground'}`}>
            {post.score}
          </span>
          <button 
            onClick={(e) => handleVote(e, 'down')}
            className={`p-1.5 rounded-full hover:bg-surface transition-colors ${isDownvoted ? 'text-destructive bg-destructive/10' : 'text-muted-foreground'}`}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[10px] font-bold text-primary-foreground">
              {post.userId.name.charAt(0).toUpperCase()}
            </div>
            <span className="font-semibold text-foreground">{post.userId.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground" title={new Date(post.createdAt).toLocaleString()}>
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </span>
          </div>
          
          <h3 className="mt-2 font-display text-lg font-bold group-hover:text-primary transition-colors line-clamp-2">
            {post.title}
          </h3>
          
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {post.body}
          </p>
          
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-muted-foreground">
            {/* Mobile voting */}
            <div className="flex sm:hidden items-center gap-1 bg-surface/50 rounded-full px-2 py-0.5 border border-border/50">
              <button onClick={(e) => handleVote(e, 'up')} className={`p-1 ${isUpvoted ? 'text-primary' : ''}`}><ArrowUp className="h-3.5 w-3.5" /></button>
              <span className={`font-semibold ${isUpvoted ? 'text-primary' : isDownvoted ? 'text-destructive' : ''}`}>{post.score}</span>
              <button onClick={(e) => handleVote(e, 'down')} className={`p-1 ${isDownvoted ? 'text-destructive' : ''}`}><ArrowDown className="h-3.5 w-3.5" /></button>
            </div>
            
            <span className="inline-flex items-center gap-1.5 font-medium">
              <MessageSquare className="h-3.5 w-3.5" /> {post.commentCount} {post.commentCount === 1 ? 'reply' : 'replies'}
            </span>
            
            {post.productId && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-2 py-1 font-medium text-foreground">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Product Tagged
              </span>
            )}

            {post.tags?.length > 0 && (
              <div className="flex gap-2">
                {post.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full bg-primary/5 border border-primary/10 px-2 py-0.5 font-medium lowercase text-primary">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
