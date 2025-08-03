import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import axios from 'axios'
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Bell, 
  Save,
  Eye,
  EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'

interface UserSettings {
  id: string
  email: string
  name: string
  preferences: {
    theme: 'light' | 'dark' | 'auto'
    language: string
    timezone: string
    notifications: {
      email: boolean
      push: boolean
      sms: boolean
    }
  }
  security: {
    twoFactorEnabled: boolean
    sessionTimeout: number
    passwordExpiryDays: number
  }
}

interface SystemSettings {
  blockchain: {
    network: string
    rpcUrl: string
    gasLimit: number
    gasPrice: number
  }
  database: {
    type: string
    url: string
    poolSize: number
  }
  mqtt: {
    brokerUrl: string
    username: string
    password: string
  }
  monitoring: {
    enabled: boolean
    interval: number
    retentionDays: number
  }
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'system'>('profile')
  const [showPassword, setShowPassword] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const queryClient = useQueryClient()

  const { data: userSettings, isLoading: userLoading } = useQuery<UserSettings>(
    'user-settings',
    async () => {
      const response = await axios.get('/api/settings/user')
      return response.data.data.settings
    }
  )

  const { data: systemSettings, isLoading: systemLoading } = useQuery<SystemSettings>(
    'system-settings',
    async () => {
      const response = await axios.get('/api/settings/system')
      return response.data.data.settings
    }
  )

