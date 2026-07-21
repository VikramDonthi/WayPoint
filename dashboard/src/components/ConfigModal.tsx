import React, { useState } from 'react';
import { X, Settings, Check, AlertCircle } from 'lucide-react';
import type { FirebaseAppConfig } from '../types';
import { getStoredConfig, saveStoredConfig, initFirebase } from '../firebase';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose }) => {
  const currentConfig = getStoredConfig();
  const [config, setConfig] = useState<FirebaseAppConfig>(currentConfig);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleChange = (key: keyof FirebaseAppConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value.trim() }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!config.apiKey || !config.projectId) {
      setError('apiKey and projectId are required.');
      return;
    }

    try {
      saveStoredConfig(config);
      initFirebase(config);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
        window.location.reload(); // reload to re-bind firebase SDK cleanly
      }, 1000);
    } catch (err: any) {
      setError('Failed to update config: ' + err.message);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 8, 15, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#131b29',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '550px',
        padding: '1.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '10px', borderRadius: '12px', display: 'flex' }}>
            <Settings size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f8fafc' }}>Firebase Project Configuration</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Stored locally in browser</p>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '10px',
            padding: '0.75rem',
            marginBottom: '1rem',
            color: '#f43f5e',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {(Object.keys(currentConfig) as Array<keyof FirebaseAppConfig>).map((key) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px', fontFamily: 'monospace' }}>
                {key}
              </label>
              <input
                type="text"
                value={config[key] || ''}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={`Enter ${key}...`}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  backgroundColor: '#0b0f17',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  outline: 'none'
                }}
              />
            </div>
          ))}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '10px',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                fontWeight: '600'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 1.5,
                padding: '0.75rem',
                borderRadius: '10px',
                backgroundColor: savedSuccess ? '#10b981' : '#38bdf8',
                color: '#0b0f17',
                border: 'none',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              {savedSuccess ? <Check size={18} /> : null}
              {savedSuccess ? 'Saved & Reloading...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
