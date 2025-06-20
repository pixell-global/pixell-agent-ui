import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    service: 'Pixell Agent Framework Orchestrator',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      docs: 'Coming in Phase 1'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pixell Agent Framework Orchestrator' });
});

app.listen(port, () => {
  console.log(`🚀 Orchestrator running on http://localhost:${port}`);
}); 