from fastapi import APIRouter, HTTPException, Query, Path
from typing import List, Optional, Dict, Any
from datetime import datetime
from ...modules.crud import ping_crud
from ...modules.ping_service import ping_monitor
from ...modules.database import PingMetricCreate, PingMetricResponse
import logging
import requests

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ping-metrics", tags=["ping-metrics"])


@router.get("/", response_model=List[Dict[str, Any]])
async def get_ping_metrics(
    hours: int = Query(
        24, ge=1, le=168, description="Hours of data to retrieve (1-168)"
    ),
    host: Optional[str] = Query(None, description="Filter by specific host"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum number of records"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
):
    """Get ping metrics with optional filtering and pagination"""
    try:
        metrics = await ping_crud.get_ping_metrics(
            hours=hours, host=host, limit=limit, offset=offset
        )
        return metrics
    except Exception as e:
        logger.error(f"Failed to get ping metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve ping metrics")


@router.get("/time-range/", response_model=List[Dict[str, Any]])
async def get_ping_metrics_by_time_range(
    minutes: int = Query(
        None, ge=1, le=300, description="Minutes of data to retrieve (1-300)"
    ),
    host: Optional[str] = Query(None, description="Filter by specific host"),
    limit: int = Query(1000, ge=1, le=10000, description="Maximum number of records"),
):
    """Get ping metrics for specific time ranges (10m, 1h, 5h)"""
    try:
        if minutes is None:
            raise HTTPException(status_code=400, detail="Minutes parameter is required")

        # Convert minutes to hours for the existing function
        hours = minutes / 60

        metrics = await ping_crud.get_ping_metrics(
            hours=hours, host=host, limit=limit, offset=0
        )
        return metrics
    except Exception as e:
        logger.error(f"Failed to get ping metrics by time range: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve ping metrics by time range"
        )


@router.get("/count")
async def get_metrics_count(
    host: Optional[str] = Query(None, description="Filter by specific host"),
    hours: Optional[int] = Query(
        None, ge=1, le=168, description="Hours of data to count"
    ),
):
    """Get total count of ping metrics"""
    try:
        count = await ping_crud.get_metrics_count(host=host, hours=hours)
        return {"count": count}
    except Exception as e:
        logger.error(f"Failed to get metrics count: {e}")
        raise HTTPException(status_code=500, detail="Failed to get metrics count")


@router.get("/latest")
async def get_latest_metrics():
    """Get the latest ping metric for each monitored host"""
    try:
        latest_metrics = await ping_crud.get_latest_metrics_by_host()
        return latest_metrics
    except Exception as e:
        logger.error(f"Failed to get latest metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve latest metrics")


@router.get("/live")
async def get_live_metrics():
    """Get the most recent ping results from the monitoring service"""
    try:
        live_results = ping_monitor.get_latest_results()
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "results": live_results,
            "monitoring_active": ping_monitor.is_running,
        }
    except Exception as e:
        logger.error(f"Failed to get live metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve live metrics")


@router.get("/statistics")
async def get_ping_statistics(
    hours: int = Query(24, ge=1, le=168, description="Hours of data to analyze"),
    host: Optional[str] = Query(None, description="Filter by specific host"),
):
    """Get aggregated ping statistics"""
    try:
        stats = await ping_crud.get_ping_statistics(hours=hours, host=host)
        return stats
    except Exception as e:
        logger.error(f"Failed to get ping statistics: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve ping statistics"
        )


@router.get("/hosts")
async def get_monitored_hosts():
    """Get list of all monitored hosts"""
    try:
        # Get hosts from database
        db_hosts = await ping_crud.get_all_hosts()

        # Get currently configured hosts from ping monitor
        active_hosts = ping_monitor.get_target_hosts()

        return {
            "database_hosts": db_hosts,
            "active_monitoring_hosts": active_hosts,
            "monitoring_active": ping_monitor.is_running,
        }
    except Exception as e:
        logger.error(f"Failed to get monitored hosts: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve monitored hosts"
        )


