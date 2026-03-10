/**
 * ✦ SYKLUSLIB.JS v1.0
 * UR-IP · Universal Recognition Information Pattern
 * Core encoding/decoding library
 * 
 * Recognition, bukan invention.
 * Meaning first. Function inside.
 */

const URIP = (() => {

  // ── CONSTANTS ──
  const VERSION = '1.0';
  const MODES = {
    LITE:     { nodesPerArm: 60,  totalBits: 180,  maxBytes: 18,  turns: 3.5, label: 'LITE'     },
    STANDARD: { nodesPerArm: 150, totalBits: 450,  maxBytes: 45,  turns: 4.5, label: 'STANDARD' },
    DENSE:    { nodesPerArm: 360, totalBits: 1080, maxBytes: 112, turns: 5.5, label: 'DENSE'    },
    ULTRA:    { nodesPerArm: 900, totalBits: 2700, maxBytes: 290, turns: 7.0, label: 'ULTRA'    },
  };

  // ── CRC16-CCITT ──
  function crc16(bytes) {
    let crc = 0xFFFF;
    for (const byte of bytes) {
      crc ^= (byte << 8);
      for (let i = 0; i < 8; i++) {
        if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        else crc = (crc << 1) & 0xFFFF;
      }
    }
    return crc;
  }

  // ── REED-SOLOMON (simplified GF(256), generator poly x^8+x^4+x^3+x^2+1) ──
  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
  }

  function rsEncode(data, nsym) {
    // Generate generator polynomial
    let gen = [1];
    for (let i = 0; i < nsym; i++) {
      const factor = [1, GF_EXP[i]];
      const result = new Array(gen.length + factor.length - 1).fill(0);
      for (let j = 0; j < gen.length; j++)
        for (let k = 0; k < factor.length; k++)
          result[j + k] ^= gfMul(gen[j], factor[k]);
      gen = result;
    }
    // Polynomial division
    const msg = [...data, ...new Array(nsym).fill(0)];
    for (let i = 0; i < data.length; i++) {
      const coef = msg[i];
      if (coef !== 0)
        for (let j = 1; j < gen.length; j++)
          msg[i + j] ^= gfMul(gen[j], coef);
    }
    return msg.slice(data.length);
  }

  function rsCorrect(data, nsym) {
    // Simplified syndrome check — detect errors
    try {
      const syndromes = [];
      for (let i = 0; i < nsym; i++) {
        let s = 0;
        for (const b of data) s = gfMul(s, GF_EXP[i]) ^ b;
        syndromes.push(s);
      }
      const hasError = syndromes.some(s => s !== 0);
      return { data: data.slice(0, data.length - nsym), hasError };
    } catch(e) {
      return { data: data.slice(0, data.length - nsym), hasError: true };
    }
  }

  // ── TEXT → BYTES ──
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // ── ENCODE ──
  function encode(text, modeName = 'STANDARD') {
    const mode = MODES[modeName];
    if (!mode) throw new Error(`Unknown mode: ${modeName}`);

    const payload = encoder.encode(text);
    if (payload.length > mode.maxBytes) {
      throw new Error(`Text too long for ${modeName} mode (max ${mode.maxBytes} bytes, got ${payload.length})`);
    }

    // Header: version(8b) + mode(8b) + payloadLen(16b)
    const header = [
      parseInt(VERSION.replace('.','')) & 0xFF,  // version
      Object.keys(MODES).indexOf(modeName) & 0xFF, // mode index
      (payload.length >> 8) & 0xFF,
      payload.length & 0xFF,
    ];

    // CRC of payload
    const checksum = crc16(payload);
    const crcBytes = [(checksum >> 8) & 0xFF, checksum & 0xFF];

    // RS parity (8 symbols)
    const dataBytes = [...header, ...payload, ...crcBytes];
    const RS_NSYM = 8;
    const parity = rsEncode(dataBytes, RS_NSYM);

    // Full bitstream
    const fullBytes = [...dataBytes, ...parity];
    const bits = [];
    for (const byte of fullBytes) {
      for (let b = 7; b >= 0; b--) {
        bits.push((byte >> b) & 1);
      }
    }

    // Pad or truncate to totalBits
    const target = mode.totalBits;
    while (bits.length < target) {
      // Pseudo-random padding from hash
      bits.push(bits[bits.length % (bits.length || 1)] ^ 1);
    }

    return {
      bits: bits.slice(0, target),
      mode: modeName,
      text,
      payloadBytes: payload.length,
      totalBits: target,
      crc: checksum,
      hash: hashText(text),
    };
  }

  // ── DECODE ──
  function decode(bits, modeName) {
    try {
      const RS_NSYM = 8;
      // Convert bits back to bytes
      const bytes = [];
      for (let i = 0; i < Math.floor(bits.length / 8); i++) {
        let byte = 0;
        for (let b = 0; b < 8; b++) {
          byte = (byte << 1) | (bits[i * 8 + b] || 0);
        }
        bytes.push(byte);
      }

      // RS correction
      const { data, hasError } = rsCorrect(bytes, RS_NSYM);

      // Parse header
      const payloadLen = (data[2] << 8) | data[3];
      if (payloadLen <= 0 || payloadLen > 500) return { ok: false, text: '', error: 'Invalid header' };

      // Extract payload
      const payloadBytes = data.slice(4, 4 + payloadLen);

      // Verify CRC
      const storedCRC = (data[4 + payloadLen] << 8) | data[4 + payloadLen + 1];
      const computedCRC = crc16(payloadBytes);
      const crcOk = storedCRC === computedCRC;

      const text = decoder.decode(new Uint8Array(payloadBytes));

      return {
        ok: crcOk && !hasError,
        text,
        crcOk,
        hasError,
        payloadLen,
        storedCRC,
        computedCRC,
      };
    } catch (e) {
      return { ok: false, text: '', error: e.message };
    }
  }

  // ── HASH (unique rotation per text) ──
  function hashText(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  // ── SPIRAL POINT ──
  function spiralPoint(t, armOffset, turns, maxR, cx, cy, startAngle) {
    const theta = startAngle + armOffset + t * turns * Math.PI * 2;
    const r = maxR * (1 - t * 0.88);
    return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta), r, theta };
  }

  // ── DRAW SYMBOL ──
  function draw(canvas, encodeResult, theme = 'gold', animOffset = 0) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    const mode = MODES[encodeResult.mode];
    const clr = THEMES[theme] || THEMES.gold;
    const maxR = Math.min(W, H) * 0.42;
    const turns = mode.turns;
    const startAngle = (encodeResult.hash % 360) * (Math.PI / 180) + animOffset;
    const bits = encodeResult.bits;
    const halfBits = Math.floor(bits.length / 2);

    // Background
    ctx.fillStyle = clr.bg;
    ctx.fillRect(0, 0, W, H);

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, maxR + 18, 0, Math.PI * 2);
    ctx.strokeStyle = clr.primary + '33';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Cardinal dots
    [0, Math.PI/2, Math.PI, Math.PI*3/2].forEach(a => {
      ctx.beginPath();
      ctx.arc(cx + (maxR+18)*Math.cos(a), cy + (maxR+18)*Math.sin(a), 2.5, 0, Math.PI*2);
      ctx.fillStyle = clr.primary;
      ctx.shadowColor = clr.glow;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Spiral guides (very dim)
    [0, Math.PI].forEach(offset => {
      ctx.beginPath();
      ctx.strokeStyle = clr.primary + '0c';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 300; i++) {
        const p = spiralPoint(i/300, offset, turns, maxR, cx, cy, startAngle);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    });

    // Two arms data
    [
      { armBits: bits.slice(0, halfBits), offset: 0 },
      { armBits: bits.slice(halfBits),    offset: Math.PI },
    ].forEach(({ armBits, offset }) => {
      const n = armBits.length;
      for (let i = 0; i < n; i++) {
        const p0 = spiralPoint(i/n,       offset, turns, maxR, cx, cy, startAngle);
        const p1 = spiralPoint((i+1)/n,   offset, turns, maxR, cx, cy, startAngle);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        if (armBits[i] === 1) {
          ctx.strokeStyle = clr.bright + 'cc';
          ctx.lineWidth = 3;
          ctx.shadowColor = clr.glow;
          ctx.shadowBlur = 7;
        } else {
          ctx.strokeStyle = clr.dim;
          ctx.lineWidth = 0.8;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      // Arm tip
      const tip = spiralPoint(0, offset, turns, maxR, cx, cy, startAngle);
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 5, 0, Math.PI*2);
      ctx.fillStyle = clr.primary;
      ctx.shadowColor = clr.glow;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Radial guides
    [0, Math.PI/2, Math.PI, Math.PI*3/2].forEach(a => {
      ctx.beginPath();
      ctx.strokeStyle = clr.primary + '22';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([2, 6]);
      ctx.moveTo(cx + maxR*1.05*Math.cos(a), cy + maxR*1.05*Math.sin(a));
      ctx.lineTo(cx, cy);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Center glow
    const glowRing = ctx.createRadialGradient(cx, cy, 8, cx, cy, 28);
    glowRing.addColorStop(0, clr.primary + '44');
    glowRing.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI*2);
    ctx.fillStyle = glowRing;
    ctx.fill();

    // Center anchor (Pancer)
    const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
    cGrad.addColorStop(0, '#ffffff');
    cGrad.addColorStop(0.4, clr.bright);
    cGrad.addColorStop(1, clr.primary + '00');
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI*2);
    ctx.fillStyle = cGrad;
    ctx.shadowColor = clr.glow;
    ctx.shadowBlur = 24;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Void ring (celah)
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI*2);
    ctx.strokeStyle = clr.bg;
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  // ── THEMES ──
  const THEMES = {
    gold:   { primary:'#c8a840', bright:'#ffe898', dim:'#c8a84033', bg:'#04040a', glow:'#c8a840' },
    cyan:   { primary:'#47ffe0', bright:'#a0fff0', dim:'#47ffe033', bg:'#04080a', glow:'#47ffe0' },
    lime:   { primary:'#e8ff47', bright:'#f4ffaa', dim:'#e8ff4733', bg:'#060a04', glow:'#e8ff47' },
    ember:  { primary:'#ff6847', bright:'#ffb899', dim:'#ff684733', bg:'#0a0504', glow:'#ff6847' },
    violet: { primary:'#c847ff', bright:'#e4a0ff', dim:'#c847ff33', bg:'#070408', glow:'#c847ff' },
    white:  { primary:'#ccccdd', bright:'#ffffff', dim:'#ccccdd22', bg:'#060608', glow:'#aaaacc' },
  };

  // ── DRAW EMPTY (placeholder) ──
  function drawEmpty(canvas, theme = 'gold') {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const cx = W/2, cy = H/2;
    const clr = THEMES[theme] || THEMES.gold;

    ctx.fillStyle = clr.bg;
    ctx.fillRect(0, 0, W, H);

    [60, 100, 140, 180].forEach((r, i) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.strokeStyle = clr.primary + Math.max(5, 20 - i*4).toString(16) + '0';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.5, clr.bright);
    g.addColorStop(1, clr.primary + '00');
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI*2);
    ctx.fillStyle = g;
    ctx.shadowColor = clr.glow;
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ── PUBLIC API ──
  return {
    VERSION,
    MODES,
    THEMES,
    encode,
    decode,
    draw,
    drawEmpty,
    hashText,
    crc16,
    spiralPoint,
    // Utils
    autoMode(text) {
      const bytes = encoder.encode(text).length;
      if (bytes <= MODES.LITE.maxBytes)     return 'LITE';
      if (bytes <= MODES.STANDARD.maxBytes) return 'STANDARD';
      if (bytes <= MODES.DENSE.maxBytes)    return 'DENSE';
      return 'ULTRA';
    },
    info(text) {
      const bytes = encoder.encode(text).length;
      const mode = this.autoMode(text);
      return { bytes, mode, maxBytes: MODES[mode].maxBytes };
    }
  };
})();

// Export for Node.js if available
if (typeof module !== 'undefined') module.exports = URIP;
