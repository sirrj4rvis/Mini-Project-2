import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { forumApi, ForumPost, PostListResponse } from "@/api/forumApi";
import { PostCard } from "@/components/forum/PostCard";
import { CreatePostModal } from "@/components/forum/CreatePostModal";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/forum/")({
  head: () => ({ meta: [{ title: "Community — PriceLens" }] }),
  component: Forum,
});

const TAGS = ["All", "deals", "question", "review", "laptops", "smartphones"];
const SORTS = [
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
  { value: "trending", label: "Trending" },
];

function Forum() {
  const [data, setData] = useState<PostListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tag, setTag] = useState("All");
  const [sort, setSort] = useState("new");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await forumApi.getPosts({
        page,
        limit: 15,
        tag: tag !== "All" ? tag : undefined,
        sort,
        q: search || undefined,
      });
      setData(response);
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPosts();
    }, 300); // debounce search
    return () => clearTimeout(timer);
  }, [page, tag, sort, search]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // reset page on search
  };

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Community
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold">Buying advice & deals</h1>
          <p className="mt-1 text-muted-foreground">
            Real shoppers. Real timing tips. Real savings.
          </p>
        </div>
        <CreatePostModal onSuccess={fetchPosts} />
      </div>

      <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex flex-1 items-center rounded-full border border-border bg-card pl-5 pr-2 py-1.5 max-w-xl">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search discussions..."
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sort by:</span>
          <select 
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="bg-transparent font-medium outline-none cursor-pointer border-b border-dashed border-border"
          >
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TAGS.map((t) => (
          <button
            key={t}
            onClick={() => { setTag(t); setPage(1); }}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium capitalize transition-colors ${tag === t ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface/50 text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        {loading ? (
          Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-3xl" />
          ))
        ) : data?.posts && data.posts.length > 0 ? (
          data.posts.map((post) => (
            <PostCard key={post._id} post={post} onVoteChange={fetchPosts} />
          ))
        ) : (
          <div className="text-center py-20 border border-dashed rounded-3xl bg-surface/30">
            <h3 className="text-lg font-bold text-foreground">No discussions found</h3>
            <p className="text-muted-foreground mt-1">Be the first to start a conversation here.</p>
          </div>
        )}
      </div>
      
      {/* Pagination Controls */}
      {data && data.pages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <button 
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 border rounded-full text-sm font-medium disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-muted-foreground">
            Page {page} of {data.pages}
          </span>
          <button 
            disabled={page === data.pages}
            onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 border rounded-full text-sm font-medium disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
