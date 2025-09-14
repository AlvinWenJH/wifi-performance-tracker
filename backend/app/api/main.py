from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os
from dotenv import load_dotenv

# Import routers
from .routers import ping_metrics, websocket

# Import modules
from ..modules.database import db_manager
from ..modules.ping_service import ping_monitor

# Load environment variables
load_dotenv()

# Configure logging
log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events"""
    # Startup
    logger.info("Starting WiFi Performance Tracker Backend")
    
    try:
        # Initialize database connection
        logger.info("Connecting to database...")
        await db_manager.connect()
        logger.info("Database connection established")
        
        # Start ping monitoring
        logger.info("Starting ping monitoring service...")
        await ping_monitor.start_monitoring()
        logger.info("Ping monitoring service started")
        
        logger.info("Application startup completed successfully")
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down WiFi Performance Tracker Backend")
    
    try:
        # Stop ping monitoring
        logger.info("Stopping ping monitoring service...")
        await ping_monitor.stop_monitoring()
        logger.info("Ping monitoring service stopped")
        
        # Close database connection
        logger.info("Closing database connection...")
        await db_manager.disconnect()
        logger.info("Database connection closed")
        
        logger.info("Application shutdown completed successfully")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")

# Create FastAPI app with lifespan manager
app = FastAPI(
    title="WiFi Performance Tracker API",
    description="Real-time WiFi performance monitoring with ping metrics and analytics",
    version="1.0.0",
    root_path="/api",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ping_metrics.router)
app.include_router(websocket.router)

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "WiFi Performance Tracker API",
        "version": "1.0.0",
        "status": "running",
        "monitoring_active": ping_monitor.is_running,
        "endpoints": {
            "ping_metrics": "/api/ping-metrics",
            "websocket": "/api/ws/ping-status",
            "docs": "/api/docs",
            "redoc": "/api/redoc"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Check database connection
        db_healthy = db_manager.pool is not None
        
        # Check ping monitoring
        monitoring_healthy = ping_monitor is not None
        
        # Get basic stats
        target_hosts = ping_monitor.get_target_hosts() if ping_monitor else []
        websocket_clients = len(ping_monitor.websocket_clients) if ping_monitor else 0
        
        health_status = {
            "status": "healthy" if db_healthy and monitoring_healthy else "unhealthy",
            "database": "connected" if db_healthy else "disconnected",
            "ping_monitoring": "active" if ping_monitor.is_running else "inactive",
            "target_hosts_count": len(target_hosts),
            "websocket_clients": websocket_clients,
            "ping_interval_seconds": ping_monitor.ping_interval if ping_monitor else None
        }
        
        return health_status
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail="Service unhealthy")


