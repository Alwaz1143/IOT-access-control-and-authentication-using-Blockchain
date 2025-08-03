import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { 
  Lock, 
  Search, 
  Filter, 
  MoreVertical, 
  Eye, 
  Check, 
  X, 
  Clock, 
  AlertTriangle,
  User,
  Smartphone,
  MapPin
} from 'lucide-react'
import toast from 'react-hot-toast'

// Helper functions moved to top level
const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'approved':
      return 'bg-green-100 text-green-800'
    case 'denied':
      return 'bg-red-100 text-red-800'
    case 'expired':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'low':
      return 'bg-blue-100 text-blue-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'high':
      return 'bg-orange-100 text-orange-800'
    case 'critical':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return Clock
    case 'approved':
      return Check
    case 'denied':
      return X
    case 'expired':
      return AlertTriangle
    default:
      return Clock
  }
}

const getTimeAgo = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
  return `${Math.floor(diffInSeconds / 86400)}d ago`
}

interface AccessRequest {
  id: string
  userId: string
  userName: string
  deviceId: string
  deviceName: string
  resource: string
  action: string
  status: 'pending' | 'approved' | 'denied' | 'expired'
  priority: 'low' | 'medium' | 'high' | 'critical'
  requestedAt: string
  approvedAt?: string
  deniedAt?: string
  expiresAt?: string
  reason?: string
  location?: string
  ipAddress?: string
  userAgent?: string
}

interface AccessGrant {
  id: string
  userId: string
  userName: string
  deviceId: string
  deviceName: string
  resource: string
  action: string
  grantedAt: string
  expiresAt: string
  grantedBy: string
  status: 'active' | 'expired' | 'revoked'
}

