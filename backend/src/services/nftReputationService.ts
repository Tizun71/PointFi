import axios from 'axios';
import { CreditData } from '../types';

interface NFTPortfolioResponse {
  total?: number;
  collections?: Array<{
    floorPrice?: number;
    verified?: boolean;
  }>;
}

export async function fetchFromNFTReputation(walletAddress: string): Promise<CreditData> {
  if (!process.env.ALCHEMY_API_KEY && !process.env.MORALIS_API_KEY) {
    throw new Error('NFT API not configured');
  }

  try {
    const nftData = await fetchNFTData(walletAddress);
    
    const totalNFTs = nftData.total || 0;
    const verifiedCollections = nftData.collections?.filter(c => c.verified).length || 0;
    const totalFloorValue = nftData.collections?.reduce((sum, c) => sum + (c.floorPrice || 0), 0) || 0;

    const reputationScore = Math.min(
      (totalNFTs * 2) + 
      (verifiedCollections * 10) + 
      (totalFloorValue / 100),
      100
    );

    return {
      income: Math.round(2500 + (totalFloorValue * 10)),
      employmentMonths: Math.min(Math.round(totalNFTs / 2), 48),
      paymentHistory: Math.round(reputationScore),
      debtToIncome: Math.max(20, 50 - (verifiedCollections * 2)),
      source: 'nft-reputation'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('NFT Reputation fetch error:', errorMessage);
    throw error;
  }
}

async function fetchNFTData(walletAddress: string): Promise<NFTPortfolioResponse> {
  if (process.env.ALCHEMY_API_KEY) {
    return fetchFromAlchemy(walletAddress);
  } else if (process.env.MORALIS_API_KEY) {
    return fetchFromMoralis(walletAddress);
  }
  
  return { total: 0, collections: [] };
}

async function fetchFromAlchemy(walletAddress: string): Promise<NFTPortfolioResponse> {
  const response = await axios.get(
    `https://eth-mainnet.g.alchemy.com/nft/v2/${process.env.ALCHEMY_API_KEY}/getNFTs`,
    {
      params: {
        owner: walletAddress,
        withMetadata: false
      }
    }
  );

  return {
    total: response.data.totalCount || 0,
    collections: response.data.ownedNfts?.map(() => ({
      floorPrice: 0,
      verified: false
    })) || []
  };
}

async function fetchFromMoralis(walletAddress: string): Promise<NFTPortfolioResponse> {
  const response = await axios.get(
    `https://deep-index.moralis.io/api/v2/${walletAddress}/nft`,
    {
      headers: {
        'X-API-Key': process.env.MORALIS_API_KEY
      }
    }
  );

  return {
    total: response.data.total || 0,
    collections: response.data.result?.map(() => ({
      floorPrice: 0,
      verified: false
    })) || []
  };
}
