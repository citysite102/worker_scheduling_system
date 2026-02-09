import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, UserX, UserCheck, Loader2, Phone, Mail } from "lucide-react";
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
        refetch();
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
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">員工管理</h1>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">員工管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理所有員工的基本資料與狀態</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingWorker(null)} size="sm">
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
                  <Input id="name" name="name" defaultValue={editingWorker?.name} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">電話 *</Label>
                  <Input id="phone" name="phone" defaultValue={editingWorker?.phone} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" defaultValue={editingWorker?.email} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="note">備註</Label>
                  <Textarea id="note" name="note" defaultValue={editingWorker?.note} />
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

      {/* 搜尋與篩選 */}
      <Card className="mb-6 shadow-sm border-border/60">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋姓名、電話、Email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => setStatusFilter(value === "all" ? undefined : value as "active" | "inactive")}
            >
              <SelectTrigger className="w-[140px] h-9">
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

      {/* 員工列表 */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">員工列表</CardTitle>
            <span className="text-xs text-muted-foreground">{workers?.length || 0} 位員工</span>
          </div>
        </CardHeader>
        <CardContent>
          {!workers || workers.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">無員工資料</div>
          ) : (
            <div className="space-y-2">
              {workers.map((worker) => (
                <div
                  key={worker.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{worker.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          worker.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-gray-50 text-gray-500 border-gray-200"
                        }`}
                      >
                        {worker.status === "active" ? "啟用" : "停用"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {worker.phone}
                      </span>
                      {worker.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {worker.email}
                        </span>
                      )}
                    </div>
                    {worker.note && (
                      <div className="text-xs text-muted-foreground mt-1">{worker.note}</div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditingWorker(worker);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${
                        worker.status === "active"
                          ? "text-muted-foreground hover:text-destructive"
                          : "text-muted-foreground hover:text-emerald-600"
                      }`}
                      onClick={() => setConfirmToggleWorker(worker)}
                      disabled={updateMutation.isPending}
                    >
                      {worker.status === "active" ? (
                        <UserX className="h-3.5 w-3.5" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5" />
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
