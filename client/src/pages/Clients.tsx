import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Building2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  const { data: clients, isLoading, refetch } = trpc.clients.list.useQuery({
    search: searchTerm,
    status: statusFilter,
  });

  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      toast.success("客戶新增成功");
      setIsDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`新增失敗：${error.message}`);
    },
  });

  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      toast.success("客戶資料更新成功");
      setIsDialogOpen(false);
      setEditingClient(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      contactName: (formData.get("contactName") as string) || undefined,
      contactPhone: (formData.get("contactPhone") as string) || undefined,
      contactEmail: (formData.get("contactEmail") as string) || undefined,
      address: (formData.get("address") as string) || undefined,
      billingType: (formData.get("billingType") as "hourly" | "fixed" | "custom") || undefined,
      note: (formData.get("note") as string) || undefined,
    };

    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleStatusToggle = (client: any) => {
    const newStatus = client.status === "active" ? "inactive" : "active";
    updateMutation.mutate({
      id: client.id,
      status: newStatus,
    });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">客戶管理</h1>
        <div className="text-muted-foreground">載入中...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">客戶管理</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingClient(null)}>
              <Plus className="mr-2 h-4 w-4" />
              新增客戶
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingClient ? "編輯客戶" : "新增客戶"}</DialogTitle>
                <DialogDescription>填寫客戶基本資料</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">客戶名稱 *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={editingClient?.name}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="contactName">聯絡人</Label>
                    <Input
                      id="contactName"
                      name="contactName"
                      defaultValue={editingClient?.contactName}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contactPhone">聯絡電話</Label>
                    <Input
                      id="contactPhone"
                      name="contactPhone"
                      defaultValue={editingClient?.contactPhone}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactEmail">聯絡 Email</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    defaultValue={editingClient?.contactEmail}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">地址</Label>
                  <Input
                    id="address"
                    name="address"
                    defaultValue={editingClient?.address}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="billingType">計費方式</Label>
                  <Select name="billingType" defaultValue={editingClient?.billingType || "hourly"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">時薪制</SelectItem>
                      <SelectItem value="fixed">固定費用</SelectItem>
                      <SelectItem value="custom">自訂</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="note">備註</Label>
                  <Textarea
                    id="note"
                    name="note"
                    defaultValue={editingClient?.note}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingClient ? "更新" : "新增"}
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
                placeholder="搜尋客戶名稱、聯絡人、電話..."
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
          <CardTitle>客戶列表 ({clients?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!clients || clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">無客戶資料</div>
          ) : (
            <div className="space-y-3">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <Building2 className="h-5 w-5 text-muted-foreground mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{client.name}</span>
                        <Badge variant={client.status === "active" ? "default" : "secondary"}>
                          {client.status === "active" ? "啟用" : "停用"}
                        </Badge>
                        <Badge variant="outline">
                          {client.billingType === "hourly" && "時薪制"}
                          {client.billingType === "fixed" && "固定費用"}
                          {client.billingType === "custom" && "自訂"}
                        </Badge>
                      </div>
                      {client.contactName && (
                        <div className="text-sm text-muted-foreground mt-1">
                          聯絡人：{client.contactName}
                          {client.contactPhone && ` · ${client.contactPhone}`}
                        </div>
                      )}
                      {client.address && (
                        <div className="text-sm text-muted-foreground mt-1">{client.address}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingClient(client);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={client.status === "active" ? "destructive" : "default"}
                      size="sm"
                      onClick={() => handleStatusToggle(client)}
                    >
                      {client.status === "active" ? "停用" : "啟用"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
