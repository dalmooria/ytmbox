import { app } from 'electron';

/**
 * 개발 시 package.json name('ytmusic')과 패키징 후 productName('YTMusic')이 달라
 * userData 경로가 갈라진다. electron-store가 경로를 굳히기 전에 이름을 고정한다.
 * index.ts의 첫 import여야 한다.
 */
app.setName('YTMusic');
