import { Menu, MenuItemConstructorOptions } from 'electron';
import { settings } from './settings';

export interface MenuOptions {
  onForceMediaKeysChange(enabled: boolean): void;
}

export function installApplicationMenu(opts: MenuOptions): void {
  const isMac = process.platform === 'darwin';

  const settingsSubmenu: MenuItemConstructorOptions[] = [
    {
      label: 'Chrome User-Agent로 위장 (재시작 필요)',
      type: 'checkbox',
      checked: settings.get('overrideUserAgent'),
      click: (item) => settings.set('overrideUserAgent', item.checked),
    },
    {
      label: '미디어키 강제 점유 (다른 앱의 미디어키를 가로챔)',
      type: 'checkbox',
      checked: settings.get('forceMediaKeys'),
      click: (item) => {
        settings.set('forceMediaKeys', item.checked);
        opts.onForceMediaKeysChange(item.checked);
      },
    },
  ];

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    { label: '설정', submenu: settingsSubmenu },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
    ...(isMac ? [] : [{ role: 'quit' } as MenuItemConstructorOptions]),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