  const updateUserSettingsMutation = useMutation(
    async (data: Partial<UserSettings>) => {
      const response = await axios.put('/api/settings/user', data)
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('user-settings')
        toast.success('Settings updated successfully!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update settings')
      }
    }
  )

  const updateSystemSettingsMutation = useMutation(
    async (data: Partial<SystemSettings>) => {
      const response = await axios.put('/api/settings/system', data)
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('system-settings')
        toast.success('System settings updated successfully!')
      },
      onError: (error: any) => {
        toast.error(error.response?.data?.message || 'Failed to update system settings')
      }
    }
  )

  const [formData, setFormData] = useState({
    profile: {
      name: userSettings?.name || '',
      email: userSettings?.email || '',
      timezone: userSettings?.preferences.timezone || '',
      language: userSettings?.preferences.language || 'en'
    },
    security: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
      twoFactorEnabled: userSettings?.security.twoFactorEnabled || false,
      sessionTimeout: userSettings?.security.sessionTimeout || 30
    },
    notifications: {
      email: userSettings?.preferences.notifications.email || false,
      push: userSettings?.preferences.notifications.push || false,
      sms: userSettings?.preferences.notifications.sms || false
    },
    system: {
      blockchainNetwork: systemSettings?.blockchain.network || 'development',
      rpcUrl: systemSettings?.blockchain.rpcUrl || '',
      gasLimit: systemSettings?.blockchain.gasLimit || 3000000,
      gasPrice: systemSettings?.blockchain.gasPrice || 20,
      monitoringEnabled: systemSettings?.monitoring.enabled || true,
      monitoringInterval: systemSettings?.monitoring.interval || 30,
      retentionDays: systemSettings?.monitoring.retentionDays || 30
    }
  })

  const handleInputChange = (section: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [field]: value
      }
    }))
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      await updateUserSettingsMutation.mutateAsync({
        name: formData.profile.name,
        email: formData.profile.email,
        preferences: {
          theme: userSettings?.preferences.theme || 'light',
          timezone: formData.profile.timezone,
          language: formData.profile.language,
          notifications: userSettings?.preferences.notifications || {
            email: false,
            push: false,
            sms: false
          }
        }
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveSecurity = async () => {
    if (formData.security.newPassword !== formData.security.confirmPassword) {
      toast.error('New passwords do not match')
      return
    }

    setIsSaving(true)
    try {
      await updateUserSettingsMutation.mutateAsync({
        security: {
          twoFactorEnabled: formData.security.twoFactorEnabled,
          sessionTimeout: formData.security.sessionTimeout,
          passwordExpiryDays: userSettings?.security.passwordExpiryDays || 90
        }
      })
      
      if (formData.security.newPassword) {
        // Handle password change
        await axios.put('/api/settings/change-password', {
          currentPassword: formData.security.currentPassword,
          newPassword: formData.security.newPassword
        })
        toast.success('Password changed successfully!')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    setIsSaving(true)
    try {
      await updateUserSettingsMutation.mutateAsync({
        preferences: {
          theme: userSettings?.preferences.theme || 'light',
          language: userSettings?.preferences.language || 'en',
          timezone: userSettings?.preferences.timezone || 'UTC',
          notifications: formData.notifications
        }
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveSystem = async () => {
    setIsSaving(true)
    try {
      await updateSystemSettingsMutation.mutateAsync({
        blockchain: {
          network: formData.system.blockchainNetwork,
          rpcUrl: formData.system.rpcUrl,
          gasLimit: formData.system.gasLimit,
          gasPrice: formData.system.gasPrice
        },
        monitoring: {
          enabled: formData.system.monitoringEnabled,
          interval: formData.system.monitoringInterval,
          retentionDays: formData.system.retentionDays
        }
      })
    } finally {
      setIsSaving(false)
    }
  }

  const isLoading = userLoading || systemLoading

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="space-y-4">
          {[...Array(6)].map((_, i) => (
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
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure system settings and preferences
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'profile'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="w-4 h-4 inline mr-2" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'security'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            Security
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'notifications'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Bell className="w-4 h-4 inline mr-2" />
            Notifications
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'system'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
                         <SettingsIcon className="w-4 h-4 inline mr-2" />
            System
          </button>
        </nav>
      </div>

      {/* Profile Settings */}
      {activeTab === 'profile' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                type="text"
                className="input mt-1"
                value={formData.profile.name}
                onChange={(e) => handleInputChange('profile', 'name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="input mt-1"
                value={formData.profile.email}
                onChange={(e) => handleInputChange('profile', 'email', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Timezone</label>
              <select
                className="select mt-1"
                value={formData.profile.timezone}
                onChange={(e) => handleInputChange('profile', 'timezone', e.target.value)}
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Paris">Paris</option>
                <option value="Asia/Tokyo">Tokyo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Language</label>
              <select
                className="select mt-1"
                value={formData.profile.language}
                onChange={(e) => handleInputChange('profile', 'language', e.target.value)}
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
              </select>
            </div>
            <div className="flex justify-end">
              <button
                className="btn btn-primary"
                onClick={handleSaveProfile}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Current Password</label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  value={formData.security.currentPassword}
                  onChange={(e) => handleInputChange('security', 'currentPassword', e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                className="input mt-1"
                value={formData.security.newPassword}
                onChange={(e) => handleInputChange('security', 'newPassword', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
              <input
                type="password"
                className="input mt-1"
                value={formData.security.confirmPassword}
                onChange={(e) => handleInputChange('security', 'confirmPassword', e.target.value)}
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="two-factor"
                className="rounded border-gray-300"
                checked={formData.security.twoFactorEnabled}
                onChange={(e) => handleInputChange('security', 'twoFactorEnabled', e.target.checked)}
              />
              <label htmlFor="two-factor" className="ml-2 text-sm text-gray-700">
                Enable Two-Factor Authentication
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Session Timeout (minutes)</label>
              <input
                type="number"
                className="input mt-1"
                value={formData.security.sessionTimeout}
                onChange={(e) => handleInputChange('security', 'sessionTimeout', parseInt(e.target.value))}
                min="5"
                max="1440"
              />
            </div>
            <div className="flex justify-end">
              <button
                className="btn btn-primary"
                onClick={handleSaveSecurity}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                <p className="text-sm text-gray-500">Receive notifications via email</p>
              </div>
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={formData.notifications.email}
                onChange={(e) => handleInputChange('notifications', 'email', e.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Push Notifications</h4>
                <p className="text-sm text-gray-500">Receive push notifications in browser</p>
              </div>
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={formData.notifications.push}
                onChange={(e) => handleInputChange('notifications', 'push', e.target.checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">SMS Notifications</h4>
                <p className="text-sm text-gray-500">Receive notifications via SMS</p>
              </div>
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={formData.notifications.sms}
                onChange={(e) => handleInputChange('notifications', 'sms', e.target.checked)}
              />
            </div>
            <div className="flex justify-end">
              <button
                className="btn btn-primary"
                onClick={handleSaveNotifications}
                disabled={isSaving}
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Settings */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Blockchain Settings */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Blockchain Configuration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Network</label>
                <select
                  className="select mt-1"
                  value={formData.system.blockchainNetwork}
                  onChange={(e) => handleInputChange('system', 'blockchainNetwork', e.target.value)}
                >
                  <option value="development">Development</option>
                  <option value="testnet">Testnet</option>
                  <option value="mainnet">Mainnet</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">RPC URL</label>
                <input
                  type="text"
                  className="input mt-1"
                  value={formData.system.rpcUrl}
                  onChange={(e) => handleInputChange('system', 'rpcUrl', e.target.value)}
                  placeholder="https://mainnet.infura.io/v3/YOUR_PROJECT_ID"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Gas Limit</label>
                  <input
                    type="number"
                    className="input mt-1"
                    value={formData.system.gasLimit}
                    onChange={(e) => handleInputChange('system', 'gasLimit', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Gas Price (Gwei)</label>
                  <input
                    type="number"
                    className="input mt-1"
                    value={formData.system.gasPrice}
                    onChange={(e) => handleInputChange('system', 'gasPrice', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Monitoring Settings */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Monitoring Configuration</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Enable Monitoring</h4>
                  <p className="text-sm text-gray-500">Collect system performance metrics</p>
                </div>
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={formData.system.monitoringEnabled}
                  onChange={(e) => handleInputChange('system', 'monitoringEnabled', e.target.checked)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Monitoring Interval (seconds)</label>
                  <input
                    type="number"
                    className="input mt-1"
                    value={formData.system.monitoringInterval}
                    onChange={(e) => handleInputChange('system', 'monitoringInterval', parseInt(e.target.value))}
                    min="10"
                    max="3600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Data Retention (days)</label>
                  <input
                    type="number"
                    className="input mt-1"
                    value={formData.system.retentionDays}
                    onChange={(e) => handleInputChange('system', 'retentionDays', parseInt(e.target.value))}
                    min="1"
                    max="365"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              onClick={handleSaveSystem}
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save System Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
} 