export default function Access() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedRequest, setSelectedRequest] = useState<AccessRequest | null>(null)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'requests' | 'grants' | 'monitoring'>('requests')

  const queryClient = useQueryClient()

  const { data: accessRequests, isLoading: requestsLoading } = useQuery<AccessRequest[]>(
    'access-requests',
    async () => {
      const response = await axios.get('/api/access/requests')
      return response.data.data.requests
    },
    {
      refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
    }
  )

  const { data: accessGrants, isLoading: grantsLoading } = useQuery<AccessGrant[]>(
    'access-grants',
    async () => {
      const response = await axios.get('/api/access/grants')
      return response.data.data.grants
    }
  )

  const approveRequestMutation = useMutation(
    async ({ requestId, reason }: { requestId: string; reason?: string }) => {
      const response = await axios.post(`/api/access/approve/${requestId}`, { reason })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('access-requests')
        queryClient.invalidateQueries('access-grants')
        toast.success('Access request approved!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to approve request')
      }
    }
  )

  const denyRequestMutation = useMutation(
    async ({ requestId, reason }: { requestId: string; reason: string }) => {
      const response = await axios.post(`/api/access/deny/${requestId}`, { reason })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('access-requests')
        toast.success('Access request denied!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to deny request')
      }
    }
  )

  const revokeGrantMutation = useMutation(
    async ({ grantId, reason }: { grantId: string; reason: string }) => {
      const response = await axios.post(`/api/access/revoke/${grantId}`, { reason })
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('access-grants')
        toast.success('Access grant revoked!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to revoke grant')
      }
    }
  )

  const filteredRequests = accessRequests?.filter(request => {
    const matchesSearch = request.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.deviceName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         request.resource.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || request.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })



  const handleApproveRequest = (requestId: string) => {
    const reason = prompt('Enter approval reason (optional):')
    approveRequestMutation.mutate({ requestId, reason: reason || undefined })
  }

  const handleDenyRequest = (requestId: string) => {
    const reason = prompt('Enter denial reason:')
    if (reason) {
      denyRequestMutation.mutate({ requestId, reason })
    }
  }

  const handleRevokeGrant = (grantId: string) => {
    const reason = prompt('Enter revocation reason:')
    if (reason) {
      revokeGrantMutation.mutate({ grantId, reason })
    }
  }

  const handleViewRequest = (request: AccessRequest) => {
    setSelectedRequest(request)
    setShowRequestModal(true)
  }



  const isLoading = requestsLoading || grantsLoading

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
        <h1 className="text-2xl font-bold text-gray-900">Access Control</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage access requests and permissions
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('requests')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'requests'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Access Requests ({filteredRequests?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('grants')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'grants'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Active Grants ({accessGrants?.filter(g => g.status === 'active').length || 0})
          </button>
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'monitoring'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Real-time Monitoring
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
                placeholder="Search requests..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="denied">Denied</option>
              <option value="expired">Expired</option>
            </select>
            <select
              className="select"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <button className="btn btn-secondary">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'requests' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200">
                {filteredRequests?.map((request) => {
                  return (
                    <li key={request.id} className="py-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="text-sm font-medium text-gray-900">
                              {request.userName}
                            </p>
                            <span className={`badge ${getStatusColor(request.status)}`}>
                              {request.status}
                            </span>
                            <span className={`badge ${getPriorityColor(request.priority)}`}>
                              {request.priority}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <Smartphone className="w-4 h-4 mr-1" />
                              {request.deviceName}
                            </span>
                            <span>{request.resource} • {request.action}</span>
                            {request.location && (
                              <span className="flex items-center">
                                <MapPin className="w-4 h-4 mr-1" />
                                {request.location}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                            <span>Requested: {getTimeAgo(request.requestedAt)}</span>
                            {request.expiresAt && (
                              <span>Expires: {getTimeAgo(request.expiresAt)}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          {request.status === 'pending' && (
                            <>
                              <button
                                className="p-1 text-green-600 hover:text-green-800"
                                onClick={() => handleApproveRequest(request.id)}
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                className="p-1 text-red-600 hover:text-red-800"
                                onClick={() => handleDenyRequest(request.id)}
                                title="Deny"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            className="p-1 text-gray-400 hover:text-gray-600"
                            onClick={() => handleViewRequest(request)}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1 text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
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

      {activeTab === 'grants' && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flow-root">
              <ul className="-my-5 divide-y divide-gray-200">
                {accessGrants?.filter(grant => grant.status === 'active').map((grant) => (
                  <li key={grant.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <Check className="w-5 h-5 text-green-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-sm font-medium text-gray-900">
                            {grant.userName}
                          </p>
                          <span className="badge bg-green-100 text-green-800">
                            Active
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Smartphone className="w-4 h-4 mr-1" />
                            {grant.deviceName}
                          </span>
                          <span>{grant.resource} • {grant.action}</span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                          <span>Granted: {getTimeAgo(grant.grantedAt)}</span>
                          <span>Expires: {getTimeAgo(grant.expiresAt)}</span>
                          <span>By: {grant.grantedBy}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          className="p-1 text-red-600 hover:text-red-800"
                          onClick={() => handleRevokeGrant(grant.id)}
                          title="Revoke Access"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-gray-600">
                          <MoreVertical className="w-4 h-4" />
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

      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          {/* Real-time Statistics */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-yellow-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Pending Requests</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">
                          {filteredRequests?.filter(r => r.status === 'pending').length || 0}
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
                      <Check className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Active Grants</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">
                          {accessGrants?.filter(g => g.status === 'active').length || 0}
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
                      <X className="w-5 h-5 text-red-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Denied Today</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">
                          {filteredRequests?.filter(r => 
                            r.status === 'denied' && 
                            new Date(r.deniedAt || '').toDateString() === new Date().toDateString()
                          ).length || 0}
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
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Security Alerts</dt>
                      <dd>
                        <div className="text-lg font-medium text-gray-900">0</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity Timeline */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Recent Activity</h3>
              <div className="flow-root">
                <ul className="-mb-8">
                  {filteredRequests?.slice(0, 5).map((request, index) => {
                    const StatusIcon = getStatusIcon(request.status)
                    return (
                      <li key={request.id}>
                        <div className="relative pb-8">
                          {index < 4 && (
                            <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                          )}
                          <div className="relative flex space-x-3">
                            <div>
                              <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                request.status === 'approved' ? 'bg-green-500' :
                                request.status === 'denied' ? 'bg-red-500' :
                                request.status === 'pending' ? 'bg-yellow-500' : 'bg-gray-500'
                              }`}>
                                <StatusIcon className="h-5 w-5 text-white" />
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                              <div>
                                <p className="text-sm text-gray-500">
                                  <span className="font-medium text-gray-900">{request.userName}</span>
                                  {' '}requested access to{' '}
                                  <span className="font-medium text-gray-900">{request.deviceName}</span>
                                </p>
                              </div>
                              <div className="text-right text-sm whitespace-nowrap text-gray-500">
                                <time>{getTimeAgo(request.requestedAt)}</time>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty States */}
      {activeTab === 'requests' && filteredRequests?.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <Lock className="h-12 w-12" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No access requests found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'No access requests have been made yet.'
            }
          </p>
        </div>
      )}

      {activeTab === 'grants' && accessGrants?.filter(g => g.status === 'active').length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <Check className="h-12 w-12" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No active grants</h3>
          <p className="mt-1 text-sm text-gray-500">
            No active access grants found.
          </p>
        </div>
      )}

      {/* View Request Modal */}
      {showRequestModal && selectedRequest && (
        <ViewRequestModal
          request={selectedRequest}
          onClose={() => {
            setShowRequestModal(false)
            setSelectedRequest(null)
          }}
          onApprove={() => {
            handleApproveRequest(selectedRequest.id)
            setShowRequestModal(false)
            setSelectedRequest(null)
          }}
          onDeny={() => {
            handleDenyRequest(selectedRequest.id)
            setShowRequestModal(false)
            setSelectedRequest(null)
          }}
        />
      )}
    </div>
  )
}

// Modal Components
function ViewRequestModal({ 
  request, 
  onClose, 
  onApprove, 
  onDeny 
}: { 
  request: AccessRequest
  onClose: () => void
  onApprove: () => void
  onDeny: () => void
}) {
  const StatusIcon = getStatusIcon(request.status)

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center space-x-2 mb-4">
            <StatusIcon className="w-6 h-6 text-primary-600" />
            <h3 className="text-lg font-medium text-gray-900">Access Request Details</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">User</label>
              <p className="text-sm text-gray-900">{request.userName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Device</label>
              <p className="text-sm text-gray-900">{request.deviceName}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Resource</label>
              <p className="text-sm text-gray-900">{request.resource}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Action</label>
              <p className="text-sm text-gray-900">{request.action}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <p className="text-sm text-gray-900">{request.status}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <p className="text-sm text-gray-900">{request.priority}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Requested</label>
              <p className="text-sm text-gray-900">{new Date(request.requestedAt).toLocaleString()}</p>
            </div>
            {request.location && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <p className="text-sm text-gray-900">{request.location}</p>
              </div>
            )}
            {request.reason && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Reason</label>
                <p className="text-sm text-gray-900">{request.reason}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            {request.status === 'pending' && (
              <>
                <button
                  className="btn btn-success"
                  onClick={onApprove}
                >
                  Approve
                </button>
                <button
                  className="btn btn-danger"
                  onClick={onDeny}
                >
                  Deny
                </button>
              </>
            )}
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 