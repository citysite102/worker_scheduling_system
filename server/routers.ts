import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import * as logic from "./businessLogic";
import crypto from "crypto";
import { recognizeWorkPermit } from "./gemini-ocr";
import { storagePut } from "./storage";

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
        uiNumber: z.string().optional(),
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
          uiNumber: z.string().optional(),
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
        dayStart.setHours(0, 0, 0, 0);
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
      }).optional())
      .query(async ({ input }) => {
        const demands = await db.getAllDemands(input?.status, input?.date);
        
        // 附加客戶資訊與已指派人數
        const result = await Promise.all(
          demands.map(async (demand) => {
            const client = await db.getClientById(demand.clientId);
            const assignments = await db.getAssignmentsByDemand(demand.id);
            const assignedCount = assignments.filter(a => a.status !== "cancelled").length;
            
            return {
              ...demand,
              client,
              assignedCount,
            };
          })
        );
        
        return result;
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
            const assignments = await db.getAssignmentsByDemand(demand.id);
            const assignedCount = assignments.filter(a => a.status !== "cancelled").length;
            
            // 獲取已指派的員工資訊
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
      .query(async ({ input }) => {
        const demand = await db.getDemandById(input.id);
        if (!demand) throw new Error("需求單不存在");
        
        const client = await db.getClientById(demand.clientId);
        const assignments = await db.getAssignmentsByDemand(demand.id);
        
        return {
          ...demand,
          client,
          assignments,
        };
      }),

    create: publicProcedure
      .input(z.object({
        clientId: z.number(),
        date: z.date(),
        startTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式應為 HH:mm"),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式應為 HH:mm"),
        requiredWorkers: z.number().min(1, "需求人數至少為 1"),
        breakHours: z.number().min(0, "休息時間不可為負數").optional(), // 以小時為單位，如 0.5, 1, 1.5
        location: z.string().optional(),
        note: z.string().optional(),
        status: z.enum(["draft", "confirmed", "cancelled", "closed"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { breakHours, ...rest } = input;
        await db.createDemand({
          ...rest,
          breakHours: breakHours ? Math.round(breakHours * 60) : 0, // 轉換為分鐘
        });
        return { success: true };
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
        location: z.string().optional(),
        note: z.string().optional(),
        status: z.enum(["draft", "confirmed", "cancelled", "closed"]).optional(),
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
        const actualStart = new Date(demand.date);
        const [startHour, startMin] = input.actualStartTime.split(":").map(Number);
        actualStart.setHours(startHour, startMin, 0, 0);
        
        const actualEnd = new Date(demand.date);
        const [endHour, endMin] = input.actualEndTime.split(":").map(Number);
        actualEnd.setHours(endHour, endMin, 0, 0);
        
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
        
        // 檢查該需求單的所有 assignment 是否都已回填實際工時
        const allAssignments = await db.getAssignmentsByDemand(assignment.demandId);
        const allCompleted = allAssignments.every(a => 
          a.status === "completed" || a.status === "disputed"
        );
        
        // 如果所有 assignment 都已完成，自動將需求單狀態改為「已結案」
        if (allCompleted && allAssignments.length > 0) {
          await db.updateDemand(assignment.demandId, { status: "closed" });
        }
        
        return { success: true, status, demandClosed: allCompleted };
      }),

    create: publicProcedure
      .input(z.object({
        demandId: z.number(),
        workerId: z.number(),
        scheduledStart: z.date(),
        scheduledEnd: z.date(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // 驗證：結束時間必須晚於開始時間
        if (input.scheduledEnd <= input.scheduledStart) {
          throw new Error("結束時間必須晚於開始時間，請檢查時間設定。");
        }
        
        // 最終檢查：確認無衝突
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
            // 最終檢查
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
            });
            
            successCount.value++;
          } catch (error) {
            const worker = await db.getWorkerById(workerId);
            errors.push(`員工「${worker?.name}」指派失敗`);
          }
        }
        
        // 自動狀態更新：檢查是否達到需求人數
        const demand = await db.getDemandById(input.demandId);
        if (demand && demand.status === "draft") {
          const assignments = await db.getAssignmentsByDemand(input.demandId);
          const activeAssignments = assignments.filter(a => a.status !== "cancelled");
          
          // 如果已指派人數達到需求人數，自動改為已確認
          if (activeAssignments.length >= demand.requiredWorkers) {
            await db.updateDemand(input.demandId, { status: "confirmed" });
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
        endDate.setHours(23, 59, 59, 999);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        startDate.setHours(0, 0, 0, 0);

        const assignments = await db.getAssignmentsByDateRange(startDate, endDate);
        const activeAssignments = assignments.filter(a => a.status !== "cancelled");

        // 按日期分組
        const dailyMap: Record<string, number> = {};
        for (let i = 0; i < days; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          dailyMap[key] = 0;
        }

        for (const a of activeAssignments) {
          const d = new Date(a.scheduledStart);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
        endDate.setHours(23, 59, 59, 999);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        startDate.setHours(0, 0, 0, 0);

        const allDemands = await db.getAllDemands();
        const filteredDemands = allDemands.filter(d => {
          const demandDate = new Date(d.date);
          return demandDate >= startDate && demandDate <= endDate;
        });

        // 按日期分組
        const dailyMap: Record<string, number> = {};
        for (let i = 0; i < days; i++) {
          const d = new Date(startDate);
          d.setDate(d.getDate() + i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          dailyMap[key] = 0;
        }

        for (const demand of filteredDemands) {
          const d = new Date(demand.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
        endDate.setHours(23, 59, 59, 999);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days + 1);
        startDate.setHours(0, 0, 0, 0);

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
});

export type AppRouter = typeof appRouter;
