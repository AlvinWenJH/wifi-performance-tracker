-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create ping_metrics table
CREATE TABLE IF NOT EXISTS ping_metrics (
    id SERIAL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    target_host TEXT NOT NULL,
    response_time_ms FLOAT,
    packet_loss BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('ping_metrics', 'timestamp', if_not_exists => TRUE);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_ping_metrics_timestamp ON ping_metrics (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ping_metrics_target_host ON ping_metrics (target_host);
CREATE INDEX IF NOT EXISTS idx_ping_metrics_response_time ON ping_metrics (response_time_ms);

-- Create a view for recent metrics (last 24 hours)
CREATE OR REPLACE VIEW recent_ping_metrics AS
SELECT 
    timestamp,
    target_host,
    response_time_ms,
    packet_loss,
    error_message
FROM ping_metrics 
WHERE timestamp >= NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Create a function to calculate average response time by hour
CREATE OR REPLACE FUNCTION avg_response_time_by_hour(host_filter VARCHAR DEFAULT NULL)
RETURNS TABLE(
    hour_bucket TIMESTAMPTZ,
    target_host VARCHAR,
    avg_response_time FLOAT,
    packet_count BIGINT,
    packet_loss_rate FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        time_bucket('1 hour', timestamp) as hour_bucket,
        pm.target_host,
        AVG(pm.response_time_ms) as avg_response_time,
        COUNT(*) as packet_count,
        (COUNT(*) FILTER (WHERE pm.packet_loss = TRUE))::FLOAT / COUNT(*) * 100 as packet_loss_rate
    FROM ping_metrics pm
    WHERE (host_filter IS NULL OR pm.target_host = host_filter)
        AND timestamp >= NOW() - INTERVAL '7 days'
    GROUP BY hour_bucket, pm.target_host
    ORDER BY hour_bucket DESC, pm.target_host;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for testing
INSERT INTO ping_metrics (target_host, response_time_ms, packet_loss) VALUES
('8.8.8.8', 15.2, FALSE),
('1.1.1.1', 12.8, FALSE),
('google.com', 18.5, FALSE);