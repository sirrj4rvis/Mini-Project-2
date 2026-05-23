import React from "react";
import { Link } from "@tanstack/react-router";
import { Trash, ExternalLink } from "lucide-react";
import { adminApi } from "@/api/adminApi";
import { toast } from "sonner";

interface ProductManagementTableProps {
  products: any[];
  onRefresh: () => void;
}

export function ProductManagementTable({ products, onRefresh }: ProductManagementTableProps) {
  
  const handleDelete = async (productId: string) => {
    if (!window.confirm("WARNING: This will permanently delete the product, its price history, and all related user alerts. Are you sure?")) {
      return;
    }

    try {
      const res = await adminApi.deleteProduct(productId);
      toast.success(res.message);
      onRefresh();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete product");
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card overflow-hidden mt-6">
      <div className="border-b border-border px-6 py-4">
        <h2 className="font-display text-lg font-bold">Top Tracked Products</h2>
        <p className="text-xs text-muted-foreground mt-1">Based on global search volume and watchlists.</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-muted-foreground uppercase bg-surface/30 border-b border-border">
            <tr>
              <th className="px-6 py-3 font-medium tracking-wider">Product</th>
              <th className="px-6 py-3 font-medium tracking-wider">Category</th>
              <th className="px-6 py-3 font-medium tracking-wider">Lowest Price</th>
              <th className="px-6 py-3 font-medium tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product._id} className="hover:bg-surface/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.imageUrl && (
                        <div className="h-10 w-10 shrink-0 rounded bg-white p-1 flex items-center justify-center">
                          <img src={product.imageUrl} alt="" className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-foreground line-clamp-1 max-w-xs">{product.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          {product.searchCount} active searches
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                      {product.category || 'Other'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-foreground">
                    ₹{product.lowestPrice?.toLocaleString() || '--'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link 
                        to="/product/$id" 
                        params={{ id: product._id }}
                        className="inline-flex items-center text-xs font-medium text-primary hover:text-primary/80"
                      >
                        View
                      </Link>
                      <button 
                        onClick={() => handleDelete(product._id)}
                        className="inline-flex items-center text-xs font-medium text-destructive hover:text-destructive/80"
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
