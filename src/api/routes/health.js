import express from 'express';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'codemind-backend',
    timestamp: new Date().toISOString(),
  });
});

export default router;
