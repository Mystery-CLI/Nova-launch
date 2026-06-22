import { Router, Request, Response } from "express";
import { performance } from "perf_hooks";
import { prisma } from "../lib/prisma";
import { stellarConfig } from "../lib/stellar";
import axios from "axios";

import { Prisma } from "@prisma/client";
import { z } from "zod";

const router = Router();

// Validation schema for search parameters
const searchParamsSchema = z.object({
  q: z.string().optional(),
  creator: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minSupply: z.string().regex(/^\d+$/).optional(),
  maxSupply: z.string().regex(/^\d+$/).optional(),
  hasBurns: z.enum(["true", "false"]).optional(),
  sortBy: z.enum(["created", "burned", "supply", "name"]).default("created"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.string().regex(/^\d+$/).default("1"),
  limit: z.string().regex(/^\d+$/).default("20"),
});

// Cache configuration
const CACHE_TTL = 60 * 1000; // 1 minute
const cache = new Map<string, { data: any; timestamp: number }>();

function getCacheKey(params: Record<string, any>): string {
  return JSON.stringify(params);
}

function getFromCache(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });

  // Clean old cache entries
  if (cache.size > 100) {
    const oldestKey = Array.from(cache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    )[0][0];
    cache.delete(oldestKey);
  }
}

/**
 * GET /api/tokens/search
 * Search and discover tokens with filters, sorting, and pagination
 */
router.get("/search", async (req: Request, res: Response) => {
  try {
    // Validate parameters
    const validationResult = searchParamsSchema.safeParse(req.query);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid parameters",
        details: validationResult.error.errors,
      });
    }

    const params = validationResult.data;

    // Check cache
    const cacheKey = getCacheKey(params);
    const cachedResult = getFromCache(cacheKey);
    if (cachedResult) {
      return res.json({
        ...cachedResult,
        cached: true,
      });
    }

    // Parse pagination
    const page = parseInt(params.page);
    const limit = Math.min(parseInt(params.limit), 50); // Max 50 per page
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.TokenWhereInput = {};

    // Full-text search by name or symbol
    if (params.q) {
      where.OR = [
        { name: { contains: params.q, mode: "insensitive" } },
        { symbol: { contains: params.q, mode: "insensitive" } },
      ];
    }

    // Filter by creator
    if (params.creator) {
      where.creator = params.creator;
    }

    // Filter by creation date range
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.createdAt.lte = new Date(params.endDate);
      }
    }

    // Filter by supply range
    if (params.minSupply || params.maxSupply) {
      where.totalSupply = {};
      if (params.minSupply) {
        where.totalSupply.gte = BigInt(params.minSupply);
      }
      if (params.maxSupply) {
        where.totalSupply.lte = BigInt(params.maxSupply);
      }
    }

    // Filter by burn status
    if (params.hasBurns === "true") {
      where.burnCount = { gt: 0 };
    } else if (params.hasBurns === "false") {
      where.burnCount = 0;
    }

    // Build orderBy clause
    let orderBy: Prisma.TokenOrderByWithRelationInput = {};

    switch (params.sortBy) {
      case "created":
        orderBy = { createdAt: params.sortOrder };
        break;
      case "burned":
        orderBy = { totalBurned: params.sortOrder };
        break;
      case "supply":
        orderBy = { totalSupply: params.sortOrder };
        break;
      case "name":
        orderBy = { name: params.sortOrder };
        break;
    }

    // Execute queries in parallel
    const start = performance.now();
    const [tokens, total] = await Promise.all([
      prisma.token.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          address: true,
          creator: true,
          name: true,
          symbol: true,
          decimals: true,
          totalSupply: true,
          initialSupply: true,
          totalBurned: true,
          burnCount: true,
          metadataUri: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.token.count({ where }),
    ]);
    const duration = performance.now() - start;
    if (duration > 150) {
      console.warn(`[PERF] Token search took ${duration.toFixed(2)}ms`);
    }


    // Convert BigInt to string for JSON serialization
    const serializedTokens = tokens.map((token) => ({
      ...token,
      totalSupply: token.totalSupply.toString(),
      initialSupply: token.initialSupply.toString(),
      totalBurned: token.totalBurned.toString(),
    }));

    const totalPages = Math.ceil(total / limit);

    const response = {
      success: true,
      data: serializedTokens,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      filters: {
        q: params.q,
        creator: params.creator,
        startDate: params.startDate,
        endDate: params.endDate,
        minSupply: params.minSupply,
        maxSupply: params.maxSupply,
        hasBurns: params.hasBurns,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      },
    };

    // Cache the result
    setCache(cacheKey, response);

    return res.json(response);
  } catch (error) {
    console.error("Token search error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;


/**
 * GET /api/tokens/deployment-status/:txHash
 * Check deployment status: Stellar transaction finality + backend indexing status
 *
 * Returns one of:
 * - PENDING: Transaction not yet finalized on Stellar
 * - CONFIRMED: Transaction finalized + token indexed in database
 * - FAILED: Transaction failed on Stellar or indexing error
 */
router.get("/deployment-status/:txHash", async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    const { network = "testnet" } = req.query;

    // Validate txHash format (64 hex chars)
    if (!txHash || !/^[a-f0-9]{64}$/i.test(txHash)) {
      return res.status(400).json({
        success: false,
        error: "Invalid transaction hash format",
      });
    }

    if (network !== "testnet" && network !== "mainnet") {
      return res.status(400).json({
        success: false,
        error: "Invalid network parameter",
      });
    }

    // Query Horizon for transaction status
    const horizonUrl =
      network === "mainnet"
        ? "https://horizon.stellar.org"
        : "https://horizon-testnet.stellar.org";

    const horizonResponse = await axios.get(`${horizonUrl}/transactions/${txHash}`);
    
    const txData = horizonResponse.data as {
      successful: boolean;
      result_xdr?: string;
      error_xdr?: string;
      ledger_attr?: number;
      id?: string;
    };

    // Transaction failed on-chain
    if (!txData.successful) {
      return res.json({
        txHash,
        status: "FAILED",
        reason: "Transaction failed on Stellar network",
        ledger: txData.ledger_attr,
      });
    }

    // Transaction succeeded on-chain, check if backend indexed it
    // Look for token created within last 5 minutes with this txHash
    const token = await prisma.token.findFirst({
      where: {
        // Note: Assuming burn records track deployment txHash
        // If tokens table doesn't have txHash, this would need adaptation
        burnRecords: {
          some: {
            txHash: txHash,
          },
        },
      },
      select: {
        id: true,
        address: true,
        createdAt: true,
      },
    });

    if (token) {
      return res.json({
        txHash,
        status: "CONFIRMED",
        ledger: txData.ledger_attr,
      });
    }

    // Transaction succeeded but not yet indexed in DB
    // Give it some time (typically < 2 seconds) before returning PENDING
    return res.json({
      txHash,
      status: "PENDING",
      reason: "Transaction finalized but not yet indexed",
      ledger: txData.ledger_attr,
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      // Transaction not found on Horizon yet
      return res.json({
        txHash: req.params.txHash,
        status: "PENDING",
        reason: "Transaction not yet indexed by Horizon",
      });
    }
    
    console.error("Deployment status error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch deployment status",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
