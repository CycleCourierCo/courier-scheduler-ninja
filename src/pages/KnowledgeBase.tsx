import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, Menu, Plus } from "lucide-react";
import { toast } from "sonner";
import KnowledgeSidebar from "@/components/knowledge/KnowledgeSidebar";
import ArticleList from "@/components/knowledge/ArticleList";
import ArticleView from "@/components/knowledge/ArticleView";
import ArticleEditor from "@/components/knowledge/ArticleEditor";
import { useKbArticle, useKbArticles, useKbCategories, useKbInvalidate } from "@/hooks/useKnowledge";
import { createArticle, createCategory } from "@/services/knowledgeService";
import type { KbArticle } from "@/types/knowledge";

const KnowledgeBase = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const invalidate = useKbInvalidate();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("none");
  const [catOpen, setCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: categories = [] } = useKbCategories();
  const { data: articles = [], isLoading } = useKbArticles({
    categoryId,
    search,
    includeDrafts: true,
  });
  const { data: activeArticle } = useKbArticle(slug);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of articles) if (a.category_id) map[a.category_id] = (map[a.category_id] ?? 0) + 1;
    return map;
  }, [articles]);

  const openArticle = (a: KbArticle) => {
    setEditing(false);
    setMobileNavOpen(false);
    navigate(`/knowledge/${a.slug}`);
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error("Give the SOP a title");
      return;
    }
    try {
      const created = await createArticle({
        title: newTitle.trim(),
        category_id: newCategory === "none" ? null : newCategory,
      });
      setNewOpen(false);
      setNewTitle("");
      invalidate();
      setEditing(true);
      navigate(`/knowledge/${created.slug}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create the SOP");
    }
  };

  const handleCreateCategory = async () => {
    if (!catName.trim()) return;
    try {
      await createCategory({ name: catName.trim() });
      setCatName("");
      setCatOpen(false);
      invalidate();
      toast.success("Category added");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add the category");
    }
  };

  const sidebar = (
    <KnowledgeSidebar
      categories={categories}
      counts={counts}
      activeCategoryId={categoryId}
      onSelectCategory={(id) => {
        setCategoryId(id);
        setMobileNavOpen(false);
      }}
      search={search}
      onSearchChange={setSearch}
      onNewCategory={() => setCatOpen(true)}
    />
  );

  return (
    <Layout>
      <div className="container mx-auto max-w-full overflow-x-hidden px-3 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-xl font-semibold sm:text-2xl">Knowledge Base &amp; SOPs</h1>
            <p className="text-sm text-muted-foreground">
              Standard procedures for route planning, customer service, drivers and the workshop.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden">
                  <Menu className="mr-2 h-4 w-4" /> Browse
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-xs overflow-y-auto">
                <div className="mt-6">{sidebar}</div>
              </SheetContent>
            </Sheet>
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> New SOP
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,300px)_minmax(0,1fr)]">
          <div className="hidden lg:block">{sidebar}</div>

          <Card className={`min-w-0 ${slug ? "hidden lg:block" : ""}`}>
            <CardContent className="p-0">
              <ArticleList
                articles={articles}
                activeId={activeArticle?.id ?? null}
                onSelect={openArticle}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          <div className="min-w-0">
            {!slug && (
              <Card className="hidden lg:block">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Pick an SOP from the list to read it, or create a new one.
                </CardContent>
              </Card>
            )}

            {slug && !activeArticle && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Loading SOP...
                </CardContent>
              </Card>
            )}

            {slug && activeArticle && (
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => navigate("/knowledge")}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> All SOPs
                </Button>

                {editing ? (
                  <ArticleEditor
                    article={activeArticle}
                    categories={categories}
                    onSaved={() => {
                      setEditing(false);
                      invalidate();
                    }}
                    onCancel={() => setEditing(false)}
                  />
                ) : (
                  <ArticleView
                    article={activeArticle}
                    onEdit={() => setEditing(true)}
                    onChanged={invalidate}
                    onDeleted={() => {
                      invalidate();
                      navigate("/knowledge");
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New SOP</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Planning a collection route"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Name</Label>
            <Input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g. Customer Service"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default KnowledgeBase;