@router.get("/hosts/{host}/summary")
async def get_host_summary(
    host: str = Path(..., description="Target host to analyze"),
    hours: int = Query(None, ge=1, le=168, description="Hours of data to analyze"),
    minutes: int = Query(
        None, ge=1, le=10080, description="Minutes of data to analyze"
    ),
):
    """Get comprehensive summary for a specific host"""
    try:
        # Default to 24 hours if neither hours nor minutes is provided
        if hours is None and minutes is None:
            hours = 24

        # If minutes is provided, convert to hours for the backend function
        if minutes is not None:
            summary = await ping_crud.get_host_summary(host=host, minutes=minutes)
        else:
            summary = await ping_crud.get_host_summary(host=host, hours=hours)

        return summary
    except Exception as e:
        logger.error(f"Failed to get host summary for {host}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve summary for host {host}"
        )


@router.get("/hosts/{host}/downtime")
async def get_host_downtime(
    host: str = Path(..., description="Target host to analyze"),
    hours: int = Query(24, ge=1, le=168, description="Hours of data to analyze"),
    min_duration: int = Query(
        30, ge=1, description="Minimum downtime duration in seconds"
    ),
):
    """Get downtime periods for a specific host"""
    try:
        downtime_periods = await ping_crud.get_downtime_periods(
            host=host, hours=hours, min_duration_seconds=min_duration
        )
        return {
            "host": host,
            "hours_analyzed": hours,
            "min_duration_seconds": min_duration,
            "downtime_periods": downtime_periods,
            "total_downtime_events": len(downtime_periods),
        }
    except Exception as e:
        logger.error(f"Failed to get downtime for {host}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to retrieve downtime for host {host}"
        )


