import { app } from 'electron';
import { APP_NAME } from './constants';

/**
 * 개발 시 package.json name('ytmbox')과 패키징 후 productName('YTMBox')이 달라
 * userData 경로가 갈라진다. electron-store가 경로를 굳히기 전에 이름을 고정한다.
 * index.ts의 첫 import여야 한다.
 */
app.setName(APP_NAME);
