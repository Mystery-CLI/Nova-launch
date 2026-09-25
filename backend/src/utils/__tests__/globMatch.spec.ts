import { describe, it, expect } from "vitest";
import { isValidGlobPattern, globMatch } from "../globMatch";

describe("globMatch utils", () => {
  describe("isValidGlobPattern", () => {
    it("returns true for valid pattern characters", () => {
      expect(isValidGlobPattern("user.created")).toBe(true);
      expect(isValidGlobPattern("token-mint_event.*")).toBe(true);
      expect(isValidGlobPattern("token.**.completed")).toBe(true);
      expect(isValidGlobPattern("app_123.test-topic")).toBe(true);
    });

    it("returns false when forbidden characters are present", () => {
      expect(isValidGlobPattern("user/created")).toBe(false);
      expect(isValidGlobPattern("user:event")).toBe(false);
      expect(isValidGlobPattern("user@topic")).toBe(false);
      expect(isValidGlobPattern("user$topic")).toBe(false);
      expect(isValidGlobPattern("user event")).toBe(false);
      expect(isValidGlobPattern("")).toBe(false);
    });

    it("returns false when consecutive asterisks exceed two (***+)", () => {
      expect(isValidGlobPattern("***")).toBe(false);
      expect(isValidGlobPattern("event.***.created")).toBe(false);
      expect(isValidGlobPattern("****")).toBe(false);
    });

    it("returns true for exactly two consecutive asterisks (**)", () => {
      expect(isValidGlobPattern("**")).toBe(true);
      expect(isValidGlobPattern("*.**")).toBe(true);
    });
  });

  describe("globMatch", () => {
    describe("single asterisk (*)", () => {
      it("matches within a single dot-separated segment", () => {
        expect(globMatch("token.*", "token.mint")).toBe(true);
        expect(globMatch("token.*", "token.burn")).toBe(true);
        expect(globMatch("*.created", "user.created")).toBe(true);
        expect(globMatch("token.*.v1", "token.transfer.v1")).toBe(true);
      });

      it("does not cross dot boundaries", () => {
        expect(globMatch("token.*", "token.mint.v1")).toBe(false);
        expect(globMatch("*.v1", "token.burn.v1")).toBe(false);
      });
    });

    describe("double asterisk (**)", () => {
      it("matches zero or more segments across dots", () => {
        expect(globMatch("**", "token.mint.v1")).toBe(true);
        expect(globMatch("token.**", "token.mint")).toBe(true);
        expect(globMatch("token.**", "token.mint.v1.audit")).toBe(true);
        expect(globMatch("**.created", "a.b.c.created")).toBe(true);
        expect(globMatch("token.**.v1", "token.mint.success.v1")).toBe(true);
        expect(globMatch("token.**.v1", "token.v1")).toBe(true);
      });

      it("fails when prefix or suffix does not match", () => {
        expect(globMatch("token.**", "user.mint.v1")).toBe(false);
        expect(globMatch("**.created", "token.deleted")).toBe(false);
        expect(globMatch("token.**.v1", "token.mint.v2")).toBe(false);
      });
    });

    describe("exact matching and special characters", () => {
      it("matches exact strings without wildcards", () => {
        expect(globMatch("token.mint", "token.mint")).toBe(true);
        expect(globMatch("token.mint", "token.burn")).toBe(false);
      });

      it("safely handles regex special characters in segments", () => {
        expect(globMatch("token.mint", "token.mint")).toBe(true);
        expect(globMatch("token.mint", "tokenamint")).toBe(false);
      });
    });
  });
});
