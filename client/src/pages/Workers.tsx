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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Edit, UserX, UserCheck, Loader2, Phone, Mail, GraduationCap, ShieldCheck, HeartPulse, Filter } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Workers() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | undefined>(undefined);
  const [schoolFilter, setSchoolFilter] = useState("");
  const [workPermitFilter, setWorkPermitFilter] = useState<boolean | undefined>(undefined);
  const [healthCheckFilter, setHealthCheckFilter] = useState<boolean | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<any>(null);
  const [confirmToggleWorker, setConfirmToggleWorker] = useState<any>(null);

  const { data: workers, isLoading, refetch } = trpc.workers.list.useQuery({
    search: searchTerm,
    status: statusFilter,
    school: schoolFilter || undefined,
    hasWorkPermit: workPermitFilter,
    hasHealthCheck: healthCheckFilter,
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
      school: (formData.get("school") as string) || undefined,
      hasWorkPermit: formData.get("hasWorkPermit") === "on",
      hasHealthCheck: formData.get("hasHealthCheck") === "on",
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

  const activeFilterCount = [schoolFilter, workPermitFilter !== undefined, healthCheckFilter !== undefined].filter(Boolean).length;

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
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingWorker(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingWorker(null)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              新增員工
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingWorker ? "編輯員工" : "新增員工"}</DialogTitle>
                <DialogDescription>填寫員工基本資料</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">姓名 *</Label>
                    <Input id="name" name="name" defaultValue={editingWorker?.name} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">電話 *</Label>
                    <Input id="phone" name="phone" defaultValue={editingWorker?.phone} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" defaultValue={editingWorker?.email} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="school">學校</Label>
                    <Input id="school" name="school" defaultValue={editingWorker?.school} placeholder="例：台大、政大" />
                  </div>
                </div>
                <div className="flex gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasWorkPermit"
                      name="hasWorkPermit"
                      defaultChecked={editingWorker?.hasWorkPermit === 1}
                    />
                    <Label htmlFor="hasWorkPermit" className="text-sm font-normal cursor-pointer">有工作簽證</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasHealthCheck"
                      name="hasHealthCheck"
                      defaultChecked={editingWorker?.hasHealthCheck === 1}
                    />
                    <Label htmlFor="hasHealthCheck" className="text-sm font-normal cursor-pointer">有體檢</Label>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="note">備註</Label>
                  <Textarea id="note" name="note" defaultValue={editingWorker?.note} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                placeholder="搜尋姓名、電話、Email、學校..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Select
              value={statusFilter || "all"}
              onValueChange={(value) => setStatusFilter(value === "all" ? undefined : value as "active" | "inactive")}
            >
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="active">啟用</SelectItem>
                <SelectItem value="inactive">停用</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-9 relative"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-1.5" />
              篩選
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border/60">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="學校篩選"
                  value={schoolFilter}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                  className="h-8 w-[160px] text-sm"
                />
              </div>
              <Select
                value={workPermitFilter === undefined ? "all" : workPermitFilter ? "yes" : "no"}
                onValueChange={(value) => setWorkPermitFilter(value === "all" ? undefined : value === "yes")}
              >
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="工作簽證" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">簽證：全部</SelectItem>
                  <SelectItem value="yes">有簽證</SelectItem>
                  <SelectItem value="no">無簽證</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={healthCheckFilter === undefined ? "all" : healthCheckFilter ? "yes" : "no"}
                onValueChange={(value) => setHealthCheckFilter(value === "all" ? undefined : value === "yes")}
              >
                <SelectTrigger className="w-[140px] h-8 text-sm">
                  <HeartPulse className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="體檢" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">體檢：全部</SelectItem>
                  <SelectItem value="yes">有體檢</SelectItem>
                  <SelectItem value="no">無體檢</SelectItem>
                </SelectContent>
              </Select>
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={() => {
                    setSchoolFilter("");
                    setWorkPermitFilter(undefined);
                    setHealthCheckFilter(undefined);
                  }}
                >
                  清除篩選
                </Button>
              )}
            </div>
          )}
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
                    <div className="flex items-center gap-2 flex-wrap">
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
                      {worker.hasWorkPermit === 1 && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          <ShieldCheck className="h-3 w-3 mr-1" />
                          簽證
                        </Badge>
                      )}
                      {worker.hasHealthCheck === 1 && (
                        <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">
                          <HeartPulse className="h-3 w-3 mr-1" />
                          體檢
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
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
                      {worker.school && (
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          {worker.school}
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
