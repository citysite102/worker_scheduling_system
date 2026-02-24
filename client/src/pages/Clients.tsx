import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Edit, Building2, Loader2, MapPin, Phone, User, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function Clients() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | undefined>(undefined);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string>("");

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
      logoUrl: logoUrl || undefined,
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
      <div className="p-6 lg:p-8 max-w-6xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">客戶管理</h1>
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
          <h1 className="text-2xl font-semibold text-foreground">客戶管理</h1>
          <p className="text-sm text-muted-foreground mt-1">管理所有客戶的基本資料與聯絡方式</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingClient(null)} size="sm">
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
                  <Input id="name" name="name" defaultValue={editingClient?.name} required />
                </div>
                {/* Logo 上傳 */}
                <div className="grid gap-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-4">
                    {logoUrl && (
                      <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded object-contain border" />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/*";
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            setLogoUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        };
                        input.click();
                      }}
                    >
                      {logoUrl ? "更換 Logo" : "上傳 Logo"}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="contactName">聯絡人</Label>
                    <Input id="contactName" name="contactName" defaultValue={editingClient?.contactName} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="contactPhone">聯絡電話</Label>
                    <Input id="contactPhone" name="contactPhone" defaultValue={editingClient?.contactPhone} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactEmail">聯絡 Email</Label>
                  <Input id="contactEmail" name="contactEmail" type="email" defaultValue={editingClient?.contactEmail} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">地址</Label>
                  <Input id="address" name="address" defaultValue={editingClient?.address} />
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
                  <Textarea id="note" name="note" defaultValue={editingClient?.note} />
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

      {/* 搜尋與篩選 */}
      <Card className="mb-6 shadow-sm border-border/60">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜尋客戶名稱、聯絡人、電話..."
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

      {/* 客戶列表 */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">客戶列表</CardTitle>
            <span className="text-xs text-muted-foreground">{clients?.length || 0} 位客戶</span>
          </div>
        </CardHeader>
        <CardContent>
          {!clients || clients.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">無客戶資料</div>
          ) : (
            <div className="space-y-2">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/60 hover:bg-muted/40 transition-colors cursor-pointer"
                  onClick={() => setLocation(`/clients/${client.id}`)}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden">
                      {client.logoUrl ? (
                        <img src={client.logoUrl} alt={client.name} className="w-full h-full object-contain" />
                      ) : (
                        <Building2 className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{client.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            client.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-gray-50 text-gray-500 border-gray-200"
                          }`}
                        >
                          {client.status === "active" ? "啟用" : "停用"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {client.billingType === "hourly" && "時薪制"}
                          {client.billingType === "fixed" && "固定費用"}
                          {client.billingType === "custom" && "自訂"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                        {client.contactName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {client.contactName}
                          </span>
                        )}
                        {client.contactPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {client.contactPhone}
                          </span>
                        )}
                        {client.address && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {client.address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingClient(client);
                        setIsDialogOpen(true);
                      }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-8 text-xs ${
                        client.status === "active"
                          ? "text-muted-foreground hover:text-destructive"
                          : "text-muted-foreground hover:text-emerald-600"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusToggle(client);
                      }}
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
