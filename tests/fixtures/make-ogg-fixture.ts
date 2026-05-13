/**
 * Gera um arquivo OGG/opus mínimo VÁLIDO (header + 1 frame de silêncio) pra usar
 * como fixture nos testes. Roda once: `npx tsx tests/fixtures/make-ogg-fixture.ts`.
 *
 * Spec ref: RFC 7845 (Ogg Encapsulation for Opus), RFC 3533 (Ogg).
 *
 * O OGG resultante NÃO é áudio real (só silêncio com 1 frame), mas tem container
 * + codec opus válidos — suficiente pra WhatsApp/Uazapi marcar como PTT.
 */
import { writeFileSync } from "fs";
import { join } from "path";

function crc32Ogg(data: Buffer): number {
  // Polinômio OGG: 0x04c11db7, sem reflexão, init=0
  const POLY = 0x04c11db7;
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = (crc ^ (data[i] << 24)) >>> 0;
    for (let j = 0; j < 8; j++) {
      crc = ((crc & 0x80000000) ? ((crc << 1) ^ POLY) : (crc << 1)) >>> 0;
    }
  }
  return crc >>> 0;
}

function makeOggPage(
  payload: Buffer,
  headerType: number,
  granulePos: bigint,
  bitstreamSerial: number,
  pageSeq: number
): Buffer {
  // Header fixo (27 bytes) + segment_table (n) + payload
  // segment_table: bytes que descrevem segmentos (max 255 cada, último < 255 fecha o packet)
  const segments: number[] = [];
  let remaining = payload.length;
  while (remaining >= 255) {
    segments.push(255);
    remaining -= 255;
  }
  segments.push(remaining); // pode ser 0 se múltiplo de 255

  const headerLen = 27 + segments.length;
  const page = Buffer.alloc(headerLen + payload.length);
  page.write("OggS", 0, "ascii");
  page.writeUInt8(0, 4); // version
  page.writeUInt8(headerType, 5);
  page.writeBigUInt64LE(granulePos, 6);
  page.writeUInt32LE(bitstreamSerial, 14);
  page.writeUInt32LE(pageSeq, 18);
  page.writeUInt32LE(0, 22); // crc placeholder
  page.writeUInt8(segments.length, 26);
  for (let i = 0; i < segments.length; i++) {
    page.writeUInt8(segments[i], 27 + i);
  }
  payload.copy(page, headerLen);

  const crc = crc32Ogg(page);
  page.writeUInt32LE(crc, 22);
  return page;
}

function makeOpusHead(): Buffer {
  const buf = Buffer.alloc(19);
  buf.write("OpusHead", 0, "ascii"); // 8
  buf.writeUInt8(1, 8); // version
  buf.writeUInt8(1, 9); // channel count = mono
  buf.writeUInt16LE(312, 10); // pre-skip (default opus)
  buf.writeUInt32LE(48000, 12); // input sample rate
  buf.writeInt16LE(0, 16); // output gain
  buf.writeUInt8(0, 18); // channel mapping family 0
  return buf;
}

function makeOpusTags(): Buffer {
  const vendor = "crm-lagos-test";
  const buf = Buffer.alloc(8 + 4 + vendor.length + 4);
  buf.write("OpusTags", 0, "ascii");
  buf.writeUInt32LE(vendor.length, 8);
  buf.write(vendor, 12, "ascii");
  buf.writeUInt32LE(0, 12 + vendor.length); // 0 user comments
  return buf;
}

function makeSilentOpusFrames(count: number): Buffer {
  // Frame TOC byte = 0xF8 → config 31 (SILK NB, 20ms), code 0 (1 frame)
  // O frame em si pode ser apenas 1 byte (0xfc é "silêncio") seguido de 0 bytes payload.
  // Cada frame OGG-encapsulado: 1 byte TOC + 0 bytes data = 1 byte por frame.
  return Buffer.alloc(count, 0xfc);
}

const serial = Math.floor(Math.random() * 0xffffffff);

// Page 0: BOS (OpusHead)
const page0 = makeOggPage(makeOpusHead(), 0x02, 0n, serial, 0);
// Page 1: OpusTags
const page1 = makeOggPage(makeOpusTags(), 0x00, 0n, serial, 1);
// Pages 2..: 50 frames de 20ms = 1s de áudio "silencioso"
//   granule position em samples (48kHz): 50 frames * 20ms = 1000ms = 48000 samples
const audioPayload = makeSilentOpusFrames(50);
const page2 = makeOggPage(audioPayload, 0x00, 48000n, serial, 2);
// Page final: EOS marker
const page3 = makeOggPage(Buffer.alloc(0), 0x04, 48000n, serial, 3);

const ogg = Buffer.concat([page0, page1, page2, page3]);
const out = join(__dirname, "sample.ogg");
writeFileSync(out, ogg);
console.log(`✓ wrote ${out} (${ogg.length} bytes)`);
console.log(`  serial=${serial.toString(16)}, magic="${ogg.toString("ascii", 0, 4)}"`);
