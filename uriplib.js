// URIPLIB.JS v4.0 READY

const URIP = (() => {
  const VERSION = '4.0';
  const _enc = new TextEncoder();
  const _dec = new TextDecoder();

  function encode(text) {
    const bytes = _enc.encode(text);
    const bits = [];
    for (const b of bytes) {
      for (let i = 7; i >= 0; i--) bits.push((b >> i) & 1);
    }
    return { bits, text };
  }

  function decode(bits) {
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i+j] || 0);
      bytes.push(b);
    }
    return _dec.decode(new Uint8Array(bytes));
  }

  return { VERSION, encode, decode };
})();

if (typeof module !== 'undefined') module.exports = URIP;
