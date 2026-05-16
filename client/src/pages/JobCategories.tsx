import { useState } from "react";
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
import { Plus, Edit2, Trash2, Briefcase, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

// 預設顏色選項
const COLOR_PRESETS = [
  "#6366f1", // 靛紫
  "#3b82f6", // 藍
  "#0ea5e9", // 天藍
  "#10b981", // 翠綠
  "#f59e0b", // 琥珀
  "#ef4444", // 紅
  "#ec4899", // 粉紅
  "#8b5cf6", // 紫
  "#14b8a6", // 青
  "#f97316", // 橙
  "#64748b", // 灰藍
  "#84cc16", // 黃綠
];

interface EditingCategory {
  id?: number;
  name: string;
  description: string;
  color: string;
}

export default function JobCategories() {
  const [editingCategory, setEditingCategory] = useState<EditingCategory | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: categories = [], isLoading, refetch } = trpc.jobCategories.list.useQuery();
  const createMutation = trpc.jobCategories.create.useMutation();
  const updateMutation = trpc.jobCategories.update.useMutation();
  const deleteMutation = trpc.jobCategories.delete.useMutation();

  const handleOpenCreate = () => {
    setEditingCategory({ name: "", description: "", color: "#6366f1" });
  };

  const handleOpenEdit = (cat: { id: number; name: string; description: string | null; color: string }) => {
    setEditingCategory({
      id: cat.id,
      name: cat.name,
      description: cat.description ?? "",
      color: cat.color,
    });
  };

  const handleSave = async () => {
    if (!editingCategory) return;
    if (!editingCategory.name.trim()) {
      toast.error("工作種類名稱不可為空");
      return;
    }

    try {
      if (editingCategory.id) {
        await updateMutation.mutateAsync({
          id: editingCategory.id,
          name: editingCategory.name.trim(),
          description: editingCategory.description || undefined,
          color: editingCategory.color,
        });
        toast.success("工作種類已更新");
      } else {
        await createMutation.mutateAsync({
          name: editingCategory.name.trim(),
          description: editingCategory.description || undefined,
          color: editingCategory.color,
        });
        toast.success("工作種類已建立");
      }
      await refetch();
      setEditingCategory(null);
    } catch (error: any) {
      toast.error(`操作失敗：${error.message}`);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`確定要刪除「${name}」嗎？\n\n刪除後，所有員工的此工作種類標記以及需求類型的對應設定都將一併清除。`)) return;
    setDeletingId(id);
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("工作種類已刪除");
      await refetch();
    } catch (error: any) {
      toast.error(`刪除失敗：${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">工作種類管理</h1>
        <p className="text-sm text-muted-foreground mt-1">
          定義員工可執行的工作種類，並在需求類型中設定所需能力，以利精準配對
        </p>
      </div>

      {/* 統計卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="border-border/40 shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">工作種類總數</p>
                <p className="text-3xl font-bold mt-1">{categories.length}</p>
              </div>
              <Briefcase className="w-8 h-8 text-primary/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 shadow-sm col-span-2">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">所有種類</p>
            <div className="flex flex-wrap gap-2">
              {categories.length === 0 ? (
                <span className="text-sm text-muted-foreground">尚未建立任何工作種類</span>
              ) : (
                categories.map((cat) => (
                  <Badge
                    key={cat.id}
                    style={{ backgroundColor: cat.color + "20", color: cat.color, borderColor: cat.color + "40" }}
                    className="border text-xs font-medium"
                  >
                    {cat.name}
                  </Badge>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 工作種類清單 */}
      <Card className="shadow-md border-border/40">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-medium">工作種類清單</CardTitle>
              <CardDescription>點擊編輯可修改名稱、說明與標籤顏色</CardDescription>
            </div>
            <Button size="sm" onClick={handleOpenCreate} className="gap-2">
              <Plus className="w-4 h-4" />
              新增種類
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">尚未建立工作種類</p>
              <p className="text-sm mt-1">點擊「新增種類」開始建立，例如：房務、看護、餐飲服務</p>
              <Button size="sm" onClick={handleOpenCreate} className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                立即新增
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:bg-accent/30 transition-colors group"
                >
                  {/* 顏色標示 */}
                  <div
                    className="w-3 h-10 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />

                  {/* 名稱與說明 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{cat.name}</span>
                      <Badge
                        style={{ backgroundColor: cat.color + "18", color: cat.color, borderColor: cat.color + "35" }}
                        className="border text-xs"
                      >
                        {cat.name}
                      </Badge>
                    </div>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{cat.description}</p>
                    )}
                  </div>

                  {/* 操作按鈕 */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8"
                      onClick={() => handleOpenEdit(cat)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      編輯
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={deletingId === cat.id}
                      onClick={() => handleDelete(cat.id, cat.name)}
                    >
                      {deletingId === cat.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      刪除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 說明區塊 */}
      <Card className="mt-4 border-border/30 bg-muted/20 shadow-none">
        <CardContent className="pt-5 pb-4">
          <div className="flex gap-3">
            <Users className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">如何使用工作種類</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>在「員工管理」→ 員工詳情頁，為每位員工標記可執行的工作種類</li>
                <li>在「需求類型管理」中，為每個需求類型設定所需的工作種類</li>
                <li>在需求配對時，系統會自動標示符合條件的員工，方便快速篩選</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 新增/編輯 Dialog */}
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
              {/* 名稱 */}
              <div className="space-y-1.5">
                <Label htmlFor="cat-name">種類名稱 *</Label>
                <Input
                  id="cat-name"
                  placeholder="例如：房務、看護、餐飲服務"
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                />
              </div>

              {/* 說明 */}
              <div className="space-y-1.5">
                <Label htmlFor="cat-desc">說明（選填）</Label>
                <Textarea
                  id="cat-desc"
                  placeholder="簡短說明此工作種類的內容或要求"
                  rows={2}
                  value={editingCategory.description}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                />
              </div>

              {/* 顏色 */}
              <div className="space-y-2">
                <Label>標籤顏色</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        editingCategory.color === color
                          ? "border-foreground scale-110 shadow-md"
                          : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setEditingCategory({ ...editingCategory, color })}
                    />
                  ))}
                  {/* 自訂顏色 */}
                  <label className="w-7 h-7 rounded-full border-2 border-dashed border-border cursor-pointer flex items-center justify-center hover:border-foreground/50 transition-colors relative overflow-hidden">
                    <span className="text-xs text-muted-foreground">+</span>
                    <input
                      type="color"
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      value={editingCategory.color}
                      onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                    />
                  </label>
                </div>
                {/* 預覽 */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">預覽：</span>
                  <Badge
                    style={{
                      backgroundColor: editingCategory.color + "20",
                      color: editingCategory.color,
                      borderColor: editingCategory.color + "40",
                    }}
                    className="border text-xs"
                  >
                    {editingCategory.name || "種類名稱"}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  儲存中...
                </>
              ) : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
