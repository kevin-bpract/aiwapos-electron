import React from 'react';
import {
  KeyboardShortcuts,
  type KeyboardShortcutId,
} from '../../../constants/kb_config';

const shortcuts = (Object.keys(KeyboardShortcuts) as KeyboardShortcutId[]).map(
  (id) => KeyboardShortcuts[id],
);

const KeyboardShortcutModal: React.FC = () => {
  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-md min-w-[520px]">
      <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
        <p className="text-sm text-gray-600">
          Use the following keyboard shortcuts to speed up your workflow:
        </p>
      </div>

      <div className="flex-1 bg-white">
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                  Shortcut
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">
                  Description
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shortcuts.map((s) => (
                <tr key={s.action} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800 font-medium">
                    {s.action}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-900 text-gray-50 text-xs font-mono">
                      {s.key}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutModal;


