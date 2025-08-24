import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { authenticateToken } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the usage tracker
import UsageTracker from '../../backend/usageTracker.js';

const router = express.Router();
const usageTracker = new UsageTracker();

// Get usage statistics
router.get('/stats', async (req, res) => {
  // Temporary: Allow unauthenticated access in development for Dashboard
  // TODO: Re-enable authentication when auth system is properly set up
  try {
    const { startDate, endDate } = req.query;
    const stats = await usageTracker.getUsageStats(startDate, endDate);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics', details: error.message });
  }
});

// Get session statistics
router.get('/sessions', async (req, res) => {
  // Temporary: Allow unauthenticated access in development
  try {
    const { startDate, endDate } = req.query;
    const sessions = await usageTracker.getSessionStats(startDate, endDate);
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching session stats:', error);
    res.status(500).json({ error: 'Failed to fetch session statistics' });
  }
});

// Get usage time statistics
router.get('/time', async (req, res) => {
  // Temporary: Allow unauthenticated access in development
  try {
    const { startDate, endDate } = req.query;
    const timeStats = await usageTracker.getUsageTime(startDate, endDate);
    res.json(timeStats);
  } catch (error) {
    console.error('Error fetching usage time:', error);
    res.status(500).json({ error: 'Failed to fetch usage time statistics' });
  }
});

// Track usage (internal API for recording Claude API calls)
router.post('/track', async (req, res) => {
  // Temporary: Allow unauthenticated access in development
  try {
    const result = await usageTracker.trackUsage(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error tracking usage:', error);
    res.status(500).json({ error: 'Failed to track usage' });
  }
});

// Import usage data from Claude projects directory
router.post('/import', async (req, res) => {
  // Temporary: Allow unauthenticated access in development
  try {
    const result = await usageTracker.importFromClaudeProjects();
    res.json(result);
  } catch (error) {
    console.error('Error importing usage data:', error);
    res.status(500).json({ error: 'Failed to import usage data' });
  }
});


// Clear all data and reimport
router.post('/clear-and-reimport', async (req, res) => {
  // Temporary: Allow unauthenticated access in development
  try {
    // Clear all existing data
    await usageTracker.clearAllData();
    // Reimport fresh data
    const result = await usageTracker.importFromClaudeProjects();
    res.json(result);
  } catch (error) {
    console.error('Error clearing and reimporting data:', error);
    res.status(500).json({ error: 'Failed to clear and reimport data' });
  }
});

export default router;