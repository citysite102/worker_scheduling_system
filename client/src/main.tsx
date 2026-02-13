import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // 針對網路錯誤自動重試最多 3 次
        if (error instanceof Error && error.message.includes("Failed to fetch")) {
          return failureCount < 3;
        }
        // 針對伺服器錯誤（HTML 返回）自動重試最多 2 次
        if (error instanceof TRPCClientError && error.message.includes("<!doctype")) {
          return failureCount < 2;
        }
        // 其他錯誤不重試
        return false;
      },
      retryDelay: (attemptIndex) => {
        // 指數退避：第一次重試 1 秒，第二次 2 秒，第三次 4 秒
        return Math.min(1000 * 2 ** attemptIndex, 4000);
      },
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

const showFriendlyErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return;

  // 網路連線錯誤
  if (error.message.includes("Failed to fetch")) {
    toast.error("網路連線失敗", {
      description: "請檢查您的網路連線，系統會自動重試...",
      duration: 3000,
    });
    return;
  }

  // 伺服器錯誤（返回 HTML 而不是 JSON）
  if (error.message.includes("<!doctype") || error.message.includes("not valid JSON")) {
    toast.error("伺服器暫時無法回應", {
      description: "系統正在重新連線，請稍候...",
      duration: 3000,
    });
    return;
  }

  // 其他錯誤
  if (error instanceof TRPCClientError) {
    // 不顯示未授權錯誤（會自動跳轉登入頁）
    if (error.message === UNAUTHED_ERR_MSG) return;

    toast.error("操作失敗", {
      description: error.message,
      duration: 4000,
    });
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    
    // 只在最後一次重試失敗時才顯示錯誤訊息
    const failureCount = event.query.state.fetchFailureCount || 0;
    const maxRetries = event.query.options.retry as number || 0;
    if (failureCount >= maxRetries) {
      showFriendlyErrorMessage(error);
    }
    
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    showFriendlyErrorMessage(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
