import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { PORT, DATA_SOURCE_PRIORITY } from './config/constants';
import { swaggerSpec } from './config/swagger';
import creditRoutes from './routes/creditRoutes';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'PointFi API Documentation',
}));

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.use('/', creditRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /health',
      'POST /credit-score'
    ]
  });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

app.listen(PORT, () => {
  console.log('\n=================================');
  console.log('🚀 PointFi On-Chain Credit API');
  console.log('=================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/health`);
  console.log(`💳 Credit: http://localhost:${PORT}/credit-score`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  console.log('\n📊 Data Sources:');
  console.log(`   - On-Chain: ${process.env.ETHERSCAN_API_KEY ? '✅' : '❌'}`);
  console.log(`   - DeFi Score: ${process.env.DEFI_SCORE_API_KEY ? '✅' : '❌'}`);
  console.log(`   - NFT Reputation: ${(process.env.ALCHEMY_API_KEY || process.env.MORALIS_API_KEY) ? '✅' : '❌'}`);
  console.log(`   - Priority: ${DATA_SOURCE_PRIORITY.join(' → ')}`);
  console.log('=================================\n');
});

export default app;
