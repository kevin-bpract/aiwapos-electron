import React from 'react';
import { Keyboard } from 'lucide-react';

interface OnScreenKeyboardToggleButtonProps {
  open: boolean;
  onToggle: () => void;
}

/**
 * Toggles the floating on-screen keyboard on the login screen.
 */
const OnScreenKeyboardToggleButton: React.FC<OnScreenKeyboardToggleButtonProps> = ({
  open,
  onToggle,
}) => (
  <button
    type="button"
    onClick={onToggle}
    className="login-keyboard-toggle"
    title={open ? 'Hide on-screen keyboard' : 'Show on-screen keyboard'}
  >
    <Keyboard className="login-keyboard-toggle__icon" size={20} strokeWidth={2} />
    <span>{open ? 'Hide keyboard' : 'On-screen keyboard'}</span>
  </button>
);

export default OnScreenKeyboardToggleButton;
