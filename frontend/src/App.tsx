import { useState, useEffect, useRef, useMemo, startTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Button } from './components/ui/button'
import { Modal } from './components/ui/modal'
import { Toggle } from './components/ui/toggle'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select'
import { DowntimeTimeline } from './components/DowntimeTimeline'
import { XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Wifi, Activity, Globe, RefreshCw, Plus, Trash2, Sun, Moon } from 'lucide-react'
import { useTheme } from './contexts/ThemeContext'
import { AnimatedCounter } from './components/ui/animated-counter'
import { AnimatedPercentage } from './components/ui/animated-percentage'

interface PingMetric {
  id: number
  timestamp: string
  target_host: string
  response_time_ms: number | null
  packet_loss: boolean
  error_message: string | null
}

interface ReliabilityStats {
  total_pings: number
  avg_response_time: number
  min_response_time: number
  max_response_time: number
  median_response_time: number
  p95_response_time: number
  packet_losses: number
  packet_loss_rate: number
  first_ping: string
  last_ping: string
  host: string
  hours_analyzed: number
  uptime_percentage: number
}

interface ISPInfo {
  provider: string
  ip?: string
  city?: string
  country?: string
}

interface DowntimePeriod {
  start_time: string
  end_time: string
  duration_seconds: number
}

interface DowntimeData {
  host: string
  hours_analyzed: number
  min_duration_seconds: number
  downtime_periods: DowntimePeriod[]
  total_downtime_events: number
}

// WebSocket interface removed

// PingResult interface removed as it was only used with WebSocket

// Utility function to get API base URL
const getApiBaseUrl = () => {
  const apiProtocol = window.location.protocol
  const apiHost = window.location.hostname
  const apiPort = '8000' // Backend port is always 8000
  return `${apiProtocol}//${apiHost}:${apiPort}/api`
}

// WebSocket utility function removed

