import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useTheme } from '../contexts/ThemeContext'

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

interface DowntimeTimelineProps {
  data: DowntimeData | null
  isLoading: boolean
}

export function DowntimeTimeline({ data, isLoading }: DowntimeTimelineProps) {
  const { theme } = useTheme()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
          Loading downtime data...
        </div>
      </div>
    )
  }

  if (!data || data.downtime_periods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-2">
        <div className="text-lg font-medium" style={{ color: 'rgb(var(--app-text))' }}>
          No Downtime Events
        </div>
        <div className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
          Great! No packet loss events detected in the analyzed period.
        </div>
      </div>
    )
  }

  // Prepare chart data
  const chartData = data.downtime_periods.map((period, index) => {
    const startTime = new Date(period.start_time)
    const endTime = new Date(period.end_time)
    
    return {
      id: index,
      name: `Event ${index + 1}`,
      start: startTime.getTime(),
      duration: period.duration_seconds,
      startLabel: startTime.toLocaleString(),
      endLabel: endTime.toLocaleString(),
      durationLabel: `${period.duration_seconds.toFixed(1)}s`
    }
  }).sort((a, b) => a.start - b.start)

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="p-3 rounded-lg border shadow-lg"
             style={{ 
               backgroundColor: theme === 'light' ? '#FFFFFF' : '#1F2937',
               borderColor: theme === 'light' ? '#E5E7EB' : '#374151',
               color: theme === 'light' ? '#374151' : '#F9FAFB'
             }}>
          <p className="font-medium">{data.name}</p>
          <p className="text-sm">Start: {data.startLabel}</p>
          <p className="text-sm">End: {data.endLabel}</p>
          <p className="text-sm font-medium text-red-400">Duration: {data.durationLabel}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 rounded-lg border" 
             style={{ 
               backgroundColor: theme === 'light' ? 'rgb(var(--card-inner-bg))' : 'transparent',
               borderColor: 'rgb(var(--card-border))'
             }}>
          <div className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>Total Events</div>
          <div className="text-lg font-bold text-red-400">{data.total_downtime_events}</div>
        </div>
        
        <div className="p-3 rounded-lg border" 
             style={{ 
               backgroundColor: theme === 'light' ? 'rgb(var(--card-inner-bg))' : 'transparent',
               borderColor: 'rgb(var(--card-border))'
             }}>
          <div className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>Total Downtime</div>
          <div className="text-lg font-bold text-red-400">
            {(data.downtime_periods.reduce((sum, p) => sum + p.duration_seconds, 0) / 60).toFixed(1)}m
          </div>
        </div>
        
        <div className="p-3 rounded-lg border" 
             style={{ 
               backgroundColor: theme === 'light' ? 'rgb(var(--card-inner-bg))' : 'transparent',
               borderColor: 'rgb(var(--card-border))'
             }}>
          <div className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>Avg Duration</div>
          <div className="text-lg font-bold text-orange-400">
            {(data.downtime_periods.reduce((sum, p) => sum + p.duration_seconds, 0) / data.downtime_periods.length).toFixed(1)}s
          </div>
        </div>
        
        <div className="p-3 rounded-lg border" 
             style={{ 
               backgroundColor: theme === 'light' ? 'rgb(var(--card-inner-bg))' : 'transparent',
               borderColor: 'rgb(var(--card-border))'
             }}>
          <div className="text-xs font-medium" style={{ color: 'rgb(var(--text-muted))' }}>Period Analyzed</div>
          <div className="text-lg font-bold" style={{ color: 'rgb(var(--app-text))' }}>
            {data.hours_analyzed}h
          </div>
        </div>
      </div>

      {/* Timeline Chart */}
      <div className="h-64">
        <h4 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>
          Downtime Events Timeline
        </h4>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis 
              dataKey="name"
              stroke={theme === 'light' ? '#6B7280' : '#9CA3AF'}
              tick={{ fill: theme === 'light' ? '#6B7280' : '#9CA3AF', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke={theme === 'light' ? '#6B7280' : '#9CA3AF'}
              tick={{ fill: theme === 'light' ? '#6B7280' : '#9CA3AF', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}s`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="duration" radius={[4, 4, 0, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill="#EF4444" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed List */}
      <div>
        <h4 className="text-sm font-medium mb-2" style={{ color: 'rgb(var(--text-secondary))' }}>
          Detailed Events
        </h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.downtime_periods.map((period, index) => {
            const startTime = new Date(period.start_time)
            const endTime = new Date(period.end_time)
            
            return (
              <div key={index} 
                   className="p-3 rounded-lg border"
                   style={{ 
                     backgroundColor: theme === 'light' ? 'rgb(var(--card-inner-bg))' : 'transparent',
                     borderColor: 'rgb(var(--card-border))'
                   }}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'rgb(var(--app-text))' }}>
                      Event {index + 1}
                    </div>
                    <div className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                      {startTime.toLocaleString()} → {endTime.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-red-400">
                      {period.duration_seconds.toFixed(1)}s
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}