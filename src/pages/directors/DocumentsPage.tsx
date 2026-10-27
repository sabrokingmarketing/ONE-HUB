import { useState } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { FileText, Upload } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { PageHeader, SearchInput, EmptyState, Skeleton } from "@/components/ui/misc";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AssetGrid } from "@/components/AssetGrid";
import { useDebounced } from "@/lib/hooks";
import { useCan } from "@/lib/session";

export default function DocumentsPage() {
  const can = useCan();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const dq = useDebounced(search);
  const categories = useQuery(api.assets.categories);
  const assets = useQuery(api.assets.list, { search: dq || undefined, category: category || undefined });
  return (
    <>
      <PageHeader eyebrow="Business" title="Shared documents" description="Company documents and marketing resources shared with directors. Files are served through private, unguessable links."
        actions={can("library.write") && <Button asChild><Link to="/marketing/library"><Upload /> Upload in library</Link></Button>} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <Select className="sm:w-60" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">All categories</option>{categories?.map((c) => <option key={c}>{c}</option>)}</Select>
        <SearchInput className="sm:ml-auto sm:w-80" value={search} onChange={setSearch} placeholder="Search documents…" />
      </div>
      {assets === undefined ? <Skeleton className="h-64 rounded-2xl" /> : assets.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-stone-200/70"><EmptyState icon={FileText} title="No shared documents" description="Marketing and admins can share files with directors from the Marketing Library." /></div>
      ) : <AssetGrid assets={assets} />}
    </>
  );
}
