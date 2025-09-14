import asyncio
import os
import time
from typing import List, Optional, Dict, Set
from datetime import datetime
from ping3 import ping
from .database import db_manager, PingMetricCreate
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class PingMonitor:
    def __init__(self):
        self.is_running = False
        self.ping_interval = int(os.getenv("PING_INTERVAL", "1"))  # seconds
        self.target_hosts = [
            "8.8.8.8",      # Google DNS
            "1.1.1.1",      # Cloudflare DNS
            "208.67.222.222", # OpenDNS
            "google.com",   # Google
            "github.com"    # GitHub
        ]
        self.websocket_clients: Set[object] = set()
        self.latest_results: Dict[str, dict] = {}
        
    def add_websocket_client(self, websocket):
        """Add a WebSocket client for real-time updates"""
        self.websocket_clients.add(websocket)
        logger.info(f"WebSocket client added. Total clients: {len(self.websocket_clients)}")
    
    def remove_websocket_client(self, websocket):
        """Remove a WebSocket client"""
        self.websocket_clients.discard(websocket)
        logger.info(f"WebSocket client removed. Total clients: {len(self.websocket_clients)}")
    
    async def broadcast_to_websockets(self, data: dict):
        """Broadcast ping results to all connected WebSocket clients"""
        if not self.websocket_clients:
            return
        
        # Create a copy of the set to avoid modification during iteration
        clients_to_remove = set()
        
        # Check if this is a DNS status update (for hosts 8.8.8.8, 1.1.1.1, etc.)
        is_dns_update = False
        if data.get('type') == 'ping_result' and data.get('result'):
            host = data['result'].get('host', '')
            if host in ['8.8.8.8', '1.1.1.1', '208.67.222.222']:
                # Convert to DNS status update
                dns_data = {
                    'type': 'dns_status_update',
                    'result': data['result']
                }
                data = dns_data
                is_dns_update = True
        elif data.get('type') == 'ping_update' and data.get('results'):
            # Filter for DNS hosts only and convert to dns_status_update
            dns_results = [r for r in data['results'] 
                          if r.get('host') in ['8.8.8.8', '1.1.1.1', '208.67.222.222']]
            if dns_results:
                dns_data = {
                    'type': 'dns_status_update',
                    'results': dns_results,
                    'timestamp': data.get('timestamp')
                }
                data = dns_data
                is_dns_update = True
        
        for client in self.websocket_clients.copy():
            try:
                # Only send DNS updates to clients connected to the dns-status endpoint
                client_path = getattr(client, 'path', '/api/ws/ping-status')
                
                if is_dns_update and '/api/ws/dns-status' in client_path:
                    await client.send_json(data)
                elif not is_dns_update and '/api/ws/ping-status' in client_path:
                    await client.send_json(data)
            except Exception as e:
                logger.warning(f"Failed to send data to WebSocket client: {e}")
                clients_to_remove.add(client)
        
        # Remove failed clients
        for client in clients_to_remove:
            self.websocket_clients.discard(client)
    
    def ping_host(self, host: str, timeout: int = 3) -> dict:
        """Ping a single host and return the result"""
        try:
            start_time = time.time()
            response_time = ping(host, timeout=timeout, unit='ms')
            
            if response_time is None:
                return {
                    "host": host,
                    "response_time_ms": None,
                    "packet_loss": True,
                    "error_message": "Ping timeout or host unreachable",
                    "timestamp": datetime.utcnow().isoformat()
                }
            else:
                return {
                    "host": host,
                    "response_time_ms": round(response_time, 2),
                    "packet_loss": False,
                    "error_message": None,
                    "timestamp": datetime.utcnow().isoformat()
                }
        except Exception as e:
            return {
                "host": host,
                "response_time_ms": None,
                "packet_loss": True,
                "error_message": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def ping_all_hosts(self) -> List[dict]:
        """Ping all target hosts concurrently"""
        loop = asyncio.get_event_loop()
        
        # Run ping operations in thread pool to avoid blocking
        tasks = [
            loop.run_in_executor(None, self.ping_host, host)
            for host in self.target_hosts
        ]
        
        results = await asyncio.gather(*tasks)
        return results
    
    async def save_ping_results(self, results: List[dict]):
        """Save ping results to database"""
        try:
            for result in results:
                metric = PingMetricCreate(
                    target_host=result["host"],
                    response_time_ms=result["response_time_ms"],
                    packet_loss=result["packet_loss"],
                    error_message=result["error_message"]
                )
                
                await db_manager.insert_ping_metric(metric)
                
                # Update latest results for WebSocket broadcasting
                self.latest_results[result["host"]] = result
                
        except Exception as e:
            logger.error(f"Failed to save ping results: {e}")
    
    async def monitoring_loop(self):
        """Main monitoring loop that runs continuously"""
        logger.info(f"Starting ping monitoring with {self.ping_interval}s interval")
        logger.info(f"Target hosts: {', '.join(self.target_hosts)}")
        
        while self.is_running:
            try:
                # Ping all hosts
                results = await self.ping_all_hosts()
                
                # Save to database
                await self.save_ping_results(results)
                
                # Broadcast to WebSocket clients
                broadcast_data = {
                    "type": "ping_update",
                    "timestamp": datetime.utcnow().isoformat(),
                    "results": results
                }
                await self.broadcast_to_websockets(broadcast_data)
                
                # Log summary
                successful_pings = sum(1 for r in results if not r["packet_loss"])
                logger.debug(f"Ping cycle completed: {successful_pings}/{len(results)} successful")
                
                # Wait for next interval
                await asyncio.sleep(self.ping_interval)
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(self.ping_interval)
    
    async def start_monitoring(self):
        """Start the ping monitoring service"""
        if self.is_running:
            logger.warning("Ping monitoring is already running")
            return
        
        self.is_running = True
        logger.info("Starting ping monitoring service")
        
        # Start the monitoring loop as a background task
        asyncio.create_task(self.monitoring_loop())
    
    async def stop_monitoring(self):
        """Stop the ping monitoring service"""
        if not self.is_running:
            logger.warning("Ping monitoring is not running")
            return
        
        self.is_running = False
        logger.info("Stopping ping monitoring service")
    
    def get_latest_results(self) -> Dict[str, dict]:
        """Get the latest ping results for all hosts"""
        return self.latest_results.copy()
    
    def add_target_host(self, host: str):
        """Add a new target host to monitor"""
        if host not in self.target_hosts:
            self.target_hosts.append(host)
            logger.info(f"Added new target host: {host}")
    
    def remove_target_host(self, host: str):
        """Remove a target host from monitoring"""
        if host in self.target_hosts:
            self.target_hosts.remove(host)
            if host in self.latest_results:
                del self.latest_results[host]
            logger.info(f"Removed target host: {host}")
    
    def get_target_hosts(self) -> List[str]:
        """Get list of current target hosts"""
        return self.target_hosts.copy()

# Global ping monitor instance
ping_monitor = PingMonitor()