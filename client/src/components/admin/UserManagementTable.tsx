import React, { useState, useEffect } from "react";
import { Search, Loader2, UserCheck, UserX, Shield } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { adminApi, UserManagement, UsersResponse } from "@/api/adminApi";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export function UserManagementTable() {
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getAllUsers({ page, limit: 10, search });
      setData(response);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 400); // debounce search
    return () => clearTimeout(timer);
  }, [search, page]);

  const handleToggleStatus = async (userId: string, currentRole: string) => {
    if (currentRole === "admin") {
      toast.error("Cannot modify admin status");
      return;
    }
    
    if (!window.confirm("Are you sure you want to toggle this user's active status?")) return;

    try {
      const res = await adminApi.toggleUserStatus(userId);
      toast.success(res.message);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to toggle user status");
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border px-6 py-4 gap-4">
        <h2 className="font-display text-lg font-bold">User Management</h2>
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by name or email..." 
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 h-9 rounded-full bg-surface/50 border-border"
          />
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-surface/30 border-b border-border">
            <tr>
              <th className="px-6 py-3 font-medium tracking-wider">User</th>
              <th className="px-6 py-3 font-medium tracking-wider">Role</th>
              <th className="px-6 py-3 font-medium tracking-wider">Joined</th>
              <th className="px-6 py-3 font-medium tracking-wider">Status</th>
              <th className="px-6 py-3 font-medium tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                </td>
              </tr>
            ) : data?.users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                  No users found matching your search.
                </td>
              </tr>
            ) : (
              data?.users.map((user) => (
                <tr key={user._id} className="hover:bg-surface/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-foreground">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${user.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-surface-elevated text-muted-foreground'}`}>
                      {user.role === 'admin' && <Shield className="h-3 w-3" />}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${user.isActive ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                      {user.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {user.role !== 'admin' && (
                      <button 
                        onClick={() => handleToggleStatus(user._id, user.role)}
                        className={`inline-flex items-center gap-1 text-xs font-medium ${user.isActive ? 'text-destructive hover:text-destructive/80' : 'text-success hover:text-success/80'}`}
                      >
                        {user.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                        {user.isActive ? 'Disable' : 'Enable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <div className="text-xs text-muted-foreground">
            Showing {data.users.length} of {data.total} users
          </div>
          <div className="flex gap-2">
            <button 
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 border rounded-md text-xs font-medium disabled:opacity-50 hover:bg-surface"
            >
              Prev
            </button>
            <button 
              disabled={page === data.pages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 border rounded-md text-xs font-medium disabled:opacity-50 hover:bg-surface"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
