# ✦ UR-IP
### Universal Recognition Information Pattern

> *"Alive before a machine reads it."*
https://jamed45cnd3d.github.io/UR-IP/URIP_App.html
**UR-IP** adalah sistem kode visual generasi berikutnya.  
Bukan sekadar pengganti QR Code — tapi evolusi filosofisnya.

Dan bukan kebetulan namanya **URIP** — dalam bahasa Jawa, *urip* berarti **hidup**.  
Simbol ini hidup sebelum dibaca. *Recognition, bukan invention.*

---

## UR-IP & SYKLUS

```
SYKLUS ──── Framework keputusan & ruang koordinat
            S = O × I × |C(ρ) − P_dom|
            r(θ) = e^(0.0318·θ)     ← spiral identitas

   └── UR-IP ── Sistem encoding visual
                r = a · e^(0.18·θ)  ← spiral simbol (b=0.18 intentional)
                Simbol yang hidup sebelum dibaca mesin
```

Dua nama. Dua fungsi. Satu filosofi.

**Pancer = 0.0318** — konstanta identitas EGO. Muncul di dua domain berbeda:
- Di SYKLUS: `r(θ) = e^(0.0318·θ)` — ruang koordinat memori
- Di UR-IP: `1 - C(ρ) = 0.0318` — noise sejati dari resonansi 27005

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
         ● ←── Arm tip (besar)
        /
  ○ ● ○ ●    ←── Arm 0 · spiral data
 ○            ●  (bit=1: bright dot · bit=0: void)
○   ( ✦ )   ○   ←── PANCER · anchor center
 ●            ○
  ● ○ ● ○    ←── Arm 1 · offset 120°
        \
         ●       ←── Arm 2 · offset 240°
```

**Empat elemen:**
- **Pancer** — anchor center · referensi scanner · tidak berputar
- **Tiga Arm** — spiral data channel · interleave 3-channel
- **Orientation Markers** — 3 ukuran berbeda (10/7/5px) → deteksi rotasi
- **Timing Ring** — 24 dots di orbit luar → sync decoder

> *Pusat tidak ikut berputar — ia adalah anchor.*  
> *Yang berputar adalah yang mengorbit.*

---

## Encoding

### Format Bitstream
```
[ HEADER  ]  version(8b) · modeIdx(8b) · payloadLen(16b) · CRC16(16b)  = 6 bytes
[ PAYLOAD ]  UTF-8 text bytes
[ RS      ]  Reed-Solomon parity · 4–16 symbols tergantung mode
[ PADDING ]  sisa kapasitas · pseudo-random deterministik dari hash
```

### Spiral Logaritmik (TRUE logarithmic)
```
r(θ) = a · e^(b·θ)     a=0.15 · b=0.18
```
Rumus yang sama dengan cangkang nautilus, galaksi bima sakti, orbital elektron.  
*b=0.18 bukan bug — nilai yang dipilih secara intentional untuk visual curvature.*

### Mode & Kapasitas (v4.0 — corrected)

| Mode | Nodes/Arm | Max Payload | RS Symbols | Spiral |
|------|-----------|-------------|------------|--------|
| LITE | 60 | **12 byte** | 4 | 2× |
| STANDARD | 150 | **42 byte** | 8 | 3× |
| DENSE | 360 | **117 byte** | 12 | 4× |
| ULTRA | 900 | **315 byte** | 16 | 5× |

> Formula: `maxBytes = floor(nodesPerArm × 3 / 8) - 6 (header) - ecSymbols`

### 3-Arm Interleave
```
Bit 0  → Arm 0, Node 0
Bit 1  → Arm 1, Node 0
Bit 2  → Arm 2, Node 0
Bit 3  → Arm 0, Node 1
...dan seterusnya
```

---

## SYKLUS Coordinate

Setiap teks/ID bisa dipetakan ke titik dalam ruang SYKLUS:

```javascript
const coord = URIP.syklusCoord("PRD-A1B2C3");
// → {
//   theta:   19.24,
//   forward: "505683502339692399",  // 18-digit
//   reverse: "501671500688692399",
//   pancer:  0.0318
// }
```

Formula: `r = e^(Pancer × θ)`, θ ∈ [-50, 50] dipetakan dari hash teks.  
Digunakan di SYKLUS dataset (5000 titik) dan ditampilkan di UI App & Scanner.

---

## Quick Start

```html
<script src="uriplib.js"></script>
<script>
// Auto-pilih mode
const mode    = URIP.autoMode("Urip iku urip");   // → "STANDARD"
const encoded = URIP.encode("Urip iku urip", mode);

// Draw ke canvas (DPR-aware)
const info = URIP.setupCanvas(canvas, 460);
URIP.draw(canvas, encoded, 'gold');

// Decode
const decoded = URIP.decode(encoded.bits, mode);
console.log(decoded.text);    // "Urip iku urip"
console.log(decoded.ok);      // true (CRC + RS verified)

// Download PNG (no race condition)
URIP.downloadCanvas(canvas, 'urip_symbol.png');

