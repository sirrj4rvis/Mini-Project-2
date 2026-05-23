import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, ArrowUp, ArrowDown, MessageSquare, Trash } from "lucide-react";
import { toast } from "sonner";
import { forumApi, ForumPost, ForumComment, CommentListResponse } from "@/api/forumApi";
import { CommentItem } from "@/components/forum/CommentItem";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/forum/$id")({
  component: PostDetail,
});

function PostDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [post, setPost] = useState<ForumPost | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  
  const [commentsData, setCommentsData] = useState<CommentListResponse | null>(null);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const fetchPost = async () => {
    try {
      const p = await forumApi.getPost(id);
      setPost(p);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load post");
    } finally {
      setLoadingPost(false);
    }
  };

  const fetchComments = async () => {
    try {
      const data = await forumApi.getComments(id, { limit: 50 });
      setCommentsData(data);
    } catch (error) {
      console.error("Failed to load comments", error);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [id]);

  const handlePostVote = async (voteType: 'up' | 'down') => {
    if (!user) return toast.error("Please login to vote");
    try {
      await forumApi.votePost(id, voteType);
      fetchPost();
    } catch (error) {
      toast.error("Vote failed");
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      await forumApi.deletePost(id);
      toast.success("Post deleted");
      router.history.push("/forum");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete post");
    }
  };

  const submitTopLevelComment = async () => {
    if (!commentText.trim()) return;
    if (!user) return toast.error("Please login to comment");
    
    setPostingComment(true);
    try {
      await forumApi.addComment(id, { text: commentText });
      setCommentText("");
      toast.success("Comment added");
      fetchComments();
      fetchPost(); // update comment count
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to post comment");
    } finally {
      setPostingComment(false);
    }
  };

  const handleReply = async (parentId: string, text: string) => {
    await forumApi.addComment(id, { text, parentId });
    fetchComments();
    fetchPost();
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await forumApi.deleteComment(id, commentId);
      toast.success("Comment deleted");
      fetchComments();
      fetchPost();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete comment");
    }
  };

  if (loadingPost) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Skeleton className="h-8 w-24 mb-6" />
        <Skeleton className="h-12 w-3/4 mb-4" />
        <Skeleton className="h-4 w-1/2 mb-8" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Post not found</h2>
        <Button className="mt-4" onClick={() => router.history.push("/forum")}>Back to Forum</Button>
      </div>
    );
  }

  const isUpvoted = post.viewerVote === 'up';
  const isDownvoted = post.viewerVote === 'down';
  const isOwner = user?._id === post.userId._id;

  // Organize comments into threads
  const topLevelComments = commentsData?.comments.filter(c => !c.parentId) || [];
  const getReplies = (parentId: string) => commentsData?.comments.filter(c => c.parentId === parentId) || [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <button 
        onClick={() => router.history.push("/forum")}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to discussions
      </button>

      {/* Main Post */}
      <article className="rounded-3xl border border-border bg-card p-6 md:p-8">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Desktop Voting Sidebar */}
          <div className="hidden sm:flex flex-col items-center gap-2 shrink-0 bg-surface/30 p-2 rounded-2xl self-start">
            <button onClick={() => handlePostVote('up')} className={`p-2 rounded-full hover:bg-surface transition-colors ${isUpvoted ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}>
              <ArrowUp className="h-5 w-5" />
            </button>
            <span className={`text-base font-bold ${isUpvoted ? 'text-primary' : isDownvoted ? 'text-destructive' : 'text-foreground'}`}>
              {post.score}
            </span>
            <button onClick={() => handlePostVote('down')} className={`p-2 rounded-full hover:bg-surface transition-colors ${isDownvoted ? 'text-destructive bg-destructive/10' : 'text-muted-foreground'}`}>
              <ArrowDown className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-bold text-primary-foreground">
                  {post.userId.name.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold text-foreground">{post.userId.name}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground" title={new Date(post.createdAt).toLocaleString()}>
                  {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </span>
              </div>
              
              {isOwner && (
                <button onClick={handleDeletePost} className="text-muted-foreground hover:text-destructive p-2">
                  <Trash className="h-4 w-4" />
                </button>
              )}
            </div>

            <h1 className="mt-4 font-display text-2xl md:text-3xl font-bold leading-tight">
              {post.title}
            </h1>

            {post.tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-primary/5 border border-primary/10 px-2.5 py-1 text-xs font-medium lowercase text-primary">
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 prose prose-neutral dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-wrap text-[15px]">
              {post.body}
            </div>

            {post.productId && (
              <div className="mt-8 rounded-2xl border border-border bg-surface/30 p-4 flex items-center gap-4">
                {post.productId.imageUrl && (
                  <img src={post.productId.imageUrl} alt={post.productId.title} className="w-16 h-16 object-contain rounded-lg bg-white p-1" />
                )}
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tagged Product</div>
                  <div className="font-medium text-sm line-clamp-1">{post.productId.title}</div>
                  <div className="text-primary font-bold mt-1">₹{post.productId.lowestPrice}</div>
                </div>
              </div>
            )}

            {/* Mobile Voting */}
            <div className="mt-6 flex sm:hidden items-center gap-1 bg-surface/50 rounded-full px-3 py-1 border border-border/50 self-start w-max">
              <button onClick={() => handlePostVote('up')} className={`p-1.5 ${isUpvoted ? 'text-primary' : ''}`}><ArrowUp className="h-4 w-4" /></button>
              <span className={`font-semibold px-2 ${isUpvoted ? 'text-primary' : isDownvoted ? 'text-destructive' : ''}`}>{post.score}</span>
              <button onClick={() => handlePostVote('down')} className={`p-1.5 ${isDownvoted ? 'text-destructive' : ''}`}><ArrowDown className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </article>

      {/* Comments Section */}
      <div className="mt-10">
        <h3 className="font-display text-xl font-bold mb-6 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" /> 
          {post.commentCount} Comments
        </h3>

        <div className="mb-8 bg-card border border-border rounded-2xl p-4">
          <Textarea 
            placeholder="What are your thoughts?" 
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            className="min-h-[100px] border-none bg-transparent focus-visible:ring-0 px-0 resize-none text-base"
          />
          <div className="flex justify-between items-center mt-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">Please be respectful and helpful.</p>
            <Button onClick={submitTopLevelComment} disabled={postingComment || !commentText.trim()} className="rounded-full px-6">
              {postingComment ? "Posting..." : "Comment"}
            </Button>
          </div>
        </div>

        {loadingComments ? (
          <div className="space-y-6">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : topLevelComments.length > 0 ? (
          <div className="space-y-6">
            {topLevelComments.map(comment => (
              <div key={comment._id} className="bg-card border border-border rounded-2xl p-5">
                <CommentItem 
                  comment={comment} 
                  onVoteChange={fetchComments}
                  onReply={handleReply}
                  onDelete={handleDeleteComment}
                />
                {/* Replies */}
                {getReplies(comment._id).length > 0 && (
                  <div className="mt-2">
                    {getReplies(comment._id).map(reply => (
                      <CommentItem 
                        key={reply._id} 
                        comment={reply} 
                        onVoteChange={fetchComments}
                        onDelete={handleDeleteComment}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No comments yet. Be the first to share your thoughts!
          </div>
        )}
      </div>
    </div>
  );
}
