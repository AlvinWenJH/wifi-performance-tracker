from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Any
import json
import logging
from ...modules.ping_service import ping_monitor
from ...modules.crud import ping_crud

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])


class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_counter = 0

    async def connect(self, websocket: WebSocket) -> str:
        """Accept a new WebSocket connection"""
        await websocket.accept()

        # Generate unique connection ID
        self.connection_counter += 1
        connection_id = f"conn_{self.connection_counter}"

        self.active_connections[connection_id] = websocket

        # Add to ping monitor for real-time updates
        ping_monitor.add_websocket_client(websocket)

        logger.info(
            f"WebSocket connection {connection_id} established. Total connections: {len(self.active_connections)}"
        )
        return connection_id

    def disconnect(self, connection_id: str, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]

        # Remove from ping monitor
        ping_monitor.remove_websocket_client(websocket)

        logger.info(
            f"WebSocket connection {connection_id} disconnected. Total connections: {len(self.active_connections)}"
        )

    async def send_personal_message(self, message: dict, connection_id: str):
        """Send a message to a specific connection"""
        if connection_id in self.active_connections:
            websocket = self.active_connections[connection_id]
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to send message to {connection_id}: {e}")
                # Remove failed connection
                self.disconnect(connection_id, websocket)

    async def broadcast(self, message: dict):
        """Broadcast a message to all connected clients"""
        disconnected_connections = []

        for connection_id, websocket in self.active_connections.items():
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Failed to broadcast to {connection_id}: {e}")
                disconnected_connections.append((connection_id, websocket))

        # Clean up failed connections
        for connection_id, websocket in disconnected_connections:
            self.disconnect(connection_id, websocket)

    def get_connection_count(self) -> int:
        """Get the number of active connections"""
        return len(self.active_connections)


# Global WebSocket manager
websocket_manager = WebSocketManager()


@router.websocket("/ping-status")
async def websocket_ping_status(websocket: WebSocket):
    """WebSocket endpoint for real-time ping status updates (legacy endpoint)"""
    connection_id = None

    try:
        # Accept connection
        connection_id = await websocket_manager.connect(websocket)

        # Send initial connection confirmation
        await websocket.send_json(
            {
                "type": "connection_established",
                "connection_id": connection_id,
                "message": "Connected to ping status updates (legacy endpoint)",
                "monitoring_active": ping_monitor.is_running,
            }
        )

        # Send current latest results
        latest_results = ping_monitor.get_latest_results()
        if latest_results:
            await websocket.send_json(
                {
                    "type": "initial_data",
                    "results": latest_results,
                    "timestamp": ping_monitor.latest_results.get(
                        "timestamp", "unknown"
                    ),
                }
            )

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for messages from client
                data = await websocket.receive_text()
                message = json.loads(data)

                # Handle different message types
                await handle_websocket_message(websocket, connection_id, message)

            except WebSocketDisconnect:
                logger.info(f"WebSocket {connection_id} disconnected normally")
                break
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "message": "Invalid JSON format"}
                )
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                await websocket.send_json(
                    {"type": "error", "message": "Internal server error"}
                )

    except WebSocketDisconnect:
        logger.info(f"WebSocket {connection_id} disconnected during setup")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if connection_id:
            websocket_manager.disconnect(connection_id, websocket)


@router.websocket("/dns-status")
async def websocket_dns_status(websocket: WebSocket):
    """WebSocket endpoint for real-time DNS status updates only"""
    connection_id = None

    try:
        # Accept connection
        connection_id = await websocket_manager.connect(websocket)

        # Send initial connection confirmation
        await websocket.send_json(
            {
                "type": "connection_established",
                "connection_id": connection_id,
                "message": "Connected to DNS status updates",
                "monitoring_active": ping_monitor.is_running,
            }
        )

        # Send current hosts list
        active_hosts = ping_monitor.get_target_hosts()
        if active_hosts:
            await websocket.send_json(
                {
                    "type": "hosts_update",
                    "results": [{"host": host} for host in active_hosts],
                }
            )

        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Wait for messages from client
                data = await websocket.receive_text()
                message = json.loads(data)

                # Handle different message types
                await handle_websocket_message(websocket, connection_id, message)

            except WebSocketDisconnect:
                logger.info(f"WebSocket {connection_id} disconnected normally")
                break
            except json.JSONDecodeError:
                await websocket.send_json(
                    {"type": "error", "message": "Invalid JSON format"}
                )
            except Exception as e:
                logger.error(f"Error handling WebSocket message: {e}")
                await websocket.send_json(
                    {"type": "error", "message": "Internal server error"}
                )

    except WebSocketDisconnect:
        logger.info(f"WebSocket {connection_id} disconnected during setup")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if connection_id:
            websocket_manager.disconnect(connection_id, websocket)


async def handle_websocket_message(
    websocket: WebSocket, connection_id: str, message: dict
):
    """Handle incoming WebSocket messages from clients"""
    message_type = message.get("type")

    if message_type == "ping":
        # Respond to ping with pong
        await websocket.send_json(
            {
                "type": "pong",
                "timestamp": ping_monitor.latest_results.get("timestamp", "unknown"),
            }
        )

    elif message_type == "get_status":
        # Send current monitoring status
        await websocket.send_json(
            {
                "type": "status_response",
                "monitoring_active": ping_monitor.is_running,
                "target_hosts": ping_monitor.get_target_hosts(),
                "ping_interval": ping_monitor.ping_interval,
                "latest_results": ping_monitor.get_latest_results(),
            }
        )

    elif message_type == "get_latest_metrics":
        # Send latest metrics from database
        try:
            latest_metrics = await ping_crud.get_latest_metrics_by_host()
            await websocket.send_json(
                {"type": "latest_metrics_response", "metrics": latest_metrics}
            )
        except Exception as e:
            await websocket.send_json(
                {"type": "error", "message": f"Failed to get latest metrics: {str(e)}"}
            )

    elif message_type == "subscribe_host":
        # Subscribe to updates for specific host
        host = message.get("host")
        if host:
            await websocket.send_json(
                {
                    "type": "subscription_confirmed",
                    "host": host,
                    "message": f"Subscribed to updates for {host}",
                }
            )
        else:
            await websocket.send_json(
                {"type": "error", "message": "Host parameter required for subscription"}
            )

    elif message_type == "get_host_summary":
        # Get summary for specific host
        host = message.get("host")
        hours = message.get("hours")
        minutes = message.get("minutes")

        if host:
            try:
                if minutes is not None:
                    summary = await ping_crud.get_host_summary(
                        host=host, minutes=minutes
                    )
                else:
                    summary = await ping_crud.get_host_summary(host=host, hours=hours)
                await websocket.send_json(
                    {"type": "host_summary_response", "host": host, "summary": summary}
                )
            except Exception as e:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": f"Failed to get host summary: {str(e)}",
                    }
                )
        else:
            await websocket.send_json(
                {"type": "error", "message": "Host parameter required for summary"}
            )

    else:
        await websocket.send_json(
            {"type": "error", "message": f"Unknown message type: {message_type}"}
        )


@router.get("/connections")
async def get_websocket_connections():
    """Get information about active WebSocket connections"""
    return {
        "active_connections": websocket_manager.get_connection_count(),
        "ping_monitor_clients": len(ping_monitor.websocket_clients),
        "monitoring_active": ping_monitor.is_running,
    }
