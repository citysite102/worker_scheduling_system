import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, UserX, UserCheck, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Workers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [confirmToggleWorker, setConfirmToggleWorker] = useState<any>(null);

  const { data: workers, isLoading, refetch } = trpc.workers.list.useQuery({
    search: searchTerm,
    status: statusFilter,
  });

  const createMutation = trpc.workers.create.useMutation({
    onSuccess: () => {
      toast.success("員工新增成功");
      setIsDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`新增失敗：${error.message}`);
    },
  });

  const updateMutation = trpc.workers.update.useMutation({
    onSuccess: (_, variables) => {
      if (variables.status) {
        toast.success(variables.status === "inactive" ? "已停用員工" : "已啟用員工");
        setConfirmToggleWorker(null);
        refetch(); // 僅刷新列表
      } else {
        toast.success("員工資料更新成功");
        setIsDialogOpen(false);
        setEditingWorker(null);
        refetch();
      }
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
      setConfirmToggleWorker(null);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      email: (formData.get("email") as string) || undefined,
      note: (formData.get("note") as string) || undefined,
    };

    if (editingWorker) {
      updateMutation.mutate({ id: editingWorker.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleConfirmToggle = () => {
    if (!confirmToggleWorker) return;
    const newStatus = confirmToggleWorker.status === "active" ? "inactive" : "active";
    updateMutation.mutate({
      id: confirmToggleWorker.id,
      status: newStatus,
    });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">員工管理</h1>
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">員工管理</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingWorker(null)}>
              <Plus className="mr-2 h-4 w-4" />
              新增員工
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingWorker ? "編輯員工" : "新增員工"}</DialogTitle>
                <DialogDescription>填寫員工基本資料</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">姓名 *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingWorker?.name}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">電話 *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    defaultValue={editingWorker?.phone}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={editingWorker?.email}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="note">備註</Label>
                  <Textarea
                    id="note"
                    name="note"
                    defaultValue={editingWorker?.note}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingWorker ? "更新" : "新增"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋姓名、電話、Email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => setStatusFilter(value === "all" ? undefined : value as "active" | "inactive")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="狀態篩選" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="active">啟用</SelectItem>
                <SelectItem value="inactive">停用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>員工列表 ({workers?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!workers || workers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">無員工資料</div>
          ) : (
            <div className="space-y-3">
              {workers.map((worker) => (
                <div
                  key={worker.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{worker.name}</span>
                      <Badge variant={worker.status === "active" ? "default" : "secondary"}>
                        {worker.status === "active" ? "啟用" : "停用"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {worker.phone}
                      {worker.email && ` · ${worker.email}`}
                    </div>
                    {worker.note && (
                      <div className="text-sm text-muted-foreground mt-1">{worker.note}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingWorker(worker);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={worker.status === "active" ? "destructive" : "default"}
                      size="sm"
                      onClick={() => setConfirmToggleWorker(worker)}
                      disabled={updateMutation.isPending}
                    >
                      {worker.status === "active" ? (
                        <UserX className="h-4 w-4" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmToggleWorker} onOpenChange={(open) => !open && setConfirmToggleWorker(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmToggleWorker?.status === "active" ? "確認停用員工" : "確認啟用員工"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggleWorker?.status === "active" ? (
                <>
                  您確定要停用員工 <strong>{confirmToggleWorker?.name}</strong> 嗎？
                  <br />
                  停用後，該員工將無法被指派至新的排班。
                </>
              ) : (
                <>
                  您確定要啟用員工 <strong>{confirmToggleWorker?.name}</strong> 嗎？
                  <br />
                  啟用後，該員工將可以被指派至排班。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmToggle} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {updateMutation.isPending ? "處理中..." : "確認"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
