# Usage Dashboard Documentation

## Overview

The Usage Dashboard provides comprehensive analytics and tracking for your Claude Code CLI usage, helping you monitor costs, token consumption, and usage patterns.

## Features

### Main Navigation Tab
The Dashboard is now integrated as a main navigation tab alongside Shell, Files, Source Control, and Tasks. Access it directly from the tab bar without opening a modal.

### Dashboard Components

#### 1. Summary Cards
- **Total Cost** - Cumulative API costs across all sessions
- **Total Tokens** - Total token consumption (input + output)
- **Total Sessions** - Number of Claude Code sessions
- **Total Time Used** - Time spent in active conversations

#### 2. Date Range Filters
- **All Time** - Complete historical data
- **Last 30 Days** - Recent month activity
- **Last 7 Days** - Weekly overview
- **Reimport Data** - Force refresh from Claude CLI logs

#### 3. Tab Views

##### Overview Tab
- Quick summary of key metrics
- Cost breakdown by model
- Token usage distribution
- Session count trends

##### Time Usage Tab
- Hourly usage patterns
- Daily active time
- Peak usage periods
- Session duration analytics

##### By Model Tab
- Cost per model (Opus, Sonnet, etc.)
- Token usage by model
- Model preference trends
- Efficiency comparisons

##### By Project Tab
- Per-project cost breakdown
- Project-specific token usage
- Most active projects
- Resource allocation insights

##### By Session Tab
- Individual session costs
- Session token consumption
- Session duration
- Detailed session logs

##### Timeline Tab
- Historical usage graph
- Cost trends over time
- Token usage evolution
- Predictive analytics

## Data Management

### Automatic Import
- Data imports automatically every 30 minutes
- Cached for 1 hour to reduce API calls
- Background import during dashboard access

### Manual Controls
- **Reimport Data** button for immediate refresh
- Clears cache and fetches latest data
- Available in the header controls

### Data Persistence
- Usage data stored in SQLite database
- Cached in localStorage for quick access
- Automatic cleanup of old data

## Performance Optimizations

### Lazy Loading
- Tab data loads only when accessed
- Reduces initial load time
- Improves responsiveness

### Caching Strategy
- 1-hour cache for usage statistics
- Per-tab caching to avoid redundant loads
- Smart cache invalidation

### Error Handling
- Graceful degradation on API failures
- Cached data fallback
- Clear error messages with retry options

## Integration Features

### Session Protection
- Dashboard updates don't interrupt active chats
- Seamless background data fetching
- Non-blocking UI updates

### Responsive Design
- Adapts to all screen sizes
- Mobile-optimized layouts
- Touch-friendly controls

### Theme Support
- Follows app theme (light/dark)
- Consistent color coding
- Accessible contrast ratios

## API Endpoints

### Import Usage Data
```
POST /api/usage/import
```
Imports latest usage data from Claude CLI logs

### Get Usage Statistics
```
GET /api/usage/stats?startDate=<date>&endDate=<date>
```
Returns aggregated usage statistics

### Get Session Data
```
GET /api/usage/sessions?startDate=<date>&endDate=<date>
```
Returns detailed session information

### Get Time Usage
```
GET /api/usage/time?startDate=<date>&endDate=<date>
```
Returns time-based usage analytics

## Configuration

### Environment Variables
No specific environment variables required for Dashboard

### Permissions
Dashboard is read-only and doesn't require special permissions

## Troubleshooting

### Common Issues

#### Data Not Loading
1. Check if Claude CLI is properly configured
2. Verify API server is running (port 8080)
3. Click "Reimport Data" to force refresh
4. Check browser console for errors

#### Incorrect Statistics
1. Clear browser cache
2. Click "Reimport Data"
3. Verify Claude CLI log files exist
4. Check date range filters

#### Performance Issues
1. Reduce date range to last 7 days
2. Clear browser localStorage
3. Close other heavy tabs
4. Use desktop instead of mobile

### Debug Mode
Enable debug logging in browser console:
```javascript
localStorage.setItem('debug', 'dashboard:*')
```

## Future Enhancements

- Export data to CSV/JSON
- Budget alerts and limits
- Comparative analytics
- Team usage tracking
- API key management
- Custom date ranges
- Real-time updates via WebSocket

## Related Documentation

- [User Guide](USER_GUIDE.md)
- [API Documentation](API.md)
- [Troubleshooting](TROUBLESHOOTING.md)