import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { successResponse, errorResponse } from "../response";

describe("response utils", () => {
  const fixedTimestamp = "2026-09-25T08:00:00.000Z";

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(fixedTimestamp));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("successResponse", () => {
    it("returns formatted ApiResponse with data and timestamp without correlationId", () => {
      const data = { id: "123", name: "Nova" };
      const response = successResponse(data);

      expect(response).toEqual({
        success: true,
        data,
        timestamp: fixedTimestamp,
      });
      expect(response.correlationId).toBeUndefined();
    });

    it("includes correlationId when provided", () => {
      const data = [1, 2, 3];
      const correlationId = "corr-abc-123";
      const response = successResponse(data, correlationId);

      expect(response).toEqual({
        success: true,
        data,
        timestamp: fixedTimestamp,
        correlationId,
      });
    });

    it("handles null or primitive data gracefully", () => {
      const response = successResponse(null);
      expect(response).toEqual({
        success: true,
        data: null,
        timestamp: fixedTimestamp,
      });
    });
  });

  describe("errorResponse", () => {
    it("returns formatted ApiResponse with error payload and timestamp without correlationId", () => {
      const errPayload = {
        code: "NOT_FOUND",
        message: "Resource was not found",
        details: { resourceId: "xyz" },
      };
      const response = errorResponse(errPayload);

      expect(response).toEqual({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Resource was not found",
          details: { resourceId: "xyz" },
        },
        timestamp: fixedTimestamp,
      });
      expect(response.correlationId).toBeUndefined();
      expect(response.error?.correlationId).toBeUndefined();
    });

    it("includes correlationId both at root and inside error when provided", () => {
      const errPayload = {
        code: "UNAUTHORIZED",
        message: "Invalid credentials",
      };
      const correlationId = "req-err-456";
      const response = errorResponse(errPayload, correlationId);

      expect(response).toEqual({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
          correlationId,
        },
        timestamp: fixedTimestamp,
        correlationId,
      });
    });

    it("preserves additional details in error object", () => {
      const errPayload = {
        code: "VALIDATION_FAILED",
        message: "Validation error",
        details: ["Field 'name' is required"],
      };
      const response = errorResponse(errPayload);

      expect(response.error?.details).toEqual(["Field 'name' is required"]);
      expect(response.success).toBe(false);
    });
  });
});
