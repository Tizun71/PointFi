import axios from 'axios';
import { CreditData } from '../types';

interface DefiScoreResponse {
  score?: number;
  totalValueLocked?: number;
  protocolsUsed?: number;
  riskScore?: number;
}

export async function fetchFromDefiScore(walletAddress: string): Promise<CreditData> {
  if (!process.env.DEFI_SCORE_API_KEY) {
    throw new Error('DeFi Score not configured');
  }

  try {
    const response = await axios.get<DefiScoreResponse>(
      `https://api.defiscore.io/v1/wallet/${walletAddress}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEFI_SCORE_API_KEY}`
        }
      }
    );

    const data = response.data;
    const score = data.score || 50;
    const tvl = data.totalValueLocked || 0;
    const protocols = data.protocolsUsed || 0;

    return {
      income: Math.round(3000 + (tvl / 10) + (protocols * 500)),
      employmentMonths: Math.min(Math.round(score / 2), 60),
      paymentHistory: Math.min(score, 100),
      debtToIncome: Math.max(15, 60 - score / 2),
      source: 'defi-score'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('DeFi Score fetch error:', errorMessage);
    throw error;
  }
}
