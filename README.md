# WiFi Performance Tracker

A comprehensive real-time WiFi performance monitoring system with web dashboard, built with FastAPI, React, and TimescaleDB.

![WiFi Performance Tracker Preview](./assets/preview.png)

## ToDo
1. Add n8n workflow to send reports on internet `x` hours downtime to email

## Product Requirements Document (PRD)

### 1. Product Overview

**Product Name**: WiFi Performance Tracker  
**Version**: 1.0.0  
**Purpose**: Provide real-time monitoring, visualization, and analysis of WiFi network performance through continuous ping metrics collection and web-based dashboard.

### 2. Core Features

#### 2.1 Real-time Network Monitoring
- **Continuous Ping Monitoring**: Automated ping tests to multiple target hosts (DNS servers, websites)
- **Configurable Intervals**: Adjustable ping frequency (default: 30 seconds)
- **Multi-host Support**: Monitor multiple endpoints simultaneously
- **Live Data Streaming**: Real-time WebSocket updates for connected clients
- **ISP Information**: Automatic detection of Internet Service Provider details

#### 2.2 Web Dashboard
- **Interactive Charts**: Real-time visualization using Recharts library
- **Time Range Selection**: View data for 10 minutes, 1 hour, or 5 hours
- **Host Selection**: Filter data by specific monitoring targets
- **Responsive Design**: Modern UI built with React and Tailwind CSS
- **Real-time Updates**: Live data refresh without page reload

#### 2.3 Data Storage & Analytics
- **Time-series Database**: TimescaleDB for efficient time-series data storage
- **Historical Data**: Long-term storage with automatic partitioning
- **Performance Metrics**: Response time, packet loss, uptime statistics
- **Data Aggregation**: Time-range analytics and statistical summaries

#### 2.4 REST API
- **CRUD Operations**: Full API for ping metrics management
- **Filtering & Pagination**: Advanced querying capabilities
- **Statistics Endpoints**: Aggregated performance analytics
- **Monitoring Control**: Start/stop monitoring programmatically
- **ISP Information**: Endpoint for retrieving network provider details

#### 2.5 WebSocket Real-time API
- **Live Updates**: Real-time ping result broadcasting
- **Connection Management**: Multi-client support with connection tracking
- **Event-driven**: Subscribe to specific hosts or global updates

### 3. Technical Architecture

#### 3.1 System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   TimescaleDB   │
│   (React)       │◄──►│   (FastAPI)     │◄──►│   (PostgreSQL)  │
│   Port: 80      │    │   Port: 8000    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                    ┌─────────────────┐
                    │  Docker Network │
                    │ wifi-tracker-   │
                    │    network      │
                    └─────────────────┘
```

#### 3.2 Technology Stack

**Frontend:**
- React 19.1.1 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Recharts for data visualization
- Radix UI for components
- Nginx for production serving

**Backend:**
- FastAPI for REST API
- Python 3.10+ with asyncio
- WebSocket support for real-time updates
- Ping3 for network monitoring
- AsyncPG for database connectivity
- Pydantic for data validation

**Database:**
- TimescaleDB (PostgreSQL extension)
- Time-series optimized storage
- Automatic data partitioning
- Efficient compression

**Infrastructure:**
- Docker & Docker Compose
- Multi-stage builds for optimization
- Health checks and restart policies
- Volume persistence for data


## Quick Start

### Prerequisites

- Docker & Docker Compose
- 4GB+ RAM recommended
- Network access for ping monitoring

### Running the Application

```bash
# Clone the repository
git clone <repository-url>
cd wifi-performance-tracker

# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f
```

### Accessing the Application

- **Web Dashboard**: http://localhost
- **Backend API**: http://localhost:8000/api
- **API Documentation**: http://localhost:8000/api/docs
- **WebSocket**: ws://localhost:8000/api/ws/ping-status
- **Database**: localhost:5432 (postgres/password)

## Configuration

### Environment Variables

**Backend Configuration:**
```bash
DATABASE_URL=postgresql://postgres:password@timescaledb:5432/wifi_tracker
PING_INTERVAL=30          # Ping interval in seconds
LOG_LEVEL=CRITICAL        # Logging level
```

**Database Configuration:**
```bash
POSTGRES_DB=wifi_tracker
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
TIMESCALEDB_TELEMETRY=off
```

### Default Monitoring Targets

- `8.8.8.8` - Google DNS
- `1.1.1.1` - Cloudflare DNS
- `208.67.222.222` - OpenDNS
- `google.com` - Google
- `github.com` - GitHub

## API Documentation

### Core Endpoints

#### Ping Metrics
- `GET /api/ping-metrics/` - Retrieve ping metrics with filtering
- `GET /api/ping-metrics/time-range/` - Get metrics for specific time range
- `GET /api/ping-metrics/statistics/` - Get aggregated statistics
- `POST /api/ping-metrics/monitoring/start` - Start monitoring
- `POST /api/ping-metrics/monitoring/stop` - Stop monitoring
- `GET /api/ping-metrics/isp-info/` - Get ISP information

#### WebSocket
- `WS /api/ws/ping-status` - Real-time ping updates

#### Health & Status
- `GET /api/` - API information and status
- `GET /api/health` - Detailed health check

### Query Parameters

**Time-based filtering:**
- `hours` (1-168): Hours of data to retrieve
- `minutes` (1-10080): Minutes of data to retrieve

**Data filtering:**
- `host`: Filter by specific host
- `limit`: Maximum records (default: 1000)
- `offset`: Records to skip (default: 0)

## Development

### Project Structure

```
wifi-performance-tracker/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   └── modules/        # Core modules
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   └── lib/           # Utilities
│   ├── Dockerfile
│   └── package.json
├── compose.yml            # Docker Compose configuration
├── init.sql              # Database initialization
└── README.md             # This file
```

### Local Development

**Backend:**
```bash
cd backend
uv sync                    # Install dependencies
export DATABASE_URL="postgresql://postgres:password@localhost:5432/wifi_tracker"
uv run uvicorn app.api.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install               # Install dependencies
npm run dev              # Start development server
```

### Building for Production

```bash
# Build backend image
docker build -t wifi-tracker-backend ./backend

# Build frontend image
docker build -t wifi-tracker-frontend ./frontend

# Run with production settings
docker-compose -f compose.yml up -d
```

## Deployment

### Docker Compose (Recommended)

The application is designed to run with Docker Compose for easy deployment:

```yaml
services:
  timescaledb:    # Database service
  backend:        # API service
  frontend:       # Web interface
```

### Kubernetes

For production Kubernetes deployment:

1. Create ConfigMaps for environment variables
2. Set up persistent volumes for database
3. Configure ingress for external access
4. Set up monitoring and logging

### Monitoring & Observability

- Health check endpoints for load balancers
- Structured logging with configurable levels
- Database connection monitoring
- WebSocket connection tracking

## Security Considerations

- CORS configuration for production
- Input validation with Pydantic
- Database connection security
- Container security best practices
- No sensitive data in error messages

## Performance Optimization

- TimescaleDB automatic partitioning
- Connection pooling for database
- Efficient WebSocket management
- Frontend code splitting
- Docker multi-stage builds
- Nginx optimization for static assets

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check TimescaleDB container status
   - Verify DATABASE_URL configuration
   - Ensure database initialization completed

2. **Frontend Not Loading**
   - Check frontend container logs
   - Verify backend API accessibility
   - Check CORS configuration

3. **No Ping Data**
   - Verify monitoring is started
   - Check network connectivity
   - Review backend logs for errors

4. **WebSocket Connection Issues**
   - Check browser console for errors
   - Verify WebSocket endpoint accessibility
   - Review connection limits

### Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f timescaledb
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Check the troubleshooting section
- Review the API documentation
- Check existing issues in the repository
- Create a new issue with detailed information

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Maintainer**: WiFi Performance Tracker Team