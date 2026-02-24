import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit2, Trash2, GripVertical, X } from "lucide-react";
import { toast } from "sonner";

export default function DemandTypes() {
  const [editingType, setEditingType] = useState<{ id?: number; name: string; description: string } | null>(null);
  const [editingOptions, setEditingOptions] = useState<{ demandTypeId: number; name: string } | null>(null);
  const [optionInputs, setOptionInputs] = useState<string[]>([""]);

  const { data: demandTypes = [], isLoading, refetch } = trpc.demandTypes.list.useQuery();
  const createType = trpc.demandTypes.create.useMutation();
  const updateType = trpc.demandTypes.update.useMutation();
  const deleteType = trpc.demandTypes.delete.useMutation();
  const createOption = trpc.demandTypes.createOption.useMutation();
  const deleteOption = trpc.demandTypes.deleteOption.useMutation();

  const handleSaveType = async () => {
    if (!editingType) return;
    if (!editingType.name.trim()) {
      toast.error("需求名稱不可為空");
      return;
    }

    try {
      if (editingType.id) {
        await updateType.mutateAsync({
          id: editingType.id,
          name: editingType.name,
          description: editingType.description,
        });
        toast.success("需求類型已更新");
      } else {
        await createType.mutateAsync({
          name: editingType.name,
          description: editingType.description,
        });
        toast.success("需求類型已建立");
      }
      refetch();
      setEditingType(null);
    } catch (error) {
      toast.error("操作失敗");
    }
  };

  const handleDeleteType = async (id: number, name: string) => {
    if (!confirm(`確定要刪除「${name}」嗎？此操作將同時刪除所有相關選項。`)) return;

    try {
      await deleteType.mutateAsync({ id });
      toast.success("需求類型已刪除");
      refetch();
    } catch (error) {
      toast.error("刪除失敗");
    }
  };

  const handleSaveOptions = async () => {
    if (!editingOptions) return;

    const validOptions = optionInputs.filter(opt => opt.trim());
    if (validOptions.length === 0) {
      toast.error("請至少輸入一個選項");
      return;
    }

    try {
      for (let i = 0; i < validOptions.length; i++) {
        await createOption.mutateAsync({
          demandTypeId: editingOptions.demandTypeId,
          content: validOptions[i],
          sortOrder: i,
        });
      }
      toast.success(`已新增 ${validOptions.length} 個選項`);
      refetch();
      setEditingOptions(null);
      setOptionInputs([""]);
    } catch (error) {
      toast.error("新增選項失敗");
    }
  };

  const handleDeleteOption = async (optionId: number) => {
    try {
      await deleteOption.mutateAsync({ id: optionId });
      toast.success("選項已刪除");
      refetch();
    } catch (error) {
      toast.error("刪除選項失敗");
    }
  };

  const addOptionInput = () => {
    setOptionInputs([...optionInputs, ""]);
  };

  const removeOptionInput = (index: number) => {
    setOptionInputs(optionInputs.filter((_, i) => i !== index));
  };

  const updateOptionInput = (index: number, value: string) => {
    const newInputs = [...optionInputs];
    newInputs[index] = value;
    setOptionInputs(newInputs);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">需求類型管理</h1>
          <p className="text-muted-foreground mt-1">建立與管理用工需求的類型與選項</p>
        </div>
        <Button onClick={() => setEditingType({ name: "", description: "" })}>
          <Plus className="h-4 w-4 mr-2" />
          新增需求類型
        </Button>
      </div>

      {demandTypes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">尚未建立任何需求類型</p>
            <Button onClick={() => setEditingType({ name: "", description: "" })}>
              <Plus className="h-4 w-4 mr-2" />
              建立第一個需求類型
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {demandTypes.map((type) => (
            <Card key={type.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle>{type.name}</CardTitle>
                    {type.description && (
                      <CardDescription className="mt-2">{type.description}</CardDescription>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingType({ id: type.id, name: type.name, description: type.description || "" })}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteType(type.id, type.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm font-medium">選項清單</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingOptions({ demandTypeId: type.id, name: type.name });
                        setOptionInputs([""]);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      新增選項
                    </Button>
                  </div>
                  {type.options && type.options.length > 0 ? (
                    <div className="space-y-2">
                      {type.options.map((option, index) => (
                        <div
                          key={option.id}
                          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">□</span>
                            <span className="text-sm">{option.content}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteOption(option.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">尚未建立任何選項</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 編輯需求類型對話框 */}
      <Dialog open={!!editingType} onOpenChange={(open) => !open && setEditingType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType?.id ? "編輯需求類型" : "新增需求類型"}</DialogTitle>
            <DialogDescription>
              設定需求類型的名稱與說明，稍後可以為此類型新增多個選項。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="type-name">需求名稱 *</Label>
              <Input
                id="type-name"
                placeholder="例如：櫃檯接待服務"
                value={editingType?.name || ""}
                onChange={(e) => setEditingType(editingType ? { ...editingType, name: e.target.value } : null)}
              />
            </div>
            <div>
              <Label htmlFor="type-description">需求說明</Label>
              <Textarea
                id="type-description"
                placeholder="簡短說明此需求類型的用途..."
                value={editingType?.description || ""}
                onChange={(e) => setEditingType(editingType ? { ...editingType, description: e.target.value } : null)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingType(null)}>
              取消
            </Button>
            <Button onClick={handleSaveType} disabled={createType.isPending || updateType.isPending}>
              {createType.isPending || updateType.isPending ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 新增選項對話框 */}
      <Dialog open={!!editingOptions} onOpenChange={(open) => !open && setEditingOptions(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>為「{editingOptions?.name}」新增選項</DialogTitle>
            <DialogDescription>
              輸入多個選項內容，使用者在建立需求單時可以勾選這些項目。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {optionInputs.map((input, index) => (
              <div key={index} className="flex items-start gap-2">
                <span className="text-sm text-muted-foreground mt-2">□</span>
                <Input
                  placeholder="例如：以專業、熱情及友善的態度接待顧客"
                  value={input}
                  onChange={(e) => updateOptionInput(index, e.target.value)}
                  className="flex-1"
                />
                {optionInputs.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOptionInput(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addOptionInput}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              新增更多選項
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingOptions(null)}>
              取消
            </Button>
            <Button onClick={handleSaveOptions} disabled={createOption.isPending}>
              {createOption.isPending ? "新增中..." : "確認新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
