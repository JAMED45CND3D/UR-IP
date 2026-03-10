# ✦ UR-IP
### Universal Recognition Information Pattern

> *"Alive before a machine reads it."*

**UR-IP** adalah sistem kode visual generasi berikutnya.  
Bukan sekadar pengganti QR Code — tapi evolusi filosofisnya.

Dan bukan kebetulan namanya **URIP** — dalam bahasa Jawa, *urip* berarti **hidup**.  
Simbol ini hidup sebelum dibaca. *Recognition, bukan invention.*

---

## UR-IP & SYKLUS

```
SYKLUS ──── Framework keputusan
            S = O × I × |C(ρ) − P_dom|
            Mengukur kejernihan observer

   └── UR-IP ── Sistem encoding visual
                r = a · e^(b·θ)
                Simbol yang hidup sebelum dibaca mesin
```

Dua nama. Dua fungsi. Satu filosofi.

---

## Mengapa UR-IP?

| | QR Code | UR-IP |
|---|---|---|
| Visual | Kotak acak | Simbol bermakna |
| Identitas | Semua terlihat sama | Tiap simbol unik |
| Makna | Tidak ada | **Hidup sebelum dibaca** |
| Mesin | Terbaca ✓ | Terbaca ✓ |
| Manusia | Tidak terbaca | Langsung dikenali ✓ |
| Filosofi | Function first | **Meaning first, function inside** |

---

## Anatomi Simbol

```
      ●  ←── Arm tip
     /
    ○ ● ○ ●  ←── Spiral data arm
   ○          ●   (bit=1: solid · bit=0: void)
  ○   ( ✦ )   ○  ←── PANCER — anchor, tidak berputar
   ●          ○
    ● ○ ● ○
     \
      ●  ←── Arm tip berlawanan (offset 180°)
```

**Tiga elemen:**
- **Pancer** — anchor · tidak ikut berputar · titik referensi scanner
- **Dua Arm** — spiral data channel · membawa bitstream
- **Celah (Void)** — batas antar realm · simbol "bernapas"

> *Pusat tidak ikut berputar — ia adalah anchor.*  
> *Yang berputar adalah yang mengorbit.*

---

## Encoding

### Format Bitstream
```
[ HEADER  ]  version(8b) · mode(8b) · length(16b)
[ PAYLOAD ]  UTF-8 bytes
[ CRC16   ]  CCITT checksum (16b)
[ RS      ]  Reed-Solomon · 8 parity symbols
[ PADDING ]  sisa kapasitas mode
```

### Spiral Logaritmik
```
r = a · e^(b·θ)    a=0.15 · b=0.18
```
Rumus yang sama dengan cangkang nautilus, galaksi bima sakti, orbital elektron.

### Mode & Kapasitas

| Mode | Nodes/Arm | Kapasitas | Putaran |
|------|-----------|-----------|---------|
| LITE | 60 | ~18 byte | 3.5× |
| STANDARD | 150 | ~45 byte | 4.5× |
| DENSE | 360 | ~112 byte | 5.5× |
| ULTRA | 900 | ~290 byte | 7.0× |

---

## Quick Start

```html
<script src="uriplib.js"></script>
<script>
// Encode
const encoded = URIP.encode("Urip iku urip", "STANDARD");

// Draw ke canvas
URIP.draw(document.getElementById('canvas'), encoded, 'gold');

// Decode
const decoded = URIP.decode(encoded.bits, "STANDARD");
console.log(decoded.text);   // "Urip iku urip"
console.log(decoded.crcOk);  // true
</script>
```

### Animasi Orbit
```javascript
let angle = 0;
function loop() {
  URIP.draw(canvas, encoded, 'gold', angle);
  angle += 0.008;
  requestAnimationFrame(loop);
}
loop();
```

---

## API

### `URIP.encode(text, mode)`
```javascript
{
  bits: Array,         // [0,1,1,0,...] bitstream
  mode: string,        // mode yang digunakan
  crc: number,         // CRC16 checksum
  hash: number,        // rotasi unik per teks → tiap simbol beda
  totalBits: number,
  payloadBytes: number
}
```

### `URIP.decode(bits, mode)`
```javascript
{
  ok: boolean,         // true = valid & verified
  text: string,        // hasil decode
  crcOk: boolean,      // CRC16 verified
  hasError: boolean    // Reed-Solomon error flag
}
```

### `URIP.draw(canvas, encoded, theme, animOffset)`

**Themes:** `gold` · `cyan` · `lime` · `ember` · `violet` · `white`

### `URIP.autoMode(text)`
Otomatis pilih mode terkecil yang cukup.

---

## Files

```
UR-IP/
├── README.md
├── uriplib.js              ← Core library (browser + Node.js)
├── URIP_App.html         ← Generator + Scanner
├── URIP_StatAnalyzer.html
└── docs/
    ├── SYKLUS_Whitepaper.pdf
    └── SYKLUS_Filosofi.pdf
```

---

## Roadmap

- [x] v1.0 — Simbol & generator
- [x] v2.0 — CRC16 + Reed-Solomon
- [x] v3.0 — `uriplib.js` modular library
- [x] v3.1 — 4 modes · 6 themes · animasi orbit
- [ ] v4.0 — Camera scanner (Hough transform)
- [ ] v4.1 — NPM: `urip-code`
- [ ] v5.0 — AR marker · AES-256 encryption
- [ ] v5.1 — UR-IP ID · identitas digital universal
- [ ] v6.0 — Proposal open standard

---

## Filosofi

> *Bentuk spiral sudah ada di alam miliaran tahun sebelum manusia menamakannya.*  
> *Di cangkang nautilus. Di galaksi bima sakti. Di orbital elektron.*  
> *UR-IP hanya menamai dan membangunnya.*

**Recognition, bukan invention.**

---

## License

**Open Concept** — UR-IP · SYKLUS · 2026  
Terbuka untuk dikembangkan, dikaji, dan dibangun di atasnya.

---

*auroradewa.Ad74@gmail.com*

```
Urip iku urip.
Alive before it's read.
✦
```