@router.get("/{metric_id}")
async def get_ping_metric(metric_id: int = Path(..., description="Ping metric ID")):
    """Get a specific ping metric by ID"""
    try:
        metric = await ping_crud.get_ping_metric_by_id(metric_id)
        if not metric:
            raise HTTPException(status_code=404, detail="Ping metric not found")
        return metric
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get ping metric {metric_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve ping metric")


@router.post("/", response_model=Dict[str, Any])
async def create_ping_metric(metric: PingMetricCreate):
    """Create a new ping metric record (for manual testing)"""
    try:
        metric_id = await ping_crud.create_ping_metric(metric)
        return {
            "id": metric_id,
            "message": "Ping metric created successfully",
            "metric": metric.dict(),
        }
    except Exception as e:
        logger.error(f"Failed to create ping metric: {e}")
        raise HTTPException(status_code=500, detail="Failed to create ping metric")


@router.post("/hosts/{host}/add")
async def add_monitoring_host(
    host: str = Path(..., description="Host to add to monitoring"),
):
    """Add a new host to the monitoring list"""
    try:
        ping_monitor.add_target_host(host)
        return {
            "message": f"Host {host} added to monitoring",
            "current_hosts": ping_monitor.get_target_hosts(),
        }
    except Exception as e:
        logger.error(f"Failed to add host {host}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to add host {host} to monitoring"
        )


@router.delete("/hosts/{host}")
async def remove_monitoring_host(
    host: str = Path(..., description="Host to remove from monitoring"),
):
    """Remove a host from the monitoring list"""
    try:
        ping_monitor.remove_target_host(host)
        return {
            "message": f"Host {host} removed from monitoring",
            "current_hosts": ping_monitor.get_target_hosts(),
        }
    except Exception as e:
        logger.error(f"Failed to remove host {host}: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to remove host {host} from monitoring"
        )


@router.delete("/cleanup")
async def cleanup_old_metrics(
    days: int = Query(
        30, ge=1, le=365, description="Delete metrics older than this many days"
    ),
):
    """Delete old ping metrics to free up storage"""
    try:
        deleted_count = await ping_crud.delete_old_metrics(days=days)
        return {
            "message": f"Cleanup completed",
            "deleted_records": deleted_count,
            "cutoff_days": days,
        }
    except Exception as e:
        logger.error(f"Failed to cleanup old metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to cleanup old metrics")


@router.get("/monitoring/status")
async def get_monitoring_status():
    """Get current status of the ping monitoring service"""
    try:
        return {
            "monitoring_active": ping_monitor.is_running,
            "ping_interval_seconds": ping_monitor.ping_interval,
            "target_hosts": ping_monitor.get_target_hosts(),
            "websocket_clients": len(ping_monitor.websocket_clients),
            "latest_results_count": len(ping_monitor.get_latest_results()),
        }
    except Exception as e:
        logger.error(f"Failed to get monitoring status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get monitoring status")


@router.post("/monitoring/start")
async def start_monitoring():
    """Start the ping monitoring service"""
    try:
        await ping_monitor.start_monitoring()
        return {"message": "Ping monitoring started", "status": "active"}
    except Exception as e:
        logger.error(f"Failed to start monitoring: {e}")
        raise HTTPException(status_code=500, detail="Failed to start monitoring")


@router.post("/monitoring/stop")
async def stop_monitoring():
    """Stop the ping monitoring service"""
    try:
        await ping_monitor.stop_monitoring()
        return {"message": "Ping monitoring stopped", "status": "inactive"}
    except Exception as e:
        logger.error(f"Failed to stop monitoring: {e}")
        raise HTTPException(status_code=500, detail="Failed to stop monitoring")


# Simple in-memory cache for ISP info
_isp_cache = {"data": None, "timestamp": 0}
ISP_CACHE_TTL = 3600  # Cache for 1 hour


@router.get("/isp-info/")
async def get_isp_info():
    """Get ISP provider information with caching to avoid rate limits"""
    import time

    # Check cache first
    current_time = time.time()
    if (
        _isp_cache["data"] is not None
        and current_time - _isp_cache["timestamp"] < ISP_CACHE_TTL
    ):
        logger.info("Returning cached ISP info")
        return _isp_cache["data"]

    try:
        # Make API request with rate limit handling
        response = requests.get("https://ipinfo.io/json", timeout=10)

        if response.status_code == 429:
            # Rate limited - return cached data if available, otherwise fallback
            if _isp_cache["data"] is not None:
                logger.warning("Rate limited, returning cached ISP info")
                return _isp_cache["data"]
            else:
                logger.warning("Rate limited and no cached data available")
                return {
                    "ip": "Unknown",
                    "hostname": "Unknown",
                    "city": "Unknown",
                    "region": "Unknown",
                    "country": "Unknown",
                    "provider": "Rate limited - try again later",
                }

        response.raise_for_status()
        data = response.json()

        # Cache the successful response
        isp_info = {
            "ip": data.get("ip", "Unknown"),
            "hostname": data.get("hostname", "Unknown"),
            "city": data.get("city", "Unknown"),
            "region": data.get("region", "Unknown"),
            "country": data.get("country", "Unknown"),
            "provider": data.get(
                "org", "Unknown"
            ),  # This usually contains ISP/ASN info
        }

        _isp_cache["data"] = isp_info
        _isp_cache["timestamp"] = current_time

        logger.info("Successfully retrieved and cached ISP info")
        return isp_info

    except requests.exceptions.RequestException as e:
        logger.error(f"Request failed to get ISP info: {e}")
        # Return cached data if available
        if _isp_cache["data"] is not None:
            logger.info("Request failed, returning cached ISP info")
            return _isp_cache["data"]
        raise HTTPException(
            status_code=503, detail="ISP information service temporarily unavailable"
        )
    except Exception as e:
        logger.error(f"Unexpected error getting ISP info: {e}")
        # Return cached data if available
        if _isp_cache["data"] is not None:
            logger.info("Error occurred, returning cached ISP info")
            return _isp_cache["data"]
        raise HTTPException(
            status_code=500, detail="Failed to retrieve ISP information"
        )
