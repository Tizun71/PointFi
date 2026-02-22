import { DATA_SOURCE_PRIORITY } from '../config/constants';
import { fetchFromOnChain } from './onchainService';
import { fetchFromDefiScore } from './defiScoreService';
import { fetchFromNFTReputation } from './nftReputationService';
import { CreditData } from '../types';

interface FetchError {
  source: string;
  error: string;
}

export async function fetchCreditData(walletAddress: string): Promise<CreditData> {
  const errors: FetchError[] = [];

  for (const source of DATA_SOURCE_PRIORITY) {
    try {
      let data: CreditData;

      switch (source.trim().toLowerCase()) {
        case 'onchain':
          data = await fetchFromOnChain(walletAddress);
          break;
        case 'defi-score':
        case 'defi':
          data = await fetchFromDefiScore(walletAddress);
          break;
        case 'nft-reputation':
        case 'nft':
          data = await fetchFromNFTReputation(walletAddress);
          break;
        default:
          console.warn(`Unknown data source: ${source}`);
          continue;
      }

      console.log(`✅ Credit data fetched from ${data.source} for ${walletAddress}`);
      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ source, error: errorMessage });
      console.warn(`❌ Failed to fetch from ${source}: ${errorMessage}`);
    }
  }

  throw new Error(`All data sources failed: ${JSON.stringify(errors)}`);
}
