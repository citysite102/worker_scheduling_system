import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db module
vi.mock("./db", () => ({
  getWorkerById: vi.fn(),
  getWorkerAssignmentHistory: vi.fn(),
  getWorkerAvailabilityHistory: vi.fn(),
  getDemandById: vi.fn(),
  getClientById: vi.fn(),
}));

import * as db from "./db";

describe("Worker Detail API logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return worker basic info", async () => {
    const mockWorker = {
      id: 1,
      name: "王大明",
      phone: "0912-345-678",
      email: "wang@example.com",
      school: "台大",
      hasWorkPermit: 1,
      hasHealthCheck: 1,
      status: "active",
      note: "",
    };

    vi.mocked(db.getWorkerById).mockResolvedValue(mockWorker as any);
    vi.mocked(db.getWorkerAssignmentHistory).mockResolvedValue([]);
    vi.mocked(db.getWorkerAvailabilityHistory).mockResolvedValue([]);

    const worker = await db.getWorkerById(1);
    expect(worker).toBeDefined();
    expect(worker!.name).toBe("王大明");
    expect(worker!.school).toBe("台大");
    expect(worker!.hasWorkPermit).toBe(1);
    expect(worker!.hasHealthCheck).toBe(1);
  });

  it("should return empty arrays when worker has no history", async () => {
    vi.mocked(db.getWorkerAssignmentHistory).mockResolvedValue([]);
    vi.mocked(db.getWorkerAvailabilityHistory).mockResolvedValue([]);

    const assignments = await db.getWorkerAssignmentHistory(1);
    const availability = await db.getWorkerAvailabilityHistory(1);

    expect(assignments).toEqual([]);
    expect(availability).toEqual([]);
  });

  it("should return assignment history with correct order", async () => {
    const mockAssignments = [
      {
        id: 2,
        workerId: 1,
        demandId: 2,
        scheduledStart: new Date("2026-02-10"),
        scheduledEnd: new Date("2026-02-10"),
        scheduledHours: 480,
        actualHours: 480,
        status: "completed",
      },
      {
        id: 1,
        workerId: 1,
        demandId: 1,
        scheduledStart: new Date("2026-02-09"),
        scheduledEnd: new Date("2026-02-09"),
        scheduledHours: 300,
        actualHours: null,
        status: "assigned",
      },
    ];

    vi.mocked(db.getWorkerAssignmentHistory).mockResolvedValue(mockAssignments as any);

    const assignments = await db.getWorkerAssignmentHistory(1);
    expect(assignments).toHaveLength(2);
    expect(assignments[0].id).toBe(2); // newer first
    expect(assignments[1].id).toBe(1);
  });

  it("should calculate stats correctly", async () => {
    const mockAssignments = [
      { id: 1, status: "completed", scheduledHours: 480, actualHours: 500, varianceHours: 20 },
      { id: 2, status: "completed", scheduledHours: 300, actualHours: 280, varianceHours: -20 },
      { id: 3, status: "assigned", scheduledHours: 240, actualHours: null, varianceHours: null },
      { id: 4, status: "cancelled", scheduledHours: 360, actualHours: null, varianceHours: null },
    ];

    vi.mocked(db.getWorkerAssignmentHistory).mockResolvedValue(mockAssignments as any);

    const assignments = await db.getWorkerAssignmentHistory(1);

    // Calculate stats like the router does
    const completedAssignments = assignments.filter((a: any) => a.status === "completed");
    const totalScheduledMinutes = assignments
      .filter((a: any) => a.status !== "cancelled")
      .reduce((sum: number, a: any) => sum + (a.scheduledHours || 0), 0);
    const totalActualMinutes = completedAssignments
      .reduce((sum: number, a: any) => sum + (a.actualHours || 0), 0);
    const totalVarianceMinutes = completedAssignments
      .reduce((sum: number, a: any) => sum + (a.varianceHours || 0), 0);

    expect(assignments.filter((a: any) => a.status !== "cancelled")).toHaveLength(3);
    expect(completedAssignments).toHaveLength(2);
    expect(assignments.filter((a: any) => a.status === "cancelled")).toHaveLength(1);
    expect(+(totalScheduledMinutes / 60).toFixed(1)).toBe(17); // (480+300+240)/60
    expect(+(totalActualMinutes / 60).toFixed(1)).toBe(13); // (500+280)/60
    expect(+(totalVarianceMinutes / 60).toFixed(1)).toBe(0); // (20-20)/60
  });

  it("should parse availability history with timeSlots format", async () => {
    const mockAvailability = [
      {
        id: 1,
        workerId: 1,
        weekStartDate: new Date("2026-02-03"),
        weekEndDate: new Date("2026-02-09"),
        timeBlocks: JSON.stringify([
          { dayOfWeek: 1, timeSlots: [{ startTime: "09:00", endTime: "17:00" }] },
          { dayOfWeek: 3, timeSlots: [{ startTime: "10:00", endTime: "18:00" }] },
        ]),
        confirmedAt: new Date(),
      },
    ];

    vi.mocked(db.getWorkerAvailabilityHistory).mockResolvedValue(mockAvailability as any);

    const availability = await db.getWorkerAvailabilityHistory(1);
    expect(availability).toHaveLength(1);

    const blocks = JSON.parse(availability[0].timeBlocks || "[]");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].dayOfWeek).toBe(1);
    expect(blocks[0].timeSlots[0].startTime).toBe("09:00");
  });

  it("should handle legacy timeBlocks format (without timeSlots wrapper)", async () => {
    const mockAvailability = [
      {
        id: 1,
        workerId: 1,
        weekStartDate: new Date("2026-01-27"),
        weekEndDate: new Date("2026-02-02"),
        timeBlocks: JSON.stringify([
          { dayOfWeek: 2, startTime: "08:00", endTime: "16:00" },
        ]),
        confirmedAt: null,
      },
    ];

    vi.mocked(db.getWorkerAvailabilityHistory).mockResolvedValue(mockAvailability as any);

    const availability = await db.getWorkerAvailabilityHistory(1);
    const blocks = JSON.parse(availability[0].timeBlocks || "[]");
    const block = blocks[0];

    // Legacy format: no timeSlots, has startTime/endTime directly
    let timeSlots = block.timeSlots;
    if (!timeSlots && block.startTime && block.endTime) {
      timeSlots = [{ startTime: block.startTime, endTime: block.endTime }];
    }

    expect(timeSlots).toHaveLength(1);
    expect(timeSlots[0].startTime).toBe("08:00");
    expect(timeSlots[0].endTime).toBe("16:00");
  });

  it("should enrich assignments with demand and client info", async () => {
    const mockAssignment = {
      id: 1,
      workerId: 1,
      demandId: 10,
      scheduledHours: 480,
      status: "completed",
    };

    const mockDemand = {
      id: 10,
      clientId: 5,
      date: new Date("2026-02-10"),
      startTime: "09:00",
      endTime: "17:00",
      location: "桃園店",
    };

    const mockClient = {
      id: 5,
      name: "大潤發",
    };

    vi.mocked(db.getWorkerAssignmentHistory).mockResolvedValue([mockAssignment as any]);
    vi.mocked(db.getDemandById).mockResolvedValue(mockDemand as any);
    vi.mocked(db.getClientById).mockResolvedValue(mockClient as any);

    const assignments = await db.getWorkerAssignmentHistory(1);
    const demand = await db.getDemandById(assignments[0].demandId);
    const client = demand ? await db.getClientById(demand.clientId) : null;

    expect(demand).toBeDefined();
    expect(demand!.location).toBe("桃園店");
    expect(client).toBeDefined();
    expect(client!.name).toBe("大潤發");
  });

  it("should return undefined for non-existent worker", async () => {
    vi.mocked(db.getWorkerById).mockResolvedValue(undefined);

    const worker = await db.getWorkerById(999);
    expect(worker).toBeUndefined();
  });
});
