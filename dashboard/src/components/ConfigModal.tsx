import React from 'react';
import { X, Settings, CheckCircle2 } from 'lucide-react';
import { DEFAULT_CONFIG } from '../firebase';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const configItems = [
    { label: 'Project ID', value: DEFAULT_CONFIG.projectId },
    { label: 'Auth Domain', value: DEFAULT_CONFIG.authDomain },
    { label: 'Storage Bucket', value: DEFAULT_CONFIG.storageBucket },
    { label: 'Messaging Sender ID', value: DEFAULT_CONFIG.messagingSenderId },
    { label: 'App ID', value: DEFAULT_CONFIG.appId },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '520px',
        padding: '1.75rem',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.15)',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: '#f1f5f9',
            border: 'none',
            color: '#64748b',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1.25rem' }}>
          <div style={{ background: '#e0f2fe', color: '#0284c7', padding: '10px', borderRadius: '14px', display: 'flex' }}>
            <Settings size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0f172a' }}>Firebase System Configuration</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: '700' }}>Automatic Connected (waypoint-82d41)</span>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          color: '#166534',
          fontSize: '0.82rem'
        }}>
          <CheckCircle2 size={18} color="#166534" style={{ flexShrink: 0 }} />
          <div>
            <strong style={{ display: 'block', fontWeight: '700' }}>Automatic Production Credentials Active</strong>
            Firebase initializes automatically from project environment configuration. No manual browser storage setup is required.
          </div>
        </div>

        {/* Metadata List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {configItems.map((item) => (
            <div key={item.label} style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '0.65rem 0.85rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '600' }}>{item.label}</span>
              <span style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: '700', fontFamily: 'monospace' }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Close Button */}
        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.65rem 1.4rem',
              borderRadius: '10px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: 'none',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};
