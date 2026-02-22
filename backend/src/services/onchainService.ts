import axios from 'axios';
import { CreditData, OnChainMetrics } from '../types';

interface EtherscanTransaction {
  timeStamp: string;
  value: string;
  to: string;
  from: string;
}

interface EtherscanResponse {
  result: EtherscanTransaction[];
}

export async function fetchFromOnChain(walletAddress: string): Promise<CreditData> {
  try {
    const metrics = await analyzeWalletOnChain(walletAddress);
    const creditScore = calculateCreditFromOnChain(metrics);

    return {
      ...creditScore,
      source: 'onchain'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('OnChain fetch error:', errorMessage);
    throw error;
  }
}

async function analyzeWalletOnChain(walletAddress: string): Promise<OnChainMetrics> {
  const etherscanKey = process.env.ETHERSCAN_API_KEY;

  if (!etherscanKey) {
    throw new Error('Etherscan API key not configured');
  }

  const txResponse = await axios.get(
    "https://api.etherscan.io/v2/api",
    {
      params: {
        chainid: "11155111",
        module: "account",
        action: "txlist",
        address: walletAddress,
        startblock: "0",
        endblock: "99999999",
        page: "1",
        offset: "100",
        sort: "asc",
        apikey: etherscanKey
      }
    }
  );

  const transactions = txResponse.data.result;

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return {
      walletAge: 0,
      transactionCount: 0,
      totalVolume: 0,
      uniqueInteractions: 0,
      defiProtocolsUsed: 0,
      nftHoldings: 0,
      governanceParticipation: 0,
      liquidityProvided: 0
    };
  }

  const walletAge = calculateWalletAge(transactions);
  const transactionCount = transactions.length;
  const totalVolume = calculateTotalVolume(transactions);
  const uniqueInteractions = calculateUniqueInteractions(transactions, walletAddress);

  return {
    walletAge,
    transactionCount,
    totalVolume,
    uniqueInteractions,
    defiProtocolsUsed: Math.min(uniqueInteractions / 5, 20),
    nftHoldings: 0,
    governanceParticipation: 0,
    liquidityProvided: 0
  };
}

function calculateWalletAge(transactions: EtherscanTransaction[]): number {
  if (transactions.length === 0) return 0;

  const firstTx = parseInt(transactions[0].timeStamp);
  const ageInSeconds = Date.now() / 1000 - firstTx;
  const ageInMonths = Math.floor(ageInSeconds / (30 * 24 * 60 * 60));

  return Math.max(0, ageInMonths);
}

function calculateTotalVolume(transactions: EtherscanTransaction[]): number {
  const totalWei = transactions.reduce((sum, tx) => {
    return sum + parseFloat(tx.value || '0');
  }, 0);

  return totalWei / 1e18;
}

function calculateUniqueInteractions(transactions: EtherscanTransaction[], walletAddress: string): number {
  const uniqueAddresses = new Set<string>();
  const walletLower = walletAddress.toLowerCase();

  transactions.forEach(tx => {
    const to = tx.to?.toLowerCase();
    const from = tx.from?.toLowerCase();

    if (to && to !== walletLower) uniqueAddresses.add(to);
    if (from && from !== walletLower) uniqueAddresses.add(from);
  });

  return uniqueAddresses.size;
}

function calculateCreditFromOnChain(metrics: OnChainMetrics): Omit<CreditData, 'source'> {
  const walletAgeScore = Math.min(metrics.walletAge / 36, 1) * 100;
  const activityScore = Math.min(metrics.transactionCount / 100, 1) * 100;
  const volumeScore = Math.min(metrics.totalVolume / 10, 1) * 100;
  const diversityScore = Math.min(metrics.uniqueInteractions / 50, 1) * 100;

  const paymentHistory = Math.round(
    walletAgeScore * 0.3 +
    activityScore * 0.3 +
    volumeScore * 0.2 +
    diversityScore * 0.2
  );

  const income = Math.round(
    2000 +
    (metrics.totalVolume * 100) +
    (metrics.defiProtocolsUsed * 200)
  );

  const employmentMonths = Math.min(metrics.walletAge, 60);

  const debtToIncome = Math.max(
    10,
    50 - (metrics.liquidityProvided * 2) - (metrics.governanceParticipation * 3)
  );

  return {
    income: Math.min(income, 15000),
    employmentMonths,
    paymentHistory: Math.min(paymentHistory, 100),
    debtToIncome: Math.min(debtToIncome, 80)
  };
}
