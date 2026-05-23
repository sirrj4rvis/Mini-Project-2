import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { forumApi } from "@/api/forumApi";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface CreatePostModalProps {
  onSuccess?: () => void;
}

export function CreatePostModal({ onSuccess }: CreatePostModalProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required");
      return;
    }

    try {
      setLoading(true);
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      
      await forumApi.createPost({ title, body, tags });
      toast.success("Discussion created successfully");
      setOpen(false);
      setTitle("");
      setBody("");
      setTagsInput("");
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          onClick={(e) => {
            if (!user) {
              e.preventDefault();
              toast.error("Please login to create a discussion");
            }
          }}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground glow"
        >
          <Plus className="h-4 w-4" /> New thread
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create a new discussion</DialogTitle>
          <DialogDescription>
            Ask a question, share a deal, or start a discussion with the community.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Input
              placeholder="Title (e.g., Best laptop deals right now?)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Textarea
              placeholder="Share your thoughts, questions, or links..."
              className="min-h-[150px] resize-y"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Input
              placeholder="Tags (comma separated, e.g., laptops, deals, question)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">Optional. Add up to 5 tags.</p>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Posting..." : "Post Discussion"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
