import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Wifi, Activity, Globe, RefreshCw, WifiOff, Plus, Trash2 } from 'lucide-react'
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
  const [pingData, setPingData] = useState<PingMetric[]>([])
  const [reliabilityStats, setReliabilityStats] = useState<ReliabilityStats | null>(null)
  const [ispInfo, setIspInfo] = useState<ISPInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [monitoringActive, setMonitoringActive] = useState(false)
  const [monitoredHosts, setMonitoredHosts] = useState<string[]>([])
  const [newHost, setNewHost] = useState('')
  const [showHostManager, setShowHostManager] = useState(false)
  const [selectedHost, setSelectedHost] = useState<string>('8.8.8.8')
  const [timeRange, setTimeRange] = useState<'10m' | '1hr' | '5hr'>('10m')

  // WebSocket connection and message handling removed

  const fetchData = async () => {
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
      const metricsResponse = await fetch(`${apiBaseUrl}/ping-metrics/time-range/?minutes=${minutes}${hostParam}&limit=1000`, {
        signal: controller.signal
      })
      
      const metrics = await metricsResponse.json()
      // Ensure pingData is always an array
      setPingData(Array.isArray(metrics) ? metrics : [])

      // Fetch reliability statistics for 8.8.8.8 (Google DNS)
      const statsResponse = await fetch(`${apiBaseUrl}/ping-metrics/hosts/8.8.8.8/summary?hours=1`, {
        signal: controller.signal
      })
      const stats = await statsResponse.json()
      setReliabilityStats(stats)

      // Fetch ISP information
      const ispResponse = await fetch(`${apiBaseUrl}/ping-metrics/isp-info/`, {
        signal: controller.signal
      })
      const ispData = await ispResponse.json()
      setIspInfo(ispData)

      // Fetch monitoring status
      const statusResponse = await fetch(`${apiBaseUrl}/ping-metrics/monitoring/status`, {
        signal: controller.signal
      })
      const statusData = await statusResponse.json()
      setMonitoringActive(statusData.monitoring_active)

      // Fetch monitored hosts
      const hostsResponse = await fetch(`${apiBaseUrl}/ping-metrics/hosts`, {
        signal: controller.signal
      })
      const hostsData = await hostsResponse.json()
      setMonitoredHosts(hostsData.active_monitoring_hosts || [])
      
      clearTimeout(timeoutId)
      setLastUpdate(new Date())
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
        fetchData(); // Refresh data
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
        fetchData() // Refresh data
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
        fetchData() // Refresh data
      }
    } catch (error) {
      console.error('Error removing host:', error)
    }
  }

  useEffect(() => {
    fetchData()
    
    // Refresh data every 30 seconds (for historical data from API)
    const interval = setInterval(() => {
      fetchData()
    }, 30000)
    
    return () => {
      clearInterval(interval)
    }
  }, [])

  // Fetch data when time range or selected host changes
  useEffect(() => {
    fetchData()
  }, [timeRange, selectedHost])

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
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Wifi className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">WiFi Performance Tracker</h1>
              <p className="text-gray-600">Real-time network monitoring dashboard</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
            <Button onClick={() => {
              setIsLoading(true);
              fetchData();
            }} disabled={isLoading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Reliability Score Card */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Reliability</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="text-2xl font-bold">
                  {reliabilityStats && reliabilityStats.uptime_percentage !== undefined ? `${reliabilityStats.uptime_percentage.toFixed(1)}%` : '--'}
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${reliabilityStats && reliabilityStats.uptime_percentage !== undefined ? getReliabilityColor(reliabilityStats.uptime_percentage) : 'bg-gray-300'}`}></div>
                  <span className="text-xs text-muted-foreground">
                    {reliabilityStats && reliabilityStats.uptime_percentage !== undefined ? getReliabilityStatus(reliabilityStats.uptime_percentage) : 'Loading...'}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Response Time</span>
                <span className="font-medium">
                  {reliabilityStats && reliabilityStats.avg_response_time !== undefined ? `${reliabilityStats.avg_response_time.toFixed(1)}ms` : '--'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Packet Loss</span>
                <span className="font-medium">
                  {reliabilityStats && reliabilityStats.packet_loss_rate !== undefined ? `${(reliabilityStats.packet_loss_rate * 100).toFixed(2)}%` : '--'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ISP Information Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ISP Information</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div>
                <div className="text-sm text-muted-foreground">Provider</div>
                <div className="text-2xl font-semibold">{ispInfo?.provider || '--'}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Ping Metrics Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Detailed Ping Metrics</CardTitle>
          <CardDescription>
            Comprehensive ping statistics for {reliabilityStats?.host || '8.8.8.8'} over the last {reliabilityStats?.hours_analyzed || 1} hour(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Response Times</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Average</div>
                  <div className="text-lg font-bold text-blue-600">
                    {reliabilityStats?.avg_response_time !== undefined ? `${reliabilityStats.avg_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Median</div>
                  <div className="text-lg font-bold text-blue-600">
                    {reliabilityStats?.median_response_time !== undefined ? `${reliabilityStats.median_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Minimum</div>
                  <div className="text-lg font-bold text-green-600">
                    {reliabilityStats?.min_response_time !== undefined ? `${reliabilityStats.min_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Maximum</div>
                  <div className="text-lg font-bold text-amber-600">
                    {reliabilityStats?.max_response_time !== undefined ? `${reliabilityStats.max_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Reliability</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Total Pings</div>
                  <div className="text-lg font-bold">
                    {reliabilityStats?.total_pings !== undefined ? reliabilityStats.total_pings.toLocaleString() : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Packet Losses</div>
                  <div className="text-lg font-bold text-red-600">
                    {reliabilityStats?.packet_losses !== undefined ? reliabilityStats.packet_losses.toLocaleString() : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Loss Rate</div>
                  <div className="text-lg font-bold">
                    {reliabilityStats?.packet_loss_rate !== undefined ? `${(reliabilityStats.packet_loss_rate * 100).toFixed(2)}%` : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Uptime</div>
                  <div className="text-lg font-bold text-green-600">
                    {reliabilityStats?.uptime_percentage !== undefined ? `${reliabilityStats.uptime_percentage.toFixed(2)}%` : '--'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Additional Metrics</div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">95th Percentile</div>
                  <div className="text-lg font-bold text-purple-600">
                    {reliabilityStats?.p95_response_time !== undefined ? `${reliabilityStats.p95_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Monitoring Period</div>
                  <div className="text-sm">
                    {reliabilityStats?.first_ping && reliabilityStats?.last_ping ? (
                      <>
                        <div>From: {new Date(reliabilityStats.first_ping).toLocaleString()}</div>
                        <div>To: {new Date(reliabilityStats.last_ping).toLocaleString()}</div>
                      </>
                    ) : '--'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Ping Response Time Chart */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Ping Response Time ({timeRange === '10m' ? 'Last 10 Minutes' : timeRange === '1hr' ? 'Last Hour' : 'Last 5 Hours'})</CardTitle>
             <CardDescription>
               Real-time ping response times for {selectedHost}
             </CardDescription>
          </div>
          <div className="flex items-center space-x-4">
             <div className="flex items-center space-x-2">
               <span className="text-sm text-muted-foreground">Host:</span>
               <select
                 className="text-sm border rounded p-1"
                 value={selectedHost}
                 onChange={(e) => setSelectedHost(e.target.value)}
               >
                 {monitoredHosts.map(host => (
                   <option key={host} value={host}>{host}</option>
                 ))}
               </select>
             </div>
             <div className="flex items-center space-x-1">
               <span className="text-sm text-muted-foreground">Time:</span>
               <div className="flex border rounded overflow-hidden">
                 <button
                   className={`px-2 py-1 text-xs ${timeRange === '10m' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                   onClick={() => setTimeRange('10m')}
                 >
                   10m
                 </button>
                 <button
                   className={`px-2 py-1 text-xs ${timeRange === '1hr' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                   onClick={() => setTimeRange('1hr')}
                 >
                   1hr
                 </button>
                 <button
                   className={`px-2 py-1 text-xs ${timeRange === '5hr' ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                   onClick={() => setTimeRange('5hr')}
                 >
                   5hr
                 </button>
               </div>
             </div>
           </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={chartData}
                margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="time" 
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  padding={{ left: 10, right: 10 }}
                  tickCount={timeRange === '10m' ? 5 : timeRange === '1hr' ? 6 : 10}
                  label={{
                    value: `Time (${timeRange})`,
                    position: 'insideBottomRight',
                    offset: -5
                  }}
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <Tooltip 
                  labelFormatter={(value) => `Time: ${value}`}
                  formatter={(value: number) => [`${value !== undefined && value !== null ? value.toFixed(1) : '0.0'}ms`, `${selectedHost} Response Time`]}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                {reliabilityStats?.avg_response_time !== undefined && (
                  <svg>
                    <defs>
                      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                          <feMergeNode in="coloredBlur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                  </svg>
                )}
                <Line 
                  type="monotone" 
                  dataKey="responseTime" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2, filter: 'url(#glow)' }}
                  animationDuration={500}
                  isAnimationActive={true}
                  name={`${selectedHost} Response Time`}
                />
                {reliabilityStats?.avg_response_time !== undefined && (
                  <svg>
                    <line 
                      x1="0%" 
                      y1={`${100 - (reliabilityStats.avg_response_time / (reliabilityStats.max_response_time * 1.1)) * 100}%`} 
                      x2="100%" 
                      y2={`${100 - (reliabilityStats.avg_response_time / (reliabilityStats.max_response_time * 1.1)) * 100}%`} 
                      stroke="#3b82f6" 
                      strokeWidth="1" 
                      strokeDasharray="5,5" 
                    />
                    <text 
                      x="98%" 
                      y={`${100 - (reliabilityStats.avg_response_time / (reliabilityStats.max_response_time * 1.1)) * 100 - 5}%`} 
                      fill="#3b82f6" 
                      fontSize="10" 
                      textAnchor="end"
                    >
                      Avg: {reliabilityStats.avg_response_time.toFixed(1)}ms
                    </text>
                  </svg>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <div>Min: {reliabilityStats?.min_response_time !== undefined ? `${reliabilityStats.min_response_time.toFixed(1)}ms` : '--'}</div>
            <div>Max: {reliabilityStats?.max_response_time !== undefined ? `${reliabilityStats.max_response_time.toFixed(1)}ms` : '--'}</div>
            <div>95th: {reliabilityStats?.p95_response_time !== undefined ? `${reliabilityStats.p95_response_time.toFixed(1)}ms` : '--'}</div>
          </div>
        </CardContent>
      </Card>

      {/* Status Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Monitoring Status</div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${monitoringActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                    <span className="text-sm font-medium">{monitoringActive ? 'Active' : 'Inactive'}</span>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={toggleMonitoring}
                  >
                    {monitoringActive ? 'Stop' : 'Start'}
                  </Button>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <Activity className="h-3 w-3 text-blue-500" />
                  <span className="text-xs text-muted-foreground">
                    Polling mode
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        

        
        {/* Host Management */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-muted-foreground">Monitored Hosts</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHostManager(!showHostManager)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Manage
              </Button>
            </div>
            
            {showHostManager && (
              <div className="space-y-2 mb-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newHost}
                    onChange={(e) => setNewHost(e.target.value)}
                    placeholder="Enter host (e.g., 8.8.8.8)"
                    className="flex-1 px-2 py-1 text-sm border rounded"
                    onKeyPress={(e) => e.key === 'Enter' && addHost()}
                  />
                  <Button size="sm" onClick={addHost}>
                    Add
                  </Button>
                </div>
              </div>
            )}
            
            <div className="space-y-1">
              {monitoredHosts.length > 0 ? (
                monitoredHosts.map((host) => (
                  <div key={host} className="flex items-center justify-between text-sm">
                    <span className="font-mono">{host}</span>
                    {showHostManager && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHost(host)}
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No hosts being monitored</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App
