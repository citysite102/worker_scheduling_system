import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Edit2,
  Trash2,
  Briefcase,
  Loader2,
  Users,
  ChevronDown,
  ChevronRight,
  List,
  GripVertical,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

const COLOR_PRESETS = [
  "#6366f1", "#3b82f6", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
  "#64748b", "#84cc16",
];

interface EditingCategory {
  id?: number;
  name: string;
  description: string;
  color: string;
}

interface CategoryOption {
  id: number;
  content: string;
  sortOrder: number;
}

interface CategoryWithOptions {
  id: number;
  name: string;
  description: string | null;
  color: string;
  options: CategoryOption[];
}

function OptionRow({
  option,
  color,
  onUpdate,
  onDelete,
}: {
  option: CategoryOption;
  color: string;
  onUpdate: (id: number, content: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(option.content);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = () => {
    setEditValue(option.content);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSave = async () => {
    if (!editValue.trim()) { toast.error("選項內容不可為空"); return; }
    setIsSaving(true);
    try { await onUpdate(option.id, editValue.trim()); setIsEditing(false); }
    finally { setIsSaving(false); }
  };

  const handleCancel = () => { setEditValue(option.content); setIsEditing(false); };

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-accent/30 group transition-colors">
      <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {isEditing ? (
        <div className="flex items-center gap-1.5 flex-1">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
            className="h-7 text-sm flex-1"
          />
          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" disabled={isSaving} onClick={handleSave}>
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={handleCancel}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm text-foreground/80">{option.content}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={handleStartEdit}>
              <Edit2 className="w-3 h-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(option.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function CategoryOptions({ category }: { category: CategoryWithOptions }) {
  const [newOptionContent, setNewOptionContent] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const utils = trpc.useUtils();

  const createOptionMutation = trpc.jobCategories.createOption.useMutation({
    onSuccess: () => utils.jobCategories.list.invalidate(),
  });
  const updateOptionMutation = trpc.jobCategories.updateOption.useMutation({
    onSuccess: () => utils.jobCategories.list.invalidate(),
  });
  const deleteOptionMutation = trpc.jobCategories.deleteOption.useMutation({
    onSuccess: () => utils.jobCategories.list.invalidate(),
  });

  const handleAddOption = async () => {
    if (!newOptionContent.trim()) { toast.error("選項內容不可為空"); return; }
    try {
      await createOptionMutation.mutateAsync({
        jobCategoryId: category.id,
        content: newOptionContent.trim(),
        sortOrder: category.options.length,
      });
      setNewOptionContent("");
      setIsAdding(false);
      toast.success("選項已新增");
    } catch (error: any) { toast.error(`新增失敗：${error.message}`); }
  };

  const handleUpdateOption = async (id: number, content: string) => {
    try { await updateOptionMutation.mutateAsync({ id, content }); toast.success("選項已更新"); }
    catch (error: any) { toast.error(`更新失敗：${error.message}`); }
  };

  const handleDeleteOption = async (id: number) => {
    if (!confirm("確定要刪除此選項嗎？")) return;
    try { await deleteOptionMutation.mutateAsync({ id }); toast.success("選項已刪除"); }
    catch (error: any) { toast.error(`刪除失敗：${error.message}`); }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/40">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <List className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">選項清單</span>
          <Badge variant="secondary" className="text-xs h-4 px-1.5 font-normal">{category.options.length}</Badge>
        </div>
        <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 px-2 text-muted-foreground hover:text-foreground" onClick={() => setIsAdding(true)}>
          <Plus className="w-3 h-3" />新增選項
        </Button>
      </div>

      <div className="space-y-0.5">
        {category.options.length === 0 && !isAdding ? (
          <p className="text-xs text-muted-foreground/60 py-2 px-2 italic">尚未建立任何選項，點擊「新增選項」開始建立</p>
        ) : (
          [...category.options]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((opt) => (
              <OptionRow key={opt.id} option={opt} color={category.color} onUpdate={handleUpdateOption} onDelete={handleDeleteOption} />
            ))
        )}

        {isAdding && (
          <div className="flex items-center gap-1.5 py-1.5 px-2">
            <div className="w-3.5 h-3.5 shrink-0" />
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
            <Input
              autoFocus
              value={newOptionContent}
              onChange={(e) => setNewOptionContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddOption();
                if (e.key === "Escape") { setIsAdding(false); setNewOptionContent(""); }
              }}
              placeholder="輸入選項內容，按 Enter 確認"
              className="h-7 text-sm flex-1"
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50" disabled={createOptionMutation.isPending} onClick={handleAddOption}>
              {createOptionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => { setIsAdding(false); setNewOptionContent(""); }}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function JobCategories() {
  const [editingCategory, setEditingCategory] = useState<EditingCategory | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const utils = trpc.useUtils();
  const { data: categories = [], isLoading } = trpc.jobCategories.list.useQuery();
  const createMutation = trpc.jobCategories.create.useMutation({ onSuccess: () => utils.jobCategories.list.invalidate() });
  const updateMutation = trpc.jobCategories.update.useMutation({ onSuccess: () => utils.jobCategories.list.invalidate() });
  const deleteMutation = trpc.jobCategories.delete.useMutation({ onSuccess: () => utils.jobCategories.list.invalidate() });

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleOpenCreate = () => setEditingCategory({ name: "", description: "", color: "#6366f1" });

  const handleOpenEdit = (cat: CategoryWithOptions) => {
    setEditingCategory({ id: cat.id, name: cat.name, description: cat.description ?? "", color: cat.color });
  };

  const handleSave = async () => {
    if (!editingCategory) return;
    if (!editingCategory.name.trim()) { toast.error("工作種類名稱不可為空"); return; }
    try {
      if (editingCategory.id) {
        await updateMutation.mutateAsync({ id: editingCategory.id, name: editingCategory.name.trim(), description: editingCategory.description || undefined, color: editingCategory.color });
        toast.success("工作種類已更新");
      } else {
        await createMutation.mutateAsync({ name: editingCategory.name.trim(), description: editingCategory.description || undefined, color: editingCategory.color });
        toast.success("工作種類已建立");
      }
      setEditingCategory(null);
    } catch (error: any) { toast.error(`操作失敗：${error.message}`); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`確定要刪除「${name}」嗎？\n\n刪除後，所有員工的此工作種類標記以及相關需求的對應設定都將一併清除。`)) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("工作種類已刪除");
      setExpandedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    } catch (error: any) { toast.error(`刪除失敗：${error.message}`); }
    finally { setDeletingId(null); }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const catsWithOptions = categories as CategoryWithOptions[];
  const totalOptions = catsWithOptions.reduce((acc, c) => acc + (c.options?.length ?? 0), 0);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">工作種類管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          定義員工可執行的工作種類，並為每個種類建立選項清單（用於需求單填寫），以利精準配對
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-border/40 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">工作種類</p>
                <p className="text-3xl font-bold mt-1">{categories.length}</p>
              </div>
              <Briefcase className="w-8 h-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">選項總數</p>
                <p className="text-3xl font-bold mt-1">{totalOptions}</p>
              </div>
              <List className="w-8 h-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">所有種類</p>
            <div className="flex flex-wrap gap-1.5">
              {catsWithOptions.length === 0 ? (
                <span className="text-sm text-muted-foreground">尚未建立</span>
              ) : (
                catsWithOptions.map((cat) => (
                  <Badge key={cat.id} style={{ backgroundColor: cat.color + "20", color: cat.color, borderColor: cat.color + "40" }} className="border text-xs font-medium">
                    {cat.name}
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md border-border/40">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-medium">工作種類清單</CardTitle>
              <CardDescription>展開每個種類可管理其選項清單（用於需求單選擇）</CardDescription>
            </div>
            <Button size="sm" onClick={handleOpenCreate} className="gap-2">
              <Plus className="w-4 h-4" />新增種類
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : catsWithOptions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">尚未建立工作種類</p>
              <p className="text-sm mt-1">點擊「新增種類」開始建立，例如：房務、看護、餐飲服務</p>
              <Button size="sm" onClick={handleOpenCreate} className="mt-4 gap-2">
                <Plus className="w-4 h-4" />立即新增
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {catsWithOptions.map((cat) => {
                const isExpanded = expandedIds.has(cat.id);
                return (
                  <div key={cat.id} className="rounded-lg border border-border/50 overflow-hidden transition-all">
                    <div
                      className="flex items-center gap-3 p-3.5 hover:bg-accent/30 transition-colors cursor-pointer group"
                      onClick={() => toggleExpand(cat.id)}
                    >
                      <div className="shrink-0 text-muted-foreground/50">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                      <div className="w-2.5 h-8 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{cat.name}</span>
                          <Badge style={{ backgroundColor: cat.color + "18", color: cat.color, borderColor: cat.color + "35" }} className="border text-xs">
                            {cat.options?.length ?? 0} 個選項
                          </Badge>
                        </div>
                        {cat.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{cat.description}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => handleOpenEdit(cat)}>
                          <Edit2 className="w-3 h-3" />編輯
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" disabled={deletingId === cat.id} onClick={() => handleDelete(cat.id, cat.name)}>
                          {deletingId === cat.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          刪除
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-3 bg-muted/10">
                        <CategoryOptions category={cat} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4 border-border/30 bg-muted/20 shadow-none">
        <CardContent className="pt-5 pb-4">
          <div className="flex gap-3">
            <Users className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">如何使用工作種類</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>在「員工管理」→ 員工詳情頁，為每位員工標記可執行的工作種類</li>
                <li>展開工作種類，可為每個種類建立選項清單（例如：房務 → 整理床鋪、補充備品、清潔衛浴）</li>
                <li>建立需求單時，選擇工作種類後可從對應選項清單中挑選具體需求內容</li>
                <li>在需求配對時，系統會自動標示符合工作種類的員工，方便快速篩選</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory?.id ? "編輯工作種類" : "新增工作種類"}</DialogTitle>
            <DialogDescription>
              {editingCategory?.id ? "修改工作種類的名稱、說明與標籤顏色" : "建立新的工作種類，例如：房務、看護、餐飲服務"}
            </DialogDescription>
          </DialogHeader>

          {editingCategory && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">種類名稱 *</Label>
                <Input id="cat-name" placeholder="例如：房務、看護、餐飲服務" value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-desc">說明（選填）</Label>
                <Textarea id="cat-desc" placeholder="簡短說明此工作種類的內容或要求" rows={2} value={editingCategory.description} onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>標籤顏色</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button key={color} type="button"
                      className={`w-7 h-7 rounded-full border-2 transition-all ${editingCategory.color === color ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-105"}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditingCategory({ ...editingCategory, color })}
                    />
                  ))}
                  <label className="w-7 h-7 rounded-full border-2 border-dashed border-border cursor-pointer flex items-center justify-center hover:border-foreground/50 transition-colors relative overflow-hidden">
                    <span className="text-xs text-muted-foreground">+</span>
                    <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" value={editingCategory.color} onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })} />
                  </label>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">預覽：</span>
                  <Badge style={{ backgroundColor: editingCategory.color + "20", color: editingCategory.color, borderColor: editingCategory.color + "40" }} className="border text-xs">
                    {editingCategory.name || "種類名稱"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>取消</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />儲存中...</> : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
