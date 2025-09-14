import os
import asyncio
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import TIMESTAMP
from pydantic import BaseModel
import asyncpg
from contextlib import asynccontextmanager

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/wifi_tracker")
ASYNC_DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# SQLAlchemy setup
Base = declarative_base()

class PingMetric(Base):
    __tablename__ = "ping_metrics"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(TIMESTAMP(timezone=True), nullable=False, index=True)
    target_host = Column(String(255), nullable=False, index=True)
    response_time_ms = Column(Float, nullable=True)
    packet_loss = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), nullable=False)

# Pydantic models for API
class PingMetricBase(BaseModel):
    target_host: str
    response_time_ms: Optional[float] = None
    packet_loss: bool = False
    error_message: Optional[str] = None

class PingMetricCreate(PingMetricBase):
    pass

class PingMetricResponse(PingMetricBase):
    id: int
    timestamp: datetime
    created_at: datetime
    
    class Config:
        from_attributes = True

class PingMetricStats(BaseModel):
    hour_bucket: datetime
    target_host: str
    avg_response_time: float
    packet_count: int
    packet_loss_rate: float

class DatabaseManager:
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
        
    async def connect(self):
        """Initialize database connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                DATABASE_URL,
                min_size=1,
                max_size=10,
                command_timeout=60
            )
            print("Database connection pool created successfully")
        except Exception as e:
            print(f"Failed to create database connection pool: {e}")
            raise
    
    async def disconnect(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            print("Database connection pool closed")
    
    @asynccontextmanager
    async def get_connection(self):
        """Get database connection from pool"""
        if not self.pool:
            raise RuntimeError("Database pool not initialized")
        
        async with self.pool.acquire() as connection:
            yield connection
    
    async def insert_ping_metric(self, metric: PingMetricCreate) -> int:
        """Insert a new ping metric record"""
        query = """
            INSERT INTO ping_metrics (timestamp, target_host, response_time_ms, packet_loss, error_message, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
        """
        
        now = datetime.utcnow()
        async with self.get_connection() as conn:
            result = await conn.fetchval(
                query,
                now,
                metric.target_host,
                metric.response_time_ms,
                metric.packet_loss,
                metric.error_message,
                now
            )
            return result
    
    async def get_recent_metrics(self, hours: int = 24, host: Optional[str] = None) -> List[dict]:
        """Get recent ping metrics"""
        base_query = """
            SELECT id, timestamp, target_host, response_time_ms, packet_loss, error_message, created_at
            FROM ping_metrics
            WHERE timestamp >= $1
        """
        
        params = [datetime.utcnow() - timedelta(hours=hours)]
        
        if host:
            base_query += " AND target_host = $2"
            params.append(host)
        
        base_query += " ORDER BY timestamp DESC LIMIT 1000"
        
        async with self.get_connection() as conn:
            rows = await conn.fetch(base_query, *params)
            return [dict(row) for row in rows]
    
    async def get_metrics_stats(self, hours: int = 24, host: Optional[str] = None) -> List[dict]:
        """Get aggregated ping metrics statistics"""
        query = """
            SELECT 
                date_trunc('hour', timestamp) as hour_bucket,
                target_host,
                AVG(response_time_ms) as avg_response_time,
                COUNT(*) as packet_count,
                (COUNT(*) FILTER (WHERE packet_loss = TRUE))::FLOAT / COUNT(*) * 100 as packet_loss_rate
            FROM ping_metrics
            WHERE timestamp >= $1
        """
        
        params = [datetime.utcnow() - timedelta(hours=hours)]
        
        if host:
            query += " AND target_host = $2"
            params.append(host)
        
        query += """
            GROUP BY hour_bucket, target_host
            ORDER BY hour_bucket DESC, target_host
        """
        
        async with self.get_connection() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def get_latest_metric(self, host: str) -> Optional[dict]:
        """Get the latest ping metric for a specific host"""
        query = """
            SELECT id, timestamp, target_host, response_time_ms, packet_loss, error_message, created_at
            FROM ping_metrics
            WHERE target_host = $1
            ORDER BY timestamp DESC
            LIMIT 1
        """
        
        async with self.get_connection() as conn:
            row = await conn.fetchrow(query, host)
            return dict(row) if row else None

# Global database manager instance
db_manager = DatabaseManager()