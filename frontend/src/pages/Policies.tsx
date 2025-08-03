import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { Plus, Search, Filter, MoreVertical, Eye, Edit, Trash2, Shield, Clock, MapPin, Users } from 'lucide-react'
import toast from 'react-hot-toast'

// Helper functions moved to top level
const getTypeIcon = (type: string) => {
  switch (type) {
    case 'abac':
      return Shield
    case 'time-based':
      return Clock
    case 'location-based':
      return MapPin
    case 'role-based':
      return Users
    default:
      return Shield
  }
}

const getTypeColor = (type: string) => {
  switch (type) {
    case 'abac':
      return 'bg-purple-100 text-purple-800'
    case 'time-based':
      return 'bg-blue-100 text-blue-800'
    case 'location-based':
      return 'bg-green-100 text-green-800'
    case 'role-based':
      return 'bg-orange-100 text-orange-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'inactive':
      return 'bg-red-100 text-red-800'
    case 'draft':
      return 'bg-yellow-100 text-yellow-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

interface Policy {
  id: string
  name: string
  type: 'abac' | 'time-based' | 'location-based' | 'role-based'
  description: string
  status: 'active' | 'inactive' | 'draft'
  priority: number
  createdAt: string
  updatedAt: string
  conditions: any
  actions: string[]
  resources: string[]
  subjects: string[]
}

interface CreatePolicyData {
  name: string
  type: string
  description: string
  conditions: any
  actions: string[]
  resources: string[]
  subjects: string[]
}

export default function Policies() {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const queryClient = useQueryClient()

  const { data: policies, isLoading } = useQuery<Policy[]>(
    'policies',
    async () => {
      const response = await axios.get('/api/policies')
      return response.data.data.policies
    }
  )

  const createPolicyMutation = useMutation(
    async (policyData: CreatePolicyData) => {
      const response = await axios.post('/api/policies', policyData)
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('policies')
        setShowCreateModal(false)
        toast.success('Policy created successfully!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to create policy')
      }
    }
  )

  const updatePolicyMutation = useMutation(
    async ({ id, data }: { id: string; data: Partial<Policy> }) => {
      const response = await axios.put(`/api/policies/${id}`, data)
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('policies')
        setShowEditModal(false)
        setSelectedPolicy(null)
        toast.success('Policy updated successfully!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update policy')
      }
    }
  )

  const deletePolicyMutation = useMutation(
    async (id: string) => {
      const response = await axios.delete(`/api/policies/${id}`)
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('policies')
        toast.success('Policy deleted successfully!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to delete policy')
      }
    }
  )

  const filteredPolicies = policies?.filter(policy => {
    const matchesSearch = policy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         policy.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = typeFilter === 'all' || policy.type === typeFilter
    const matchesStatus = statusFilter === 'all' || policy.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })



  const handleCreatePolicy = (data: CreatePolicyData) => {
    createPolicyMutation.mutate(data)
  }

  const handleUpdatePolicy = (id: string, data: Partial<Policy>) => {
    updatePolicyMutation.mutate({ id, data })
  }

  const handleDeletePolicy = (id: string) => {
    if (window.confirm('Are you sure you want to delete this policy?')) {
      deletePolicyMutation.mutate(id)
    }
  }

  const handleViewPolicy = (policy: Policy) => {
    setSelectedPolicy(policy)
    setShowViewModal(true)
  }

  const handleEditPolicy = (policy: Policy) => {
    setSelectedPolicy(policy)
    setShowEditModal(true)
  }

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Policies</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage access control policies and rules
          </p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Policy
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search policies..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              className="select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="abac">ABAC</option>
              <option value="time-based">Time-based</option>
              <option value="location-based">Location-based</option>
              <option value="role-based">Role-based</option>
            </select>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
            <button className="btn btn-secondary">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Policies List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flow-root">
            <ul className="-my-5 divide-y divide-gray-200">
              {filteredPolicies?.map((policy) => {
                const TypeIcon = getTypeIcon(policy.type)
                return (
                  <li key={policy.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <TypeIcon className="w-5 h-5 text-primary-600" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {policy.name}
                          </p>
                          <span className={`badge ${getTypeColor(policy.type)}`}>
                            {policy.type}
                          </span>
                          <span className={`badge ${getStatusColor(policy.status)}`}>
                            {policy.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {policy.description}
                        </p>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                          <span>Priority: {policy.priority}</span>
                          <span>Created: {new Date(policy.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button 
                          className="p-1 text-gray-400 hover:text-gray-600"
                          onClick={() => handleViewPolicy(policy)}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1 text-gray-400 hover:text-gray-600"
                          onClick={() => handleEditPolicy(policy)}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1 text-gray-400 hover:text-red-600"
                          onClick={() => handleDeletePolicy(policy.id)}
                        >
                          <Trash2 className="w-4 h-4" />
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

      {filteredPolicies?.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <Shield className="h-12 w-12" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No policies found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by creating your first policy.'
            }
          </p>
        </div>
      )}

      {/* Create Policy Modal */}
      {showCreateModal && (
        <CreatePolicyModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreatePolicy}
          isLoading={createPolicyMutation.isLoading}
        />
      )}

      {/* View Policy Modal */}
      {showViewModal && selectedPolicy && (
        <ViewPolicyModal
          policy={selectedPolicy}
          onClose={() => {
            setShowViewModal(false)
            setSelectedPolicy(null)
          }}
        />
      )}

      {/* Edit Policy Modal */}
      {showEditModal && selectedPolicy && (
        <EditPolicyModal
          policy={selectedPolicy}
          onClose={() => {
            setShowEditModal(false)
            setSelectedPolicy(null)
          }}
          onSubmit={handleUpdatePolicy}
          isLoading={updatePolicyMutation.isLoading}
        />
      )}
    </div>
  )
}

// Modal Components
function CreatePolicyModal({ onClose, onSubmit, isLoading }: {
  onClose: () => void
  onSubmit: (data: CreatePolicyData) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState<CreatePolicyData>({
    name: '',
    type: 'abac',
    description: '',
    conditions: {},
    actions: [],
    resources: [],
    subjects: []
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Policy</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                className="input mt-1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                className="select mt-1"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="abac">Attribute-Based Access Control</option>
                <option value="time-based">Time-based Access</option>
                <option value="location-based">Location-based Access</option>
                <option value="role-based">Role-based Access</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                className="input mt-1"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Creating...' : 'Create Policy'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function ViewPolicyModal({ policy, onClose }: { policy: Policy; onClose: () => void }) {
  const TypeIcon = getTypeIcon(policy.type)

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center space-x-2 mb-4">
            <TypeIcon className="w-6 h-6 text-primary-600" />
            <h3 className="text-lg font-medium text-gray-900">{policy.name}</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <p className="text-sm text-gray-900">{policy.type}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <p className="text-sm text-gray-900">{policy.description}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <p className="text-sm text-gray-900">{policy.status}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <p className="text-sm text-gray-900">{policy.priority}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Created</label>
              <p className="text-sm text-gray-900">{new Date(policy.createdAt).toLocaleString()}</p>
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditPolicyModal({ policy, onClose, onSubmit, isLoading }: {
  policy: Policy
  onClose: () => void
  onSubmit: (id: string, data: Partial<Policy>) => void
  isLoading: boolean
}) {
  const [formData, setFormData] = useState<Partial<Policy>>({
    name: policy.name,
    type: policy.type,
    description: policy.description,
    status: policy.status,
    priority: policy.priority
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(policy.id, formData)
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Policy</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                className="input mt-1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                className="select mt-1"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <option value="abac">Attribute-Based Access Control</option>
                <option value="time-based">Time-based Access</option>
                <option value="location-based">Location-based Access</option>
                <option value="role-based">Role-based Access</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                className="input mt-1"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                className="select mt-1"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Priority</label>
              <input
                type="number"
                className="input mt-1"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                min="1"
                max="10"
                required
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
              >
                {isLoading ? 'Updating...' : 'Update Policy'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 