from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from .database import db_manager, PingMetricCreate, PingMetricResponse, PingMetricStats
import logging

logger = logging.getLogger(__name__)


class PingMetricsCRUD:
    def __init__(self):
        self.db = db_manager

    async def create_ping_metric(self, metric: PingMetricCreate) -> int:
        """Create a new ping metric record"""
        try:
            metric_id = await self.db.insert_ping_metric(metric)
            logger.info(f"Created ping metric with ID: {metric_id}")
            return metric_id
        except Exception as e:
            logger.error(f"Failed to create ping metric: {e}")
            raise

    async def get_ping_metrics(
        self,
        hours: int = 24,
        host: Optional[str] = None,
        limit: int = 1000,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Get ping metrics with optional filtering"""
        try:
            metrics = await self.db.get_recent_metrics(hours=hours, host=host)

            # Apply pagination
            start_idx = offset
            end_idx = offset + limit
            paginated_metrics = metrics[start_idx:end_idx]

            logger.info(f"Retrieved {len(paginated_metrics)} ping metrics")
            return paginated_metrics
        except Exception as e:
            logger.error(f"Failed to get ping metrics: {e}")
            raise

    async def get_ping_metric_by_id(self, metric_id: int) -> Optional[Dict[str, Any]]:
        """Get a specific ping metric by ID"""
        try:
            query = """
                SELECT id, timestamp, target_host, response_time_ms, packet_loss, error_message, created_at
                FROM ping_metrics
                WHERE id = $1
            """

            async with self.db.get_connection() as conn:
                row = await conn.fetchrow(query, metric_id)
                if row:
                    logger.info(f"Retrieved ping metric with ID: {metric_id}")
                    return dict(row)
                else:
                    logger.warning(f"Ping metric with ID {metric_id} not found")
                    return None
        except Exception as e:
            logger.error(f"Failed to get ping metric by ID {metric_id}: {e}")
            raise

    async def get_latest_metrics_by_host(self) -> Dict[str, Dict[str, Any]]:
        """Get the latest ping metric for each host"""
        try:
            query = """
                SELECT DISTINCT ON (target_host) 
                    id, timestamp, target_host, response_time_ms, packet_loss, error_message, created_at
                FROM ping_metrics
                ORDER BY target_host, timestamp DESC
            """

            async with self.db.get_connection() as conn:
                rows = await conn.fetch(query)

            result = {}
            for row in rows:
                result[row["target_host"]] = dict(row)

            logger.info(f"Retrieved latest metrics for {len(result)} hosts")
            return result
        except Exception as e:
            logger.error(f"Failed to get latest metrics by host: {e}")
            raise

    async def get_ping_statistics(
        self, hours: int = 24, host: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get aggregated ping statistics"""
        try:
            stats = await self.db.get_metrics_stats(hours=hours, host=host)
            logger.info(f"Retrieved ping statistics for {len(stats)} time buckets")
            return stats
        except Exception as e:
            logger.error(f"Failed to get ping statistics: {e}")
            raise

    async def get_host_summary(
        self, host: str, hours: int = None, minutes: int = None
    ) -> Dict[str, Any]:
        """Get comprehensive summary for a specific host"""
        try:
            query = """
                SELECT 
                    COUNT(*) as total_pings,
                    AVG(response_time_ms) as avg_response_time,
                    MIN(response_time_ms) as min_response_time,
                    MAX(response_time_ms) as max_response_time,
                    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_ms) as median_response_time,
                    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) as p95_response_time,
                    COUNT(*) FILTER (WHERE packet_loss = TRUE) as packet_losses,
                    (COUNT(*) FILTER (WHERE packet_loss = TRUE))::FLOAT / COUNT(*) as packet_loss_rate,
                    MIN(timestamp) as first_ping,
                    MAX(timestamp) as last_ping
                FROM ping_metrics
                WHERE target_host = $1 AND timestamp >= $2
            """

            # Default to 24 hours if neither hours nor minutes is provided
            if hours is None and minutes is None:
                hours = 24

            # Calculate the time delta based on either hours or minutes
            if minutes is not None:
                since_time = datetime.utcnow() - timedelta(minutes=minutes)
                time_analyzed_minutes = minutes
                time_analyzed_hours = round(minutes / 60, 2)
            else:
                since_time = datetime.utcnow() - timedelta(hours=hours)
                time_analyzed_hours = hours
                time_analyzed_minutes = hours * 60

            async with self.db.get_connection() as conn:
                row = await conn.fetchrow(query, host, since_time)

            if row:
                summary = dict(row)
                summary["host"] = host
                summary["hours_analyzed"] = time_analyzed_hours
                summary["minutes_analyzed"] = time_analyzed_minutes

                # Calculate uptime percentage
                if summary["total_pings"] > 0:
                    summary["uptime_percentage"] = 100 - summary["packet_loss_rate"]
                else:
                    summary["uptime_percentage"] = 0

                logger.info(f"Generated summary for host {host}")
                return summary
            else:
                return {
                    "host": host,
                    "hours_analyzed": time_analyzed_hours,
                    "minutes_analyzed": time_analyzed_minutes,
                    "total_pings": 0,
                    "uptime_percentage": 0,
                }
        except Exception as e:
            logger.error(f"Failed to get host summary for {host}: {e}")
            raise

    async def get_all_hosts(self) -> List[str]:
        """Get list of all monitored hosts"""
        try:
            query = "SELECT DISTINCT target_host FROM ping_metrics ORDER BY target_host"

            async with self.db.get_connection() as conn:
                rows = await conn.fetch(query)

            hosts = [row["target_host"] for row in rows]
            logger.info(f"Retrieved {len(hosts)} unique hosts")
            return hosts
        except Exception as e:
            logger.error(f"Failed to get all hosts: {e}")
            raise

    async def delete_old_metrics(self, days: int = 30) -> int:
        """Delete ping metrics older than specified days"""
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            query = "DELETE FROM ping_metrics WHERE timestamp < $1"

            async with self.db.get_connection() as conn:
                result = await conn.execute(query, cutoff_date)

            # Extract number of deleted rows from result
            deleted_count = int(result.split()[-1]) if result else 0

            logger.info(
                f"Deleted {deleted_count} old ping metrics (older than {days} days)"
            )
            return deleted_count
        except Exception as e:
            logger.error(f"Failed to delete old metrics: {e}")
            raise

    async def get_metrics_count(
        self, host: Optional[str] = None, hours: Optional[int] = None
    ) -> int:
        """Get total count of ping metrics with optional filtering"""
        try:
            base_query = "SELECT COUNT(*) FROM ping_metrics WHERE 1=1"
            params = []

            if hours:
                base_query += " AND timestamp >= $" + str(len(params) + 1)
                params.append(datetime.utcnow() - timedelta(hours=hours))

            if host:
                base_query += " AND target_host = $" + str(len(params) + 1)
                params.append(host)

            async with self.db.get_connection() as conn:
                count = await conn.fetchval(base_query, *params)

            logger.info(f"Total metrics count: {count}")
            return count
        except Exception as e:
            logger.error(f"Failed to get metrics count: {e}")
            raise

    async def get_downtime_periods(
        self, host: str, hours: int = 24, min_duration_seconds: int = 30
    ) -> List[Dict[str, Any]]:
        """Get periods of downtime for a specific host"""
        try:
            query = """
                WITH downtime_events AS (
                    SELECT 
                        timestamp,
                        packet_loss,
                        LAG(packet_loss) OVER (ORDER BY timestamp) as prev_packet_loss
                    FROM ping_metrics
                    WHERE target_host = $1 AND timestamp >= $2
                    ORDER BY timestamp
                ),
                downtime_starts AS (
                    SELECT timestamp as start_time
                    FROM downtime_events
                    WHERE packet_loss = TRUE AND (prev_packet_loss = FALSE OR prev_packet_loss IS NULL)
                ),
                downtime_ends AS (
                    SELECT timestamp as end_time
                    FROM downtime_events
                    WHERE packet_loss = FALSE AND prev_packet_loss = TRUE
                )
                SELECT 
                    ds.start_time,
                    de.end_time,
                    EXTRACT(EPOCH FROM (de.end_time - ds.start_time)) as duration_seconds
                FROM downtime_starts ds
                LEFT JOIN downtime_ends de ON de.end_time > ds.start_time
                WHERE EXTRACT(EPOCH FROM (de.end_time - ds.start_time)) >= $3
                ORDER BY ds.start_time DESC
            """

            since_time = datetime.utcnow() - timedelta(hours=hours)

            async with self.db.get_connection() as conn:
                rows = await conn.fetch(query, host, since_time, min_duration_seconds)

            downtime_periods = [dict(row) for row in rows]
            logger.info(f"Found {len(downtime_periods)} downtime periods for {host}")
            return downtime_periods
        except Exception as e:
            logger.error(f"Failed to get downtime periods for {host}: {e}")
            raise


# Global CRUD instance
ping_crud = PingMetricsCRUD()
