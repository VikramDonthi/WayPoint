import React, { useState } from 'react';
import { X, UserPlus, Copy, Check, ShieldCheck, AlertCircle, Phone, Lock, User } from 'lucide-react';
import { createRiderAccount } from '../firebase';

interface AddRiderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRiderAdded?: () => void;
}

export const AddRiderModal: React.FC<AddRiderModalProps> = ({ isOpen, onClose, onRiderAdded }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State to hold newly created credentials to show once to admin
  const [createdCredential, setCreatedCredential] = useState<{
    name: string;
    phone: string;
    password: string;
    uid: string;
  } | null>(null);

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!name.trim()) {
      setError('Please enter rider full name');
      setLoading(false);
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      setError('Please enter a valid mobile number (at least 8 digits)');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const result = await createRiderAccount(cleanPhone, password, name);
      setCreatedCredential(result);
      if (onRiderAdded) onRiderAdded();
    } catch (err: any) {
      console.error('Failed to create rider account', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('A rider with this mobile number already exists.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'Failed to create rider. Check Firebase Config or connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!createdCredential) return;
    const text = `Waypoint Rider Login Credentials:\nName: ${createdCredential.name}\nMobile: ${createdCredential.phone}\nPassword: ${createdCredential.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetAndClose = () => {
    setName('');
    setPhone('');
    setPassword('');
    setError(null);
    setCreatedCredential(null);
    onClose();
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
        maxWidth: '500px',
        padding: '1.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        position: 'relative'
      }}>
        {/* Close button */}
        <button
          onClick={resetAndClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            padding: '10px',
            borderRadius: '12px',
            display: 'flex'
          }}>
            <UserPlus size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#f8fafc' }}>Add New Delivery Rider</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Account created using Secondary Auth instance</p>
          </div>
        </div>

        {createdCredential ? (
          /* Success Credential View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem'
            }}>
              <ShieldCheck size={24} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ color: '#10b981', fontWeight: '600', marginBottom: '4px' }}>Rider Created Successfully!</h4>
                <p style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  Share these login credentials directly with the rider. Passwords cannot be retrieved later.
                </p>
              </div>
            </div>

            <div style={{
              background: '#0b0f17',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#64748b' }}>Rider Name:</span>
                <span style={{ color: '#f8fafc', fontWeight: '600' }}>{createdCredential.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#64748b' }}>Mobile Number:</span>
                <span style={{ color: '#38bdf8', fontWeight: '600', fontFamily: 'monospace' }}>{createdCredential.phone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: '#64748b' }}>Assigned Password:</span>
                <span style={{ color: '#f59e0b', fontWeight: '600', fontFamily: 'monospace' }}>{createdCredential.password}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', paddingTop: '0.5rem', borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                <span style={{ color: '#64748b' }}>Firebase Auth UID:</span>
                <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.75rem' }}>{createdCredential.uid}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleCopy}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  background: copied ? '#10b981' : '#38bdf8',
                  color: '#0b0f17',
                  fontWeight: '600',
                  border: 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied Credentials!' : 'Copy Credentials'}
              </button>

              <button
                onClick={resetAndClose}
                style={{
                  padding: '0.75rem 1.25rem',
                  borderRadius: '10px',
                  background: '#1e293b',
                  color: '#f8fafc',
                  fontWeight: '600',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Add Rider Input Form */
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {error && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: '10px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#f43f5e',
                fontSize: '0.85rem'
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Rider Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    backgroundColor: '#0b0f17',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    outline: 'none'
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Mobile Number (Login Identifier)
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    backgroundColor: '#0b0f17',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    outline: 'none'
                  }}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                Assign Initial Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                    backgroundColor: '#0b0f17',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    outline: 'none'
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={resetAndClose}
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
                disabled={loading}
                style={{
                  flex: 1.5,
                  padding: '0.75rem',
                  borderRadius: '10px',
                  backgroundColor: '#38bdf8',
                  color: '#0b0f17',
                  border: 'none',
                  fontWeight: '700',
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? 'Creating Rider...' : 'Create Rider Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
