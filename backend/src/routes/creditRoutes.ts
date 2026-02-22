import express, { Request, Response } from 'express';
import { creditScoreLimiter } from '../middleware/rateLimiter';
import { fetchCreditData } from '../services/creditService';
import { 
  NONCE_EXPIRY_MS,
  DATA_SOURCE_PRIORITY
} from '../config/constants';
import { addVariance } from '../utils/helpers';
import { CreditScoreRequest, CreditScoreResponse, HealthCheckResponse } from '../types';

const router = express.Router();

const usedNonces = new Set<string>();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     description: Returns the health status of the API and configured data sources
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: number
 *                   example: 1708617600000
 *                 uptime:
 *                   type: number
 *                   example: 3600.5
 *                 dataSources:
 *                   type: object
 *                   properties:
 *                     onchain:
 *                       type: boolean
 *                       example: true
 *                     defiScore:
 *                       type: boolean
 *                       example: false
 *                     nftReputation:
 *                       type: boolean
 *                       example: true
 *                     priority:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["onchain", "nft-reputation"]
 */
router.get('/health', (_req: Request, res: Response<HealthCheckResponse>) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    dataSources: {
      onchain: !!process.env.ETHERSCAN_API_KEY,
      defiScore: !!process.env.DEFI_SCORE_API_KEY,
      nftReputation: !!(process.env.ALCHEMY_API_KEY || process.env.MORALIS_API_KEY),
      priority: DATA_SOURCE_PRIORITY
    }
  });
});

/**
 * @swagger
 * /credit-score:
 *   post:
 *     summary: Calculate credit score from on-chain data
 *     tags: [Credit]
 *     description: Analyzes wallet address to calculate credit score based on on-chain reputation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet
 *             properties:
 *               wallet:
 *                 type: string
 *                 description: Ethereum wallet address (must start with 0x)
 *                 example: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
 *     responses:
 *       200:
 *         description: Credit score calculated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 income:
 *                   type: number
 *                   description: Estimated monthly income in USD
 *                   example: 5200
 *                 employmentMonths:
 *                   type: number
 *                   description: Wallet age in months (equivalent to employment duration)
 *                   example: 36
 *                 paymentHistory:
 *                   type: number
 *                   description: Payment history score (0-100)
 *                   example: 92
 *                 debtToIncome:
 *                   type: number
 *                   description: Debt to income ratio percentage
 *                   example: 28
 *                 _meta:
 *                   type: object
 *                   properties:
 *                     source:
 *                       type: string
 *                       enum: [onchain, defi-score, nft-reputation, mock]
 *                       example: onchain
 *                     timestamp:
 *                       type: number
 *                       example: 1708617600000
 *                     onChainMetrics:
 *                       type: object
 *                       properties:
 *                         walletAge:
 *                           type: number
 *                           example: 36
 *                         transactionCount:
 *                           type: number
 *                           example: 250
 *                         totalVolume:
 *                           type: number
 *                           example: 15.5
 *                         uniqueInteractions:
 *                           type: number
 *                           example: 85
 *                         defiProtocolsUsed:
 *                           type: number
 *                           example: 12
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid wallet address"
 *                 message:
 *                   type: string
 *                   example: "Wallet must start with 0x"
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Too many requests from this IP, please try again later."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch credit data"
 *                 message:
 *                   type: string
 *                   example: "All data sources failed"
 */
router.post('/credit-score', creditScoreLimiter, async (req: Request<{}, {}, CreditScoreRequest>, res: Response) => {
  const { wallet } = req.body;

  if (!wallet || !wallet.startsWith('0x')) {
    res.status(400).json({
      error: 'Invalid wallet address',
      message: 'Wallet must start with 0x'
    });
    return;
  }

  const timestamp = Date.now();
  const nonce = `${wallet}-${timestamp}-${Math.random().toString(36).substring(7)}`;
  const nonceKey = nonce;

  if (usedNonces.has(nonceKey)) {
    res.status(400).json({
      error: 'Duplicate request',
      message: 'Please try again'
    });
    return;
  }

  usedNonces.add(nonceKey);
  setTimeout(() => usedNonces.delete(nonceKey), NONCE_EXPIRY_MS);

  try {
    const creditData = await fetchCreditData(wallet);

    const variance = () => addVariance(1, 0.05);

    const responseData: CreditScoreResponse = {
      income: Math.round(creditData.income * variance()),
      employmentMonths: creditData.employmentMonths,
      paymentHistory: Math.min(100, Math.max(0, Math.round(creditData.paymentHistory * variance()))),
      debtToIncome: Math.min(100, Math.max(0, Math.round(creditData.debtToIncome * variance()))),
      _meta: {
        source: creditData.source,
        timestamp: Date.now()
      }
    };

    console.log(`✅ Credit score response for ${wallet}:`, responseData);

    res.json(responseData);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Credit data fetch error:', errorMessage);
    res.status(500).json({
      error: 'Failed to fetch credit data',
      message: errorMessage
    });
  }
});

export default router;
