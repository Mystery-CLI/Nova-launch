import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import leaderboardRouter from "../leaderboard";
import * as leaderboardService from "../../services/leaderboardService";

vi.mock("../../services/leaderboardService", () => ({
  getMostBurnedLeaderboard: vi.fn(),
  getMostActiveLeaderboard: vi.fn(),
  getNewestTokensLeaderboard: vi.fn(),
  getLargestSupplyLeaderboard: vi.fn(),
  getMostBurnersLeaderboard: vi.fn(),
  getCacheStatus: vi.fn(),
  TimePeriod: {
    H24: "24h",
    D7: "7d",
    D30: "30d",
    ALL: "all",
  },
}));

describe("Leaderboard Routes", () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use("/api/leaderboard", leaderboardRouter);
  });

  describe("GET /api/leaderboard/most-burned", () => {
    it("returns most burned leaderboard successfully with query params", async () => {
      const mockResult = {
        tokens: [{ id: "token-1", burnedAmount: "1000" }],
        total: 1,
      };
      vi.mocked(leaderboardService.getMostBurnedLeaderboard).mockResolvedValueOnce(
        mockResult as any
      );

      const res = await request(app).get(
        "/api/leaderboard/most-burned?period=24h&page=2&limit=20"
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(leaderboardService.getMostBurnedLeaderboard).toHaveBeenCalledWith(
        "24h",
        2,
        20
      );
    });

    it("falls back to default period and pagination when invalid or omitted", async () => {
      vi.mocked(leaderboardService.getMostBurnedLeaderboard).mockResolvedValueOnce(
        { tokens: [] } as any
      );

      const res = await request(app).get(
        "/api/leaderboard/most-burned?period=invalid&page=-1&limit=999"
      );

      expect(res.status).toBe(200);
      expect(leaderboardService.getMostBurnedLeaderboard).toHaveBeenCalledWith(
        "7d",
        1,
        100
      );
    });

    it("returns 500 when service throws error", async () => {
      vi.mocked(leaderboardService.getMostBurnedLeaderboard).mockRejectedValueOnce(
        new Error("Database error")
      );

      const res = await request(app).get("/api/leaderboard/most-burned");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });

  describe("GET /api/leaderboard/most-active", () => {
    it("returns most active leaderboard successfully", async () => {
      const mockResult = { tokens: [{ id: "token-2", burnCount: 42 }] };
      vi.mocked(leaderboardService.getMostActiveLeaderboard).mockResolvedValueOnce(
        mockResult as any
      );

      const res = await request(app).get(
        "/api/leaderboard/most-active?period=30d&page=1&limit=5"
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(leaderboardService.getMostActiveLeaderboard).toHaveBeenCalledWith(
        "30d",
        1,
        5
      );
    });

    it("returns 500 when service fails", async () => {
      vi.mocked(leaderboardService.getMostActiveLeaderboard).mockRejectedValueOnce(
        new Error("Failed")
      );

      const res = await request(app).get("/api/leaderboard/most-active");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/leaderboard/newest", () => {
    it("returns newest tokens leaderboard successfully", async () => {
      const mockResult = { tokens: [{ id: "token-3", createdAt: "2026-01-01" }] };
      vi.mocked(leaderboardService.getNewestTokensLeaderboard).mockResolvedValueOnce(
        mockResult as any
      );

      const res = await request(app).get("/api/leaderboard/newest?page=1&limit=10");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(leaderboardService.getNewestTokensLeaderboard).toHaveBeenCalledWith(
        1,
        10
      );
    });

    it("returns 500 on newest leaderboard failure", async () => {
      vi.mocked(leaderboardService.getNewestTokensLeaderboard).mockRejectedValueOnce(
        new Error("DB error")
      );

      const res = await request(app).get("/api/leaderboard/newest");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/leaderboard/largest-supply", () => {
    it("returns largest supply leaderboard successfully", async () => {
      const mockResult = { tokens: [{ id: "token-4", totalSupply: "10000000" }] };
      vi.mocked(leaderboardService.getLargestSupplyLeaderboard).mockResolvedValueOnce(
        mockResult as any
      );

      const res = await request(app).get("/api/leaderboard/largest-supply");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(leaderboardService.getLargestSupplyLeaderboard).toHaveBeenCalledWith(
        1,
        10
      );
    });

    it("returns 500 on largest-supply failure", async () => {
      vi.mocked(leaderboardService.getLargestSupplyLeaderboard).mockRejectedValueOnce(
        new Error("DB error")
      );

      const res = await request(app).get("/api/leaderboard/largest-supply");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/leaderboard/most-burners", () => {
    it("returns most burners leaderboard successfully", async () => {
      const mockResult = { tokens: [{ id: "token-5", uniqueBurners: 15 }] };
      vi.mocked(leaderboardService.getMostBurnersLeaderboard).mockResolvedValueOnce(
        mockResult as any
      );

      const res = await request(app).get(
        "/api/leaderboard/most-burners?period=all&page=1&limit=10"
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockResult);
      expect(leaderboardService.getMostBurnersLeaderboard).toHaveBeenCalledWith(
        "all",
        1,
        10
      );
    });

    it("returns 500 on most-burners failure", async () => {
      vi.mocked(leaderboardService.getMostBurnersLeaderboard).mockRejectedValueOnce(
        new Error("DB error")
      );

      const res = await request(app).get("/api/leaderboard/most-burners");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/leaderboard/cache-status", () => {
    it("returns cache status successfully", async () => {
      const mockStatus = {
        isRedisConnected: true,
        boards: { mostBurned: "warm" },
      };
      vi.mocked(leaderboardService.getCacheStatus).mockResolvedValueOnce(
        mockStatus as any
      );

      const res = await request(app).get("/api/leaderboard/cache-status");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockStatus);
    });

    it("returns 500 when cache status check fails", async () => {
      vi.mocked(leaderboardService.getCacheStatus).mockRejectedValueOnce(
        new Error("Redis connection failure")
      );

      const res = await request(app).get("/api/leaderboard/cache-status");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INTERNAL_SERVER_ERROR");
    });
  });
});
