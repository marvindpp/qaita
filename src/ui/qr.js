// QR-код как SVG-строка (qrcode-generator, MIT). Уровень коррекции L — ссылка длинная, так QR реже и легче сканируется.
import qrcode from 'qrcode-generator';

export function qrSvg(text) {
  const qr = qrcode(0, 'L');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}
