# WiFi Performance Tracker - Changes Documentation

## Recent Changes

### Backend Changes

1. **Fixed WebSocket Connection Syntax Error**
   - Fixed a syntax error in `backend/app/api/routers/websocket.py` where the `/ping-status` endpoint had an unclosed try block
   - Added proper exception handling with except and finally blocks
   - Ensured proper WebSocket connection cleanup

2. **API Endpoint Improvements**
   - Added trailing slash to `/time-range/` endpoint to fix routing issues
   - Added trailing slash to `/isp-info/` endpoint to fix integer parsing error
   - Modified `/isp-info/` endpoint to only return the provider name
   - Updated frontend API calls to include trailing slashes in the endpoint URLs
   - Tested and verified the endpoints work correctly with different parameters
   - Ensured proper parameter handling for minutes parameter

3. **WebSocket Connections**
   - Verified WebSocket connection for DNS status updates
   - Confirmed active connections are being tracked correctly

### Frontend Changes

1. **Fixed Variable Initialization Error**
   - Fixed an issue in `frontend/src/App.tsx` where the `timeRange` variable was being accessed before initialization
   - Moved the declaration of `selectedHost` and `timeRange` state variables to the beginning of the component
   - Removed duplicate declarations

2. **Fixed Data Processing Error**
   - Fixed the 'pingData.filter is not a function' error by ensuring pingData is always an array
   - Added proper type checking and fallback for API responses

3. **Improved URL Handling**
   - Created utility function `getApiBaseUrl()` to centralize URL generation
   - Updated all API endpoints to use this utility function
   - Made the application work correctly regardless of the host environment

4. **UI Improvements**
   - Ensured the frontend correctly displays data from the backend API
   - Updated UI to show polling mode instead of WebSocket connection status

5. **Removed WebSocket Implementation**
   - Removed WebSocket connection code and related interfaces
   - Switched to polling-only mode for data updates
   - Simplified the codebase by removing WebSocket reconnection logic
   - Updated UI to reflect the removal of real-time updates

## Architecture Overview

The application follows a client-server architecture:

- **Backend**: FastAPI application
  - Provides REST API endpoints for historical data
  - Backend still has WebSocket support, but frontend no longer uses it
  - Stores data in TimescaleDB for efficient time-series data handling

- **Frontend**: React application with Vite
  - Fetches historical data from REST API endpoints
  - Connects to WebSocket for real-time updates
  - Displays data using Recharts for visualization

## Docker Deployment

The application is containerized using Docker Compose with two main services:
- `wifi-tracker-backend`: The FastAPI backend service
- `wifi-tracker-timescaledb`: TimescaleDB for time-series data storage