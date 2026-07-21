import React from 'react';
import { X, Smartphone, ExternalLink } from 'lucide-react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  // Compute mobile URL for local network testing (uses current host URL with ?mode=rider)
  const currentUrl = window.location.origin + '?mode=rider';
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(currentUrl)}&color=00f2fe&bkg=0b0f17`;

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
        maxWidth: '420px',
        padding: '1.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        position: 'relative',
        textAlign: 'center'
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

        <div style={{
          background: 'rgba(56, 189, 248, 0.15)',
          color: '#38bdf8',
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1rem auto'
        }}>
          <Smartphone size={26} />
        </div>

        <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#f8fafc', marginBottom: '4px' }}>
          Test Rider App on Phone
        </h3>
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
          Scan QR Code with your phone camera (No APK install required!)
        </p>

        {/* QR Code Container */}
        <div style={{
          backgroundColor: '#0b0f17',
          padding: '1rem',
          borderRadius: '16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'inline-block',
          marginBottom: '1rem'
        }}>
          <img
            src={qrImageUrl}
            alt="Rider App QR Code"
            style={{ width: '200px', height: '200px', borderRadius: '8px', display: 'block' }}
          />
        </div>

        <div style={{
          backgroundColor: '#0b0f17',
          padding: '0.65rem 0.85rem',
          borderRadius: '10px',
          fontSize: '0.78rem',
          color: '#38bdf8',
          wordBreak: 'break-all',
          fontFamily: 'monospace',
          marginBottom: '1.25rem',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          {currentUrl}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.75rem',
              borderRadius: '10px',
              backgroundColor: '#38bdf8',
              color: '#0b0f17',
              fontWeight: '700',
              textDecoration: 'none',
              fontSize: '0.85rem'
            }}
          >
            <ExternalLink size={16} /> Open in Tab
          </a>

          <button
            onClick={onClose}
            style={{
              padding: '0.75rem 1.25rem',
              borderRadius: '10px',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              fontWeight: '600',
              border: 'none',
              fontSize: '0.85rem'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
