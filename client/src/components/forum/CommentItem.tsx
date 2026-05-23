import React, { useState } from "react";
import { ForumComment, forumApi } from "@/api/forumApi";
import { formatDistanceToNow } from "date-fns";
import { ArrowUp, ArrowDown, MessageSquare, MoreHorizontal, Trash } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentItemProps {
  comment: ForumComment;
  onVoteChange?: () => void;
  onReply?: (parentId: string, text: string) => Promise<void>;
  onDelete?: (commentId: string) => Promise<void>;
}

export function CommentItem({ comment, onVoteChange, onReply, onDelete }: CommentItemProps) {
  const { user } = useAuth();
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(false);

  const isUpvoted = comment.viewerVote === 'up';
  const isDownvoted = comment.viewerVote === 'down';
  const isOwner = user?._id === comment.userId._id;

  const handleVote = async (voteType: 'up' | 'down') => {
    if (!user) {
      toast.error("Please login to vote");
      return;
    }
    try {
      await forumApi.voteComment(comment.postId, comment._id, voteType);
      if (onVoteChange) onVoteChange();
    } catch (error) {
      toast.error("Failed to register vote");
    }
  };

  const submitReply = async () => {
    if (!replyText.trim()) return;
    try {
      setLoading(true);
      if (onReply) {
        await onReply(comment._id, replyText);
      }
      setIsReplying(false);
      setReplyText("");
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Failed to post reply");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    if (onDelete) {
      await onDelete(comment._id);
    }
  };

  return (
    <div className={`relative ${comment.parentId ? "mt-3 border-l-2 border-border/50 pl-4" : "mt-6"}`}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-bold text-muted-foreground border border-border">
          {comment.userId.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">{comment.userId.name}</span>
              {isOwner && <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-bold uppercase text-primary">OP</span>}
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground" title={new Date(comment.createdAt).toLocaleString()}>
                {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
              </span>
              {comment.isEdited && <span className="text-muted-foreground italic">(edited)</span>}
            </div>

            {isOwner && !comment.isDeleted && (
              <button onClick={handleDelete} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className={`mt-1 text-sm ${comment.isDeleted ? "text-muted-foreground italic" : "text-foreground"}`}>
            {comment.text}
          </div>

          {!comment.isDeleted && (
            <div className="mt-2 flex items-center gap-4 text-xs font-medium text-muted-foreground">
              <div className="flex items-center gap-1">
                <button onClick={() => handleVote('up')} className={`hover:text-primary transition-colors ${isUpvoted ? 'text-primary' : ''}`}>
                  <ArrowUp className="h-4 w-4" />
                </button>
                <span className={isUpvoted ? 'text-primary' : isDownvoted ? 'text-destructive' : ''}>{comment.score}</span>
                <button onClick={() => handleVote('down')} className={`hover:text-destructive transition-colors ${isDownvoted ? 'text-destructive' : ''}`}>
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>

              {!comment.parentId && (
                <button onClick={() => setIsReplying(!isReplying)} className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                  <MessageSquare className="h-3.5 w-3.5" /> Reply
                </button>
              )}
            </div>
          )}

          {isReplying && (
            <div className="mt-3 bg-surface/30 p-3 rounded-xl border border-border">
              <Textarea
                placeholder="Write a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                className="min-h-[80px] bg-background"
                disabled={loading}
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsReplying(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button size="sm" onClick={submitReply} disabled={loading}>
                  {loading ? "Posting..." : "Reply"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
