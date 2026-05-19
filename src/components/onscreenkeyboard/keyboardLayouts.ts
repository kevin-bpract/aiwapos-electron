/**
 * Layouts for react-simple-keyboard: English (QWERTY + shift) and Arabic.
 * {lang} toggles between English and Arabic groups (handled in OnScreenKeyboard).
 */
export const OSK_LAYOUT = {
  default: [
    '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
    '{tab} q w e r t y u i o p [ ] \\',
    "{lock} a s d f g h j k l ; ' {enter}",
    '{shift} z x c v b n m , . / {shift}',
    '{lang} .com @ {space}',
  ],
  shift: [
    '~ ! @ # $ % ^ & * ( ) _ + {bksp}',
    '{tab} Q W E R T Y U I O P { } |',
    '{lock} A S D F G H J K L : " {enter}',
    '{shift} Z X C V B N M < > ? {shift}',
    '{lang} .com @ {space}',
  ],
  /** Standard PC Arabic (common letter positions) */
  arabic: [
    'ذ 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
    'ض ص ث ق ف غ ع ه خ ح ج د {enter}',
    '{shift} ش س ي ب ل ا ت ن م ك ط {shift}',
    '{lang} {space} ، . ؟',
  ],
  /** Same letters, top row symbols (like English shift) */
  arabicShift: [
    'ذ ! @ # $ % ^ & * ( ) _ + {bksp}',
    'ض ص ث ق ف غ ع ه خ ح ج د {enter}',
    '{shift} ش س ي ب ل ا ت ن م ك ط {shift}',
    '{lang} {space} ، . ؟',
  ],
};

export const OSK_DISPLAY: Record<string, string> = {
  '{bksp}': '⌫',
  '{enter}': '↵',
  '{shift}': '⇧',
  '{tab}': 'Tab',
  '{lock}': 'Caps',
  '{space}': ' ',
  '{lang}': 'عربي / EN',
  '.com': '.com',
};
