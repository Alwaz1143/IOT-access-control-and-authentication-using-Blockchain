import { useState } from 'react'
import { useQuery } from 'react-query'
import axios from 'axios'
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  AlertTriangle,
  CheckCircle,
  User,
  Smartphone,
  Shield,
  BarChart3
} from 'lucide-react'

interface AuditLog {
  id: string
  eventType: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  actor: string
  subject: string
  resource: string
  action: string
  details: string
  timestamp: string
  ipAddress?: string
  userAgent?: string
  transactionHash?: string
  isCompliant: boolean
}

interface SecurityIncident {
  id: string
  incidentType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  detectedAt: string
  resolvedAt?: string
  isResolved: boolean
  affectedResources: string[]
  involvedActors: string[]
}

interface ComplianceReport {
  id: string
  regulationType: string
  periodStart: string
  periodEnd: string
  totalEvents: number
  complianceViolations: number
  violations: string[]
  generatedAt: string
  generatedBy: string
}

export default function Audit() {
  const [searchTerm, setSearchTerm] = useState('')
  const [eventTypeFilter, setEventTypeFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [dateRange, setDateRange] = useState('7d')
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [showLogModal, setShowLogModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'logs' | 'incidents' | 'compliance' | 'analytics'>('logs')

  const { data: auditLogs, isLoading: logsLoading } = useQuery<AuditLog[]>(
    ['audit-logs', dateRange],
    async () => {
      const response = await axios.get(`/api/audit/logs?range=${dateRange}`)
      return response.data.data.logs
    }
  )

  const { data: securityIncidents, isLoading: incidentsLoading } = useQuery<SecurityIncident[]>(
    'security-incidents',
    async () => {
      const response = await axios.get('/api/audit/incidents')
      return response.data.data.incidents
    }
  )

  const { data: complianceReports, isLoading: reportsLoading } = useQuery<ComplianceReport[]>(
    'compliance-reports',
    async () => {
      const response = await axios.get('/api/audit/reports')
      return response.data.data.reports
    }
  )

  const filteredLogs = auditLogs?.filter(log => {
    const matchesSearch = log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         log.action.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesEventType = eventTypeFilter === 'all' || log.eventType === eventTypeFilter
    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter
    return matchesSearch && matchesEventType && matchesSeverity
  })

  const getSeverityColor = (severity: string) => {
    switch (severity) {
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

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'DeviceRegistration':
        return Smartphone
      case 'AccessRequest':
        return Shield
      case 'AccessGrant':
        return CheckCircle
      case 'AccessDenial':
        return AlertTriangle
      case 'SecurityIncident':
        return AlertTriangle
      default:
        return FileText
    }
  }

  const handleViewLog = (log: AuditLog) => {
    setSelectedLog(log)
    setShowLogModal(true)
  }

  const handleExportLogs = async () => {
    try {
      const response = await axios.get('/api/audit/export', {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Failed to export logs:', error)
    }
  }

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const isLoading = logsLoading || incidentsLoading || reportsLoading

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white p-4 rounded-lg shadow">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit & Compliance</h1>
        <p className="mt-1 text-sm text-gray-500">
          View audit logs and compliance reports
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'logs'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Audit Logs ({filteredLogs?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'incidents'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Security Incidents ({securityIncidents?.filter(i => !i.isResolved).length || 0})
          </button>
          <button
            onClick={() => setActiveTab('compliance')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'compliance'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Compliance Reports ({complianceReports?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analytics'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Analytics
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search audit logs..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              className="select"
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            >
              <option value="all">All Event Types</option>
              <option value="DeviceRegistration">Device Registration</option>
              <option value="AccessRequest">Access Request</option>
              <option value="AccessGrant">Access Grant</option>
              <option value="AccessDenial">Access Denial</option>
              <option value="SecurityIncident">Security Incident</option>
            </select>
            <select
              className="select"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="all">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
            <select
              className="select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="1d">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <button className="btn btn-secondary">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleExportLogs}
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'logs' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200">
                {filteredLogs?.map((log) => {
                  const EventTypeIcon = getEventTypeIcon(log.eventType)
                  return (
                    <li key={log.id} className="py-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <EventTypeIcon className="w-5 h-5 text-primary-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="text-sm font-medium text-gray-900">
                              {log.eventType}
                            </p>
                            <span className={`badge ${getSeverityColor(log.severity)}`}>
                              {log.severity}
                            </span>
                            {!log.isCompliant && (
                              <span className="badge bg-red-100 text-red-800">
                                Non-compliant
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <User className="w-4 h-4 mr-1" />
                              {log.actor}
                            </span>
                            <span>{log.resource} • {log.action}</span>
                            {log.ipAddress && (
                              <span>IP: {log.ipAddress}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                            <span>{getTimeAgo(log.timestamp)}</span>
                            {log.transactionHash && (
                              <span>Tx: {log.transactionHash.slice(0, 10)}...</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            className="p-1 text-gray-400 hover:text-gray-600"
                            onClick={() => handleViewLog(log)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'incidents' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200">
                {securityIncidents?.map((incident) => (
                  <li key={incident.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          incident.severity === 'critical' ? 'bg-red-100' :
                          incident.severity === 'high' ? 'bg-orange-100' :
                          incident.severity === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'
                        }`}>
                          <AlertTriangle className={`w-5 h-5 ${
                            incident.severity === 'critical' ? 'text-red-600' :
                            incident.severity === 'high' ? 'text-orange-600' :
                            incident.severity === 'medium' ? 'text-yellow-600' : 'text-blue-600'
                          }`} />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-sm font-medium text-gray-900">
                            {incident.incidentType}
                          </p>
                          <span className={`badge ${getSeverityColor(incident.severity)}`}>
                            {incident.severity}
                          </span>
                          {incident.isResolved ? (
                            <span className="badge bg-green-100 text-green-800">
                              Resolved
                            </span>
                          ) : (
                            <span className="badge bg-red-100 text-red-800">
                              Open
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {incident.description}
                        </p>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                          <span>Detected: {getTimeAgo(incident.detectedAt)}</span>
                          {incident.resolvedAt && (
                            <span>Resolved: {getTimeAgo(incident.resolvedAt)}</span>
                          )}
                          <span>Resources: {incident.affectedResources.length}</span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'compliance' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200">
                {complianceReports?.map((report) => (
                  <li key={report.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <FileText className="w-5 h-5 text-purple-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-sm font-medium text-gray-900">
                            {report.regulationType} Compliance Report
                          </p>
                          <span className={`badge ${
                            report.complianceViolations === 0 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {report.complianceViolations === 0 ? 'Compliant' : 'Violations'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>Period: {new Date(report.periodStart).toLocaleDateString()} - {new Date(report.periodEnd).toLocaleDateString()}</span>
                          <span>Total Events: {report.totalEvents}</span>
                          <span>Violations: {report.complianceViolations}</span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                          <span>Generated: {getTimeAgo(report.generatedAt)}</span>
                          <span>By: {report.generatedBy}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button className="btn btn-sm btn-primary">
                          <Download className="w-4 h-4 mr-1" />
                          Download
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Analytics Overview */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total Logs</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">
                          {filteredLogs?.length || 0}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Security Incidents</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">
                          {securityIncidents?.filter(i => !i.isResolved).length || 0}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Compliance Rate</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">
                          {filteredLogs ? 
                            Math.round((filteredLogs.filter(l => l.isCompliant).length / filteredLogs.length) * 100) : 0
                          }%
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Reports Generated</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">
                          {complianceReports?.length || 0}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Event Type Distribution */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Event Type Distribution</h3>
              <div className="space-y-3">
                {filteredLogs && Object.entries(
                  filteredLogs.reduce((acc, log) => {
                    acc[log.eventType] = (acc[log.eventType] || 0) + 1
                    return acc
                  }, {} as Record<string, number>)
                ).map(([eventType, count]) => (
                  <div key={eventType} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{eventType}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-primary-600 h-2 rounded-full" 
                          style={{ width: `${(count / filteredLogs.length) * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty States */}
      {activeTab === 'logs' && filteredLogs?.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <FileText className="h-12 w-12" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No audit logs found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || eventTypeFilter !== 'all' || severityFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No audit logs have been generated yet.'
            }
          </p>
        </div>
      )}

      {activeTab === 'incidents' && securityIncidents?.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <AlertTriangle className="h-12 w-12" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No security incidents</h3>
          <p className="mt-1 text-sm text-gray-500">
            No security incidents have been detected.
          </p>
        </div>
      )}

      {activeTab === 'compliance' && complianceReports?.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <FileText className="h-12 w-12" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No compliance reports</h3>
          <p className="mt-1 text-sm text-gray-500">
            No compliance reports have been generated yet.
          </p>
        </div>
      )}

      {/* View Log Modal */}
      {showLogModal && selectedLog && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Audit Log Details</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Event Type</label>
                  <p className="text-sm text-gray-900">{selectedLog.eventType}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Severity</label>
                  <p className="text-sm text-gray-900">{selectedLog.severity}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Actor</label>
                  <p className="text-sm text-gray-900">{selectedLog.actor}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <p className="text-sm text-gray-900">{selectedLog.subject}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Resource</label>
                  <p className="text-sm text-gray-900">{selectedLog.resource}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Action</label>
                  <p className="text-sm text-gray-900">{selectedLog.action}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Timestamp</label>
                  <p className="text-sm text-gray-900">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
                {selectedLog.ipAddress && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">IP Address</label>
                    <p className="text-sm text-gray-900">{selectedLog.ipAddress}</p>
                  </div>
                )}
                {selectedLog.transactionHash && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Transaction Hash</label>
                    <p className="text-sm text-gray-900 font-mono">{selectedLog.transactionHash}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700">Compliant</label>
                  <p className="text-sm text-gray-900">{selectedLog.isCompliant ? 'Yes' : 'No'}</p>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowLogModal(false)
                    setSelectedLog(null)
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 