function App() {
  const { theme, toggleTheme } = useTheme()
  const [pingData, setPingData] = useState<PingMetric[]>([])
  const [reliabilityStats, setReliabilityStats] = useState<ReliabilityStats | null>(null)
  const [ispInfo, setIspInfo] = useState<ISPInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [monitoringActive, setMonitoringActive] = useState(false)
  const [monitoredHosts, setMonitoredHosts] = useState<string[]>([])
  const [newHost, setNewHost] = useState('')
  const [showHostManager, setShowHostManager] = useState(false)
  const [selectedHost, setSelectedHost] = useState<string>('8.8.8.8')
  const [timeRange, setTimeRange] = useState<'1hr' | '1d' | '1w'>('1hr')
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showDowntimeModal, setShowDowntimeModal] = useState(false)
  const [downtimeData, setDowntimeData] = useState<DowntimeData | null>(null)
  const [isLoadingDowntime, setIsLoadingDowntime] = useState(false)

  // State for smooth data transitions
  const [displayStats, setDisplayStats] = useState<ReliabilityStats | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  // WebSocket connection and message handling removed

  const fetchDowntimeData = async () => {
    try {
      setIsLoadingDowntime(true)

      // Calculate hours based on timeRange
      let hours = 1
      if (timeRange === '1hr') {
        hours = 1
      } else if (timeRange === '1d') {
        hours = 24
      } else if (timeRange === '1w') {
        hours = 168 // 7 days * 24 hours
      }

      const apiBaseUrl = getApiBaseUrl()
      const response = await fetch(`${apiBaseUrl}/ping-metrics/hosts/${encodeURIComponent(selectedHost)}/downtime?hours=${hours}&min_duration=1`)

      if (response.ok) {
        const data = await response.json()
        setDowntimeData(data)
      } else {
        console.error('Failed to fetch downtime data:', response.statusText)
        setDowntimeData(null)
      }
    } catch (error) {
      console.error('Error fetching downtime data:', error)
      setDowntimeData(null)
    } finally {
      setIsLoadingDowntime(false)
    }
  }

  const handlePacketLossClick = async () => {
    setShowDowntimeModal(true)
    await fetchDowntimeData()
  }

  const debouncedFetchData = async () => {
    // Prevent multiple simultaneous calls
    if (isLoading) {
      return
    }

    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }

    // Set a new timeout to debounce the fetch
    fetchTimeoutRef.current = setTimeout(async () => {
      await fetchDataInternal()
    }, 100)
  }

  const fetchDataInternal = async () => {
    try {
      setIsLoading(true)

      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

      // Fetch ping metrics based on selected time range
      let minutes = 60; // Default to 1 hour

      if (timeRange === '1hr') {
        minutes = 60;
      } else if (timeRange === '1d') {
        minutes = 1440; // 24 hours * 60 minutes
      } else if (timeRange === '1w') {
        minutes = 10080; // 7 days * 24 hours * 60 minutes
      }

      // Get the API base URL
      const apiBaseUrl = getApiBaseUrl()

      const hostParam = selectedHost ? `&host=${encodeURIComponent(selectedHost)}` : '';

      // Prepare all API calls
      let metricsUrl;
      if (timeRange === '1hr') {
        // Use time-range endpoint for 1hr (within 300 minute limit)
        metricsUrl = `${apiBaseUrl}/ping-metrics/time-range/?minutes=${minutes}${hostParam}&limit=1000`;
      } else {
        // Use main endpoint with hours parameter for 1d and 1w
        const hours = Math.ceil(minutes / 60);
        metricsUrl = `${apiBaseUrl}/ping-metrics/?hours=${hours}${hostParam}&limit=1000`;
      }

      const metricsPromise = fetch(metricsUrl, {
        signal: controller.signal
      }).then(res => res.json())

      // Fetch reliability statistics based on selected time range
      let statsUrl;
      if (timeRange === '1hr') {
        statsUrl = `${apiBaseUrl}/ping-metrics/hosts/${selectedHost}/summary?minutes=${minutes}`;
      } else {
        // For 1d and 1w options, convert minutes to hours
        const hours = Math.ceil(minutes / 60);
        statsUrl = `${apiBaseUrl}/ping-metrics/hosts/${selectedHost}/summary?hours=${hours}`;
      }

      const statsPromise = fetch(statsUrl, {
        signal: controller.signal
      }).then(res => res.json())

      const ispPromise = fetch(`${apiBaseUrl}/ping-metrics/isp-info/`, {
        signal: controller.signal
      }).then(res => res.json())

      const statusPromise = fetch(`${apiBaseUrl}/ping-metrics/monitoring/status`, {
        signal: controller.signal
      }).then(res => res.json())

      const hostsPromise = fetch(`${apiBaseUrl}/ping-metrics/hosts`, {
        signal: controller.signal
      }).then(res => res.json())

      // Wait for all API calls to complete
      const [metrics, stats, ispData, statusData, hostsData] = await Promise.all([
        metricsPromise,
        statsPromise,
        ispPromise,
        statusPromise,
        hostsPromise
      ])

      // Batch all state updates together to prevent multiple re-renders
      startTransition(() => {
        setPingData(Array.isArray(metrics) ? metrics : [])

        // Handle smooth data transitions for reliability stats
        if (stats && reliabilityStats) {
          // If we have previous data, trigger transition
          setIsTransitioning(true)
          // Set new data after a brief delay to allow transition to start
          setTimeout(() => {
            setReliabilityStats(stats)
            setDisplayStats(stats)
            setIsTransitioning(false)
          }, 100)
        } else {
          // First load or no previous data
          setReliabilityStats(stats)
          setDisplayStats(stats)
        }

        setIspInfo(ispData)
        setMonitoringActive(statusData.monitoring_active)
        setMonitoredHosts(hostsData.active_monitoring_hosts || [])
        setLastUpdate(new Date())
      })

      clearTimeout(timeoutId)
    } catch (error) {
      console.error('Failed to fetch data:', error)
      // Show error state instead of using mock data
      if (!pingData.length) {
        setPingData([])
      }
      if (!reliabilityStats) {
        setReliabilityStats(null)
      }
      if (!ispInfo) {
        setIspInfo(null)
      }
      // Still update the timestamp to show when we last tried to fetch
      setLastUpdate(new Date())
    } finally {
      setIsLoading(false)
    }
  }

  // No mock data generation needed - using real backend data

  const toggleMonitoring = async () => {
    try {
      // Get the API base URL
      const apiBaseUrl = getApiBaseUrl()

      const endpoint = monitoringActive ?
        `${apiBaseUrl}/ping-metrics/monitoring/stop` :
        `${apiBaseUrl}/ping-metrics/monitoring/start`;

      const response = await fetch(endpoint, {
        method: 'POST',
      });

      if (response.ok) {
        setMonitoringActive(!monitoringActive);
        debouncedFetchData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to toggle monitoring:', error);
    }
  };

  const addHost = async () => {
    if (!newHost.trim()) return

    try {
      // Get the API base URL
      const apiBaseUrl = getApiBaseUrl()

      const host = encodeURIComponent(newHost.trim())
      const response = await fetch(`${apiBaseUrl}/ping-metrics/hosts/${host}/add`, {
        method: 'POST'
      })

      if (response.ok) {
        setNewHost('')
        debouncedFetchData() // Refresh data
      }
    } catch (error) {
      console.error('Error adding host:', error)
    }
  }

  const removeHost = async (host: string) => {
    try {
      // Get the API base URL
      const apiBaseUrl = getApiBaseUrl()

      const response = await fetch(`${apiBaseUrl}/ping-metrics/hosts/${host}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        debouncedFetchData() // Refresh data
      }
    } catch (error) {
      console.error('Error removing host:', error)
    }
  }

  useEffect(() => {
    debouncedFetchData()

    // Refresh data every 30 seconds (for historical data from API)
    const interval = setInterval(() => {
      debouncedFetchData()
    }, 30000)

    return () => {
      clearInterval(interval)
    }
  }, [timeRange, selectedHost]) // Combined dependencies to avoid duplicate calls

  // Group ping data by host and time range

  // Process chart data for the selected host and time range
  const chartData = useMemo(() => {
    // Calculate the cutoff time based on selected time range
    const now = new Date()
    let cutoffTime: Date

    switch (timeRange) {
      case '1hr':
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago
        break
      case '1d':
        cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 1 day ago
        break
      case '1w':
        cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) // 1 week ago
        break
      default:
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000) // Default to 1 hour
    }

    return pingData
      .filter(metric => {
        // Filter by host and valid response time
        if (metric.response_time_ms === null || metric.target_host !== selectedHost) {
          return false
        }

        // Filter by time range
        const metricTime = new Date(metric.timestamp)
        return metricTime >= cutoffTime
      })
      .map(metric => ({
        time: new Date(metric.timestamp).toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
        responseTime: metric.response_time_ms,
        timestamp: metric.timestamp
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  }, [pingData, selectedHost, timeRange])

  const getReliabilityColor = (percentage: number) => {
    if (percentage >= 99.5) return 'bg-primary'
    if (percentage >= 99) return 'bg-secondary'
    return 'bg-muted'
  }

  const getReliabilityStatus = (percentage: number) => {
    if (percentage >= 99.5) return 'Excellent'
    if (percentage >= 99) return 'Good'
    if (percentage >= 95) return 'Fair'
    return 'Poor'
  }



  return (
    <div className="min-h-screen bg-background text-foreground p-2 md:p-3">
      {/* Header */}
      <header className="mb-4 sticky top-0 z-10 -mx-2 md:-mx-3 px-2 md:px-3 py-3 border-b border-border backdrop-blur bg-background/95 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-primary rounded-lg">
              <Wifi className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-foreground">WiFi Performance Tracker</h1>
              <p className="text-xs lg:text-sm text-muted-foreground">Real-time network monitoring dashboard</p>
            </div>
          </div>
          <div className="flex flex-col lg:items-end space-y-2 lg:space-y-1">
            <div className="flex items-center space-x-1.5">
              <div className={`w-3 h-3 rounded-full ${monitoringActive ? 'bg-primary animate-pulse' : 'bg-muted'}`}></div>
              <span className="text-sm font-medium text-foreground">{monitoringActive ? 'Monitoring Active' : 'Monitoring Inactive'}</span>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-center space-y-2 lg:space-y-0 lg:space-x-1.5">
              <div className="text-xs text-muted-foreground">
                Last updated: {lastUpdate ? lastUpdate.toLocaleString() : '--'}
              </div>
              <div className="flex items-center space-x-1.5">
                <div className="flex items-center space-x-2">
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <Toggle
                    pressed={theme === 'dark'}
                    onPressedChange={() => { }}
                    onClick={(event) => toggleTheme(event)}
                    size="sm"
                    aria-label="Toggle dark mode"
                  />
                  <Moon className="h-4 w-4 text-muted-foreground" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={debouncedFetchData}
                >
                  <RefreshCw className="h-3 w-3 lg:h-4 lg:w-4 mr-1" /> Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleMonitoring}
                >
                  {monitoringActive ? 'Stop' : 'Start'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Dashboard - Single Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top Row - Main Performance Card */}
        <Card className="col-span-1 lg:col-span-12 border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-6">
            <div>
              <CardTitle className="text-lg font-semibold">Network Performance Dashboard</CardTitle>
              <CardDescription className="text-sm mt-1">
                Real-time network monitoring and performance analysis
              </CardDescription>
            </div>
            <div className="flex items-center space-x-3">
              <Select value={selectedHost} onValueChange={setSelectedHost}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select host" />
                </SelectTrigger>
                <SelectContent>
                  {monitoredHosts.map(host => (
                    <SelectItem key={host} value={host}>
                      {host}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Reliability Stats */}
              <div className="col-span-1 lg:col-span-3 rounded-lg p-6 border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold text-card-foreground">Reliability</h3>
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div className="text-center mb-6">
                  <div className="text-5xl font-bold mb-3 text-foreground">
                    {displayStats && displayStats.uptime_percentage !== undefined ? (
                      <AnimatedPercentage
                        value={displayStats.uptime_percentage}
                        decimals={1}
                        duration={500}
                      />
                    ) : '--'}
                  </div>
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${displayStats && displayStats.uptime_percentage !== undefined ? getReliabilityColor(displayStats.uptime_percentage) : 'bg-gray-300'}`}></div>
                    <span className="text-sm font-medium text-muted-foreground">
                      {displayStats && displayStats.uptime_percentage !== undefined ? getReliabilityStatus(displayStats.uptime_percentage) : 'Loading...'}
                    </span>
                  </div>
                </div>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Avg Response</span>
                    <span className="font-semibold text-foreground">
                      {displayStats && displayStats.avg_response_time !== undefined ? (
                        <AnimatedCounter
                          value={displayStats.avg_response_time}
                          decimals={1}
                          suffix="ms"
                          duration={1000}
                        />
                      ) : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Packet Loss</span>
                    <span className="font-semibold text-foreground">
                      {displayStats && displayStats.packet_loss_rate !== undefined ? (
                        <AnimatedPercentage
                          value={displayStats.packet_loss_rate * 100}
                          decimals={2}
                          duration={1000}
                        />
                      ) : '--'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Network & ISP Information */}
              <div className="col-span-1 lg:col-span-9 rounded-lg p-6 border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-semibold text-card-foreground">Network & ISP Information</h3>
                  <Globe className="h-5 w-5 text-primary" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                  {/* ISP Provider */}
                  <div>
                    <div className="text-sm mb-2 text-muted-foreground font-medium">Internet Service Provider</div>
                    <div className="text-xl font-semibold break-words text-foreground">{ispInfo?.provider || '--'}</div>
                  </div>

                  {/* IP Address */}
                  <div>
                    <div className="text-sm mb-2 text-muted-foreground font-medium">Public IP Address</div>
                    <div className="text-xl font-semibold text-foreground font-mono">{ispInfo?.ip || '--'}</div>
                  </div>

                  {/* Location */}
                  <div>
                    <div className="text-sm mb-2 text-muted-foreground font-medium">Location</div>
                    <div className="text-xl font-semibold text-foreground">
                      {ispInfo?.city && ispInfo?.country ? `${ispInfo.city}, ${ispInfo.country}` : '--'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Connection Status */}
                  <div>
                    <div className="text-sm mb-2 text-muted-foreground font-medium">Connection Status</div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-primary"></div>
                      <span className="text-lg font-semibold text-foreground">Active</span>
                    </div>
                  </div>

                  {/* Current Response Time */}
                  <div>
                    <div className="text-sm mb-2 text-muted-foreground font-medium">Current Response Time</div>
                    <div className="text-xl font-semibold text-primary">
                      {chartData.length > 0 ? `${chartData[chartData.length - 1]?.responseTime?.toFixed(1)}ms` : '--'}
                    </div>
                  </div>

                  {/* Current Host */}
                  <div>
                    <div className="text-sm mb-2 text-muted-foreground font-medium">Monitoring Host</div>
                    <div className="text-xl font-semibold text-foreground font-mono">{selectedHost}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Middle Row - Detailed Metrics and Response Time History */}
        <div className="col-span-1 lg:col-span-8">
          <Card className="h-full bg-card border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-6">
              <div>
                <CardTitle className="text-lg font-semibold text-card-foreground">Detailed Metrics</CardTitle>
                <CardDescription className="text-sm mt-1 text-muted-foreground">
                  Statistics for {selectedHost} over the past {timeRange === '1hr' ? '1 hour' : timeRange === '1d' ? '1 day' : '1 week'}
                </CardDescription>
              </div>
              <div className="flex border border-border rounded-md overflow-hidden">
                <button
                  className={`px-4 py-2 text-sm font-medium transition-colors ${timeRange === '1hr' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  onClick={() => setTimeRange('1hr')}
                >
                  1h
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium transition-colors ${timeRange === '1d' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  onClick={() => setTimeRange('1d')}
                >
                  1d
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium transition-colors ${timeRange === '1w' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  onClick={() => setTimeRange('1w')}
                >
                  1w
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Response Times */}
                <div className="rounded-lg p-4 border border-border bg-muted/30">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Average</div>
                  <div className="text-lg font-bold text-primary">
                    {displayStats?.avg_response_time !== undefined ? (
                      <AnimatedCounter
                        value={displayStats.avg_response_time}
                        decimals={2}
                        suffix="ms"
                        duration={500}
                      />
                    ) : '--'}
                  </div>
                </div>

                <div className="rounded-lg p-4 border border-border bg-muted/30">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Median</div>
                  <div className="text-lg font-bold text-primary">
                    {displayStats?.median_response_time !== undefined ? (
                      <AnimatedCounter
                        value={displayStats.median_response_time}
                        decimals={2}
                        suffix="ms"
                        duration={500}
                      />
                    ) : '--'}
                  </div>
                </div>

                <div className="rounded-lg p-4 border border-border bg-muted/30">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Min</div>
                  <div className="text-lg font-bold text-primary">
                    {displayStats?.min_response_time !== undefined ? (
                      <AnimatedCounter
                        value={displayStats.min_response_time}
                        decimals={2}
                        suffix="ms"
                        duration={500}
                      />
                    ) : '--'}
                  </div>
                </div>

                <div className="rounded-lg p-4 border border-border bg-muted/30">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Max</div>
                  <div className="text-lg font-bold text-primary">
                    {displayStats?.max_response_time !== undefined ? (
                      <AnimatedCounter
                        value={displayStats.max_response_time}
                        decimals={2}
                        suffix="ms"
                        duration={500}
                      />
                    ) : '--'}
                  </div>
                </div>

                {/* Reliability Metrics */}
                <div className="rounded-lg p-4 border border-border bg-muted/30">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Total Pings</div>
                  <div className="text-lg font-bold text-foreground">
                    {displayStats?.total_pings !== undefined ? (
                      <AnimatedCounter
                        value={displayStats.total_pings}
                        decimals={0}
                        duration={500}
                      />
                    ) : '--'}
                  </div>
                </div>

                <div
                  className="rounded-lg p-4 border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={handlePacketLossClick}
                  title="Click to view downtime details"
                >
                  <div className="text-sm font-medium text-muted-foreground mb-1">Packet Losses</div>
                  <div className="text-lg font-bold text-destructive">
                    {displayStats?.packet_losses !== undefined ? (
                      <AnimatedCounter
                        value={displayStats.packet_losses}
                        decimals={0}
                        duration={500}
                      />
                    ) : '--'}
                  </div>
                </div>

                <div className="rounded-lg p-4 border border-border bg-muted/30">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Loss Rate</div>
                  <div className="text-lg font-bold text-foreground">
                    {displayStats?.packet_loss_rate !== undefined ? (
                      <AnimatedPercentage
                        value={displayStats.packet_loss_rate * 100}
                        decimals={2}
                        duration={500}
                      />
                    ) : '--'}
                  </div>
                </div>

                <div className="rounded-lg p-4 border border-border bg-muted/30">
                  <div className="text-sm font-medium text-muted-foreground mb-1">95th Percentile</div>
                  <div className="text-lg font-bold text-accent">
                    {displayStats?.p95_response_time !== undefined ? (
                      <AnimatedCounter
                        value={displayStats.p95_response_time}
                        decimals={2}
                        suffix="ms"
                        duration={500}
                      />
                    ) : '--'}
                  </div>
                </div>
              </div>

              {/* Response Time Chart */}
              <div className="h-[180px] w-full">
                {chartData.length > 0 && !isLoading ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                    >
                      <defs>
                        <linearGradient id="colorResponseTime" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="time"
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        minTickGap={30}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        tickFormatter={(value) => `${value}ms`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          borderColor: 'hsl(var(--border))',
                          color: 'hsl(var(--popover-foreground))',
                          boxShadow: 'var(--shadow)',
                          borderRadius: '8px'
                        }}
                        labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                        itemStyle={{ color: 'hsl(var(--primary))' }}
                        formatter={(value) => [`${value} ms`, 'Response Time']}
                      />
                      <Area
                        type="monotone"
                        dataKey="responseTime"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ fill: 'hsl(var(--primary))', r: 4, stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                        name="Response Time"
                        fill="url(#colorResponseTime)"
                        fillOpacity={1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                    {isLoading ? 'Loading...' : 'No data available'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Status and Host Management */}
        <div className="col-span-1 lg:col-span-4">
          <Card className="h-full bg-card border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-6">
              <CardTitle className="text-lg font-semibold text-card-foreground">Monitored Hosts</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4 text-sm bg-primary hover:bg-primary/90 text-primary-foreground border-primary"
                onClick={() => setShowHostManager(!showHostManager)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Manage
              </Button>
            </CardHeader>
            <CardContent className="px-6 pb-6 flex flex-col h-full">
              {showHostManager && (
                <div className="mb-4">
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={newHost}
                      onChange={(e) => setNewHost(e.target.value)}
                      placeholder="Enter host (e.g., 8.8.8.8)"
                      className="flex-1 px-3 py-2 text-sm border border-input bg-background text-foreground rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors"
                      onKeyPress={(e) => e.key === 'Enter' && addHost()}
                    />
                    <Button
                      size="sm"
                      className="h-10 px-4 text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={addHost}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card">
                      <th className="h-12 px-4 text-left align-middle font-semibold text-muted-foreground">Host</th>
                      <th className="h-12 px-4 text-right align-middle font-semibold text-muted-foreground">Status</th>
                      {showHostManager && (
                        <th className="h-12 w-[80px] px-4 text-right align-middle font-semibold text-muted-foreground">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {monitoredHosts.length > 0 ? (
                      <>
                        {monitoredHosts.map((host, index) => (
                          <tr
                            key={host}
                            className={`border-b border-border transition-colors hover:bg-muted/50 ${index % 2 === 0 ? 'bg-muted/20' : 'bg-transparent'}`}
                          >
                            <td className="p-4 align-middle">
                              <div className="flex items-center space-x-3">
                                <Globe className="h-4 w-4 text-primary" />
                                <span className="font-mono text-sm truncate max-w-[120px] text-foreground">{host}</span>
                              </div>
                            </td>
                            <td className="p-4 align-middle text-right">
                              <div className="flex items-center justify-end">
                                <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 flex items-center">
                                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse mr-2"></div>
                                  <span className="text-xs font-medium text-primary">Active</span>
                                </div>
                              </div>
                            </td>
                            {showHostManager && (
                              <td className="p-4 align-middle text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeHost(host)}
                                  className="h-8 w-8 p-0 rounded-full text-destructive hover:text-destructive/80 hover:bg-destructive/10 border border-transparent hover:border-destructive/20"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                        {/* Add placeholder rows to ensure minimum 5 rows */}
                        {monitoredHosts.length < 5 && Array.from({ length: 5 - monitoredHosts.length }).map((_, index) => (
                          <tr
                            key={`placeholder-${index}`}
                            className={`border-b border-border ${(monitoredHosts.length + index) % 2 === 0 ? 'bg-muted/20' : 'bg-transparent'}`}
                          >
                            <td className="p-4 align-middle">
                              <div className="flex items-center space-x-3 opacity-30">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono text-sm text-muted-foreground truncate max-w-[120px]">—</span>
                              </div>
                            </td>
                            <td className="p-4 align-middle text-right">
                              <div className="flex items-center justify-end opacity-30">
                                <div className="px-3 py-1.5 rounded-full bg-muted/30 border border-muted/20 flex items-center">
                                  <div className="w-2 h-2 rounded-full bg-muted-foreground mr-2"></div>
                                  <span className="text-xs font-medium text-muted-foreground">Empty</span>
                                </div>
                              </div>
                            </td>
                            {showHostManager && (
                              <td className="p-4 align-middle text-right">
                              </td>
                            )}
                          </tr>
                        ))}
                      </>
                    ) : (
                      <>
                        <tr>
                          <td colSpan={showHostManager ? 3 : 2} className="p-6 text-center">
                            <div className="flex flex-col items-center justify-center py-4">
                              <Globe className="h-8 w-8 mb-3 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">No hosts being monitored</p>
                            </div>
                          </td>
                        </tr>
                        {/* Add placeholder rows to ensure minimum 5 rows when no hosts */}
                        {Array.from({ length: 4 }).map((_, index) => (
                          <tr
                            key={`empty-placeholder-${index}`}
                            className="border-b border-border"
                          >
                            <td className="p-4 align-middle">
                              <div className="flex items-center space-x-3 opacity-30">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono text-sm truncate max-w-[120px] text-muted-foreground">—</span>
                              </div>
                            </td>
                            <td className="p-4 align-middle text-right">
                              <div className="flex items-center justify-end opacity-30">
                                <div className="px-3 py-1.5 rounded-full bg-muted/30 border border-muted/20 flex items-center">
                                  <div className="w-2 h-2 rounded-full bg-muted-foreground mr-2"></div>
                                  <span className="text-xs font-medium text-muted-foreground">Empty</span>
                                </div>
                              </div>
                            </td>
                            {showHostManager && (
                              <td className="p-4 align-middle text-right">
                              </td>
                            )}
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Downtime Modal */}
      <Modal
        isOpen={showDowntimeModal}
        onClose={() => setShowDowntimeModal(false)}
        title={`Downtime Analysis - ${selectedHost}`}
        size="xl"
      >
        <DowntimeTimeline
          data={downtimeData}
          isLoading={isLoadingDowntime}
        />
      </Modal>
    </div>
  )
}

export default App
