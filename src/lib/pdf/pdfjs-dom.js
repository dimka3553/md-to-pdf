/**
 * pdf.js 5 constructs `new DOMMatrix()` while the module evaluates.
 * Node has no geometry APIs, and the optional `@napi-rs/canvas` polyfill is
 * often missing on serverless, and require() from Next's traced copy of
 * pdfjs-dist cannot resolve it. Install enough of DOMMatrix / Path2D /
 * ImageData for getDocument + getTextContent before importing pdfjs-dist.
 */

function installDomMatrix() {
  if (typeof globalThis.DOMMatrix === 'function') return;

  class DOMMatrix {
    constructor(init) {
      this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0;
      this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0;
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0;
      this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1;
      if (init) this.#assign(init);
    }

    get a() { return this.m11; }
    set a(v) { this.m11 = v; }
    get b() { return this.m12; }
    set b(v) { this.m12 = v; }
    get c() { return this.m21; }
    set c(v) { this.m21 = v; }
    get d() { return this.m22; }
    set d(v) { this.m22 = v; }
    get e() { return this.m41; }
    set e(v) { this.m41 = v; }
    get f() { return this.m42; }
    set f(v) { this.m42 = v; }

    get is2D() {
      return this.m13 === 0 && this.m14 === 0 && this.m23 === 0 && this.m24 === 0
        && this.m31 === 0 && this.m32 === 0 && this.m33 === 1 && this.m34 === 0
        && this.m43 === 0 && this.m44 === 1;
    }

    get isIdentity() {
      return this.m11 === 1 && this.m12 === 0 && this.m21 === 0 && this.m22 === 1
        && this.m41 === 0 && this.m42 === 0 && this.is2D;
    }

    #assign(init) {
      if (typeof init === 'string') return;
      if (init instanceof DOMMatrix || (init && typeof init.m11 === 'number')) {
        this.m11 = init.m11; this.m12 = init.m12; this.m13 = init.m13; this.m14 = init.m14;
        this.m21 = init.m21; this.m22 = init.m22; this.m23 = init.m23; this.m24 = init.m24;
        this.m31 = init.m31; this.m32 = init.m32; this.m33 = init.m33; this.m34 = init.m34;
        this.m41 = init.m41; this.m42 = init.m42; this.m43 = init.m43; this.m44 = init.m44;
        return;
      }
      const n = Array.from(init);
      if (n.length === 6) {
        this.m11 = n[0]; this.m12 = n[1]; this.m21 = n[2]; this.m22 = n[3]; this.m41 = n[4]; this.m42 = n[5];
      } else if (n.length === 16) {
        this.m11 = n[0]; this.m12 = n[1]; this.m13 = n[2]; this.m14 = n[3];
        this.m21 = n[4]; this.m22 = n[5]; this.m23 = n[6]; this.m24 = n[7];
        this.m31 = n[8]; this.m32 = n[9]; this.m33 = n[10]; this.m34 = n[11];
        this.m41 = n[12]; this.m42 = n[13]; this.m43 = n[14]; this.m44 = n[15];
      }
    }

    multiplySelf(other) {
      const o = other instanceof DOMMatrix ? other : new DOMMatrix(other);
      const a = this.m11 * o.m11 + this.m21 * o.m12;
      const b = this.m12 * o.m11 + this.m22 * o.m12;
      const c = this.m11 * o.m21 + this.m21 * o.m22;
      const d = this.m12 * o.m21 + this.m22 * o.m22;
      const e = this.m11 * o.m41 + this.m21 * o.m42 + this.m41;
      const f = this.m12 * o.m41 + this.m22 * o.m42 + this.m42;
      this.m11 = a; this.m12 = b; this.m21 = c; this.m22 = d; this.m41 = e; this.m42 = f;
      return this;
    }

    preMultiplySelf(other) {
      const result = (other instanceof DOMMatrix ? new DOMMatrix(other) : new DOMMatrix(other)).multiplySelf(this);
      this.m11 = result.m11; this.m12 = result.m12; this.m21 = result.m21; this.m22 = result.m22;
      this.m41 = result.m41; this.m42 = result.m42;
      return this;
    }

    invertSelf() {
      const det = this.m11 * this.m22 - this.m12 * this.m21;
      if (!det) {
        this.m11 = this.m12 = this.m21 = this.m22 = this.m41 = this.m42 = NaN;
        return this;
      }
      const a = this.m22 / det;
      const b = -this.m12 / det;
      const c = -this.m21 / det;
      const d = this.m11 / det;
      const e = (this.m21 * this.m42 - this.m22 * this.m41) / det;
      const f = (this.m12 * this.m41 - this.m11 * this.m42) / det;
      this.m11 = a; this.m12 = b; this.m21 = c; this.m22 = d; this.m41 = e; this.m42 = f;
      return this;
    }

    translate(tx = 0, ty = 0) {
      return new DOMMatrix(this).multiplySelf(new DOMMatrix([1, 0, 0, 1, tx, ty]));
    }

    scale(sx = 1, sy = sx) {
      return new DOMMatrix(this).multiplySelf(new DOMMatrix([sx, 0, 0, sy, 0, 0]));
    }
  }

  globalThis.DOMMatrix = DOMMatrix;
}

function installPath2D() {
  if (typeof globalThis.Path2D === 'function') return;
  globalThis.Path2D = class Path2D {
    constructor() {}
    addPath() {}
    closePath() {}
    moveTo() {}
    lineTo() {}
    bezierCurveTo() {}
    quadraticCurveTo() {}
    arc() {}
    arcTo() {}
    ellipse() {}
    rect() {}
    roundRect() {}
  };
}

function installImageData() {
  if (typeof globalThis.ImageData === 'function') return;
  globalThis.ImageData = class ImageData {
    constructor(dataOrWidth, widthOrHeight, height) {
      if (typeof dataOrWidth === 'number') {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height;
      }
      this.colorSpace = 'srgb';
    }
  };
}

export function ensurePdfJsDom() {
  installDomMatrix();
  installPath2D();
  installImageData();
}

ensurePdfJsDom();
