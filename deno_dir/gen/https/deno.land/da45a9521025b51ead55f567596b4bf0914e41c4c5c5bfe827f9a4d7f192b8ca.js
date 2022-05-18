/*! noble-ed25519 - MIT License (c) 2019 Paul Miller (paulmillr.com) */
import nodeCrypto from 'crypto';
const _0n = BigInt(0);
const _1n = BigInt(1);
const _2n = BigInt(2);
const _255n = BigInt(255);
const CURVE_ORDER = _2n ** BigInt(252) + BigInt('27742317777372353535851937790883648493');
const CURVE = {
    a: BigInt(-1),
    d: BigInt('37095705934669439343138083508754565189542113879843219016388785533085940283555'),
    P: _2n ** _255n - BigInt(19),
    l: CURVE_ORDER,
    n: CURVE_ORDER,
    h: BigInt(8),
    Gx: BigInt('15112221349535400772501151409588531511454012693041857206046113283949847762202'),
    Gy: BigInt('46316835694926478169428394003475163141307993866256225615783033603165251855960'),
};
export { CURVE };
const MAX_256B = _2n ** BigInt(256);
const SQRT_M1 = BigInt('19681161376707505956807079304988542015446066515923890162744021073123829784752');
const SQRT_D = BigInt('6853475219497561581579357271197624642482790079785650197046958215289687604742');
const SQRT_AD_MINUS_ONE = BigInt('25063068953384623474111414158702152701244531502492656460079210482610430750235');
const INVSQRT_A_MINUS_D = BigInt('54469307008909316920995813868745141605393597292927456921205312896311721017578');
const ONE_MINUS_D_SQ = BigInt('1159843021668779879193775521855586647937357759715417654439879720876111806838');
const D_MINUS_ONE_SQ = BigInt('40440834346308536858101042469323190826248399146238708352240133220865137265952');
class ExtendedPoint {
    x;
    y;
    z;
    t;
    constructor(x, y, z, t) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.t = t;
    }
    static BASE = new ExtendedPoint(CURVE.Gx, CURVE.Gy, _1n, mod(CURVE.Gx * CURVE.Gy));
    static ZERO = new ExtendedPoint(_0n, _1n, _1n, _0n);
    static fromAffine(p) {
        if (!(p instanceof Point)) {
            throw new TypeError('ExtendedPoint#fromAffine: expected Point');
        }
        if (p.equals(Point.ZERO))
            return ExtendedPoint.ZERO;
        return new ExtendedPoint(p.x, p.y, _1n, mod(p.x * p.y));
    }
    static toAffineBatch(points) {
        const toInv = invertBatch(points.map((p) => p.z));
        return points.map((p, i) => p.toAffine(toInv[i]));
    }
    static normalizeZ(points) {
        return this.toAffineBatch(points).map(this.fromAffine);
    }
    equals(other) {
        assertExtPoint(other);
        const { x: X1, y: Y1, z: Z1 } = this;
        const { x: X2, y: Y2, z: Z2 } = other;
        const X1Z2 = mod(X1 * Z2);
        const X2Z1 = mod(X2 * Z1);
        const Y1Z2 = mod(Y1 * Z2);
        const Y2Z1 = mod(Y2 * Z1);
        return X1Z2 === X2Z1 && Y1Z2 === Y2Z1;
    }
    negate() {
        return new ExtendedPoint(mod(-this.x), this.y, this.z, mod(-this.t));
    }
    double() {
        const { x: X1, y: Y1, z: Z1 } = this;
        const { a } = CURVE;
        const A = mod(X1 ** _2n);
        const B = mod(Y1 ** _2n);
        const C = mod(_2n * mod(Z1 ** _2n));
        const D = mod(a * A);
        const E = mod(mod((X1 + Y1) ** _2n) - A - B);
        const G = D + B;
        const F = G - C;
        const H = D - B;
        const X3 = mod(E * F);
        const Y3 = mod(G * H);
        const T3 = mod(E * H);
        const Z3 = mod(F * G);
        return new ExtendedPoint(X3, Y3, Z3, T3);
    }
    add(other) {
        assertExtPoint(other);
        const { x: X1, y: Y1, z: Z1, t: T1 } = this;
        const { x: X2, y: Y2, z: Z2, t: T2 } = other;
        const A = mod((Y1 - X1) * (Y2 + X2));
        const B = mod((Y1 + X1) * (Y2 - X2));
        const F = mod(B - A);
        if (F === _0n)
            return this.double();
        const C = mod(Z1 * _2n * T2);
        const D = mod(T1 * _2n * Z2);
        const E = D + C;
        const G = B + A;
        const H = D - C;
        const X3 = mod(E * F);
        const Y3 = mod(G * H);
        const T3 = mod(E * H);
        const Z3 = mod(F * G);
        return new ExtendedPoint(X3, Y3, Z3, T3);
    }
    subtract(other) {
        return this.add(other.negate());
    }
    precomputeWindow(W) {
        const windows = 1 + 256 / W;
        const points = [];
        let p = this;
        let base = p;
        for (let window = 0; window < windows; window++) {
            base = p;
            points.push(base);
            for (let i = 1; i < 2 ** (W - 1); i++) {
                base = base.add(p);
                points.push(base);
            }
            p = base.double();
        }
        return points;
    }
    wNAF(n, affinePoint) {
        if (!affinePoint && this.equals(ExtendedPoint.BASE))
            affinePoint = Point.BASE;
        const W = (affinePoint && affinePoint._WINDOW_SIZE) || 1;
        if (256 % W) {
            throw new Error('Point#wNAF: Invalid precomputation window, must be power of 2');
        }
        let precomputes = affinePoint && pointPrecomputes.get(affinePoint);
        if (!precomputes) {
            precomputes = this.precomputeWindow(W);
            if (affinePoint && W !== 1) {
                precomputes = ExtendedPoint.normalizeZ(precomputes);
                pointPrecomputes.set(affinePoint, precomputes);
            }
        }
        let p = ExtendedPoint.ZERO;
        let f = ExtendedPoint.ZERO;
        const windows = 1 + 256 / W;
        const windowSize = 2 ** (W - 1);
        const mask = BigInt(2 ** W - 1);
        const maxNumber = 2 ** W;
        const shiftBy = BigInt(W);
        for (let window = 0; window < windows; window++) {
            const offset = window * windowSize;
            let wbits = Number(n & mask);
            n >>= shiftBy;
            if (wbits > windowSize) {
                wbits -= maxNumber;
                n += _1n;
            }
            if (wbits === 0) {
                let pr = precomputes[offset];
                if (window % 2)
                    pr = pr.negate();
                f = f.add(pr);
            }
            else {
                let cached = precomputes[offset + Math.abs(wbits) - 1];
                if (wbits < 0)
                    cached = cached.negate();
                p = p.add(cached);
            }
        }
        return ExtendedPoint.normalizeZ([p, f])[0];
    }
    multiply(scalar, affinePoint) {
        return this.wNAF(normalizeScalar(scalar, CURVE.l), affinePoint);
    }
    multiplyUnsafe(scalar) {
        let n = normalizeScalar(scalar, CURVE.l, false);
        const G = ExtendedPoint.BASE;
        const P0 = ExtendedPoint.ZERO;
        if (n === _0n)
            return P0;
        if (this.equals(P0) || n === _1n)
            return this;
        if (this.equals(G))
            return this.wNAF(n);
        let p = P0;
        let d = this;
        while (n > _0n) {
            if (n & _1n)
                p = p.add(d);
            d = d.double();
            n >>= _1n;
        }
        return p;
    }
    isSmallOrder() {
        return this.multiplyUnsafe(CURVE.h).equals(ExtendedPoint.ZERO);
    }
    isTorsionFree() {
        return this.multiplyUnsafe(CURVE.l).equals(ExtendedPoint.ZERO);
    }
    toAffine(invZ = invert(this.z)) {
        const { x, y, z } = this;
        const ax = mod(x * invZ);
        const ay = mod(y * invZ);
        const zz = mod(z * invZ);
        if (zz !== _1n)
            throw new Error('invZ was invalid');
        return new Point(ax, ay);
    }
    fromRistrettoBytes() {
        legacyRist();
    }
    toRistrettoBytes() {
        legacyRist();
    }
    fromRistrettoHash() {
        legacyRist();
    }
}
function assertExtPoint(other) {
    if (!(other instanceof ExtendedPoint))
        throw new TypeError('ExtendedPoint expected');
}
function assertRstPoint(other) {
    if (!(other instanceof RistrettoPoint))
        throw new TypeError('RistrettoPoint expected');
}
function legacyRist() {
    throw new Error('Legacy method: switch to RistrettoPoint');
}
class RistrettoPoint {
    ep;
    static BASE = new RistrettoPoint(ExtendedPoint.BASE);
    static ZERO = new RistrettoPoint(ExtendedPoint.ZERO);
    constructor(ep) {
        this.ep = ep;
    }
    static calcElligatorRistrettoMap(r0) {
        const { d } = CURVE;
        const r = mod(SQRT_M1 * r0 * r0);
        const Ns = mod((r + _1n) * ONE_MINUS_D_SQ);
        let c = BigInt(-1);
        const D = mod((c - d * r) * mod(r + d));
        let { isValid: Ns_D_is_sq, value: s } = uvRatio(Ns, D);
        let s_ = mod(s * r0);
        if (!edIsNegative(s_))
            s_ = mod(-s_);
        if (!Ns_D_is_sq)
            s = s_;
        if (!Ns_D_is_sq)
            c = r;
        const Nt = mod(c * (r - _1n) * D_MINUS_ONE_SQ - D);
        const s2 = s * s;
        const W0 = mod((s + s) * D);
        const W1 = mod(Nt * SQRT_AD_MINUS_ONE);
        const W2 = mod(_1n - s2);
        const W3 = mod(_1n + s2);
        return new ExtendedPoint(mod(W0 * W3), mod(W2 * W1), mod(W1 * W3), mod(W0 * W2));
    }
    static hashToCurve(hex) {
        hex = ensureBytes(hex, 64);
        const r1 = bytes255ToNumberLE(hex.slice(0, 32));
        const R1 = this.calcElligatorRistrettoMap(r1);
        const r2 = bytes255ToNumberLE(hex.slice(32, 64));
        const R2 = this.calcElligatorRistrettoMap(r2);
        return new RistrettoPoint(R1.add(R2));
    }
    static fromHex(hex) {
        hex = ensureBytes(hex, 32);
        const { a, d } = CURVE;
        const emsg = 'RistrettoPoint.fromHex: the hex is not valid encoding of RistrettoPoint';
        const s = bytes255ToNumberLE(hex);
        if (!equalBytes(numberTo32BytesLE(s), hex) || edIsNegative(s))
            throw new Error(emsg);
        const s2 = mod(s * s);
        const u1 = mod(_1n + a * s2);
        const u2 = mod(_1n - a * s2);
        const u1_2 = mod(u1 * u1);
        const u2_2 = mod(u2 * u2);
        const v = mod(a * d * u1_2 - u2_2);
        const { isValid, value: I } = invertSqrt(mod(v * u2_2));
        const Dx = mod(I * u2);
        const Dy = mod(I * Dx * v);
        let x = mod((s + s) * Dx);
        if (edIsNegative(x))
            x = mod(-x);
        const y = mod(u1 * Dy);
        const t = mod(x * y);
        if (!isValid || edIsNegative(t) || y === _0n)
            throw new Error(emsg);
        return new RistrettoPoint(new ExtendedPoint(x, y, _1n, t));
    }
    toRawBytes() {
        let { x, y, z, t } = this.ep;
        const u1 = mod(mod(z + y) * mod(z - y));
        const u2 = mod(x * y);
        const { value: invsqrt } = invertSqrt(mod(u1 * u2 ** _2n));
        const D1 = mod(invsqrt * u1);
        const D2 = mod(invsqrt * u2);
        const zInv = mod(D1 * D2 * t);
        let D;
        if (edIsNegative(t * zInv)) {
            let _x = mod(y * SQRT_M1);
            let _y = mod(x * SQRT_M1);
            x = _x;
            y = _y;
            D = mod(D1 * INVSQRT_A_MINUS_D);
        }
        else {
            D = D2;
        }
        if (edIsNegative(x * zInv))
            y = mod(-y);
        let s = mod((z - y) * D);
        if (edIsNegative(s))
            s = mod(-s);
        return numberTo32BytesLE(s);
    }
    toHex() {
        return bytesToHex(this.toRawBytes());
    }
    toString() {
        return this.toHex();
    }
    equals(other) {
        assertRstPoint(other);
        const a = this.ep;
        const b = other.ep;
        const one = mod(a.x * b.y) === mod(a.y * b.x);
        const two = mod(a.y * b.y) === mod(a.x * b.x);
        return one || two;
    }
    add(other) {
        assertRstPoint(other);
        return new RistrettoPoint(this.ep.add(other.ep));
    }
    subtract(other) {
        assertRstPoint(other);
        return new RistrettoPoint(this.ep.subtract(other.ep));
    }
    multiply(scalar) {
        return new RistrettoPoint(this.ep.multiply(scalar));
    }
    multiplyUnsafe(scalar) {
        return new RistrettoPoint(this.ep.multiplyUnsafe(scalar));
    }
}
const pointPrecomputes = new WeakMap();
class Point {
    x;
    y;
    static BASE = new Point(CURVE.Gx, CURVE.Gy);
    static ZERO = new Point(_0n, _1n);
    _WINDOW_SIZE;
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    _setWindowSize(windowSize) {
        this._WINDOW_SIZE = windowSize;
        pointPrecomputes.delete(this);
    }
    static fromHex(hex, strict = true) {
        const { d, P } = CURVE;
        hex = ensureBytes(hex, 32);
        const normed = hex.slice();
        normed[31] = hex[31] & ~0x80;
        const y = bytesToNumberLE(normed);
        if (strict && y >= P)
            throw new Error('Expected 0 < hex < P');
        if (!strict && y >= MAX_256B)
            throw new Error('Expected 0 < hex < 2**256');
        const y2 = mod(y * y);
        const u = mod(y2 - _1n);
        const v = mod(d * y2 + _1n);
        let { isValid, value: x } = uvRatio(u, v);
        if (!isValid)
            throw new Error('Point.fromHex: invalid y coordinate');
        const isXOdd = (x & _1n) === _1n;
        const isLastByteOdd = (hex[31] & 0x80) !== 0;
        if (isLastByteOdd !== isXOdd) {
            x = mod(-x);
        }
        return new Point(x, y);
    }
    static async fromPrivateKey(privateKey) {
        return (await getExtendedPublicKey(privateKey)).point;
    }
    toRawBytes() {
        const bytes = numberTo32BytesLE(this.y);
        bytes[31] |= this.x & _1n ? 0x80 : 0;
        return bytes;
    }
    toHex() {
        return bytesToHex(this.toRawBytes());
    }
    toX25519() {
        const { y } = this;
        const u = mod((_1n + y) * invert(_1n - y));
        return numberTo32BytesLE(u);
    }
    isTorsionFree() {
        return ExtendedPoint.fromAffine(this).isTorsionFree();
    }
    equals(other) {
        return this.x === other.x && this.y === other.y;
    }
    negate() {
        return new Point(mod(-this.x), this.y);
    }
    add(other) {
        return ExtendedPoint.fromAffine(this).add(ExtendedPoint.fromAffine(other)).toAffine();
    }
    subtract(other) {
        return this.add(other.negate());
    }
    multiply(scalar) {
        return ExtendedPoint.fromAffine(this).multiply(scalar, this).toAffine();
    }
}
class Signature {
    r;
    s;
    constructor(r, s) {
        this.r = r;
        this.s = s;
        this.assertValidity();
    }
    static fromHex(hex) {
        const bytes = ensureBytes(hex, 64);
        const r = Point.fromHex(bytes.slice(0, 32), false);
        const s = bytesToNumberLE(bytes.slice(32, 64));
        return new Signature(r, s);
    }
    assertValidity() {
        const { r, s } = this;
        if (!(r instanceof Point))
            throw new Error('Expected Point instance');
        normalizeScalar(s, CURVE.l, false);
        return this;
    }
    toRawBytes() {
        const u8 = new Uint8Array(64);
        u8.set(this.r.toRawBytes());
        u8.set(numberTo32BytesLE(this.s), 32);
        return u8;
    }
    toHex() {
        return bytesToHex(this.toRawBytes());
    }
}
export { ExtendedPoint, RistrettoPoint, Point, Signature };
function concatBytes(...arrays) {
    if (!arrays.every((a) => a instanceof Uint8Array))
        throw new Error('Expected Uint8Array list');
    if (arrays.length === 1)
        return arrays[0];
    const length = arrays.reduce((a, arr) => a + arr.length, 0);
    const result = new Uint8Array(length);
    for (let i = 0, pad = 0; i < arrays.length; i++) {
        const arr = arrays[i];
        result.set(arr, pad);
        pad += arr.length;
    }
    return result;
}
const hexes = Array.from({ length: 256 }, (v, i) => i.toString(16).padStart(2, '0'));
function bytesToHex(uint8a) {
    if (!(uint8a instanceof Uint8Array))
        throw new Error('Uint8Array expected');
    let hex = '';
    for (let i = 0; i < uint8a.length; i++) {
        hex += hexes[uint8a[i]];
    }
    return hex;
}
function hexToBytes(hex) {
    if (typeof hex !== 'string') {
        throw new TypeError('hexToBytes: expected string, got ' + typeof hex);
    }
    if (hex.length % 2)
        throw new Error('hexToBytes: received invalid unpadded hex');
    const array = new Uint8Array(hex.length / 2);
    for (let i = 0; i < array.length; i++) {
        const j = i * 2;
        const hexByte = hex.slice(j, j + 2);
        const byte = Number.parseInt(hexByte, 16);
        if (Number.isNaN(byte) || byte < 0)
            throw new Error('Invalid byte sequence');
        array[i] = byte;
    }
    return array;
}
function numberTo32BytesBE(num) {
    const length = 32;
    const hex = num.toString(16).padStart(length * 2, '0');
    return hexToBytes(hex);
}
function numberTo32BytesLE(num) {
    return numberTo32BytesBE(num).reverse();
}
function edIsNegative(num) {
    return (mod(num) & _1n) === _1n;
}
function bytesToNumberLE(uint8a) {
    if (!(uint8a instanceof Uint8Array))
        throw new Error('Expected Uint8Array');
    return BigInt('0x' + bytesToHex(Uint8Array.from(uint8a).reverse()));
}
function bytes255ToNumberLE(bytes) {
    return mod(bytesToNumberLE(bytes) & (_2n ** _255n - _1n));
}
function mod(a, b = CURVE.P) {
    const res = a % b;
    return res >= _0n ? res : b + res;
}
function invert(number, modulo = CURVE.P) {
    if (number === _0n || modulo <= _0n) {
        throw new Error(`invert: expected positive integers, got n=${number} mod=${modulo}`);
    }
    let a = mod(number, modulo);
    let b = modulo;
    let x = _0n, y = _1n, u = _1n, v = _0n;
    while (a !== _0n) {
        const q = b / a;
        const r = b % a;
        const m = x - u * q;
        const n = y - v * q;
        b = a, a = r, x = u, y = v, u = m, v = n;
    }
    const gcd = b;
    if (gcd !== _1n)
        throw new Error('invert: does not exist');
    return mod(x, modulo);
}
function invertBatch(nums, p = CURVE.P) {
    const tmp = new Array(nums.length);
    const lastMultiplied = nums.reduce((acc, num, i) => {
        if (num === _0n)
            return acc;
        tmp[i] = acc;
        return mod(acc * num, p);
    }, _1n);
    const inverted = invert(lastMultiplied, p);
    nums.reduceRight((acc, num, i) => {
        if (num === _0n)
            return acc;
        tmp[i] = mod(acc * tmp[i], p);
        return mod(acc * num, p);
    }, inverted);
    return tmp;
}
function pow2(x, power) {
    const { P } = CURVE;
    let res = x;
    while (power-- > _0n) {
        res *= res;
        res %= P;
    }
    return res;
}
function pow_2_252_3(x) {
    const { P } = CURVE;
    const _5n = BigInt(5);
    const _10n = BigInt(10);
    const _20n = BigInt(20);
    const _40n = BigInt(40);
    const _80n = BigInt(80);
    const x2 = (x * x) % P;
    const b2 = (x2 * x) % P;
    const b4 = (pow2(b2, _2n) * b2) % P;
    const b5 = (pow2(b4, _1n) * x) % P;
    const b10 = (pow2(b5, _5n) * b5) % P;
    const b20 = (pow2(b10, _10n) * b10) % P;
    const b40 = (pow2(b20, _20n) * b20) % P;
    const b80 = (pow2(b40, _40n) * b40) % P;
    const b160 = (pow2(b80, _80n) * b80) % P;
    const b240 = (pow2(b160, _80n) * b80) % P;
    const b250 = (pow2(b240, _10n) * b10) % P;
    const pow_p_5_8 = (pow2(b250, _2n) * x) % P;
    return { pow_p_5_8, b2 };
}
function uvRatio(u, v) {
    const v3 = mod(v * v * v);
    const v7 = mod(v3 * v3 * v);
    const pow = pow_2_252_3(u * v7).pow_p_5_8;
    let x = mod(u * v3 * pow);
    const vx2 = mod(v * x * x);
    const root1 = x;
    const root2 = mod(x * SQRT_M1);
    const useRoot1 = vx2 === u;
    const useRoot2 = vx2 === mod(-u);
    const noRoot = vx2 === mod(-u * SQRT_M1);
    if (useRoot1)
        x = root1;
    if (useRoot2 || noRoot)
        x = root2;
    if (edIsNegative(x))
        x = mod(-x);
    return { isValid: useRoot1 || useRoot2, value: x };
}
function invertSqrt(number) {
    return uvRatio(_1n, number);
}
async function sha512ModqLE(...args) {
    const hash = await utils.sha512(concatBytes(...args));
    const value = bytesToNumberLE(hash);
    return mod(value, CURVE.l);
}
function equalBytes(b1, b2) {
    if (b1.length !== b2.length) {
        return false;
    }
    for (let i = 0; i < b1.length; i++) {
        if (b1[i] !== b2[i]) {
            return false;
        }
    }
    return true;
}
function ensureBytes(hex, expectedLength) {
    const bytes = hex instanceof Uint8Array ? Uint8Array.from(hex) : hexToBytes(hex);
    if (typeof expectedLength === 'number' && bytes.length !== expectedLength)
        throw new Error(`Expected ${expectedLength} bytes`);
    return bytes;
}
function normalizeScalar(num, max, strict = true) {
    if (!max)
        throw new TypeError('Specify max value');
    if (typeof num === 'number' && Number.isSafeInteger(num))
        num = BigInt(num);
    if (typeof num === 'bigint' && num < max) {
        if (strict) {
            if (_0n < num)
                return num;
        }
        else {
            if (_0n <= num)
                return num;
        }
    }
    throw new TypeError('Expected valid scalar: 0 < scalar < max');
}
function adjustBytes25519(bytes) {
    bytes[0] &= 248;
    bytes[31] &= 127;
    bytes[31] |= 64;
    return bytes;
}
function decodeScalar25519(n) {
    return bytesToNumberLE(adjustBytes25519(ensureBytes(n, 32)));
}
async function getExtendedPublicKey(key) {
    key =
        typeof key === 'bigint' || typeof key === 'number'
            ? numberTo32BytesBE(normalizeScalar(key, MAX_256B))
            : ensureBytes(key);
    if (key.length !== 32)
        throw new Error(`Expected 32 bytes`);
    const hashed = await utils.sha512(key);
    const head = adjustBytes25519(hashed.slice(0, 32));
    const prefix = hashed.slice(32, 64);
    const scalar = mod(bytesToNumberLE(head), CURVE.l);
    const point = Point.BASE.multiply(scalar);
    const pointBytes = point.toRawBytes();
    return { head, prefix, scalar, point, pointBytes };
}
export async function getPublicKey(privateKey) {
    return (await getExtendedPublicKey(privateKey)).pointBytes;
}
export async function sign(message, privateKey) {
    message = ensureBytes(message);
    const { prefix, scalar, pointBytes } = await getExtendedPublicKey(privateKey);
    const r = await sha512ModqLE(prefix, message);
    const R = Point.BASE.multiply(r);
    const k = await sha512ModqLE(R.toRawBytes(), pointBytes, message);
    const s = mod(r + k * scalar, CURVE.l);
    return new Signature(R, s).toRawBytes();
}
export async function verify(sig, message, publicKey) {
    message = ensureBytes(message);
    if (!(publicKey instanceof Point))
        publicKey = Point.fromHex(publicKey, false);
    const { r, s } = sig instanceof Signature ? sig.assertValidity() : Signature.fromHex(sig);
    const SB = ExtendedPoint.BASE.multiplyUnsafe(s);
    const k = await sha512ModqLE(r.toRawBytes(), publicKey.toRawBytes(), message);
    const kA = ExtendedPoint.fromAffine(publicKey).multiplyUnsafe(k);
    const RkA = ExtendedPoint.fromAffine(r).add(kA);
    return RkA.subtract(SB).multiplyUnsafe(CURVE.h).equals(ExtendedPoint.ZERO);
}
export async function getSharedSecret(privateKey, publicKey) {
    const { head } = await getExtendedPublicKey(privateKey);
    const u = Point.fromHex(publicKey).toX25519();
    return curve25519.scalarMult(head, u);
}
Point.BASE._setWindowSize(8);
function cswap(swap, x_2, x_3) {
    const dummy = mod(swap * (x_2 - x_3));
    x_2 = mod(x_2 - dummy);
    x_3 = mod(x_3 + dummy);
    return [x_2, x_3];
}
function montgomeryLadder(pointU, scalar) {
    const { P } = CURVE;
    const u = normalizeScalar(pointU, P);
    const k = normalizeScalar(scalar, P);
    const a24 = BigInt(121665);
    const x_1 = u;
    let x_2 = _1n;
    let z_2 = _0n;
    let x_3 = u;
    let z_3 = _1n;
    let swap = _0n;
    let sw;
    for (let t = BigInt(255 - 1); t >= _0n; t--) {
        const k_t = (k >> t) & _1n;
        swap ^= k_t;
        sw = cswap(swap, x_2, x_3);
        x_2 = sw[0];
        x_3 = sw[1];
        sw = cswap(swap, z_2, z_3);
        z_2 = sw[0];
        z_3 = sw[1];
        swap = k_t;
        const A = x_2 + z_2;
        const AA = mod(A * A);
        const B = x_2 - z_2;
        const BB = mod(B * B);
        const E = AA - BB;
        const C = x_3 + z_3;
        const D = x_3 - z_3;
        const DA = mod(D * A);
        const CB = mod(C * B);
        x_3 = mod((DA + CB) ** _2n);
        z_3 = mod(x_1 * (DA - CB) ** _2n);
        x_2 = mod(AA * BB);
        z_2 = mod(E * (AA + mod(a24 * E)));
    }
    sw = cswap(swap, x_2, x_3);
    x_2 = sw[0];
    x_3 = sw[1];
    sw = cswap(swap, z_2, z_3);
    z_2 = sw[0];
    z_3 = sw[1];
    const { pow_p_5_8, b2 } = pow_2_252_3(z_2);
    const xp2 = mod(pow2(pow_p_5_8, BigInt(3)) * b2);
    return mod(x_2 * xp2);
}
function encodeUCoordinate(u) {
    return numberTo32BytesLE(mod(u, CURVE.P));
}
function decodeUCoordinate(uEnc) {
    const u = ensureBytes(uEnc, 32);
    u[31] &= 127;
    return bytesToNumberLE(u);
}
export const curve25519 = {
    BASE_POINT_U: '0900000000000000000000000000000000000000000000000000000000000000',
    scalarMult(privateKey, publicKey) {
        const u = decodeUCoordinate(publicKey);
        const p = decodeScalar25519(privateKey);
        const pu = montgomeryLadder(u, p);
        if (pu === _0n)
            throw new Error('Invalid private or public key received');
        return encodeUCoordinate(pu);
    },
    scalarMultBase(privateKey) {
        return curve25519.scalarMult(privateKey, curve25519.BASE_POINT_U);
    },
};
const crypto = {
    node: nodeCrypto,
    web: typeof self === 'object' && 'crypto' in self ? self.crypto : undefined,
};
export const utils = {
    TORSION_SUBGROUP: [
        '0100000000000000000000000000000000000000000000000000000000000000',
        'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a',
        '0000000000000000000000000000000000000000000000000000000000000080',
        '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05',
        'ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f',
        '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85',
        '0000000000000000000000000000000000000000000000000000000000000000',
        'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa',
    ],
    bytesToHex,
    getExtendedPublicKey,
    mod,
    invert,
    hashToPrivateScalar: (hash) => {
        hash = ensureBytes(hash);
        if (hash.length < 40 || hash.length > 1024)
            throw new Error('Expected 40-1024 bytes of private key as per FIPS 186');
        const num = mod(bytesToNumberLE(hash), CURVE.l);
        if (num === _0n || num === _1n)
            throw new Error('Invalid private key');
        return num;
    },
    randomBytes: (bytesLength = 32) => {
        if (crypto.web) {
            return crypto.web.getRandomValues(new Uint8Array(bytesLength));
        }
        else if (crypto.node) {
            const { randomBytes } = crypto.node;
            return new Uint8Array(randomBytes(bytesLength).buffer);
        }
        else {
            throw new Error("The environment doesn't have randomBytes function");
        }
    },
    randomPrivateKey: () => {
        return utils.randomBytes(32);
    },
    sha512: async (message) => {
        if (crypto.web) {
            const buffer = await crypto.web.subtle.digest('SHA-512', message.buffer);
            return new Uint8Array(buffer);
        }
        else if (crypto.node) {
            return Uint8Array.from(crypto.node.createHash('sha512').update(message).digest());
        }
        else {
            throw new Error("The environment doesn't have sha512 function");
        }
    },
    precompute(windowSize = 8, point = Point.BASE) {
        const cached = point.equals(Point.BASE) ? point : new Point(point.x, point.y);
        cached._setWindowSize(windowSize);
        cached.multiply(_2n);
        return cached;
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx1RUFBdUU7QUFRdkUsT0FBTyxVQUFVLE1BQU0sUUFBUSxDQUFDO0FBR2hDLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0QixNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEIsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RCLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMxQixNQUFNLFdBQVcsR0FBRyxHQUFHLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDO0FBUTFGLE1BQU0sS0FBSyxHQUFHO0lBRVosQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUdiLENBQUMsRUFBRSxNQUFNLENBQUMsK0VBQStFLENBQUM7SUFFMUYsQ0FBQyxFQUFFLEdBQUcsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQztJQUU1QixDQUFDLEVBQUUsV0FBVztJQUNkLENBQUMsRUFBRSxXQUFXO0lBRWQsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFFWixFQUFFLEVBQUUsTUFBTSxDQUFDLCtFQUErRSxDQUFDO0lBQzNGLEVBQUUsRUFBRSxNQUFNLENBQUMsK0VBQStFLENBQUM7Q0FDNUYsQ0FBQztBQUdGLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztBQU9qQixNQUFNLFFBQVEsR0FBRyxHQUFHLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBR3BDLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FDcEIsK0VBQStFLENBQ2hGLENBQUM7QUFFRixNQUFNLE1BQU0sR0FBRyxNQUFNLENBQ25CLDhFQUE4RSxDQUMvRSxDQUFDO0FBRUYsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQzlCLCtFQUErRSxDQUNoRixDQUFDO0FBRUYsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQzlCLCtFQUErRSxDQUNoRixDQUFDO0FBRUYsTUFBTSxjQUFjLEdBQUcsTUFBTSxDQUMzQiw4RUFBOEUsQ0FDL0UsQ0FBQztBQUVGLE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FDM0IsK0VBQStFLENBQ2hGLENBQUM7QUFPRixNQUFNLGFBQWE7SUFDSTtJQUFvQjtJQUFvQjtJQUFvQjtJQUFqRixZQUFxQixDQUFTLEVBQVcsQ0FBUyxFQUFXLENBQVMsRUFBVyxDQUFTO1FBQXJFLE1BQUMsR0FBRCxDQUFDLENBQVE7UUFBVyxNQUFDLEdBQUQsQ0FBQyxDQUFRO1FBQVcsTUFBQyxHQUFELENBQUMsQ0FBUTtRQUFXLE1BQUMsR0FBRCxDQUFDLENBQVE7SUFBRyxDQUFDO0lBRTlGLE1BQU0sQ0FBQyxJQUFJLEdBQUcsSUFBSSxhQUFhLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNuRixNQUFNLENBQUMsSUFBSSxHQUFHLElBQUksYUFBYSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3BELE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBUTtRQUN4QixJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksS0FBSyxDQUFDLEVBQUU7WUFDekIsTUFBTSxJQUFJLFNBQVMsQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO1NBQ2pFO1FBQ0QsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFBRSxPQUFPLGFBQWEsQ0FBQyxJQUFJLENBQUM7UUFDcEQsT0FBTyxJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFJRCxNQUFNLENBQUMsYUFBYSxDQUFDLE1BQXVCO1FBQzFDLE1BQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsRCxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBdUI7UUFDdkMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUdELE1BQU0sQ0FBQyxLQUFvQjtRQUN6QixjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdEIsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ3JDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUN0QyxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDMUIsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUMxQixNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLE9BQU8sSUFBSSxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssSUFBSSxDQUFDO0lBQ3hDLENBQUM7SUFHRCxNQUFNO1FBQ0osT0FBTyxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFLRCxNQUFNO1FBQ0osTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ3JDLE1BQU0sRUFBRSxDQUFDLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFDcEIsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUN6QixNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDO1FBQ3pCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3BDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDckIsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDN0MsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNoQixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2hCLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDaEIsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN0QixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdEIsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN0QixPQUFPLElBQUksYUFBYSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFNRCxHQUFHLENBQUMsS0FBb0I7UUFDdEIsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQzVDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBQzdDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDckIsSUFBSSxDQUFDLEtBQUssR0FBRztZQUFFLE9BQU8sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3BDLE1BQU0sQ0FB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QUFDLE1BQU0sS0FBSyxDQUFDO1FBQUUsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDMUMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzVELE1BQU0sTUFBTSxHQUFHLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3RDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDL0MsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDO0tBQ25CO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQUlELE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNyRixTQUFTLFVBQVUsQ0FBQyxNQUFrQjtJQUVwQyxJQUFJLENBQUMsQ0FBQyxNQUFNLFlBQVksVUFBVSxDQUFDO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQzVFLElBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQztJQUNiLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1FB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QyxFQUFFLEdBQUcsS0FBSyxDQUFDO0lBQ3BCLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0QixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDeEIsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3hCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN4QixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDeEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZCLE1BQU0sRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN4QixNQUFNLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3BDLE1BQU0sRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDbkMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNyQyxNQUFNLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3hDLE1BQU0sR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDeEMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN4QyxNQUFNLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3pDLE1BQU0sSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxQyxNQUFNLFNBQVMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRTVDLE9BQU8sRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLENBQUM7QUFDM0IsQ0FBQztBQUtELFNBQVMsT0FBTyxDQUFDLENBQVMsRUFBRSxDQUFTO0lBQ25DLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzFCLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzVCLE1BQU0sR0FBRyxHQUFHLFdBQVcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQzFDLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQzFCLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzNCLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQztJQUNoQixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDO0lBQy9CLE1BQU0sUUFBUSxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUM7SUFDM0IsTUFBTSxRQUFRLEdBQUcs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TSxHQUFHLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDO1FBQzNCLElBQUksSUFBSSxHQUFHLENBQUM7UUFDWixFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDM0IsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNaLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDWixFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDM0IsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNaLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDWixJQUFJLEdBQUcsR0FBRyxDQUFDO1FBRVgsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNwQixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7UUFDcEIsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN0QixNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQ2xCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7UUFDcEIsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNwQixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdEIsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUM1QixHQUFHLEdBQUcs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QUU7UUFDekQsSUFBSSxNQUFNLENBQUMsR0FBRyxFQUFFO1lBQ2QsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN6RSxPQUFPLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQy9CO2FBQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFO1lBQ3RCLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztTQUNuRjthQUFNO1lBQ0wsTUFBTSxJQUFJLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO1NBQ2pFO0lBQ0gsQ0FBQztJQU9ELFVBQVUsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSTtRQUMzQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5RSxNQUFNLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDckIsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiEgbm9ibGUtZWQyNTUxOSAtIE1JVCBMaWNlbnNlIChjKSAyMDE5IFBhdWwgTWlsbGVyIChwYXVsbWlsbHIuY29tKSAqL1xuLy8gVGhhbmtzIERKQiBodHRwczovL2VkMjU1MTkuY3IueXAudG9cbi8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM3NzQ4IGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM4MDMyXG4vLyBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9FZERTQSBodHRwczovL3Jpc3RyZXR0by5ncm91cFxuLy8gaHR0cHM6Ly9kYXRhdHJhY2tlci5pZXRmLm9yZy9kb2MvaHRtbC9kcmFmdC1pcnRmLWNmcmctcmlzdHJldHRvMjU1LWRlY2FmNDQ4XG5cbi8vIFVzZXMgYnVpbHQtaW4gY3J5cHRvIG1vZHVsZSBmcm9tIG5vZGUuanMgdG8gZ2VuZXJhdGUgcmFuZG9tbmVzcyAvIGhtYWMtc2hhMjU2LlxuLy8gSW4gYnJvd3NlciB0aGUgbGluZSBpcyBhdXRvbWF0aWNhbGx5IHJlbW92ZWQgZHVyaW5nIGJ1aWxkIHRpbWU6IHVzZXMgY3J5cHRvLnN1YnRsZSBpbnN0ZWFkLlxuaW1wb3J0IG5vZGVDcnlwdG8gZnJvbSAnY3J5cHRvJztcblxuLy8gQmUgZnJpZW5kbHkgdG8gYmFkIEVDTUFTY3JpcHQgcGFyc2VycyBieSBub3QgdXNpbmcgYmlnaW50IGxpdGVyYWxzIGxpa2UgMTIzblxuY29uc3QgXzBuID0gQmlnSW50KDApO1xuY29uc3QgXzFuID0gQmlnSW50KDEpO1xuY29uc3QgXzJuID0gQmlnSW50KDIpO1xuY29uc3QgXzI1NW4gPSBCaWdJbnQoMjU1KTtcbmNvbnN0IENVUlZFX09SREVSID0gXzJuICoqIEJpZ0ludCgyNTIpICsgQmlnSW50KCcyNzc0MjMxNzc3NzM3MjM1MzUzNTg1MTkzNzc5MDg4MzY0ODQ5MycpO1xuXG4vKipcbiAqIGVkMjU1MTkgaXMgVHdpc3RlZCBFZHdhcmRzIGN1cnZlIHdpdGggZXF1YXRpb24gb2ZcbiAqIGBgYFxuICog4oiSeMKyICsgecKyID0gMSDiiJIgKDEyMTY2NS8xMjE2NjYpICogeMKyICogecKyXG4gKiBgYGBcbiAqL1xuY29uc3QgQ1VSVkUgPSB7XG4gIC8vIFBhcmFtOiBhXG4gIGE6IEJpZ0ludCgtMSksXG4gIC8vIEVxdWFsIHRvIC0xMjE2NjUvMTIxNjY2IG92ZXIgZmluaXRlIGZpZWxkLlxuICAvLyBOZWdhdGl2ZSBudW1iZXIgaXMgUCAtIG51bWJlciwgYW5kIGRpdmlzaW9uIGlzIGludmVydChudW1iZXIsIFApXG4gIGQ6IEJpZ0ludCgnMzcwOTU3MDU5MzQ2Njk0MzkzNDMxMzgwODM1MDg3NTQ1NjUxODk1NDIxMTM4Nzk4NDMyMTkwMTYzODg3ODU1MzMwODU5NDAyODM1NTUnKSxcbiAgLy8gRmluaXRlIGZpZWxkIPCdlL1wIG92ZXIgd2hpY2ggd2UnbGwgZG8gY2FsY3VsYXRpb25zXG4gIFA6IF8ybiAqKiBfMjU1biAtIEJpZ0ludCgxOSksXG4gIC8vIFN1Ymdyb3VwIG9yZGVyOiBob3cgbWFueSBwb2ludHMgZWQyNTUxOSBoYXNcbiAgbDogQ1VSVkVfT1JERVIsIC8vIGluIHJmYzgwMzIgaXQncyBjYWxsZWQgbFxuICBuOiBDVVJWRV9PUkRFUiwgLy8gYmFja3dhcmRzIGNvbXBhdGliaWxpdHlcbiAgLy8gQ29mYWN0b3JcbiAgaDogQmlnSW50KDgpLFxuICAvLyBCYXNlIHBvaW50ICh4LCB5KSBha2EgZ2VuZXJhdG9yIHBvaW50XG4gIEd4OiBCaWdJbnQoJzE1MTEyMjIxMzQ5NTM1NDAwNzcyNTAxMTUxNDA5NTg4NTMxNTExNDU0MDEyNjkzMDQxODU3MjA2MDQ2MTEzMjgzOTQ5ODQ3NzYyMjAyJyksXG4gIEd5OiBCaWdJbnQoJzQ2MzE2ODM1Njk0OTI2NDc4MTY5NDI4Mzk0MDAzNDc1MTYzMTQxMzA3OTkzODY2MjU2MjI1NjE1NzgzMDMzNjAzMTY1MjUxODU1OTYwJyksXG59O1xuXG4vLyBDbGVhbmVyIG91dHB1dCB0aGlzIHdheS5cbmV4cG9ydCB7IENVUlZFIH07XG5cbnR5cGUgSGV4ID0gVWludDhBcnJheSB8IHN0cmluZztcbnR5cGUgUHJpdktleSA9IEhleCB8IGJpZ2ludCB8IG51bWJlcjtcbnR5cGUgUHViS2V5ID0gSGV4IHwgUG9pbnQ7XG50eXBlIFNpZ1R5cGUgPSBIZXggfCBTaWduYXR1cmU7XG5cbmNvbnN0IE1BWF8yNTZCID0gXzJuICoqIEJpZ0ludCgyNTYpO1xuXG4vLyDiiJooLTEpIGFrYSDiiJooYSkgYWthIDJeKChwLTEpLzQpXG5jb25zdCBTUVJUX00xID0gQmlnSW50KFxuICAnMTk2ODExNjEzNzY3MDc1MDU5NTY4MDcwNzkzMDQ5ODg1NDIwMTU0NDYwNjY1MTU5MjM4OTAxNjI3NDQwMjEwNzMxMjM4Mjk3ODQ3NTInXG4pO1xuLy8g4oiaZCBha2Egc3FydCgtNDg2NjY0KVxuY29uc3QgU1FSVF9EID0gQmlnSW50KFxuICAnNjg1MzQ3NTIxOTQ5NzU2MTU4MTU3OTM1NzI3MTE5NzYyNDY0MjQ4Mjc5MDA3OTc4NTY1MDE5NzA0Njk1ODIxNTI4OTY4NzYwNDc0Midcbik7XG4vLyDiiJooYWQgLSAxKVxuY29uc3QgU1FSVF9BRF9NSU5VU19PTkUgPSBCaWdJbnQoXG4gICcyNTA2MzA2ODk1MzM4NDYyMzQ3NDExMTQxNDE1ODcwMjE1MjcwMTI0NDUzMTUwMjQ5MjY1NjQ2MDA3OTIxMDQ4MjYxMDQzMDc1MDIzNSdcbik7XG4vLyAxIC8g4oiaKGEtZClcbmNvbnN0IElOVlNRUlRfQV9NSU5VU19EID0gQmlnSW50KFxuICAnNTQ0NjkzMDcwMDg5MDkzMTY5MjA5OTU4MTM4Njg3NDUxNDE2MDUzOTM1OTcyOTI5Mjc0NTY5MjEyMDUzMTI4OTYzMTE3MjEwMTc1NzgnXG4pO1xuLy8gMS1kwrJcbmNvbnN0IE9ORV9NSU5VU19EX1NRID0gQmlnSW50KFxuICAnMTE1OTg0MzAyMTY2ODc3OTg3OTE5Mzc3NTUyMTg1NTU4NjY0NzkzNzM1Nzc1OTcxNTQxNzY1NDQzOTg3OTcyMDg3NjExMTgwNjgzOCdcbik7XG4vLyAoZC0xKcKyXG5jb25zdCBEX01JTlVTX09ORV9TUSA9IEJpZ0ludChcbiAgJzQwNDQwODM0MzQ2MzA4NTM2ODU4MTAxMDQyNDY5MzIzMTkwODI2MjQ4Mzk5MTQ2MjM4NzA4MzUyMjQwMTMzMjIwODY1MTM3MjY1OTUyJ1xuKTtcblxuLyoqXG4gKiBFeHRlbmRlZCBQb2ludCB3b3JrcyBpbiBleHRlbmRlZCBjb29yZGluYXRlczogKHgsIHksIHosIHQpIOKIiyAoeD14L3osIHk9eS96LCB0PXh5KS5cbiAqIERlZmF1bHQgUG9pbnQgd29ya3MgaW4gYWZmaW5lIGNvb3JkaW5hdGVzOiAoeCwgeSlcbiAqIGh0dHBzOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL1R3aXN0ZWRfRWR3YXJkc19jdXJ2ZSNFeHRlbmRlZF9jb29yZGluYXRlc1xuICovXG5jbGFzcyBFeHRlbmRlZFBvaW50IHtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgeDogYmlnaW50LCByZWFkb25seSB5OiBiaWdpbnQsIHJlYWRvbmx5IHo6IGJpZ2ludCwgcmVhZG9ubHkgdDogYmlnaW50KSB7fVxuXG4gIHN0YXRpYyBCQVNFID0gbmV3IEV4dGVuZGVkUG9pbnQoQ1VSVkUuR3gsIENVUlZFLkd5LCBfMW4sIG1vZChDVVJWRS5HeCAqIENVUlZFLkd5KSk7XG4gIHN0YXRpYyBaRVJPID0gbmV3IEV4dGVuZGVkUG9pbnQoXzBuLCBfMW4sIF8xbiwgXzBuKTtcbiAgc3RhdGljIGZyb21BZmZpbmUocDogUG9pbnQpOiBFeHRlbmRlZFBvaW50IHtcbiAgICBpZiAoIShwIGluc3RhbmNlb2YgUG9pbnQpKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHRlbmRlZFBvaW50I2Zyb21BZmZpbmU6IGV4cGVjdGVkIFBvaW50Jyk7XG4gICAgfVxuICAgIGlmIChwLmVxdWFscyhQb2ludC5aRVJPKSkgcmV0dXJuIEV4dGVuZGVkUG9pbnQuWkVSTztcbiAgICByZXR1cm4gbmV3IEV4dGVuZGVkUG9pbnQocC54LCBwLnksIF8xbiwgbW9kKHAueCAqIHAueSkpO1xuICB9XG4gIC8vIFRha2VzIGEgYnVuY2ggb2YgSmFjb2JpYW4gUG9pbnRzIGJ1dCBleGVjdXRlcyBvbmx5IG9uZVxuICAvLyBpbnZlcnQgb24gYWxsIG9mIHRoZW0uIGludmVydCBpcyB2ZXJ5IHNsb3cgb3BlcmF0aW9uLFxuICAvLyBzbyB0aGlzIGltcHJvdmVzIHBlcmZvcm1hbmNlIG1hc3NpdmVseS5cbiAgc3RhdGljIHRvQWZmaW5lQmF0Y2gocG9pbnRzOiBFeHRlbmRlZFBvaW50W10pOiBQb2ludFtdIHtcbiAgICBjb25zdCB0b0ludiA9IGludmVydEJhdGNoKHBvaW50cy5tYXAoKHApID0+IHAueikpO1xuICAgIHJldHVybiBwb2ludHMubWFwKChwLCBpKSA9PiBwLnRvQWZmaW5lKHRvSW52W2ldKSk7XG4gIH1cblxuICBzdGF0aWMgbm9ybWFsaXplWihwb2ludHM6IEV4dGVuZGVkUG9pbnRbXSk6IEV4dGVuZGVkUG9pbnRbXSB7XG4gICAgcmV0dXJuIHRoaXMudG9BZmZpbmVCYXRjaChwb2ludHMpLm1hcCh0aGlzLmZyb21BZmZpbmUpO1xuICB9XG5cbiAgLy8gQ29tcGFyZSBvbmUgcG9pbnQgdG8gYW5vdGhlci5cbiAgZXF1YWxzKG90aGVyOiBFeHRlbmRlZFBvaW50KTogYm9vbGVhbiB7XG4gICAgYXNzZXJ0RXh0UG9pbnQob3RoZXIpO1xuICAgIGNvbnN0IHsgeDogWDEsIHk6IFkxLCB6OiBaMSB9ID0gdGhpcztcbiAgICBjb25zdCB7IHg6IFgyLCB5OiBZMiwgejogWjIgfSA9IG90aGVyO1xuICAgIGNvbnN0IFgxWjIgPSBtb2QoWDEgKiBaMik7XG4gICAgY29uc3QgWDJaMSA9IG1vZChYMiAqIFoxKTtcbiAgICBjb25zdCBZMVoyID0gbW9kKFkxICogWjIpO1xuICAgIGNvbnN0IFkyWjEgPSBtb2QoWTIgKiBaMSk7XG4gICAgcmV0dXJuIFgxWjIgPT09IFgyWjEgJiYgWTFaMiA9PT0gWTJaMTtcbiAgfVxuXG4gIC8vIEludmVyc2VzIHBvaW50IHRvIG9uZSBjb3JyZXNwb25kaW5nIHRvICh4LCAteSkgaW4gQWZmaW5lIGNvb3JkaW5hdGVzLlxuICBuZWdhdGUoKTogRXh0ZW5kZWRQb2ludCB7XG4gICAgcmV0dXJuIG5ldyBFeHRlbmRlZFBvaW50KG1vZCgtdGhpcy54KSwgdGhpcy55LCB0aGlzLnosIG1vZCgtdGhpcy50KSk7XG4gIH1cblxuICAvLyBGYXN0IGFsZ28gZm9yIGRvdWJsaW5nIEV4dGVuZGVkIFBvaW50IHdoZW4gY3VydmUncyBhPS0xLlxuICAvLyBodHRwOi8vaHlwZXJlbGxpcHRpYy5vcmcvRUZEL2cxcC9hdXRvLXR3aXN0ZWQtZXh0ZW5kZWQtMS5odG1sI2RvdWJsaW5nLWRibC0yMDA4LWh3Y2RcbiAgLy8gQ29zdDogM00gKyA0UyArIDEqYSArIDdhZGQgKyAxKjIuXG4gIGRvdWJsZSgpOiBFeHRlbmRlZFBvaW50IHtcbiAgICBjb25zdCB7IHg6IFgxLCB5OiBZMSwgejogWjEgfSA9IHRoaXM7XG4gICAgY29uc3QgeyBhIH0gPSBDVVJWRTtcbiAgICBjb25zdCBBID0gbW9kKFgxICoqIF8ybik7XG4gICAgY29uc3QgQiA9IG1vZChZMSAqKiBfMm4pO1xuICAgIGNvbnN0IEMgPSBtb2QoXzJuICogbW9kKFoxICoqIF8ybikpO1xuICAgIGNvbnN0IEQgPSBtb2QoYSAqIEEpO1xuICAgIGNvbnN0IEUgPSBtb2QobW9kKChYMSArIFkxKSAqKiBfMm4pIC0gQSAtIEIpO1xuICAgIGNvbnN0IEcgPSBEICsgQjtcbiAgICBjb25zdCBGID0gRyAtIEM7XG4gICAgY29uc3QgSCA9IEQgLSBCO1xuICAgIGNvbnN0IFgzID0gbW9kKEUgKiBGKTtcbiAgICBjb25zdCBZMyA9IG1vZChHICogSCk7XG4gICAgY29uc3QgVDMgPSBtb2QoRSAqIEgpO1xuICAgIGNvbnN0IFozID0gbW9kKEYgKiBHKTtcbiAgICByZXR1cm4gbmV3IEV4dGVuZGVkUG9pbnQoWDMsIFkzLCBaMywgVDMpO1xuICB9XG5cbiAgLy8gRmFzdCBhbGdvIGZvciBhZGRpbmcgMiBFeHRlbmRlZCBQb2ludHMgd2hlbiBjdXJ2ZSdzIGE9LTEuXG4gIC8vIGh0dHA6Ly9oeXBlcmVsbGlwdGljLm9yZy9FRkQvZzFwL2F1dG8tdHdpc3RlZC1leHRlbmRlZC0xLmh0bWwjYWRkaXRpb24tYWRkLTIwMDgtaHdjZC00XG4gIC8vIENvc3Q6IDhNICsgOGFkZCArIDIqMi5cbiAgLy8gTm90ZTogSXQgZG9lcyBub3QgY2hlY2sgd2hldGhlciB0aGUgYG90aGVyYCBwb2ludCBpcyB2YWxpZC5cbiAgYWRkKG90aGVyOiBFeHRlbmRlZFBvaW50KSB7XG4gICAgYXNzZXJ0RXh0UG9pbnQob3RoZXIpO1xuICAgIGNvbnN0IHsgeDogWDEsIHk6IFkxLCB6OiBaMSwgdDogVDEgfSA9IHRoaXM7XG4gICAgY29uc3QgeyB4OiBYMiwgeTogWTIsIHo6IFoyLCB0OiBUMiB9ID0gb3RoZXI7XG4gICAgY29uc3QgQSA9IG1vZCgoWTEgLSBYMSkgKiAoWTIgKyBYMikpO1xuICAgIGNvbnN0IEIgPSBtb2QoKFkxICsgWDEpICogKFkyIC0gWDIpKTtcbiAgICBjb25zdCBGID0gbW9kKEIgLSBBKTtcbiAgICBpZiAoRiA9PT0gXzBuKSByZXR1cm4gdGhpcy5kb3VibGUoKTsgLy8gU2FtZSBwb2ludC5cbiAgICBjb25zdCBDID0gbW9kKFoxICogXzJuICogVDIpO1xuICAgIGNvbnN0IEQgPSBtb2QoVDEgKiBfMm4gKiBaMik7XG4gICAgY29uc3QgRSA9IEQgKyBDO1xuICAgIGNvbnN0IEcgPSBCICsgQTtcbiAgICBjb25zdCBIID0gRCAtIEM7XG4gICAgY29uc3QgWDMgPSBtb2QoRSAqIEYpO1xuICAgIGNvbnN0IFkzID0gbW9kKEcgKiBIKTtcbiAgICBjb25zdCBUMyA9IG1vZChFICogSCk7XG4gICAgY29uc3QgWjMgPSBtb2QoRiAqIEcpO1xuICAgIHJldHVybiBuZXcgRXh0ZW5kZWRQb2ludChYMywgWTMsIFozLCBUMyk7XG4gIH1cblxuICBzdWJ0cmFjdChvdGhlcjogRXh0ZW5kZWRQb2ludCk6IEV4dGVuZGVkUG9pbnQge1xuICAgIHJldHVybiB0aGlzLmFkZChvdGhlci5uZWdhdGUoKSk7XG4gIH1cblxuICBwcml2YXRlIHByZWNvbXB1dGVXaW5kb3coVzogbnVtYmVyKTogRXh0ZW5kZWRQb2ludFtdIHtcbiAgICBjb25zdCB3aW5kb3dzID0gMSArIDI1NiAvIFc7XG4gICAgY29uc3QgcG9pbnRzOiBFeHRlbmRlZFBvaW50W10gPSBbXTtcbiAgICBsZXQgcDogRXh0ZW5kZWRQb2ludCA9IHRoaXM7XG4gICAgbGV0IGJhc2UgPSBwO1xuICAgIGZvciAobGV0IHdpbmRvdyA9IDA7IHdpbmRvdyA8IHdpbmRvd3M7IHdpbmRvdysrKSB7XG4gICAgICBiYXNlID0gcDtcbiAgICAgIHBvaW50cy5wdXNoKGJhc2UpO1xuICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCAyICoqIChXIC0gMSk7IGkrKykge1xuICAgICAgICBiYXNlID0gYmFzZS5hZGQocCk7XG4gICAgICAgIHBvaW50cy5wdXNoKGJhc2UpO1xuICAgICAgfVxuICAgICAgcCA9IGJhc2UuZG91YmxlKCk7XG4gICAgfVxuICAgIHJldHVybiBwb2ludHM7XG4gIH1cblxuICBwcml2YXRlIHdOQUYobjogYmlnaW50LCBhZmZpbmVQb2ludD86IFBvaW50KTogRXh0ZW5kZWRQb2ludCB7XG4gICAgaWYgKCFhZmZpbmVQb2ludCAmJiB0aGlzLmVxdWFscyhFeHRlbmRlZFBvaW50LkJBU0UpKSBhZmZpbmVQb2ludCA9IFBvaW50LkJBU0U7XG4gICAgY29uc3QgVyA9IChhZmZpbmVQb2ludCAmJiBhZmZpbmVQb2ludC5fV0lORE9XX1NJWkUpIHx8IDE7XG4gICAgaWYgKDI1NiAlIFcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUG9pbnQjd05BRjogSW52YWxpZCBwcmVjb21wdXRhdGlvbiB3aW5kb3csIG11c3QgYmUgcG93ZXIgb2YgMicpO1xuICAgIH1cblxuICAgIGxldCBwcmVjb21wdXRlcyA9IGFmZmluZVBvaW50ICYmIHBvaW50UHJlY29tcHV0ZXMuZ2V0KGFmZmluZVBvaW50KTtcbiAgICBpZiAoIXByZWNvbXB1dGVzKSB7XG4gICAgICBwcmVjb21wdXRlcyA9IHRoaXMucHJlY29tcHV0ZVdpbmRvdyhXKTtcbiAgICAgIGlmIChhZmZpbmVQb2ludCAmJiBXICE9PSAxKSB7XG4gICAgICAgIHByZWNvbXB1dGVzID0gRXh0ZW5kZWRQb2ludC5ub3JtYWxpemVaKHByZWNvbXB1dGVzKTtcbiAgICAgICAgcG9pbnRQcmVjb21wdXRlcy5zZXQoYWZmaW5lUG9pbnQsIHByZWNvbXB1dGVzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgcCA9IEV4dGVuZGVkUG9pbnQuWkVSTztcbiAgICBsZXQgZiA9IEV4dGVuZGVkUG9pbnQuWkVSTztcblxuICAgIGNvbnN0IHdpbmRvd3MgPSAxICsgMjU2IC8gVztcbiAgICBjb25zdCB3aW5kb3dTaXplID0gMiAqKiAoVyAtIDEpO1xuICAgIGNvbnN0IG1hc2sgPSBCaWdJbnQoMiAqKiBXIC0gMSk7IC8vIENyZWF0ZSBtYXNrIHdpdGggVyBvbmVzOiAwYjExMTEgZm9yIFc9NCBldGMuXG4gICAgY29uc3QgbWF4TnVtYmVyID0gMiAqKiBXO1xuICAgIGNvbnN0IHNoaWZ0QnkgPSBCaWdJbnQoVyk7XG5cbiAgICBmb3IgKGxldCB3aW5kb3cgPSAwOyB3aW5kb3cgPCB3aW5kb3dzOyB3aW5kb3crKykge1xuICAgICAgY29uc3Qgb2Zmc2V0ID0gd2luZG93ICogd2luZG93U2l6ZTtcbiAgICAgIC8vIEV4dHJhY3QgVyBiaXRzLlxuICAgICAgbGV0IHdiaXRzID0gTnVtYmVyKG4gJiBtYXNrKTtcblxuICAgICAgLy8gU2hpZnQgbnVtYmVyIGJ5IFcgYml0cy5cbiAgICAgIG4gPj49IHNoaWZ0Qnk7XG5cbiAgICAgIC8vIElmIHRoZSBiaXRzIGFyZSBiaWdnZXIgdGhhbiBtYXggc2l6ZSwgd2UnbGwgc3BsaXQgdGhvc2UuXG4gICAgICAvLyArMjI0ID0+IDI1NiAtIDMyXG4gICAgICBpZiAod2JpdHMgPiB3aW5kb3dTaXplKSB7XG4gICAgICAgIHdiaXRzIC09IG1heE51bWJlcjtcbiAgICAgICAgbiArPSBfMW47XG4gICAgICB9XG5cbiAgICAgIC8vIENoZWNrIGlmIHdlJ3JlIG9udG8gWmVybyBwb2ludC5cbiAgICAgIC8vIEFkZCByYW5kb20gcG9pbnQgaW5zaWRlIGN1cnJlbnQgd2luZG93IHRvIGYuXG4gICAgICBpZiAod2JpdHMgPT09IDApIHtcbiAgICAgICAgbGV0IHByID0gcHJlY29tcHV0ZXNbb2Zmc2V0XTtcbiAgICAgICAgaWYgKHdpbmRvdyAlIDIpIHByID0gcHIubmVnYXRlKCk7XG4gICAgICAgIGYgPSBmLmFkZChwcik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgY2FjaGVkID0gcHJlY29tcHV0ZXNbb2Zmc2V0ICsgTWF0aC5hYnMod2JpdHMpIC0gMV07XG4gICAgICAgIGlmICh3Yml0cyA8IDApIGNhY2hlZCA9IGNhY2hlZC5uZWdhdGUoKTtcbiAgICAgICAgcCA9IHAuYWRkKGNhY2hlZCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBFeHRlbmRlZFBvaW50Lm5vcm1hbGl6ZVooW3AsIGZdKVswXTtcbiAgfVxuXG4gIC8vIENvbnN0YW50IHRpbWUgbXVsdGlwbGljYXRpb24uXG4gIC8vIFVzZXMgd05BRiBtZXRob2QuIFdpbmRvd2VkIG1ldGhvZCBtYXkgYmUgMTAlIGZhc3RlcixcbiAgLy8gYnV0IHRha2VzIDJ4IGxvbmdlciB0byBnZW5lcmF0ZSBhbmQgY29uc3VtZXMgMnggbWVtb3J5LlxuICBtdWx0aXBseShzY2FsYXI6IG51bWJlciB8IGJpZ2ludCwgYWZmaW5lUG9pbnQ/OiBQb2ludCk6IEV4dGVuZGVkUG9pbnQge1xuICAgIHJldHVybiB0aGlzLndOQUYobm9ybWFsaXplU2NhbGFyKHNjYWxhciwgQ1VSVkUubCksIGFmZmluZVBvaW50KTtcbiAgfVxuXG4gIC8vIE5vbi1jb25zdGFudC10aW1lIG11bHRpcGxpY2F0aW9uLiBVc2VzIGRvdWJsZS1hbmQtYWRkIGFsZ29yaXRobS5cbiAgLy8gSXQncyBmYXN0ZXIsIGJ1dCBzaG91bGQgb25seSBiZSB1c2VkIHdoZW4geW91IGRvbid0IGNhcmUgYWJvdXRcbiAgLy8gYW4gZXhwb3NlZCBwcml2YXRlIGtleSBlLmcuIHNpZyB2ZXJpZmljYXRpb24uXG4gIC8vIEFsbG93cyBzY2FsYXIgYmlnZ2VyIHRoYW4gY3VydmUgb3JkZXIsIGJ1dCBsZXNzIHRoYW4gMl4yNTZcbiAgbXVsdGlwbHlVbnNhZmUoc2NhbGFyOiBudW1iZXIgfCBiaWdpbnQpOiBFeHRlbmRlZFBvaW50IHtcbiAgICBsZXQgbiA9IG5vcm1hbGl6ZVNjYWxhcihzY2FsYXIsIENVUlZFLmwsIGZhbHNlKTtcbiAgICBjb25zdCBHID0gRXh0ZW5kZWRQb2ludC5CQVNFO1xuICAgIGNvbnN0IFAwID0gRXh0ZW5kZWRQb2ludC5aRVJPO1xuICAgIGlmIChuID09PSBfMG4pIHJldHVybiBQMDtcbiAgICBpZiAodGhpcy5lcXVhbHMoUDApIHx8IG4gPT09IF8xbikgcmV0dXJuIHRoaXM7XG4gICAgaWYgKHRoaXMuZXF1YWxzKEcpKSByZXR1cm4gdGhpcy53TkFGKG4pO1xuICAgIGxldCBwID0gUDA7XG4gICAgbGV0IGQ6IEV4dGVuZGVkUG9pbnQgPSB0aGlzO1xuICAgIHdoaWxlIChuID4gXzBuKSB7XG4gICAgICBpZiAobiAmIF8xbikgcCA9IHAuYWRkKGQpO1xuICAgICAgZCA9IGQuZG91YmxlKCk7XG4gICAgICBuID4+PSBfMW47XG4gICAgfVxuICAgIHJldHVybiBwO1xuICB9XG5cbiAgaXNTbWFsbE9yZGVyKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm11bHRpcGx5VW5zYWZlKENVUlZFLmgpLmVxdWFscyhFeHRlbmRlZFBvaW50LlpFUk8pO1xuICB9XG5cbiAgaXNUb3JzaW9uRnJlZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy5tdWx0aXBseVVuc2FmZShDVVJWRS5sKS5lcXVhbHMoRXh0ZW5kZWRQb2ludC5aRVJPKTtcbiAgfVxuXG4gIC8vIENvbnZlcnRzIEV4dGVuZGVkIHBvaW50IHRvIGRlZmF1bHQgKHgsIHkpIGNvb3JkaW5hdGVzLlxuICAvLyBDYW4gYWNjZXB0IHByZWNvbXB1dGVkIFpeLTEgLSBmb3IgZXhhbXBsZSwgZnJvbSBpbnZlcnRCYXRjaC5cbiAgdG9BZmZpbmUoaW52WjogYmlnaW50ID0gaW52ZXJ0KHRoaXMueikpOiBQb2ludCB7XG4gICAgY29uc3QgeyB4LCB5LCB6IH0gPSB0aGlzO1xuICAgIGNvbnN0IGF4ID0gbW9kKHggKiBpbnZaKTtcbiAgICBjb25zdCBheSA9IG1vZCh5ICogaW52Wik7XG4gICAgY29uc3QgenogPSBtb2QoeiAqIGludlopO1xuICAgIGlmICh6eiAhPT0gXzFuKSB0aHJvdyBuZXcgRXJyb3IoJ2ludlogd2FzIGludmFsaWQnKTtcbiAgICByZXR1cm4gbmV3IFBvaW50KGF4LCBheSk7XG4gIH1cblxuICBmcm9tUmlzdHJldHRvQnl0ZXMoKSB7XG4gICAgbGVnYWN5UmlzdCgpO1xuICB9XG4gIHRvUmlzdHJldHRvQnl0ZXMoKSB7XG4gICAgbGVnYWN5UmlzdCgpO1xuICB9XG4gIGZyb21SaXN0cmV0dG9IYXNoKCkge1xuICAgIGxlZ2FjeVJpc3QoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhc3NlcnRFeHRQb2ludChvdGhlcjogdW5rbm93bikge1xuICBpZiAoIShvdGhlciBpbnN0YW5jZW9mIEV4dGVuZGVkUG9pbnQpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdFeHRlbmRlZFBvaW50IGV4cGVjdGVkJyk7XG59XG5mdW5jdGlvbiBhc3NlcnRSc3RQb2ludChvdGhlcjogdW5rbm93bikge1xuICBpZiAoIShvdGhlciBpbnN0YW5jZW9mIFJpc3RyZXR0b1BvaW50KSkgdGhyb3cgbmV3IFR5cGVFcnJvcignUmlzdHJldHRvUG9pbnQgZXhwZWN0ZWQnKTtcbn1cblxuZnVuY3Rpb24gbGVnYWN5UmlzdCgpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdMZWdhY3kgbWV0aG9kOiBzd2l0Y2ggdG8gUmlzdHJldHRvUG9pbnQnKTtcbn1cblxuLyoqXG4gKiBFYWNoIGVkMjU1MTkvRXh0ZW5kZWRQb2ludCBoYXMgOCBkaWZmZXJlbnQgZXF1aXZhbGVudCBwb2ludHMuIFRoaXMgY2FuIGJlXG4gKiBhIHNvdXJjZSBvZiBidWdzIGZvciBwcm90b2NvbHMgbGlrZSByaW5nIHNpZ25hdHVyZXMuIFJpc3RyZXR0byB3YXMgY3JlYXRlZCB0byBzb2x2ZSB0aGlzLlxuICogUmlzdHJldHRvIHBvaW50IG9wZXJhdGVzIGluIFg6WTpaOlQgZXh0ZW5kZWQgY29vcmRpbmF0ZXMgbGlrZSBFeHRlbmRlZFBvaW50LFxuICogYnV0IGl0IHNob3VsZCB3b3JrIGluIGl0cyBvd24gbmFtZXNwYWNlOiBkbyBub3QgY29tYmluZSB0aG9zZSB0d28uXG4gKiBodHRwczovL2RhdGF0cmFja2VyLmlldGYub3JnL2RvYy9odG1sL2RyYWZ0LWlydGYtY2ZyZy1yaXN0cmV0dG8yNTUtZGVjYWY0NDhcbiAqL1xuY2xhc3MgUmlzdHJldHRvUG9pbnQge1xuICBzdGF0aWMgQkFTRSA9IG5ldyBSaXN0cmV0dG9Qb2ludChFeHRlbmRlZFBvaW50LkJBU0UpO1xuICBzdGF0aWMgWkVSTyA9IG5ldyBSaXN0cmV0dG9Qb2ludChFeHRlbmRlZFBvaW50LlpFUk8pO1xuXG4gIC8vIFByaXZhdGUgcHJvcGVydHkgdG8gZGlzY291cmFnZSBjb21iaW5pbmcgRXh0ZW5kZWRQb2ludCArIFJpc3RyZXR0b1BvaW50XG4gIC8vIEFsd2F5cyB1c2UgUmlzdHJldHRvIGVuY29kaW5nL2RlY29kaW5nIGluc3RlYWQuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgZXA6IEV4dGVuZGVkUG9pbnQpIHt9XG5cbiAgLy8gQ29tcHV0ZXMgRWxsaWdhdG9yIG1hcCBmb3IgUmlzdHJldHRvXG4gIC8vIGh0dHBzOi8vcmlzdHJldHRvLmdyb3VwL2Zvcm11bGFzL2VsbGlnYXRvci5odG1sXG4gIHByaXZhdGUgc3RhdGljIGNhbGNFbGxpZ2F0b3JSaXN0cmV0dG9NYXAocjA6IGJpZ2ludCk6IEV4dGVuZGVkUG9pbnQge1xuICAgIGNvbnN0IHsgZCB9ID0gQ1VSVkU7XG4gICAgY29uc3QgciA9IG1vZChTUVJUX00xICogcjAgKiByMCk7IC8vIDFcbiAgICBjb25zdCBOcyA9IG1vZCgociArIF8xbikgKiBPTkVfTUlOVVNfRF9TUSk7IC8vIDJcbiAgICBsZXQgYyA9IEJpZ0ludCgtMSk7IC8vIDNcbiAgICBjb25zdCBEID0gbW9kKChjIC0gZCAqIHIpICogbW9kKHIgKyBkKSk7IC8vIDRcbiAgICBsZXQgeyBpc1ZhbGlkOiBOc19EX2lzX3NxLCB2YWx1ZTogcyB9ID0gdXZSYXRpbyhOcywgRCk7IC8vIDVcbiAgICBsZXQgc18gPSBtb2QocyAqIHIwKTsgLy8gNlxuICAgIGlmICghZWRJc05lZ2F0aXZlKHNfKSkgc18gPSBtb2QoLXNfKTtcbiAgICBpZiAoIU5zX0RfaXNfc3EpIHMgPSBzXzsgLy8gN1xuICAgIGlmICghTnNfRF9pc19zcSkgYyA9IHI7IC8vIDhcbiAgICBjb25zdCBOdCA9IG1vZChjICogKHIgLSBfMW4pICogRF9NSU5VU19PTkVfU1EgLSBEKTsgLy8gOVxuICAgIGNvbnN0IHMyID0gcyAqIHM7XG4gICAgY29uc3QgVzAgPSBtb2QoKHMgKyBzKSAqIEQpOyAvLyAxMFxuICAgIGNvbnN0IFcxID0gbW9kKE50ICogU1FSVF9BRF9NSU5VU19PTkUpOyAvLyAxMVxuICAgIGNvbnN0IFcyID0gbW9kKF8xbiAtIHMyKTsgLy8gMTJcbiAgICBjb25zdCBXMyA9IG1vZChfMW4gKyBzMik7IC8vIDEzXG4gICAgcmV0dXJuIG5ldyBFeHRlbmRlZFBvaW50KG1vZChXMCAqIFczKSwgbW9kKFcyICogVzEpLCBtb2QoVzEgKiBXMyksIG1vZChXMCAqIFcyKSk7XG4gIH1cblxuICAvKipcbiAgICogVGFrZXMgdW5pZm9ybSBvdXRwdXQgb2YgNjQtYml0IGhhc2ggZnVuY3Rpb24gbGlrZSBzaGE1MTIgYW5kIGNvbnZlcnRzIGl0IHRvIGBSaXN0cmV0dG9Qb2ludGAuXG4gICAqIFRoZSBoYXNoLXRvLWdyb3VwIG9wZXJhdGlvbiBhcHBsaWVzIEVsbGlnYXRvciB0d2ljZSBhbmQgYWRkcyB0aGUgcmVzdWx0cy5cbiAgICogKipOb3RlOioqIHRoaXMgaXMgb25lLXdheSBtYXAsIHRoZXJlIGlzIG5vIGNvbnZlcnNpb24gZnJvbSBwb2ludCB0byBoYXNoLlxuICAgKiBodHRwczovL3Jpc3RyZXR0by5ncm91cC9mb3JtdWxhcy9lbGxpZ2F0b3IuaHRtbFxuICAgKiBAcGFyYW0gaGV4IDY0LWJpdCBvdXRwdXQgb2YgYSBoYXNoIGZ1bmN0aW9uXG4gICAqL1xuICBzdGF0aWMgaGFzaFRvQ3VydmUoaGV4OiBIZXgpOiBSaXN0cmV0dG9Qb2ludCB7XG4gICAgaGV4ID0gZW5zdXJlQnl0ZXMoaGV4LCA2NCk7XG4gICAgY29uc3QgcjEgPSBieXRlczI1NVRvTnVtYmVyTEUoaGV4LnNsaWNlKDAsIDMyKSk7XG4gICAgY29uc3QgUjEgPSB0aGlzLmNhbGNFbGxpZ2F0b3JSaXN0cmV0dG9NYXAocjEpO1xuICAgIGNvbnN0IHIyID0gYnl0ZXMyNTVUb051bWJlckxFKGhleC5zbGljZSgzMiwgNjQpKTtcbiAgICBjb25zdCBSMiA9IHRoaXMuY2FsY0VsbGlnYXRvclJpc3RyZXR0b01hcChyMik7XG4gICAgcmV0dXJuIG5ldyBSaXN0cmV0dG9Qb2ludChSMS5hZGQoUjIpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyByaXN0cmV0dG8tZW5jb2RlZCBzdHJpbmcgdG8gcmlzdHJldHRvIHBvaW50LlxuICAgKiBodHRwczovL3Jpc3RyZXR0by5ncm91cC9mb3JtdWxhcy9kZWNvZGluZy5odG1sXG4gICAqIEBwYXJhbSBoZXggUmlzdHJldHRvLWVuY29kZWQgMzIgYnl0ZXMuIE5vdCBldmVyeSAzMi1ieXRlIHN0cmluZyBpcyB2YWxpZCByaXN0cmV0dG8gZW5jb2RpbmdcbiAgICovXG4gIHN0YXRpYyBmcm9tSGV4KGhleDogSGV4KTogUmlzdHJldHRvUG9pbnQge1xuICAgIGhleCA9IGVuc3VyZUJ5dGVzKGhleCwgMzIpO1xuICAgIGNvbnN0IHsgYSwgZCB9ID0gQ1VSVkU7XG4gICAgY29uc3QgZW1zZyA9ICdSaXN0cmV0dG9Qb2ludC5mcm9tSGV4OiB0aGUgaGV4IGlzIG5vdCB2YWxpZCBlbmNvZGluZyBvZiBSaXN0cmV0dG9Qb2ludCc7XG4gICAgY29uc3QgcyA9IGJ5dGVzMjU1VG9OdW1iZXJMRShoZXgpO1xuICAgIC8vIDEuIENoZWNrIHRoYXQgc19ieXRlcyBpcyB0aGUgY2Fub25pY2FsIGVuY29kaW5nIG9mIGEgZmllbGQgZWxlbWVudCwgb3IgZWxzZSBhYm9ydC5cbiAgICAvLyAzLiBDaGVjayB0aGF0IHMgaXMgbm9uLW5lZ2F0aXZlLCBvciBlbHNlIGFib3J0XG4gICAgaWYgKCFlcXVhbEJ5dGVzKG51bWJlclRvMzJCeXRlc0xFKHMpLCBoZXgpIHx8IGVkSXNOZWdhdGl2ZShzKSkgdGhyb3cgbmV3IEVycm9yKGVtc2cpO1xuICAgIGNvbnN0IHMyID0gbW9kKHMgKiBzKTtcbiAgICBjb25zdCB1MSA9IG1vZChfMW4gKyBhICogczIpOyAvLyA0IChhIGlzIC0xKVxuICAgIGNvbnN0IHUyID0gbW9kKF8xbiAtIGEgKiBzMik7IC8vIDVcbiAgICBjb25zdCB1MV8yID0gbW9kKHUxICogdTEpO1xuICAgIGNvbnN0IHUyXzIgPSBtb2QodTIgKiB1Mik7XG4gICAgY29uc3QgdiA9IG1vZChhICogZCAqIHUxXzIgLSB1Ml8yKTsgLy8gNlxuICAgIGNvbnN0IHsgaXNWYWxpZCwgdmFsdWU6IEkgfSA9IGludmVydFNxcnQobW9kKHYgKiB1Ml8yKSk7IC8vIDdcbiAgICBjb25zdCBEeCA9IG1vZChJICogdTIpOyAvLyA4XG4gICAgY29uc3QgRHkgPSBtb2QoSSAqIER4ICogdik7IC8vIDlcbiAgICBsZXQgeCA9IG1vZCgocyArIHMpICogRHgpOyAvLyAxMFxuICAgIGlmIChlZElzTmVnYXRpdmUoeCkpIHggPSBtb2QoLXgpOyAvLyAxMFxuICAgIGNvbnN0IHkgPSBtb2QodTEgKiBEeSk7IC8vIDExXG4gICAgY29uc3QgdCA9IG1vZCh4ICogeSk7IC8vIDEyXG4gICAgaWYgKCFpc1ZhbGlkIHx8IGVkSXNOZWdhdGl2ZSh0KSB8fCB5ID09PSBfMG4pIHRocm93IG5ldyBFcnJvcihlbXNnKTtcbiAgICByZXR1cm4gbmV3IFJpc3RyZXR0b1BvaW50KG5ldyBFeHRlbmRlZFBvaW50KHgsIHksIF8xbiwgdCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIEVuY29kZXMgcmlzdHJldHRvIHBvaW50IHRvIFVpbnQ4QXJyYXkuXG4gICAqIGh0dHBzOi8vcmlzdHJldHRvLmdyb3VwL2Zvcm11bGFzL2VuY29kaW5nLmh0bWxcbiAgICovXG4gIHRvUmF3Qnl0ZXMoKTogVWludDhBcnJheSB7XG4gICAgbGV0IHsgeCwgeSwgeiwgdCB9ID0gdGhpcy5lcDtcbiAgICBjb25zdCB1MSA9IG1vZChtb2QoeiArIHkpICogbW9kKHogLSB5KSk7IC8vIDFcbiAgICBjb25zdCB1MiA9IG1vZCh4ICogeSk7IC8vIDJcbiAgICAvLyBTcXVhcmUgcm9vdCBhbHdheXMgZXhpc3RzXG4gICAgY29uc3QgeyB2YWx1ZTogaW52c3FydCB9ID0gaW52ZXJ0U3FydChtb2QodTEgKiB1MiAqKiBfMm4pKTsgLy8gM1xuICAgIGNvbnN0IEQxID0gbW9kKGludnNxcnQgKiB1MSk7IC8vIDRcbiAgICBjb25zdCBEMiA9IG1vZChpbnZzcXJ0ICogdTIpOyAvLyA1XG4gICAgY29uc3QgekludiA9IG1vZChEMSAqIEQyICogdCk7IC8vIDZcbiAgICBsZXQgRDogYmlnaW50OyAvLyA3XG4gICAgaWYgKGVkSXNOZWdhdGl2ZSh0ICogekludikpIHtcbiAgICAgIGxldCBfeCA9IG1vZCh5ICogU1FSVF9NMSk7XG4gICAgICBsZXQgX3kgPSBtb2QoeCAqIFNRUlRfTTEpO1xuICAgICAgeCA9IF94O1xuICAgICAgeSA9IF95O1xuICAgICAgRCA9IG1vZChEMSAqIElOVlNRUlRfQV9NSU5VU19EKTtcbiAgICB9IGVsc2Uge1xuICAgICAgRCA9IEQyOyAvLyA4XG4gICAgfVxuICAgIGlmIChlZElzTmVnYXRpdmUoeCAqIHpJbnYpKSB5ID0gbW9kKC15KTsgLy8gOVxuICAgIGxldCBzID0gbW9kKCh6IC0geSkgKiBEKTsgLy8gMTAgKGNoZWNrIGZvb3RlcidzIG5vdGUsIG5vIHNxcnQoLWEpKVxuICAgIGlmIChlZElzTmVnYXRpdmUocykpIHMgPSBtb2QoLXMpO1xuICAgIHJldHVybiBudW1iZXJUbzMyQnl0ZXNMRShzKTsgLy8gMTFcbiAgfVxuXG4gIHRvSGV4KCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGJ5dGVzVG9IZXgodGhpcy50b1Jhd0J5dGVzKCkpO1xuICB9XG5cbiAgdG9TdHJpbmcoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy50b0hleCgpO1xuICB9XG5cbiAgLy8gQ29tcGFyZSBvbmUgcG9pbnQgdG8gYW5vdGhlci5cbiAgZXF1YWxzKG90aGVyOiBSaXN0cmV0dG9Qb2ludCk6IGJvb2xlYW4ge1xuICAgIGFzc2VydFJzdFBvaW50KG90aGVyKTtcbiAgICBjb25zdCBhID0gdGhpcy5lcDtcbiAgICBjb25zdCBiID0gb3RoZXIuZXA7XG4gICAgLy8gKHgxICogeTIgPT0geTEgKiB4MikgfCAoeTEgKiB5MiA9PSB4MSAqIHgyKVxuICAgIGNvbnN0IG9uZSA9IG1vZChhLnggKiBiLnkpID09PSBtb2QoYS55ICogYi54KTtcbiAgICBjb25zdCB0d28gPSBtb2QoYS55ICogYi55KSA9PT0gbW9kKGEueCAqIGIueCk7XG4gICAgcmV0dXJuIG9uZSB8fCB0d287XG4gIH1cblxuICBhZGQob3RoZXI6IFJpc3RyZXR0b1BvaW50KTogUmlzdHJldHRvUG9pbnQge1xuICAgIGFzc2VydFJzdFBvaW50KG90aGVyKTtcbiAgICByZXR1cm4gbmV3IFJpc3RyZXR0b1BvaW50KHRoaXMuZXAuYWRkKG90aGVyLmVwKSk7XG4gIH1cblxuICBzdWJ0cmFjdChvdGhlcjogUmlzdHJldHRvUG9pbnQpOiBSaXN0cmV0dG9Qb2ludCB7XG4gICAgYXNzZXJ0UnN0UG9pbnQob3RoZXIpO1xuICAgIHJldHVybiBuZXcgUmlzdHJldHRvUG9pbnQodGhpcy5lcC5zdWJ0cmFjdChvdGhlci5lcCkpO1xuICB9XG5cbiAgbXVsdGlwbHkoc2NhbGFyOiBudW1iZXIgfCBiaWdpbnQpOiBSaXN0cmV0dG9Qb2ludCB7XG4gICAgcmV0dXJuIG5ldyBSaXN0cmV0dG9Qb2ludCh0aGlzLmVwLm11bHRpcGx5KHNjYWxhcikpO1xuICB9XG5cbiAgbXVsdGlwbHlVbnNhZmUoc2NhbGFyOiBudW1iZXIgfCBiaWdpbnQpOiBSaXN0cmV0dG9Qb2ludCB7XG4gICAgcmV0dXJuIG5ldyBSaXN0cmV0dG9Qb2ludCh0aGlzLmVwLm11bHRpcGx5VW5zYWZlKHNjYWxhcikpO1xuICB9XG59XG5cbi8vIFN0b3JlcyBwcmVjb21wdXRlZCB2YWx1ZXMgZm9yIHBvaW50cy5cbmNvbnN0IHBvaW50UHJlY29tcHV0ZXMgPSBuZXcgV2Vha01hcDxQb2ludCwgRXh0ZW5kZWRQb2ludFtdPigpO1xuXG4vKipcbiAqIERlZmF1bHQgUG9pbnQgd29ya3MgaW4gYWZmaW5lIGNvb3JkaW5hdGVzOiAoeCwgeSlcbiAqL1xuY2xhc3MgUG9pbnQge1xuICAvLyBCYXNlIHBvaW50IGFrYSBnZW5lcmF0b3JcbiAgLy8gcHVibGljX2tleSA9IFBvaW50LkJBU0UgKiBwcml2YXRlX2tleVxuICBzdGF0aWMgQkFTRTogUG9pbnQgPSBuZXcgUG9pbnQoQ1VSVkUuR3gsIENVUlZFLkd5KTtcbiAgLy8gSWRlbnRpdHkgcG9pbnQgYWthIHBvaW50IGF0IGluZmluaXR5XG4gIC8vIHBvaW50ID0gcG9pbnQgKyB6ZXJvX3BvaW50XG4gIHN0YXRpYyBaRVJPOiBQb2ludCA9IG5ldyBQb2ludChfMG4sIF8xbik7XG4gIC8vIFdlIGNhbGN1bGF0ZSBwcmVjb21wdXRlcyBmb3IgZWxsaXB0aWMgY3VydmUgcG9pbnQgbXVsdGlwbGljYXRpb25cbiAgLy8gdXNpbmcgd2luZG93ZWQgbWV0aG9kLiBUaGlzIHNwZWNpZmllcyB3aW5kb3cgc2l6ZSBhbmRcbiAgLy8gc3RvcmVzIHByZWNvbXB1dGVkIHZhbHVlcy4gVXN1YWxseSBvbmx5IGJhc2UgcG9pbnQgd291bGQgYmUgcHJlY29tcHV0ZWQuXG4gIF9XSU5ET1dfU0laRT86IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihyZWFkb25seSB4OiBiaWdpbnQsIHJlYWRvbmx5IHk6IGJpZ2ludCkge31cblxuICAvLyBcIlByaXZhdGUgbWV0aG9kXCIsIGRvbid0IHVzZSBpdCBkaXJlY3RseS5cbiAgX3NldFdpbmRvd1NpemUod2luZG93U2l6ZTogbnVtYmVyKSB7XG4gICAgdGhpcy5fV0lORE9XX1NJWkUgPSB3aW5kb3dTaXplO1xuICAgIHBvaW50UHJlY29tcHV0ZXMuZGVsZXRlKHRoaXMpO1xuICB9XG5cbiAgLy8gQ29udmVydHMgaGFzaCBzdHJpbmcgb3IgVWludDhBcnJheSB0byBQb2ludC5cbiAgLy8gVXNlcyBhbGdvIGZyb20gUkZDODAzMiA1LjEuMy5cbiAgc3RhdGljIGZyb21IZXgoaGV4OiBIZXgsIHN0cmljdCA9IHRydWUpIHtcbiAgICBjb25zdCB7IGQsIFAgfSA9IENVUlZFO1xuICAgIGhleCA9IGVuc3VyZUJ5dGVzKGhleCwgMzIpO1xuICAgIC8vIDEuICBGaXJzdCwgaW50ZXJwcmV0IHRoZSBzdHJpbmcgYXMgYW4gaW50ZWdlciBpbiBsaXR0bGUtZW5kaWFuXG4gICAgLy8gcmVwcmVzZW50YXRpb24uIEJpdCAyNTUgb2YgdGhpcyBudW1iZXIgaXMgdGhlIGxlYXN0IHNpZ25pZmljYW50XG4gICAgLy8gYml0IG9mIHRoZSB4LWNvb3JkaW5hdGUgYW5kIGRlbm90ZSB0aGlzIHZhbHVlIHhfMC4gIFRoZVxuICAgIC8vIHktY29vcmRpbmF0ZSBpcyByZWNvdmVyZWQgc2ltcGx5IGJ5IGNsZWFyaW5nIHRoaXMgYml0LiAgSWYgdGhlXG4gICAgLy8gcmVzdWx0aW5nIHZhbHVlIGlzID49IHAsIGRlY29kaW5nIGZhaWxzLlxuICAgIGNvbnN0IG5vcm1lZCA9IGhleC5zbGljZSgpO1xuICAgIG5vcm1lZFszMV0gPSBoZXhbMzFdICYgfjB4ODA7XG4gICAgY29uc3QgeSA9IGJ5dGVzVG9OdW1iZXJMRShub3JtZWQpO1xuXG4gICAgaWYgKHN0cmljdCAmJiB5ID49IFApIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgMCA8IGhleCA8IFAnKTtcbiAgICBpZiAoIXN0cmljdCAmJiB5ID49IE1BWF8yNTZCKSB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIDAgPCBoZXggPCAyKioyNTYnKTtcblxuICAgIC8vIDIuICBUbyByZWNvdmVyIHRoZSB4LWNvb3JkaW5hdGUsIHRoZSBjdXJ2ZSBlcXVhdGlvbiBpbXBsaWVzXG4gICAgLy8geMKyID0gKHnCsiAtIDEpIC8gKGQgecKyICsgMSkgKG1vZCBwKS4gIFRoZSBkZW5vbWluYXRvciBpcyBhbHdheXNcbiAgICAvLyBub24temVybyBtb2QgcC4gIExldCB1ID0gecKyIC0gMSBhbmQgdiA9IGQgecKyICsgMS5cbiAgICBjb25zdCB5MiA9IG1vZCh5ICogeSk7XG4gICAgY29uc3QgdSA9IG1vZCh5MiAtIF8xbik7XG4gICAgY29uc3QgdiA9IG1vZChkICogeTIgKyBfMW4pO1xuICAgIGxldCB7IGlzVmFsaWQsIHZhbHVlOiB4IH0gPSB1dlJhdGlvKHUsIHYpO1xuICAgIGlmICghaXNWYWxpZCkgdGhyb3cgbmV3IEVycm9yKCdQb2ludC5mcm9tSGV4OiBpbnZhbGlkIHkgY29vcmRpbmF0ZScpO1xuXG4gICAgLy8gNC4gIEZpbmFsbHksIHVzZSB0aGUgeF8wIGJpdCB0byBzZWxlY3QgdGhlIHJpZ2h0IHNxdWFyZSByb290LiAgSWZcbiAgICAvLyB4ID0gMCwgYW5kIHhfMCA9IDEsIGRlY29kaW5nIGZhaWxzLiAgT3RoZXJ3aXNlLCBpZiB4XzAgIT0geCBtb2RcbiAgICAvLyAyLCBzZXQgeCA8LS0gcCAtIHguICBSZXR1cm4gdGhlIGRlY29kZWQgcG9pbnQgKHgseSkuXG4gICAgY29uc3QgaXNYT2RkID0gKHggJiBfMW4pID09PSBfMW47XG4gICAgY29uc3QgaXNMYXN0Qnl0ZU9kZCA9IChoZXhbMzFdICYgMHg4MCkgIT09IDA7XG4gICAgaWYgKGlzTGFzdEJ5dGVPZGQgIT09IGlzWE9kZCkge1xuICAgICAgeCA9IG1vZCgteCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgUG9pbnQoeCwgeSk7XG4gIH1cblxuICBzdGF0aWMgYXN5bmMgZnJvbVByaXZhdGVLZXkocHJpdmF0ZUtleTogUHJpdktleSkge1xuICAgIHJldHVybiAoYXdhaXQgZ2V0RXh0ZW5kZWRQdWJsaWNLZXkocHJpdmF0ZUtleSkpLnBvaW50O1xuICB9XG5cbiAgLy8gVGhlcmUgY2FuIGFsd2F5cyBiZSBvbmx5IHR3byB4IHZhbHVlcyAoeCwgLXgpIGZvciBhbnkgeVxuICAvLyBXaGVuIGNvbXByZXNzaW5nIHBvaW50LCBpdCdzIGVub3VnaCB0byBvbmx5IHN0b3JlIGl0cyB5IGNvb3JkaW5hdGVcbiAgLy8gYW5kIHVzZSB0aGUgbGFzdCBieXRlIHRvIGVuY29kZSBzaWduIG9mIHguXG4gIHRvUmF3Qnl0ZXMoKTogVWludDhBcnJheSB7XG4gICAgY29uc3QgYnl0ZXMgPSBudW1iZXJUbzMyQnl0ZXNMRSh0aGlzLnkpO1xuICAgIGJ5dGVzWzMxXSB8PSB0aGlzLnggJiBfMW4gPyAweDgwIDogMDtcbiAgICByZXR1cm4gYnl0ZXM7XG4gIH1cblxuICAvLyBTYW1lIGFzIHRvUmF3Qnl0ZXMsIGJ1dCByZXR1cm5zIHN0cmluZy5cbiAgdG9IZXgoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYnl0ZXNUb0hleCh0aGlzLnRvUmF3Qnl0ZXMoKSk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgdG8gTW9udGdvbWVyeTsgYWthIHggY29vcmRpbmF0ZSBvZiBjdXJ2ZTI1NTE5LlxuICAgKiBXZSBkb24ndCBoYXZlIGZyb21YMjU1MTksIGJlY2F1c2Ugd2UgZG9uJ3Qga25vdyBzaWduLlxuICAgKlxuICAgKiBgYGBcbiAgICogdSwgdjogY3VydmUyNTUxOSBjb29yZGluYXRlc1xuICAgKiB4LCB5OiBlZDI1NTE5IGNvb3JkaW5hdGVzXG4gICAqICh1LCB2KSA9ICgoMSt5KS8oMS15KSwgc3FydCgtNDg2NjY0KSp1L3gpXG4gICAqICh4LCB5KSA9IChzcXJ0KC00ODY2NjQpKnUvdiwgKHUtMSkvKHUrMSkpXG4gICAqIGBgYFxuICAgKiBodHRwczovL2Jsb2cuZmlsaXBwby5pby91c2luZy1lZDI1NTE5LWtleXMtZm9yLWVuY3J5cHRpb25cbiAgICogQHJldHVybnMgdSBjb29yZGluYXRlIG9mIGN1cnZlMjU1MTkgcG9pbnRcbiAgICovXG4gIHRvWDI1NTE5KCk6IFVpbnQ4QXJyYXkge1xuICAgIGNvbnN0IHsgeSB9ID0gdGhpcztcbiAgICBjb25zdCB1ID0gbW9kKChfMW4gKyB5KSAqIGludmVydChfMW4gLSB5KSk7XG4gICAgcmV0dXJuIG51bWJlclRvMzJCeXRlc0xFKHUpO1xuICB9XG5cbiAgaXNUb3JzaW9uRnJlZSgpOiBib29sZWFuIHtcbiAgICByZXR1cm4gRXh0ZW5kZWRQb2ludC5mcm9tQWZmaW5lKHRoaXMpLmlzVG9yc2lvbkZyZWUoKTtcbiAgfVxuXG4gIGVxdWFscyhvdGhlcjogUG9pbnQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdGhpcy54ID09PSBvdGhlci54ICYmIHRoaXMueSA9PT0gb3RoZXIueTtcbiAgfVxuXG4gIG5lZ2F0ZSgpIHtcbiAgICByZXR1cm4gbmV3IFBvaW50KG1vZCgtdGhpcy54KSwgdGhpcy55KTtcbiAgfVxuXG4gIGFkZChvdGhlcjogUG9pbnQpIHtcbiAgICByZXR1cm4gRXh0ZW5kZWRQb2ludC5mcm9tQWZmaW5lKHRoaXMpLmFkZChFeHRlbmRlZFBvaW50LmZyb21BZmZpbmUob3RoZXIpKS50b0FmZmluZSgpO1xuICB9XG5cbiAgc3VidHJhY3Qob3RoZXI6IFBvaW50KSB7XG4gICAgcmV0dXJuIHRoaXMuYWRkKG90aGVyLm5lZ2F0ZSgpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb25zdGFudCB0aW1lIG11bHRpcGxpY2F0aW9uLlxuICAgKiBAcGFyYW0gc2NhbGFyIEJpZy1FbmRpYW4gbnVtYmVyXG4gICAqIEByZXR1cm5zIG5ldyBwb2ludFxuICAgKi9cbiAgbXVsdGlwbHkoc2NhbGFyOiBudW1iZXIgfCBiaWdpbnQpOiBQb2ludCB7XG4gICAgcmV0dXJuIEV4dGVuZGVkUG9pbnQuZnJvbUFmZmluZSh0aGlzKS5tdWx0aXBseShzY2FsYXIsIHRoaXMpLnRvQWZmaW5lKCk7XG4gIH1cbn1cblxuLyoqXG4gKiBFRERTQSBzaWduYXR1cmUuXG4gKi9cbmNsYXNzIFNpZ25hdHVyZSB7XG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHI6IFBvaW50LCByZWFkb25seSBzOiBiaWdpbnQpIHtcbiAgICB0aGlzLmFzc2VydFZhbGlkaXR5KCk7XG4gIH1cblxuICBzdGF0aWMgZnJvbUhleChoZXg6IEhleCkge1xuICAgIGNvbnN0IGJ5dGVzID0gZW5zdXJlQnl0ZXMoaGV4LCA2NCk7XG4gICAgY29uc3QgciA9IFBvaW50LmZyb21IZXgoYnl0ZXMuc2xpY2UoMCwgMzIpLCBmYWxzZSk7XG4gICAgY29uc3QgcyA9IGJ5dGVzVG9OdW1iZXJMRShieXRlcy5zbGljZSgzMiwgNjQpKTtcbiAgICByZXR1cm4gbmV3IFNpZ25hdHVyZShyLCBzKTtcbiAgfVxuXG4gIGFzc2VydFZhbGlkaXR5KCkge1xuICAgIGNvbnN0IHsgciwgcyB9ID0gdGhpcztcbiAgICBpZiAoIShyIGluc3RhbmNlb2YgUG9pbnQpKSB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIFBvaW50IGluc3RhbmNlJyk7XG4gICAgLy8gMCA8PSBzIDwgbFxuICAgIG5vcm1hbGl6ZVNjYWxhcihzLCBDVVJWRS5sLCBmYWxzZSk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICB0b1Jhd0J5dGVzKCkge1xuICAgIGNvbnN0IHU4ID0gbmV3IFVpbnQ4QXJyYXkoNjQpO1xuICAgIHU4LnNldCh0aGlzLnIudG9SYXdCeXRlcygpKTtcbiAgICB1OC5zZXQobnVtYmVyVG8zMkJ5dGVzTEUodGhpcy5zKSwgMzIpO1xuICAgIHJldHVybiB1ODtcbiAgfVxuXG4gIHRvSGV4KCkge1xuICAgIHJldHVybiBieXRlc1RvSGV4KHRoaXMudG9SYXdCeXRlcygpKTtcbiAgfVxufVxuXG5leHBvcnQgeyBFeHRlbmRlZFBvaW50LCBSaXN0cmV0dG9Qb2ludCwgUG9pbnQsIFNpZ25hdHVyZSB9O1xuXG5mdW5jdGlvbiBjb25jYXRCeXRlcyguLi5hcnJheXM6IFVpbnQ4QXJyYXlbXSk6IFVpbnQ4QXJyYXkge1xuICBpZiAoIWFycmF5cy5ldmVyeSgoYSkgPT4gYSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpKSB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIFVpbnQ4QXJyYXkgbGlzdCcpO1xuICBpZiAoYXJyYXlzLmxlbmd0aCA9PT0gMSkgcmV0dXJuIGFycmF5c1swXTtcbiAgY29uc3QgbGVuZ3RoID0gYXJyYXlzLnJlZHVjZSgoYSwgYXJyKSA9PiBhICsgYXJyLmxlbmd0aCwgMCk7XG4gIGNvbnN0IHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aCk7XG4gIGZvciAobGV0IGkgPSAwLCBwYWQgPSAwOyBpIDwgYXJyYXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYXJyID0gYXJyYXlzW2ldO1xuICAgIHJlc3VsdC5zZXQoYXJyLCBwYWQpO1xuICAgIHBhZCArPSBhcnIubGVuZ3RoO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIENvbnZlcnQgYmV0d2VlbiB0eXBlc1xuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5jb25zdCBoZXhlcyA9IEFycmF5LmZyb20oeyBsZW5ndGg6IDI1NiB9LCAodiwgaSkgPT4gaS50b1N0cmluZygxNikucGFkU3RhcnQoMiwgJzAnKSk7XG5mdW5jdGlvbiBieXRlc1RvSGV4KHVpbnQ4YTogVWludDhBcnJheSk6IHN0cmluZyB7XG4gIC8vIHByZS1jYWNoaW5nIGltcHJvdmVzIHRoZSBzcGVlZCA2eFxuICBpZiAoISh1aW50OGEgaW5zdGFuY2VvZiBVaW50OEFycmF5KSkgdGhyb3cgbmV3IEVycm9yKCdVaW50OEFycmF5IGV4cGVjdGVkJyk7XG4gIGxldCBoZXggPSAnJztcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB1aW50OGEubGVuZ3RoOyBpKyspIHtcbiAgICBoZXggKz0gaGV4ZXNbdWludDhhW2ldXTtcbiAgfVxuICByZXR1cm4gaGV4O1xufVxuXG4vLyBDYWNoaW5nIHNsb3dzIGl0IGRvd24gMi0zeFxuZnVuY3Rpb24gaGV4VG9CeXRlcyhoZXg6IHN0cmluZyk6IFVpbnQ4QXJyYXkge1xuICBpZiAodHlwZW9mIGhleCAhPT0gJ3N0cmluZycpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdoZXhUb0J5dGVzOiBleHBlY3RlZCBzdHJpbmcsIGdvdCAnICsgdHlwZW9mIGhleCk7XG4gIH1cbiAgaWYgKGhleC5sZW5ndGggJSAyKSB0aHJvdyBuZXcgRXJyb3IoJ2hleFRvQnl0ZXM6IHJlY2VpdmVkIGludmFsaWQgdW5wYWRkZWQgaGV4Jyk7XG4gIGNvbnN0IGFycmF5ID0gbmV3IFVpbnQ4QXJyYXkoaGV4Lmxlbmd0aCAvIDIpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgaiA9IGkgKiAyO1xuICAgIGNvbnN0IGhleEJ5dGUgPSBoZXguc2xpY2UoaiwgaiArIDIpO1xuICAgIGNvbnN0IGJ5dGUgPSBOdW1iZXIucGFyc2VJbnQoaGV4Qnl0ZSwgMTYpO1xuICAgIGlmIChOdW1iZXIuaXNOYU4oYnl0ZSkgfHwgYnl0ZSA8IDApIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBieXRlIHNlcXVlbmNlJyk7XG4gICAgYXJyYXlbaV0gPSBieXRlO1xuICB9XG4gIHJldHVybiBhcnJheTtcbn1cblxuZnVuY3Rpb24gbnVtYmVyVG8zMkJ5dGVzQkUobnVtOiBiaWdpbnQpIHtcbiAgY29uc3QgbGVuZ3RoID0gMzI7XG4gIGNvbnN0IGhleCA9IG51bS50b1N0cmluZygxNikucGFkU3RhcnQobGVuZ3RoICogMiwgJzAnKTtcbiAgcmV0dXJuIGhleFRvQnl0ZXMoaGV4KTtcbn1cblxuZnVuY3Rpb24gbnVtYmVyVG8zMkJ5dGVzTEUobnVtOiBiaWdpbnQpIHtcbiAgcmV0dXJuIG51bWJlclRvMzJCeXRlc0JFKG51bSkucmV2ZXJzZSgpO1xufVxuXG4vLyBMaXR0bGUtZW5kaWFuIGNoZWNrIGZvciBmaXJzdCBMRSBiaXQgKGxhc3QgQkUgYml0KTtcbmZ1bmN0aW9uIGVkSXNOZWdhdGl2ZShudW06IGJpZ2ludCkge1xuICByZXR1cm4gKG1vZChudW0pICYgXzFuKSA9PT0gXzFuO1xufVxuXG4vLyBMaXR0bGUgRW5kaWFuXG5mdW5jdGlvbiBieXRlc1RvTnVtYmVyTEUodWludDhhOiBVaW50OEFycmF5KTogYmlnaW50IHtcbiAgaWYgKCEodWludDhhIGluc3RhbmNlb2YgVWludDhBcnJheSkpIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgVWludDhBcnJheScpO1xuICByZXR1cm4gQmlnSW50KCcweCcgKyBieXRlc1RvSGV4KFVpbnQ4QXJyYXkuZnJvbSh1aW50OGEpLnJldmVyc2UoKSkpO1xufVxuXG5mdW5jdGlvbiBieXRlczI1NVRvTnVtYmVyTEUoYnl0ZXM6IFVpbnQ4QXJyYXkpOiBiaWdpbnQge1xuICByZXR1cm4gbW9kKGJ5dGVzVG9OdW1iZXJMRShieXRlcykgJiAoXzJuICoqIF8yNTVuIC0gXzFuKSk7XG59XG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmZ1bmN0aW9uIG1vZChhOiBiaWdpbnQsIGI6IGJpZ2ludCA9IENVUlZFLlApIHtcbiAgY29uc3QgcmVzID0gYSAlIGI7XG4gIHJldHVybiByZXMgPj0gXzBuID8gcmVzIDogYiArIHJlcztcbn1cblxuLy8gTm90ZTogdGhpcyBlZ2NkLWJhc2VkIGludmVydCBpcyA1MCUgZmFzdGVyIHRoYW4gcG93TW9kLWJhc2VkIG9uZS5cbi8vIEludmVyc2VzIG51bWJlciBvdmVyIG1vZHVsb1xuZnVuY3Rpb24gaW52ZXJ0KG51bWJlcjogYmlnaW50LCBtb2R1bG86IGJpZ2ludCA9IENVUlZFLlApOiBiaWdpbnQge1xuICBpZiAobnVtYmVyID09PSBfMG4gfHwgbW9kdWxvIDw9IF8wbikge1xuICAgIHRocm93IG5ldyBFcnJvcihgaW52ZXJ0OiBleHBlY3RlZCBwb3NpdGl2ZSBpbnRlZ2VycywgZ290IG49JHtudW1iZXJ9IG1vZD0ke21vZHVsb31gKTtcbiAgfVxuICAvLyBFdWNsZWRpYW4gR0NEIGh0dHBzOi8vYnJpbGxpYW50Lm9yZy93aWtpL2V4dGVuZGVkLWV1Y2xpZGVhbi1hbGdvcml0aG0vXG4gIGxldCBhID0gbW9kKG51bWJlciwgbW9kdWxvKTtcbiAgbGV0IGIgPSBtb2R1bG87XG4gIC8vIHByZXR0aWVyLWlnbm9yZVxuICBsZXQgeCA9IF8wbiwgeSA9IF8xbiwgdSA9IF8xbiwgdiA9IF8wbjtcbiAgd2hpbGUgKGEgIT09IF8wbikge1xuICAgIGNvbnN0IHEgPSBiIC8gYTtcbiAgICBjb25zdCByID0gYiAlIGE7XG4gICAgY29uc3QgbSA9IHggLSB1ICogcTtcbiAgICBjb25zdCBuID0geSAtIHYgKiBxO1xuICAgIC8vIHByZXR0aWVyLWlnbm9yZVxuICAgIGIgPSBhLCBhID0gciwgeCA9IHUsIHkgPSB2LCB1ID0gbSwgdiA9IG47XG4gIH1cbiAgY29uc3QgZ2NkID0gYjtcbiAgaWYgKGdjZCAhPT0gXzFuKSB0aHJvdyBuZXcgRXJyb3IoJ2ludmVydDogZG9lcyBub3QgZXhpc3QnKTtcbiAgcmV0dXJuIG1vZCh4LCBtb2R1bG8pO1xufVxuXG4vKipcbiAqIFRha2VzIGEgbGlzdCBvZiBudW1iZXJzLCBlZmZpY2llbnRseSBpbnZlcnRzIGFsbCBvZiB0aGVtLlxuICogQHBhcmFtIG51bXMgbGlzdCBvZiBiaWdpbnRzXG4gKiBAcGFyYW0gcCBtb2R1bG9cbiAqIEByZXR1cm5zIGxpc3Qgb2YgaW52ZXJ0ZWQgYmlnaW50c1xuICogQGV4YW1wbGVcbiAqIGludmVydEJhdGNoKFsxbiwgMm4sIDRuXSwgMjFuKTtcbiAqIC8vID0+IFsxbiwgMTFuLCAxNm5dXG4gKi9cbmZ1bmN0aW9uIGludmVydEJhdGNoKG51bXM6IGJpZ2ludFtdLCBwOiBiaWdpbnQgPSBDVVJWRS5QKTogYmlnaW50W10ge1xuICBjb25zdCB0bXAgPSBuZXcgQXJyYXkobnVtcy5sZW5ndGgpO1xuICAvLyBXYWxrIGZyb20gZmlyc3QgdG8gbGFzdCwgbXVsdGlwbHkgdGhlbSBieSBlYWNoIG90aGVyIE1PRCBwXG4gIGNvbnN0IGxhc3RNdWx0aXBsaWVkID0gbnVtcy5yZWR1Y2UoKGFjYywgbnVtLCBpKSA9PiB7XG4gICAgaWYgKG51bSA9PT0gXzBuKSByZXR1cm4gYWNjO1xuICAgIHRtcFtpXSA9IGFjYztcbiAgICByZXR1cm4gbW9kKGFjYyAqIG51bSwgcCk7XG4gIH0sIF8xbik7XG4gIC8vIEludmVydCBsYXN0IGVsZW1lbnRcbiAgY29uc3QgaW52ZXJ0ZWQgPSBpbnZlcnQobGFzdE11bHRpcGxpZWQsIHApO1xuICAvLyBXYWxrIGZyb20gbGFzdCB0byBmaXJzdCwgbXVsdGlwbHkgdGhlbSBieSBpbnZlcnRlZCBlYWNoIG90aGVyIE1PRCBwXG4gIG51bXMucmVkdWNlUmlnaHQoKGFjYywgbnVtLCBpKSA9PiB7XG4gICAgaWYgKG51bSA9PT0gXzBuKSByZXR1cm4gYWNjO1xuICAgIHRtcFtpXSA9IG1vZChhY2MgKiB0bXBbaV0sIHApO1xuICAgIHJldHVybiBtb2QoYWNjICogbnVtLCBwKTtcbiAgfSwgaW52ZXJ0ZWQpO1xuICByZXR1cm4gdG1wO1xufVxuXG4vLyBEb2VzIHggXiAoMiBeIHBvd2VyKSBtb2QgcC4gcG93MigzMCwgNCkgPT0gMzAgXiAoMiBeIDQpXG5mdW5jdGlvbiBwb3cyKHg6IGJpZ2ludCwgcG93ZXI6IGJpZ2ludCk6IGJpZ2ludCB7XG4gIGNvbnN0IHsgUCB9ID0gQ1VSVkU7XG4gIGxldCByZXMgPSB4O1xuICB3aGlsZSAocG93ZXItLSA+IF8wbikge1xuICAgIHJlcyAqPSByZXM7XG4gICAgcmVzICU9IFA7XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cblxuLy8gUG93ZXIgdG8gKHAtNSkvOCBha2EgeF4oMl4yNTItMylcbi8vIFVzZWQgdG8gY2FsY3VsYXRlIHkgLSB0aGUgc3F1YXJlIHJvb3Qgb2YgecKyLlxuLy8gRXhwb25lbnRpYXRlcyBpdCB0byB2ZXJ5IGJpZyBudW1iZXIuXG4vLyBXZSBhcmUgdW53cmFwcGluZyB0aGUgbG9vcCBiZWNhdXNlIGl0J3MgMnggZmFzdGVyLlxuLy8gKDJuKioyNTJuLTNuKS50b1N0cmluZygyKSB3b3VsZCBwcm9kdWNlIGJpdHMgWzI1MHggMSwgMCwgMV1cbi8vIFdlIGFyZSBtdWx0aXBseWluZyBpdCBiaXQtYnktYml0XG5mdW5jdGlvbiBwb3dfMl8yNTJfMyh4OiBiaWdpbnQpIHtcbiAgY29uc3QgeyBQIH0gPSBDVVJWRTtcbiAgY29uc3QgXzVuID0gQmlnSW50KDUpO1xuICBjb25zdCBfMTBuID0gQmlnSW50KDEwKTtcbiAgY29uc3QgXzIwbiA9IEJpZ0ludCgyMCk7XG4gIGNvbnN0IF80MG4gPSBCaWdJbnQoNDApO1xuICBjb25zdCBfODBuID0gQmlnSW50KDgwKTtcbiAgY29uc3QgeDIgPSAoeCAqIHgpICUgUDtcbiAgY29uc3QgYjIgPSAoeDIgKiB4KSAlIFA7IC8vIHheMywgMTFcbiAgY29uc3QgYjQgPSAocG93MihiMiwgXzJuKSAqIGIyKSAlIFA7IC8vIHheMTUsIDExMTFcbiAgY29uc3QgYjUgPSAocG93MihiNCwgXzFuKSAqIHgpICUgUDsgLy8geF4zMVxuICBjb25zdCBiMTAgPSAocG93MihiNSwgXzVuKSAqIGI1KSAlIFA7XG4gIGNvbnN0IGIyMCA9IChwb3cyKGIxMCwgXzEwbikgKiBiMTApICUgUDtcbiAgY29uc3QgYjQwID0gKHBvdzIoYjIwLCBfMjBuKSAqIGIyMCkgJSBQO1xuICBjb25zdCBiODAgPSAocG93MihiNDAsIF80MG4pICogYjQwKSAlIFA7XG4gIGNvbnN0IGIxNjAgPSAocG93MihiODAsIF84MG4pICogYjgwKSAlIFA7XG4gIGNvbnN0IGIyNDAgPSAocG93MihiMTYwLCBfODBuKSAqIGI4MCkgJSBQO1xuICBjb25zdCBiMjUwID0gKHBvdzIoYjI0MCwgXzEwbikgKiBiMTApICUgUDtcbiAgY29uc3QgcG93X3BfNV84ID0gKHBvdzIoYjI1MCwgXzJuKSAqIHgpICUgUDtcbiAgLy8gXiBUbyBwb3cgdG8gKHArMykvOCwgbXVsdGlwbHkgaXQgYnkgeC5cbiAgcmV0dXJuIHsgcG93X3BfNV84LCBiMiB9O1xufVxuXG4vLyBSYXRpbyBvZiB1IHRvIHYuIEFsbG93cyB1cyB0byBjb21iaW5lIGludmVyc2lvbiBhbmQgc3F1YXJlIHJvb3QuIFVzZXMgYWxnbyBmcm9tIFJGQzgwMzIgNS4xLjMuXG4vLyBDb25zdGFudC10aW1lXG4vLyBwcmV0dGllci1pZ25vcmVcbmZ1bmN0aW9uIHV2UmF0aW8odTogYmlnaW50LCB2OiBiaWdpbnQpOiB7IGlzVmFsaWQ6IGJvb2xlYW4sIHZhbHVlOiBiaWdpbnQgfSB7XG4gIGNvbnN0IHYzID0gbW9kKHYgKiB2ICogdik7ICAgICAgICAgICAgICAgICAgLy8gdsKzXG4gIGNvbnN0IHY3ID0gbW9kKHYzICogdjMgKiB2KTsgICAgICAgICAgICAgICAgLy8gduKBt1xuICBjb25zdCBwb3cgPSBwb3dfMl8yNTJfMyh1ICogdjcpLnBvd19wXzVfODtcbiAgbGV0IHggPSBtb2QodSAqIHYzICogcG93KTsgICAgICAgICAgICAgICAgICAvLyAodXbCsykodXbigbcpXihwLTUpLzhcbiAgY29uc3QgdngyID0gbW9kKHYgKiB4ICogeCk7ICAgICAgICAgICAgICAgICAvLyB2eMKyXG4gIGNvbnN0IHJvb3QxID0geDsgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmlyc3Qgcm9vdCBjYW5kaWRhdGVcbiAgY29uc3Qgcm9vdDIgPSBtb2QoeCAqIFNRUlRfTTEpOyAgICAgICAgICAgICAvLyBTZWNvbmQgcm9vdCBjYW5kaWRhdGVcbiAgY29uc3QgdXNlUm9vdDEgPSB2eDIgPT09IHU7ICAgICAgICAgICAgICAgICAvLyBJZiB2eMKyID0gdSAobW9kIHApLCB4IGlzIGEgc3F1YXJlIHJvb3RcbiAgY29uc3QgdXNlUm9vdDIgPSB2eDIgPT09IG1vZCgtdSk7ICAgICAgICAgICAvLyBJZiB2eMKyID0gLXUsIHNldCB4IDwtLSB4ICogMl4oKHAtMSkvNClcbiAgY29uc3Qgbm9Sb290ID0gdngyID09PSBtb2QoLXUgKiBTUVJUX00xKTsgICAvLyBUaGVyZSBpcyBubyB2YWxpZCByb290LCB2eMKyID0gLXXiiJooLTEpXG4gIGlmICh1c2VSb290MSkgeCA9IHJvb3QxO1xuICBpZiAodXNlUm9vdDIgfHwgbm9Sb290KSB4ID0gcm9vdDI7ICAgICAgICAgIC8vIFdlIHJldHVybiByb290MiBhbnl3YXksIGZvciBjb25zdC10aW1lXG4gIGlmIChlZElzTmVnYXRpdmUoeCkpIHggPSBtb2QoLXgpO1xuICByZXR1cm4geyBpc1ZhbGlkOiB1c2VSb290MSB8fCB1c2VSb290MiwgdmFsdWU6IHggfTtcbn1cblxuLy8gQ2FsY3VsYXRlcyAxL+KImihudW1iZXIpXG5mdW5jdGlvbiBpbnZlcnRTcXJ0KG51bWJlcjogYmlnaW50KSB7XG4gIHJldHVybiB1dlJhdGlvKF8xbiwgbnVtYmVyKTtcbn1cbi8vIE1hdGggZW5kXG5cbi8vIExpdHRsZS1lbmRpYW4gU0hBNTEyIHdpdGggbW9kdWxvIG5cbmFzeW5jIGZ1bmN0aW9uIHNoYTUxMk1vZHFMRSguLi5hcmdzOiBVaW50OEFycmF5W10pOiBQcm9taXNlPGJpZ2ludD4ge1xuICBjb25zdCBoYXNoID0gYXdhaXQgdXRpbHMuc2hhNTEyKGNvbmNhdEJ5dGVzKC4uLmFyZ3MpKTtcbiAgY29uc3QgdmFsdWUgPSBieXRlc1RvTnVtYmVyTEUoaGFzaCk7XG4gIHJldHVybiBtb2QodmFsdWUsIENVUlZFLmwpO1xufVxuXG5mdW5jdGlvbiBlcXVhbEJ5dGVzKGIxOiBVaW50OEFycmF5LCBiMjogVWludDhBcnJheSkge1xuICAvLyBXZSBkb24ndCBjYXJlIGFib3V0IHRpbWluZyBhdHRhY2tzIGhlcmVcbiAgaWYgKGIxLmxlbmd0aCAhPT0gYjIubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYjEubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoYjFbaV0gIT09IGIyW2ldKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBlbnN1cmVCeXRlcyhoZXg6IEhleCwgZXhwZWN0ZWRMZW5ndGg/OiBudW1iZXIpOiBVaW50OEFycmF5IHtcbiAgLy8gVWludDhBcnJheS5mcm9tKCkgaW5zdGVhZCBvZiBoYXNoLnNsaWNlKCkgYmVjYXVzZSBub2RlLmpzIEJ1ZmZlclxuICAvLyBpcyBpbnN0YW5jZSBvZiBVaW50OEFycmF5LCBhbmQgaXRzIHNsaWNlKCkgY3JlYXRlcyAqKm11dGFibGUqKiBjb3B5XG4gIGNvbnN0IGJ5dGVzID0gaGV4IGluc3RhbmNlb2YgVWludDhBcnJheSA/IFVpbnQ4QXJyYXkuZnJvbShoZXgpIDogaGV4VG9CeXRlcyhoZXgpO1xuICBpZiAodHlwZW9mIGV4cGVjdGVkTGVuZ3RoID09PSAnbnVtYmVyJyAmJiBieXRlcy5sZW5ndGggIT09IGV4cGVjdGVkTGVuZ3RoKVxuICAgIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgJHtleHBlY3RlZExlbmd0aH0gYnl0ZXNgKTtcbiAgcmV0dXJuIGJ5dGVzO1xufVxuXG4vKipcbiAqIENoZWNrcyBmb3IgbnVtIHRvIGJlIGluIHJhbmdlOlxuICogRm9yIHN0cmljdCA9PSB0cnVlOiAgYDAgPCAgbnVtIDwgbWF4YC5cbiAqIEZvciBzdHJpY3QgPT0gZmFsc2U6IGAwIDw9IG51bSA8IG1heGAuXG4gKiBDb252ZXJ0cyBub24tZmxvYXQgc2FmZSBudW1iZXJzIHRvIGJpZ2ludHMuXG4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZVNjYWxhcihudW06IG51bWJlciB8IGJpZ2ludCwgbWF4OiBiaWdpbnQsIHN0cmljdCA9IHRydWUpOiBiaWdpbnQge1xuICBpZiAoIW1heCkgdGhyb3cgbmV3IFR5cGVFcnJvcignU3BlY2lmeSBtYXggdmFsdWUnKTtcbiAgaWYgKHR5cGVvZiBudW0gPT09ICdudW1iZXInICYmIE51bWJlci5pc1NhZmVJbnRlZ2VyKG51bSkpIG51bSA9IEJpZ0ludChudW0pO1xuICBpZiAodHlwZW9mIG51bSA9PT0gJ2JpZ2ludCcgJiYgbnVtIDwgbWF4KSB7XG4gICAgaWYgKHN0cmljdCkge1xuICAgICAgaWYgKF8wbiA8IG51bSkgcmV0dXJuIG51bTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKF8wbiA8PSBudW0pIHJldHVybiBudW07XG4gICAgfVxuICB9XG4gIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIHZhbGlkIHNjYWxhcjogMCA8IHNjYWxhciA8IG1heCcpO1xufVxuXG5mdW5jdGlvbiBhZGp1c3RCeXRlczI1NTE5KGJ5dGVzOiBVaW50OEFycmF5KTogVWludDhBcnJheSB7XG4gIC8vIFNlY3Rpb24gNTogRm9yIFgyNTUxOSwgaW4gb3JkZXIgdG8gZGVjb2RlIDMyIHJhbmRvbSBieXRlcyBhcyBhbiBpbnRlZ2VyIHNjYWxhcixcbiAgLy8gc2V0IHRoZSB0aHJlZSBsZWFzdCBzaWduaWZpY2FudCBiaXRzIG9mIHRoZSBmaXJzdCBieXRlXG4gIGJ5dGVzWzBdICY9IDI0ODsgLy8gMGIxMTExXzEwMDBcbiAgLy8gYW5kIHRoZSBtb3N0IHNpZ25pZmljYW50IGJpdCBvZiB0aGUgbGFzdCB0byB6ZXJvLFxuICBieXRlc1szMV0gJj0gMTI3OyAvLyAwYjAxMTFfMTExMVxuICAvLyBzZXQgdGhlIHNlY29uZCBtb3N0IHNpZ25pZmljYW50IGJpdCBvZiB0aGUgbGFzdCBieXRlIHRvIDFcbiAgYnl0ZXNbMzFdIHw9IDY0OyAvLyAwYjAxMDBfMDAwMFxuICByZXR1cm4gYnl0ZXM7XG59XG5cbmZ1bmN0aW9uIGRlY29kZVNjYWxhcjI1NTE5KG46IEhleCk6IGJpZ2ludCB7XG4gIC8vIGFuZCwgZmluYWxseSwgZGVjb2RlIGFzIGxpdHRsZS1lbmRpYW4uXG4gIC8vIFRoaXMgbWVhbnMgdGhhdCB0aGUgcmVzdWx0aW5nIGludGVnZXIgaXMgb2YgdGhlIGZvcm0gMiBeIDI1NCBwbHVzIGVpZ2h0IHRpbWVzIGEgdmFsdWUgYmV0d2VlbiAwIGFuZCAyIF4gMjUxIC0gMShpbmNsdXNpdmUpLlxuICByZXR1cm4gYnl0ZXNUb051bWJlckxFKGFkanVzdEJ5dGVzMjU1MTkoZW5zdXJlQnl0ZXMobiwgMzIpKSk7XG59XG5cbi8vIFByaXZhdGUgY29udmVuaWVuY2UgbWV0aG9kXG4vLyBSRkM4MDMyIDUuMS41XG5hc3luYyBmdW5jdGlvbiBnZXRFeHRlbmRlZFB1YmxpY0tleShrZXk6IFByaXZLZXkpIHtcbiAgLy8gTm9ybWFsaXplIGJpZ2ludCAvIG51bWJlciAvIHN0cmluZyB0byBVaW50OEFycmF5XG4gIGtleSA9XG4gICAgdHlwZW9mIGtleSA9PT0gJ2JpZ2ludCcgfHwgdHlwZW9mIGtleSA9PT0gJ251bWJlcidcbiAgICAgID8gbnVtYmVyVG8zMkJ5dGVzQkUobm9ybWFsaXplU2NhbGFyKGtleSwgTUFYXzI1NkIpKVxuICAgICAgOiBlbnN1cmVCeXRlcyhrZXkpO1xuICBpZiAoa2V5Lmxlbmd0aCAhPT0gMzIpIHRocm93IG5ldyBFcnJvcihgRXhwZWN0ZWQgMzIgYnl0ZXNgKTtcbiAgLy8gaGFzaCB0byBwcm9kdWNlIDY0IGJ5dGVzXG4gIGNvbnN0IGhhc2hlZCA9IGF3YWl0IHV0aWxzLnNoYTUxMihrZXkpO1xuICAvLyBGaXJzdCAzMiBieXRlcyBvZiA2NGIgdW5pZm9ybWluZ2x5IHJhbmRvbSBpbnB1dCBhcmUgdGFrZW4sXG4gIC8vIGNsZWFycyAzIGJpdHMgb2YgaXQgdG8gcHJvZHVjZSBhIHJhbmRvbSBmaWVsZCBlbGVtZW50LlxuICBjb25zdCBoZWFkID0gYWRqdXN0Qnl0ZXMyNTUxOShoYXNoZWQuc2xpY2UoMCwgMzIpKTtcbiAgLy8gU2Vjb25kIDMyIGJ5dGVzIGlzIGNhbGxlZCBrZXkgcHJlZml4ICg1LjEuNilcbiAgY29uc3QgcHJlZml4ID0gaGFzaGVkLnNsaWNlKDMyLCA2NCk7XG4gIC8vIFRoZSBhY3R1YWwgcHJpdmF0ZSBzY2FsYXJcbiAgY29uc3Qgc2NhbGFyID0gbW9kKGJ5dGVzVG9OdW1iZXJMRShoZWFkKSwgQ1VSVkUubCk7XG4gIC8vIFBvaW50IG9uIEVkd2FyZHMgY3VydmUgYWthIHB1YmxpYyBrZXlcbiAgY29uc3QgcG9pbnQgPSBQb2ludC5CQVNFLm11bHRpcGx5KHNjYWxhcik7XG4gIGNvbnN0IHBvaW50Qnl0ZXMgPSBwb2ludC50b1Jhd0J5dGVzKCk7XG4gIHJldHVybiB7IGhlYWQsIHByZWZpeCwgc2NhbGFyLCBwb2ludCwgcG9pbnRCeXRlcyB9O1xufVxuXG4vL1xuLyoqXG4gKiBDYWxjdWxhdGVzIGVkMjU1MTkgcHVibGljIGtleS5cbiAqIDEuIHByaXZhdGUga2V5IGlzIGhhc2hlZCB3aXRoIHNoYTUxMiwgdGhlbiBmaXJzdCAzMiBieXRlcyBhcmUgdGFrZW4gZnJvbSB0aGUgaGFzaFxuICogMi4gMyBsZWFzdCBzaWduaWZpY2FudCBiaXRzIG9mIHRoZSBmaXJzdCBieXRlIGFyZSBjbGVhcmVkXG4gKiBSRkM4MDMyIDUuMS41XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRQdWJsaWNLZXkocHJpdmF0ZUtleTogUHJpdktleSk6IFByb21pc2U8VWludDhBcnJheT4ge1xuICByZXR1cm4gKGF3YWl0IGdldEV4dGVuZGVkUHVibGljS2V5KHByaXZhdGVLZXkpKS5wb2ludEJ5dGVzO1xufVxuXG4vKipcbiAqIFNpZ25zIG1lc3NhZ2Ugd2l0aCBwcml2YXRlS2V5LlxuICogUkZDODAzMiA1LjEuNlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2lnbihtZXNzYWdlOiBIZXgsIHByaXZhdGVLZXk6IEhleCk6IFByb21pc2U8VWludDhBcnJheT4ge1xuICBtZXNzYWdlID0gZW5zdXJlQnl0ZXMobWVzc2FnZSk7XG4gIGNvbnN0IHsgcHJlZml4LCBzY2FsYXIsIHBvaW50Qnl0ZXMgfSA9IGF3YWl0IGdldEV4dGVuZGVkUHVibGljS2V5KHByaXZhdGVLZXkpO1xuICBjb25zdCByID0gYXdhaXQgc2hhNTEyTW9kcUxFKHByZWZpeCwgbWVzc2FnZSk7IC8vIHIgPSBoYXNoKHByZWZpeCArIG1zZylcbiAgY29uc3QgUiA9IFBvaW50LkJBU0UubXVsdGlwbHkocik7IC8vIFIgPSByR1xuICBjb25zdCBrID0gYXdhaXQgc2hhNTEyTW9kcUxFKFIudG9SYXdCeXRlcygpLCBwb2ludEJ5dGVzLCBtZXNzYWdlKTsgLy8gayA9IGhhc2goUiArIFAgKyBtc2cpXG4gIGNvbnN0IHMgPSBtb2QociArIGsgKiBzY2FsYXIsIENVUlZFLmwpOyAvLyBzID0gciArIGtwXG4gIHJldHVybiBuZXcgU2lnbmF0dXJlKFIsIHMpLnRvUmF3Qnl0ZXMoKTtcbn1cblxuLyoqXG4gKiBWZXJpZmllcyBlZDI1NTE5IHNpZ25hdHVyZSBhZ2FpbnN0IG1lc3NhZ2UgYW5kIHB1YmxpYyBrZXkuXG4gKiBBbiBleHRlbmRlZCBncm91cCBlcXVhdGlvbiBpcyBjaGVja2VkLlxuICogUkZDODAzMiA1LjEuN1xuICogQ29tcGxpYW50IHdpdGggWklQMjE1OlxuICogMCA8PSBzaWcuUi9wdWJsaWNLZXkgPCAyKioyNTYgKGNhbiBiZSA+PSBjdXJ2ZS5QKVxuICogMCA8PSBzaWcucyA8IGxcbiAqIE5vdCBjb21wbGlhbnQgd2l0aCBSRkM4MDMyOiBpdCdzIG5vdCBwb3NzaWJsZSB0byBjb21wbHkgdG8gYm90aCBaSVAgJiBSRkMgYXQgdGhlIHNhbWUgdGltZS5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHZlcmlmeShzaWc6IFNpZ1R5cGUsIG1lc3NhZ2U6IEhleCwgcHVibGljS2V5OiBQdWJLZXkpOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgbWVzc2FnZSA9IGVuc3VyZUJ5dGVzKG1lc3NhZ2UpO1xuICAvLyBXaGVuIGhleCBpcyBwYXNzZWQsIHdlIGNoZWNrIHB1YmxpYyBrZXkgZnVsbHkuXG4gIC8vIFdoZW4gUG9pbnQgaW5zdGFuY2UgaXMgcGFzc2VkLCB3ZSBhc3N1bWUgaXQgaGFzIGFscmVhZHkgYmVlbiBjaGVja2VkLCBmb3IgcGVyZm9ybWFuY2UuXG4gIC8vIElmIHVzZXIgcGFzc2VzIFBvaW50L1NpZyBpbnN0YW5jZSwgd2UgYXNzdW1lIGl0IGhhcyBiZWVuIGFscmVhZHkgdmVyaWZpZWQuXG4gIC8vIFdlIGRvbid0IGNoZWNrIGl0cyBlcXVhdGlvbnMgZm9yIHBlcmZvcm1hbmNlLiBXZSBkbyBjaGVjayBmb3IgdmFsaWQgYm91bmRzIGZvciBzIHRob3VnaFxuICAvLyBXZSBhbHdheXMgY2hlY2sgZm9yOiBhKSBzIGJvdW5kcy4gYikgaGV4IHZhbGlkaXR5XG4gIGlmICghKHB1YmxpY0tleSBpbnN0YW5jZW9mIFBvaW50KSkgcHVibGljS2V5ID0gUG9pbnQuZnJvbUhleChwdWJsaWNLZXksIGZhbHNlKTtcbiAgY29uc3QgeyByLCBzIH0gPSBzaWcgaW5zdGFuY2VvZiBTaWduYXR1cmUgPyBzaWcuYXNzZXJ0VmFsaWRpdHkoKSA6IFNpZ25hdHVyZS5mcm9tSGV4KHNpZyk7XG4gIGNvbnN0IFNCID0gRXh0ZW5kZWRQb2ludC5CQVNFLm11bHRpcGx5VW5zYWZlKHMpO1xuICBjb25zdCBrID0gYXdhaXQgc2hhNTEyTW9kcUxFKHIudG9SYXdCeXRlcygpLCBwdWJsaWNLZXkudG9SYXdCeXRlcygpLCBtZXNzYWdlKTtcbiAgY29uc3Qga0EgPSBFeHRlbmRlZFBvaW50LmZyb21BZmZpbmUocHVibGljS2V5KS5tdWx0aXBseVVuc2FmZShrKTtcbiAgY29uc3QgUmtBID0gRXh0ZW5kZWRQb2ludC5mcm9tQWZmaW5lKHIpLmFkZChrQSk7XG4gIC8vIFs4XVtTXUIgPSBbOF1SICsgWzhdW2tdQSdcbiAgcmV0dXJuIFJrQS5zdWJ0cmFjdChTQikubXVsdGlwbHlVbnNhZmUoQ1VSVkUuaCkuZXF1YWxzKEV4dGVuZGVkUG9pbnQuWkVSTyk7XG59XG5cbi8qKlxuICogQ2FsY3VsYXRlcyBYMjU1MTkgREggc2hhcmVkIHNlY3JldCBmcm9tIGVkMjU1MTkgcHJpdmF0ZSAmIHB1YmxpYyBrZXlzLlxuICogQ3VydmUyNTUxOSB1c2VkIGluIFgyNTUxOSBjb25zdW1lcyBwcml2YXRlIGtleXMgYXMtaXMsIHdoaWxlIGVkMjU1MTkgaGFzaGVzIHRoZW0gd2l0aCBzaGE1MTIuXG4gKiBXaGljaCBtZWFucyB3ZSB3aWxsIG5lZWQgdG8gbm9ybWFsaXplIGVkMjU1MTkgc2VlZHMgdG8gXCJoYXNoZWQgcmVwclwiLlxuICogQHBhcmFtIHByaXZhdGVLZXkgZWQyNTUxOSBwcml2YXRlIGtleVxuICogQHBhcmFtIHB1YmxpY0tleSBlZDI1NTE5IHB1YmxpYyBrZXlcbiAqIEByZXR1cm5zIFgyNTUxOSBzaGFyZWQga2V5XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRTaGFyZWRTZWNyZXQocHJpdmF0ZUtleTogUHJpdktleSwgcHVibGljS2V5OiBIZXgpOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcbiAgY29uc3QgeyBoZWFkIH0gPSBhd2FpdCBnZXRFeHRlbmRlZFB1YmxpY0tleShwcml2YXRlS2V5KTtcbiAgY29uc3QgdSA9IFBvaW50LmZyb21IZXgocHVibGljS2V5KS50b1gyNTUxOSgpO1xuICByZXR1cm4gY3VydmUyNTUxOS5zY2FsYXJNdWx0KGhlYWQsIHUpO1xufVxuXG4vLyBFbmFibGUgcHJlY29tcHV0ZXMuIFNsb3dzIGRvd24gZmlyc3QgcHVibGljS2V5IGNvbXB1dGF0aW9uIGJ5IDIwbXMuXG5Qb2ludC5CQVNFLl9zZXRXaW5kb3dTaXplKDgpO1xuXG4vLyBjdXJ2ZTI1NTE5LXJlbGF0ZWQgY29kZVxuLy8gQ3VydmUgZXF1YXRpb246IHZeMiA9IHVeMyArIEEqdV4yICsgdVxuLy8gaHR0cHM6Ly9kYXRhdHJhY2tlci5pZXRmLm9yZy9kb2MvaHRtbC9yZmM3NzQ4XG5cbi8vIGNzd2FwIGZyb20gUkZDNzc0OFxuZnVuY3Rpb24gY3N3YXAoc3dhcDogYmlnaW50LCB4XzI6IGJpZ2ludCwgeF8zOiBiaWdpbnQpOiBbYmlnaW50LCBiaWdpbnRdIHtcbiAgY29uc3QgZHVtbXkgPSBtb2Qoc3dhcCAqICh4XzIgLSB4XzMpKTtcbiAgeF8yID0gbW9kKHhfMiAtIGR1bW15KTtcbiAgeF8zID0gbW9kKHhfMyArIGR1bW15KTtcbiAgcmV0dXJuIFt4XzIsIHhfM107XG59XG5cbi8vIHgyNTUxOSBmcm9tIDRcbi8qKlxuICpcbiAqIEBwYXJhbSBwb2ludFUgdSBjb29yZGluYXRlICh4KSBvbiBNb250Z29tZXJ5IEN1cnZlIDI1NTE5XG4gKiBAcGFyYW0gc2NhbGFyIGJ5IHdoaWNoIHRoZSBwb2ludCB3b3VsZCBiZSBtdWx0aXBsaWVkXG4gKiBAcmV0dXJucyBuZXcgUG9pbnQgb24gTW9udGdvbWVyeSBjdXJ2ZVxuICovXG5mdW5jdGlvbiBtb250Z29tZXJ5TGFkZGVyKHBvaW50VTogYmlnaW50LCBzY2FsYXI6IGJpZ2ludCk6IGJpZ2ludCB7XG4gIGNvbnN0IHsgUCB9ID0gQ1VSVkU7XG4gIGNvbnN0IHUgPSBub3JtYWxpemVTY2FsYXIocG9pbnRVLCBQKTtcbiAgLy8gU2VjdGlvbiA1OiBJbXBsZW1lbnRhdGlvbnMgTVVTVCBhY2NlcHQgbm9uLWNhbm9uaWNhbCB2YWx1ZXMgYW5kIHByb2Nlc3MgdGhlbSBhc1xuICAvLyBpZiB0aGV5IGhhZCBiZWVuIHJlZHVjZWQgbW9kdWxvIHRoZSBmaWVsZCBwcmltZS5cbiAgY29uc3QgayA9IG5vcm1hbGl6ZVNjYWxhcihzY2FsYXIsIFApO1xuICAvLyBUaGUgY29uc3RhbnQgYTI0IGlzICg0ODY2NjIgLSAyKSAvIDQgPSAxMjE2NjUgZm9yIGN1cnZlMjU1MTkvWDI1NTE5XG4gIGNvbnN0IGEyNCA9IEJpZ0ludCgxMjE2NjUpO1xuICBjb25zdCB4XzEgPSB1O1xuICBsZXQgeF8yID0gXzFuO1xuICBsZXQgel8yID0gXzBuO1xuICBsZXQgeF8zID0gdTtcbiAgbGV0IHpfMyA9IF8xbjtcbiAgbGV0IHN3YXAgPSBfMG47XG4gIGxldCBzdzogW2JpZ2ludCwgYmlnaW50XTtcbiAgZm9yIChsZXQgdCA9IEJpZ0ludCgyNTUgLSAxKTsgdCA+PSBfMG47IHQtLSkge1xuICAgIGNvbnN0IGtfdCA9IChrID4+IHQpICYgXzFuO1xuICAgIHN3YXAgXj0ga190O1xuICAgIHN3ID0gY3N3YXAoc3dhcCwgeF8yLCB4XzMpO1xuICAgIHhfMiA9IHN3WzBdO1xuICAgIHhfMyA9IHN3WzFdO1xuICAgIHN3ID0gY3N3YXAoc3dhcCwgel8yLCB6XzMpO1xuICAgIHpfMiA9IHN3WzBdO1xuICAgIHpfMyA9IHN3WzFdO1xuICAgIHN3YXAgPSBrX3Q7XG5cbiAgICBjb25zdCBBID0geF8yICsgel8yO1xuICAgIGNvbnN0IEFBID0gbW9kKEEgKiBBKTtcbiAgICBjb25zdCBCID0geF8yIC0gel8yO1xuICAgIGNvbnN0IEJCID0gbW9kKEIgKiBCKTtcbiAgICBjb25zdCBFID0gQUEgLSBCQjtcbiAgICBjb25zdCBDID0geF8zICsgel8zO1xuICAgIGNvbnN0IEQgPSB4XzMgLSB6XzM7XG4gICAgY29uc3QgREEgPSBtb2QoRCAqIEEpO1xuICAgIGNvbnN0IENCID0gbW9kKEMgKiBCKTtcbiAgICB4XzMgPSBtb2QoKERBICsgQ0IpICoqIF8ybik7XG4gICAgel8zID0gbW9kKHhfMSAqIChEQSAtIENCKSAqKiBfMm4pO1xuICAgIHhfMiA9IG1vZChBQSAqIEJCKTtcbiAgICB6XzIgPSBtb2QoRSAqIChBQSArIG1vZChhMjQgKiBFKSkpO1xuICB9XG4gIHN3ID0gY3N3YXAoc3dhcCwgeF8yLCB4XzMpO1xuICB4XzIgPSBzd1swXTtcbiAgeF8zID0gc3dbMV07XG4gIHN3ID0gY3N3YXAoc3dhcCwgel8yLCB6XzMpO1xuICB6XzIgPSBzd1swXTtcbiAgel8zID0gc3dbMV07XG4gIGNvbnN0IHsgcG93X3BfNV84LCBiMiB9ID0gcG93XzJfMjUyXzMoel8yKTtcbiAgLy8geF4ocC0yKSBha2EgeF4oMl4yNTUtMjEpXG4gIGNvbnN0IHhwMiA9IG1vZChwb3cyKHBvd19wXzVfOCwgQmlnSW50KDMpKSAqIGIyKTtcbiAgcmV0dXJuIG1vZCh4XzIgKiB4cDIpO1xufVxuXG5mdW5jdGlvbiBlbmNvZGVVQ29vcmRpbmF0ZSh1OiBiaWdpbnQpOiBVaW50OEFycmF5IHtcbiAgcmV0dXJuIG51bWJlclRvMzJCeXRlc0xFKG1vZCh1LCBDVVJWRS5QKSk7XG59XG5cbmZ1bmN0aW9uIGRlY29kZVVDb29yZGluYXRlKHVFbmM6IEhleCk6IGJpZ2ludCB7XG4gIGNvbnN0IHUgPSBlbnN1cmVCeXRlcyh1RW5jLCAzMik7XG4gIC8vIFNlY3Rpb24gNTogV2hlbiByZWNlaXZpbmcgc3VjaCBhbiBhcnJheSwgaW1wbGVtZW50YXRpb25zIG9mIFgyNTUxOVxuICAvLyBNVVNUIG1hc2sgdGhlIG1vc3Qgc2lnbmlmaWNhbnQgYml0IGluIHRoZSBmaW5hbCBieXRlLlxuICB1WzMxXSAmPSAxMjc7IC8vIDBiMDExMV8xMTExXG4gIHJldHVybiBieXRlc1RvTnVtYmVyTEUodSk7XG59XG5cbmV4cG9ydCBjb25zdCBjdXJ2ZTI1NTE5ID0ge1xuICBCQVNFX1BPSU5UX1U6ICcwOTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwJyxcblxuICAvLyBjcnlwdG9fc2NhbGFybXVsdCBha2EgZ2V0U2hhcmVkU2VjcmV0XG4gIHNjYWxhck11bHQocHJpdmF0ZUtleTogSGV4LCBwdWJsaWNLZXk6IEhleCk6IFVpbnQ4QXJyYXkge1xuICAgIGNvbnN0IHUgPSBkZWNvZGVVQ29vcmRpbmF0ZShwdWJsaWNLZXkpO1xuICAgIGNvbnN0IHAgPSBkZWNvZGVTY2FsYXIyNTUxOShwcml2YXRlS2V5KTtcbiAgICBjb25zdCBwdSA9IG1vbnRnb21lcnlMYWRkZXIodSwgcCk7XG4gICAgLy8gVGhlIHJlc3VsdCB3YXMgbm90IGNvbnRyaWJ1dG9yeVxuICAgIC8vIGh0dHBzOi8vY3IueXAudG8vZWNkaC5odG1sI3ZhbGlkYXRlXG4gICAgaWYgKHB1ID09PSBfMG4pIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBwcml2YXRlIG9yIHB1YmxpYyBrZXkgcmVjZWl2ZWQnKTtcbiAgICByZXR1cm4gZW5jb2RlVUNvb3JkaW5hdGUocHUpO1xuICB9LFxuXG4gIC8vIGNyeXB0b19zY2FsYXJtdWx0X2Jhc2UgYWthIGdldFB1YmxpY0tleVxuICBzY2FsYXJNdWx0QmFzZShwcml2YXRlS2V5OiBIZXgpOiBVaW50OEFycmF5IHtcbiAgICByZXR1cm4gY3VydmUyNTUxOS5zY2FsYXJNdWx0KHByaXZhdGVLZXksIGN1cnZlMjU1MTkuQkFTRV9QT0lOVF9VKTtcbiAgfSxcbn07XG5cbi8vIEdsb2JhbCBzeW1ib2wgYXZhaWxhYmxlIGluIGJyb3dzZXJzIG9ubHkuIEVuc3VyZSB3ZSBkbyBub3QgZGVwZW5kIG9uIEB0eXBlcy9kb21cbmRlY2xhcmUgY29uc3Qgc2VsZjogUmVjb3JkPHN0cmluZywgYW55PiB8IHVuZGVmaW5lZDtcbmNvbnN0IGNyeXB0bzogeyBub2RlPzogYW55OyB3ZWI/OiBhbnkgfSA9IHtcbiAgbm9kZTogbm9kZUNyeXB0byxcbiAgd2ViOiB0eXBlb2Ygc2VsZiA9PT0gJ29iamVjdCcgJiYgJ2NyeXB0bycgaW4gc2VsZiA/IHNlbGYuY3J5cHRvIDogdW5kZWZpbmVkLFxufTtcblxuZXhwb3J0IGNvbnN0IHV0aWxzID0ge1xuICAvLyBUaGUgOC10b3JzaW9uIHN1Ymdyb3VwIOKEsDguXG4gIC8vIFRob3NlIGFyZSBcImJ1Z2d5XCIgcG9pbnRzLCBpZiB5b3UgbXVsdGlwbHkgdGhlbSBieSA4LCB5b3UnbGwgcmVjZWl2ZSBQb2ludC5aRVJPLlxuICAvLyBQb3J0ZWQgZnJvbSBjdXJ2ZTI1NTE5LWRhbGVrLlxuICBUT1JTSU9OX1NVQkdST1VQOiBbXG4gICAgJzAxMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAnLFxuICAgICdjNzE3NmE3MDNkNGRkODRmYmEzYzBiNzYwZDEwNjcwZjJhMjA1M2ZhMmMzOWNjYzY0ZWM3ZmQ3NzkyYWMwMzdhJyxcbiAgICAnMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA4MCcsXG4gICAgJzI2ZTg5NThmYzJiMjI3YjA0NWMzZjQ4OWYyZWY5OGYwZDVkZmFjMDVkM2M2MzMzOWIxMzgwMjg4NmQ1M2ZjMDUnLFxuICAgICdlY2ZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZjdmJyxcbiAgICAnMjZlODk1OGZjMmIyMjdiMDQ1YzNmNDg5ZjJlZjk4ZjBkNWRmYWMwNWQzYzYzMzM5YjEzODAyODg2ZDUzZmM4NScsXG4gICAgJzAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAnLFxuICAgICdjNzE3NmE3MDNkNGRkODRmYmEzYzBiNzYwZDEwNjcwZjJhMjA1M2ZhMmMzOWNjYzY0ZWM3ZmQ3NzkyYWMwM2ZhJyxcbiAgXSxcbiAgYnl0ZXNUb0hleCxcbiAgZ2V0RXh0ZW5kZWRQdWJsaWNLZXksXG4gIG1vZCxcbiAgaW52ZXJ0LFxuXG4gIC8qKlxuICAgKiBDYW4gdGFrZSA0MCBvciBtb3JlIGJ5dGVzIG9mIHVuaWZvcm0gaW5wdXQgZS5nLiBmcm9tIENTUFJORyBvciBLREZcbiAgICogYW5kIGNvbnZlcnQgdGhlbSBpbnRvIHByaXZhdGUgc2NhbGFyLCB3aXRoIHRoZSBtb2R1bG8gYmlhcyBiZWluZyBuZWdsaWJsZS5cbiAgICogQXMgcGVyIEZJUFMgMTg2IEIuMS4xLlxuICAgKiBAcGFyYW0gaGFzaCBoYXNoIG91dHB1dCBmcm9tIHNoYTUxMiwgb3IgYSBzaW1pbGFyIGZ1bmN0aW9uXG4gICAqIEByZXR1cm5zIHZhbGlkIHByaXZhdGUgc2NhbGFyXG4gICAqL1xuICBoYXNoVG9Qcml2YXRlU2NhbGFyOiAoaGFzaDogSGV4KTogYmlnaW50ID0+IHtcbiAgICBoYXNoID0gZW5zdXJlQnl0ZXMoaGFzaCk7XG4gICAgaWYgKGhhc2gubGVuZ3RoIDwgNDAgfHwgaGFzaC5sZW5ndGggPiAxMDI0KVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCA0MC0xMDI0IGJ5dGVzIG9mIHByaXZhdGUga2V5IGFzIHBlciBGSVBTIDE4NicpO1xuICAgIGNvbnN0IG51bSA9IG1vZChieXRlc1RvTnVtYmVyTEUoaGFzaCksIENVUlZFLmwpO1xuICAgIC8vIFRoaXMgc2hvdWxkIG5ldmVyIGhhcHBlblxuICAgIGlmIChudW0gPT09IF8wbiB8fCBudW0gPT09IF8xbikgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHByaXZhdGUga2V5Jyk7XG4gICAgcmV0dXJuIG51bTtcbiAgfSxcblxuICByYW5kb21CeXRlczogKGJ5dGVzTGVuZ3RoOiBudW1iZXIgPSAzMik6IFVpbnQ4QXJyYXkgPT4ge1xuICAgIGlmIChjcnlwdG8ud2ViKSB7XG4gICAgICByZXR1cm4gY3J5cHRvLndlYi5nZXRSYW5kb21WYWx1ZXMobmV3IFVpbnQ4QXJyYXkoYnl0ZXNMZW5ndGgpKTtcbiAgICB9IGVsc2UgaWYgKGNyeXB0by5ub2RlKSB7XG4gICAgICBjb25zdCB7IHJhbmRvbUJ5dGVzIH0gPSBjcnlwdG8ubm9kZTtcbiAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShyYW5kb21CeXRlcyhieXRlc0xlbmd0aCkuYnVmZmVyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGVudmlyb25tZW50IGRvZXNuJ3QgaGF2ZSByYW5kb21CeXRlcyBmdW5jdGlvblwiKTtcbiAgICB9XG4gIH0sXG4gIC8vIE5vdGU6IGVkMjU1MTkgcHJpdmF0ZSBrZXlzIGFyZSB1bmlmb3JtIDMyLWJpdCBzdHJpbmdzLiBXZSBkbyBub3QgbmVlZFxuICAvLyB0byBjaGVjayBmb3IgbW9kdWxvIGJpYXMgbGlrZSB3ZSBkbyBpbiBub2JsZS1zZWNwMjU2azEgcmFuZG9tUHJpdmF0ZUtleSgpXG4gIHJhbmRvbVByaXZhdGVLZXk6ICgpOiBVaW50OEFycmF5ID0+IHtcbiAgICByZXR1cm4gdXRpbHMucmFuZG9tQnl0ZXMoMzIpO1xuICB9LFxuICBzaGE1MTI6IGFzeW5jIChtZXNzYWdlOiBVaW50OEFycmF5KTogUHJvbWlzZTxVaW50OEFycmF5PiA9PiB7XG4gICAgaWYgKGNyeXB0by53ZWIpIHtcbiAgICAgIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IGNyeXB0by53ZWIuc3VidGxlLmRpZ2VzdCgnU0hBLTUxMicsIG1lc3NhZ2UuYnVmZmVyKTtcbiAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShidWZmZXIpO1xuICAgIH0gZWxzZSBpZiAoY3J5cHRvLm5vZGUpIHtcbiAgICAgIHJldHVybiBVaW50OEFycmF5LmZyb20oY3J5cHRvLm5vZGUuY3JlYXRlSGFzaCgnc2hhNTEyJykudXBkYXRlKG1lc3NhZ2UpLmRpZ2VzdCgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhlIGVudmlyb25tZW50IGRvZXNuJ3QgaGF2ZSBzaGE1MTIgZnVuY3Rpb25cIik7XG4gICAgfVxuICB9LFxuICAvKipcbiAgICogV2UncmUgZG9pbmcgc2NhbGFyIG11bHRpcGxpY2F0aW9uICh1c2VkIGluIGdldFB1YmxpY0tleSBldGMpIHdpdGggcHJlY29tcHV0ZWQgQkFTRV9QT0lOVFxuICAgKiB2YWx1ZXMuIFRoaXMgc2xvd3MgZG93biBmaXJzdCBnZXRQdWJsaWNLZXkoKSBieSBtaWxsaXNlY29uZHMgKHNlZSBTcGVlZCBzZWN0aW9uKSxcbiAgICogYnV0IGFsbG93cyB0byBzcGVlZC11cCBzdWJzZXF1ZW50IGdldFB1YmxpY0tleSgpIGNhbGxzIHVwIHRvIDIweC5cbiAgICogQHBhcmFtIHdpbmRvd1NpemUgMiwgNCwgOCwgMTZcbiAgICovXG4gIHByZWNvbXB1dGUod2luZG93U2l6ZSA9IDgsIHBvaW50ID0gUG9pbnQuQkFTRSk6IFBvaW50IHtcbiAgICBjb25zdCBjYWNoZWQgPSBwb2ludC5lcXVhbHMoUG9pbnQuQkFTRSkgPyBwb2ludCA6IG5ldyBQb2ludChwb2ludC54LCBwb2ludC55KTtcbiAgICBjYWNoZWQuX3NldFdpbmRvd1NpemUod2luZG93U2l6ZSk7XG4gICAgY2FjaGVkLm11bHRpcGx5KF8ybik7XG4gICAgcmV0dXJuIGNhY2hlZDtcbiAgfSxcbn07XG4iXX0=