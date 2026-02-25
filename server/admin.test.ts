import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  createAdminInvite: vi.fn(),
  getAdminInviteByCode: vi.fn(),
  getAllAdminInvites: vi.fn(),
  getAllAdmins: vi.fn(),
  updateAdminInvite: vi.fn(),
  updateUserRole: vi.fn(),
  getAssignmentsByDateRange: vi.fn(),
  getAllWorkers: vi.fn(),
}));

import {
  createAdminInvite,
  getAdminInviteByCode,
  getAllAdminInvites,
  getAllAdmins,
  updateAdminInvite,
  updateUserRole,
  getAssignmentsByDateRange,
} from "./db";

describe("Admin Invite System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAdminInvite", () => {
    it("should create an invite with a code and creator", async () => {
      const mockInvite = {
        id: 1,
        code: "abc123",
        createdBy: 1,
        status: "active",
        createdAt: new Date(),
      };
      (createAdminInvite as any).mockResolvedValue(mockInvite);

      const result = await createAdminInvite({
        code: "abc123",
        createdBy: 1,
      });

      expect(createAdminInvite).toHaveBeenCalledWith({
        code: "abc123",
        createdBy: 1,
      });
      expect(result).toEqual(mockInvite);
      expect(result.status).toBe("active");
    });
  });

  describe("getAdminInviteByCode", () => {
    it("should return invite when code exists", async () => {
      const mockInvite = {
        id: 1,
        code: "abc123",
        status: "active",
        createdBy: 1,
      };
      (getAdminInviteByCode as any).mockResolvedValue(mockInvite);

      const result = await getAdminInviteByCode("abc123");
      expect(result).toEqual(mockInvite);
    });

    it("should return undefined when code does not exist", async () => {
      (getAdminInviteByCode as any).mockResolvedValue(undefined);

      const result = await getAdminInviteByCode("nonexistent");
      expect(result).toBeUndefined();
    });
  });

  describe("updateAdminInvite", () => {
    it("should update invite status to used", async () => {
      (updateAdminInvite as any).mockResolvedValue(undefined);

      await updateAdminInvite(1, {
        usedBy: 2,
        usedAt: new Date(),
        status: "used",
      });

      expect(updateAdminInvite).toHaveBeenCalledWith(1, expect.objectContaining({
        usedBy: 2,
        status: "used",
      }));
    });

    it("should update invite status to revoked", async () => {
      (updateAdminInvite as any).mockResolvedValue(undefined);

      await updateAdminInvite(1, { status: "revoked" });

      expect(updateAdminInvite).toHaveBeenCalledWith(1, { status: "revoked" });
    });
  });

  describe("updateUserRole", () => {
    it("should promote user to admin", async () => {
      (updateUserRole as any).mockResolvedValue(undefined);

      await updateUserRole(2, "admin");

      expect(updateUserRole).toHaveBeenCalledWith(2, "admin");
    });

    it("should demote admin to user", async () => {
      (updateUserRole as any).mockResolvedValue(undefined);

      await updateUserRole(2, "user");

      expect(updateUserRole).toHaveBeenCalledWith(2, "user");
    });
  });

  describe("getAllAdmins", () => {
    it("should return list of admin users", async () => {
      const mockAdmins = [
        { id: 1, name: "Admin1", role: "admin" },
        { id: 2, name: "Admin2", role: "admin" },
      ];
      (getAllAdmins as any).mockResolvedValue(mockAdmins);

      const result = await getAllAdmins();
      expect(result).toHaveLength(2);
      expect(result[0].role).toBe("admin");
    });
  });

  describe("getAllAdminInvites", () => {
    it("should return all invites", async () => {
      const mockInvites = [
        { id: 1, code: "abc", status: "active" },
        { id: 2, code: "def", status: "used" },
      ];
      (getAllAdminInvites as any).mockResolvedValue(mockInvites);

      const result = await getAllAdminInvites();
      expect(result).toHaveLength(2);
    });
  });
});

describe("Dashboard Statistics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAssignmentsByDateRange", () => {
    it("should return assignments within date range", async () => {
      const mockAssignments = [
        { id: 1, scheduledStart: new Date("2026-02-09"), status: "assigned" },
        { id: 2, scheduledStart: new Date("2026-02-10"), status: "completed" },
      ];
      (getAssignmentsByDateRange as any).mockResolvedValue(mockAssignments);

      const start = new Date("2026-02-09");
      const end = new Date("2026-02-11");
      const result = await getAssignmentsByDateRange(start, end);

      expect(result).toHaveLength(2);
      expect(getAssignmentsByDateRange).toHaveBeenCalledWith(start, end);
    });

    it("should return empty array when no assignments in range", async () => {
      (getAssignmentsByDateRange as any).mockResolvedValue([]);

      const start = new Date("2026-03-01");
      const end = new Date("2026-03-02");
      const result = await getAssignmentsByDateRange(start, end);

      expect(result).toHaveLength(0);
    });
  });
});

describe("Worker Fields", () => {
  it("should support school, hasWorkPermit, hasHealthCheck fields", async () => {
    const { getAllWorkers } = await import("./db");
    const mockWorkers = [
      {
        id: 1,
        name: "王大明",
        school: "台大",
        hasWorkPermit: true,
        hasHealthCheck: true,
        status: "active",
      },
      {
        id: 2,
        name: "陳小春",
        school: null,
        hasWorkPermit: false,
        hasHealthCheck: true,
        status: "active",
      },
    ];
    (getAllWorkers as any).mockResolvedValue(mockWorkers);

    const result = await getAllWorkers();
    expect(result).toHaveLength(2);
    expect(result[0].school).toBe("台大");
    expect(result[0].hasWorkPermit).toBe(true);
    expect(result[0].hasHealthCheck).toBe(true);
    expect(result[1].hasWorkPermit).toBe(false);
  });
});
