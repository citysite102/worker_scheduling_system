import { ClientPortalLayout } from "@/components/ClientPortalLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { FileText, Plus } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ClientDemands() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = trpc.demands.list.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    page: currentPage,
    pageSize,
  });

  const demands = data?.demands || [];
  const pagination = data?.pagination;

  return (
    <ClientPortalLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">需求管理</h1>
            <p className="text-muted-foreground mt-1">
              管理您的用工需求單
            </p>
          </div>
          <Link href="/client-portal/demands/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              建立需求單
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>需求單列表</CardTitle>
              <div className="flex items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="篩選狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部狀態</SelectItem>
                    <SelectItem value="pending">待審核</SelectItem>
                    <SelectItem value="confirmed">已確認</SelectItem>
                    <SelectItem value="assigned">進行中</SelectItem>
                    <SelectItem value="completed">已完成</SelectItem>
                    <SelectItem value="cancelled">已取消</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                  <p className="text-muted-foreground">載入中...</p>
                </div>
              </div>
            ) : demands.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {statusFilter === "all"
                    ? "尚無需求單"
                    : `尚無${
                        statusFilter === "pending"
                          ? "待審核"
                          : statusFilter === "confirmed"
                          ? "已確認"
                          : statusFilter === "assigned"
                          ? "進行中"
                          : statusFilter === "completed"
                          ? "已完成"
                          : "已取消"
                      }的需求單`}
                </p>
                <Link href="/client-portal/demands/create">
                  <Button variant="outline" size="sm" className="mt-4">
                    建立需求單
                  </Button>
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {demands.map((demand) => (
                    <Link
                      key={demand.id}
                      href={`/client-portal/demands/${demand.id}`}
                    >
                      <div className="flex items-center justify-between rounded-lg border p-4 hover:bg-accent transition-colors cursor-pointer">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {new Date(demand.date).toLocaleDateString(
                                "zh-TW",
                                {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  weekday: "long",
                                }
                              )}
                            </p>
                            <span className="text-sm text-muted-foreground">
                              {demand.startTime} - {demand.endTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>需求人數：{demand.requiredWorkers} 人</span>
                            <span>已指派：{demand.assignedCount} 人</span>
                            {demand.location && (
                              <span>地點：{demand.location}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              demand.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : demand.status === "confirmed"
                                ? "bg-blue-100 text-blue-800"
                                : demand.status === "assigned"
                                ? "bg-purple-100 text-purple-800"
                                : demand.status === "completed"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {demand.status === "pending"
                              ? "待審核"
                              : demand.status === "confirmed"
                              ? "已確認"
                              : demand.status === "assigned"
                              ? "進行中"
                              : demand.status === "completed"
                              ? "已完成"
                              : demand.status === "cancelled"
                              ? "已取消"
                              : demand.status}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* 分頁 */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      第 {pagination.currentPage} / {pagination.totalPages} 頁，共{" "}
                      {pagination.total} 筆
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        上一頁
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentPage === pagination.totalPages}
                        onClick={() =>
                          setCurrentPage((p) =>
                            Math.min(pagination.totalPages, p + 1)
                          )
                        }
                      >
                        下一頁
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </ClientPortalLayout>
  );
}
