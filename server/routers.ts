import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import * as logic from "./businessLogic";

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
      }).optional())
      .query(async ({ input }) => {
        const workers = await db.getAllWorkers(input?.status, input?.search);
        return workers;
      }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const worker = await db.getWorkerById(input.id);
        if (!worker) throw new Error("員工不存在");
        return worker;
      }),

    create: publicProcedure
      .input(z.object({
        name: z.string().min(1, "姓名不可為空"),
        phone: z.string().min(1, "電話不可為空"),
        email: z.string().email("Email 格式不正確").optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createWorker(input);
        return { success: true };
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1, "姓名不可為空").optional(),
        phone: z.string().min(1, "電話不可為空").optional(),
        email: z.string().email("Email 格式不正確").optional(),
        status: z.enum(["active", "inactive"]).optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateWorker(id, data);
        return { success: true };
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

    create: publicProcedure
      .input(z.object({
        name: z.string().min(1, "客戶名稱不可為空"),
        contactName: z.string().optional(),
        contactEmail: z.string().email("Email 格式不正確").optional(),
        contactPhone: z.string().optional(),
        address: z.string().optional(),
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
        const availabilities = await db.getAvailabilityByWeek(input.weekStart);
        const filtered = availabilities.filter((a) => a.workerId === input.workerId);
        
        // 解析 timeBlocks JSON 為 dayOfWeek 與 timeSlots 結構
        const result = filtered.map((avail) => {
          const blocks = JSON.parse(avail.timeBlocks || "[]");
          return blocks.map((block: any) => ({
            id: avail.id,
            workerId: avail.workerId,
            weekStartDate: avail.weekStartDate,
            weekEndDate: avail.weekEndDate,
            dayOfWeek: block.dayOfWeek,
            timeSlots: block.timeSlots,
            confirmed: !!avail.confirmedAt,
            confirmedAt: avail.confirmedAt,
            createdAt: avail.createdAt,
            updatedAt: avail.updatedAt,
          }));
        }).flat();
        
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
        const { workerId, weekStart, dayOfWeek, timeSlots } = input;
        
        // 計算 weekEnd
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        // 查詢現有記錄
        const existing = await db.getAvailabilityByWeek(weekStart);
        const existingRecord = existing.find((a) => a.workerId === workerId);
        
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
          confirmedAt: existingRecord?.confirmedAt || null,
        });
        
        return { success: true };
      }),

    confirm: publicProcedure
      .input(z.object({
        workerId: z.number(),
        weekStart: z.date(),
      }))
      .mutation(async ({ input }) => {
        const { workerId, weekStart } = input;
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        const existing = await db.getAvailabilityByWeek(weekStart);
        const existingRecord = existing.find((a) => a.workerId === workerId);
        
        if (!existingRecord) {
          throw new Error("尚未設定可排班時間");
        }
        
        await db.upsertAvailability({
          workerId,
          weekStartDate: weekStart,
          weekEndDate: weekEnd,
          timeBlocks: existingRecord.timeBlocks,
          confirmedAt: new Date(),
        });
        
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
        location: z.string().optional(),
        note: z.string().optional(),
        status: z.enum(["draft", "confirmed", "cancelled", "closed"]).optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createDemand(input);
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
        location: z.string().optional(),
        note: z.string().optional(),
        status: z.enum(["draft", "confirmed", "cancelled", "closed"]).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateDemand(id, data);
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
        const startOfDay = new Date(input.date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(input.date);
        endOfDay.setHours(23, 59, 59, 999);
        
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
        
        const demand = await db.getDemandById(assignment.demandId);
        if (!demand) throw new Error("需求單不存在");
        
        // 計算實際工時
        const actualStart = new Date(demand.date);
        const [startHour, startMin] = input.actualStartTime.split(":").map(Number);
        actualStart.setHours(startHour, startMin, 0, 0);
        
        const actualEnd = new Date(demand.date);
        const [endHour, endMin] = input.actualEndTime.split(":").map(Number);
        actualEnd.setHours(endHour, endMin, 0, 0);
        
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
          actualStartTime: input.actualStartTime,
          actualEndTime: input.actualEndTime,
          actualHours,
          varianceHours,
          status,
        });
        
        return { success: true, status };
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
        const assignment = await db.getAssignmentsByDemand(input.id);
        if (!assignment) throw new Error("排班記錄不存在");
        
        const actualHours = logic.calculateMinutesBetween(input.actualStart, input.actualEnd);
        const scheduledHours = assignment[0]?.scheduledHours || 0;
        const varianceHours = actualHours - scheduledHours;
        
        // 檢查實際工時是否與其他排班重疊
        const conflicts = await logic.checkWorkerConflicts(
          assignment[0]?.workerId || 0,
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
  }),

  // ============ Reports ============
  reports: router({
    // 員工薪資報表
    workerPayroll: publicProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        const assignments = await db.getAssignmentsByDateRange(input.startDate, input.endDate);
        
        // 只包含已完成的排班
        const completed = assignments.filter(a => a.status === "completed" && a.actualHours);
        
        // 附加完整資訊
        const records = await Promise.all(
          completed.map(async (assignment) => {
            const worker = await db.getWorkerById(assignment.workerId);
            const demand = await db.getDemandById(assignment.demandId);
            const client = demand ? await db.getClientById(demand.clientId) : null;
            
            return {
              workerName: worker?.name || "",
              clientName: client?.name || "",
              demandDate: logic.formatDate(new Date(demand?.date || "")),
              actualStart: logic.formatTime(new Date(assignment.actualStart || "")),
              actualEnd: logic.formatTime(new Date(assignment.actualEnd || "")),
              actualHours: ((assignment.actualHours || 0) / 60).toFixed(2),
            };
          })
        );
        
        return records;
      }),

    // 客戶工時報表
    clientHours: publicProcedure
      .input(z.object({
        startDate: z.date(),
        endDate: z.date(),
      }))
      .query(async ({ input }) => {
        const allDemands = await db.getAllDemands();
        const clientDemands = allDemands;
        
        const records = [];
        
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
            
            records.push({
              clientName: client?.name || "",
              workerName: worker?.name || "",
              demandDate: logic.formatDate(new Date(demand.date)),
              actualStart: logic.formatTime(new Date(assignment.actualStart || "")),
              actualEnd: logic.formatTime(new Date(assignment.actualEnd || "")),
              actualHours: ((assignment.actualHours || 0) / 60).toFixed(2),
            });
          }
        }
        
        return records;
      }),
  }),
});

export type AppRouter = typeof appRouter;
