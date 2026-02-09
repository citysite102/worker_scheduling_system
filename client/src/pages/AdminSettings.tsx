import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, Copy, Plus, Trash2, ShieldCheck, UserMinus, KeyRound, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminSettings() {
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUseDialog, setShowUseDialog] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [confirmRemoveAdmin, setConfirmRemoveAdmin] = useState<any>(null);
  const [confirmRevokeInvite, setConfirmRevokeInvite] = useState<any>(null);

  const isAdmin = user?.role === "admin";

  const { data: invites, isLoading: invitesLoading, refetch: refetchInvites } = trpc.admin.listInvites.useQuery(
    undefined,
    { enabled: isAdmin }
  );
  const { data: admins, isLoading: adminsLoading, refetch: refetchAdmins } = trpc.admin.listAdmins.useQuery(
    undefined,
    { enabled: isAdmin }
  );

  const createInviteMutation = trpc.admin.createInvite.useMutation({
    onSuccess: (data) => {
      setGeneratedCode(data.code);
      refetchInvites();
    },
    onError: (error) => {
      toast.error(`建立失敗：${error.message}`);
    },
  });

  const useInviteMutation = trpc.admin.useInvite.useMutation({
    onSuccess: () => {
      toast.success("已成功使用邀請碼，您現在是管理員了！請重新整理頁面。");
      setShowUseDialog(false);
      setInviteCode("");
    },
    onError: (error) => {
      toast.error(`使用失敗：${error.message}`);
    },
  });

  const revokeInviteMutation = trpc.admin.revokeInvite.useMutation({
    onSuccess: () => {
      toast.success("已撤銷邀請碼");
      setConfirmRevokeInvite(null);
      refetchInvites();
    },
    onError: (error) => {
      toast.error(`撤銷失敗：${error.message}`);
    },
  });

  const removeAdminMutation = trpc.admin.removeAdmin.useMutation({
    onSuccess: () => {
      toast.success("已移除管理員權限");
      setConfirmRemoveAdmin(null);
      refetchAdmins();
    },
    onError: (error) => {
      toast.error(`移除失敗：${error.message}`);
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已複製到剪貼簿");
  };

  if (!user) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="text-center py-12 text-muted-foreground">請先登入</div>
      </div>
    );
  }

  // 非管理員：顯示輸入邀請碼介面
  if (!isAdmin) {
    return (
      <div className="p-6 lg:p-8 max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">管理員設定</h1>
          <p className="text-sm text-muted-foreground mt-1">使用邀請碼成為管理員</p>
        </div>

        <Card className="shadow-sm border-border/60">
          <CardHeader>
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              輸入邀請碼
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                如果您收到管理員邀請碼，請在下方輸入以取得管理員權限。
              </p>
              <div className="grid gap-2">
                <Label htmlFor="inviteCode">邀請碼</Label>
                <Input
                  id="inviteCode"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="請輸入邀請碼"
                />
              </div>
              <Button
                onClick={() => useInviteMutation.mutate({ code: inviteCode })}
                disabled={!inviteCode || useInviteMutation.isPending}
                className="w-full"
              >
                {useInviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                使用邀請碼
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 管理員介面
  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">管理員設定</h1>
          <p className="text-sm text-muted-foreground mt-1">管理邀請碼與管理員權限</p>
        </div>
        <Button size="sm" onClick={() => { setGeneratedCode(""); setShowCreateDialog(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          產生邀請碼
        </Button>
      </div>

      {/* 管理員列表 */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              管理員列表
            </CardTitle>
            <span className="text-xs text-muted-foreground">{admins?.length || 0} 位管理員</span>
          </div>
        </CardHeader>
        <CardContent>
          {adminsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !admins || admins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">無管理員</div>
          ) : (
            <div className="space-y-2">
              {admins.map((admin: any) => (
                <div key={admin.id} className="flex items-center justify-between p-3.5 rounded-lg border border-border/60">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{admin.name || "未命名"}</div>
                      <div className="text-xs text-muted-foreground">{admin.email || admin.openId}</div>
                    </div>
                  </div>
                  {admin.id !== user.id && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmRemoveAdmin(admin)}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 邀請碼列表 */}
      <Card className="shadow-sm border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              邀請碼紀錄
            </CardTitle>
            <span className="text-xs text-muted-foreground">{invites?.length || 0} 筆紀錄</span>
          </div>
        </CardHeader>
        <CardContent>
          {invitesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !invites || invites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">尚無邀請碼紀錄</div>
          ) : (
            <div className="space-y-2">
              {invites.map((invite: any) => (
                <div key={invite.id} className="flex items-center justify-between p-3.5 rounded-lg border border-border/60">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                        {invite.code.slice(0, 8)}...
                      </code>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          invite.status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : invite.status === "used"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : invite.status === "expired"
                            ? "bg-gray-50 text-gray-500 border-gray-200"
                            : "bg-red-50 text-red-600 border-red-200"
                        }`}
                      >
                        {invite.status === "active" && "有效"}
                        {invite.status === "used" && "已使用"}
                        {invite.status === "expired" && "已過期"}
                        {invite.status === "revoked" && "已撤銷"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      建立於 {new Date(invite.createdAt).toLocaleString("zh-TW")}
                      {invite.expiresAt && ` · 到期 ${new Date(invite.expiresAt).toLocaleDateString("zh-TW")}`}
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0 ml-3">
                    {invite.status === "active" && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => copyToClipboard(invite.code)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmRevokeInvite(invite)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 產生邀請碼 Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>產生邀請碼</DialogTitle>
            <DialogDescription>
              產生一組邀請碼，分享給您想邀請的管理員。邀請碼有效期為 7 天，使用一次後即失效。
            </DialogDescription>
          </DialogHeader>
          {generatedCode ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground mb-2 block">邀請碼</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono break-all">{generatedCode}</code>
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(generatedCode)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                請將此邀請碼傳送給對方，對方登入後在「管理員設定」頁面輸入即可成為管理員。
              </p>
            </div>
          ) : (
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                點擊下方按鈕產生一組新的邀請碼。
              </p>
            </div>
          )}
          <DialogFooter>
            {generatedCode ? (
              <Button onClick={() => setShowCreateDialog(false)}>完成</Button>
            ) : (
              <Button
                onClick={() => createInviteMutation.mutate({})}
                disabled={createInviteMutation.isPending}
              >
                {createInviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                產生邀請碼
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 撤銷邀請碼確認 */}
      <AlertDialog open={!!confirmRevokeInvite} onOpenChange={(open) => !open && setConfirmRevokeInvite(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認撤銷邀請碼</AlertDialogTitle>
            <AlertDialogDescription>
              撤銷後此邀請碼將無法使用。確定要撤銷嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmRevokeInvite && revokeInviteMutation.mutate({ id: confirmRevokeInvite.id })}>
              確認撤銷
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 移除管理員確認 */}
      <AlertDialog open={!!confirmRemoveAdmin} onOpenChange={(open) => !open && setConfirmRemoveAdmin(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認移除管理員</AlertDialogTitle>
            <AlertDialogDescription>
              確定要移除 <strong>{confirmRemoveAdmin?.name}</strong> 的管理員權限嗎？移除後對方將無法存取管理功能。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmRemoveAdmin && removeAdminMutation.mutate({ userId: confirmRemoveAdmin.id })}>
              確認移除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
