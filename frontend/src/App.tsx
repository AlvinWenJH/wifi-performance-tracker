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

      // Fetch reliability statistics based on selected time range
      // For 10m option, use minutes parameter directly instead of converting to hours
      let statsUrl;
      if (timeRange === '10m') {
        statsUrl = `${apiBaseUrl}/ping-metrics/hosts/${selectedHost}/summary?minutes=${minutes}`;
      } else {
        // For 1hr and 5hr options, convert minutes to hours
        const hours = Math.ceil(minutes / 60);
        statsUrl = `${apiBaseUrl}/ping-metrics/hosts/${selectedHost}/summary?hours=${hours}`;
      }
      
      const statsResponse = await fetch(statsUrl, {
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

  // Function to manually refresh data
  const refreshData = () => {
    fetchReliabilityStats();
    fetchIspInfo();
    fetchPingData();
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-3">
      {/* Header */}
      <header className="mb-4 sticky top-0 z-10 -mx-3 px-3 py-3 border-b border-gray-700 bg-gray-800/95 backdrop-blur supports-[backdrop-filter]:bg-gray-800/75">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <Wifi className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">WiFi Performance Tracker</h1>
              <p className="text-sm text-gray-400">Real-time network monitoring dashboard</p>
            </div>
          </div>
          <div className="flex flex-col items-end space-y-1">
            <div className="flex items-center space-x-1.5">
              <div className={`w-3 h-3 rounded-full ${monitoringActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium text-white">{monitoringActive ? 'Monitoring Active' : 'Monitoring Inactive'}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <div className="text-xs text-gray-400">
                Last updated: {lastUpdate ? lastUpdate.toLocaleString() : '--'}
              </div>
              <div className="flex items-center space-x-1.5">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="bg-blue-500 hover:bg-blue-600 text-white border-blue-600"
                  onClick={fetchData}
                >
                  <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white border-blue-600"
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
      <div className="grid grid-cols-12 gap-4">
        {/* Top Row - Main Performance Card */}
        <Card className="col-span-12 bg-gray-800 border-gray-700 shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 py-1 px-3">
            <div>
              <CardTitle className="text-base font-medium">Network Performance Dashboard</CardTitle>
              <CardDescription className="text-xs text-gray-400">
                Real-time network monitoring and performance analysis
              </CardDescription>
            </div>
            <div className="flex items-center space-x-1.5">
              <select
                className="text-xs border border-gray-600 rounded p-1 bg-gray-700 text-white"
                value={selectedHost}
                onChange={(e) => setSelectedHost(e.target.value)}
              >
                {monitoredHosts.map(host => (
                  <option key={host} value={host}>{host}</option>
                ))}
              </select>
              <Button onClick={refreshData} variant="outline" size="icon" className="h-7 w-7">
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="py-1 px-3">
            <div className="grid grid-cols-12 gap-4">
              {/* Reliability Stats */}
              <div className="col-span-3 bg-gray-850 rounded-lg p-1.5 border border-gray-700">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="text-xs font-medium text-gray-300">Reliability</h3>
                  <Activity className="h-3 w-3 text-blue-400" />
                </div>
                <div className="flex items-center">
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-white">
                      {reliabilityStats && reliabilityStats.uptime_percentage !== undefined ? `${reliabilityStats.uptime_percentage.toFixed(1)}%` : '--'}
                    </div>
                    <div className="flex items-center space-x-1 mt-1">
                      <div className={`w-2 h-2 rounded-full ${reliabilityStats && reliabilityStats.uptime_percentage !== undefined ? getReliabilityColor(reliabilityStats.uptime_percentage) : 'bg-gray-300'}`}></div>
                      <span className="text-xs text-gray-400">
                        {reliabilityStats && reliabilityStats.uptime_percentage !== undefined ? getReliabilityStatus(reliabilityStats.uptime_percentage) : 'Loading...'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-1 space-y-0.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Response</span>
                    <span className="font-medium text-white">
                      {reliabilityStats && reliabilityStats.avg_response_time !== undefined ? `${reliabilityStats.avg_response_time.toFixed(1)}ms` : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Packet Loss</span>
                    <span className="font-medium text-white">
                      {reliabilityStats && reliabilityStats.packet_loss_rate !== undefined ? `${(reliabilityStats.packet_loss_rate * 100).toFixed(2)}%` : '--'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* ISP Information */}
              <div className="col-span-3 bg-gray-850 rounded-lg p-1.5 border border-gray-700">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="text-xs font-medium text-gray-300">ISP Information</h3>
                  <Globe className="h-3 w-3 text-blue-400" />
                </div>
                <div className="flex items-center">
                  <div className="w-full">
                    <div className="text-xs text-gray-400">Provider</div>
                    <div className="text-base font-semibold text-white break-words">{ispInfo?.provider || '--'}</div>
                  </div>
                </div>
                <div className="mt-1">
                  <div className="text-xs text-gray-400 mb-1">Connection Status</div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    <span className="text-xs text-white">Active</span>
                  </div>
                </div>
              </div>
              
              {/* Ping Response Time Mini Chart */}
              <div className="col-span-6 bg-gray-850 rounded-lg p-2 border border-gray-700">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-medium text-gray-300">Response Time</h3>
                </div>
                <div className="h-[80px] w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData.slice(-20)}
                        margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                      >
                        <YAxis domain={['dataMin', 'dataMax']} hide={true} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }}
                          labelStyle={{ color: '#F9FAFB' }}
                          itemStyle={{ color: '#3B82F6' }}
                          formatter={(value) => [`${value} ms`, 'Response Time']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="responseTime" 
                          stroke="#3B82F6" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ fill: '#3B82F6', r: 3, stroke: '#1F2937', strokeWidth: 1 }}
                          name="Response Time"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                      No data available
                    </div>
                  )}
                </div>
                <div className="mt-0.5 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-gray-400">Current: </span>
                    <span className="text-white font-medium">
                      {chartData.length > 0 ? `${chartData[chartData.length - 1].responseTime.toFixed(1)}ms` : '--'}
                    </span>
                  </div>
                  <div className="text-gray-400">
                    Host: {selectedHost}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Middle Row - Detailed Metrics and Response Time History */}
        <div className="col-span-8">
          <Card className="bg-gray-800 border-gray-700 shadow-lg h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-1 px-4">
              <div>
                <CardTitle className="text-sm">Detailed Metrics</CardTitle>
                <CardDescription className="text-xs">
                  Statistics for {selectedHost} over the past {timeRange === '10m' ? '10 minutes' : timeRange === '1hr' ? '1 hour' : '5 hours'}
                </CardDescription>
              </div>
              <div className="flex border border-gray-600 rounded overflow-hidden">
                <button
                  className={`px-1 py-0.5 text-xs ${timeRange === '10m' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                  onClick={() => setTimeRange('10m')}
                >
                  10m
                </button>
                <button
                  className={`px-1 py-0.5 text-xs ${timeRange === '1hr' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                  onClick={() => setTimeRange('1hr')}
                >
                  1h
                </button>
                <button
                  className={`px-1 py-0.5 text-xs ${timeRange === '5hr' ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                  onClick={() => setTimeRange('5hr')}
                >
                  5h
                </button>
              </div>
            </CardHeader>
            <CardContent className="py-1 px-4">
              <div className="grid grid-cols-4 gap-4">
                {/* Response Times */}
                <div className="bg-gray-850 rounded-lg p-1.5 border border-gray-700">
                  <div className="text-xs font-medium text-gray-400">Average</div>
                  <div className="text-base font-bold text-blue-400">
                    {reliabilityStats?.avg_response_time !== undefined ? `${reliabilityStats.avg_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>
                
                <div className="bg-gray-850 rounded-lg p-1.5 border border-gray-700">
                  <div className="text-xs font-medium text-gray-400">Median</div>
                  <div className="text-base font-bold text-blue-400">
                    {reliabilityStats?.median_response_time !== undefined ? `${reliabilityStats.median_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>
                
                <div className="bg-gray-850 rounded-lg p-1.5 border border-gray-700">
                  <div className="text-xs font-medium text-gray-400">Min</div>
                  <div className="text-base font-bold text-green-400">
                    {reliabilityStats?.min_response_time !== undefined ? `${reliabilityStats.min_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>
                
                <div className="bg-gray-850 rounded-lg p-1.5 border border-gray-700">
                  <div className="text-xs font-medium text-gray-400">Max</div>
                  <div className="text-base font-bold text-amber-400">
                    {reliabilityStats?.max_response_time !== undefined ? `${reliabilityStats.max_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>
                
                {/* Reliability Metrics */}
                <div className="bg-gray-850 rounded-lg p-1.5 border border-gray-700">
                  <div className="text-xs font-medium text-gray-400">Total Pings</div>
                  <div className="text-base font-bold text-white">
                    {reliabilityStats?.total_pings !== undefined ? reliabilityStats.total_pings.toLocaleString() : '--'}
                  </div>
                </div>
                
                <div className="bg-gray-850 rounded-lg p-1.5 border border-gray-700">
                  <div className="text-xs font-medium text-gray-400">Packet Losses</div>
                  <div className="text-base font-bold text-red-400">
                    {reliabilityStats?.packet_losses !== undefined ? reliabilityStats.packet_losses.toLocaleString() : '--'}
                  </div>
                </div>
                
                <div className="bg-gray-850 rounded-lg p-1.5 border border-gray-700">
                  <div className="text-xs font-medium text-gray-400">Loss Rate</div>
                  <div className="text-base font-bold text-white">
                    {reliabilityStats?.packet_loss_rate !== undefined ? `${(reliabilityStats.packet_loss_rate * 100).toFixed(2)}%` : '--'}
                  </div>
                </div>
                
                <div className="bg-gray-850 rounded-lg p-1.5 border border-gray-700">
                  <div className="text-xs font-medium text-gray-400">95th Percentile</div>
                  <div className="text-base font-bold text-purple-400">
                    {reliabilityStats?.p95_response_time !== undefined ? `${reliabilityStats.p95_response_time.toFixed(2)}ms` : '--'}
                  </div>
                </div>
              </div>
              
              {/* Response Time Chart */}
              <div className="mt-1 h-[150px] w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={chartData}
                      margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="time" 
                        stroke="#9CA3AF"
                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                        tickLine={{ stroke: '#4B5563' }}
                      />
                      <YAxis 
                        stroke="#9CA3AF"
                        tick={{ fill: '#9CA3AF', fontSize: 10 }}
                        tickLine={{ stroke: '#4B5563' }}
                        width={25}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#F9FAFB' }}
                        labelStyle={{ color: '#F9FAFB' }}
                        itemStyle={{ color: '#3B82F6' }}
                        formatter={(value) => [`${value} ms`, 'Response Time']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="responseTime" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ fill: '#3B82F6', r: 3, stroke: '#1F2937', strokeWidth: 1 }}
                        name="Response Time"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                    No data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Status and Host Management */}
        <div className="col-span-4">
          <div className="grid grid-cols-1 gap-4 h-full">
            {/* Host Management */}
            <Card className="bg-gray-800 border-gray-700 shadow-lg flex-1 flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 py-1 px-4">
                <CardTitle className="text-sm font-medium">Monitored Hosts</CardTitle>
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
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
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
                
                <div className="overflow-x-auto overflow-y-auto flex-1 rounded-lg border border-gray-700 bg-gray-900/50 shadow-md">
                  <table className="w-full caption-bottom text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-800 to-gray-800/80 border-b border-gray-700">
                        <th className="h-8 px-4 text-left align-middle font-medium text-gray-300 whitespace-nowrap">Host</th>
                        <th className="h-8 px-4 text-right align-middle font-medium text-gray-300 whitespace-nowrap">Status</th>
                        {showHostManager && (
                          <th className="h-8 w-[60px] px-2 text-right align-middle font-medium text-gray-300 whitespace-nowrap">Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {monitoredHosts.length > 0 ? (
                        <>
                          {monitoredHosts.map((host, index) => (
                            <tr 
                              key={host} 
                              className={`border-b border-gray-700/50 hover:bg-gray-800/30 transition-colors ${index % 2 === 0 ? 'bg-gray-800/10' : ''}`}
                            >
                              <td className="p-2 align-middle">
                                <div className="flex items-center space-x-2">
                                  <Globe className="h-4 w-4 text-blue-400" />
                                  <span className="font-mono text-white truncate max-w-[120px]">{host}</span>
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
                                <Globe className="h-6 w-6 text-gray-600 mb-2" />
                                <p className="text-gray-400 text-sm">No hosts being monitored</p>
                              </div>
                            </td>
                          </tr>
                          {/* Add placeholder rows to ensure minimum 5 rows when no hosts */}
                          {Array.from({ length: 4 }).map((_, index) => (
                            <tr 
                              key={`empty-placeholder-${index}`} 
                              className={`border-b border-gray-700/50 ${index % 2 === 0 ? 'bg-gray-800/10' : ''}`}
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
