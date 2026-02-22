import { Request } from 'express';

export interface CreditData {
  income: number;
  employmentMonths: number;
  paymentHistory: number;
  debtToIncome: number;
  source: DataSource;
}

export type DataSource = 'onchain' | 'defi-score' | 'nft-reputation';

export interface OnChainMetrics {
  walletAge: number;
  transactionCount: number;
  totalVolume: number;
  uniqueInteractions: number;
  defiProtocolsUsed: number;
  nftHoldings: number;
  governanceParticipation: number;
  liquidityProvided: number;
}

export interface CreditScoreRequest {
  wallet: string;
}

export interface CreditScoreResponse extends Omit<CreditData, 'source'> {
  _meta: {
    source: DataSource;
    timestamp: number;
    onChainMetrics?: OnChainMetrics;
  };
}

export interface UserIdentity {
  walletAddress: string;
  firstName: string;
  lastName: string;
  ssn: string;
  dob: string;
  country?: string;
  plaidAccessToken?: string;
}

export interface AuthRequest extends Request {
  user?: any;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: number;
  uptime: number;
  dataSources: {
    onchain: boolean;
    defiScore: boolean;
    nftReputation: boolean;
    priority: string[];
  };
}
