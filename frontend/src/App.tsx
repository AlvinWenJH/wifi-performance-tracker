import { useState, useEffect, useRef, useMemo, startTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Wifi, Activity, Globe, RefreshCw, WifiOff, Plus, Trash2, Sun, Moon } from 'lucide-react'
import { useTheme } from './contexts/ThemeContext'
import './App.css'

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
  const [timeRange, setTimeRange] = useState<'10m' | '1hr' | '5hr'>('10m')
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // WebSocket connection and message handling removed

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

      if (timeRange === '10m') {
        minutes = 10;
      } else if (timeRange === '1hr') {
        minutes = 60;
      } else if (timeRange === '5hr') {
        minutes = 300;
      }

      // Get the API base URL
      const apiBaseUrl = getApiBaseUrl()

      const hostParam = selectedHost ? `&host=${selectedHost}` : '';

      // Prepare all API calls
      const metricsPromise = fetch(`${apiBaseUrl}/ping-metrics/time-range/?minutes=${minutes}${hostParam}&limit=1000`, {
        signal: controller.signal
      }).then(res => res.json())

      // Fetch reliability statistics based on selected time range
      let statsUrl;
      if (timeRange === '10m') {
        statsUrl = `${apiBaseUrl}/ping-metrics/hosts/${selectedHost}/summary?minutes=${minutes}`;
      } else {
        // For 1hr and 5hr options, convert minutes to hours
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
        setReliabilityStats(stats)
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
      case '10m':
        cutoffTime = new Date(now.getTime() - 10 * 60 * 1000) // 10 minutes ago
        break
      case '1hr':
        cutoffTime = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago
        break
      case '5hr':
        cutoffTime = new Date(now.getTime() - 5 * 60 * 60 * 1000) // 5 hours ago
        break
      default:
        cutoffTime = new Date(now.getTime() - 10 * 60 * 1000) // Default to 10 minutes
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
    if (percentage >= 99.5) return 'bg-green-500'
    if (percentage >= 99) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getReliabilityStatus = (percentage: number) => {
    if (percentage >= 99.5) return 'Excellent'
    if (percentage >= 99) return 'Good'
    if (percentage >= 95) return 'Fair'
    return 'Poor'
  }



  return (
    <div className="min-h-screen p-2 md:p-3" style={{ backgroundColor: `rgb(var(--app-bg))`, color: `rgb(var(--app-text))` }}>
      {/* Header */}
      <header className="mb-4 sticky top-0 z-10 -mx-2 md:-mx-3 px-2 md:px-3 py-3 border-b backdrop-blur" style={{ borderColor: `rgb(var(--card-border))`, backgroundColor: `rgb(var(--header-bg) / 0.95)`, boxShadow: theme === 'light' ? 'var(--header-shadow)' : '' }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-3 lg:space-y-0">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Wifi className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold" style={{ color: `rgb(var(--app-text))` }}>WiFi Performance Tracker</h1>
              <p className="text-xs lg:text-sm" style={{ color: `rgb(var(--text-muted))` }}>Real-time network monitoring dashboard</p>
            </div>
          </div>
          <div className="flex flex-col lg:items-end space-y-2 lg:space-y-1">
            <div className="flex items-center space-x-1.5">
              <div className={`w-3 h-3 rounded-full ${monitoringActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium" style={{ color: `rgb(var(--app-text))` }}>{monitoringActive ? 'Monitoring Active' : 'Monitoring Inactive'}</span>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-center space-y-2 lg:space-y-0 lg:space-x-1.5">
              <div className="text-xs" style={{ color: `rgb(var(--text-muted))` }}>
                Last updated: {lastUpdate ? lastUpdate.toLocaleString() : '--'}
              </div>
              <div className="flex items-center space-x-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-gray-600 hover:bg-gray-500 text-white border-gray-500 text-xs lg:text-sm"
                  onClick={toggleTheme}
                >
                  {theme === 'dark' ? <Sun className="h-3 w-3 lg:h-4 lg:w-4" /> : <Moon className="h-3 w-3 lg:h-4 lg:w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white border-blue-600 text-xs lg:text-sm"
                  onClick={debouncedFetchData}
                >
                  <RefreshCw className="h-3 w-3 lg:h-4 lg:w-4 mr-1" /> Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white border-blue-600 text-xs lg:text-sm"
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Top Row - Main Performance Card */}
        <Card className="col-span-1 lg:col-span-12" style={{ backgroundColor: `rgb(var(--card-bg))`, borderColor: `rgb(var(--card-border))`, boxShadow: theme === 'light' ? 'var(--card-shadow)' : '' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-1 px-3">
            <div>
              <CardTitle className="text-base font-medium" style={{ color: `rgb(var(--app-text))` }}>Network Performance Dashboard</CardTitle>
              <CardDescription className="text-xs" style={{ color: `rgb(var(--text-muted))` }}>
                Real-time network monitoring and performance analysis
              </CardDescription>
            </div>
            <div className="flex items-center space-x-1.5">
              <select
                className="text-xs border rounded p-1 transition-colors" style={{ borderColor: `rgb(var(--card-border))`, backgroundColor: `rgb(var(--card-inner-bg))`, color: `rgb(var(--app-text))` }}
                value={selectedHost}
                onChange={(e) => setSelectedHost(e.target.value)}
              >
                {monitoredHosts.map(host => (
                  <option key={host} value={host}>{host}</option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent className="py-1 px-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">
              {/* Reliability Stats */}
              <div className="col-span-1 md:col-span-1 lg:col-span-3 rounded-lg p-3 border h-full flex flex-col" style={{ backgroundColor: `rgb(var(--card-inner-bg))`, borderColor: `rgb(var(--card-border))`, boxShadow: theme === 'light' ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' : '' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium" style={{ color: `rgb(var(--text-secondary))` }}>Reliability</h3>
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
                <div className="text-center flex-1 flex flex-col justify-center">
                  <div className="text-4xl font-bold mb-2" style={{ color: `rgb(var(--app-text))` }}>
                    {reliabilityStats && reliabilityStats.uptime_percentage !== undefined ? `${reliabilityStats.uptime_percentage.toFixed(1)}%` : '--'}
                  </div>
                  <div className="flex items-center justify-center space-x-2 mb-6">
                    <div className={`w-3 h-3 rounded-full ${reliabilityStats && reliabilityStats.uptime_percentage !== undefined ? getReliabilityColor(reliabilityStats.uptime_percentage) : 'bg-gray-300'}`}></div>
                    <span className="text-base font-medium" style={{ color: `rgb(var(--text-muted))` }}>
                      {reliabilityStats && reliabilityStats.uptime_percentage !== undefined ? getReliabilityStatus(reliabilityStats.uptime_percentage) : 'Loading...'}
                    </span>
                  </div>
                </div>
                <div className="space-y-3 text-sm mt-auto">
                  <div className="flex justify-between items-center">
                    <span style={{ color: `rgb(var(--text-muted))` }}>Avg Response</span>
                    <span className="font-semibold" style={{ color: `rgb(var(--app-text))` }}>
                      {reliabilityStats && reliabilityStats.avg_response_time !== undefined ? `${reliabilityStats.avg_response_time.toFixed(1)}ms` : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: `rgb(var(--text-muted))` }}>Packet Loss</span>
                    <span className="font-semibold" style={{ color: `rgb(var(--app-text))` }}>
                      {reliabilityStats && reliabilityStats.packet_loss_rate !== undefined ? `${(reliabilityStats.packet_loss_rate * 100).toFixed(2)}%` : '--'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Network & ISP Information */}
              <div className="col-span-1 md:col-span-1 lg:col-span-9 rounded-lg p-3 border h-full flex flex-col" style={{ backgroundColor: `rgb(var(--card-inner-bg))`, borderColor: `rgb(var(--card-border))`, boxShadow: theme === 'light' ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' : '' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium" style={{ color: `rgb(var(--text-secondary))` }}>Network & ISP Information</h3>
                  <Globe className="h-4 w-4 text-blue-400" />
                </div>

                <div className="grid grid-cols-3 gap-6 flex-1">
                  {/* ISP Provider */}
                  <div className="flex flex-col justify-center">
                    <div className="text-xs mb-2" style={{ color: `rgb(var(--text-muted))` }}>Internet Service Provider</div>
                    <div className="text-xl font-semibold break-words" style={{ color: `rgb(var(--app-text))` }}>{ispInfo?.provider || '--'}</div>
                  </div>

                  {/* IP Address */}
                  <div className="flex flex-col justify-center">
                    <div className="text-xs mb-2" style={{ color: `rgb(var(--text-muted))` }}>Public IP Address</div>
                    <div className="text-xl font-semibold" style={{ color: `rgb(var(--app-text))` }}>{ispInfo?.ip || '--'}</div>
                  </div>

                  {/* Location */}
                  <div className="flex flex-col justify-center">
                    <div className="text-xs mb-2" style={{ color: `rgb(var(--text-muted))` }}>Location</div>
                    <div className="text-xl font-semibold" style={{ color: `rgb(var(--app-text))` }}>
                      {ispInfo?.city && ispInfo?.country ? `${ispInfo.city}, ${ispInfo.country}` : '--'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-6 mt-auto">
                  {/* Connection Status */}
                  <div>
                    <div className="text-xs mb-2" style={{ color: `rgb(var(--text-muted))` }}>Connection Status</div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-base font-medium" style={{ color: `rgb(var(--app-text))` }}>Active</span>
                    </div>
                  </div>

                  {/* Current Response Time */}
                  <div>
                    <div className="text-xs mb-2" style={{ color: `rgb(var(--text-muted))` }}>Current Response Time</div>
                    <div className="text-xl font-semibold text-blue-400">
                      {chartData.length > 0 ? `${chartData[chartData.length - 1].responseTime.toFixed(1)}ms` : '--'}
                    </div>
                  </div>

                  {/* Current Host */}
                  <div>
                    <div className="text-xs mb-2" style={{ color: `rgb(var(--text-muted))` }}>Monitoring Host</div>
                    <div className="text-xl font-semibold" style={{ color: `rgb(var(--app-text))` }}>{selectedHost}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Middle Row - Detailed Metrics and Response Time History */}
        <div className="col-span-1 lg:col-span-8">
          <Card className="h-full" style={{ backgroundColor: `rgb(var(--card-bg))`, borderColor: `rgb(var(--card-border))`, boxShadow: theme === 'light' ? 'var(--card-shadow)' : '' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-1 px-4">
              <div>
                <CardTitle className="text-sm" style={{ color: `rgb(var(--app-text))` }}>Detailed Metrics</CardTitle>
                <CardDescription className="text-xs" style={{ color: `rgb(var(--text-muted))` }}>
                Statistics for {selectedHost} over the past {timeRange === '10m' ? '10 minutes' : timeRange === '1hr' ? '1 hour' : '5 hours'}
              </CardDescription>
              </div>
              <div className="flex border rounded overflow-hidden" style={{ borderColor: `rgb(var(--card-border))` }}>
                <button
                  className={`px-1 py-0.5 text-xs ${timeRange === '10m' ? 'bg-blue-500 text-white' : ''}`}
                  style={timeRange !== '10m' ? { backgroundColor: `rgb(var(--card-inner-bg))`, color: `rgb(var(--text-secondary))` } : {}}
                  onClick={() => setTimeRange('10m')}
                >
                  10m
                </button>
                <button
                  className={`px-1 py-0.5 text-xs ${timeRange === '1hr' ? 'bg-blue-500 text-white' : ''}`}
                  style={timeRange !== '1hr' ? { backgroundColor: `rgb(var(--card-inner-bg))`, color: `rgb(var(--text-secondary))` } : {}}
                  onClick={() => setTimeRange('1hr')}
                >
                  1h
                </button>
                <button
                  className={`px-1 py-0.5 text-xs ${timeRange === '5hr' ? 'bg-blue-500 text-white' : ''}`}
                  style={timeRange !== '5hr' ? { backgroundColor: `rgb(var(--card-inner-bg))`, color: `rgb(var(--text-secondary))` } : {}}
                  onClick={() => setTimeRange('5hr')}
                >
                  5h
                </button>
              </div>
            </CardHeader>
            <CardContent className="py-1 px-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Response Times */}
                <div className="rounded-lg p-1.5 border" style={{ backgroundColor: theme === 'light' ? `rgb(var(--card-inner-bg))` : 'transparent', borderColor: `rgb(var(--card-border))` }}>
                  <div className="text-xs font-medium" style={{ color: `rgb(var(--text-muted))` }}>Average</div>
                  <div className="text-base font-bold text-blue-400">
                    {reliabilityStats?.avg_response_time !== undefined ? `${reliabilityStats.avg_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>

                <div className="rounded-lg p-1.5 border" style={{ backgroundColor: theme === 'light' ? `rgb(var(--card-inner-bg))` : 'transparent', borderColor: `rgb(var(--card-border))` }}>
                  <div className="text-xs font-medium" style={{ color: `rgb(var(--text-muted))` }}>Median</div>
                  <div className="text-base font-bold text-blue-400">
                    {reliabilityStats?.median_response_time !== undefined ? `${reliabilityStats.median_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>

                <div className="rounded-lg p-1.5 border" style={{ backgroundColor: theme === 'light' ? `rgb(var(--card-inner-bg))` : 'transparent', borderColor: `rgb(var(--card-border))` }}>
                  <div className="text-xs font-medium" style={{ color: `rgb(var(--text-muted))` }}>Min</div>
                  <div className="text-base font-bold text-green-400">
                    {reliabilityStats?.min_response_time !== undefined ? `${reliabilityStats.min_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>

                <div className="rounded-lg p-1.5 border" style={{ backgroundColor: theme === 'light' ? `rgb(var(--card-inner-bg))` : 'transparent', borderColor: `rgb(var(--card-border))` }}>
                  <div className="text-xs font-medium" style={{ color: `rgb(var(--text-muted))` }}>Max</div>
                  <div className="text-base font-bold text-amber-400">
                    {reliabilityStats?.max_response_time !== undefined ? `${reliabilityStats.max_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>

                {/* Reliability Metrics */}
                <div className="rounded-lg p-1.5 border" style={{ backgroundColor: theme === 'light' ? `rgb(var(--card-inner-bg))` : 'transparent', borderColor: `rgb(var(--card-border))` }}>
                  <div className="text-xs font-medium" style={{ color: `rgb(var(--text-muted))` }}>Total Pings</div>
                  <div className="text-base font-bold" style={{ color: `rgb(var(--app-text))` }}>
                    {reliabilityStats?.total_pings !== undefined ? reliabilityStats.total_pings.toLocaleString() : '--'}
                  </div>
                </div>

                <div className="rounded-lg p-1.5 border" style={{ backgroundColor: theme === 'light' ? `rgb(var(--card-inner-bg))` : 'transparent', borderColor: `rgb(var(--card-border))` }}>
                  <div className="text-xs font-medium" style={{ color: `rgb(var(--text-muted))` }}>Packet Losses</div>
                  <div className="text-base font-bold text-red-400">
                    {reliabilityStats?.packet_losses !== undefined ? reliabilityStats.packet_losses.toLocaleString() : '--'}
                  </div>
                </div>

                <div className="rounded-lg p-1.5 border" style={{ backgroundColor: theme === 'light' ? `rgb(var(--card-inner-bg))` : 'transparent', borderColor: `rgb(var(--card-border))` }}>
                  <div className="text-xs font-medium" style={{ color: `rgb(var(--text-muted))` }}>Loss Rate</div>
                  <div className="text-base font-bold" style={{ color: `rgb(var(--app-text))` }}>
                    {reliabilityStats?.packet_loss_rate !== undefined ? `${(reliabilityStats.packet_loss_rate * 100).toFixed(2)}%` : '--'}
                  </div>
                </div>

                <div className="rounded-lg p-1.5 border" style={{ backgroundColor: theme === 'light' ? `rgb(var(--card-inner-bg))` : 'transparent', borderColor: `rgb(var(--card-border))` }}>
                  <div className="text-xs font-medium" style={{ color: `rgb(var(--text-muted))` }}>95th Percentile</div>
                  <div className="text-base font-bold text-purple-400">
                    {reliabilityStats?.p95_response_time !== undefined ? `${reliabilityStats.p95_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>
              </div>

              {/* Response Time Chart */}
              <div className="mt-1 h-[120px] md:h-[150px] w-full">
                {chartData.length > 0 && !isLoading ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="responseTimeGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="time"
                        stroke={theme === 'light' ? '#6B7280' : '#9CA3AF'}
                        tick={{ fill: theme === 'light' ? '#6B7280' : '#9CA3AF', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        minTickGap={30}
                      />
                      <YAxis
                        stroke={theme === 'light' ? '#6B7280' : '#9CA3AF'}
                        tick={{ fill: theme === 'light' ? '#6B7280' : '#9CA3AF', fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={30}
                        tickFormatter={(value) => `${value}ms`}
                      />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: theme === 'light' ? '#FFFFFF' : '#1F2937', 
                          borderColor: theme === 'light' ? '#E5E7EB' : '#374151', 
                          color: theme === 'light' ? '#374151' : '#F9FAFB',
                          boxShadow: theme === 'light' ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none'
                        }}
                        labelStyle={{ color: theme === 'light' ? '#374151' : '#F9FAFB' }}
                        itemStyle={{ color: '#3B82F6' }}
                        formatter={(value) => [`${value} ms`, 'Response Time']}
                      />
                      <Area
                        type="monotone"
                        dataKey="responseTime"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ fill: '#3B82F6', r: 3, stroke: theme === 'light' ? '#FFFFFF' : '#1F2937', strokeWidth: 1 }}
                        name="Response Time"
                        fill="url(#responseTimeGradient)"
                        fillOpacity={1}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs" style={{ color: `rgb(var(--text-muted))` }}>
                    {isLoading ? 'Loading...' : 'No data available'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Status and Host Management */}
        <div className="col-span-1 lg:col-span-4">
          <div className="grid grid-cols-1 gap-4 h-full">
            {/* Host Management */}
            <Card className="flex-1 flex flex-col" style={{ backgroundColor: `rgb(var(--card-bg))`, borderColor: `rgb(var(--card-border))`, boxShadow: theme === 'light' ? 'var(--card-shadow)' : '' }}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 py-1 px-4">
                <CardTitle className="text-sm font-medium" style={{ color: `rgb(var(--app-text))` }}>Monitored Hosts</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs bg-blue-500 hover:bg-blue-600 text-white border-blue-600"
                  onClick={() => setShowHostManager(!showHostManager)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Manage
                </Button>
              </CardHeader>
              <CardContent className="p-2 flex-1 flex flex-col">
                {showHostManager && (
                  <div className="mb-3">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={newHost}
                        onChange={(e) => setNewHost(e.target.value)}
                        placeholder="Enter host (e.g., 8.8.8.8)"
                        className="flex-1 px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:border-transparent transition-colors" style={{ borderColor: `rgb(var(--card-border))`, backgroundColor: `rgb(var(--card-inner-bg))`, color: `rgb(var(--app-text))`, '--tw-ring-color': `rgb(var(--input-focus-ring))` } as React.CSSProperties}
                        onKeyPress={(e) => e.key === 'Enter' && addHost()}
                      />
                      <Button
                        size="sm"
                        className="h-8 px-3 text-sm bg-blue-500 hover:bg-blue-600 text-white"
                        onClick={addHost}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto overflow-y-auto flex-1 rounded-lg border" style={{ borderColor: `rgb(var(--card-border))`, backgroundColor: `rgb(var(--card-inner-bg))`, boxShadow: theme === 'light' ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' : '' }}>
                  <table className="w-full caption-bottom text-sm">
                    <thead>
                      <tr className="border-b" style={{ backgroundColor: `rgb(var(--card-bg))`, borderColor: `rgb(var(--card-border))` }}>
                        <th className="h-8 px-4 text-left align-middle font-medium whitespace-nowrap" style={{ color: `rgb(var(--text-secondary))` }}>Host</th>
                        <th className="h-8 px-4 text-right align-middle font-medium whitespace-nowrap" style={{ color: `rgb(var(--text-secondary))` }}>Status</th>
                        {showHostManager && (
                          <th className="h-8 w-[60px] px-2 text-right align-middle font-medium whitespace-nowrap" style={{ color: `rgb(var(--text-secondary))` }}>Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {monitoredHosts.length > 0 ? (
                        <>
                          {monitoredHosts.map((host, index) => (
                            <tr
                              key={host}
                              className={`border-b transition-colors ${index % 2 === 0 ? '' : ''}`}
                              style={{ 
                                borderColor: `rgb(var(--card-border))`,
                                backgroundColor: index % 2 === 0 ? (theme === 'light' ? 'rgb(248 250 252)' : 'rgba(31, 41, 55, 0.3)') : 'transparent'
                              }}
                              onMouseEnter={(e) => {
                                if (theme === 'light') {
                                  e.currentTarget.style.backgroundColor = 'rgb(241 245 249)';
                                } else {
                                  e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 0.5)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (index % 2 === 0) {
                                  e.currentTarget.style.backgroundColor = theme === 'light' ? 'rgb(248 250 252)' : 'rgba(31, 41, 55, 0.3)';
                                } else {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                            >
                              <td className="p-2 align-middle">
                                <div className="flex items-center space-x-2">
                                  <Globe className="h-4 w-4 text-blue-400" />
                                  <span className="font-mono truncate max-w-[120px]" style={{ color: `rgb(var(--app-text))` }}>{host}</span>
                                </div>
                              </td>
                              <td className="p-2 align-middle text-right">
                                <div className="flex items-center justify-end">
                                  <div className="px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20 flex items-center">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-1.5"></div>
                                    <span className="text-xs font-medium text-green-400">Active</span>
                                  </div>
                                </div>
                              </td>
                              {showHostManager && (
                                <td className="p-2 align-middle text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeHost(host)}
                                    className="h-7 w-7 p-0 rounded-full text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
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
                              className={`border-b border-gray-700/50 ${(monitoredHosts.length + index) % 2 === 0 ? 'bg-gray-800/10' : ''}`}
                            >
                              <td className="p-2 align-middle">
                                <div className="flex items-center space-x-2 opacity-30">
                                  <Globe className="h-4 w-4 text-gray-500" />
                                  <span className="font-mono text-gray-500 truncate max-w-[120px]">—</span>
                                </div>
                              </td>
                              <td className="p-2 align-middle text-right">
                                <div className="flex items-center justify-end opacity-30">
                                  <div className="px-2 py-1 rounded-full bg-gray-700/30 border border-gray-700/20 flex items-center">
                                    <div className="w-2 h-2 rounded-full bg-gray-500 mr-1.5"></div>
                                    <span className="text-xs font-medium text-gray-500">Empty</span>
                                  </div>
                                </div>
                              </td>
                              {showHostManager && (
                                <td className="p-2 align-middle text-right">
                                </td>
                              )}
                            </tr>
                          ))}
                        </>
                      ) : (
                        <>
                          <tr>
                            <td colSpan={showHostManager ? 3 : 2} className="p-4 text-center">
                              <div className="flex flex-col items-center justify-center py-3">
                                <Globe className="h-6 w-6 mb-2" style={{ color: `rgb(var(--text-muted))` }} />
                                <p className="text-sm" style={{ color: `rgb(var(--text-muted))` }}>No hosts being monitored</p>
                              </div>
                            </td>
                          </tr>
                          {/* Add placeholder rows to ensure minimum 5 rows when no hosts */}
                          {Array.from({ length: 4 }).map((_, index) => (
                            <tr
                              key={`empty-placeholder-${index}`}
                              className="border-b"
                              style={{ borderColor: `rgb(var(--card-border))` }}
                            >
                              <td className="p-2 align-middle">
                                <div className="flex items-center space-x-2 opacity-30">
                                  <Globe className="h-4 w-4" style={{ color: `rgb(var(--text-muted))` }} />
                                  <span className="font-mono truncate max-w-[120px]" style={{ color: `rgb(var(--text-muted))` }}>—</span>
                                </div>
                              </td>
                              <td className="p-2 align-middle text-right">
                                <div className="flex items-center justify-end opacity-30">
                                  <div className="px-2 py-1 rounded-full border flex items-center" style={{ backgroundColor: `rgb(var(--card-inner-bg) / 0.3)`, borderColor: `rgb(var(--card-border) / 0.2)` }}>
                                    <div className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: `rgb(var(--text-muted))` }}></div>
                                    <span className="text-xs font-medium" style={{ color: `rgb(var(--text-muted))` }}>Empty</span>
                                  </div>
                                </div>
                              </td>
                              {showHostManager && (
                                <td className="p-2 align-middle text-right">
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
      </div>
    </div>
  )
}

export default App
