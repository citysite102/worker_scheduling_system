import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import * as db from "./db";
import { getDb } from "./db";
import * as logic from "./businessLogic";
import crypto from "crypto";
import { recognizeWorkPermit } from "./gemini-ocr";
import { storagePut } from "./storage";
import { hashPassword, generateRandomPassword, verifyPassword, generateResetToken } from "./password";
import { sendEmail, createNewAccountEmail, createResetPasswordEmail } from "./email";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),

    /**
     * 客戶使用者登入（Email + 密碼）
     */
    clientLogin: publicProcedure
      .input(z.object({
        email: z.string().email("請輸入有效的 Email"),
        password: z.string().min(1, "請輸入密碼"),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        // 查詢使用者
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, input.email))
          .limit(1);

        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email 或密碼錯誤" });
        }

        // 檢查角色是否為 client
        if (user.role !== "client") {
          throw new TRPCError({ code: "FORBIDDEN", message: "此帳號無法使用客戶登入" });
        }

        // 驗證密碼
        if (!user.password) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "帳號尚未設定密碼" });
        }

        const { verifyPassword } = await import("./password");
        const isPasswordValid = await verifyPassword(input.password, user.password);

        if (!isPasswordValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email 或密碼錯誤" });
        }

        // 建立 session cookie（使用與 OAuth 相同的機制）
        const { sdk } = await import("./_core/sdk");
        const { ONE_YEAR_MS } = await import("../shared/const");
        
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return {
          success: true,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            clientId: user.clientId,
            mustChangePassword: user.mustChangePassword === 1,
          },
        };
      }),

    /**
     * 修改密碼（需要登入）
     */
    changePassword: protectedProcedure
      .input(z.object({
        currentPassword: z.string().min(1, "請輸入目前密碼"),
        newPassword: z.string().min(8, "新密碼長度至少 8 個字元"),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入" });
        }

        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        // 查詢使用者
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);

        if (!user || !user.password) {
          throw new TRPCError({ code: "NOT_FOUND", message: "使用者不存在" });
        }

        // 驗證目前密碼
        const { verifyPassword, hashPassword } = await import("./password");
        const isPasswordValid = await verifyPassword(input.currentPassword, user.password);

        if (!isPasswordValid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "目前密碼錯誤" });
        }

        // 加密新密碼
        const hashedNewPassword = await hashPassword(input.newPassword);

        // 更新密碼，並移除 mustChangePassword 標記
        await db
          .update(users)
          .set({
            password: hashedNewPassword,
            mustChangePassword: 0,
          })
          .where(eq(users.id, ctx.user.id));

        return { success: true };
      }),

    /**
     * 忘記密碼（發送重設連結）
     */
    forgotPassword: publicProcedure
      .input(z.object({
        email: z.string().email("請輸入有效的 Email"),
        origin: z.string().optional(), // 前端 origin，用於建立重設連結
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        // 查詢使用者
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, input.email))
          .limit(1);

        // 即使使用者不存在，也返回成功（避免 Email 枚舉）
        if (!user || user.role !== "client") {
          return { success: true };
        }

        // 生成重設 token
        const { generateResetToken } = await import("./password");
        const resetToken = generateResetToken();
        const resetExpires = new Date(Date.now() + 3600000); // 1 小時後過期

        // 儲存 token
        await db
          .update(users)
          .set({
            passwordResetToken: resetToken,
            passwordResetExpires: resetExpires,
          })
          .where(eq(users.id, user.id));

        // 寄送 Email
        const resetUrl = `${input.origin || 'https://your-domain.com'}/client-portal/reset-password?token=${resetToken}`;
        const emailHtml = createResetPasswordEmail({
          email: input.email,
          resetUrl,
          expiresIn: '1 小時',
        });
        
        const emailSent = await sendEmail({
          to: input.email,
          subject: '重設密碼請求 - 員工排班系統',
          html: emailHtml,
        });
        
        if (!emailSent) {
          // 如果 Email 發送失敗，在 console 顯示重設連結
          console.log(`[忘記密碼] Email: ${input.email}, 重設連結: ${resetUrl}`);
        }

        return { success: true };
      }),

    /**
     * 重設密碼
     */
    resetPassword: publicProcedure
      .input(z.object({
        token: z.string().min(1, "請提供重設 token"),
        newPassword: z.string().min(8, "新密碼長度至少 8 個字元"),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });

        // 查詢 token
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.passwordResetToken, input.token))
          .limit(1);

        if (!user) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "重設連結無效" });
        }

        // 檢查 token 是否過期
        if (!user.passwordResetExpires || new Date() > user.passwordResetExpires) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "重設連結已過期，請重新申請" });
        }

        // 加密新密碼
        const { hashPassword } = await import("./password");
        const hashedPassword = await hashPassword(input.newPassword);

        // 更新密碼，並清除 token
        await db
          .update(users)
          .set({
            password: hashedPassword,
            passwordResetToken: null,
            passwordResetExpires: null,
            mustChangePassword: 0,
          })
          .where(eq(users.id, user.id));

        return { success: true };
      }),

    /**
     * 完成 Onboarding
     */
    completeOnboarding: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入" });
        }
        const dbInstance = await getDb();
        if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        await dbInstance
          .update(users)
          .set({ onboardingCompleted: 1 })
          .where(eq(users.id, ctx.user.id));
        return { success: true };
      }),

    /**
     * 查詢 Onboarding 狀態
     */
    onboardingStatus: protectedProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入" });
        }
        const dbInstance = await getDb();
        if (!dbInstance) return { onboardingCompleted: true };
        const [userRow] = await dbInstance
          .select({ onboardingCompleted: users.onboardingCompleted })
          .from(users)
          .where(eq(users.id, ctx.user.id))
          .limit(1);
        return { onboardingCompleted: userRow?.onboardingCompleted === 1 };
      }),

    /**
     * 管理員專用：重置指定用戶的 Onboarding 狀態
     */
    resetOnboarding: protectedProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入" });
        }
        if (ctx.user.role !== "admin" && ctx.user.role !== "user") {
          throw new TRPCError({ code: "FORBIDDEN", message: "僅內部人員可執行此操作" });
        }
        const dbInstance = await getDb();
        if (!dbInstance) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "資料庫連線失敗" });
        await dbInstance
          .update(users)
          .set({ onboardingCompleted: 0 })
          .where(eq(users.id, input.userId));
        return { success: true };
      }),
  }),

  // ============ Workers ============
  workers: router({
    list: publicProcedure
      .input(z.object({
        status: z.enum(["active", "inactive"]).optional(),
        search: z.string().optional(),
        school: z.string().optional(),
        workPermitStatus: z.enum(["valid", "invalid", "none"]).optional(),
        hasHealthCheck: z.boolean().optional(),
      }).optional())
      .query(async ({ input }) => {
        const workers = await db.getAllWorkers(input ? {
          status: input.status,
          search: input.search,
          school: input.school,
          workPermitStatus: input.workPermitStatus,
          hasHealthCheck: input.hasHealthCheck,
        } : undefined);
        return workers;
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const worker = await db.getWorkerById(input.id);
        if (!worker) throw new Error("員工不存在");
        return worker;
      }),

    uploadWorkPermitImage: publicProcedure
      .input(z.object({
        imageBase64: z.string().min(1, "圖片資料不可為空"),
        mimeType: z.string().min(1, "圖片類型不可為空"),
      }))
      .mutation(async ({ input }) => {
        try {
          // 1. 上傳圖片到 S3
          const imageBuffer = Buffer.from(input.imageBase64, "base64");
          const randomSuffix = crypto.randomBytes(8).toString("hex");
          const fileKey = `work-permits/${Date.now()}-${randomSuffix}.jpg`;
          
          const { url: imageUrl } = await storagePut(
            fileKey,
            imageBuffer,
            input.mimeType
          );

          // 2. 使用 OCR 辨識圖片
          const ocrResult = await recognizeWorkPermit(imageUrl);

          // 3. 返回 OCR 結果和圖片 URL
          return {
            success: true,
            imageUrl,
            ocrResult,
          };
        } catch (error) {
          console.error("OCR 辨識錯誤：", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `OCR 辨識失敗：${error instanceof Error ? error.message : "未知錯誤"}`,
          });
        }
      }),

    batchUploadWorkPermitImages: publicProcedure
      .input(z.object({
        images: z.array(z.object({
          imageBase64: z.string().min(1, "圖片資料不可為空"),
          mimeType: z.string().min(1, "圖片類型不可為空"),
        })),
      }))
      .mutation(async ({ input }) => {
        const results = [];
        
        for (let i = 0; i < input.images.length; i++) {
          const image = input.images[i];
          try {
            // 1. 上傳圖片到 S3
            const imageBuffer = Buffer.from(image.imageBase64, "base64");
            const randomSuffix = crypto.randomBytes(8).toString("hex");
            const fileKey = `work-permits/${Date.now()}-${randomSuffix}.jpg`;
            
            const { url: imageUrl } = await storagePut(
              fileKey,
              imageBuffer,
              image.mimeType
            );

            // 2. 使用 OCR 辨識圖片
            const ocrResult = await recognizeWorkPermit(imageUrl);

            // 3. 記錄成功結果
            results.push({
              success: true,
              imageUrl,
              ocrResult,
              index: i,
            });
          } catch (error) {
            console.error(`OCR 辨識錯誤（第 ${i + 1} 張）：`, error);
            // 記錄失敗結果
            results.push({
              success: false,
              error: error instanceof Error ? error.message : "未知錯誤",
              index: i,
            });
          }
        }

        return {
          results,
          totalCount: input.images.length,
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length,
        };
      }),

    create: publicProcedure
      .input(z.object({
        name: z.string().min(1, "姓名不可為空"),
        phone: z.string().optional(),
        email: z.string().email("Email 格式不正確").optional(),
        school: z.string().optional(),
        nationality: z.string().optional(),
        idNumber: z.string().optional(),
        hasWorkPermit: z.boolean().optional(),
        hasHealthCheck: z.boolean().optional(),
        workPermitExpiryDate: z.date().optional(),
        attendanceNotes: z.string().optional(),
        lineId: z.string().optional(),
        whatsappId: z.string().optional(),
        avatarUrl: z.string().optional(),
        city: z.string().optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { hasWorkPermit, hasHealthCheck, ...rest } = input;
        
        // 驗證：如果沒有勾選「有工作簽證」，則不允許設定到期日
        if (!hasWorkPermit && input.workPermitExpiryDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "資料不一致：未勾選『有工作簽證』時，不可設定到期日",
          });
        }
        
        await db.createWorker({
          ...rest,
          hasWorkPermit: hasWorkPermit ? 1 : 0,
          hasHealthCheck: hasHealthCheck ? 1 : 0,
        });
        return { success: true };
      }),

    batchCreate: publicProcedure
      .input(z.object({
        workers: z.array(z.object({
          name: z.string().min(1, "姓名不可為空"),
          phone: z.string().optional(),
          email: z.string().email("Email 格式不正確").optional(),
          school: z.string().optional(),
          nationality: z.string().optional(),
          idNumber: z.string().optional(),
          hasWorkPermit: z.boolean().optional(),
          hasHealthCheck: z.boolean().optional(),
          workPermitExpiryDate: z.date().optional(),
          attendanceNotes: z.string().optional(),
          lineId: z.string().optional(),
          whatsappId: z.string().optional(),
          avatarUrl: z.string().optional(),
          city: z.string().optional(),
          note: z.string().optional(),
        })),
      }))
      .mutation(async ({ input }) => {
        const results = [];
        
        for (let i = 0; i < input.workers.length; i++) {
          const worker = input.workers[i];
          try {
            const { hasWorkPermit, hasHealthCheck, ...rest } = worker;
            
            // 驗證：如果沒有勾選「有工作簽證」，則不允許設定到期日
            if (!hasWorkPermit && worker.workPermitExpiryDate) {
              throw new Error("資料不一致：未勾選『有工作簽證』時，不可設定到期日");
            }
            
            await db.createWorker({
              ...rest,
              hasWorkPermit: hasWorkPermit ? 1 : 0,
              hasHealthCheck: hasHealthCheck ? 1 : 0,
            });
            results.push({
              success: true,
              index: i,
              name: worker.name,
            });
          } catch (error) {
            console.error(`建立員工錯誤（${worker.name}）：`, error);
            results.push({
              success: false,
              index: i,
              name: worker.name,
              error: error instanceof Error ? error.message : "未知錯誤",
            });
          }
        }

        return {
          results,
          totalCount: input.workers.length,
          successCount: results.filter(r => r.success).length,
          failureCount: results.filter(r => !r.success).length,
        };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1, "姓名不可為空").optional(),
        phone: z.string().optional(),
        email: z.string().email("Email 格式不正確").optional(),
        school: z.string().optional(),
        nationality: z.string().optional(),
        idNumber: z.string().optional(),
        lineId: z.string().optional(),
        whatsappId: z.string().optional(),
        hasWorkPermit: z.boolean().optional(),
        hasHealthCheck: z.boolean().optional(),
        workPermitExpiryDate: z.date().optional(),
        avatarUrl: z.string().optional(),
        city: z.string().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, hasWorkPermit, hasHealthCheck, ...data } = input;
        
        // 驗證：如果明確設定 hasWorkPermit = false，則不允許設定到期日
        if (hasWorkPermit === false && input.workPermitExpiryDate) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "資料不一致：未勾選『有工作簽證』時，不可設定到期日",
          });
        }
        
        const updateData: any = { ...data };
        if (hasWorkPermit !== undefined) updateData.hasWorkPermit = hasWorkPermit ? 1 : 0;
        if (hasHealthCheck !== undefined) updateData.hasHealthCheck = hasHealthCheck ? 1 : 0;
        await db.updateWorker(id, updateData);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "admin" && ctx.user.role !== "user") {
          throw new TRPCError({ code: "FORBIDDEN", message: "權限不足" });
        }
        // 檢查是否有進行中或未完成的指派記錄
        const activeAssignments = await db.getAssignmentsByWorker(input.id);
        const blockedCount = activeAssignments.filter(
          (a) => a.status === "assigned"
        ).length;
        if (blockedCount > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `此員工有 ${blockedCount} 筆進行中的指派，無法直接刪除。請先處理完成所有指派。`,
          });
        }
        await db.deleteWorker(input.id);
        return { success: true };
      }),

    // 員工詳情：包含基本資料、歷史指派、累計工時、排班紀錄
    detail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const worker = await db.getWorkerById(input.id);
        if (!worker) throw new TRPCError({ code: "NOT_FOUND", message: "員工不存在" });

        // 歷史指派（附帶需求單與客戶資訊）
        const assignmentHistory = await db.getWorkerAssignmentHistory(input.id);
        const enrichedAssignments = await Promise.all(
          assignmentHistory.map(async (a) => {
            const demand = await db.getDemandById(a.demandId);
            const client = demand ? await db.getClientById(demand.clientId) : null;
            return {
              ...a,
              // 將 actualStart/actualEnd timestamp 轉換為 UTC HH:mm 字串，供前端直接顯示
              actualStartTime: a.actualStart ? logic.formatTime(new Date(a.actualStart)) : null,
              actualEndTime: a.actualEnd ? logic.formatTime(new Date(a.actualEnd)) : null,
              demand: demand ? {
                id: demand.id,
                date: demand.date,
                startTime: demand.startTime,
                endTime: demand.endTime,
                location: demand.location,
              } : null,
              clientName: client?.name || "未知",
            };
          })
        );

        // 累計工時統計
        const completedAssignments = assignmentHistory.filter(a => a.status === "completed");
        const totalScheduledMinutes = assignmentHistory
          .filter(a => a.status !== "cancelled")
          .reduce((sum, a) => sum + (a.scheduledHours || 0), 0);
        const totalActualMinutes = completedAssignments
          .reduce((sum, a) => sum + (a.actualHours || 0), 0);
        const totalVarianceMinutes = completedAssignments
          .reduce((sum, a) => sum + (a.varianceHours || 0), 0);

        // 排班紀錄
        const availabilityHistory = await db.getWorkerAvailabilityHistory(input.id);
        const parsedAvailability = availabilityHistory.map((av) => {
          const blocks = JSON.parse(av.timeBlocks || "[]");
          return {
            id: av.id,
            weekStartDate: av.weekStartDate,
            weekEndDate: av.weekEndDate,
            confirmed: !!av.confirmedAt,
            confirmedAt: av.confirmedAt,
            days: blocks.map((b: any) => {
              let timeSlots = b.timeSlots;
              if (!timeSlots && b.startTime && b.endTime) {
                timeSlots = [{ startTime: b.startTime, endTime: b.endTime }];
              }
              return {
                dayOfWeek: b.dayOfWeek,
                timeSlots: timeSlots || [],
              };
            }),
          };
        });

        return {
          worker,
          assignments: enrichedAssignments,
          availability: parsedAvailability,
          stats: {
            totalAssignments: assignmentHistory.filter(a => a.status !== "cancelled").length,
            completedAssignments: completedAssignments.length,
            cancelledAssignments: assignmentHistory.filter(a => a.status === "cancelled").length,
            totalScheduledHours: +(totalScheduledMinutes / 60).toFixed(1),
            totalActualHours: +(totalActualMinutes / 60).toFixed(1),
            totalVarianceHours: +(totalVarianceMinutes / 60).toFixed(1),
          },
        };
      }),
  }),

  // ============ Clients ============
  clients: router({
    list: publicProcedure
      .input(z.object({
        status: z.enum(["active", "inactive"]).optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => {
        const clients = await db.getAllClients(input?.status, input?.search);
        return clients;
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const client = await db.getClientById(input.id);
        if (!client) throw new Error("客戶不存在");
        return client;
      }),

    getDetailById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const client = await db.getClientById(input.id);
        if (!client) throw new Error("客戶不存在");
        
        // 統計資料：總需求數、已關閉、進行中、已取消
        const allDemands = await db.getDemandsByClientId(input.id);
        const totalDemands = allDemands.length;
        const closedDemands = allDemands.filter((d: any) => d.status === "closed").length;
        const activeDemands = allDemands.filter((d: any) => d.status === "confirmed").length;
        const cancelledDemands = allDemands.filter((d: any) => d.status === "cancelled").length;
        
        return {
          ...client,
          stats: {
            totalDemands,
            closedDemands,
            activeDemands,
            cancelledDemands,
          },
        };
      }),

    create: publicProcedure
      .input(z.object({
        name: z.string().min(1, "客戶名稱不可為空"),
        contactName: z.string().optional(),
        contactEmail: z.string().email("Email 格式不正確").optional(),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
        logoUrl: z.string().optional(),
        billingType: z.enum(["hourly", "fixed", "custom"]).optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // 檢查客戶名稱是否已存在
        const existingClient = await db.getClientByName(input.name);
        if (existingClient) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `客戶名稱「${input.name}」已存在，請使用不同的名稱`,
          });
        }
        await db.createClient(input);
        return { success: true };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1, "客戶名稱不可為空").optional(),
        contactName: z.string().optional(),
        contactEmail: z.string().email("Email 格式不正確").optional(),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
        logoUrl: z.string().optional(),
        billingType: z.enum(["hourly", "fixed", "custom"]).optional(),
        status: z.enum(["active", "inactive"]).optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateClient(id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'user') {
          throw new TRPCError({ code: 'FORBIDDEN', message: '權限不足' });
        }
        // 檢查客戶是否存在
        const client = await db.getClientById(input.id);
        if (!client) {
          throw new TRPCError({ code: 'NOT_FOUND', message: '客戶不存在' });
        }
        // 檢查是否有關聯的需求單（避免誤刪有業務資料的客戶）
        const demands = await db.getDemandsByClientId(input.id);
        if (demands.length > 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `此客戶有 ${demands.length} 筆需求單，無法直接刪除。請先關閉或移除所有需求單後再刪除客戶。`,
          });
        }
        await db.deleteClient(input.id);
        return { success: true };
      }),

    // 客戶使用者管理 API
    listUsers: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        const users = await db.getClientUsers(input.clientId);
        return users;
      }),

    createUser: publicProcedure
      .input(z.object({
        clientId: z.number(),
        name: z.string().min(1, "姓名不可為空"),
        email: z.string().email("Email 格式不正確"),
        position: z.string().optional(),
        phone: z.string().optional(),
        origin: z.string().optional(), // 前端 origin，用於建立登入連結
      }))
      .mutation(async ({ input }) => {
        // 檢查 Email 是否已被使用
        const existingUser = await db.getUserByEmail(input.email);
        if (existingUser) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `此 Email（${input.email}）已被其他帳號使用，請改用其他 Email`,
          });
        }

        // 生成一個臨時的 openId（實際上應該由 OAuth 系統生成）
        const openId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        // 生成隨機密碼
        const randomPassword = generateRandomPassword();
        const hashedPassword = await hashPassword(randomPassword);
        
        // 建立使用者帳號
        await db.createClientUser({
          clientId: input.clientId,
          name: input.name,
          email: input.email,
          position: input.position,
          phone: input.phone,
          openId,
          password: hashedPassword,
          mustChangePassword: 1, // 首次登入必須修改密碼
        });
        
        // 寄送 Email 通知客戶
        const loginUrl = `${input.origin || 'https://your-domain.com'}/client-login`;
        const emailHtml = createNewAccountEmail({
          name: input.name,
          email: input.email,
          password: randomPassword,
          loginUrl,
        });
        
        const emailSent = await sendEmail({
          to: input.email,
          subject: '歡迎使用員工排班系統 - 您的帳號已建立',
          html: emailHtml,
        });
        
        if (!emailSent) {
          // 如果 Email 發送失敗，在 console 顯示密碼
          console.log(`[新增使用者] Email: ${input.email}, 密碼: ${randomPassword}`);
        }
        
        return { 
          success: true,
          // 測試用：返回密碼
          tempPassword: randomPassword,
        };
      }),

    updateUser: publicProcedure
      .input(z.object({
        userId: z.number(),
        name: z.string().optional(),
        email: z.string().email("Email 格式不正確").optional(),
        position: z.string().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { userId, ...data } = input;
        // 檢查新 Email 是否已被其他帳號使用
        if (data.email) {
          const existingUser = await db.getUserByEmail(data.email);
          if (existingUser && existingUser.id !== userId) {
            throw new TRPCError({
              code: "CONFLICT",
              message: `此 Email（${data.email}）已被其他帳號使用，請改用其他 Email`,
            });
          }
        }
        await db.updateClientUser(userId, data);
        return { success: true };
      }),

    deleteUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteClientUser(input.userId);
        return { success: true };
      }),
  }),

  // ============ Availability ============
  availability: router({
    getByWeek: publicProcedure
      .input(z.object({ workerId: z.number(), weekStart: z.date() }))
      .query(async ({ input }) => {
        const avail = await db.getAvailabilityByWorkerAndWeek(input.workerId, input.weekStart);
        if (!avail) return [];
        
        // 解析 timeBlocks JSON 為 dayOfWeek 與 timeSlots 結構
        const blocks = JSON.parse(avail.timeBlocks || "[]");
        const result = blocks.map((block: any) => {
          // 相容處理：舊格式的 timeBlocks 可能沒有 timeSlots 包裝
          let timeSlots = block.timeSlots;
          if (!timeSlots && block.startTime && block.endTime) {
            timeSlots = [{ startTime: block.startTime, endTime: block.endTime }];
          }
          return {
            id: avail.id,
            workerId: avail.workerId,
            weekStartDate: avail.weekStartDate,
            weekEndDate: avail.weekEndDate,
            dayOfWeek: block.dayOfWeek,
            timeSlots: timeSlots || [],
            confirmed: !!avail.confirmedAt,
            confirmedAt: avail.confirmedAt,
            createdAt: avail.createdAt,
            updatedAt: avail.updatedAt,
          };
        });
        
        return result;
      }),

    upsert: publicProcedure
      .input(z.object({
        workerId: z.number(),
        weekStart: z.date(),
        dayOfWeek: z.number().min(1).max(7),
        timeSlots: z.array(z.object({
          startTime: z.string(),
          endTime: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const { workerId, weekStart: rawWeekStart, dayOfWeek, timeSlots } = input;
        
        // 標準化 weekStart 為週一 UTC 00:00:00
        // 使用 Date.UTC 確保時區正確
        const rawDate = new Date(rawWeekStart);
        const weekStart = new Date(Date.UTC(
          rawDate.getUTCFullYear(),
          rawDate.getUTCMonth(),
          rawDate.getUTCDate(),
          0, 0, 0, 0
        ));
        
        // 計算 weekEnd
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        weekEnd.setUTCHours(23, 59, 59, 999);
        
        // 查詢現有記錄（使用 workerId + weekStart 查詢）
        const existingRecord = await db.getAvailabilityByWorkerAndWeek(workerId, weekStart);
        
        let blocks = [];
        if (existingRecord) {
          blocks = JSON.parse(existingRecord.timeBlocks || "[]");
        }
        
        // 更新或新增該日的時段
        const dayIndex = blocks.findIndex((b: any) => b.dayOfWeek === dayOfWeek);
        if (dayIndex >= 0) {
          blocks[dayIndex] = { dayOfWeek, timeSlots };
        } else {
          blocks.push({ dayOfWeek, timeSlots });
        }
        
        await db.upsertAvailability({
          workerId,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          timeBlocks: JSON.stringify(blocks),
          confirmedAt: null, // 修改排班時清除確認狀態，要求使用者重新確認
        });
        
        // 檢查排班時間變更後的衝突：查詢該員工在該週的所有已指派需求單
        const weekEndForQuery = new Date(weekEnd);
        const assignments = await db.getAssignmentsByWorker(workerId, weekStart, weekEndForQuery);
        const conflictingAssignments = [];
        
        for (const assignment of assignments) {
          if (assignment.status === "cancelled") continue;
          
          // 取得需求單資訊
          const demand = await db.getDemandById(assignment.demandId);
          if (!demand) continue;
          
          // 檢查是否在新的排班時間內
          const availabilityCheck = await logic.checkWorkerAvailability(
            workerId,
            new Date(demand.date),
            demand.startTime,
            demand.endTime
          );
          
          if (!availabilityCheck.available) {
            conflictingAssignments.push({
              assignmentId: assignment.id,
              demandId: demand.id,
              date: demand.date,
              time: `${demand.startTime}-${demand.endTime}`,
              reason: availabilityCheck.reason,
            });
          }
        }
        
        return { 
          success: true, 
          conflicts: conflictingAssignments.length > 0 ? conflictingAssignments : undefined,
        };
      }),

    confirm: publicProcedure
      .input(z.object({
        workerId: z.number(),
        weekStart: z.date(),
      }))
      .mutation(async ({ input }) => {
        const { workerId, weekStart: rawWeekStart } = input;
        
        // 標準化 weekStart 為 UTC 00:00:00
        const rawDate = new Date(rawWeekStart);
        const weekStart = new Date(Date.UTC(
          rawDate.getUTCFullYear(),
          rawDate.getUTCMonth(),
          rawDate.getUTCDate(),
          0, 0, 0, 0
        ));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
        weekEnd.setUTCHours(23, 59, 59, 999);
        
        const existingRecord = await db.getAvailabilityByWorkerAndWeek(workerId, weekStart);
        
        if (!existingRecord) {
          throw new Error("尚未設定排班時間設置");
        }
        
        // 更新確認時間 - 使用 SQL 直接更新所有符合條件的記錄
        const dbInstance = await db.getDb();
        if (!dbInstance) throw new Error("Database not available");
        
        const { availability } = await import("../drizzle/schema");
        const { and, eq, gte, lt } = await import("drizzle-orm");
        
        const dayStart = new Date(weekStart);
        dayStart.setUTCHours(0, 0, 0, 0); // 使用 UTC 避免伺服器本地時區影響
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 7);
        
        await dbInstance.update(availability)
          .set({ confirmedAt: new Date() })
          .where(
            and(
              eq(availability.workerId, workerId),
              gte(availability.weekStartDate, dayStart),
              lt(availability.weekStartDate, dayEnd)
            )
          );
        
        return { success: true };
      }),
  }),

  // ============ Demands ============
  demands: router({
    list: publicProcedure
      .input(z.object({
        status: z.string().optional(),
        date: z.date().optional(),
        clientId: z.number().optional(),
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
      }).optional())
      .query(async ({ input, ctx }) => {
        const page = input?.page || 1;
        const pageSize = input?.pageSize || 20;
        
        // 如果是客戶角色，只能查看自己的需求單
        let clientId = input?.clientId;
        if (ctx.user && ctx.user.role === 'client') {
          clientId = ctx.user.clientId || undefined;
        }
        
        // 獲取所有符合條件的需求單（不分頁）
        const allDemands = await db.getAllDemands(input?.status, input?.date, clientId);
        const total = allDemands.length;
        const totalPages = Math.ceil(total / pageSize);
        
        // 分頁擷取資料
        const offset = (page - 1) * pageSize;
        const demands = allDemands.slice(offset, offset + pageSize);
        
        return {
          demands,
          pagination: {
            total,
            totalPages,
            currentPage: page,
            pageSize,
          },
        };
      }),

    listByClientAndMonth: publicProcedure
      .input(z.object({
        clientId: z.number(),
        year: z.number(),
        month: z.number(), // 1-12
      }))
      .query(async ({ input }) => {
        // 計算月份的起始和結束日期
        const startDate = new Date(Date.UTC(input.year, input.month - 1, 1, 0, 0, 0, 0));
        const endDate = new Date(Date.UTC(input.year, input.month, 0, 23, 59, 59, 999));
        
        // 查詢該客戶在該月份的所有需求
        const allDemands = await db.getDemandsByClientId(input.clientId);
        const monthDemands = allDemands.filter((d: any) => {
          const demandDate = new Date(d.date);
          return demandDate >= startDate && demandDate <= endDate;
        });
        
        // 附加指派資訊
        const result = await Promise.all(
          monthDemands.map(async (demand: any) => {
            const allDemandAssignments = await db.getAssignmentsByDemand(demand.id);
            // 此查詢僅客戶端使用，過濾實習生指派
            const assignments = allDemandAssignments.filter(a => a.role !== 'intern');
            const assignedCount = assignments.filter(a => a.status !== "cancelled").length;
            
            // 獲取已指派的員工資訊（不包含實習生）
            const assignedWorkers = await Promise.all(
              assignments
                .filter(a => a.status !== "cancelled")
                .map(async (assignment) => {
                  const worker = await db.getWorkerById(assignment.workerId);
                  return {
                    id: worker?.id,
                    name: worker?.name,
                    assignmentId: assignment.id,
                  };
                })
            );
            
            return {
              ...demand,
              assignedCount,
              assignedWorkers,
            };
          })
        );
        
        return result;
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const demand = await db.getDemandById(input.id);
        if (!demand) throw new Error("需求單不存在");
        
        // 如果是客戶角色，只能查看自己的需求單
        if (ctx.user && ctx.user.role === 'client') {
          if (demand.clientId !== ctx.user.clientId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "您沒有權限查看此需求單" });
          }
        }
        
        const client = await db.getClientById(demand.clientId);
        const allAssignments = await db.getAssignmentsByDemand(demand.id);
        
        // 附加員工資訊，客戶端過濾敏感資料
        const isClientRole = ctx.user?.role === 'client';
        // 客戶端不顯示實習生指派
        const rawAssignments = isClientRole
          ? allAssignments.filter(a => a.role !== 'intern')
          : allAssignments;
        const assignments = await Promise.all(
          rawAssignments.map(async (assignment) => {
            const worker = await db.getWorkerById(assignment.workerId);
            const workerInfo = worker ? {
              id: worker.id,
              name: worker.name,
              school: worker.school,
              nationality: worker.nationality,
              hasWorkPermit: worker.hasWorkPermit,
              hasHealthCheck: worker.hasHealthCheck,
              avatarUrl: worker.avatarUrl,
              // 客戶端不暴露敏感聯絡資訊
              ...(isClientRole ? {} : {
                phone: worker.phone,
                email: worker.email,
                idNumber: worker.idNumber,
                lineId: worker.lineId,
                whatsappId: worker.whatsappId,
              }),
            } : null;
            return { ...assignment, worker: workerInfo };
          })
        );
        
        // 如果有需求類型，查詢需求類型與選項
        let demandType = null;
        let selectedOptions: any[] = [];
        if (demand.demandTypeId) {
          demandType = await db.getDemandTypeById(demand.demandTypeId);
          // 解析 selectedOptions JSON
          if (demand.selectedOptions) {
            try {
              const optionIds = JSON.parse(demand.selectedOptions);
              if (Array.isArray(optionIds) && optionIds.length > 0) {
                // 從 demandType.options 中篩選已勾選的選項
                selectedOptions = (demandType?.options || []).filter((opt: any) => optionIds.includes(opt.id));
              }
            } catch (e) {
              // JSON 解析失敗，忽略
            }
          }
        }
        
        return {
          ...demand,
          client,
          assignments,
          demandType,
          selectedOptions,
        };
      }),

    create: protectedProcedure
      .input(z.object({
        date: z.date(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式應為 HH:mm"),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式應為 HH:mm"),
        requiredWorkers: z.number().min(1, "需求人數至少為 1"),
        breakHours: z.number().min(0, "休息時間不可為負數").optional(), // 以小時為單位，如 0.5, 1, 1.5
        demandTypeId: z.number().optional(), // 需求類型 ID
        selectedOptions: z.string().optional(), // 已勾選的選項 ID（JSON 格式）
        location: z.string().optional(),
        note: z.string().optional(),
        status: z.enum(["draft", "confirmed", "cancelled", "closed"]).optional(),
        clientId: z.number().optional(), // Admin 代替客戶建立時使用
      }))
      .mutation(async ({ input, ctx }) => {
        // 決定 clientId：客戶角色從 ctx.user 取得，Admin 角色從 input 取得
        let clientId: number;
        if (ctx.user.role === 'client') {
          if (!ctx.user.clientId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "客戶帳號未關聯到客戶公司" });
          }
          clientId = ctx.user.clientId;
        } else if (ctx.user.role === 'admin' || ctx.user.role === 'user') {
          // Admin / User 代替客戶建立時，必須指定 clientId
          if (!input.clientId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "請指定要建立需求單的客戶 ID" });
          }
          clientId = input.clientId;
        } else {
          throw new TRPCError({ code: "FORBIDDEN", message: "無權限建立需求單" });
        }
        
        const { breakHours, clientId: _inputClientId, ...rest } = input;
        await db.createDemand({
          ...rest,
          clientId,
          breakHours: breakHours ? Math.round(breakHours * 60) : 0, // 轉換為分鐘
          createdBy: ctx.user.id, // 記錄建立者
          status: 'pending', // 客戶提交的需求單預設為 pending 狀態
        });
        return { success: true };
      }),

    // 批次建立需求單（多個日期）
    createBatch: protectedProcedure
      .input(z.object({
        dates: z.array(z.date()).min(1, "至少需要選擇一個日期"),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式應為 HH:mm"),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式應為 HH:mm"),
        requiredWorkers: z.number().min(1, "需求人數至少為 1"),
        breakHours: z.number().min(0, "休息時間不可為負數").optional(),
        demandTypeId: z.number().optional(),
        selectedOptions: z.string().optional(),
        location: z.string().optional(),
        note: z.string().optional(),
        status: z.enum(["draft", "confirmed", "cancelled", "closed"]).optional(),
        clientId: z.number().optional(), // Admin 代替客戶建立時使用
      }))
      .mutation(async ({ input, ctx }) => {
        // 決定 clientId：客戶角色從 ctx.user 取得，Admin 角色從 input 取得
        let clientId: number;
        if (ctx.user.role === 'client') {
          if (!ctx.user.clientId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "客戶帳號未關聯到客戶公司" });
          }
          clientId = ctx.user.clientId;
        } else if (ctx.user.role === 'admin' || ctx.user.role === 'user') {
          // Admin / User 代替客戶建立時，必須指定 clientId
          if (!input.clientId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "請指定要建立需求單的客戶 ID" });
          }
          clientId = input.clientId;
        } else {
          throw new TRPCError({ code: "FORBIDDEN", message: "無權限建立需求單" });
        }
        
        const { dates, breakHours, clientId: _inputClientId, ...rest } = input;
        
        // 批次建立需求單
        const results = await Promise.allSettled(
          dates.map(date => 
            db.createDemand({
              ...rest,
              date,
              clientId,
              breakHours: breakHours ? Math.round(breakHours * 60) : 0,
              createdBy: ctx.user.id,
              status: 'pending',
            })
          )
        );
        
        // 統計成功和失敗數量
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        return { 
          success: true, 
          total: dates.length,
          succeeded,
          failed,
        };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        clientId: z.number().optional(),
        date: z.date().optional(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式應為 HH:mm").optional(),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式應為 HH:mm").optional(),
        requiredWorkers: z.number().min(1, "需求人數至少為 1").optional(),
        breakHours: z.number().min(0, "休息時間不可為負數").optional(), // 以小時為單位
        demandTypeId: z.number().optional(), // 需求類型 ID
        selectedOptions: z.string().optional(), // 已勾選的選項 ID（JSON 格式）
        location: z.string().optional(),
        note: z.string().optional(),
        status: z.enum(["draft", "pending", "confirmed", "completed", "cancelled", "closed"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, breakHours, ...rest } = input;
        const updateData: any = { ...rest };
        if (breakHours !== undefined) {
          updateData.breakHours = Math.round(breakHours * 60); // 轉換為分鐘
        }
        await db.updateDemand(id, updateData);
        return { success: true };
      }),

    duplicate: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const originalDemand = await db.getDemandById(input.id);
        if (!originalDemand) throw new Error("需求單不存在");
        
        // 複製需求，狀態設為 draft
        const newDemand = await db.createDemand({
          clientId: originalDemand.clientId,
          date: originalDemand.date,
          startTime: originalDemand.startTime,
          endTime: originalDemand.endTime,
          requiredWorkers: originalDemand.requiredWorkers,
          breakHours: originalDemand.breakHours || 0, // 複製休息時間
          location: originalDemand.location || undefined,
          note: originalDemand.note ? `[複製] ${originalDemand.note}` : "[複製]",
          status: "draft",
        });
        
        return { success: true, newDemandId: newDemand.id };
      }),

    cancel: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const demand = await db.getDemandById(input.id);
        if (!demand) throw new Error("需求單不存在");
        
        // 將需求單狀態設為 cancelled
        await db.updateDemand(input.id, { status: "cancelled" });
        return { success: true };
      }),

    // 審核通過（將 pending 改為 confirmed）
    approve: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // 檢查是否為管理員
             if (ctx.user.role !== 'admin' && ctx.user.role !== 'user') {
          throw new TRPCError({ code: "FORBIDDEN", message: "只有內部人員可以審核需求單" });
        }
        
        const demand = await db.getDemandById(input.id);
        if (!demand) throw new TRPCError({ code: "NOT_FOUND", message: "需求單不存在" });
        
        // 只有 pending 狀態的需求單才可以審核
        if (demand.status !== 'pending') {
          throw new TRPCError({ code: "BAD_REQUEST", message: "只有待審核的需求單才可以審核" });
        }
        
        await db.updateDemand(input.id, { status: "confirmed" });
        return { success: true };
      }),

    // 審核拒絕（將 pending 改為 cancelled）
    reject: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        reason: z.string().optional(), // 拒絕原因（可選）
      }))
      .mutation(async ({ input, ctx }) => {
        // 檢查是否為管理員
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'user') {
          throw new TRPCError({ code: "FORBIDDEN", message: "只有內部人員可以審核需求單" });
        }
        
        const demand = await db.getDemandById(input.id);
        if (!demand) throw new TRPCError({ code: "NOT_FOUND", message: "需求單不存在" });
        
        // 只有 pending 狀態的需求單才可以審核
        if (demand.status !== 'pending') {
          throw new TRPCError({ code: "BAD_REQUEST", message: "只有待審核的需求單才可以審核" });
        }
        
        // 將需求單狀態設為 cancelled，並在 note 中記錄拒絕原因
        const note = input.reason ? `審核拒絕：${input.reason}` : '審核拒絕';
        await db.updateDemand(input.id, { 
          status: "cancelled",
          note: demand.note ? `${demand.note}\n${note}` : note,
        });
        return { success: true };
      }),

    // 批次審核通過
    batchApprove: protectedProcedure
      .input(z.object({ 
        ids: z.array(z.number()).min(1, "請至少選擇一筆需求單"),
      }))
      .mutation(async ({ input, ctx }) => {
        // 檢查是否為管理員
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'user') {
          throw new TRPCError({ code: "FORBIDDEN", message: "只有內部人員可以審核需求單" });
        }
        
        const results = {
          success: [] as number[],
          failed: [] as { id: number; reason: string }[],
        };
        
        // 逐一處理每個需求單
        for (const id of input.ids) {
          try {
            const demand = await db.getDemandById(id);
            if (!demand) {
              results.failed.push({ id, reason: "需求單不存在" });
              continue;
            }
            
            if (demand.status !== 'pending') {
              results.failed.push({ id, reason: "只有待審核的需求單才可以審核" });
              continue;
            }
            
            await db.updateDemand(id, { status: "confirmed" });
            results.success.push(id);
          } catch (error) {
            results.failed.push({ id, reason: error instanceof Error ? error.message : "未知錯誤" });
          }
        }
        
        return results;
      }),

    // 批次拒絕
    batchReject: protectedProcedure
      .input(z.object({ 
        ids: z.array(z.number()).min(1, "請至少選擇一筆需求單"),
        reason: z.string().optional(), // 拒絕原因（可選）
      }))
      .mutation(async ({ input, ctx }) => {
        // 檢查是否為管理員
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'user') {
          throw new TRPCError({ code: "FORBIDDEN", message: "只有內部人員可以審核需求單" });
        }
        
        const results = {
          success: [] as number[],
          failed: [] as { id: number; reason: string }[],
        };
        
        const note = input.reason ? `審核拒絕：${input.reason}` : '審核拒絕';
        
        // 逐一處理每個需求單
        for (const id of input.ids) {
          try {
            const demand = await db.getDemandById(id);
            if (!demand) {
              results.failed.push({ id, reason: "需求單不存在" });
              continue;
            }
            
            if (demand.status !== 'pending') {
              results.failed.push({ id, reason: "只有待審核的需求單才可以審核" });
              continue;
            }
            
            await db.updateDemand(id, { 
              status: "cancelled",
              note: demand.note ? `${demand.note}\n${note}` : note,
            });
            results.success.push(id);
          } catch (error) {
            results.failed.push({ id, reason: error instanceof Error ? error.message : "未知錯誤" });
          }
        }
        
        return results;
      }),

    // 手動結案（將 completed 改為 closed）
    close: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== 'admin' && ctx.user.role !== 'user') {
          throw new TRPCError({ code: "FORBIDDEN", message: "只有內部人員可以結案需求單" });
        }
        const demand = await db.getDemandById(input.id);
        if (!demand) throw new TRPCError({ code: "NOT_FOUND", message: "需求單不存在" });
        if (demand.status !== 'completed') {
          throw new TRPCError({ code: "BAD_REQUEST", message: "只有「已完成」的需求單才可以結案" });
        }
        await db.updateDemand(input.id, { status: "closed" });
        return { success: true };
      }),

    // 計算人力可行性
    feasibility: publicProcedure
      .input(z.object({
        demandId: z.number(),
        date: z.date(),
        startTime: z.string(),
        endTime: z.string(),
        requiredWorkers: z.number(),
      }))
      .query(async ({ input }) => {
        const result = await logic.calculateDemandFeasibility(
          input.demandId,
          input.date,
          input.startTime,
          input.endTime,
          input.requiredWorkers
        );
        
        return result;
      }),
  }),

  // ============ Assignments ============
  assignments: router({
    getByDemand: publicProcedure
      .input(z.object({ demandId: z.number() }))
      .query(async ({ input }) => {
        const assignments = await db.getAssignmentsByDemand(input.demandId);
        
        // 附加員工資訊
        const result = await Promise.all(
          assignments.map(async (assignment) => {
            const worker = await db.getWorkerById(assignment.workerId);
            return {
              ...assignment,
              worker,
            };
          })
        );
        
        return result;
      }),

    getByDateRange: publicProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        const assignments = await db.getAssignmentsByDateRange(input.startDate, input.endDate);
        
        // 附加員工與需求單資訊
        const result = await Promise.all(
          assignments.map(async (assignment) => {
            const worker = await db.getWorkerById(assignment.workerId);
            const demand = await db.getDemandById(assignment.demandId);
            const client = demand ? await db.getClientById(demand.clientId) : null;
            
            return {
              ...assignment,
              worker,
              demand: {
                ...demand,
                client,
              },
            };
          })
        );
        
        return result;
      }),

    listByDate: publicProcedure
      .input(z.object({ date: z.date() }))
      .query(async ({ input }) => {
        // 使用 UTC 方法設定日期範圍，避免時區問題
        const startOfDay = new Date(Date.UTC(
          input.date.getUTCFullYear(),
          input.date.getUTCMonth(),
          input.date.getUTCDate(),
          0, 0, 0, 0
        ));
        const endOfDay = new Date(Date.UTC(
          input.date.getUTCFullYear(),
          input.date.getUTCMonth(),
          input.date.getUTCDate(),
          23, 59, 59, 999
        ));
        
        const assignments = await db.getAssignmentsByDateRange(startOfDay, endOfDay);
        
        const result = await Promise.all(
          assignments.map(async (assignment) => {
            const worker = await db.getWorkerById(assignment.workerId);
            const demand = await db.getDemandById(assignment.demandId);
            const client = demand ? await db.getClientById(demand.clientId) : null;
            
            return {
              ...assignment,
              // 將 actualStart/actualEnd timestamp 轉換為 UTC HH:mm 字串，供前端直接顯示
              actualStartTime: assignment.actualStart ? logic.formatTime(new Date(assignment.actualStart)) : null,
              actualEndTime: assignment.actualEnd ? logic.formatTime(new Date(assignment.actualEnd)) : null,
              worker,
              demand: {
                ...demand,
                client,
              },
            };
          })
        );
        
        return result;
      }),
    fillActualTime: publicProcedure
      .input(z.object({
        assignmentId: z.number(),
        actualStartTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式應為 HH:mm"),
        actualEndTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式應為 HH:mm"),
      }))
      .mutation(async ({ input }) => {
        const assignment = await db.getAssignmentById(input.assignmentId);
        if (!assignment) throw new Error("排班記錄不存在");
        
        // 防止重複回填：如果已經有實際工時，不允許再次回填
        if (assignment.actualStart && assignment.actualEnd) {
          throw new Error("該排班記錄已經回填過實際工時，不可重複回填。如需修改，請先刪除原有記錄。");
        }
        
        const demand = await db.getDemandById(assignment.demandId);
        if (!demand) throw new Error("需求單不存在");
        
        // 計算實際工時
        // 使用 setUTCHours 避免伺服器時區影響
        // demand.date 是 UTC 時間，startTime/endTime 是台灣時間字串（HH:mm）
        // 前端指派時也用 setUTCHours，此處保持一致
        const actualStart = new Date(demand.date);
        const [startHour, startMin] = input.actualStartTime.split(":").map(Number);
        actualStart.setUTCHours(startHour, startMin, 0, 0);
        
        const actualEnd = new Date(demand.date);
        const [endHour, endMin] = input.actualEndTime.split(":").map(Number);
        actualEnd.setUTCHours(endHour, endMin, 0, 0);
        
        // 驗證：結束時間必須晚於開始時間
        if (actualEnd <= actualStart) {
          throw new Error("結束時間必須晚於開始時間，請檢查時間設定。");
        }
        
        const actualHours = logic.calculateMinutesBetween(actualStart, actualEnd);
        const varianceHours = actualHours - assignment.scheduledHours;
        
        // 檢查實際時間是否與其他排班衝突
        const conflicts = await logic.checkWorkerConflicts(
          assignment.workerId,
          actualStart,
          actualEnd,
          assignment.id
        );
        
        const status = conflicts.length > 0 ? "disputed" : "completed";
        
        await db.updateAssignment(input.assignmentId, {
          actualStart: actualStart,
          actualEnd: actualEnd,
          actualHours,
          varianceHours,
          status,
        });
        
        // 檢查該需求單是否有任何指派已完成回填（支援部分完成情境）
        const allAssignments = await db.getAssignmentsByDemand(assignment.demandId);
        const anyCompleted = allAssignments.some(a => 
          a.status === "completed" || a.status === "disputed"
        );
        
        // 只要有任何一筆回填完成，自動將需求單狀態改為「已完成」
        // 結案（closed）需要手動觸發（財務確認後）
        const currentDemand = await db.getDemandById(assignment.demandId);
        if (anyCompleted && currentDemand && currentDemand.status !== "closed" && currentDemand.status !== "cancelled") {
          await db.updateDemand(assignment.demandId, { status: "completed" });
        }
        
        return { success: true, status, demandCompleted: anyCompleted };
      }),

    create: publicProcedure
      .input(z.object({
        demandId: z.number(),
        workerId: z.number(),
        scheduledStart: z.date(),
        scheduledEnd: z.date(),
        role: z.enum(["regular", "intern"]).default("regular"),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // 驗證：結束時間必須晚於開始時間
        if (input.scheduledEnd <= input.scheduledStart) {
          throw new Error("結束時間必須晚於開始時間，請檢查時間設定。");
        }
        
        // 最終檢查：確認無衝突（正職與實習生都需要做時段衝突檢查）
        const conflicts = await logic.checkWorkerConflicts(
          input.workerId,
          input.scheduledStart,
          input.scheduledEnd
        );
        
        if (conflicts.length > 0) {
          const worker = await db.getWorkerById(input.workerId);
          throw new Error(`無法完成指派。員工「${worker?.name}」的時段已被指派於其他任務，請重新整理頁面或選擇其他員工。`);
        }
        
        const scheduledHours = logic.calculateMinutesBetween(input.scheduledStart, input.scheduledEnd);
        
        // 驗證：工時不能為負數
        if (scheduledHours < 0) {
          throw new Error("工時計算錯誤：結束時間早於開始時間。請聯繫管理員。");
        }
        
        await db.createAssignment({
          ...input,
          scheduledHours,
        });
        
        return { success: true };
      }),

    batchCreate: publicProcedure
      .input(z.object({
        demandId: z.number(),
        workerIds: z.array(z.number()),
        scheduledStart: z.date(),
        scheduledEnd: z.date(),
        role: z.enum(["regular", "intern"]).default("regular"),
      }))
      .mutation(async ({ input }) => {
        // 驗證：結束時間必須晚於開始時間
        if (input.scheduledEnd <= input.scheduledStart) {
          throw new Error("結束時間必須晚於開始時間，請檢查時間設定。");
        }
        
        const errors: string[] = [];
        const successCount = { value: 0 };
        
        for (const workerId of input.workerIds) {
          try {
            // 時段衝突檢查（正職與實習生都需要做）
            const conflicts = await logic.checkWorkerConflicts(
              workerId,
              input.scheduledStart,
              input.scheduledEnd
            );
            
            if (conflicts.length > 0) {
              const worker = await db.getWorkerById(workerId);
              errors.push(`員工「${worker?.name}」時段衝突`);
              continue;
            }
            
            const scheduledHours = logic.calculateMinutesBetween(input.scheduledStart, input.scheduledEnd);
            
            // 驗證：工時不能為負數
            if (scheduledHours < 0) {
              const worker = await db.getWorkerById(workerId);
              errors.push(`員工「${worker?.name}」工時計算錯誤`);
              continue;
            }
            
            await db.createAssignment({
              demandId: input.demandId,
              workerId,
              scheduledStart: input.scheduledStart,
              scheduledEnd: input.scheduledEnd,
              scheduledHours,
              role: input.role,
            });
            
            successCount.value++;
          } catch (error) {
            const worker = await db.getWorkerById(workerId);
            errors.push(`員工「${worker?.name}」指派失敗`);
          }
        }
        
        // 自動狀態更新：僅正職指派才影響需求單人數與狀態
        if (input.role === "regular") {
          const demand = await db.getDemandById(input.demandId);
          if (demand && demand.status === "draft") {
            const allAssignments = await db.getAssignmentsByDemand(input.demandId);
            // 只計算正職的有效指派
            const regularActiveCount = allAssignments.filter(
              a => a.status !== "cancelled" && (a.role === "regular" || a.role === null)
            ).length;
            
            if (regularActiveCount >= demand.requiredWorkers) {
              await db.updateDemand(input.demandId, { status: "confirmed" });
            }
          }
        }
        
        return {
          success: errors.length === 0,
          successCount: successCount.value,
          errors,
        };
      }),

    updateActualTime: publicProcedure
      .input(z.object({
        id: z.number(),
        actualStart: z.date(),
        actualEnd: z.date(),
      }))
      .mutation(async ({ input }) => {
        const assignment = await db.getAssignmentById(input.id);
        if (!assignment) throw new Error("排班記錄不存在");
        
        const actualHours = logic.calculateMinutesBetween(input.actualStart, input.actualEnd);
        const scheduledHours = assignment.scheduledHours || 0;
        const varianceHours = actualHours - scheduledHours;
        
        // 檢查實際工時是否與其他排班重疊
        const conflicts = await logic.checkWorkerConflicts(
          assignment.workerId || 0,
          input.actualStart,
          input.actualEnd,
          input.id
        );
        
        const status = conflicts.length > 0 ? "disputed" : "completed";
        
        await db.updateAssignment(input.id, {
          actualStart: input.actualStart,
          actualEnd: input.actualEnd,
          actualHours,
          varianceHours,
          status,
        });
        
        return {
          success: true,
          status,
          conflicts: conflicts.length,
        };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteAssignment(input.id);
        return { success: true };
      }),

    cancel: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const assignment = await db.getAssignmentById(input.id);
        if (!assignment) throw new TRPCError({ code: "NOT_FOUND", message: "指派記錄不存在" });
        
        // 更新狀態為 cancelled
        await db.updateAssignment(input.id, { status: "cancelled" });
        
        // 自動狀態更新：檢查是否所有指派都被取消
        const demand = await db.getDemandById(assignment.demandId);
        if (demand && demand.status === "confirmed") {
          const assignments = await db.getAssignmentsByDemand(assignment.demandId);
          const activeAssignments = assignments.filter(a => a.status !== "cancelled");
          
          // 如果所有指派都被取消，自動改回草稿
          if (activeAssignments.length === 0) {
            await db.updateDemand(assignment.demandId, { status: "draft" });
          }
        }
        
        return { success: true };
      }),
  }),

  // ============ Reports ============
  reports: router({
    // 員工薪資報表
    workerPayroll: publicProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        workerId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const assignments = await db.getAssignmentsByDateRange(input.startDate, input.endDate);
        
        // 只包含已完成的排班
        let completed = assignments.filter(a => a.status === "completed" && a.actualHours);
        
        // 如果指定了員工，過濾該員工的記錄
        if (input.workerId) {
          completed = completed.filter(a => a.workerId === input.workerId);
        }
        
        // 附加完整資訊
        const records = await Promise.all(
          completed.map(async (assignment) => {
            const worker = await db.getWorkerById(assignment.workerId);
            const demand = await db.getDemandById(assignment.demandId);
            const client = demand ? await db.getClientById(demand.clientId) : null;
            
            // 計算實際工時（分鐘）
            const actualMinutes = assignment.actualHours || 0;
            // 休息時間（分鐘）
            const breakMinutes = demand?.breakHours || 0;
            // 計薪工時 = 實際工時 - 休息時間
            const billableMinutes = Math.max(0, actualMinutes - breakMinutes);
            
            return {
              workerName: worker?.name || "",
              clientName: client?.name || "",
              demandDate: logic.formatDate(new Date(demand?.date || "")),
              actualStart: logic.formatTime(new Date(assignment.actualStart || "")),
              actualEnd: logic.formatTime(new Date(assignment.actualEnd || "")),
              actualHours: (actualMinutes / 60).toFixed(2),
              breakHours: (breakMinutes / 60).toFixed(2),
              billableHours: (billableMinutes / 60).toFixed(2),
              role: assignment.role || "regular",
            };
          })
        );
        
        return records;
      }),

    // 客戶工時報表（彙總格式）
    clientHours: publicProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
        clientId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const allDemands = await db.getAllDemands();
        // 如果指定了客戶，過濾該客戶的需求單
        const clientDemands = input.clientId 
          ? allDemands.filter(d => d.clientId === input.clientId)
          : allDemands;
        
        // 使用 Map 彙總：key = "clientId-workerId"
        const summaryMap = new Map<string, {
          clientId: number;
          clientName: string;
          workerId: number;
          workerName: string;
          totalMinutes: number;
        }>();
        
        for (const demand of clientDemands) {
          const assignments = await db.getAssignmentsByDemand(demand.id);
          const completed = assignments.filter(a => 
            a.status === "completed" && 
            a.actualHours &&
            new Date(a.actualStart || "") >= input.startDate &&
            new Date(a.actualEnd || "") <= input.endDate
          );
          
          for (const assignment of completed) {
            const worker = await db.getWorkerById(assignment.workerId);
            const client = await db.getClientById(demand.clientId);
            if (!worker || !client) continue;
            
            // 計算實際工時（分鐘）
            const actualMinutes = assignment.actualHours || 0;
            // 休息時間（分鐘）
            const breakMinutes = demand.breakHours || 0;
            // 計費工時 = 實際工時 - 休息時間
            const billableMinutes = Math.max(0, actualMinutes - breakMinutes);
            
            const key = `${client.id}-${worker.id}`;
            const existing = summaryMap.get(key);
            
            if (existing) {
              existing.totalMinutes += billableMinutes;
            } else {
              summaryMap.set(key, {
                clientId: client.id,
                clientName: client.name,
                workerId: worker.id,
                workerName: worker.name,
                totalMinutes: billableMinutes,
              });
            }
          }
        }
        
        // 轉換為陣列並計算小時
        const records = Array.from(summaryMap.values()).map(item => ({
          clientName: item.clientName,
          workerName: item.workerName,
          totalHours: (item.totalMinutes / 60).toFixed(2),
        }));
        
        // 排序：客戶名稱 → 員工名稱
        records.sort((a, b) => {
          if (a.clientName !== b.clientName) return a.clientName.localeCompare(b.clientName, "zh-TW");
          return a.workerName.localeCompare(b.workerName, "zh-TW");
        });
        
        return records;
      }),
  }),

  // ============ Dashboard Stats ============
  dashboard: router({
    // 每日派工人數趨勢（近 14 天）
    dailyAssignmentTrend: publicProcedure
      .input(z.object({ days: z.number().default(14) }).optional())
      .query(async ({ input }) => {
        const days = input?.days || 14;
        const endDate = new Date();
        endDate.setUTCHours(23, 59, 59, 999); // 使用 UTC
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        startDate.setUTCHours(0, 0, 0, 0); // 使用 UTC

        const assignments = await db.getAssignmentsByDateRange(startDate, endDate);
        const activeAssignments = assignments.filter(a => a.status !== "cancelled");

        // 按日期分組（使用 UTC 日期方法）
        const dailyMap: Record<string, number> = {};
        for (let i = 0; i < days; i++) {
          const d = new Date(startDate);
          d.setUTCDate(d.getUTCDate() + i);
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          dailyMap[key] = 0;
        }

        for (const a of activeAssignments) {
          const d = new Date(a.scheduledStart);
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          if (dailyMap[key] !== undefined) {
            dailyMap[key]++;
          }
        }

        return Object.entries(dailyMap).map(([date, count]) => ({ date, count }));
      }),

    // 合作單位需求趨勢（近 14 天）
    clientDemandTrend: publicProcedure
      .input(z.object({ days: z.number().default(14) }).optional())
      .query(async ({ input }) => {
        const days = input?.days || 14;
        const endDate = new Date();
        endDate.setUTCHours(23, 59, 59, 999); // 使用 UTC
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        startDate.setUTCHours(0, 0, 0, 0); // 使用 UTC

        const allDemands = await db.getAllDemands();
        const filteredDemands = allDemands.filter(d => {
          const demandDate = new Date(d.date);
          return demandDate >= startDate && demandDate <= endDate;
        });

        // 按日期分組（使用 UTC 日期方法）
        const dailyMap: Record<string, number> = {};
        for (let i = 0; i < days; i++) {
          const d = new Date(startDate);
          d.setUTCDate(d.getUTCDate() + i);
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          dailyMap[key] = 0;
        }

        for (const demand of filteredDemands) {
          const d = new Date(demand.date);
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
          if (dailyMap[key] !== undefined) {
            dailyMap[key] += demand.requiredWorkers;
          }
        }

        return Object.entries(dailyMap).map(([date, count]) => ({ date, count }));
      }),

    // 合作單位需求分布（圓餅圖）
    clientDemandDistribution: publicProcedure
      .input(z.object({ days: z.number().default(30) }).optional())
      .query(async ({ input }) => {
        const days = input?.days || 30;
        const endDate = new Date();
        endDate.setUTCHours(23, 59, 59, 999); // 使用 UTC
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        startDate.setUTCHours(0, 0, 0, 0); // 使用 UTC

        const allDemands = await db.getAllDemands();
        const filteredDemands = allDemands.filter(d => {
          const demandDate = new Date(d.date);
          return demandDate >= startDate && demandDate <= endDate;
        });

        // 按客戶分組
        const clientMap: Record<number, { name: string; count: number; workers: number }> = {};
        for (const demand of filteredDemands) {
          if (!clientMap[demand.clientId]) {
            const client = await db.getClientById(demand.clientId);
            clientMap[demand.clientId] = { name: client?.name || "未知", count: 0, workers: 0 };
          }
          clientMap[demand.clientId].count++;
          clientMap[demand.clientId].workers += demand.requiredWorkers;
        }

        return Object.entries(clientMap).map(([clientId, data]) => ({
          clientId: Number(clientId),
          clientName: data.name,
          demandCount: data.count,
          totalWorkers: data.workers,
        }));
      }),
  }),

  // ============ Admin Invites ============
  admin: router({
    // 產生邀請碼
    createInvite: publicProcedure
      .input(z.object({
        expiresInDays: z.number().min(1).max(30).default(7),
      }).optional())
      .mutation(async ({ ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入" });
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "僅限管理員" });

        const code = crypto.randomBytes(16).toString("hex");
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await db.createAdminInvite({
          code,
          createdBy: ctx.user.id,
          expiresAt,
        });

        return { code };
      }),

    // 使用邀請碼
    useInvite: publicProcedure
      .input(z.object({ code: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "請先登入" });

        const invite = await db.getAdminInviteByCode(input.code);
        if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "邀請碼不存在" });
        if (invite.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "邀請碼已使用或已過期" });
        if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
          await db.updateAdminInvite(invite.id, { status: "expired" });
          throw new TRPCError({ code: "BAD_REQUEST", message: "邀請碼已過期" });
        }

        // 將使用者升級為 admin
        await db.updateUserRole(ctx.user.id, "admin");
        await db.updateAdminInvite(invite.id, {
          usedBy: ctx.user.id,
          usedAt: new Date(),
          status: "used",
        });

        return { success: true };
      }),

    // 列出所有邀請碼
    listInvites: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

      const invites = await db.getAllAdminInvites();
      return invites;
    }),

    // 列出所有管理員
    listAdmins: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

      const admins = await db.getAllAdmins();
      return admins;
    }),

    // 撤銷邀請碼
    revokeInvite: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });

        await db.updateAdminInvite(input.id, { status: "revoked" });
        return { success: true };
      }),

    // 移除管理員權限
    removeAdmin: publicProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
        if (ctx.user.id === input.userId) throw new TRPCError({ code: "BAD_REQUEST", message: "不可移除自己的管理員權限" });

        await db.updateUserRole(input.userId, "user");
        return { success: true };
      }),
  }),

  // ============ DemandTypes ============
  demandTypes: router({
    // 取得所有需求類型（含選項）
    list: publicProcedure.query(async () => {
      const demandTypes = await db.getAllDemandTypes();
      return demandTypes;
    }),

    // 根據 ID 取得需求類型（含選項）
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const demandType = await db.getDemandTypeById(input.id);
        if (!demandType) throw new TRPCError({ code: "NOT_FOUND", message: "需求類型不存在" });
        return demandType;
      }),

    // 建立需求類型
    create: publicProcedure
      .input(z.object({
        name: z.string().min(1, "需求名稱不可為空"),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createDemandType({
          name: input.name,
          description: input.description || null,
        });
        return { id };
      }),

    // 更新需求類型
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1, "需求名稱不可為空").optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateDemandType(id, data);
        return { success: true };
      }),

    // 刪除需求類型
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDemandType(input.id);
        return { success: true };
      }),

    // 為需求類型新增選項
    createOption: publicProcedure
      .input(z.object({
        demandTypeId: z.number(),
        content: z.string().min(1, "選項內容不可為空"),
        sortOrder: z.number().default(0),
      }))
      .mutation(async ({ input }) => {
        const id = await db.createDemandTypeOption({
          demandTypeId: input.demandTypeId,
          content: input.content,
          sortOrder: input.sortOrder,
        });
        return { id };
      }),

    // 更新需求類型選項
    updateOption: publicProcedure
      .input(z.object({
        id: z.number(),
        content: z.string().min(1, "選項內容不可為空").optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateDemandTypeOption(id, data);
        return { success: true };
      }),

    // 刪除需求類型選項
    deleteOption: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteDemandTypeOption(input.id);
        return { success: true };
      }),

    // 批次更新選項排序
    updateOptionsOrder: publicProcedure
      .input(z.object({
        updates: z.array(z.object({
          id: z.number(),
          sortOrder: z.number(),
        })),
      }))
      .mutation(async ({ input }) => {
        await db.updateDemandTypeOptionsOrder(input.updates);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