// Scan dari canvas (upload/camera)
const result = URIP.scan(uploadedCanvas, 'auto');  // auto-detect mode
console.log(result.text);     // decoded text

// SYKLUS coordinate
const coord = URIP.syklusCoord("my-id");
console.log(coord.forward);   // 18-digit coordinate
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

## API Reference (uriplib.js v4.0)

### `URIP.encode(text, mode)`
```javascript
// Returns:
{
  bits:         number[],  // bitstream [0,1,1,0,...]
  mode:         string,    // mode yang digunakan
  crc:          number,    // CRC16 checksum
  hash:         number,    // hash unik → rotasi simbol berbeda tiap teks
  totalBits:    number,
  payloadBytes: number,
  text:         string
}
```

### `URIP.decode(bits, mode)`
```javascript
{
  ok:       boolean,  // true = CRC valid AND RS no error
  text:     string,
  crcOk:    boolean,
  hasError: boolean,  // Reed-Solomon error flag
  payLen:   number
}
```

### `URIP.scan(canvas, modeName)`
```javascript
// modeName: 'LITE'|'STANDARD'|'DENSE'|'ULTRA'|'auto'
// 'auto' = coba semua mode × 12 angle offset
{
  ok:          boolean,
  text:        string,
  scannedMode: string,
  angleOffset: number,
  crcOk:       boolean
}
```

### `URIP.draw(canvas, encoded, theme, animOffset?)`
**Themes:** `gold` · `cyan` · `lime` · `ember` · `violet` · `white`

### `URIP.setupCanvas(canvas, size?)`
DPR-aware canvas setup. Returns `{ size, dpr }`.

### `URIP.downloadCanvas(canvas, filename?)`
Programmatic download — no race condition.

### `URIP.autoMode(text)`
Otomatis pilih mode terkecil yang cukup berdasarkan byte length.

### `URIP.syklusCoord(text)`
```javascript
{ theta, forward, reverse, pancer }
```

### `URIP.drawEmpty(canvas, theme?)`
Draw placeholder canvas (sebelum encode).

---

## Files

```
UR-IP/
├── README.md
├── uriplib.js                ← Core library · browser + Node.js
├── URIP_App.html             ← Generator + Scanner + Database (v13)
├── URIP_StatAnalyzer.html    ← Stat analyzer · Forward Test · SYKLUS Coord tab
└── URIP_Camera_Test.html     ← Live camera scanner · auto-scan · overlay UI
```

**Semua file harus satu folder** — semua import `uriplib.js` secara lokal.

---

## Changelog

### uriplib.js v4.0
- **Fix spiral** — true logarithmic `r = a·e^(b·θ)` (sebelumnya linear/fake)
- **Fix maxBytes** — formula corrected: `floor(nodes×3/8) - 6 - ecSymbols`
- **3-arm** — upgrade dari 2 ke 3 arm (50% kapasitas lebih)
- **ULTRA mode** — 900 nodes/arm, 315 byte
- **RS check fix** — hanya cek `header+payload+parity`, bukan padding
- **Otsu threshold** — dynamic threshold untuk scan (bukan hardcode)
- **Auto-mode scan** — 12 angle × 4 mode = 48 kombinasi per scan attempt
- **`syklusCoord()`** — 18-digit SYKLUS spatial coordinate
- **`downloadCanvas()`** — no race condition
- **`setupCanvas()`** — DPR-aware

### URIP_App.html v13
- Import `uriplib.js` — hapus semua inline encode/decode/draw
- **Bug fix: download** — `doDownload()` via `URIP.downloadCanvas()`
- **Bug fix: upload resize** — pakai ukuran gambar asli, tidak paksa 320×320
- **Bug fix: file input** — reset `e.target.value` agar file sama bisa diupload ulang
- **Bug fix: scan mode** — `URIP.scan(cv, 'auto')` — no mode mismatch
- **Bug fix: canvas fill** — `URIP.setupCanvas + URIP.draw` di `viewEntry()`
- ULTRA mode di dropdown
- SYKLUS coord display di Create + Scan/Resolve panel

### URIP_StatAnalyzer.html v2
- Import `uriplib.js`
- Tab baru: **SYKLUS COORD** — paste text → 18-digit coordinate + theta distribution

### URIP_Camera_Test.html v4.0
- Full `getUserMedia` · environment-facing camera
- Auto-scan tiap 1.2 detik dengan debounce
- `URIP.scan(canvas, 'auto')` — auto mode detection
- Rotating sweep overlay · corner brackets · ring guide
- Flash hijau saat berhasil decode
- Resolve ke `urip_db` localStorage (shared dengan URIP_App)

---

## Roadmap

- [x] v1.0 — Simbol & generator
- [x] v2.0 — CRC16 + Reed-Solomon
- [x] v3.0 — `uriplib.js` modular library
- [x] v3.1 — 4 modes · 6 themes · animasi orbit
- [x] **v4.0 — 3-arm · ULTRA mode · Otsu scan · SYKLUS coord · Camera scanner**
- [ ] v4.1 — NPM: `urip-code`
- [ ] v4.2 — Server-side decode (Node.js + canvas)
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
