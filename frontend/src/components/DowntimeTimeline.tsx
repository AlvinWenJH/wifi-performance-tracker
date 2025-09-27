import { Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts'

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">
          Loading downtime data...
        </div>
      </div>
    )
  }

  if (!data || data.downtime_periods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-2">
        <div className="text-lg font-medium text-foreground">
          No Downtime Events
        </div>
        <div className="text-sm text-muted-foreground">
          Great! No packet loss events detected in the analyzed period.
        </div>
      </div>
    )
  }

  // Prepare chart data - sort by start time first
  const sortedPeriods = [...data.downtime_periods].sort((a, b) =>
    new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  )

  // Create hourly buckets aligned to exact hours (01:00, 02:00, etc.)
  const createHourlyBuckets = () => {
    if (sortedPeriods.length === 0) return { downtimeData: [], frequencyData: [] }

    const firstEventTime = new Date(sortedPeriods[0].start_time)
    const lastEventTime = new Date(sortedPeriods[sortedPeriods.length - 1].start_time)

    // Round down to the nearest hour for start
    const startHour = new Date(firstEventTime)
    startHour.setMinutes(0, 0, 0)

    // Round up to the next hour for end
    const endHour = new Date(lastEventTime)
    endHour.setHours(endHour.getHours() + 1, 0, 0, 0)

    const buckets = []
    const currentHour = new Date(startHour)

    while (currentHour < endHour) {
      const nextHour = new Date(currentHour)
      nextHour.setHours(nextHour.getHours() + 1)

      // Calculate total downtime duration for this hour
      const downtimeInHour = sortedPeriods
        .filter(period => {
          const startTime = new Date(period.start_time)
          return startTime >= currentHour && startTime < nextHour
        })
        .reduce((sum, period) => sum + period.duration_seconds, 0)

      // Count events in this hour
      const eventsInHour = sortedPeriods
        .filter(period => {
          const startTime = new Date(period.start_time)
          return startTime >= currentHour && startTime < nextHour
        }).length

      buckets.push({
        timestamp: currentHour.getTime(),
        hour: currentHour.getHours(),
        timeLabel: currentHour.toLocaleString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        totalDowntime: downtimeInHour,
        events: eventsInHour,
        downtimeLabel: `${(downtimeInHour / 60).toFixed(1)}m`
      })

      currentHour.setHours(currentHour.getHours() + 1)
    }

    return {
      downtimeData: buckets.filter(b => b.totalDowntime > 0),
      frequencyData: buckets.filter(b => b.events > 0),
      combinedData: buckets.filter(b => b.totalDowntime > 0 || b.events > 0)
    }
  }

  const { combinedData } = createHourlyBuckets()

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload

      return (
        <div className="p-3 rounded-lg border shadow-lg bg-popover text-popover-foreground border-border">
          <p className="font-medium">Downtime & Events</p>
          <p className="text-sm">Time: {data.timeLabel}</p>
          {data.totalDowntime > 0 && (
            <p className="text-sm font-medium text-primary">
              Total Downtime: {data.downtimeLabel}
            </p>
          )}
          {data.events > 0 && (
            <p className="text-sm font-medium text-primary">
              Events: {data.events}
            </p>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <div className="text-xs font-medium text-muted-foreground">Total Events</div>
          <div className="text-lg font-bold text-primary">{data.total_downtime_events}</div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <div className="text-xs font-medium text-muted-foreground">Total Downtime</div>
          <div className="text-lg font-bold text-primary">
            {(data.downtime_periods.reduce((sum, p) => sum + p.duration_seconds, 0) / 60).toFixed(1)}m
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <div className="text-xs font-medium text-muted-foreground">Avg Duration</div>
          <div className="text-lg font-bold text-primary">
            {(data.downtime_periods.reduce((sum, p) => sum + p.duration_seconds, 0) / data.downtime_periods.length).toFixed(1)}s
          </div>
        </div>

        <div className="p-3 rounded-lg border border-border bg-muted/30">
          <div className="text-xs font-medium text-muted-foreground">Period Analyzed</div>
          <div className="text-lg font-bold text-foreground">
            {data.hours_analyzed}h
          </div>
        </div>
      </div>

      {/* Combined Timeline Chart */}
      <div className="space-y-6">
        <div className="rounded-lg border border-border p-6 shadow-sm bg-card">
          <div className="mb-6">
            <h4 className="text-lg font-semibold mb-2 text-primary">
              Downtime Duration & Event Frequency Over Time
            </h4>
            <p className="text-sm leading-relaxed text-muted-foreground">
              identify patterns, peak downtime periods, and the relationship between event frequency and total impact duration.
            </p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={combinedData}
                margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
              >
                <XAxis
                  dataKey="timestamp"
                  stroke="hsl(var(--muted-foreground))"
                  angle={-35}
                  textAnchor="end"
                  height={60}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  tickLine={false}
                  axisLine={true}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

                    // Only show date if the hour is 1 AM
                    if (date.getHours() === 1) {
                      return date.toLocaleDateString() + ' ' + time
                    }

                    return time
                  }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  tickLine={false}
                  axisLine={true}
                  tickFormatter={(value) => `${(value / 60).toFixed(1)}m`}
                  label={{
                    value: 'Downtime Duration (minutes)',
                    angle: -90,
                    position: 'insideLeft',
                    style: {
                      textAnchor: 'middle',
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: '12px',
                      fontWeight: '500'
                    }
                  }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                  tickLine={false}
                  axisLine={true}
                  tickFormatter={(value) => `${value}`}
                  label={{
                    value: 'Events per Hour',
                    angle: 90,
                    position: 'insideRight',
                    style: {
                      textAnchor: 'middle',
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: '12px',
                      fontWeight: '500'
                    }
                  }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar yAxisId="left" dataKey="totalDowntime" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="events"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: 'hsl(var(--primary))', strokeWidth: 2 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed List */}
      <div>
        <h4 className="text-sm font-medium mb-2 text-muted-foreground">
          Detailed Events
        </h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {data.downtime_periods.map((period, index) => {
            const startTime = new Date(period.start_time)
            const endTime = new Date(period.end_time)

            return (
              <div key={index}
                className="p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      Event {index + 1}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {startTime.toLocaleString()} → {endTime.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-primary">
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