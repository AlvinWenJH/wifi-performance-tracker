# WiFi Performance Tracker Backend API

A comprehensive real-time WiFi performance monitoring system built with FastAPI, TimescaleDB, and WebSocket support for live data streaming.

## Table of Contents

- [Product Requirements Document (PRD)](#product-requirements-document-prd)
- [Architecture Overview](#architecture-overview)
- [Quick Start](#quick-start)
- [API Documentation](#api-documentation)
- [WebSocket API](#websocket-api)
- [Data Models](#data-models)
- [Database Schema](#database-schema)
- [Configuration](#configuration)
- [Development](#development)
- [Deployment](#deployment)

## Product Requirements Document (PRD)

### 1. Product Overview

**Product Name**: WiFi Performance Tracker Backend API  
**Version**: 1.0.0  
**Purpose**: Provide real-time monitoring, storage, and analysis of WiFi network performance through ping metrics.

### 2. Core Features

#### 2.1 Real-time Monitoring
- **Continuous Ping Monitoring**: Automated ping tests to multiple target hosts
- **Configurable Intervals**: Adjustable ping frequency (default: 1 second)
- **Multi-host Support**: Monitor multiple hosts simultaneously (DNS servers, websites)
- **Live Data Streaming**: Real-time WebSocket updates for connected clients

#### 2.2 Data Storage & Analytics
- **Time-series Database**: TimescaleDB for efficient time-series data storage
- **Historical Data**: Long-term storage with automatic partitioning
- **Performance Metrics**: Response time, packet loss, uptime statistics
- **Data Aggregation**: Hourly, daily, and custom time-range analytics

#### 2.3 REST API
- **CRUD Operations**: Full API for ping metrics management
- **Filtering & Pagination**: Advanced querying capabilities
- **Statistics Endpoints**: Aggregated performance analytics
- **Host Management**: Dynamic addition/removal of monitoring targets

#### 2.4 WebSocket Real-time API
- **Live Updates**: Real-time ping result broadcasting
- **Connection Management**: Multi-client support with connection tracking
- **Event-driven**: Subscribe to specific hosts or global updates

### 3. Technical Requirements

#### 3.1 Performance
- **Response Time**: API responses < 100ms for simple queries
- **Throughput**: Support 1000+ concurrent WebSocket connections
- **Data Retention**: Configurable retention policies (default: unlimited)
- **Scalability**: Horizontal scaling support via container orchestration

#### 3.2 Reliability
- **Uptime**: 99.9% availability target
- **Error Handling**: Comprehensive error responses and logging
- **Health Checks**: Built-in health monitoring endpoints
- **Graceful Shutdown**: Proper cleanup of resources and connections

#### 3.3 Security
- **CORS Support**: Configurable cross-origin resource sharing
- **Input Validation**: Pydantic-based request validation
- **Error Sanitization**: No sensitive data exposure in error messages

### 4. User Stories

#### 4.1 Network Administrator
- **As a** network administrator, **I want to** monitor multiple network endpoints in real-time **so that** I can quickly identify connectivity issues.
- **As a** network administrator, **I want to** view historical performance trends **so that** I can analyze network reliability over time.
- **As a** network administrator, **I want to** receive alerts for network outages **so that** I can respond quickly to issues.

#### 4.2 Developer/Integrator
- **As a** developer, **I want to** access ping data via REST API **so that** I can integrate network monitoring into my applications.
- **As a** developer, **I want to** receive real-time updates via WebSocket **so that** I can build responsive monitoring dashboards.
- **As a** developer, **I want to** add/remove monitoring targets programmatically **so that** I can dynamically adjust monitoring scope.

### 5. Success Metrics

- **API Performance**: 95% of requests completed within 100ms
- **Data Accuracy**: 99.9% successful ping metric collection
- **System Uptime**: 99.9% availability
- **WebSocket Stability**: < 1% connection drop rate
- **Storage Efficiency**: Optimal TimescaleDB compression ratios

---

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   TimescaleDB   │
│   Dashboard     │◄──►│   (FastAPI)     │◄──►│   Database      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────►│   WebSocket     │              │
                         │   Manager       │              │
                         └─────────────────┘              │
                                  │                       │
                         ┌─────────────────┐              │
                         │   Ping Monitor  │──────────────┘
                         │   Service       │
                         └─────────────────┘
```

### Components

1. **FastAPI Application**: RESTful API server with automatic OpenAPI documentation
2. **WebSocket Manager**: Real-time communication handler for live updates
3. **Ping Monitor Service**: Background service for continuous network monitoring
4. **TimescaleDB**: Time-series database for efficient metric storage
5. **Database Manager**: Connection pooling and query management
6. **CRUD Operations**: Data access layer with business logic

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.10+ (for local development)
- PostgreSQL/TimescaleDB (handled by Docker)

### Running with Docker Compose

```bash
# Clone the repository
git clone <repository-url>
cd wifi-performance-tracker

# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs backend
docker-compose logs timescaledb
```

### Local Development

```bash
# Navigate to backend directory
cd backend

# Install dependencies (using uv)
uv sync

# Set environment variables
export DATABASE_URL="postgresql://postgres:password@localhost:5432/wifi_tracker"
export PING_INTERVAL=1

# Run the application
uv run uvicorn app.api.main:app --host 0.0.0.0 --port 8000 --reload
```

### Accessing the API

- **API Base URL**: `http://localhost:8000/api`
- **Interactive Docs**: `http://localhost:8000/api/docs`
- **ReDoc**: `http://localhost:8000/api/redoc`
- **WebSocket**: `ws://localhost:8000/api/ws/ping-status`

---

## API Documentation

### Base Information

- **Base URL**: `/api`
- **Content Type**: `application/json`
- **Response Format**: JSON
- **Error Format**: `{"detail": "Error message"}`

### Core Endpoints

#### 1. Root & Health

##### `GET /`
Get API information and status.

**Response:**
```json
{
  "message": "WiFi Performance Tracker API",
  "version": "1.0.0",
  "status": "running",
  "monitoring_active": true,
  "endpoints": {
    "ping_metrics": "/api/ping-metrics",
    "websocket": "/api/ws/ping-status",
    "docs": "/api/docs",
    "redoc": "/api/redoc"
  }
}
```

##### `GET /health`
Health check endpoint with detailed system status.

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "ping_monitoring": "active",
  "target_hosts_count": 5,
  "websocket_clients": 3,
  "ping_interval_seconds": 1
}
```

#### 2. Ping Metrics

##### `GET /ping-metrics/`
Retrieve ping metrics with filtering and pagination.

**Query Parameters:**
- `hours` (int, 1-168): Hours of data to retrieve (default: 24)
- `host` (string, optional): Filter by specific host
- `limit` (int, 1-10000): Maximum records (default: 1000)
- `offset` (int): Records to skip (default: 0)

**Example:**
```bash
curl "http://localhost:8000/api/ping-metrics/?hours=12&host=8.8.8.8&limit=100"
```

**Response:**
```json
[
  {
    "id": 12345,
    "timestamp": "2024-01-15T10:30:00Z",
    "target_host": "8.8.8.8",
    "response_time_ms": 15.5,
    "packet_loss": false,
    "error_message": null,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

##### `GET /ping-metrics/latest`
Get the latest ping metric for each monitored host.

**Response:**
```json
{
  "8.8.8.8": {
    "id": 12345,
    "timestamp": "2024-01-15T10:30:00Z",
    "target_host": "8.8.8.8",
    "response_time_ms": 15.5,
    "packet_loss": false,
    "error_message": null,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "1.1.1.1": {
    "id": 12346,
    "timestamp": "2024-01-15T10:30:01Z",
    "target_host": "1.1.1.1",
    "response_time_ms": 12.3,
    "packet_loss": false,
    "error_message": null,
    "created_at": "2024-01-15T10:30:01Z"
  }
}
```

##### `GET /ping-metrics/live`
Get real-time ping results from the monitoring service.

**Response:**
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "results": {
    "8.8.8.8": {
      "host": "8.8.8.8",
      "response_time_ms": 15.5,
      "packet_loss": false,
      "timestamp": "2024-01-15T10:30:00Z",
      "error_message": null
    }
  },
  "monitoring_active": true
}
```

##### `GET /ping-metrics/statistics`
Get aggregated ping statistics.

**Query Parameters:**
- `hours` (int, 1-168): Hours of data to analyze (default: 24 if neither hours nor minutes is provided)
- `minutes` (int, 1-10080): Minutes of data to analyze (alternative to hours parameter)
- `host` (string, optional): Filter by specific host

**Response:**
```json
{
  "total_pings": 86400,
  "avg_response_time": 18.5,
  "min_response_time": 8.2,
  "max_response_time": 150.0,
  "median_response_time": 16.1,
  "p95_response_time": 35.2,
  "packet_loss_rate": 0.05,
  "uptime_percentage": 99.95,
  "hours_analyzed": 24
}
```

##### `GET /ping-metrics/hosts`
Get list of all monitored hosts.

**Response:**
```json
{
  "database_hosts": ["8.8.8.8", "1.1.1.1", "google.com"],
  "active_monitoring_hosts": ["8.8.8.8", "1.1.1.1", "208.67.222.222", "google.com", "github.com"],
  "monitoring_active": true
}
```

##### `GET /ping-metrics/hosts/{host}/summary`
Get comprehensive summary for a specific host.

**Path Parameters:**
- `host` (string): Target host to analyze

**Query Parameters:**
- `hours` (int, 1-168): Hours of data to analyze (default: 24)

**Response:**
```json
{
  "host": "8.8.8.8",
  "hours_analyzed": 24,
  "minutes_analyzed": 1440,
  "total_pings": 86400,
  "avg_response_time": 18.5,
  "min_response_time": 8.2,
  "max_response_time": 150.0,
  "median_response_time": 16.1,
  "p95_response_time": 35.2,
  "packet_losses": 43,
  "packet_loss_rate": 0.05,
  "uptime_percentage": 99.95,
  "first_ping": "2024-01-14T10:30:00Z",
  "last_ping": "2024-01-15T10:30:00Z"
}
```

##### `GET /ping-metrics/hosts/{host}/downtime`
Get downtime periods for a specific host.

**Path Parameters:**
- `host` (string): Target host to analyze

**Query Parameters:**
- `hours` (int, 1-168): Hours of data to analyze (default: 24)
- `min_duration` (int): Minimum downtime duration in seconds (default: 30)

**Response:**
```json
{
  "host": "8.8.8.8",
  "hours_analyzed": 24,
  "min_duration_seconds": 30,
  "downtime_periods": [
    {
      "start_time": "2024-01-15T08:15:00Z",
      "end_time": "2024-01-15T08:17:30Z",
      "duration_seconds": 150,
      "affected_pings": 150
    }
  ],
  "total_downtime_events": 1
}
```

##### `GET /ping-metrics/count`
Get total count of ping metrics.

**Query Parameters:**
- `host` (string, optional): Filter by specific host
- `hours` (int, optional): Hours of data to count

**Response:**
```json
{
  "count": 86400
}
```

##### `GET /ping-metrics/{metric_id}`
Get a specific ping metric by ID.

**Path Parameters:**
- `metric_id` (int): Ping metric ID

**Response:**
```json
{
  "id": 12345,
  "timestamp": "2024-01-15T10:30:00Z",
  "target_host": "8.8.8.8",
  "response_time_ms": 15.5,
  "packet_loss": false,
  "error_message": null,
  "created_at": "2024-01-15T10:30:00Z"
}
```

##### `POST /ping-metrics/`
Create a new ping metric record (for manual testing).

**Request Body:**
```json
{
  "target_host": "example.com",
  "response_time_ms": 25.5,
  "packet_loss": false,
  "error_message": null
}
```

**Response:**
```json
{
  "id": 12347,
  "message": "Ping metric created successfully",
  "metric": {
    "target_host": "example.com",
    "response_time_ms": 25.5,
    "packet_loss": false,
    "error_message": null
  }
}
```

#### 3. Host Management

##### `POST /ping-metrics/hosts/{host}/add`
Add a new host to the monitoring list.

**Path Parameters:**
- `host` (string): Host to add to monitoring

**Response:**
```json
{
  "message": "Host example.com added to monitoring",
  "current_hosts": ["8.8.8.8", "1.1.1.1", "example.com"]
}
```

##### `DELETE /ping-metrics/hosts/{host}`
Remove a host from the monitoring list.

**Path Parameters:**
- `host` (string): Host to remove from monitoring

**Response:**
```json
{
  "message": "Host example.com removed from monitoring",
  "current_hosts": ["8.8.8.8", "1.1.1.1"]
}
```

#### 4. Monitoring Control

##### `GET /ping-metrics/monitoring/status`
Get current status of the ping monitoring service.

**Response:**
```json
{
  "monitoring_active": true,
  "ping_interval_seconds": 1,
  "target_hosts": ["8.8.8.8", "1.1.1.1", "208.67.222.222", "google.com", "github.com"],
  "websocket_clients": 3,
  "latest_results_count": 5
}
```

##### `POST /ping-metrics/monitoring/start`
Start the ping monitoring service.

**Response:**
```json
{
  "message": "Ping monitoring started",
  "status": "active"
}
```

##### `POST /ping-metrics/monitoring/stop`
Stop the ping monitoring service.

**Response:**
```json
{
  "message": "Ping monitoring stopped",
  "status": "inactive"
}
```

#### 5. Data Management

##### `DELETE /ping-metrics/cleanup`
Delete old ping metrics to free up storage.

**Query Parameters:**
- `days` (int, 1-365): Delete metrics older than this many days (default: 30)

**Response:**
```json
{
  "message": "Cleanup completed",
  "deleted_records": 1500000,
  "cutoff_days": 30
}
```

---

## WebSocket API

### Connection

**Endpoint**: `ws://localhost:8000/api/ws/ping-status`

### Message Types

#### Client to Server Messages

##### Ping (Keep-alive)
```json
{"type": "ping"}
```

##### Get Status
```json
{"type": "get_status"}
```

##### Get Latest Metrics
```json
{"type": "get_latest_metrics"}
```

##### Subscribe to Host
```json
{
  "type": "subscribe_host",
  "host": "8.8.8.8"
}
```

##### Get Host Summary
```json
{
  "type": "get_host_summary",
  "host": "8.8.8.8",
  "hours": 24
}
```

#### Server to Client Messages

##### Connection Established
```json
{
  "type": "connection_established",
  "connection_id": "conn_1",
  "message": "WebSocket connection established"
}
```

##### Ping Result (Real-time)
```json
{
  "type": "ping_result",
  "result": {
    "host": "8.8.8.8",
    "response_time_ms": 15.5,
    "packet_loss": false,
    "timestamp": "2024-01-15T10:30:00Z",
    "error_message": null
  }
}
```

##### Initial Data
```json
{
  "type": "initial_data",
  "results": {
    "8.8.8.8": {
      "host": "8.8.8.8",
      "response_time_ms": 15.5,
      "packet_loss": false,
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }
}
```

##### Status Response
```json
{
  "type": "status_response",
  "monitoring_active": true,
  "target_hosts": ["8.8.8.8", "1.1.1.1"],
  "websocket_clients": 3
}
```

##### Error
```json
{
  "type": "error",
  "message": "Invalid message format"
}
```

### WebSocket Connection Info

##### `GET /ws/connections`
Get information about active WebSocket connections.

**Response:**
```json
{
  "active_connections": 3,
  "ping_monitor_clients": 3,
  "monitoring_active": true
}
```

---

## Data Models

### PingMetricBase
```python
class PingMetricBase(BaseModel):
    target_host: str
    response_time_ms: Optional[float] = None
    packet_loss: bool = False
    error_message: Optional[str] = None
```

### PingMetricCreate
```python
class PingMetricCreate(PingMetricBase):
    pass
```

### PingMetricResponse
```python
class PingMetricResponse(PingMetricBase):
    id: int
    timestamp: datetime
    created_at: datetime
```

### PingMetricStats
```python
class PingMetricStats(BaseModel):
    hour_bucket: datetime
    target_host: str
    avg_response_time: float
    packet_count: int
    packet_loss_rate: float
```

---

## Database Schema

### ping_metrics Table

```sql
CREATE TABLE ping_metrics (
    id SERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    target_host TEXT NOT NULL,
    response_time_ms DOUBLE PRECISION,
    packet_loss BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('ping_metrics', 'timestamp');

-- Indexes for performance
CREATE INDEX idx_ping_metrics_host_time ON ping_metrics (target_host, timestamp DESC);
CREATE INDEX idx_ping_metrics_timestamp ON ping_metrics (timestamp DESC);
```

### Views and Functions

#### recent_ping_metrics View
```sql
CREATE VIEW recent_ping_metrics AS
SELECT * FROM ping_metrics
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

#### get_avg_response_time_by_hour Function
```sql
CREATE OR REPLACE FUNCTION get_avg_response_time_by_hour(host VARCHAR, hours INT)
RETURNS TABLE(
    hour_bucket TIMESTAMPTZ,
    avg_response_time DOUBLE PRECISION,
    packet_count BIGINT,
    packet_loss_rate DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        time_bucket('1 hour', timestamp) as hour_bucket,
        AVG(response_time_ms) as avg_response_time,
        COUNT(*) as packet_count,
        (COUNT(*) FILTER (WHERE packet_loss = TRUE))::DOUBLE PRECISION / COUNT(*) * 100 as packet_loss_rate
    FROM ping_metrics
    WHERE target_host = host
      AND timestamp >= NOW() - (hours || ' hours')::INTERVAL
    GROUP BY hour_bucket
    ORDER BY hour_bucket DESC;
END;
$$ LANGUAGE plpgsql;
```

---

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/wifi_tracker` | Yes |
| `PING_INTERVAL` | Ping interval in seconds | `1` | No |
| `LOG_LEVEL` | Logging level | `INFO` | No |
| `CORS_ORIGINS` | Allowed CORS origins | `*` | No |

### Docker Compose Configuration

```yaml
services:
  backend:
    environment:
      DATABASE_URL: postgresql://postgres:password@timescaledb:5432/wifi_tracker
      PING_INTERVAL: 1
    ports:
      - "8000:8000"
    depends_on:
      timescaledb:
        condition: service_healthy
```

### Default Monitoring Targets

- `8.8.8.8` - Google DNS
- `1.1.1.1` - Cloudflare DNS
- `208.67.222.222` - OpenDNS
- `google.com` - Google
- `github.com` - GitHub

---

## Development

### Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── main.py              # FastAPI application
│   │   └── routers/
│   │       ├── ping_metrics.py  # Ping metrics endpoints
│   │       └── websocket.py     # WebSocket endpoints
│   └── modules/
│       ├── database.py          # Database models and manager
│       ├── crud.py              # Database operations
│       └── ping_service.py      # Ping monitoring service
├── Dockerfile
├── pyproject.toml
└── README.md
```

### Dependencies

- **FastAPI**: Web framework
- **Uvicorn**: ASGI server
- **AsyncPG**: Async PostgreSQL driver
- **Pydantic**: Data validation
- **Ping3**: Ping implementation
- **WebSockets**: Real-time communication
- **SQLAlchemy**: ORM (for models)
- **Python-dotenv**: Environment management

### Running Tests

```bash
# Install test dependencies
uv add --dev pytest pytest-asyncio httpx

# Run tests
uv run pytest

# Run with coverage
uv run pytest --cov=app
```

### Code Quality

```bash
# Format code
uv run black app/

# Lint code
uv run flake8 app/

# Type checking
uv run mypy app/
```

### Adding New Endpoints

1. Add endpoint to appropriate router in `app/api/routers/`
2. Add database operations to `app/modules/crud.py`
3. Update data models in `app/modules/database.py`
4. Add tests in `tests/`
5. Update this documentation

---

## Deployment

### Docker Production Build

```bash
# Build production image
docker build -t wifi-tracker-backend:latest .

# Run with production settings
docker run -d \
  --name wifi-tracker-backend \
  -p 8000:8000 \
  -e DATABASE_URL="postgresql://user:pass@db:5432/wifi_tracker" \
  -e PING_INTERVAL=1 \
  wifi-tracker-backend:latest
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wifi-tracker-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: wifi-tracker-backend
  template:
    metadata:
      labels:
        app: wifi-tracker-backend
    spec:
      containers:
      - name: backend
        image: wifi-tracker-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: PING_INTERVAL
          value: "1"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Production Considerations

1. **Security**:
   - Configure CORS origins properly
   - Use environment variables for secrets
   - Enable HTTPS/TLS
   - Implement rate limiting

2. **Performance**:
   - Use connection pooling
   - Configure TimescaleDB retention policies
   - Monitor memory usage
   - Scale horizontally as needed

3. **Monitoring**:
   - Set up application monitoring
   - Configure log aggregation
   - Monitor database performance
   - Set up alerting for downtime

4. **Backup**:
   - Regular database backups
   - Test restore procedures
   - Monitor backup integrity

---

## API Examples

### cURL Examples

```bash
# Get latest metrics
curl "http://localhost:8000/api/ping-metrics/latest"

# Get statistics for last 12 hours
curl "http://localhost:8000/api/ping-metrics/statistics?hours=12"

# Get host summary
curl "http://localhost:8000/api/ping-metrics/hosts/8.8.8.8/summary?hours=24"

# Add new monitoring host
curl -X POST "http://localhost:8000/api/ping-metrics/hosts/example.com/add"

# Get monitoring status
curl "http://localhost:8000/api/ping-metrics/monitoring/status"
```

### Python Client Example

```python
import asyncio
import aiohttp
import websockets
import json

class WiFiTrackerClient:
    def __init__(self, base_url="http://localhost:8000/api"):
        self.base_url = base_url
        self.ws_url = base_url.replace("http", "ws") + "/ws/ping-status"
    
    async def get_latest_metrics(self):
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.base_url}/ping-metrics/latest") as resp:
                return await resp.json()
    
    async def listen_to_updates(self):
        async with websockets.connect(self.ws_url) as websocket:
            async for message in websocket:
                data = json.loads(message)
                print(f"Received: {data}")
                
                if data.get('type') == 'ping_result':
                    result = data['result']
                    print(f"Ping to {result['host']}: {result['response_time_ms']}ms")

# Usage
async def main():
    client = WiFiTrackerClient()
    
    # Get latest metrics
    metrics = await client.get_latest_metrics()
    print("Latest metrics:", metrics)
    
    # Listen to real-time updates
    await client.listen_to_updates()

asyncio.run(main())
```

### JavaScript Client Example

```javascript
class WiFiTrackerClient {
    constructor(baseUrl = 'http://localhost:8000/api') {
        this.baseUrl = baseUrl;
        this.wsUrl = baseUrl.replace('http', 'ws') + '/ws/ping-status';
    }
    
    async getLatestMetrics() {
        const response = await fetch(`${this.baseUrl}/ping-metrics/latest`);
        return await response.json();
    }
    
    connectWebSocket() {
        const ws = new WebSocket(this.wsUrl);
        
        ws.onopen = () => {
            console.log('Connected to WiFi Tracker WebSocket');
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received:', data);
            
            if (data.type === 'ping_result') {
                const result = data.result;
                console.log(`Ping to ${result.host}: ${result.response_time_ms}ms`);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        return ws;
    }
}

// Usage
const client = new WiFiTrackerClient();

// Get latest metrics
client.getLatestMetrics().then(metrics => {
    console.log('Latest metrics:', metrics);
});

// Connect to real-time updates
const ws = client.connectWebSocket();
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Issues
```bash
# Check database status
docker-compose logs timescaledb

# Test connection
docker-compose exec timescaledb psql -U postgres -d wifi_tracker -c "SELECT NOW();"
```

#### 2. Ping Monitoring Not Working
```bash
# Check monitoring status
curl "http://localhost:8000/api/ping-metrics/monitoring/status"

# Restart monitoring
curl -X POST "http://localhost:8000/api/ping-metrics/monitoring/stop"
curl -X POST "http://localhost:8000/api/ping-metrics/monitoring/start"
```

#### 3. WebSocket Connection Issues
```bash
# Check WebSocket connections
curl "http://localhost:8000/api/ws/connections"

# Check backend logs
docker-compose logs backend
```

#### 4. Performance Issues
```bash
# Check database performance
docker-compose exec timescaledb psql -U postgres -d wifi_tracker -c "
  SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
  FROM pg_stat_user_tables WHERE tablename = 'ping_metrics';
"

# Check TimescaleDB chunks
docker-compose exec timescaledb psql -U postgres -d wifi_tracker -c "
  SELECT chunk_name, range_start, range_end 
  FROM timescaledb_information.chunks 
  WHERE hypertable_name = 'ping_metrics';
"
```

### Logs and Debugging

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f timescaledb

# Enable debug logging
docker-compose exec backend env LOG_LEVEL=DEBUG uvicorn app.api.main:app --reload
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Update documentation
6. Submit a pull request

### Development Workflow

```bash
# Setup development environment
git clone <repository>
cd wifi-performance-tracker/backend
uv sync

# Create feature branch
git checkout -b feature/new-endpoint

# Make changes and test
uv run pytest

# Format and lint
uv run black app/
uv run flake8 app/

# Commit and push
git add .
git commit -m "Add new endpoint for X"
git push origin feature/new-endpoint
```

---

## License

This project is licensed under the MIT License. See LICENSE file for details.

---

## Support

For support and questions:

- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation at `/api/docs`

---

**Last Updated**: January 2024  
**Version**: 1.0.0