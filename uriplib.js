/**
 * ✦ URIPLIB.JS v4.0
 * UR-IP · Universal Recognition Information Pattern
 * Core encoding / decoding / drawing library
 *
 * Recognition, bukan invention.
 * Meaning first. Function inside.
 *
 * Changelog v4.0:
 * - TRUE logarithmic spiral: r = a·e^(b·θ), b=0.18 (was linear/fake)
 * - 3-arm encoding (was 2-arm) → 50% more capacity
 * - ULTRA mode (900 nodes/arm, ~290 byte)
 * - syklusCoord(text) → 18-digit SYKLUS spatial coordinate
 * - scan(canvas, mode) → decode direct from canvas, Otsu threshold
 * - Multi-mode/angle fallback scan (auto mode)
 * - downloadCanvas() — no race condition
 * - setupCanvas() — DPR-aware
 */

const URIP = (() => {

  // ── CONSTANTS ──────────────────────────────────────────────────────────────
  const VERSION    = '4.0';
  const PANCER     = 0.0318;        // EGO identity constant
  const SPIRAL_A   = 0.15;          // visual spiral scale
  const SPIRAL_B   = 0.18;          // visual spiral curvature
  const ARM_COUNT  = 3;
  const ARM_OFFSETS = [0, 2*Math.PI/3, 4*Math.PI/3];

  const MODES = {
    // maxBytes = floor(nodesPerArm*3/8) - 6(header) - ecSymbols
    // tMax bound: SPIRAL_A*exp(SPIRAL_B*tMax)*0.38 < 0.5 → tMax < 12.064 rad (3.84π)
    // All values below verified safe for any canvas size
    LITE:     { nodesPerArm:  60, tMin:0.5, tMax:3.0*Math.PI, label:'LITE',     maxBytes:  12, ecSymbols:  4 },
    STANDARD: { nodesPerArm: 150, tMin:0.5, tMax:3.5*Math.PI, label:'STANDARD', maxBytes:  42, ecSymbols:  8 },
    DENSE:    { nodesPerArm: 360, tMin:0.5, tMax:3.7*Math.PI, label:'DENSE',    maxBytes: 117, ecSymbols: 12 },
    ULTRA:    { nodesPerArm: 900, tMin:0.5, tMax:3.8*Math.PI, label:'ULTRA',    maxBytes: 315, ecSymbols: 16 },
  };

  const THEMES = {
    gold:   { primary:'#c8a840', bright:'#ffe898', dim:'#c8a84033', bg:'#04040a', glow:'#c8a840' },
    cyan:   { primary:'#47ffe0', bright:'#a0fff0', dim:'#47ffe033', bg:'#04080a', glow:'#47ffe0' },
    lime:   { primary:'#e8ff47', bright:'#f4ffaa', dim:'#e8ff4733', bg:'#060a04', glow:'#e8ff47' },
    ember:  { primary:'#ff6847', bright:'#ffb899', dim:'#ff684733', bg:'#0a0504', glow:'#ff6847' },
    violet: { primary:'#c847ff', bright:'#e4a0ff', dim:'#c847ff33', bg:'#070408', glow:'#c847ff' },
    white:  { primary:'#ccccdd', bright:'#ffffff', dim:'#ccccdd22', bg:'#060608', glow:'#aaaacc' },
  };

  // ── GF(256) REED-SOLOMON ───────────────────────────────────────────────────
  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x; GF_LOG[x] = i;
      x <<= 1; if (x & 0x100) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i-255];
  })();

  function gfMul(a, b) {
    if (!a || !b) return 0;
    return GF_EXP[(GF_LOG[a] + GF_LOG[b]) % 255];
  }

  function rsEncode(data, nsym) {
    let gen = [1];
    for (let i = 0; i < nsym; i++) {
      const f = [1, GF_EXP[i]];
      const r = new Array(gen.length + f.length - 1).fill(0);
      for (let j = 0; j < gen.length; j++)
        for (let k = 0; k < f.length; k++)
          r[j+k] ^= gfMul(gen[j], f[k]);
      gen = r;
    }
    const msg = [...data, ...new Array(nsym).fill(0)];
    for (let i = 0; i < data.length; i++) {
      const c = msg[i];
      if (c) for (let j = 1; j < gen.length; j++) msg[i+j] ^= gfMul(gen[j], c);
    }
    return msg.slice(data.length);
  }

  function rsHasError(data, nsym) {
    try {
      for (let i = 0; i < nsym; i++) {
        let s = 0;
        for (const b of data) s = gfMul(s, GF_EXP[i]) ^ b;
        if (s !== 0) return true;
      }
      return false;
    } catch(e) { return true; }
  }

  // ── CRC16-CCITT ────────────────────────────────────────────────────────────
  function crc16(bytes) {
    let c = 0xFFFF;
    for (const b of bytes) {
      c ^= (b << 8);
      for (let i = 0; i < 8; i++)
        c = (c & 0x8000) ? ((c<<1)^0x1021)&0xFFFF : (c<<1)&0xFFFF;
    }
    return c;
  }

  // ── HASH ───────────────────────────────────────────────────────────────────
  function hashText(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  }

  // ── TEXT CODEC ─────────────────────────────────────────────────────────────
  const _enc = new TextEncoder();
  const _dec = new TextDecoder();

  // ── ENCODE ─────────────────────────────────────────────────────────────────
  function encode(text, modeName = 'STANDARD') {
    const mode = MODES[modeName];
    if (!mode) throw new Error('Unknown mode: ' + modeName);

    const payload = _enc.encode(text);
    if (payload.length > mode.maxBytes)
      throw new Error(`Too long for ${modeName} (max ${mode.maxBytes}B, got ${payload.length}B)`);

    const modeIdx = Object.keys(MODES).indexOf(modeName);
    const crc     = crc16(payload);

    // Header: version(8) + modeIdx(8) + payloadLen_hi(8) + payloadLen_lo(8) + crc_hi(8) + crc_lo(8)
    const header    = [parseInt(VERSION)|0, modeIdx, (payload.length>>8)&0xFF, payload.length&0xFF, (crc>>8)&0xFF, crc&0xFF];
    const dataBytes = [...header, ...payload];
    const parity    = rsEncode(dataBytes, mode.ecSymbols);
    const fullBytes = [...dataBytes, ...parity];

    const bits = [];
    for (const byte of fullBytes)
      for (let b = 7; b >= 0; b--) bits.push((byte >> b) & 1);

    // Pad to capacity with deterministic pseudo-random
    const totalBits = mode.nodesPerArm * ARM_COUNT;
    const h = hashText(text);
    while (bits.length < totalBits)
      bits.push((bits[bits.length-1] ^ ((h >> (bits.length % 32)) & 1)) & 1);

    return {
      bits:         bits.slice(0, totalBits),
      mode:         modeName,
      text,
      payloadBytes: payload.length,
      totalBits,
      crc,
      hash:         h,
    };
  }

  // ── DECODE ─────────────────────────────────────────────────────────────────
  function decode(bits, modeName) {
    try {
      const mode = MODES[modeName];
      if (!mode) return { ok:false, text:'', error:'unknown mode' };

      const bytes = [];
      for (let i = 0; i+7 < bits.length; i += 8) {
        let b = 0;
        for (let j = 0; j < 8; j++) b = (b<<1) | (bits[i+j] || 0);
        bytes.push(b);
      }

      const payLen    = (bytes[2]<<8) | bytes[3];
      const storedCRC = (bytes[4]<<8) | bytes[5];

      if (payLen <= 0 || payLen > 500) return { ok:false, text:'', error:'bad length:'+payLen };

      const payloadBytes = bytes.slice(6, 6+payLen);
      if (payloadBytes.length < payLen) return { ok:false, text:'', error:'truncated' };

      // RS check only over header+payload+parity (not padding)
      const dataLen  = 6 + payLen;
      const rsBytes  = bytes.slice(0, dataLen + mode.ecSymbols);
      const hasError = rsHasError(rsBytes, mode.ecSymbols);

      const calcCRC = crc16(payloadBytes);
      const crcOk   = calcCRC === storedCRC;
      const text    = _dec.decode(new Uint8Array(payloadBytes));

      return { ok: crcOk && !hasError, text, crcOk, hasError, payLen, storedCRC, calcCRC };
    } catch(e) {
      return { ok:false, text:'', error:e.message };
    }
  }

  // ── SPIRAL POINT ───────────────────────────────────────────────────────────
  // TRUE logarithmic spiral: r(θ) = a · e^(b·θ)
  function spiralPoint(i, n, armOffset, mode, cx, cy, sc, animOffset) {
    const ao = animOffset || 0;
    const t  = mode.tMin + (i / n) * (mode.tMax - mode.tMin);
    const r  = SPIRAL_A * Math.exp(SPIRAL_B * t) * sc;
    const a  = t + armOffset + ao;
    return { x: cx + r*Math.cos(a), y: cy + r*Math.sin(a), r, t };
  }

  // ── DRAW ───────────────────────────────────────────────────────────────────
  function draw(canvas, encResult, theme, animOffset) {
    theme       = theme || 'gold';
    animOffset  = animOffset || 0;

    const ctx  = canvas.getContext('2d');
    const _dpr = window.devicePixelRatio || 1;
    const W    = canvas.width / _dpr, H = canvas.height / _dpr; // logical size
    const cx   = W/2, cy = H/2;
    const sc   = Math.min(W,H) * 0.38;
    const clr  = THEMES[theme] || THEMES.gold;
    const mode = MODES[encResult.mode];
    const n    = mode.nodesPerArm;
    const bits = encResult.bits;
    // FIX: snap to 12-step grid (every 30°) so scan() can always match
    const sAng = (encResult.hash % 12) * (Math.PI * 2 / 12);
    const OR   = Math.min(W,H) * 0.44;

    // Background
    ctx.fillStyle = clr.bg;
    ctx.fillRect(0, 0, W, H);

    // Outer ring
    ctx.beginPath(); ctx.arc(cx,cy,OR,0,Math.PI*2);
    ctx.strokeStyle=clr.primary+'33'; ctx.lineWidth=1; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,OR+6,0,Math.PI*2);
    ctx.strokeStyle=clr.primary+'11'; ctx.lineWidth=0.5; ctx.stroke();

    // Timing dots
    const TR = OR * 0.91;
    for (let i=0; i<24; i++) {
      const a = (i/24)*Math.PI*2, big = i%3===0;
      ctx.beginPath();
      ctx.arc(cx+TR*Math.cos(a), cy+TR*Math.sin(a), big?3:1.5, 0, Math.PI*2);
      ctx.fillStyle=clr.primary; ctx.globalAlpha=big?0.7:0.2; ctx.fill();
    }
    ctx.globalAlpha=1;

    // Orientation markers (3 sizes → rotation detection)
    [10,7,5].forEach((ms,ai) => {
      const p0 = spiralPoint(0, n, ARM_OFFSETS[ai]+sAng, mode, cx, cy, sc, animOffset);
      ctx.beginPath(); ctx.arc(p0.x,p0.y,ms+4,0,Math.PI*2);
      ctx.fillStyle=clr.bg; ctx.fill();
      ctx.beginPath(); ctx.arc(p0.x,p0.y,ms,0,Math.PI*2);
      ctx.strokeStyle=clr.primary+'aa'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(p0.x,p0.y,ms*0.4,0,Math.PI*2);
      ctx.fillStyle=clr.primary; ctx.fill();
    });

    // Spiral guide (dim)
    ARM_OFFSETS.forEach((off,ai) => {
      ctx.beginPath();
      for (let i=0; i<n; i++) {
        const p=spiralPoint(i,n,off+sAng,mode,cx,cy,sc,animOffset);
        i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);
      }
      ctx.strokeStyle=clr.primary+'0a'; ctx.lineWidth=0.7; ctx.stroke();
    });

    // Data nodes
    ARM_OFFSETS.forEach((off,ai) => {
      for (let i=0; i<n; i++) {
        const bit = bits[i*ARM_COUNT+ai]===1;
        const p   = spiralPoint(i,n,off+sAng,mode,cx,cy,sc,animOffset);
        ctx.beginPath(); ctx.arc(p.x,p.y,bit?4.5:1.8,0,Math.PI*2);
        if (bit) { ctx.fillStyle=clr.bright+'dd'; ctx.shadowColor=clr.glow; ctx.shadowBlur=6; }
        else     { ctx.fillStyle=clr.dim; ctx.shadowBlur=0; }
        ctx.fill();
      }
      ctx.shadowBlur=0;
      // End cap
      const ep = spiralPoint(n-1,n,off+sAng,mode,cx,cy,sc,animOffset);
      ctx.beginPath(); ctx.arc(ep.x,ep.y,8,0,Math.PI*2); ctx.fillStyle=clr.bg; ctx.fill();
      ctx.beginPath(); ctx.arc(ep.x,ep.y,5,0,Math.PI*2); ctx.fillStyle=clr.primary; ctx.fill();
    });

    // Cardinal guides
    [0,Math.PI/2,Math.PI,Math.PI*3/2].forEach(a => {
      ctx.beginPath();
      ctx.moveTo(cx+OR*1.05*Math.cos(a), cy+OR*1.05*Math.sin(a));
      ctx.lineTo(cx, cy);
      ctx.strokeStyle=clr.primary+'18'; ctx.lineWidth=0.5;
      ctx.setLineDash([2,6]); ctx.stroke();
    });
    ctx.setLineDash([]);

    // Center glow
    const glow=ctx.createRadialGradient(cx,cy,6,cx,cy,26);
    glow.addColorStop(0,clr.primary+'33'); glow.addColorStop(1,'transparent');
    ctx.beginPath(); ctx.arc(cx,cy,26,0,Math.PI*2); ctx.fillStyle=glow; ctx.fill();

    // Pancer center: solid→void→solid→void
    [[18,'#000000'],[12,'#ffffff'],[6,clr.bright],[2,'#ffffff']].forEach(([r,f]) => {
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fillStyle=f;
      if (r===6){ctx.shadowColor=clr.glow;ctx.shadowBlur=16;}
      ctx.fill(); ctx.shadowBlur=0;
    });
  }

  // ── DRAW EMPTY ─────────────────────────────────────────────────────────────
  function drawEmpty(canvas, theme) {
    theme = theme || 'gold';
    const _dpr=window.devicePixelRatio||1;
    const ctx=canvas.getContext('2d'), W=canvas.width/_dpr, H=canvas.height/_dpr;
    const cx=W/2, cy=H/2, clr=THEMES[theme]||THEMES.gold;
    ctx.fillStyle=clr.bg; ctx.fillRect(0,0,W,H);
    [60,100,140,180].forEach((r,i)=>{
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.strokeStyle=clr.primary+['14','0e','08','04'][i]; ctx.lineWidth=0.5; ctx.stroke();
    });
    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,14);
    g.addColorStop(0,'#fff'); g.addColorStop(0.5,clr.bright); g.addColorStop(1,clr.primary+'00');
    ctx.beginPath(); ctx.arc(cx,cy,14,0,Math.PI*2);
    ctx.fillStyle=g; ctx.shadowColor=clr.glow; ctx.shadowBlur=20; ctx.fill(); ctx.shadowBlur=0;
  }

  // ── OTSU THRESHOLD ─────────────────────────────────────────────────────────
  function otsuThreshold(imgData, W, H) {
    const hist=new Array(256).fill(0); let tot=0;
    for (let y=0;y<H;y+=2) for (let x=0;x<W;x+=2) {
      const i=(y*W+x)*4;
      hist[Math.round((imgData[i]+imgData[i+1]+imgData[i+2])/3)]++; tot++;
    }
    let sumAll=0;
    for (let i=0;i<256;i++) sumAll+=i*hist[i];
    let wB=0,sB=0,mx=0,thresh=128;
    for (let i=0;i<256;i++) {
      wB+=hist[i]; if(!wB)continue;
      const wF=tot-wB; if(!wF)break;
      sB+=i*hist[i];
      const v=wB*wF*Math.pow(sB/wB-(sumAll-sB)/wF,2);
      if(v>mx){mx=v;thresh=i;}
    }
    return thresh;
  }

  // ── SCAN ───────────────────────────────────────────────────────────────────
  // modeName: mode string, or 'auto' to try all modes
  function scan(canvas, modeName) {
    modeName = modeName || 'auto';
    const ctx     = canvas.getContext('2d');
    const W       = canvas.width, H = canvas.height;
    const cx      = W/2, cy = H/2;
    const sc      = Math.min(W,H) * 0.38;
    const imgData = ctx.getImageData(0,0,W,H).data;
    const thresh  = otsuThreshold(imgData, W, H);

    const tryModes   = modeName==='auto' ? Object.keys(MODES) : [modeName];
    const angleSteps = 36; // 10° resolution — safe margin for snapped 30° draw angles

    for (const mn of tryModes) {
      const mode = MODES[mn];
      const n    = mode.nodesPerArm;

      for (let ai = 0; ai < angleSteps; ai++) {
        const ao   = (ai / angleSteps) * Math.PI * 2;
        const bits = [];

        for (let i=0; i<n; i++) {
          for (let arm=0; arm<ARM_COUNT; arm++) {
            const p   = spiralPoint(i, n, ARM_OFFSETS[arm]+ao, mode, cx, cy, sc, 0);
            const px  = Math.max(0,Math.min(W-1,Math.round(p.x)));
            const py  = Math.max(0,Math.min(H-1,Math.round(p.y)));
            const idx = (py*W+px)*4;
            bits.push((imgData[idx]+imgData[idx+1]+imgData[idx+2])/3 > thresh ? 1 : 0);
          }
        }

        const res = decode(bits, mn);
        if (res.crcOk && res.text && res.text.length > 0)
          return { ...res, scannedMode:mn, angleOffset:ao };
      }
    }
    return { ok:false, text:'', error:'not found' };
  }

  // ── SYKLUS COORDINATE ─────────────────────────────────────────────────────
  function syklusCoord(text) {
    const h     = hashText(text);
    const theta = ((h % 10000) / 10000) * 100 - 50;
    const r_fwd = Math.exp(PANCER * theta);
    const r_rev = Math.exp(-PANCER * theta);
    const xf    = r_fwd * Math.cos(theta);
    const yf    = r_fwd * Math.sin(theta);
    const xr    = r_rev * Math.cos(theta);
    const yr    = r_rev * Math.sin(theta);
    const clamp = v => Math.max(0, Math.min(999999, Math.floor(v)));
    const norm  = (v,mn,mx) => clamp((v-mn)/(mx-mn)*1e6);
    const pad   = n => n.toString().padStart(6,'0');
    const sz    = norm(theta,-50,50);
    return {
      theta:   +theta.toFixed(4),
      forward: pad(norm(xf,-150,150))+pad(norm(yf,-150,150))+pad(sz),
      reverse: pad(norm(xr,-150,150))+pad(norm(yr,-150,150))+pad(sz),
      pancer:  PANCER,
    };
  }

  // ── DOWNLOAD CANVAS ────────────────────────────────────────────────────────
  function downloadCanvas(canvas, filename) {
    filename = filename || 'urip_symbol.png';
    const a  = document.createElement('a');
    a.href   = canvas.toDataURL('image/png');
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ── SETUP CANVAS (DPR-aware) ───────────────────────────────────────────────
  function setupCanvas(canvas, size) {
    const dpr = window.devicePixelRatio || 1;
    const s   = size || Math.min(window.innerWidth - 34, 460);
    canvas.style.width  = s + 'px';
    canvas.style.height = s + 'px';
    canvas.width  = s * dpr;
    canvas.height = s * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { size: s, dpr };
  }

  // ── PUBLIC API ─────────────────────────────────────────────────────────────
  return {
    VERSION, MODES, THEMES, PANCER, ARM_COUNT,
    encode, decode, draw, drawEmpty,
    scan, syklusCoord,
    hashText, crc16, spiralPoint,
    downloadCanvas, setupCanvas,
    autoMode(text) {
      const b = _enc.encode(text).length;
      if (b <= MODES.LITE.maxBytes)     return 'LITE';
      if (b <= MODES.STANDARD.maxBytes) return 'STANDARD';
      if (b <= MODES.DENSE.maxBytes)    return 'DENSE';
      return 'ULTRA';
    },
    info(text) {
      const bytes = _enc.encode(text).length;
      const mode  = this.autoMode(text);
      return { bytes, mode, maxBytes: MODES[mode].maxBytes };
    },
  };

})();

if (typeof module !== 'undefined') module.exports = URIP;
