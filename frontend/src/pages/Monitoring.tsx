import { useState } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import { 
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  HardDrive,
  Wifi,
  BarChart3,
  RefreshCw
} from 'lucide-react'

interface SystemMetrics {
  cpu: {
    usage: number
    cores: number
    temperature: number
  }
  memory: {
    total: number
    used: number
    available: number
    usage: number
  }
  disk: {
    total: number
    used: number
    available: number
    usage: number
  }
  network: {
    bytesIn: number
    bytesOut: number
    connections: number
  }
  blockchain: {
    lastBlock: number
    blockTime: number
    pendingTransactions: number
    gasPrice: number
  }
  devices: {
    total: number
    active: number
    offline: number
    error: number
  }
  users: {
    total: number
    active: number
    online: number
  }
  uptime: number
  responseTime: number
}

interface Alert {
  id: string
  type: 'info' | 'warning' | 'error' | 'critical'
  title: string
  message: string
  timestamp: string
  isRead: boolean
  source: string
}

interface PerformanceData {
  timestamp: string
  cpu: number
  memory: number
  disk: number
  network: number
}

export default function Monitoring() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h')

  const { data: metrics, isLoading: metricsLoading } = useQuery<SystemMetrics>(
    'system-metrics',
    async () => {
      const response = await axios.get('/api/monitoring/metrics')
      return response.data.data.metrics
    },
    {
      refetchInterval: autoRefresh ? refreshInterval * 1000 : false,
    }
  )

  const { data: alerts, isLoading: alertsLoading } = useQuery<Alert[]>(
    'system-alerts',
    async () => {
      const response = await axios.get('/api/monitoring/alerts')
      return response.data.data.alerts
    },
    {
      refetchInterval: autoRefresh ? 10000 : false, // Refresh alerts every 10 seconds
    }
  )

  const { data: performanceData, isLoading: performanceLoading } = useQuery<PerformanceData[]>(
    ['performance-data', selectedTimeRange],
    async () => {
      const response = await axios.get(`/api/monitoring/performance?range=${selectedTimeRange}`)
      return response.data.data.performance
    }
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return CheckCircle
      case 'warning':
        return AlertTriangle
      case 'error':
        return AlertTriangle
      default:
        return Clock
    }
  }

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'info':
        return 'bg-blue-100 text-blue-800'
      case 'warning':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
        return 'bg-orange-100 text-orange-800'
      case 'critical':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  const getSystemStatus = () => {
    if (!metrics) return 'unknown'
    
    const cpuUsage = metrics.cpu.usage
    const memoryUsage = metrics.memory.usage
    const diskUsage = metrics.disk.usage
    
    if (cpuUsage > 90 || memoryUsage > 90 || diskUsage > 90) return 'error'
    if (cpuUsage > 70 || memoryUsage > 70 || diskUsage > 70) return 'warning'
    return 'healthy'
  }

  const isLoading = metricsLoading || alertsLoading || performanceLoading

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-lg shadow">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const systemStatus = getSystemStatus()
  const StatusIcon = getStatusIcon(systemStatus)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoring</h1>
          <p className="mt-1 text-sm text-gray-500">
            Monitor system performance and alerts
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="auto-refresh"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="auto-refresh" className="text-sm text-gray-700">
              Auto refresh
            </label>
          </div>
          <select
            className="select"
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
            disabled={!autoRefresh}
          >
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>1m</option>
            <option value={300}>5m</option>
          </select>
          <button className="btn btn-secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">System Status</h2>
          <div className="flex items-center space-x-2">
            <StatusIcon className={`w-5 h-5 ${getStatusColor(systemStatus)}`} />
            <span className={`text-sm font-medium ${getStatusColor(systemStatus)}`}>
              {systemStatus.charAt(0).toUpperCase() + systemStatus.slice(1)}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Cpu className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">CPU Usage</p>
              <p className="text-sm text-gray-500">{metrics?.cpu.usage.toFixed(1)}%</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <HardDrive className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Memory Usage</p>
              <p className="text-sm text-gray-500">{metrics?.memory.usage.toFixed(1)}%</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Wifi className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Network</p>
              <p className="text-sm text-gray-500">{metrics?.network.connections} connections</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Uptime</p>
              <p className="text-sm text-gray-500">{metrics ? formatUptime(metrics.uptime) : 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* System Resources */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Resources</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">CPU</span>
                <span className="text-gray-900">{metrics?.cpu.usage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    metrics && metrics.cpu.usage > 80 ? 'bg-red-500' :
                    metrics && metrics.cpu.usage > 60 ? 'bg-yellow-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${metrics?.cpu.usage || 0}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">Memory</span>
                <span className="text-gray-900">{metrics?.memory.usage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    metrics && metrics.memory.usage > 80 ? 'bg-red-500' :
                    metrics && metrics.memory.usage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${metrics?.memory.usage || 0}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">Disk</span>
                <span className="text-gray-900">{metrics?.disk.usage.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    metrics && metrics.disk.usage > 80 ? 'bg-red-500' :
                    metrics && metrics.disk.usage > 60 ? 'bg-yellow-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${metrics?.disk.usage || 0}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Blockchain Status */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Blockchain Status</h3>
          
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm text-gray-700">Last Block</span>
              <span className="text-sm font-medium text-gray-900">{metrics?.blockchain.lastBlock}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-gray-700">Block Time</span>
              <span className="text-sm font-medium text-gray-900">{metrics?.blockchain.blockTime}s</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-gray-700">Pending Transactions</span>
              <span className="text-sm font-medium text-gray-900">{metrics?.blockchain.pendingTransactions}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sm text-gray-700">Gas Price</span>
              <span className="text-sm font-medium text-gray-900">{metrics?.blockchain.gasPrice} Gwei</span>
            </div>
          </div>
        </div>
      </div>

      {/* Device and User Statistics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Device Statistics</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{metrics?.devices.total}</div>
              <div className="text-sm text-gray-500">Total Devices</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{metrics?.devices.active}</div>
              <div className="text-sm text-gray-500">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{metrics?.devices.offline}</div>
              <div className="text-sm text-gray-500">Offline</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{metrics?.devices.error}</div>
              <div className="text-sm text-gray-500">Error</div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">User Statistics</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{metrics?.users.total}</div>
              <div className="text-sm text-gray-500">Total Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{metrics?.users.active}</div>
              <div className="text-sm text-gray-500">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{metrics?.users.online}</div>
              <div className="text-sm text-gray-500">Online</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{metrics?.responseTime}ms</div>
              <div className="text-sm text-gray-500">Avg Response</div>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Recent Alerts</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {alerts?.slice(0, 5).map((alert) => (
              <div key={alert.id} className={`p-4 rounded-lg border-l-4 ${
                alert.type === 'critical' ? 'border-red-500 bg-red-50' :
                alert.type === 'error' ? 'border-orange-500 bg-orange-50' :
                alert.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className={`badge ${getAlertColor(alert.type)}`}>
                        {alert.type}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium text-gray-900 mt-1">{alert.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-2">Source: {alert.source}</p>
                  </div>
                  {!alert.isRead && (
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {alerts?.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No alerts</h3>
              <p className="mt-1 text-sm text-gray-500">
                All systems are running normally.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Performance Chart */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Performance Trends</h3>
          <select
            className="select"
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
          >
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>
        
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm">Performance chart will be displayed here</p>
            <p className="text-xs">Data points: {performanceData?.length || 0}</p>
          </div>
        </div>
      </div>
    </div>
  )
} 