import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Keyboard from 'react-simple-keyboard';
import 'react-simple-keyboard/build/css/index.css';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Keyboard as KeyboardIcon,
  Minus,
  MoveDiagonal2,
  Plus,
} from 'lucide-react';
import { OSK_DISPLAY, OSK_LAYOUT } from './keyboardLayouts';

const DEFAULT_PANEL_W = 720;
const DEFAULT_PANEL_H = 340;
const MIN_PANEL_W = 420;
const MIN_PANEL_H = 220;
const MAX_PANEL_W = 1100;
const MAX_PANEL_H = 520;
const MIN_KEY_SCALE = 0.75;
const MAX_KEY_SCALE = 1.35;
const KEY_SCALE_STEP = 0.08;
const PERSIST_DEBOUNCE_MS = 250;

function setNativeInputValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const prev = el.value;
  el.value = value;
  const tracker = (el as unknown as { _valueTracker?: { setValue: (v: string) => void } })
    ._valueTracker;
  if (tracker) {
    tracker.setValue(prev);
  }
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function isTextInput(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el || !(el instanceof HTMLElement)) return false;
  if (el instanceof HTMLTextAreaElement) {
    return !el.readOnly && !el.disabled;
  }
  if (el instanceof HTMLInputElement) {
    if (el.readOnly || el.disabled) return false;
    const skip = new Set([
      'button',
      'checkbox',
      'color',
      'file',
      'hidden',
      'image',
      'radio',
      'range',
      'reset',
      'submit',
    ]);
    return !skip.has(el.type);
  }
  return false;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function defaultPosition(panelW: number): { x: number; y: number } {
  return {
    x: Math.max(16, window.innerWidth - panelW - 24),
    y: Math.max(16, window.innerHeight - DEFAULT_PANEL_H - 80),
  };
}

export type OnScreenKeyboardMode = 'login' | 'restaurant';

export interface OnScreenKeyboardProps {
  settingsEnabled: boolean;
  mode: OnScreenKeyboardMode;
  manualOpen?: boolean;
  onManualOpenChange?: (open: boolean) => void;
}

