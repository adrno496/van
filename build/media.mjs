// Images reçues d'ailleurs (carnet du Planner) : type réel lu dans les premiers octets, métadonnées retirées.
// Seuls JPEG, PNG et WebP sont acceptés ; SVG, GIF, HTML ou tout fichier dont le contenu ne correspond pas à l'extension annoncée sont refusés.
// Le retrait des métadonnées ne touche pas à l'image elle-même : il enlève les blocs EXIF (dont la position GPS), XMP, IPTC, commentaires et textes.

export function sniff(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 16) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) return 'png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// JPEG : on garde les segments nécessaires au décodage (SOF, DHT, DQT, DRI, SOS…, APP0 JFIF, APP2 profil de couleur, APP14 Adobe)
// et on retire APP1 (EXIF, XMP), APP13 (IPTC/Photoshop), les autres APPn et les commentaires (COM).
function stripJpeg(buf) {
  const out = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) throw new Error('JPEG : structure inattendue');
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; }                     // octets de remplissage
    if (marker === 0xd9) { out.push(buf.subarray(i, i + 2)); i += 2; break; }
    if (marker >= 0xd0 && marker <= 0xd7) { out.push(buf.subarray(i, i + 2)); i += 2; continue; }
    const length = buf.readUInt16BE(i + 2);
    if (length < 2 || i + 2 + length > buf.length) throw new Error('JPEG : segment tronqué');
    const segment = buf.subarray(i, i + 2 + length);
    if (marker === 0xda) { out.push(buf.subarray(i)); i = buf.length; break; }   // début des données de l'image : tout le reste est conservé
    const app = marker >= 0xe0 && marker <= 0xef, keep = !app && marker !== 0xfe || marker === 0xe0 || marker === 0xe2 || marker === 0xee;
    if (keep) out.push(segment);
    i += 2 + length;
  }
  return Buffer.concat(out);
}

// PNG : les blocs de texte (tEXt, zTXt, iTXt), EXIF (eXIf) et la date (tIME) sont retirés ; les autres sont gardés tels quels.
const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);
function stripPng(buf) {
  const out = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= buf.length) {
    const length = buf.readUInt32BE(i), type = buf.toString('ascii', i + 4, i + 8), end = i + 12 + length;
    if (end > buf.length) throw new Error('PNG : bloc tronqué');
    if (!PNG_DROP.has(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return Buffer.concat(out);
}

// WebP : les blocs EXIF et XMP sont retirés, les indicateurs correspondants de l'en-tête VP8X remis à zéro, la taille RIFF recalculée.
function stripWebp(buf) {
  const chunks = [];
  let i = 12;
  while (i + 8 <= buf.length) {
    const type = buf.toString('ascii', i, i + 4), length = buf.readUInt32LE(i + 4), end = i + 8 + length + (length % 2);
    if (i + 8 + length > buf.length) throw new Error('WebP : bloc tronqué');
    if (type !== 'EXIF' && type !== 'XMP ') chunks.push(Buffer.from(buf.subarray(i, Math.min(end, buf.length))));
    i = end;
  }
  for (const c of chunks) if (c.toString('ascii', 0, 4) === 'VP8X') c[8] &= ~(0x08 | 0x04);   // drapeaux EXIF (0x08) et XMP (0x04)
  const body = Buffer.concat(chunks), head = Buffer.alloc(12);
  head.write('RIFF', 0, 'ascii'); head.writeUInt32LE(body.length + 4, 4); head.write('WEBP', 8, 'ascii');
  return Buffer.concat([head, body]);
}

export function stripMetadata(buf, type = sniff(buf)) {
  if (type === 'jpeg') return stripJpeg(buf);
  if (type === 'png') return stripPng(buf);
  if (type === 'webp') return stripWebp(buf);
  throw new Error('type d’image non pris en charge');
}
