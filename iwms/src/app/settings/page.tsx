'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { mfaApi, devicesApi, geofenceApi, usersApi, organizationApi } from '@/lib/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { useToast } from '@/components/Toast';

// Telemetry visual helpers
function getWifiColor(rssi: number | null | undefined): string {
  if (rssi === null || rssi === undefined) return 'var(--text-3)'; // slate-400
  if (rssi >= -55) return 'var(--green)'; // emerald-500
  if (rssi >= -70) return 'var(--indigo)'; // indigo-500
  if (rssi >= -80) return 'var(--yellow)'; // amber-500
  return 'var(--red)'; // red-500
}

function getBatteryColor(level: number | null | undefined): string {
  if (level === null || level === undefined) return 'var(--text-3)'; // slate-400
  if (level >= 80) return 'var(--green)'; // emerald-500
  if (level >= 25) return 'var(--yellow)'; // amber-400
  return 'var(--red)'; // red-500
}

function formatUptime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return 'N/A';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export default function SettingsPage() {
  const { user, refreshSelf } = useAuth();
  const { addToast: _addToast } = useToast();
  // Call-site adapter: maps local (message, type) signature to global (title, message, type)
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') =>
    _addToast('Settings', message, type);
  
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaDisableCode, setMfaDisableCode] = useState('');
  const [showMfaSetupModal, setShowMfaSetupModal] = useState(false);
  const [showMfaDisableModal, setShowMfaDisableModal] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- Biometric Hardware & Geofence State ---
  const [devices, setDevices] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loadingZones, setLoadingZones] = useState(false);

  const [pingingId, setPingingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [provisionedKey, setProvisionedKey] = useState<{ name: string; apiKey: string; apiKeyLast4: string } | null>(null);

  // Modals / Panels
  const [showAddDeviceModal, setShowAddDeviceModal] = useState(false);
  const [showPairDeviceModal, setShowPairDeviceModal] = useState(false);
  const [showAddZoneModal, setShowAddZoneModal] = useState(false);
  const [showLogsDrawer, setShowLogsDrawer] = useState(false);

  // Selected device for logs
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [deviceLogs, setDeviceLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Add Device Form
  const [deviceName, setDeviceName] = useState('');
  const [deviceIp, setDeviceIp] = useState('');
  const [devicePort, setDevicePort] = useState('4370');
  const [deviceType, setDeviceType] = useState('zkteco');
  const [deviceLocation, setDeviceLocation] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');
  const [deviceNotes, setDeviceNotes] = useState('');
  const [deviceIsSimulated, setDeviceIsSimulated] = useState(true);

  // Pair Device Form
  const [pairCode, setPairCode] = useState('');
  const [pairName, setPairName] = useState('');
  const [pairLocation, setPairLocation] = useState('');
  const [pairNotes, setPairNotes] = useState('');
  const [pairing, setPairing] = useState(false);

  // Puncher Widget Form
  const [punchEmployeeCode, setPunchEmployeeCode] = useState('');
  const [punchDeviceId, setPunchDeviceId] = useState('');
  const [punchType, setPunchType] = useState('check_in');
  const [punchTime, setPunchTime] = useState('');
  const [submittingPunch, setSubmittingPunch] = useState(false);

  // Add Zone Form
  const [zoneName, setZoneName] = useState('');
  const [zoneLat, setZoneLat] = useState('');
  const [zoneLng, setZoneLng] = useState('');
  const [zoneRadius, setZoneRadius] = useState('200');
  const [zoneNotes, setZoneNotes] = useState('');

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    weekly: true,
    alerts: false,
  });
  const [securityLevel, setSecurityLevel] = useState('standard');

  const isAdmin = ['super_admin', 'admin'].includes(user?.role || '');

  // --- Organization Settings State ---
  const [orgDetails, setOrgDetails] = useState<{ name: string; joinCode: string } | null>(null);
  const [orgNameInput, setOrgNameInput] = useState('');
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);

  const fetchOrgDetails = async () => {
    if (!['super_admin', 'admin'].includes(user?.role || '')) return;
    setLoadingOrg(true);
    try {
      const data = await organizationApi.getDetails();
      setOrgDetails(data);
      setOrgNameInput(data.name);
    } catch (err: any) {
      console.warn('Failed to load organization details:', err);
    } finally {
      setLoadingOrg(false);
    }
  };

  const handleUpdateOrgName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgNameInput.trim()) return;
    setSavingOrg(true);
    try {
      const data = await organizationApi.updateDetails(orgNameInput);
      setOrgDetails(data);
      addToast('Organization name updated successfully', 'success');
      refreshSelf();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to update organization name', 'error');
    } finally {
      setSavingOrg(false);
    }
  };

  const handleRegenerateJoinCode = async () => {
    if (!confirm('Are you sure you want to deactivate the current join code and generate a new one? Employees will no longer be able to sign up using the old code.')) {
      return;
    }
    try {
      const data = await organizationApi.regenerateCode();
      if (orgDetails) {
        setOrgDetails({ ...orgDetails, joinCode: data.joinCode });
      }
      addToast('Organization join code regenerated successfully', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to regenerate join code', 'error');
    }
  };

  // Fetch devices & zones on mount
  useEffect(() => {
    fetchDevices();
    fetchZones();
    fetchUsers();
    fetchOrgDetails();
  }, [user?.role]);

  useSocketEvent<any>('device:heartbeat', (data) => {
    setDevices((prevDevices) =>
      prevDevices.map((dev) => {
        if (dev.id === data.id) {
          return {
            ...dev,
            status: data.status,
            lastSeenAt: data.lastSeenAt,
            telemetry: {
              batteryLevel: data.batteryLevel !== undefined ? data.batteryLevel : dev.telemetry?.batteryLevel,
              wifiRssi: data.wifiRssi !== undefined ? data.wifiRssi : dev.telemetry?.wifiRssi,
              freeMemory: data.freeMemory !== undefined ? data.freeMemory : dev.telemetry?.freeMemory,
              uptimeSeconds: data.uptimeSeconds !== undefined ? data.uptimeSeconds : dev.telemetry?.uptimeSeconds,
            }
          };
        }
        return dev;
      })
    );
  });

  const fetchUsers = async () => {
    try {
      const data = await usersApi.list();
      const activeList = data.filter((u: any) => u.status === 'active');
      setUsersList(activeList);
      if (activeList.length > 0) {
        setPunchEmployeeCode(activeList[0].employeeCode || '');
      }
    } catch (err: any) {
      console.warn('Failed to load users list:', err);
    }
  };

  const fetchDevices = async () => {
    setLoadingDevices(true);
    try {
      const data = await devicesApi.list();
      setDevices(data);
      if (data.length > 0 && !punchDeviceId) {
        setPunchDeviceId(data[0].id);
      }
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to load biometric devices', 'error');
    } finally {
      setLoadingDevices(false);
    }
  };

  const fetchZones = async () => {
    setLoadingZones(true);
    try {
      const data = await geofenceApi.list();
      setZones(data);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to load geo-fence zones', 'error');
    } finally {
      setLoadingZones(false);
    }
  };

  const handlePingDevice = async (id: string) => {
    setPingingId(id);
    try {
      const res = await devicesApi.ping(id);
      addToast(res.message, res.status === 'online' ? 'success' : 'error');
      fetchDevices();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Ping test failed', 'error');
    } finally {
      setPingingId(null);
    }
  };

  const handleSyncDevice = async (id: string) => {
    setSyncingId(id);
    try {
      const res = await devicesApi.sync(id);
      addToast(res.message, 'success');
      fetchDevices();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Sync failed', 'error');
    } finally {
      setSyncingId(null);
    }
  };

  const handleProvisionDeviceKey = async (device: any) => {
    if (!confirm(`Generate a new hardware key for ${device.name}? Any previous key for this terminal will stop working.`)) return;
    setProvisioningId(device.id);
    try {
      const res = await devicesApi.provisionKey(device.id);
      setProvisionedKey({ name: res.name, apiKey: res.apiKey, apiKeyLast4: res.apiKeyLast4 });
      addToast('Hardware key generated successfully', 'success');
      fetchDevices();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to provision hardware key', 'error');
    } finally {
      setProvisioningId(null);
    }
  };

  const handleViewLogs = async (device: any) => {
    setSelectedDevice(device);
    setShowLogsDrawer(true);
    setLoadingLogs(true);
    try {
      const logs = await devicesApi.getLogs(device.id);
      setDeviceLogs(logs);
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to fetch sync logs', 'error');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName || !deviceIp) {
      addToast('Name and IP address are required', 'error');
      return;
    }
    try {
      await devicesApi.create({
        name: deviceName,
        ipAddress: deviceIp,
        port: parseInt(devicePort) || 4370,
        deviceType,
        location: deviceLocation,
        serialNumber: deviceSerial,
        hardwareModel: deviceType === 'pico2w' ? 'Raspberry Pi Pico 2 W' : '',
        notes: deviceNotes,
        isSimulated: deviceIsSimulated,
      });
      addToast('Biometric device registered successfully', 'success');
      setShowAddDeviceModal(false);
      setDeviceName('');
      setDeviceIp('');
      setDevicePort('4370');
      setDeviceType('zkteco');
      setDeviceLocation('');
      setDeviceSerial('');
      setDeviceNotes('');
      setDeviceIsSimulated(true);
      fetchDevices();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to register device', 'error');
    }
  };

  const handlePairDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairCode || !pairName) {
      addToast('Please fill in pairing code and device name', 'error');
      return;
    }
    setPairing(true);
    try {
      await devicesApi.pair({
        code: pairCode,
        name: pairName,
        location: pairLocation || undefined,
        notes: pairNotes || undefined,
      });
      addToast('Biometric device paired successfully', 'success');
      setShowPairDeviceModal(false);
      setPairCode('');
      setPairName('');
      setPairLocation('');
      setPairNotes('');
      fetchDevices();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to pair device', 'error');
    } finally {
      setPairing(false);
    }
  };

  const handleSimulationPunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!punchEmployeeCode || !punchDeviceId) {
      addToast('Please select an employee and a terminal device', 'error');
      return;
    }
    setSubmittingPunch(true);
    try {
      const payload: any = {
        employeeCode: punchEmployeeCode,
        eventType: punchType,
      };
      if (punchTime) {
        const [h, m] = punchTime.split(':');
        const d = new Date();
        d.setHours(parseInt(h), parseInt(m), 0, 0);
        payload.eventTime = d.toISOString();
      } else {
        payload.eventTime = new Date().toISOString();
      }

      await devicesApi.pushEvent(punchDeviceId, payload);
      const matchedUser = usersList.find(u => u.employeeCode === punchEmployeeCode);
      const matchedDevice = devices.find(d => d.id === punchDeviceId);
      addToast(
        `Swipe recorded for ${matchedUser?.name || punchEmployeeCode} on ${matchedDevice?.name || 'terminal'}. Run Sync to apply.`,
        'success'
      );
      setPunchTime('');
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to log swipe event', 'error');
    } finally {
      setSubmittingPunch(false);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm('Are you sure you want to remove this biometric device?')) return;
    try {
      await devicesApi.remove(id);
      addToast('Device removed successfully', 'success');
      fetchDevices();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to remove device', 'error');
    }
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneName || !zoneLat || !zoneLng) {
      addToast('Name, Latitude, and Longitude are required', 'error');
      return;
    }
    try {
      await geofenceApi.create({
        name: zoneName,
        latitude: parseFloat(zoneLat),
        longitude: parseFloat(zoneLng),
        radiusMeters: parseInt(zoneRadius) || 200,
        notes: zoneNotes,
      });
      addToast('Geo-fence zone created successfully', 'success');
      setShowAddZoneModal(false);
      setZoneName('');
      setZoneLat('');
      setZoneLng('');
      setZoneRadius('200');
      setZoneNotes('');
      fetchZones();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to create geo-fence zone', 'error');
    }
  };

  const handleDeleteZone = async (id: string) => {
    if (!confirm('Are you sure you want to delete this geo-fence zone?')) return;
    try {
      await geofenceApi.remove(id);
      addToast('Geo-fence zone deleted successfully', 'success');
      fetchZones();
    } catch (err: any) {
      addToast(err.response?.data?.error || 'Failed to delete geo-fence zone', 'error');
    }
  };

  const handleStartMfaSetup = async () => {
    setLoading(true);
    setMfaError('');
    try {
      const data = await mfaApi.setup();
      setMfaSetupData({ secret: data.secret, qrCodeUrl: data.qrCodeUrl });
      setMfaCode('');
      setShowMfaSetupModal(true);
    } catch (err: any) {
      setMfaError(err.response?.data?.error || 'Failed to initialize MFA setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfaSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaSetupData || !mfaCode) return;
    setLoading(true);
    setMfaError('');
    try {
      await mfaApi.enable({ secret: mfaSetupData.secret, token: mfaCode });
      await refreshSelf();
      setShowMfaSetupModal(false);
      setMfaSetupData(null);
      setMfaCode('');
    } catch (err: any) {
      setMfaError(err.response?.data?.error || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMfaError('');
    try {
      await mfaApi.disable({ token: mfaDisableCode });
      await refreshSelf();
      setShowMfaDisableModal(false);
      setMfaDisableCode('');
    } catch (err: any) {
      setMfaError(err.response?.data?.error || 'Disabling MFA failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMfa = () => {
    if (user?.mfaEnabled) {
      setMfaDisableCode('');
      setMfaError('');
      setShowMfaDisableModal(true);
    } else {
      handleStartMfaSetup();
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings & Configurations</h1>
          <p className="page-subtitle">Configure system security, notifications, and integration policies</p>
        </div>
      </div>

      <div className="settings-container">
        <div className="settings-grid-top">
          <div className="settings-column">
            {/* Profile Card */}
            <div className="settings-section">
              <h3 className="settings-sec-title">Admin Profile</h3>
              <div className="settings-profile-card">
                <div className="profile-avatar">{user?.avatar}</div>
                <div className="profile-details">
                  <h4>{user?.name}</h4>
                  <p className="profile-email">{user?.email}</p>
                  <span className="profile-badge">{user?.role.replace('_', ' ')}</span>
                </div>
              </div>
            </div>

            {/* Company Settings (Admin Only) */}
            {isAdmin && (
              <div className="settings-section">
                <h3 className="settings-sec-title">Company Settings</h3>
                <div className="settings-card">
                  <form onSubmit={handleUpdateOrgName} className="settings-row" style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Company / Organization Name</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="text"
                          value={orgNameInput}
                          onChange={e => setOrgNameInput(e.target.value)}
                          className="form-input"
                          placeholder="Organization Name"
                          style={{ flex: 1, margin: 0 }}
                          required
                        />
                        <button type="submit" className="btn-primary w-full sm:w-auto sm:px-5" style={{ margin: 0 }} disabled={savingOrg || loadingOrg}>
                          {savingOrg ? 'Saving...' : 'Save Name'}
                        </button>
                      </div>
                    </div>
                  </form>

                  <div className="settings-row" style={{ paddingTop: '10px' }}>
                    <div className="settings-info">
                      <h4>Employee Invite Code</h4>
                      <p>Share this code with employees so they can register and automatically join your organization.</p>
                      <div className="flex flex-wrap items-center gap-3 mt-3">
                        <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '10px 16px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.1)', fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '1px', color: 'var(--purple)', fontWeight: 'bold' }}>
                          {loadingOrg ? 'Loading...' : (orgDetails?.joinCode || '—')}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (orgDetails?.joinCode) {
                              navigator.clipboard.writeText(orgDetails.joinCode);
                              addToast('Invite code copied to clipboard!', 'success');
                            }
                          }}
                          className="demo-btn"
                          style={{ margin: 0, padding: '10px 16px', height: '100%', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
                          disabled={loadingOrg || !orgDetails?.joinCode}
                        >
                          Copy Code
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (orgDetails?.joinCode) {
                              const inviteLink = `${window.location.origin}/register?code=${orgDetails.joinCode}`;
                              navigator.clipboard.writeText(inviteLink);
                              addToast('Invite link copied to clipboard!', 'success');
                            }
                          }}
                          className="demo-btn"
                          style={{ margin: 0, padding: '10px 16px', height: '100%', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
                          disabled={loadingOrg || !orgDetails?.joinCode}
                        >
                          Copy Link
                        </button>
                        <button
                          type="button"
                          onClick={handleRegenerateJoinCode}
                          className="demo-btn"
                          style={{ margin: 0, padding: '10px 16px', height: '100%', color: 'var(--red)', borderColor: 'var(--red-soft)', background: 'var(--red-soft)', flexShrink: 0 }}
                          disabled={loadingOrg}
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="settings-column">
            {/* Security Settings */}
            <div className="settings-section">
              <h3 className="settings-sec-title">Security & Authentication</h3>
              <div className="settings-card">
                <div className="settings-row">
                  <div className="settings-info">
                    <h4>Multi-Factor Authentication (MFA)</h4>
                    <p>Require a verification code in addition to your password to sign in.</p>
                  </div>
                  <div className="toggle-wrapper">
                    <input
                      type="checkbox"
                      id="mfa"
                      checked={!!user?.mfaEnabled}
                      onChange={handleToggleMfa}
                      className="toggle-checkbox"
                      disabled={loading}
                    />
                    <label htmlFor="mfa" className="toggle-label"></label>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-info">
                    <h4>Session Timeout</h4>
                    <p>Automatically sign out users after a period of inactivity.</p>
                  </div>
                  <select className="form-input form-select max-w-xs" defaultValue="30">
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="60">1 Hour</option>
                    <option value="120">2 Hours</option>
                  </select>
                </div>

                <div className="settings-row">
                  <div className="settings-info">
                    <h4>Authentication Security Level</h4>
                    <p>Select the strictness level of passwords and access restrictions.</p>
                  </div>
                  <div className="filter-tabs mt-0">
                    {['standard', 'high', 'strict'].map(level => (
                      <button
                        key={level}
                        className={`filter-tab ${securityLevel === level ? 'filter-tab-active' : ''}`}
                        onClick={() => setSecurityLevel(level)}
                      >
                        {level.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="settings-section">
              <h3 className="settings-sec-title">Notification Preferences</h3>
              <div className="settings-card">
                <div className="settings-row">
                  <div className="settings-info">
                    <h4>Email Digests</h4>
                    <p>Receive weekly summary reports and activity statistics via email.</p>
                  </div>
                  <div className="toggle-wrapper">
                    <input
                      type="checkbox"
                      id="notif-email"
                      checked={notifications.email}
                      onChange={e => setNotifications(p => ({ ...p, email: e.target.checked }))}
                      className="toggle-checkbox"
                    />
                    <label htmlFor="notif-email" className="toggle-label"></label>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-info">
                    <h4>Push Notifications</h4>
                    <p>Receive real-time notifications on the desktop app and mobile devices.</p>
                  </div>
                  <div className="toggle-wrapper">
                    <input
                      type="checkbox"
                      id="notif-push"
                      checked={notifications.push}
                      onChange={e => setNotifications(p => ({ ...p, push: e.target.checked }))}
                      className="toggle-checkbox"
                    />
                    <label htmlFor="notif-push" className="toggle-label"></label>
                  </div>
                </div>

                <div className="settings-row">
                  <div className="settings-info">
                    <h4>Attendance Anomalies</h4>
                    <p>Notify managers instantly if employees clock in late, fail to clock out, or request manual edits.</p>
                  </div>
                  <div className="toggle-wrapper">
                    <input
                      type="checkbox"
                      id="notif-alerts"
                      checked={notifications.alerts}
                      onChange={e => setNotifications(p => ({ ...p, alerts: e.target.checked }))}
                      className="toggle-checkbox"
                    />
                    <label htmlFor="notif-alerts" className="toggle-label"></label>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '12px', fontStyle: 'italic' }}>
                ℹ️ Preference saving coming soon — changes are not yet persisted.
              </p>
            </div>
          </div>
        </div>

        {/* Hardware Integrations */}
        <div className="settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="settings-sec-title" style={{ margin: 0 }}>Biometric Hardware Integrations</h3>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowPairDeviceModal(true)}
                  className="btn-secondary-sm"
                  style={{
                    background: 'linear-gradient(135deg, var(--indigo) 0%, var(--indigo) 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: '500',
                    fontSize: '13px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                  }}
                >
                  Pair Physical Device (Pico)
                </button>
                <button onClick={() => setShowAddDeviceModal(true)} className="btn-primary-sm">
                  Add Biometric Device
                </button>
              </div>
            )}
          </div>
          <div className="settings-card bg-slate-900 border-indigo-500/20" style={{ padding: '24px' }}>
            <div className="hardware-preview-info">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--indigo)" strokeWidth="2">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
              </svg>
              <div>
                <h4 className="text-white font-medium">On-Premise Edge Agent Bridging</h4>
                <p className="text-slate-400 text-sm mt-1">Configured for synchronization with local ZKTeco, Hikvision, and generic attendance gates.</p>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
            }}>
              {loadingDevices ? (
                <p className="text-slate-400 text-sm">Loading biometric devices...</p>
              ) : devices.length === 0 ? (
                <p className="text-slate-400 text-sm">No biometric devices registered.</p>
              ) : (
                devices.map((dev) => (
                  <div key={dev.id} className="hardware-device-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '320px' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="device-status-badge">
                          <span className={`device-status-dot ${
                            dev.status === 'online' ? 'status-active pulse-online' : dev.status === 'offline' ? 'status-inactive' : 'status-unknown'
                          }`} />
                          <span className="text-xs font-semibold capitalize text-slate-300">{dev.status}</span>
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteDevice(dev.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: 'var(--red)',
                              border: 'none',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              cursor: 'pointer'
                            }}
                            title="Delete device"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      <h5 className="device-name text-white mt-3 font-semibold">{dev.name}</h5>
                      <p className="device-ip text-slate-400 text-xs mt-1">IP: {dev.ipAddress}:{dev.port}</p>
                      
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-medium capitalize">
                          {dev.brand}
                        </span>
                        {dev.location && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-medium">
                            {dev.location}
                          </span>
                        )}
                      </div>

                      <div className="mt-3 text-slate-400 text-[11px]" style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                        {dev.lastSyncAt ? (
                          <span>Last Sync: {new Date(dev.lastSyncAt).toLocaleString()}</span>
                        ) : (
                          <span>Last Sync: Never</span>
                        )}
                        {dev.lastSeenAt ? (
                          <span>Last Seen: {new Date(dev.lastSeenAt).toLocaleString()}</span>
                        ) : (
                          <span>Last Seen: Never</span>
                        )}
                        <span>Hardware Key: {dev.apiKeyLast4 ? `•••• ${dev.apiKeyLast4}` : 'Not provisioned'}</span>
                        <span>Total Events: {dev.totalEvents || 0}</span>
                      </div>

                      {/* Live Telemetry Diagnostics */}
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold block mb-2">
                          Live Hardware Telemetry
                        </span>
                        {dev.telemetry && (dev.telemetry.wifiRssi !== null || dev.telemetry.batteryLevel !== null || dev.telemetry.freeMemory !== null || dev.telemetry.uptimeSeconds !== null) ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {/* WiFi Signal RSSI */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.4)', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={getWifiColor(dev.telemetry.wifiRssi)} strokeWidth="2.5">
                                <path d="M12 20h.01M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 14 0M1.5 9.5a15 15 0 0 1 21 0" />
                              </svg>
                              <div style={{ minWidth: 0 }}>
                                <span className="text-slate-500 text-[8px] block leading-none">Signal</span>
                                <span className="text-white text-[10px] font-medium leading-none truncate block">
                                  {dev.telemetry.wifiRssi !== null ? `${dev.telemetry.wifiRssi} dBm` : 'N/A'}
                                </span>
                              </div>
                            </div>

                            {/* Battery Level */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.4)', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={getBatteryColor(dev.telemetry.batteryLevel)} strokeWidth="2.5">
                                <rect x="2" y="7" width="16" height="10" rx="2" ry="2" />
                                <line x1="22" y1="11" x2="22" y2="13" />
                              </svg>
                              <div style={{ minWidth: 0 }}>
                                <span className="text-slate-500 text-[8px] block leading-none">Battery</span>
                                <span className="text-white text-[10px] font-medium leading-none truncate block">
                                  {dev.telemetry.batteryLevel !== null ? `${dev.telemetry.batteryLevel}%` : 'N/A'}
                                </span>
                              </div>
                            </div>

                            {/* Free RAM */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.4)', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" strokeWidth="2.5">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
                              </svg>
                              <div style={{ minWidth: 0 }}>
                                <span className="text-slate-500 text-[8px] block leading-none">Free RAM</span>
                                <span className="text-white text-[10px] font-medium leading-none truncate block">
                                  {dev.telemetry.freeMemory !== null ? `${dev.telemetry.freeMemory} KB` : 'N/A'}
                                </span>
                              </div>
                            </div>

                            {/* Uptime */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(15, 23, 42, 0.4)', padding: '5px 8px', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              <div style={{ minWidth: 0 }}>
                                <span className="text-slate-500 text-[8px] block leading-none">Uptime</span>
                                <span className="text-white text-[10px] font-medium leading-none truncate block">
                                  {formatUptime(dev.telemetry.uptimeSeconds)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 italic bg-slate-950/40 p-2 rounded text-center">
                            {dev.deviceType === 'pico2w' || dev.brand === 'Pico 2 W' 
                              ? 'Awaiting telemetry transmission...' 
                              : 'Telemetry not supported on this model'}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                      {isAdmin && (
                        <button
                          onClick={() => handleProvisionDeviceKey(dev)}
                          disabled={provisioningId === dev.id}
                          className="btn-ghost-sm"
                          style={{ flex: 1, padding: '4px 0', fontSize: '11px', textAlign: 'center' }}
                        >
                          {provisioningId === dev.id ? 'Key...' : 'Provision'}
                        </button>
                      )}
                      <button
                        onClick={() => handlePingDevice(dev.id)}
                        disabled={pingingId === dev.id}
                        className="btn-ghost-sm"
                        style={{ flex: 1, padding: '4px 0', fontSize: '11px', textAlign: 'center' }}
                      >
                        {pingingId === dev.id ? 'Pinging...' : 'Ping'}
                      </button>
                      <button
                        onClick={() => handleSyncDevice(dev.id)}
                        disabled={syncingId === dev.id || dev.status === 'offline'}
                        className="btn-ghost-sm"
                        style={{ flex: 1, padding: '4px 0', fontSize: '11px', textAlign: 'center' }}
                      >
                        {syncingId === dev.id ? 'Syncing...' : 'Sync'}
                      </button>
                      <button
                        onClick={() => handleViewLogs(dev)}
                        className="btn-ghost-sm"
                        style={{ flex: 1, padding: '4px 0', fontSize: '11px', textAlign: 'center' }}
                      >
                        Logs
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Biometric Event Simulator */}
        {isAdmin && (
          <div className="settings-section">
            <h3 className="settings-sec-title">Biometric Event Simulator</h3>
            <div className="settings-card bg-slate-900 border-indigo-500/20" style={{ padding: '24px' }}>
              <div className="hardware-preview-info mb-6">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--yellow)" strokeWidth="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth="4" strokeLinecap="round" />
                  <path d="M10 6h4M9 10h6" />
                </svg>
                <div>
                  <h4 className="text-white font-medium">Terminal Swipe Event Simulator</h4>
                  <p className="text-slate-400 text-sm mt-1">
                    Simulate card swipes or fingerprint verification events on simulated biometric gate terminals.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSimulationPunch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
                <div className="form-group">
                  <label className="form-label">Employee *</label>
                  <select
                    className="form-input form-select"
                    value={punchEmployeeCode}
                    onChange={e => setPunchEmployeeCode(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select Employee</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.employeeCode}>
                        {u.name} ({u.employeeCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Gate Terminal *</label>
                  <select
                    className="form-input form-select"
                    value={punchDeviceId}
                    onChange={e => setPunchDeviceId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select Terminal</option>
                    {devices.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.isSimulated ? '(Simulated)' : '(Live)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Event Type</label>
                  <select
                    className="form-input form-select"
                    value={punchType}
                    onChange={e => setPunchType(e.target.value)}
                  >
                    <option value="check_in">Clock In (Check-in)</option>
                    <option value="check_out">Clock Out (Check-out)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Event Time (Optional)</label>
                  <input
                    type="time"
                    className="form-input"
                    value={punchTime}
                    onChange={e => setPunchTime(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingPunch}
                  className="btn-primary-sm w-full h-[38px] flex items-center justify-center gap-2"
                >
                  {submittingPunch ? 'Simulating Swipe...' : 'Simulate Swipe'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Geo-fence Zone Management */}
        <div className="settings-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="settings-sec-title" style={{ margin: 0 }}>Geo-fence Zone Management</h3>
            {isAdmin && (
              <button onClick={() => setShowAddZoneModal(true)} className="btn-primary-sm">
                Add Geo-fence Zone
              </button>
            )}
          </div>
          <div className="settings-card bg-slate-900 border-indigo-500/20" style={{ padding: '24px' }}>
            <div className="hardware-preview-info mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2">
                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <div>
                <h4 className="text-white font-medium">GPS Attendance Geofencing</h4>
                <p className="text-slate-400 text-sm mt-1">
                  Enforces clock-in restrictions for remote and on-field employees. Clock-in coordinates are verified against active zones.
                </p>
              </div>
            </div>

            <div className="geofence-list">
              {loadingZones ? (
                <p className="text-slate-400 text-sm">Loading geo-fence zones...</p>
              ) : zones.length === 0 ? (
                <p className="text-slate-400 text-sm">No geo-fence zones configured. Web clock-in allows any location.</p>
              ) : (
                zones.map((zone) => (
                  <div key={zone.id} className="geofence-card" style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h5 className="text-white font-semibold">{zone.name}</h5>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${zone.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                          {zone.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs mt-1">
                        GPS: {zone.latitude.toFixed(6)}, {zone.longitude.toFixed(6)} | Radius: {zone.radiusMeters}m
                      </p>
                      {zone.notes && <p className="text-slate-500 text-xs mt-0.5">{zone.notes}</p>}
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleDeleteZone(zone.id)} className="btn-danger-sm">
                        Delete
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* MFA Setup Modal */}
      {showMfaSetupModal && mfaSetupData && (
        <div className="modal-overlay" onClick={() => { setShowMfaSetupModal(false); setMfaSetupData(null); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div className="modal-header">
              <h3>Enable Two-Factor (MFA)</h3>
              <button className="modal-close" onClick={() => { setShowMfaSetupModal(false); setMfaSetupData(null); }}>✕</button>
            </div>
            <form onSubmit={handleVerifyMfaSetup} className="modal-body">
              <p style={{ color: 'var(--text-2)', fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>
                Scan this QR code with your Authenticator app to set up MFA.
              </p>
              
              <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <img src={mfaSetupData.qrCodeUrl} alt="MFA QR Code" style={{ width: '180px', height: '180px' }} />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Or enter code manually:</label>
                <div style={{ background: 'var(--bg-surface)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'center', color: 'var(--indigo)' }}>
                  {mfaSetupData.secret}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Verification Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="6-digit code"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '4px', fontWeight: 'bold' }}
                />
              </div>

              {mfaError && (
                <div style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '16px', textAlign: 'center', background: 'var(--red-soft)', padding: '8px', borderRadius: '6px', border: '1px solid var(--red-soft)' }}>
                  {mfaError}
                </div>
              )}

              <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <button type="button" className="btn-ghost-sm" onClick={() => { setShowMfaSetupModal(false); setMfaSetupData(null); }} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-sm" disabled={loading || mfaCode.length !== 6}>
                  {loading ? 'Verifying...' : 'Verify & Enable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MFA Disable Modal */}
      {showMfaDisableModal && (
        <div className="modal-overlay" onClick={() => setShowMfaDisableModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div className="modal-header">
              <h3>Disable Two-Factor (MFA)</h3>
              <button className="modal-close" onClick={() => setShowMfaDisableModal(false)}>✕</button>
            </div>
            <form onSubmit={handleDisableMfa} className="modal-body">
              <p style={{ color: 'var(--text-2)', fontSize: '13px', marginBottom: '16px', lineHeight: '1.5' }}>
                For security reasons, please enter your 6-digit authenticator code to confirm disabling MFA.
              </p>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Verification Code</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="6-digit code"
                  value={mfaDisableCode}
                  onChange={e => setMfaDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '4px', fontWeight: 'bold' }}
                />
              </div>

              {mfaError && (
                <div style={{ color: 'var(--red)', fontSize: '13px', marginBottom: '16px', textAlign: 'center', background: 'var(--red-soft)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  {mfaError}
                </div>
              )}

              <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <button type="button" className="btn-ghost-sm" onClick={() => setShowMfaDisableModal(false)} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-sm" style={{ background: 'var(--red)', color: '#fff' }} disabled={loading || mfaDisableCode.length !== 6}>
                  {loading ? 'Disabling...' : 'Confirm Disable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Biometric Device Modal */}
      {showAddDeviceModal && (
        <div className="modal-overlay" onClick={() => setShowAddDeviceModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div className="modal-header">
              <h3>Register Biometric Device</h3>
              <button className="modal-close" onClick={() => setShowAddDeviceModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddDevice} className="modal-body">
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Device Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Office Main Gate"
                  value={deviceName}
                  onChange={e => setDeviceName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">IP Address *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 192.168.1.120"
                    value={deviceIp}
                    onChange={e => setDeviceIp(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Port *</label>
                  <input
                    type="number"
                    className="form-input"
                    value={devicePort}
                    onChange={e => setDevicePort(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Device Type</label>
                  <select
                    className="form-input form-select"
                    value={deviceType}
                    onChange={e => setDeviceType(e.target.value)}
                  >
                    <option value="zkteco">ZKTeco</option>
                    <option value="hikvision">Hikvision</option>
                    <option value="pico2w">Raspberry Pi Pico 2 W</option>
                    <option value="generic">Generic</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Main Lobby"
                    value={deviceLocation}
                    onChange={e => setDeviceLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Serial Number</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ZK-SPEEDFACE-12345"
                  value={deviceSerial}
                  onChange={e => setDeviceSerial(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  placeholder="Additional details..."
                  value={deviceNotes}
                  onChange={e => setDeviceNotes(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={deviceIsSimulated}
                    onChange={e => setDeviceIsSimulated(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span className="text-sm text-slate-300 font-medium">Simulated Device (Check to enable simulator punch and auto-sync simulation logs)</span>
                </label>
              </div>

              <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '20px' }}>
                <button type="button" className="btn-ghost-sm" onClick={() => setShowAddDeviceModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-sm">
                  Register Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pair Physical Device Modal */}
      {showPairDeviceModal && (
        <div className="modal-overlay" onClick={() => setShowPairDeviceModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div className="modal-header">
              <h3>Pair Physical Device</h3>
              <button className="modal-close" onClick={() => setShowPairDeviceModal(false)}>✕</button>
            </div>
            <form onSubmit={handlePairDevice} className="modal-body">
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Pairing Code *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="6-digit code shown on screen"
                  value={pairCode}
                  onChange={e => setPairCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  required
                  style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px', fontWeight: 'bold' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Device Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Lobby Entrance"
                  value={pairName}
                  onChange={e => setPairName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Location</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ground Floor"
                  value={pairLocation}
                  onChange={e => setPairLocation(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  placeholder="Additional setup notes..."
                  value={pairNotes}
                  onChange={e => setPairNotes(e.target.value)}
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '20px' }}>
                <button type="button" className="btn-ghost-sm" onClick={() => setShowPairDeviceModal(false)} disabled={pairing}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-sm" style={{ background: 'linear-gradient(135deg, var(--indigo) 0%, var(--indigo) 100%)', border: 'none' }} disabled={pairing || pairCode.length !== 6 || !pairName}>
                  {pairing ? 'Pairing...' : 'Pair Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hardware Key Modal */}
      {provisionedKey && (
        <div className="modal-overlay" onClick={() => setProvisionedKey(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div className="modal-header">
              <h3>Hardware Key Provisioned</h3>
              <button className="modal-close" onClick={() => setProvisionedKey(null)}>×</button>
            </div>
            <div className="modal-body">
              <p className="text-slate-300 text-sm" style={{ marginBottom: '12px' }}>
                This key is shown once for {provisionedKey.name}. Load it into the Pico terminal firmware as the device secret.
              </p>
              <div
                style={{
                  background: 'var(--bg-page)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--blue)',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  lineHeight: 1.5,
                  padding: '12px',
                  wordBreak: 'break-all'
                }}
              >
                {provisionedKey.apiKey}
              </div>
              <p className="text-slate-500 text-xs" style={{ marginTop: '10px' }}>
                Last four: {provisionedKey.apiKeyLast4}
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
              <button type="button" className="btn-primary-sm" onClick={() => setProvisionedKey(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Geo-fence Zone Modal */}
      {showAddZoneModal && (
        <div className="modal-overlay" onClick={() => setShowAddZoneModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, margin: '0 1rem', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', padding: '1.5rem' }}>
            <div className="modal-header">
              <h3>Create Geo-fence Zone</h3>
              <button className="modal-close" onClick={() => setShowAddZoneModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddZone} className="modal-body">
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Zone Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Headquarters Office"
                  value={zoneName}
                  onChange={e => setZoneName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Latitude *</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="form-input"
                    placeholder="e.g. 37.7749"
                    value={zoneLat}
                    onChange={e => setZoneLat(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude *</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="form-input"
                    placeholder="e.g. -122.4194"
                    value={zoneLng}
                    onChange={e => setZoneLng(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Radius (meters) *</label>
                <input
                  type="number"
                  className="form-input"
                  value={zoneRadius}
                  onChange={e => setZoneRadius(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Notes / Description</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  placeholder="e.g. Main office building and immediate courtyard..."
                  value={zoneNotes}
                  onChange={e => setZoneNotes(e.target.value)}
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '20px' }}>
                <button type="button" className="btn-ghost-sm" onClick={() => setShowAddZoneModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-sm">
                  Create Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sync Logs Slide-out Drawer */}
      {showLogsDrawer && selectedDevice && (
        <div className="drawer-overlay" onClick={() => setShowLogsDrawer(false)}>
          <div className="drawer-container" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3 className="text-white font-semibold text-lg">{selectedDevice.name}</h3>
                <p className="text-slate-400 text-xs mt-0.5">Hardware Event Sync History</p>
              </div>
              <button className="modal-close" style={{ fontSize: '18px' }} onClick={() => setShowLogsDrawer(false)}>✕</button>
            </div>
            
            <div className="drawer-body">
              {loadingLogs ? (
                <div className="text-center text-slate-400 text-sm mt-8">Loading logs...</div>
              ) : deviceLogs.length === 0 ? (
                <div className="text-center text-slate-400 text-sm mt-8">No sync events recorded for this device.</div>
              ) : (
                <div className="table-scroll">
                <table className="log-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Time</th>
                      <th>Event</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deviceLogs.map((log: any) => (
                      <tr key={log.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: 'var(--bg-surface-2)',
                              color: 'var(--text-1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              border: '1px solid var(--border-strong)'
                            }}>
                              {log.userAvatar || '?'}
                            </span>
                            <div>
                              <div className="text-white font-medium text-xs">{log.userName}</div>
                              <div className="text-[10px] text-slate-400">{log.employeeCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-slate-300 text-xs">
                          {new Date(log.eventTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <div className="text-[9px] text-slate-500">
                            {new Date(log.eventTime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                        </td>
                        <td>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold capitalize ${
                            log.eventType === 'check_in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {log.eventType.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                            log.processed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400'
                          }`}>
                            {log.processed ? 'Processed' : 'Synced'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