const preventFocusSteal = (e: React.MouseEvent) => {
  if (!(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
    e.preventDefault();
  }
};

const OnScreenKeyboard: React.FC<OnScreenKeyboardProps> = ({
  settingsEnabled,
  mode,
  manualOpen = false,
  onManualOpenChange,
}) => {
  const keyboardRef = useRef<{ setInput: (v: string) => void } | null>(null);
  const panelElRef = useRef<HTMLDivElement | null>(null);
  const persistReadyRef = useRef(false);
  const oskPersistRef = useRef({
    mode,
    position: defaultPosition(DEFAULT_PANEL_W),
    panelSize: { w: DEFAULT_PANEL_W, h: DEFAULT_PANEL_H },
    keyScale: 1,
    langGroup: 'en' as 'en' | 'ar',
  });
  const activeElRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const positionRef = useRef({ x: 0, y: 0 });
  const panelSizeRef = useRef({ w: DEFAULT_PANEL_W, h: DEFAULT_PANEL_H });
  const settingsEnabledRef = useRef(settingsEnabled);
  settingsEnabledRef.current = settingsEnabled;

  const [minimized, setMinimized] = useState(false);
  const [focusInScope, setFocusInScope] = useState(false);
  const [persistReady, setPersistReady] = useState(false);

  const [langGroup, setLangGroup] = useState<'en' | 'ar'>('en');

  const [panelSize, setPanelSize] = useState(() => ({
    w: DEFAULT_PANEL_W,
    h: DEFAULT_PANEL_H,
  }));

  const [keyScale, setKeyScale] = useState(1);

  const [position, setPosition] = useState(() => defaultPosition(DEFAULT_PANEL_W));

  positionRef.current = position;
  panelSizeRef.current = panelSize;

  persistReadyRef.current = persistReady;
  oskPersistRef.current = { mode, position, panelSize, keyScale, langGroup };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const api = window.onScreenKeyboardLayout;
        if (!api?.get) {
          if (!cancelled) setPersistReady(true);
          return;
        }
        const snap = await api.get();
        if (cancelled) return;
        const s = mode === 'login' ? snap?.login : snap?.restaurant;
        if (s && typeof s === 'object') {
          const w = clamp(s.w ?? DEFAULT_PANEL_W, MIN_PANEL_W, MAX_PANEL_W);
          const h = clamp(s.h ?? DEFAULT_PANEL_H, MIN_PANEL_H, MAX_PANEL_H);
          const scale = clamp(s.scale ?? 1, MIN_KEY_SCALE, MAX_KEY_SCALE);
          const panelW0 = Math.min(w, window.innerWidth - 32);
          let pos =
            typeof s.x === 'number' && typeof s.y === 'number'
              ? { x: s.x, y: s.y }
              : defaultPosition(w);
          pos = {
            x: clamp(pos.x, 0, Math.max(0, window.innerWidth - panelW0 - 8)),
            y: clamp(pos.y, 0, Math.max(0, window.innerHeight - h - 8)),
          };
          setPanelSize({ w, h });
          setKeyScale(scale);
          setPosition(pos);
          if (s.lang === 'ar' || s.lang === 'en') setLangGroup(s.lang);
        }
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setPersistReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (!persistReady) return;
    const api = window.onScreenKeyboardLayout;
    if (!api?.save) return;
    const t = window.setTimeout(() => {
      const s = oskPersistRef.current;
      void api.save(s.mode, {
        x: s.position.x,
        y: s.position.y,
        w: s.panelSize.w,
        h: s.panelSize.h,
        scale: s.keyScale,
        lang: s.langGroup,
      });
    }, PERSIST_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(t);
    };
  }, [
    persistReady,
    mode,
    position.x,
    position.y,
    panelSize.w,
    panelSize.h,
    keyScale,
    langGroup,
  ]);

  useEffect(() => {
    return () => {
      const api = window.onScreenKeyboardLayout;
      if (!api?.save || !persistReadyRef.current) return;
      const s = oskPersistRef.current;
      void api.save(s.mode, {
        x: s.position.x,
        y: s.position.y,
        w: s.panelSize.w,
        h: s.panelSize.h,
        scale: s.keyScale,
        lang: s.langGroup,
      });
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      const w = panelSizeRef.current.w;
      const h = panelSizeRef.current.h;
      setPosition((prev) => ({
        x: clamp(prev.x, 0, Math.max(0, window.innerWidth - w - 8)),
        y: clamp(prev.y, 0, Math.max(0, window.innerHeight - 48)),
      }));
      setPanelSize((prev) => ({
        w: clamp(prev.w, MIN_PANEL_W, Math.min(MAX_PANEL_W, window.innerWidth - 24)),
        h: clamp(prev.h, MIN_PANEL_H, Math.min(MAX_PANEL_H, window.innerHeight - 24)),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const syncKeyboardFromActive = useCallback(() => {
    const el = activeElRef.current;
    if (el) {
      queueMicrotask(() => keyboardRef.current?.setInput(el.value));
    }
  }, []);

  /** When settings finish loading as enabled, show keyboard if focus is already in a field */
  useEffect(() => {
    if (mode !== 'restaurant' || !settingsEnabled) return;
    const ae = document.activeElement;
    if (ae && isTextInput(ae)) {
      setFocusInScope(true);
      setMinimized(false);
      activeElRef.current = ae;
      queueMicrotask(() => keyboardRef.current?.setInput(ae.value));
    }
  }, [mode, settingsEnabled]);

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (!isTextInput(t)) return;

      activeElRef.current = t;
      queueMicrotask(() => keyboardRef.current?.setInput(t.value));

      if (mode === 'restaurant' && settingsEnabledRef.current) {
        setFocusInScope(true);
        setMinimized(false);
      }
    };

    const onFocusOut = (e: FocusEvent) => {
      if (mode !== 'restaurant') return;
      if (!settingsEnabledRef.current) return;
      const rt = e.relatedTarget as HTMLElement | null;
      if (rt?.closest?.('.simple-keyboard') || rt?.closest?.('.simple-keyboard-host')) return;
      if (rt && isTextInput(rt)) return;
      window.setTimeout(() => {
        const ae = document.activeElement;
        if (!ae || !isTextInput(ae)) {
          if (document.activeElement?.closest?.('.simple-keyboard-host')) return;
          setFocusInScope(false);
          activeElRef.current = null;
        }
      }, 0);
    };

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
    };
  }, [mode]);

  useEffect(() => {
    const onInput = (e: Event) => {
      const t = e.target;
      if (!isTextInput(t)) return;
      if (t !== activeElRef.current) return;
      keyboardRef.current?.setInput(t.value);
    };

    document.addEventListener('input', onInput, true);
    return () => document.removeEventListener('input', onInput, true);
  }, []);

  const onKeyboardChange = useCallback((input: string) => {
    const el = activeElRef.current;
    if (!el) return;
    setNativeInputValue(el, input);
  }, []);

  const onKeyPress = useCallback((button: string) => {
    if (button === '{lang}') {
      setLangGroup((g) => (g === 'ar' ? 'en' : 'ar'));
    }
  }, []);

  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      const pos = positionRef.current;
      const startX = e.clientX - pos.x;
      const startY = e.clientY - pos.y;
      const w = panelSizeRef.current.w;

      const onMove = (ev: MouseEvent) => {
        const dragH = minimized
          ? 52
          : panelElRef.current?.offsetHeight ?? panelSizeRef.current.h;
        setPosition({
          x: clamp(ev.clientX - startX, 0, Math.max(0, window.innerWidth - w - 8)),
          y: clamp(ev.clientY - startY, 0, Math.max(0, window.innerHeight - dragH - 8)),
        });
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [minimized],
  );

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startW = panelSizeRef.current.w;
    const startH = panelSizeRef.current.h;
    const sx = e.clientX;
    const sy = e.clientY;
    const px = positionRef.current.x;
    const py = positionRef.current.y;

    const onMove = (ev: MouseEvent) => {
      const maxW = Math.min(MAX_PANEL_W, window.innerWidth - px - 8);
      const maxH = Math.min(MAX_PANEL_H, window.innerHeight - py - 8);
      const newH = clamp(startH + ev.clientY - sy, MIN_PANEL_H, maxH);
      setPanelSize({
        w: clamp(startW + ev.clientX - sx, MIN_PANEL_W, maxW),
        h: newH,
      });
      setKeyScale(clamp(newH / DEFAULT_PANEL_H, MIN_KEY_SCALE, MAX_KEY_SCALE));
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const bumpScale = useCallback((delta: number) => {
    setKeyScale((s) => clamp(s + delta, MIN_KEY_SCALE, MAX_KEY_SCALE));
  }, []);

  const isRtl = langGroup === 'ar';

  const showPanel = mode === 'login' ? manualOpen : settingsEnabled && focusInScope;

  if (!showPanel) {
    return null;
  }

  const panelW = Math.min(panelSize.w, window.innerWidth - 32);

  if (minimized) {
    return createPortal(
      <div
        onMouseDown={preventFocusSteal}
        className="fixed z-[9999] flex flex-col rounded-lg border border-slate-300 bg-slate-800 shadow-2xl"
        style={{
          left: position.x,
          top: position.y,
          width: Math.min(panelW, 420),
        }}
      >
        <div
          className="flex cursor-grab items-center justify-between gap-2 border-b border-slate-600 px-2 py-1.5 active:cursor-grabbing"
          onMouseDown={startDrag}
          role="presentation"
        >
          <div className="flex items-center gap-1 text-slate-300">
            <GripVertical className="h-4 w-4 shrink-0" />
            <KeyboardIcon className="h-4 w-4" />
            <span className="text-xs font-medium">Keyboard</span>
          </div>
          <button
            type="button"
            onClick={() => setMinimized(false)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-white hover:bg-slate-700"
          >
            Expand
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  const btnH = Math.round(38 * keyScale);
  const btnFs = Math.round(14 * keyScale);

  return createPortal(
    <div
      ref={panelElRef}
      onMouseDown={preventFocusSteal}
      className="fixed z-[9999] flex flex-col overflow-hidden rounded-xl border border-slate-300 bg-slate-100/98 shadow-2xl backdrop-blur-sm"
      style={{
        left: position.x,
        top: position.y,
        width: panelW,
        height: 'auto',
      }}
    >
      <div
        className="flex shrink-0 cursor-grab select-none flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-200/90 px-2 py-1.5 active:cursor-grabbing"
        onMouseDown={startDrag}
        role="presentation"
      >
        <div className="flex min-w-0 items-center gap-1 text-slate-700">
          <GripVertical className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate text-xs font-medium">On-screen keyboard</span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <div className="mr-1 flex items-center rounded-md border border-slate-300 bg-white">
            <button
              type="button"
              title="Smaller keys"
              onClick={(e) => {
                e.stopPropagation();
                bumpScale(-KEY_SCALE_STEP);
              }}
              className="p-1 text-slate-600 hover:bg-slate-100"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Larger keys"
              onClick={(e) => {
                e.stopPropagation();
                bumpScale(KEY_SCALE_STEP);
              }}
              className="p-1 text-slate-600 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLangGroup((g) => (g === 'ar' ? 'en' : 'ar'));
            }}
            className={`rounded px-2 py-1 text-xs font-semibold ${
              isRtl ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {isRtl ? 'English' : 'العربية'}
          </button>
          {mode === 'login' && onManualOpenChange && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onManualOpenChange(false);
              }}
              className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
            >
              Close
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMinimized(true);
            }}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
          >
            Minimize
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="simple-keyboard-host relative shrink-0 overflow-x-hidden px-2 pb-9 pt-1">
        <Keyboard
          key={langGroup}
          keyboardRef={(r) => {
            keyboardRef.current = r;
            if (r && activeElRef.current) {
              r.setInput(activeElRef.current.value);
            }
          }}
          layout={OSK_LAYOUT as Record<string, string[]>}
          layoutName={langGroup === 'ar' ? 'arabic' : 'default'}
          display={OSK_DISPLAY}
          rtl={langGroup === 'ar'}
          onChange={onKeyboardChange}
          onKeyPress={onKeyPress}
          preventMouseDownDefault
          theme="hg-theme-default pos-osk"
        />
      </div>
      <button
        type="button"
        title="Drag to resize"
        aria-label="Resize keyboard"
        onMouseDown={startResize}
        className="absolute bottom-1 right-1 flex h-7 w-7 cursor-se-resize items-center justify-center rounded border border-slate-400 bg-slate-200 text-slate-600 shadow-sm hover:bg-slate-300"
      >
        <MoveDiagonal2 className="h-4 w-4" />
      </button>
      <style>{`
        .pos-osk.hg-theme-default { background: transparent; padding: 4px 0; }
        .pos-osk .hg-button { height: ${btnH}px; font-size: ${btnFs}px; min-width: ${Math.round(32 * keyScale)}px; }
        .pos-osk .hg-row { margin-bottom: ${Math.round(5 * keyScale)}px; }
      `}</style>
    </div>,
    document.body,
  );
};

export default OnScreenKeyboard;
