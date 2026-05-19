import React, { useState } from 'react';
import { Globe, AlertCircle } from 'lucide-react';
import { isValidHttpUrl } from '../../../utils/urlValidator';

interface Props {
  onSubmit: (url: string) => void;
  onClose?: () => void;
  currentUrl?: string;
}

// Brand tokens (kept inline so this stays scoped to the design preview)
const RED = '#E63946';
const RED_HOVER = '#C81E2C';
const RED_SOFT = '#FFE5E8';
const RED_TINT = '#FFF1F3';
const TEXT = '#0F172A';
const TEXT_MUTED = '#64748B';
const TEXT_SUBTLE = '#94A3B8';
const BORDER = '#E2E5EA';

const EnvModal: React.FC<Props> = ({ onSubmit, onClose, currentUrl }) => {
  const [apiUrl, setApiUrl] = useState<string>(currentUrl || '');
  const [error, setError] = useState<null | string>(null);
  const [focused, setFocused] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiUrl(e.target.value);
    setError(null);
  };

  const handleSubmit = () => {
    if (!isValidHttpUrl(apiUrl)) {
      setError('Please enter a valid URL (must start with http:// or https://)');
      return;
    }
    onSubmit(apiUrl);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div
      style={{
        background: '#FFFFFF',
        padding: '28px 28px 24px',
        width: 'min(520px, 92vw)',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Intro */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
        <div
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: 12,
            background: RED_SOFT,
            color: RED,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Globe size={22} />
        </div>
        <div>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: TEXT,
              letterSpacing: '-0.01em',
            }}
          >
            Connect to a backend
          </h3>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              lineHeight: 1.5,
              color: TEXT_MUTED,
            }}
          >
            Point this device at your Aiwa POS server. Changing the URL will
            reset the local database.
          </p>
        </div>
      </div>

      {/* Field */}
      <label
        htmlFor="env-api-url"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 13,
          fontWeight: 600,
          color: TEXT,
          marginBottom: 8,
        }}
      >
        API URL
        <span style={{ color: RED, fontWeight: 700 }}>*</span>
      </label>

      <input
        id="env-api-url"
        type="text"
        value={apiUrl}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="https://api.example.com"
        autoFocus
        style={{
          width: '100%',
          padding: '14px 16px',
          fontSize: 15,
          color: TEXT,
          background: '#FFFFFF',
          border: `1.5px solid ${
            error ? RED : focused ? RED : BORDER
          }`,
          borderRadius: 12,
          outline: 'none',
          boxShadow: focused
            ? `0 0 0 4px ${error ? 'rgba(230,57,70,0.18)' : 'rgba(230,57,70,0.15)'}`
            : '0 1px 2px rgba(15, 23, 42, 0.04)',
          transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
          boxSizing: 'border-box',
        }}
      />

      {error && (
        <div
          style={{
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: RED_SOFT,
            color: '#8E0D18',
            border: '1px solid rgba(230, 57, 70, 0.25)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Warning notice */}
      <div
        style={{
          marginTop: 18,
          padding: '10px 12px',
          background: RED_TINT,
          border: `1px solid ${RED_SOFT}`,
          borderRadius: 8,
          fontSize: 12,
          color: TEXT_MUTED,
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: TEXT }}>Heads up:</strong> saving a new URL
        deletes local data and restarts the app.
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          marginTop: 24,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            minWidth: 110,
            padding: '12px 22px',
            background: '#FFFFFF',
            color: TEXT,
            border: `1.5px solid ${BORDER}`,
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'border-color 0.15s ease, color 0.15s ease, background 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = TEXT_SUBTLE;
            e.currentTarget.style.background = '#F7F8FA';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = BORDER;
            e.currentTarget.style.background = '#FFFFFF';
          }}
        >
          Cancel
        </button>

        <button
          type="submit"
          onClick={handleSubmit}
          style={{
            minWidth: 130,
            padding: '12px 22px',
            background: RED,
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.01em',
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(230, 57, 70, 0.28)',
            transition: 'background 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = RED_HOVER;
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow =
              '0 12px 26px rgba(230, 57, 70, 0.34)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = RED;
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow =
              '0 8px 20px rgba(230, 57, 70, 0.28)';
          }}
        >
          Save & restart
        </button>
      </div>
    </div>
  );
};

export default EnvModal;
