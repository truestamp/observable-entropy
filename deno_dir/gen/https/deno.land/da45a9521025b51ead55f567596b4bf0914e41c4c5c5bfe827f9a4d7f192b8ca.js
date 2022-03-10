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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSx1RUFBdUU7QUFRdkUsT0FBTyxVQUFVLE1BQU0sUUFBUSxDQUFDO0FBR2hDLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0QixNQUFNLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEIsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RCLE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUMxQixNQUFNLFdBQVcsR0FBRyxHQUFHLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyx3Q0FBd0MsQ0FBQyxDQUFDO0FBUTFGLE1BQU0sS0FBSyxHQUFHO0lBRVosQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUdiLENBQUMsRUFBRSxNQUFNLENBQUMsK0VBQStFLENBQUM7SUFFMUYsQ0FBQyxFQUFFLEdBQUcsSUFBSSxLQUFLLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQztJQUU1QixDQUFDLEVBQUUsV0FBVztJQUNkLENBQUMsRUFBRSxXQUFXO0lBRWQsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFFWixFQUFFLEVBQUUsTUFBTSxDQUFDLCtFQUErRSxDQUFDO0lBQzNGLEVBQUUsRUFBRSxNQUFNLENBQUMsK0VBQStFLENBQUM7Q0FDNUYsQ0FBQztBQUdGLE9BQU8sRUFBRSxLQUFLLEVBQUUsQ0FBQztBQU9qQixNQUFNLFFBQVEsR0FBRyxHQUFHLElBQUksTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBR3BDLE1BQU0sT0FBTyxHQUFHLE1BQU0sQ0FDcEIsK0VBQStFLENBQ2hGLENBQUM7QUFFRixNQUFNLE1BQU0sR0FBRyxNQUFNLENBQ25CLDhFQUE4RSxDQUMvRSxDQUFDO0FBRUYsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQzlCLCtFQUErRSxDQUNoRixDQUFDO0FBRUYsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQzlCLCtFQUErRSxDQUNoRixDQUFDO0FBRUYsTUFBTSxjQUFjLEdBQUcsTUFBTSxDQUMzQiw4RUFBOEUsQ0FDL0UsQ0FBQztBQUVGLE1BQU0sY0FBYyxHQUFHLE1BQU0sQ0FDM0IsK0VBQStFLENBQ2hGLENBQUM7QUFPRixNQUFNLGFBQWE7SUFDSTtJQUFvQjtJQUFvQjtJQUFvQjtJQUFqRixZQUFxQixDQUFTLEVBQVcsQ0FBUyxFQUFXLENBQVMsRUFBVyxDQUFTO1FBQXJFLE1BQUMsR0FBRCxDQUFDLENBQVE7UUFBVyxNQUFDLEdBQUQsQ0FBQyxDQUFRO1FBQVcsTUFBQyxHQUFELENBQUMsQ0FBUTtRQUFXLE1BQUMsR0FBRCxDQUFDLENBQVE7SUFBRyxDQUFDO0lBRTlGLE1BQU0sQ0FBQyxJQUFJLEdBQUcsSUFBSSxhQUFhLENBQUMsS0FBSyxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNuRixNQUFNLENBQUMsSUFBSSxHQUFHLElBQUksYUFBYSxDQUFDLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3BELE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBUTtRQUN4QixJQUFJLENBQUMsQ0FBQyxDQUFDLFlBQVksS0FBSyxDQUFDLEVBQUU7WUFDekIsTUFBTSxJQUFJLFNBQVMsQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO1NBQ2pFO1FBQ0QsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFBRSxPQUFPLGFBQWEsQ0FBQyxJQUFJLENBQUM7UUFDcEQsT0FBTyxJQUFJLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFJRCxNQUFNLENBQUMsYUFBYSxDQUFDLE1BQXVCO1FBQzFDLE1BQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsRCxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDcEQsQ0FBQztJQUVELE1BQU0sQ0FBQyxVQUFVLENBQUMsTUFBdUI7UUFDdkMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUdELE1BQU0sQ0FBQyxLQUFvQjtRQUN6QixjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdEIsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ3JDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUN0QyxNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUM7UUFDMUIsTUFBTSxJQUFJLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUMxQixNQUFNLElBQUksR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLE9BQU8sSUFBSSxLQUFLLElBQUksSUFBSSxJQUFJLEtBQUssSUFBSSxDQUFDO0lBQ3hDLENBQUM7SUFHRCxNQUFNO1FBQ0osT0FBTyxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFLRCxNQUFNO1FBQ0osTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQ3JDLE1BQU0sRUFBRSxDQUFDLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFDcEIsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUN6QixNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDO1FBQ3pCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3BDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDckIsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDN0MsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNoQixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2hCLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDaEIsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN0QixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdEIsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN0QixPQUFPLElBQUksYUFBYSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFNRCxHQUFHLENBQUMsS0FBb0I7UUFDdEIsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBQzVDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBQzdDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDckIsSUFBSSxDQUFDLEtBQUssR0FBRztZQUFFLE9BQU8sSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQ3BDLE1BQU0sQ0FB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QUFDLE1BQU0sS0FBSyxDQUFDO1FBQUUsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDMUMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQzVELE1BQU0sTUFBTSxHQUFHLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3RDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7UUFDL0MsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3JCLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDO0tBQ25CO0lBQ0QsT0FBTyxNQUFNLENBQUM7QUFDaEIsQ0FBQztBQUlELE1BQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNyRixTQUFTLFVBQVUsQ0FBQyxNQUFrQjtJQUVwQyxJQUFJLENBQUMsQ0FBQyxNQUFNLFlBQVksVUFBVSxDQUFDO1FBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQzVFLElBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQztJQUNiLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1FB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QyxFQUFFLEdBQUcsS0FBSyxDQUFDO0lBQ3BCLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN0QixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDeEIsTUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3hCLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN4QixNQUFNLElBQUksR0FBRyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDeEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZCLE1BQU0sRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN4QixNQUFNLEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3BDLE1BQU0sRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDbkMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUFFLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNyQyxNQUFNLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3hDLE1BQU0sR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDeEMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN4QyxNQUFNLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3pDLE1BQU0sSUFBSSxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDMUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMxQyxNQUFNLFNBQVMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRTVDLE9BQU8sRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLENBQUM7QUFDM0IsQ0FBQztBQUtELFNBQVMsT0FBTyxDQUFDLENBQVMsRUFBRSxDQUFTO0lBQ25DLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzFCLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzVCLE1BQU0sR0FBRyxHQUFHLFdBQVcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDO0lBQzFDLElBQUksQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDO0lBQzFCLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQzNCLE1BQU0sS0FBSyxHQUFHLENBQUMsQ0FBQztJQUNoQixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDO0lBQy9CLE1BQU0sUUFBUSxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUM7SUFDM0IsTUFBTSxRQUFRLEdBQUcs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TSxHQUFHLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEdBQUcsR0FBRyxDQUFDO1FBQzNCLElBQUksSUFBSSxHQUFHLENBQUM7UUFDWixFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDM0IsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNaLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDWixFQUFFLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDM0IsR0FBRyxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNaLEdBQUcsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDWixJQUFJLEdBQUcsR0FBRyxDQUFDO1FBRVgsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNwQixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7UUFDcEIsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN0QixNQUFNLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBQ2xCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7UUFDcEIsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQztRQUNwQixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdEIsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUM1QixHQUFHLEdBQUcs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QUU7UUFDekQsSUFBSSxNQUFNLENBQUMsR0FBRyxFQUFFO1lBQ2QsTUFBTSxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN6RSxPQUFPLElBQUksVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQy9CO2FBQU0sSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFO1lBQ3RCLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztTQUNuRjthQUFNO1lBQ0wsTUFBTSxJQUFJLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO1NBQ2pFO0lBQ0gsQ0FBQztJQU9ELFVBQVUsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSTtRQUMzQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5RSxNQUFNLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDckIsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiEgbm9ibGUtZWQyNTUxOSAtIE1JVCBMaWNlbnNlIChjKSAyMDE5IFBhdWwgTWlsbGVyIChwYXVsbWlsbHIuY29tKSAqL1xuLy8gVGhhbmtzIERKQiBodHRwczovL2VkMjU1MTkuY3IueXAudG9cbi8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM3NzQ4IGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM4MDMyXG4vLyBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9FZERTQSBodHRwczovL3Jpc3RyZXR0by5ncm91cFxuLy8gaHR0cHM6Ly9kYXRhdHJhY2tlci5pZXRmLm9yZy9kb2MvaHRtbC9kcmFmdC1pcnRmLWNmcmctcmlzdHJldHRvMjU1LWRlY2FmNDQ4XG5cbi8vIFVzZXMgYnVpbHQtaW4gY3J5cHRvIG1vZHVsZSBmcm9tIG5vZGUuanMgdG8gZ2VuZXJhdGUgcmFuZG9tbmVzcyAvIGhtYWMtc2hhMjU2LlxuLy8gSW4gYnJvd3NlciB0aGUgbGluZSBpcyBhdXRvbWF0aWNhbGx5IHJlbW92ZWQgZHVyaW5nIGJ1aWxkIHRpbWU6IHVzZXMgY3J5cHRvLnN1YnRsZSBpbnN0ZWFkLlxuaW1wb3J0IG5vZGVDcnlwdG8gZnJvbSAnY3J5cHRvJztcblxuLy8gQmUgZnJpZW5kbHkgdG8gYmFkIEVDTUFTY3JpcHQgcGFyc2VycyBieSBub3QgdXNpbmcgYmlnaW50IGxpdGVyYWxzIGxpa2UgMTIzblxuY29uc3QgXzBuID0gQmlnSW50KDApO1xuY29uc3QgXzFuID0gQmlnSW50KDEpO1xuY29uc3QgXzJuID0gQmlnSW50KDIpO1xuY29uc3QgXzI1NW4gPSBCaWdJbnQoMjU1KTtcbmNvbnN0IENVUlZFX09SREVSID0gXzJuICoqIEJpZ0ludCgyNTIpICsgQmlnSW50KCcyNzc0MjMxNzc3NzM3MjM1MzUzNTg1MTkzNzc5MDg4MzY0ODQ5MycpO1xuXG4vKipcbiAqIGVkMjU1MTkgaXMgVHdpc3RlZCBFZHdhcmRzIGN1cnZlIHdpdGggZXF1YXRpb24gb2ZcbiAqIGBgYFxuICog4oiSeMKyICsgecKyID0gMSDiiJIgKDEyMTY2NS8xMjE2NjYpICogeMKyICogecKyXG4gKiBgYGBcbiAqL1xuY29uc3QgQ1VSVkUgPSB7XG4gIC8vIFBhcmFtOiBhXG4gIGE6IEJpZ0ludCgtMSksXG4gIC8vIEVxdWFsIHRvIC0xMjE2NjUvMTIxNjY2IG92ZXIgZmluaXRlIGZpZWxkLlxuICAvLyBOZWdhdGl2ZSBudW1iZXIgaXMgUCAtIG51bWJlciwgYW5kIGRpdmlzaW9uIGlzIGludmVydChudW1iZXIsIFApXG4gIGQ6IEJpZ0ludCgnMzcwOTU3MDU5MzQ2Njk0MzkzNDMxMzgwODM1MDg3NTQ1NjUxODk1NDIxMTM4Nzk4NDMyMTkwMTYzODg3ODU1MzMwODU5NDAyODM1NTUnKSxcbiAgLy8gRmluaXRlIGZpZWxkIO2gte20vXAgb3ZlciB3aGljaCB3ZSdsbCBkbyBjYWxjdWxhdGlvbnNcbiAgUDogXzJuICoqIF8yNTVuIC0gQmlnSW50KDE5KSxcbiAgLy8gU3ViZ3JvdXAgb3JkZXI6IGhvdyBtYW55IHBvaW50cyBlZDI1NTE5IGhhc1xuICBsOiBDVVJWRV9PUkRFUiwgLy8gaW4gcmZjODAzMiBpdCdzIGNhbGxlZCBsXG4gIG46IENVUlZFX09SREVSLCAvLyBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuICAvLyBDb2ZhY3RvclxuICBoOiBCaWdJbnQoOCksXG4gIC8vIEJhc2UgcG9pbnQgKHgsIHkpIGFrYSBnZW5lcmF0b3IgcG9pbnRcbiAgR3g6IEJpZ0ludCgnMTUxMTIyMjEzNDk1MzU0MDA3NzI1MDExNTE0MDk1ODg1MzE1MTE0NTQwMTI2OTMwNDE4NTcyMDYwNDYxMTMyODM5NDk4NDc3NjIyMDInKSxcbiAgR3k6IEJpZ0ludCgnNDYzMTY4MzU2OTQ5MjY0NzgxNjk0MjgzOTQwMDM0NzUxNjMxNDEzMDc5OTM4NjYyNTYyMjU2MTU3ODMwMzM2MDMxNjUyNTE4NTU5NjAnKSxcbn07XG5cbi8vIENsZWFuZXIgb3V0cHV0IHRoaXMgd2F5LlxuZXhwb3J0IHsgQ1VSVkUgfTtcblxudHlwZSBIZXggPSBVaW50OEFycmF5IHwgc3RyaW5nO1xudHlwZSBQcml2S2V5ID0gSGV4IHwgYmlnaW50IHwgbnVtYmVyO1xudHlwZSBQdWJLZXkgPSBIZXggfCBQb2ludDtcbnR5cGUgU2lnVHlwZSA9IEhleCB8IFNpZ25hdHVyZTtcblxuY29uc3QgTUFYXzI1NkIgPSBfMm4gKiogQmlnSW50KDI1Nik7XG5cbi8vIOKImigtMSkgYWthIOKImihhKSBha2EgMl4oKHAtMSkvNClcbmNvbnN0IFNRUlRfTTEgPSBCaWdJbnQoXG4gICcxOTY4MTE2MTM3NjcwNzUwNTk1NjgwNzA3OTMwNDk4ODU0MjAxNTQ0NjA2NjUxNTkyMzg5MDE2Mjc0NDAyMTA3MzEyMzgyOTc4NDc1Midcbik7XG4vLyDiiJpkIGFrYSBzcXJ0KC00ODY2NjQpXG5jb25zdCBTUVJUX0QgPSBCaWdJbnQoXG4gICc2ODUzNDc1MjE5NDk3NTYxNTgxNTc5MzU3MjcxMTk3NjI0NjQyNDgyNzkwMDc5Nzg1NjUwMTk3MDQ2OTU4MjE1Mjg5Njg3NjA0NzQyJ1xuKTtcbi8vIOKImihhZCAtIDEpXG5jb25zdCBTUVJUX0FEX01JTlVTX09ORSA9IEJpZ0ludChcbiAgJzI1MDYzMDY4OTUzMzg0NjIzNDc0MTExNDE0MTU4NzAyMTUyNzAxMjQ0NTMxNTAyNDkyNjU2NDYwMDc5MjEwNDgyNjEwNDMwNzUwMjM1J1xuKTtcbi8vIDEgLyDiiJooYS1kKVxuY29uc3QgSU5WU1FSVF9BX01JTlVTX0QgPSBCaWdJbnQoXG4gICc1NDQ2OTMwNzAwODkwOTMxNjkyMDk5NTgxMzg2ODc0NTE0MTYwNTM5MzU5NzI5MjkyNzQ1NjkyMTIwNTMxMjg5NjMxMTcyMTAxNzU3OCdcbik7XG4vLyAxLWTCslxuY29uc3QgT05FX01JTlVTX0RfU1EgPSBCaWdJbnQoXG4gICcxMTU5ODQzMDIxNjY4Nzc5ODc5MTkzNzc1NTIxODU1NTg2NjQ3OTM3MzU3NzU5NzE1NDE3NjU0NDM5ODc5NzIwODc2MTExODA2ODM4J1xuKTtcbi8vIChkLTEpwrJcbmNvbnN0IERfTUlOVVNfT05FX1NRID0gQmlnSW50KFxuICAnNDA0NDA4MzQzNDYzMDg1MzY4NTgxMDEwNDI0NjkzMjMxOTA4MjYyNDgzOTkxNDYyMzg3MDgzNTIyNDAxMzMyMjA4NjUxMzcyNjU5NTInXG4pO1xuXG4vKipcbiAqIEV4dGVuZGVkIFBvaW50IHdvcmtzIGluIGV4dGVuZGVkIGNvb3JkaW5hdGVzOiAoeCwgeSwgeiwgdCkg4oiLICh4PXgveiwgeT15L3osIHQ9eHkpLlxuICogRGVmYXVsdCBQb2ludCB3b3JrcyBpbiBhZmZpbmUgY29vcmRpbmF0ZXM6ICh4LCB5KVxuICogaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvVHdpc3RlZF9FZHdhcmRzX2N1cnZlI0V4dGVuZGVkX2Nvb3JkaW5hdGVzXG4gKi9cbmNsYXNzIEV4dGVuZGVkUG9pbnQge1xuICBjb25zdHJ1Y3RvcihyZWFkb25seSB4OiBiaWdpbnQsIHJlYWRvbmx5IHk6IGJpZ2ludCwgcmVhZG9ubHkgejogYmlnaW50LCByZWFkb25seSB0OiBiaWdpbnQpIHt9XG5cbiAgc3RhdGljIEJBU0UgPSBuZXcgRXh0ZW5kZWRQb2ludChDVVJWRS5HeCwgQ1VSVkUuR3ksIF8xbiwgbW9kKENVUlZFLkd4ICogQ1VSVkUuR3kpKTtcbiAgc3RhdGljIFpFUk8gPSBuZXcgRXh0ZW5kZWRQb2ludChfMG4sIF8xbiwgXzFuLCBfMG4pO1xuICBzdGF0aWMgZnJvbUFmZmluZShwOiBQb2ludCk6IEV4dGVuZGVkUG9pbnQge1xuICAgIGlmICghKHAgaW5zdGFuY2VvZiBQb2ludCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4dGVuZGVkUG9pbnQjZnJvbUFmZmluZTogZXhwZWN0ZWQgUG9pbnQnKTtcbiAgICB9XG4gICAgaWYgKHAuZXF1YWxzKFBvaW50LlpFUk8pKSByZXR1cm4gRXh0ZW5kZWRQb2ludC5aRVJPO1xuICAgIHJldHVybiBuZXcgRXh0ZW5kZWRQb2ludChwLngsIHAueSwgXzFuLCBtb2QocC54ICogcC55KSk7XG4gIH1cbiAgLy8gVGFrZXMgYSBidW5jaCBvZiBKYWNvYmlhbiBQb2ludHMgYnV0IGV4ZWN1dGVzIG9ubHkgb25lXG4gIC8vIGludmVydCBvbiBhbGwgb2YgdGhlbS4gaW52ZXJ0IGlzIHZlcnkgc2xvdyBvcGVyYXRpb24sXG4gIC8vIHNvIHRoaXMgaW1wcm92ZXMgcGVyZm9ybWFuY2UgbWFzc2l2ZWx5LlxuICBzdGF0aWMgdG9BZmZpbmVCYXRjaChwb2ludHM6IEV4dGVuZGVkUG9pbnRbXSk6IFBvaW50W10ge1xuICAgIGNvbnN0IHRvSW52ID0gaW52ZXJ0QmF0Y2gocG9pbnRzLm1hcCgocCkgPT4gcC56KSk7XG4gICAgcmV0dXJuIHBvaW50cy5tYXAoKHAsIGkpID0+IHAudG9BZmZpbmUodG9JbnZbaV0pKTtcbiAgfVxuXG4gIHN0YXRpYyBub3JtYWxpemVaKHBvaW50czogRXh0ZW5kZWRQb2ludFtdKTogRXh0ZW5kZWRQb2ludFtdIHtcbiAgICByZXR1cm4gdGhpcy50b0FmZmluZUJhdGNoKHBvaW50cykubWFwKHRoaXMuZnJvbUFmZmluZSk7XG4gIH1cblxuICAvLyBDb21wYXJlIG9uZSBwb2ludCB0byBhbm90aGVyLlxuICBlcXVhbHMob3RoZXI6IEV4dGVuZGVkUG9pbnQpOiBib29sZWFuIHtcbiAgICBhc3NlcnRFeHRQb2ludChvdGhlcik7XG4gICAgY29uc3QgeyB4OiBYMSwgeTogWTEsIHo6IFoxIH0gPSB0aGlzO1xuICAgIGNvbnN0IHsgeDogWDIsIHk6IFkyLCB6OiBaMiB9ID0gb3RoZXI7XG4gICAgY29uc3QgWDFaMiA9IG1vZChYMSAqIFoyKTtcbiAgICBjb25zdCBYMloxID0gbW9kKFgyICogWjEpO1xuICAgIGNvbnN0IFkxWjIgPSBtb2QoWTEgKiBaMik7XG4gICAgY29uc3QgWTJaMSA9IG1vZChZMiAqIFoxKTtcbiAgICByZXR1cm4gWDFaMiA9PT0gWDJaMSAmJiBZMVoyID09PSBZMloxO1xuICB9XG5cbiAgLy8gSW52ZXJzZXMgcG9pbnQgdG8gb25lIGNvcnJlc3BvbmRpbmcgdG8gKHgsIC15KSBpbiBBZmZpbmUgY29vcmRpbmF0ZXMuXG4gIG5lZ2F0ZSgpOiBFeHRlbmRlZFBvaW50IHtcbiAgICByZXR1cm4gbmV3IEV4dGVuZGVkUG9pbnQobW9kKC10aGlzLngpLCB0aGlzLnksIHRoaXMueiwgbW9kKC10aGlzLnQpKTtcbiAgfVxuXG4gIC8vIEZhc3QgYWxnbyBmb3IgZG91YmxpbmcgRXh0ZW5kZWQgUG9pbnQgd2hlbiBjdXJ2ZSdzIGE9LTEuXG4gIC8vIGh0dHA6Ly9oeXBlcmVsbGlwdGljLm9yZy9FRkQvZzFwL2F1dG8tdHdpc3RlZC1leHRlbmRlZC0xLmh0bWwjZG91YmxpbmctZGJsLTIwMDgtaHdjZFxuICAvLyBDb3N0OiAzTSArIDRTICsgMSphICsgN2FkZCArIDEqMi5cbiAgZG91YmxlKCk6IEV4dGVuZGVkUG9pbnQge1xuICAgIGNvbnN0IHsgeDogWDEsIHk6IFkxLCB6OiBaMSB9ID0gdGhpcztcbiAgICBjb25zdCB7IGEgfSA9IENVUlZFO1xuICAgIGNvbnN0IEEgPSBtb2QoWDEgKiogXzJuKTtcbiAgICBjb25zdCBCID0gbW9kKFkxICoqIF8ybik7XG4gICAgY29uc3QgQyA9IG1vZChfMm4gKiBtb2QoWjEgKiogXzJuKSk7XG4gICAgY29uc3QgRCA9IG1vZChhICogQSk7XG4gICAgY29uc3QgRSA9IG1vZChtb2QoKFgxICsgWTEpICoqIF8ybikgLSBBIC0gQik7XG4gICAgY29uc3QgRyA9IEQgKyBCO1xuICAgIGNvbnN0IEYgPSBHIC0gQztcbiAgICBjb25zdCBIID0gRCAtIEI7XG4gICAgY29uc3QgWDMgPSBtb2QoRSAqIEYpO1xuICAgIGNvbnN0IFkzID0gbW9kKEcgKiBIKTtcbiAgICBjb25zdCBUMyA9IG1vZChFICogSCk7XG4gICAgY29uc3QgWjMgPSBtb2QoRiAqIEcpO1xuICAgIHJldHVybiBuZXcgRXh0ZW5kZWRQb2ludChYMywgWTMsIFozLCBUMyk7XG4gIH1cblxuICAvLyBGYXN0IGFsZ28gZm9yIGFkZGluZyAyIEV4dGVuZGVkIFBvaW50cyB3aGVuIGN1cnZlJ3MgYT0tMS5cbiAgLy8gaHR0cDovL2h5cGVyZWxsaXB0aWMub3JnL0VGRC9nMXAvYXV0by10d2lzdGVkLWV4dGVuZGVkLTEuaHRtbCNhZGRpdGlvbi1hZGQtMjAwOC1od2NkLTRcbiAgLy8gQ29zdDogOE0gKyA4YWRkICsgMioyLlxuICAvLyBOb3RlOiBJdCBkb2VzIG5vdCBjaGVjayB3aGV0aGVyIHRoZSBgb3RoZXJgIHBvaW50IGlzIHZhbGlkLlxuICBhZGQob3RoZXI6IEV4dGVuZGVkUG9pbnQpIHtcbiAgICBhc3NlcnRFeHRQb2ludChvdGhlcik7XG4gICAgY29uc3QgeyB4OiBYMSwgeTogWTEsIHo6IFoxLCB0OiBUMSB9ID0gdGhpcztcbiAgICBjb25zdCB7IHg6IFgyLCB5OiBZMiwgejogWjIsIHQ6IFQyIH0gPSBvdGhlcjtcbiAgICBjb25zdCBBID0gbW9kKChZMSAtIFgxKSAqIChZMiArIFgyKSk7XG4gICAgY29uc3QgQiA9IG1vZCgoWTEgKyBYMSkgKiAoWTIgLSBYMikpO1xuICAgIGNvbnN0IEYgPSBtb2QoQiAtIEEpO1xuICAgIGlmIChGID09PSBfMG4pIHJldHVybiB0aGlzLmRvdWJsZSgpOyAvLyBTYW1lIHBvaW50LlxuICAgIGNvbnN0IEMgPSBtb2QoWjEgKiBfMm4gKiBUMik7XG4gICAgY29uc3QgRCA9IG1vZChUMSAqIF8ybiAqIFoyKTtcbiAgICBjb25zdCBFID0gRCArIEM7XG4gICAgY29uc3QgRyA9IEIgKyBBO1xuICAgIGNvbnN0IEggPSBEIC0gQztcbiAgICBjb25zdCBYMyA9IG1vZChFICogRik7XG4gICAgY29uc3QgWTMgPSBtb2QoRyAqIEgpO1xuICAgIGNvbnN0IFQzID0gbW9kKEUgKiBIKTtcbiAgICBjb25zdCBaMyA9IG1vZChGICogRyk7XG4gICAgcmV0dXJuIG5ldyBFeHRlbmRlZFBvaW50KFgzLCBZMywgWjMsIFQzKTtcbiAgfVxuXG4gIHN1YnRyYWN0KG90aGVyOiBFeHRlbmRlZFBvaW50KTogRXh0ZW5kZWRQb2ludCB7XG4gICAgcmV0dXJuIHRoaXMuYWRkKG90aGVyLm5lZ2F0ZSgpKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJlY29tcHV0ZVdpbmRvdyhXOiBudW1iZXIpOiBFeHRlbmRlZFBvaW50W10ge1xuICAgIGNvbnN0IHdpbmRvd3MgPSAxICsgMjU2IC8gVztcbiAgICBjb25zdCBwb2ludHM6IEV4dGVuZGVkUG9pbnRbXSA9IFtdO1xuICAgIGxldCBwOiBFeHRlbmRlZFBvaW50ID0gdGhpcztcbiAgICBsZXQgYmFzZSA9IHA7XG4gICAgZm9yIChsZXQgd2luZG93ID0gMDsgd2luZG93IDwgd2luZG93czsgd2luZG93KyspIHtcbiAgICAgIGJhc2UgPSBwO1xuICAgICAgcG9pbnRzLnB1c2goYmFzZSk7XG4gICAgICBmb3IgKGxldCBpID0gMTsgaSA8IDIgKiogKFcgLSAxKTsgaSsrKSB7XG4gICAgICAgIGJhc2UgPSBiYXNlLmFkZChwKTtcbiAgICAgICAgcG9pbnRzLnB1c2goYmFzZSk7XG4gICAgICB9XG4gICAgICBwID0gYmFzZS5kb3VibGUoKTtcbiAgICB9XG4gICAgcmV0dXJuIHBvaW50cztcbiAgfVxuXG4gIHByaXZhdGUgd05BRihuOiBiaWdpbnQsIGFmZmluZVBvaW50PzogUG9pbnQpOiBFeHRlbmRlZFBvaW50IHtcbiAgICBpZiAoIWFmZmluZVBvaW50ICYmIHRoaXMuZXF1YWxzKEV4dGVuZGVkUG9pbnQuQkFTRSkpIGFmZmluZVBvaW50ID0gUG9pbnQuQkFTRTtcbiAgICBjb25zdCBXID0gKGFmZmluZVBvaW50ICYmIGFmZmluZVBvaW50Ll9XSU5ET1dfU0laRSkgfHwgMTtcbiAgICBpZiAoMjU2ICUgVykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdQb2ludCN3TkFGOiBJbnZhbGlkIHByZWNvbXB1dGF0aW9uIHdpbmRvdywgbXVzdCBiZSBwb3dlciBvZiAyJyk7XG4gICAgfVxuXG4gICAgbGV0IHByZWNvbXB1dGVzID0gYWZmaW5lUG9pbnQgJiYgcG9pbnRQcmVjb21wdXRlcy5nZXQoYWZmaW5lUG9pbnQpO1xuICAgIGlmICghcHJlY29tcHV0ZXMpIHtcbiAgICAgIHByZWNvbXB1dGVzID0gdGhpcy5wcmVjb21wdXRlV2luZG93KFcpO1xuICAgICAgaWYgKGFmZmluZVBvaW50ICYmIFcgIT09IDEpIHtcbiAgICAgICAgcHJlY29tcHV0ZXMgPSBFeHRlbmRlZFBvaW50Lm5vcm1hbGl6ZVoocHJlY29tcHV0ZXMpO1xuICAgICAgICBwb2ludFByZWNvbXB1dGVzLnNldChhZmZpbmVQb2ludCwgcHJlY29tcHV0ZXMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBwID0gRXh0ZW5kZWRQb2ludC5aRVJPO1xuICAgIGxldCBmID0gRXh0ZW5kZWRQb2ludC5aRVJPO1xuXG4gICAgY29uc3Qgd2luZG93cyA9IDEgKyAyNTYgLyBXO1xuICAgIGNvbnN0IHdpbmRvd1NpemUgPSAyICoqIChXIC0gMSk7XG4gICAgY29uc3QgbWFzayA9IEJpZ0ludCgyICoqIFcgLSAxKTsgLy8gQ3JlYXRlIG1hc2sgd2l0aCBXIG9uZXM6IDBiMTExMSBmb3IgVz00IGV0Yy5cbiAgICBjb25zdCBtYXhOdW1iZXIgPSAyICoqIFc7XG4gICAgY29uc3Qgc2hpZnRCeSA9IEJpZ0ludChXKTtcblxuICAgIGZvciAobGV0IHdpbmRvdyA9IDA7IHdpbmRvdyA8IHdpbmRvd3M7IHdpbmRvdysrKSB7XG4gICAgICBjb25zdCBvZmZzZXQgPSB3aW5kb3cgKiB3aW5kb3dTaXplO1xuICAgICAgLy8gRXh0cmFjdCBXIGJpdHMuXG4gICAgICBsZXQgd2JpdHMgPSBOdW1iZXIobiAmIG1hc2spO1xuXG4gICAgICAvLyBTaGlmdCBudW1iZXIgYnkgVyBiaXRzLlxuICAgICAgbiA+Pj0gc2hpZnRCeTtcblxuICAgICAgLy8gSWYgdGhlIGJpdHMgYXJlIGJpZ2dlciB0aGFuIG1heCBzaXplLCB3ZSdsbCBzcGxpdCB0aG9zZS5cbiAgICAgIC8vICsyMjQgPT4gMjU2IC0gMzJcbiAgICAgIGlmICh3Yml0cyA+IHdpbmRvd1NpemUpIHtcbiAgICAgICAgd2JpdHMgLT0gbWF4TnVtYmVyO1xuICAgICAgICBuICs9IF8xbjtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgaWYgd2UncmUgb250byBaZXJvIHBvaW50LlxuICAgICAgLy8gQWRkIHJhbmRvbSBwb2ludCBpbnNpZGUgY3VycmVudCB3aW5kb3cgdG8gZi5cbiAgICAgIGlmICh3Yml0cyA9PT0gMCkge1xuICAgICAgICBsZXQgcHIgPSBwcmVjb21wdXRlc1tvZmZzZXRdO1xuICAgICAgICBpZiAod2luZG93ICUgMikgcHIgPSBwci5uZWdhdGUoKTtcbiAgICAgICAgZiA9IGYuYWRkKHByKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBjYWNoZWQgPSBwcmVjb21wdXRlc1tvZmZzZXQgKyBNYXRoLmFicyh3Yml0cykgLSAxXTtcbiAgICAgICAgaWYgKHdiaXRzIDwgMCkgY2FjaGVkID0gY2FjaGVkLm5lZ2F0ZSgpO1xuICAgICAgICBwID0gcC5hZGQoY2FjaGVkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIEV4dGVuZGVkUG9pbnQubm9ybWFsaXplWihbcCwgZl0pWzBdO1xuICB9XG5cbiAgLy8gQ29uc3RhbnQgdGltZSBtdWx0aXBsaWNhdGlvbi5cbiAgLy8gVXNlcyB3TkFGIG1ldGhvZC4gV2luZG93ZWQgbWV0aG9kIG1heSBiZSAxMCUgZmFzdGVyLFxuICAvLyBidXQgdGFrZXMgMnggbG9uZ2VyIHRvIGdlbmVyYXRlIGFuZCBjb25zdW1lcyAyeCBtZW1vcnkuXG4gIG11bHRpcGx5KHNjYWxhcjogbnVtYmVyIHwgYmlnaW50LCBhZmZpbmVQb2ludD86IFBvaW50KTogRXh0ZW5kZWRQb2ludCB7XG4gICAgcmV0dXJuIHRoaXMud05BRihub3JtYWxpemVTY2FsYXIoc2NhbGFyLCBDVVJWRS5sKSwgYWZmaW5lUG9pbnQpO1xuICB9XG5cbiAgLy8gTm9uLWNvbnN0YW50LXRpbWUgbXVsdGlwbGljYXRpb24uIFVzZXMgZG91YmxlLWFuZC1hZGQgYWxnb3JpdGhtLlxuICAvLyBJdCdzIGZhc3RlciwgYnV0IHNob3VsZCBvbmx5IGJlIHVzZWQgd2hlbiB5b3UgZG9uJ3QgY2FyZSBhYm91dFxuICAvLyBhbiBleHBvc2VkIHByaXZhdGUga2V5IGUuZy4gc2lnIHZlcmlmaWNhdGlvbi5cbiAgLy8gQWxsb3dzIHNjYWxhciBiaWdnZXIgdGhhbiBjdXJ2ZSBvcmRlciwgYnV0IGxlc3MgdGhhbiAyXjI1NlxuICBtdWx0aXBseVVuc2FmZShzY2FsYXI6IG51bWJlciB8IGJpZ2ludCk6IEV4dGVuZGVkUG9pbnQge1xuICAgIGxldCBuID0gbm9ybWFsaXplU2NhbGFyKHNjYWxhciwgQ1VSVkUubCwgZmFsc2UpO1xuICAgIGNvbnN0IEcgPSBFeHRlbmRlZFBvaW50LkJBU0U7XG4gICAgY29uc3QgUDAgPSBFeHRlbmRlZFBvaW50LlpFUk87XG4gICAgaWYgKG4gPT09IF8wbikgcmV0dXJuIFAwO1xuICAgIGlmICh0aGlzLmVxdWFscyhQMCkgfHwgbiA9PT0gXzFuKSByZXR1cm4gdGhpcztcbiAgICBpZiAodGhpcy5lcXVhbHMoRykpIHJldHVybiB0aGlzLndOQUYobik7XG4gICAgbGV0IHAgPSBQMDtcbiAgICBsZXQgZDogRXh0ZW5kZWRQb2ludCA9IHRoaXM7XG4gICAgd2hpbGUgKG4gPiBfMG4pIHtcbiAgICAgIGlmIChuICYgXzFuKSBwID0gcC5hZGQoZCk7XG4gICAgICBkID0gZC5kb3VibGUoKTtcbiAgICAgIG4gPj49IF8xbjtcbiAgICB9XG4gICAgcmV0dXJuIHA7XG4gIH1cblxuICBpc1NtYWxsT3JkZXIoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMubXVsdGlwbHlVbnNhZmUoQ1VSVkUuaCkuZXF1YWxzKEV4dGVuZGVkUG9pbnQuWkVSTyk7XG4gIH1cblxuICBpc1RvcnNpb25GcmVlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLm11bHRpcGx5VW5zYWZlKENVUlZFLmwpLmVxdWFscyhFeHRlbmRlZFBvaW50LlpFUk8pO1xuICB9XG5cbiAgLy8gQ29udmVydHMgRXh0ZW5kZWQgcG9pbnQgdG8gZGVmYXVsdCAoeCwgeSkgY29vcmRpbmF0ZXMuXG4gIC8vIENhbiBhY2NlcHQgcHJlY29tcHV0ZWQgWl4tMSAtIGZvciBleGFtcGxlLCBmcm9tIGludmVydEJhdGNoLlxuICB0b0FmZmluZShpbnZaOiBiaWdpbnQgPSBpbnZlcnQodGhpcy56KSk6IFBvaW50IHtcbiAgICBjb25zdCB7IHgsIHksIHogfSA9IHRoaXM7XG4gICAgY29uc3QgYXggPSBtb2QoeCAqIGludlopO1xuICAgIGNvbnN0IGF5ID0gbW9kKHkgKiBpbnZaKTtcbiAgICBjb25zdCB6eiA9IG1vZCh6ICogaW52Wik7XG4gICAgaWYgKHp6ICE9PSBfMW4pIHRocm93IG5ldyBFcnJvcignaW52WiB3YXMgaW52YWxpZCcpO1xuICAgIHJldHVybiBuZXcgUG9pbnQoYXgsIGF5KTtcbiAgfVxuXG4gIGZyb21SaXN0cmV0dG9CeXRlcygpIHtcbiAgICBsZWdhY3lSaXN0KCk7XG4gIH1cbiAgdG9SaXN0cmV0dG9CeXRlcygpIHtcbiAgICBsZWdhY3lSaXN0KCk7XG4gIH1cbiAgZnJvbVJpc3RyZXR0b0hhc2goKSB7XG4gICAgbGVnYWN5UmlzdCgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFzc2VydEV4dFBvaW50KG90aGVyOiB1bmtub3duKSB7XG4gIGlmICghKG90aGVyIGluc3RhbmNlb2YgRXh0ZW5kZWRQb2ludCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4dGVuZGVkUG9pbnQgZXhwZWN0ZWQnKTtcbn1cbmZ1bmN0aW9uIGFzc2VydFJzdFBvaW50KG90aGVyOiB1bmtub3duKSB7XG4gIGlmICghKG90aGVyIGluc3RhbmNlb2YgUmlzdHJldHRvUG9pbnQpKSB0aHJvdyBuZXcgVHlwZUVycm9yKCdSaXN0cmV0dG9Qb2ludCBleHBlY3RlZCcpO1xufVxuXG5mdW5jdGlvbiBsZWdhY3lSaXN0KCkge1xuICB0aHJvdyBuZXcgRXJyb3IoJ0xlZ2FjeSBtZXRob2Q6IHN3aXRjaCB0byBSaXN0cmV0dG9Qb2ludCcpO1xufVxuXG4vKipcbiAqIEVhY2ggZWQyNTUxOS9FeHRlbmRlZFBvaW50IGhhcyA4IGRpZmZlcmVudCBlcXVpdmFsZW50IHBvaW50cy4gVGhpcyBjYW4gYmVcbiAqIGEgc291cmNlIG9mIGJ1Z3MgZm9yIHByb3RvY29scyBsaWtlIHJpbmcgc2lnbmF0dXJlcy4gUmlzdHJldHRvIHdhcyBjcmVhdGVkIHRvIHNvbHZlIHRoaXMuXG4gKiBSaXN0cmV0dG8gcG9pbnQgb3BlcmF0ZXMgaW4gWDpZOlo6VCBleHRlbmRlZCBjb29yZGluYXRlcyBsaWtlIEV4dGVuZGVkUG9pbnQsXG4gKiBidXQgaXQgc2hvdWxkIHdvcmsgaW4gaXRzIG93biBuYW1lc3BhY2U6IGRvIG5vdCBjb21iaW5lIHRob3NlIHR3by5cbiAqIGh0dHBzOi8vZGF0YXRyYWNrZXIuaWV0Zi5vcmcvZG9jL2h0bWwvZHJhZnQtaXJ0Zi1jZnJnLXJpc3RyZXR0bzI1NS1kZWNhZjQ0OFxuICovXG5jbGFzcyBSaXN0cmV0dG9Qb2ludCB7XG4gIHN0YXRpYyBCQVNFID0gbmV3IFJpc3RyZXR0b1BvaW50KEV4dGVuZGVkUG9pbnQuQkFTRSk7XG4gIHN0YXRpYyBaRVJPID0gbmV3IFJpc3RyZXR0b1BvaW50KEV4dGVuZGVkUG9pbnQuWkVSTyk7XG5cbiAgLy8gUHJpdmF0ZSBwcm9wZXJ0eSB0byBkaXNjb3VyYWdlIGNvbWJpbmluZyBFeHRlbmRlZFBvaW50ICsgUmlzdHJldHRvUG9pbnRcbiAgLy8gQWx3YXlzIHVzZSBSaXN0cmV0dG8gZW5jb2RpbmcvZGVjb2RpbmcgaW5zdGVhZC5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBlcDogRXh0ZW5kZWRQb2ludCkge31cblxuICAvLyBDb21wdXRlcyBFbGxpZ2F0b3IgbWFwIGZvciBSaXN0cmV0dG9cbiAgLy8gaHR0cHM6Ly9yaXN0cmV0dG8uZ3JvdXAvZm9ybXVsYXMvZWxsaWdhdG9yLmh0bWxcbiAgcHJpdmF0ZSBzdGF0aWMgY2FsY0VsbGlnYXRvclJpc3RyZXR0b01hcChyMDogYmlnaW50KTogRXh0ZW5kZWRQb2ludCB7XG4gICAgY29uc3QgeyBkIH0gPSBDVVJWRTtcbiAgICBjb25zdCByID0gbW9kKFNRUlRfTTEgKiByMCAqIHIwKTsgLy8gMVxuICAgIGNvbnN0IE5zID0gbW9kKChyICsgXzFuKSAqIE9ORV9NSU5VU19EX1NRKTsgLy8gMlxuICAgIGxldCBjID0gQmlnSW50KC0xKTsgLy8gM1xuICAgIGNvbnN0IEQgPSBtb2QoKGMgLSBkICogcikgKiBtb2QociArIGQpKTsgLy8gNFxuICAgIGxldCB7IGlzVmFsaWQ6IE5zX0RfaXNfc3EsIHZhbHVlOiBzIH0gPSB1dlJhdGlvKE5zLCBEKTsgLy8gNVxuICAgIGxldCBzXyA9IG1vZChzICogcjApOyAvLyA2XG4gICAgaWYgKCFlZElzTmVnYXRpdmUoc18pKSBzXyA9IG1vZCgtc18pO1xuICAgIGlmICghTnNfRF9pc19zcSkgcyA9IHNfOyAvLyA3XG4gICAgaWYgKCFOc19EX2lzX3NxKSBjID0gcjsgLy8gOFxuICAgIGNvbnN0IE50ID0gbW9kKGMgKiAociAtIF8xbikgKiBEX01JTlVTX09ORV9TUSAtIEQpOyAvLyA5XG4gICAgY29uc3QgczIgPSBzICogcztcbiAgICBjb25zdCBXMCA9IG1vZCgocyArIHMpICogRCk7IC8vIDEwXG4gICAgY29uc3QgVzEgPSBtb2QoTnQgKiBTUVJUX0FEX01JTlVTX09ORSk7IC8vIDExXG4gICAgY29uc3QgVzIgPSBtb2QoXzFuIC0gczIpOyAvLyAxMlxuICAgIGNvbnN0IFczID0gbW9kKF8xbiArIHMyKTsgLy8gMTNcbiAgICByZXR1cm4gbmV3IEV4dGVuZGVkUG9pbnQobW9kKFcwICogVzMpLCBtb2QoVzIgKiBXMSksIG1vZChXMSAqIFczKSwgbW9kKFcwICogVzIpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUYWtlcyB1bmlmb3JtIG91dHB1dCBvZiA2NC1iaXQgaGFzaCBmdW5jdGlvbiBsaWtlIHNoYTUxMiBhbmQgY29udmVydHMgaXQgdG8gYFJpc3RyZXR0b1BvaW50YC5cbiAgICogVGhlIGhhc2gtdG8tZ3JvdXAgb3BlcmF0aW9uIGFwcGxpZXMgRWxsaWdhdG9yIHR3aWNlIGFuZCBhZGRzIHRoZSByZXN1bHRzLlxuICAgKiAqKk5vdGU6KiogdGhpcyBpcyBvbmUtd2F5IG1hcCwgdGhlcmUgaXMgbm8gY29udmVyc2lvbiBmcm9tIHBvaW50IHRvIGhhc2guXG4gICAqIGh0dHBzOi8vcmlzdHJldHRvLmdyb3VwL2Zvcm11bGFzL2VsbGlnYXRvci5odG1sXG4gICAqIEBwYXJhbSBoZXggNjQtYml0IG91dHB1dCBvZiBhIGhhc2ggZnVuY3Rpb25cbiAgICovXG4gIHN0YXRpYyBoYXNoVG9DdXJ2ZShoZXg6IEhleCk6IFJpc3RyZXR0b1BvaW50IHtcbiAgICBoZXggPSBlbnN1cmVCeXRlcyhoZXgsIDY0KTtcbiAgICBjb25zdCByMSA9IGJ5dGVzMjU1VG9OdW1iZXJMRShoZXguc2xpY2UoMCwgMzIpKTtcbiAgICBjb25zdCBSMSA9IHRoaXMuY2FsY0VsbGlnYXRvclJpc3RyZXR0b01hcChyMSk7XG4gICAgY29uc3QgcjIgPSBieXRlczI1NVRvTnVtYmVyTEUoaGV4LnNsaWNlKDMyLCA2NCkpO1xuICAgIGNvbnN0IFIyID0gdGhpcy5jYWxjRWxsaWdhdG9yUmlzdHJldHRvTWFwKHIyKTtcbiAgICByZXR1cm4gbmV3IFJpc3RyZXR0b1BvaW50KFIxLmFkZChSMikpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnRzIHJpc3RyZXR0by1lbmNvZGVkIHN0cmluZyB0byByaXN0cmV0dG8gcG9pbnQuXG4gICAqIGh0dHBzOi8vcmlzdHJldHRvLmdyb3VwL2Zvcm11bGFzL2RlY29kaW5nLmh0bWxcbiAgICogQHBhcmFtIGhleCBSaXN0cmV0dG8tZW5jb2RlZCAzMiBieXRlcy4gTm90IGV2ZXJ5IDMyLWJ5dGUgc3RyaW5nIGlzIHZhbGlkIHJpc3RyZXR0byBlbmNvZGluZ1xuICAgKi9cbiAgc3RhdGljIGZyb21IZXgoaGV4OiBIZXgpOiBSaXN0cmV0dG9Qb2ludCB7XG4gICAgaGV4ID0gZW5zdXJlQnl0ZXMoaGV4LCAzMik7XG4gICAgY29uc3QgeyBhLCBkIH0gPSBDVVJWRTtcbiAgICBjb25zdCBlbXNnID0gJ1Jpc3RyZXR0b1BvaW50LmZyb21IZXg6IHRoZSBoZXggaXMgbm90IHZhbGlkIGVuY29kaW5nIG9mIFJpc3RyZXR0b1BvaW50JztcbiAgICBjb25zdCBzID0gYnl0ZXMyNTVUb051bWJlckxFKGhleCk7XG4gICAgLy8gMS4gQ2hlY2sgdGhhdCBzX2J5dGVzIGlzIHRoZSBjYW5vbmljYWwgZW5jb2Rpbmcgb2YgYSBmaWVsZCBlbGVtZW50LCBvciBlbHNlIGFib3J0LlxuICAgIC8vIDMuIENoZWNrIHRoYXQgcyBpcyBub24tbmVnYXRpdmUsIG9yIGVsc2UgYWJvcnRcbiAgICBpZiAoIWVxdWFsQnl0ZXMobnVtYmVyVG8zMkJ5dGVzTEUocyksIGhleCkgfHwgZWRJc05lZ2F0aXZlKHMpKSB0aHJvdyBuZXcgRXJyb3IoZW1zZyk7XG4gICAgY29uc3QgczIgPSBtb2QocyAqIHMpO1xuICAgIGNvbnN0IHUxID0gbW9kKF8xbiArIGEgKiBzMik7IC8vIDQgKGEgaXMgLTEpXG4gICAgY29uc3QgdTIgPSBtb2QoXzFuIC0gYSAqIHMyKTsgLy8gNVxuICAgIGNvbnN0IHUxXzIgPSBtb2QodTEgKiB1MSk7XG4gICAgY29uc3QgdTJfMiA9IG1vZCh1MiAqIHUyKTtcbiAgICBjb25zdCB2ID0gbW9kKGEgKiBkICogdTFfMiAtIHUyXzIpOyAvLyA2XG4gICAgY29uc3QgeyBpc1ZhbGlkLCB2YWx1ZTogSSB9ID0gaW52ZXJ0U3FydChtb2QodiAqIHUyXzIpKTsgLy8gN1xuICAgIGNvbnN0IER4ID0gbW9kKEkgKiB1Mik7IC8vIDhcbiAgICBjb25zdCBEeSA9IG1vZChJICogRHggKiB2KTsgLy8gOVxuICAgIGxldCB4ID0gbW9kKChzICsgcykgKiBEeCk7IC8vIDEwXG4gICAgaWYgKGVkSXNOZWdhdGl2ZSh4KSkgeCA9IG1vZCgteCk7IC8vIDEwXG4gICAgY29uc3QgeSA9IG1vZCh1MSAqIER5KTsgLy8gMTFcbiAgICBjb25zdCB0ID0gbW9kKHggKiB5KTsgLy8gMTJcbiAgICBpZiAoIWlzVmFsaWQgfHwgZWRJc05lZ2F0aXZlKHQpIHx8IHkgPT09IF8wbikgdGhyb3cgbmV3IEVycm9yKGVtc2cpO1xuICAgIHJldHVybiBuZXcgUmlzdHJldHRvUG9pbnQobmV3IEV4dGVuZGVkUG9pbnQoeCwgeSwgXzFuLCB0KSk7XG4gIH1cblxuICAvKipcbiAgICogRW5jb2RlcyByaXN0cmV0dG8gcG9pbnQgdG8gVWludDhBcnJheS5cbiAgICogaHR0cHM6Ly9yaXN0cmV0dG8uZ3JvdXAvZm9ybXVsYXMvZW5jb2RpbmcuaHRtbFxuICAgKi9cbiAgdG9SYXdCeXRlcygpOiBVaW50OEFycmF5IHtcbiAgICBsZXQgeyB4LCB5LCB6LCB0IH0gPSB0aGlzLmVwO1xuICAgIGNvbnN0IHUxID0gbW9kKG1vZCh6ICsgeSkgKiBtb2QoeiAtIHkpKTsgLy8gMVxuICAgIGNvbnN0IHUyID0gbW9kKHggKiB5KTsgLy8gMlxuICAgIC8vIFNxdWFyZSByb290IGFsd2F5cyBleGlzdHNcbiAgICBjb25zdCB7IHZhbHVlOiBpbnZzcXJ0IH0gPSBpbnZlcnRTcXJ0KG1vZCh1MSAqIHUyICoqIF8ybikpOyAvLyAzXG4gICAgY29uc3QgRDEgPSBtb2QoaW52c3FydCAqIHUxKTsgLy8gNFxuICAgIGNvbnN0IEQyID0gbW9kKGludnNxcnQgKiB1Mik7IC8vIDVcbiAgICBjb25zdCB6SW52ID0gbW9kKEQxICogRDIgKiB0KTsgLy8gNlxuICAgIGxldCBEOiBiaWdpbnQ7IC8vIDdcbiAgICBpZiAoZWRJc05lZ2F0aXZlKHQgKiB6SW52KSkge1xuICAgICAgbGV0IF94ID0gbW9kKHkgKiBTUVJUX00xKTtcbiAgICAgIGxldCBfeSA9IG1vZCh4ICogU1FSVF9NMSk7XG4gICAgICB4ID0gX3g7XG4gICAgICB5ID0gX3k7XG4gICAgICBEID0gbW9kKEQxICogSU5WU1FSVF9BX01JTlVTX0QpO1xuICAgIH0gZWxzZSB7XG4gICAgICBEID0gRDI7IC8vIDhcbiAgICB9XG4gICAgaWYgKGVkSXNOZWdhdGl2ZSh4ICogekludikpIHkgPSBtb2QoLXkpOyAvLyA5XG4gICAgbGV0IHMgPSBtb2QoKHogLSB5KSAqIEQpOyAvLyAxMCAoY2hlY2sgZm9vdGVyJ3Mgbm90ZSwgbm8gc3FydCgtYSkpXG4gICAgaWYgKGVkSXNOZWdhdGl2ZShzKSkgcyA9IG1vZCgtcyk7XG4gICAgcmV0dXJuIG51bWJlclRvMzJCeXRlc0xFKHMpOyAvLyAxMVxuICB9XG5cbiAgdG9IZXgoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYnl0ZXNUb0hleCh0aGlzLnRvUmF3Qnl0ZXMoKSk7XG4gIH1cblxuICB0b1N0cmluZygpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLnRvSGV4KCk7XG4gIH1cblxuICAvLyBDb21wYXJlIG9uZSBwb2ludCB0byBhbm90aGVyLlxuICBlcXVhbHMob3RoZXI6IFJpc3RyZXR0b1BvaW50KTogYm9vbGVhbiB7XG4gICAgYXNzZXJ0UnN0UG9pbnQob3RoZXIpO1xuICAgIGNvbnN0IGEgPSB0aGlzLmVwO1xuICAgIGNvbnN0IGIgPSBvdGhlci5lcDtcbiAgICAvLyAoeDEgKiB5MiA9PSB5MSAqIHgyKSB8ICh5MSAqIHkyID09IHgxICogeDIpXG4gICAgY29uc3Qgb25lID0gbW9kKGEueCAqIGIueSkgPT09IG1vZChhLnkgKiBiLngpO1xuICAgIGNvbnN0IHR3byA9IG1vZChhLnkgKiBiLnkpID09PSBtb2QoYS54ICogYi54KTtcbiAgICByZXR1cm4gb25lIHx8IHR3bztcbiAgfVxuXG4gIGFkZChvdGhlcjogUmlzdHJldHRvUG9pbnQpOiBSaXN0cmV0dG9Qb2ludCB7XG4gICAgYXNzZXJ0UnN0UG9pbnQob3RoZXIpO1xuICAgIHJldHVybiBuZXcgUmlzdHJldHRvUG9pbnQodGhpcy5lcC5hZGQob3RoZXIuZXApKTtcbiAgfVxuXG4gIHN1YnRyYWN0KG90aGVyOiBSaXN0cmV0dG9Qb2ludCk6IFJpc3RyZXR0b1BvaW50IHtcbiAgICBhc3NlcnRSc3RQb2ludChvdGhlcik7XG4gICAgcmV0dXJuIG5ldyBSaXN0cmV0dG9Qb2ludCh0aGlzLmVwLnN1YnRyYWN0KG90aGVyLmVwKSk7XG4gIH1cblxuICBtdWx0aXBseShzY2FsYXI6IG51bWJlciB8IGJpZ2ludCk6IFJpc3RyZXR0b1BvaW50IHtcbiAgICByZXR1cm4gbmV3IFJpc3RyZXR0b1BvaW50KHRoaXMuZXAubXVsdGlwbHkoc2NhbGFyKSk7XG4gIH1cblxuICBtdWx0aXBseVVuc2FmZShzY2FsYXI6IG51bWJlciB8IGJpZ2ludCk6IFJpc3RyZXR0b1BvaW50IHtcbiAgICByZXR1cm4gbmV3IFJpc3RyZXR0b1BvaW50KHRoaXMuZXAubXVsdGlwbHlVbnNhZmUoc2NhbGFyKSk7XG4gIH1cbn1cblxuLy8gU3RvcmVzIHByZWNvbXB1dGVkIHZhbHVlcyBmb3IgcG9pbnRzLlxuY29uc3QgcG9pbnRQcmVjb21wdXRlcyA9IG5ldyBXZWFrTWFwPFBvaW50LCBFeHRlbmRlZFBvaW50W10+KCk7XG5cbi8qKlxuICogRGVmYXVsdCBQb2ludCB3b3JrcyBpbiBhZmZpbmUgY29vcmRpbmF0ZXM6ICh4LCB5KVxuICovXG5jbGFzcyBQb2ludCB7XG4gIC8vIEJhc2UgcG9pbnQgYWthIGdlbmVyYXRvclxuICAvLyBwdWJsaWNfa2V5ID0gUG9pbnQuQkFTRSAqIHByaXZhdGVfa2V5XG4gIHN0YXRpYyBCQVNFOiBQb2ludCA9IG5ldyBQb2ludChDVVJWRS5HeCwgQ1VSVkUuR3kpO1xuICAvLyBJZGVudGl0eSBwb2ludCBha2EgcG9pbnQgYXQgaW5maW5pdHlcbiAgLy8gcG9pbnQgPSBwb2ludCArIHplcm9fcG9pbnRcbiAgc3RhdGljIFpFUk86IFBvaW50ID0gbmV3IFBvaW50KF8wbiwgXzFuKTtcbiAgLy8gV2UgY2FsY3VsYXRlIHByZWNvbXB1dGVzIGZvciBlbGxpcHRpYyBjdXJ2ZSBwb2ludCBtdWx0aXBsaWNhdGlvblxuICAvLyB1c2luZyB3aW5kb3dlZCBtZXRob2QuIFRoaXMgc3BlY2lmaWVzIHdpbmRvdyBzaXplIGFuZFxuICAvLyBzdG9yZXMgcHJlY29tcHV0ZWQgdmFsdWVzLiBVc3VhbGx5IG9ubHkgYmFzZSBwb2ludCB3b3VsZCBiZSBwcmVjb21wdXRlZC5cbiAgX1dJTkRPV19TSVpFPzogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKHJlYWRvbmx5IHg6IGJpZ2ludCwgcmVhZG9ubHkgeTogYmlnaW50KSB7fVxuXG4gIC8vIFwiUHJpdmF0ZSBtZXRob2RcIiwgZG9uJ3QgdXNlIGl0IGRpcmVjdGx5LlxuICBfc2V0V2luZG93U2l6ZSh3aW5kb3dTaXplOiBudW1iZXIpIHtcbiAgICB0aGlzLl9XSU5ET1dfU0laRSA9IHdpbmRvd1NpemU7XG4gICAgcG9pbnRQcmVjb21wdXRlcy5kZWxldGUodGhpcyk7XG4gIH1cblxuICAvLyBDb252ZXJ0cyBoYXNoIHN0cmluZyBvciBVaW50OEFycmF5IHRvIFBvaW50LlxuICAvLyBVc2VzIGFsZ28gZnJvbSBSRkM4MDMyIDUuMS4zLlxuICBzdGF0aWMgZnJvbUhleChoZXg6IEhleCwgc3RyaWN0ID0gdHJ1ZSkge1xuICAgIGNvbnN0IHsgZCwgUCB9ID0gQ1VSVkU7XG4gICAgaGV4ID0gZW5zdXJlQnl0ZXMoaGV4LCAzMik7XG4gICAgLy8gMS4gIEZpcnN0LCBpbnRlcnByZXQgdGhlIHN0cmluZyBhcyBhbiBpbnRlZ2VyIGluIGxpdHRsZS1lbmRpYW5cbiAgICAvLyByZXByZXNlbnRhdGlvbi4gQml0IDI1NSBvZiB0aGlzIG51bWJlciBpcyB0aGUgbGVhc3Qgc2lnbmlmaWNhbnRcbiAgICAvLyBiaXQgb2YgdGhlIHgtY29vcmRpbmF0ZSBhbmQgZGVub3RlIHRoaXMgdmFsdWUgeF8wLiAgVGhlXG4gICAgLy8geS1jb29yZGluYXRlIGlzIHJlY292ZXJlZCBzaW1wbHkgYnkgY2xlYXJpbmcgdGhpcyBiaXQuICBJZiB0aGVcbiAgICAvLyByZXN1bHRpbmcgdmFsdWUgaXMgPj0gcCwgZGVjb2RpbmcgZmFpbHMuXG4gICAgY29uc3Qgbm9ybWVkID0gaGV4LnNsaWNlKCk7XG4gICAgbm9ybWVkWzMxXSA9IGhleFszMV0gJiB+MHg4MDtcbiAgICBjb25zdCB5ID0gYnl0ZXNUb051bWJlckxFKG5vcm1lZCk7XG5cbiAgICBpZiAoc3RyaWN0ICYmIHkgPj0gUCkgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCAwIDwgaGV4IDwgUCcpO1xuICAgIGlmICghc3RyaWN0ICYmIHkgPj0gTUFYXzI1NkIpIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgMCA8IGhleCA8IDIqKjI1NicpO1xuXG4gICAgLy8gMi4gIFRvIHJlY292ZXIgdGhlIHgtY29vcmRpbmF0ZSwgdGhlIGN1cnZlIGVxdWF0aW9uIGltcGxpZXNcbiAgICAvLyB4wrIgPSAoecKyIC0gMSkgLyAoZCB5wrIgKyAxKSAobW9kIHApLiAgVGhlIGRlbm9taW5hdG9yIGlzIGFsd2F5c1xuICAgIC8vIG5vbi16ZXJvIG1vZCBwLiAgTGV0IHUgPSB5wrIgLSAxIGFuZCB2ID0gZCB5wrIgKyAxLlxuICAgIGNvbnN0IHkyID0gbW9kKHkgKiB5KTtcbiAgICBjb25zdCB1ID0gbW9kKHkyIC0gXzFuKTtcbiAgICBjb25zdCB2ID0gbW9kKGQgKiB5MiArIF8xbik7XG4gICAgbGV0IHsgaXNWYWxpZCwgdmFsdWU6IHggfSA9IHV2UmF0aW8odSwgdik7XG4gICAgaWYgKCFpc1ZhbGlkKSB0aHJvdyBuZXcgRXJyb3IoJ1BvaW50LmZyb21IZXg6IGludmFsaWQgeSBjb29yZGluYXRlJyk7XG5cbiAgICAvLyA0LiAgRmluYWxseSwgdXNlIHRoZSB4XzAgYml0IHRvIHNlbGVjdCB0aGUgcmlnaHQgc3F1YXJlIHJvb3QuICBJZlxuICAgIC8vIHggPSAwLCBhbmQgeF8wID0gMSwgZGVjb2RpbmcgZmFpbHMuICBPdGhlcndpc2UsIGlmIHhfMCAhPSB4IG1vZFxuICAgIC8vIDIsIHNldCB4IDwtLSBwIC0geC4gIFJldHVybiB0aGUgZGVjb2RlZCBwb2ludCAoeCx5KS5cbiAgICBjb25zdCBpc1hPZGQgPSAoeCAmIF8xbikgPT09IF8xbjtcbiAgICBjb25zdCBpc0xhc3RCeXRlT2RkID0gKGhleFszMV0gJiAweDgwKSAhPT0gMDtcbiAgICBpZiAoaXNMYXN0Qnl0ZU9kZCAhPT0gaXNYT2RkKSB7XG4gICAgICB4ID0gbW9kKC14KTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBQb2ludCh4LCB5KTtcbiAgfVxuXG4gIHN0YXRpYyBhc3luYyBmcm9tUHJpdmF0ZUtleShwcml2YXRlS2V5OiBQcml2S2V5KSB7XG4gICAgcmV0dXJuIChhd2FpdCBnZXRFeHRlbmRlZFB1YmxpY0tleShwcml2YXRlS2V5KSkucG9pbnQ7XG4gIH1cblxuICAvLyBUaGVyZSBjYW4gYWx3YXlzIGJlIG9ubHkgdHdvIHggdmFsdWVzICh4LCAteCkgZm9yIGFueSB5XG4gIC8vIFdoZW4gY29tcHJlc3NpbmcgcG9pbnQsIGl0J3MgZW5vdWdoIHRvIG9ubHkgc3RvcmUgaXRzIHkgY29vcmRpbmF0ZVxuICAvLyBhbmQgdXNlIHRoZSBsYXN0IGJ5dGUgdG8gZW5jb2RlIHNpZ24gb2YgeC5cbiAgdG9SYXdCeXRlcygpOiBVaW50OEFycmF5IHtcbiAgICBjb25zdCBieXRlcyA9IG51bWJlclRvMzJCeXRlc0xFKHRoaXMueSk7XG4gICAgYnl0ZXNbMzFdIHw9IHRoaXMueCAmIF8xbiA/IDB4ODAgOiAwO1xuICAgIHJldHVybiBieXRlcztcbiAgfVxuXG4gIC8vIFNhbWUgYXMgdG9SYXdCeXRlcywgYnV0IHJldHVybnMgc3RyaW5nLlxuICB0b0hleCgpOiBzdHJpbmcge1xuICAgIHJldHVybiBieXRlc1RvSGV4KHRoaXMudG9SYXdCeXRlcygpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDb252ZXJ0cyB0byBNb250Z29tZXJ5OyBha2EgeCBjb29yZGluYXRlIG9mIGN1cnZlMjU1MTkuXG4gICAqIFdlIGRvbid0IGhhdmUgZnJvbVgyNTUxOSwgYmVjYXVzZSB3ZSBkb24ndCBrbm93IHNpZ24uXG4gICAqXG4gICAqIGBgYFxuICAgKiB1LCB2OiBjdXJ2ZTI1NTE5IGNvb3JkaW5hdGVzXG4gICAqIHgsIHk6IGVkMjU1MTkgY29vcmRpbmF0ZXNcbiAgICogKHUsIHYpID0gKCgxK3kpLygxLXkpLCBzcXJ0KC00ODY2NjQpKnUveClcbiAgICogKHgsIHkpID0gKHNxcnQoLTQ4NjY2NCkqdS92LCAodS0xKS8odSsxKSlcbiAgICogYGBgXG4gICAqIGh0dHBzOi8vYmxvZy5maWxpcHBvLmlvL3VzaW5nLWVkMjU1MTkta2V5cy1mb3ItZW5jcnlwdGlvblxuICAgKiBAcmV0dXJucyB1IGNvb3JkaW5hdGUgb2YgY3VydmUyNTUxOSBwb2ludFxuICAgKi9cbiAgdG9YMjU1MTkoKTogVWludDhBcnJheSB7XG4gICAgY29uc3QgeyB5IH0gPSB0aGlzO1xuICAgIGNvbnN0IHUgPSBtb2QoKF8xbiArIHkpICogaW52ZXJ0KF8xbiAtIHkpKTtcbiAgICByZXR1cm4gbnVtYmVyVG8zMkJ5dGVzTEUodSk7XG4gIH1cblxuICBpc1RvcnNpb25GcmVlKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBFeHRlbmRlZFBvaW50LmZyb21BZmZpbmUodGhpcykuaXNUb3JzaW9uRnJlZSgpO1xuICB9XG5cbiAgZXF1YWxzKG90aGVyOiBQb2ludCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnggPT09IG90aGVyLnggJiYgdGhpcy55ID09PSBvdGhlci55O1xuICB9XG5cbiAgbmVnYXRlKCkge1xuICAgIHJldHVybiBuZXcgUG9pbnQobW9kKC10aGlzLngpLCB0aGlzLnkpO1xuICB9XG5cbiAgYWRkKG90aGVyOiBQb2ludCkge1xuICAgIHJldHVybiBFeHRlbmRlZFBvaW50LmZyb21BZmZpbmUodGhpcykuYWRkKEV4dGVuZGVkUG9pbnQuZnJvbUFmZmluZShvdGhlcikpLnRvQWZmaW5lKCk7XG4gIH1cblxuICBzdWJ0cmFjdChvdGhlcjogUG9pbnQpIHtcbiAgICByZXR1cm4gdGhpcy5hZGQob3RoZXIubmVnYXRlKCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnN0YW50IHRpbWUgbXVsdGlwbGljYXRpb24uXG4gICAqIEBwYXJhbSBzY2FsYXIgQmlnLUVuZGlhbiBudW1iZXJcbiAgICogQHJldHVybnMgbmV3IHBvaW50XG4gICAqL1xuICBtdWx0aXBseShzY2FsYXI6IG51bWJlciB8IGJpZ2ludCk6IFBvaW50IHtcbiAgICByZXR1cm4gRXh0ZW5kZWRQb2ludC5mcm9tQWZmaW5lKHRoaXMpLm11bHRpcGx5KHNjYWxhciwgdGhpcykudG9BZmZpbmUoKTtcbiAgfVxufVxuXG4vKipcbiAqIEVERFNBIHNpZ25hdHVyZS5cbiAqL1xuY2xhc3MgU2lnbmF0dXJlIHtcbiAgY29uc3RydWN0b3IocmVhZG9ubHkgcjogUG9pbnQsIHJlYWRvbmx5IHM6IGJpZ2ludCkge1xuICAgIHRoaXMuYXNzZXJ0VmFsaWRpdHkoKTtcbiAgfVxuXG4gIHN0YXRpYyBmcm9tSGV4KGhleDogSGV4KSB7XG4gICAgY29uc3QgYnl0ZXMgPSBlbnN1cmVCeXRlcyhoZXgsIDY0KTtcbiAgICBjb25zdCByID0gUG9pbnQuZnJvbUhleChieXRlcy5zbGljZSgwLCAzMiksIGZhbHNlKTtcbiAgICBjb25zdCBzID0gYnl0ZXNUb051bWJlckxFKGJ5dGVzLnNsaWNlKDMyLCA2NCkpO1xuICAgIHJldHVybiBuZXcgU2lnbmF0dXJlKHIsIHMpO1xuICB9XG5cbiAgYXNzZXJ0VmFsaWRpdHkoKSB7XG4gICAgY29uc3QgeyByLCBzIH0gPSB0aGlzO1xuICAgIGlmICghKHIgaW5zdGFuY2VvZiBQb2ludCkpIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgUG9pbnQgaW5zdGFuY2UnKTtcbiAgICAvLyAwIDw9IHMgPCBsXG4gICAgbm9ybWFsaXplU2NhbGFyKHMsIENVUlZFLmwsIGZhbHNlKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHRvUmF3Qnl0ZXMoKSB7XG4gICAgY29uc3QgdTggPSBuZXcgVWludDhBcnJheSg2NCk7XG4gICAgdTguc2V0KHRoaXMuci50b1Jhd0J5dGVzKCkpO1xuICAgIHU4LnNldChudW1iZXJUbzMyQnl0ZXNMRSh0aGlzLnMpLCAzMik7XG4gICAgcmV0dXJuIHU4O1xuICB9XG5cbiAgdG9IZXgoKSB7XG4gICAgcmV0dXJuIGJ5dGVzVG9IZXgodGhpcy50b1Jhd0J5dGVzKCkpO1xuICB9XG59XG5cbmV4cG9ydCB7IEV4dGVuZGVkUG9pbnQsIFJpc3RyZXR0b1BvaW50LCBQb2ludCwgU2lnbmF0dXJlIH07XG5cbmZ1bmN0aW9uIGNvbmNhdEJ5dGVzKC4uLmFycmF5czogVWludDhBcnJheVtdKTogVWludDhBcnJheSB7XG4gIGlmICghYXJyYXlzLmV2ZXJ5KChhKSA9PiBhIGluc3RhbmNlb2YgVWludDhBcnJheSkpIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgVWludDhBcnJheSBsaXN0Jyk7XG4gIGlmIChhcnJheXMubGVuZ3RoID09PSAxKSByZXR1cm4gYXJyYXlzWzBdO1xuICBjb25zdCBsZW5ndGggPSBhcnJheXMucmVkdWNlKChhLCBhcnIpID0+IGEgKyBhcnIubGVuZ3RoLCAwKTtcbiAgY29uc3QgcmVzdWx0ID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKTtcbiAgZm9yIChsZXQgaSA9IDAsIHBhZCA9IDA7IGkgPCBhcnJheXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBhcnIgPSBhcnJheXNbaV07XG4gICAgcmVzdWx0LnNldChhcnIsIHBhZCk7XG4gICAgcGFkICs9IGFyci5sZW5ndGg7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLy8gQ29udmVydCBiZXR3ZWVuIHR5cGVzXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS1cbmNvbnN0IGhleGVzID0gQXJyYXkuZnJvbSh7IGxlbmd0aDogMjU2IH0sICh2LCBpKSA9PiBpLnRvU3RyaW5nKDE2KS5wYWRTdGFydCgyLCAnMCcpKTtcbmZ1bmN0aW9uIGJ5dGVzVG9IZXgodWludDhhOiBVaW50OEFycmF5KTogc3RyaW5nIHtcbiAgLy8gcHJlLWNhY2hpbmcgaW1wcm92ZXMgdGhlIHNwZWVkIDZ4XG4gIGlmICghKHVpbnQ4YSBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkpKSB0aHJvdyBuZXcgRXJyb3IoJ1VpbnQ4QXJyYXkgZXhwZWN0ZWQnKTtcbiAgbGV0IGhleCA9ICcnO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHVpbnQ4YS5sZW5ndGg7IGkrKykge1xuICAgIGhleCArPSBoZXhlc1t1aW50OGFbaV1dO1xuICB9XG4gIHJldHVybiBoZXg7XG59XG5cbi8vIENhY2hpbmcgc2xvd3MgaXQgZG93biAyLTN4XG5mdW5jdGlvbiBoZXhUb0J5dGVzKGhleDogc3RyaW5nKTogVWludDhBcnJheSB7XG4gIGlmICh0eXBlb2YgaGV4ICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2hleFRvQnl0ZXM6IGV4cGVjdGVkIHN0cmluZywgZ290ICcgKyB0eXBlb2YgaGV4KTtcbiAgfVxuICBpZiAoaGV4Lmxlbmd0aCAlIDIpIHRocm93IG5ldyBFcnJvcignaGV4VG9CeXRlczogcmVjZWl2ZWQgaW52YWxpZCB1bnBhZGRlZCBoZXgnKTtcbiAgY29uc3QgYXJyYXkgPSBuZXcgVWludDhBcnJheShoZXgubGVuZ3RoIC8gMik7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBqID0gaSAqIDI7XG4gICAgY29uc3QgaGV4Qnl0ZSA9IGhleC5zbGljZShqLCBqICsgMik7XG4gICAgY29uc3QgYnl0ZSA9IE51bWJlci5wYXJzZUludChoZXhCeXRlLCAxNik7XG4gICAgaWYgKE51bWJlci5pc05hTihieXRlKSB8fCBieXRlIDwgMCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGJ5dGUgc2VxdWVuY2UnKTtcbiAgICBhcnJheVtpXSA9IGJ5dGU7XG4gIH1cbiAgcmV0dXJuIGFycmF5O1xufVxuXG5mdW5jdGlvbiBudW1iZXJUbzMyQnl0ZXNCRShudW06IGJpZ2ludCkge1xuICBjb25zdCBsZW5ndGggPSAzMjtcbiAgY29uc3QgaGV4ID0gbnVtLnRvU3RyaW5nKDE2KS5wYWRTdGFydChsZW5ndGggKiAyLCAnMCcpO1xuICByZXR1cm4gaGV4VG9CeXRlcyhoZXgpO1xufVxuXG5mdW5jdGlvbiBudW1iZXJUbzMyQnl0ZXNMRShudW06IGJpZ2ludCkge1xuICByZXR1cm4gbnVtYmVyVG8zMkJ5dGVzQkUobnVtKS5yZXZlcnNlKCk7XG59XG5cbi8vIExpdHRsZS1lbmRpYW4gY2hlY2sgZm9yIGZpcnN0IExFIGJpdCAobGFzdCBCRSBiaXQpO1xuZnVuY3Rpb24gZWRJc05lZ2F0aXZlKG51bTogYmlnaW50KSB7XG4gIHJldHVybiAobW9kKG51bSkgJiBfMW4pID09PSBfMW47XG59XG5cbi8vIExpdHRsZSBFbmRpYW5cbmZ1bmN0aW9uIGJ5dGVzVG9OdW1iZXJMRSh1aW50OGE6IFVpbnQ4QXJyYXkpOiBiaWdpbnQge1xuICBpZiAoISh1aW50OGEgaW5zdGFuY2VvZiBVaW50OEFycmF5KSkgdGhyb3cgbmV3IEVycm9yKCdFeHBlY3RlZCBVaW50OEFycmF5Jyk7XG4gIHJldHVybiBCaWdJbnQoJzB4JyArIGJ5dGVzVG9IZXgoVWludDhBcnJheS5mcm9tKHVpbnQ4YSkucmV2ZXJzZSgpKSk7XG59XG5cbmZ1bmN0aW9uIGJ5dGVzMjU1VG9OdW1iZXJMRShieXRlczogVWludDhBcnJheSk6IGJpZ2ludCB7XG4gIHJldHVybiBtb2QoYnl0ZXNUb051bWJlckxFKGJ5dGVzKSAmIChfMm4gKiogXzI1NW4gLSBfMW4pKTtcbn1cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gbW9kKGE6IGJpZ2ludCwgYjogYmlnaW50ID0gQ1VSVkUuUCkge1xuICBjb25zdCByZXMgPSBhICUgYjtcbiAgcmV0dXJuIHJlcyA+PSBfMG4gPyByZXMgOiBiICsgcmVzO1xufVxuXG4vLyBOb3RlOiB0aGlzIGVnY2QtYmFzZWQgaW52ZXJ0IGlzIDUwJSBmYXN0ZXIgdGhhbiBwb3dNb2QtYmFzZWQgb25lLlxuLy8gSW52ZXJzZXMgbnVtYmVyIG92ZXIgbW9kdWxvXG5mdW5jdGlvbiBpbnZlcnQobnVtYmVyOiBiaWdpbnQsIG1vZHVsbzogYmlnaW50ID0gQ1VSVkUuUCk6IGJpZ2ludCB7XG4gIGlmIChudW1iZXIgPT09IF8wbiB8fCBtb2R1bG8gPD0gXzBuKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBpbnZlcnQ6IGV4cGVjdGVkIHBvc2l0aXZlIGludGVnZXJzLCBnb3Qgbj0ke251bWJlcn0gbW9kPSR7bW9kdWxvfWApO1xuICB9XG4gIC8vIEV1Y2xlZGlhbiBHQ0QgaHR0cHM6Ly9icmlsbGlhbnQub3JnL3dpa2kvZXh0ZW5kZWQtZXVjbGlkZWFuLWFsZ29yaXRobS9cbiAgbGV0IGEgPSBtb2QobnVtYmVyLCBtb2R1bG8pO1xuICBsZXQgYiA9IG1vZHVsbztcbiAgLy8gcHJldHRpZXItaWdub3JlXG4gIGxldCB4ID0gXzBuLCB5ID0gXzFuLCB1ID0gXzFuLCB2ID0gXzBuO1xuICB3aGlsZSAoYSAhPT0gXzBuKSB7XG4gICAgY29uc3QgcSA9IGIgLyBhO1xuICAgIGNvbnN0IHIgPSBiICUgYTtcbiAgICBjb25zdCBtID0geCAtIHUgKiBxO1xuICAgIGNvbnN0IG4gPSB5IC0gdiAqIHE7XG4gICAgLy8gcHJldHRpZXItaWdub3JlXG4gICAgYiA9IGEsIGEgPSByLCB4ID0gdSwgeSA9IHYsIHUgPSBtLCB2ID0gbjtcbiAgfVxuICBjb25zdCBnY2QgPSBiO1xuICBpZiAoZ2NkICE9PSBfMW4pIHRocm93IG5ldyBFcnJvcignaW52ZXJ0OiBkb2VzIG5vdCBleGlzdCcpO1xuICByZXR1cm4gbW9kKHgsIG1vZHVsbyk7XG59XG5cbi8qKlxuICogVGFrZXMgYSBsaXN0IG9mIG51bWJlcnMsIGVmZmljaWVudGx5IGludmVydHMgYWxsIG9mIHRoZW0uXG4gKiBAcGFyYW0gbnVtcyBsaXN0IG9mIGJpZ2ludHNcbiAqIEBwYXJhbSBwIG1vZHVsb1xuICogQHJldHVybnMgbGlzdCBvZiBpbnZlcnRlZCBiaWdpbnRzXG4gKiBAZXhhbXBsZVxuICogaW52ZXJ0QmF0Y2goWzFuLCAybiwgNG5dLCAyMW4pO1xuICogLy8gPT4gWzFuLCAxMW4sIDE2bl1cbiAqL1xuZnVuY3Rpb24gaW52ZXJ0QmF0Y2gobnVtczogYmlnaW50W10sIHA6IGJpZ2ludCA9IENVUlZFLlApOiBiaWdpbnRbXSB7XG4gIGNvbnN0IHRtcCA9IG5ldyBBcnJheShudW1zLmxlbmd0aCk7XG4gIC8vIFdhbGsgZnJvbSBmaXJzdCB0byBsYXN0LCBtdWx0aXBseSB0aGVtIGJ5IGVhY2ggb3RoZXIgTU9EIHBcbiAgY29uc3QgbGFzdE11bHRpcGxpZWQgPSBudW1zLnJlZHVjZSgoYWNjLCBudW0sIGkpID0+IHtcbiAgICBpZiAobnVtID09PSBfMG4pIHJldHVybiBhY2M7XG4gICAgdG1wW2ldID0gYWNjO1xuICAgIHJldHVybiBtb2QoYWNjICogbnVtLCBwKTtcbiAgfSwgXzFuKTtcbiAgLy8gSW52ZXJ0IGxhc3QgZWxlbWVudFxuICBjb25zdCBpbnZlcnRlZCA9IGludmVydChsYXN0TXVsdGlwbGllZCwgcCk7XG4gIC8vIFdhbGsgZnJvbSBsYXN0IHRvIGZpcnN0LCBtdWx0aXBseSB0aGVtIGJ5IGludmVydGVkIGVhY2ggb3RoZXIgTU9EIHBcbiAgbnVtcy5yZWR1Y2VSaWdodCgoYWNjLCBudW0sIGkpID0+IHtcbiAgICBpZiAobnVtID09PSBfMG4pIHJldHVybiBhY2M7XG4gICAgdG1wW2ldID0gbW9kKGFjYyAqIHRtcFtpXSwgcCk7XG4gICAgcmV0dXJuIG1vZChhY2MgKiBudW0sIHApO1xuICB9LCBpbnZlcnRlZCk7XG4gIHJldHVybiB0bXA7XG59XG5cbi8vIERvZXMgeCBeICgyIF4gcG93ZXIpIG1vZCBwLiBwb3cyKDMwLCA0KSA9PSAzMCBeICgyIF4gNClcbmZ1bmN0aW9uIHBvdzIoeDogYmlnaW50LCBwb3dlcjogYmlnaW50KTogYmlnaW50IHtcbiAgY29uc3QgeyBQIH0gPSBDVVJWRTtcbiAgbGV0IHJlcyA9IHg7XG4gIHdoaWxlIChwb3dlci0tID4gXzBuKSB7XG4gICAgcmVzICo9IHJlcztcbiAgICByZXMgJT0gUDtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG4vLyBQb3dlciB0byAocC01KS84IGFrYSB4XigyXjI1Mi0zKVxuLy8gVXNlZCB0byBjYWxjdWxhdGUgeSAtIHRoZSBzcXVhcmUgcm9vdCBvZiB5wrIuXG4vLyBFeHBvbmVudGlhdGVzIGl0IHRvIHZlcnkgYmlnIG51bWJlci5cbi8vIFdlIGFyZSB1bndyYXBwaW5nIHRoZSBsb29wIGJlY2F1c2UgaXQncyAyeCBmYXN0ZXIuXG4vLyAoMm4qKjI1Mm4tM24pLnRvU3RyaW5nKDIpIHdvdWxkIHByb2R1Y2UgYml0cyBbMjUweCAxLCAwLCAxXVxuLy8gV2UgYXJlIG11bHRpcGx5aW5nIGl0IGJpdC1ieS1iaXRcbmZ1bmN0aW9uIHBvd18yXzI1Ml8zKHg6IGJpZ2ludCkge1xuICBjb25zdCB7IFAgfSA9IENVUlZFO1xuICBjb25zdCBfNW4gPSBCaWdJbnQoNSk7XG4gIGNvbnN0IF8xMG4gPSBCaWdJbnQoMTApO1xuICBjb25zdCBfMjBuID0gQmlnSW50KDIwKTtcbiAgY29uc3QgXzQwbiA9IEJpZ0ludCg0MCk7XG4gIGNvbnN0IF84MG4gPSBCaWdJbnQoODApO1xuICBjb25zdCB4MiA9ICh4ICogeCkgJSBQO1xuICBjb25zdCBiMiA9ICh4MiAqIHgpICUgUDsgLy8geF4zLCAxMVxuICBjb25zdCBiNCA9IChwb3cyKGIyLCBfMm4pICogYjIpICUgUDsgLy8geF4xNSwgMTExMVxuICBjb25zdCBiNSA9IChwb3cyKGI0LCBfMW4pICogeCkgJSBQOyAvLyB4XjMxXG4gIGNvbnN0IGIxMCA9IChwb3cyKGI1LCBfNW4pICogYjUpICUgUDtcbiAgY29uc3QgYjIwID0gKHBvdzIoYjEwLCBfMTBuKSAqIGIxMCkgJSBQO1xuICBjb25zdCBiNDAgPSAocG93MihiMjAsIF8yMG4pICogYjIwKSAlIFA7XG4gIGNvbnN0IGI4MCA9IChwb3cyKGI0MCwgXzQwbikgKiBiNDApICUgUDtcbiAgY29uc3QgYjE2MCA9IChwb3cyKGI4MCwgXzgwbikgKiBiODApICUgUDtcbiAgY29uc3QgYjI0MCA9IChwb3cyKGIxNjAsIF84MG4pICogYjgwKSAlIFA7XG4gIGNvbnN0IGIyNTAgPSAocG93MihiMjQwLCBfMTBuKSAqIGIxMCkgJSBQO1xuICBjb25zdCBwb3dfcF81XzggPSAocG93MihiMjUwLCBfMm4pICogeCkgJSBQO1xuICAvLyBeIFRvIHBvdyB0byAocCszKS84LCBtdWx0aXBseSBpdCBieSB4LlxuICByZXR1cm4geyBwb3dfcF81XzgsIGIyIH07XG59XG5cbi8vIFJhdGlvIG9mIHUgdG8gdi4gQWxsb3dzIHVzIHRvIGNvbWJpbmUgaW52ZXJzaW9uIGFuZCBzcXVhcmUgcm9vdC4gVXNlcyBhbGdvIGZyb20gUkZDODAzMiA1LjEuMy5cbi8vIENvbnN0YW50LXRpbWVcbi8vIHByZXR0aWVyLWlnbm9yZVxuZnVuY3Rpb24gdXZSYXRpbyh1OiBiaWdpbnQsIHY6IGJpZ2ludCk6IHsgaXNWYWxpZDogYm9vbGVhbiwgdmFsdWU6IGJpZ2ludCB9IHtcbiAgY29uc3QgdjMgPSBtb2QodiAqIHYgKiB2KTsgICAgICAgICAgICAgICAgICAvLyB2wrNcbiAgY29uc3QgdjcgPSBtb2QodjMgKiB2MyAqIHYpOyAgICAgICAgICAgICAgICAvLyB24oG3XG4gIGNvbnN0IHBvdyA9IHBvd18yXzI1Ml8zKHUgKiB2NykucG93X3BfNV84O1xuICBsZXQgeCA9IG1vZCh1ICogdjMgKiBwb3cpOyAgICAgICAgICAgICAgICAgIC8vICh1dsKzKSh1duKBtyleKHAtNSkvOFxuICBjb25zdCB2eDIgPSBtb2QodiAqIHggKiB4KTsgICAgICAgICAgICAgICAgIC8vIHZ4wrJcbiAgY29uc3Qgcm9vdDEgPSB4OyAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGaXJzdCByb290IGNhbmRpZGF0ZVxuICBjb25zdCByb290MiA9IG1vZCh4ICogU1FSVF9NMSk7ICAgICAgICAgICAgIC8vIFNlY29uZCByb290IGNhbmRpZGF0ZVxuICBjb25zdCB1c2VSb290MSA9IHZ4MiA9PT0gdTsgICAgICAgICAgICAgICAgIC8vIElmIHZ4wrIgPSB1IChtb2QgcCksIHggaXMgYSBzcXVhcmUgcm9vdFxuICBjb25zdCB1c2VSb290MiA9IHZ4MiA9PT0gbW9kKC11KTsgICAgICAgICAgIC8vIElmIHZ4wrIgPSAtdSwgc2V0IHggPC0tIHggKiAyXigocC0xKS80KVxuICBjb25zdCBub1Jvb3QgPSB2eDIgPT09IG1vZCgtdSAqIFNRUlRfTTEpOyAgIC8vIFRoZXJlIGlzIG5vIHZhbGlkIHJvb3QsIHZ4wrIgPSAtdeKImigtMSlcbiAgaWYgKHVzZVJvb3QxKSB4ID0gcm9vdDE7XG4gIGlmICh1c2VSb290MiB8fCBub1Jvb3QpIHggPSByb290MjsgICAgICAgICAgLy8gV2UgcmV0dXJuIHJvb3QyIGFueXdheSwgZm9yIGNvbnN0LXRpbWVcbiAgaWYgKGVkSXNOZWdhdGl2ZSh4KSkgeCA9IG1vZCgteCk7XG4gIHJldHVybiB7IGlzVmFsaWQ6IHVzZVJvb3QxIHx8IHVzZVJvb3QyLCB2YWx1ZTogeCB9O1xufVxuXG4vLyBDYWxjdWxhdGVzIDEv4oiaKG51bWJlcilcbmZ1bmN0aW9uIGludmVydFNxcnQobnVtYmVyOiBiaWdpbnQpIHtcbiAgcmV0dXJuIHV2UmF0aW8oXzFuLCBudW1iZXIpO1xufVxuLy8gTWF0aCBlbmRcblxuLy8gTGl0dGxlLWVuZGlhbiBTSEE1MTIgd2l0aCBtb2R1bG8gblxuYXN5bmMgZnVuY3Rpb24gc2hhNTEyTW9kcUxFKC4uLmFyZ3M6IFVpbnQ4QXJyYXlbXSk6IFByb21pc2U8YmlnaW50PiB7XG4gIGNvbnN0IGhhc2ggPSBhd2FpdCB1dGlscy5zaGE1MTIoY29uY2F0Qnl0ZXMoLi4uYXJncykpO1xuICBjb25zdCB2YWx1ZSA9IGJ5dGVzVG9OdW1iZXJMRShoYXNoKTtcbiAgcmV0dXJuIG1vZCh2YWx1ZSwgQ1VSVkUubCk7XG59XG5cbmZ1bmN0aW9uIGVxdWFsQnl0ZXMoYjE6IFVpbnQ4QXJyYXksIGIyOiBVaW50OEFycmF5KSB7XG4gIC8vIFdlIGRvbid0IGNhcmUgYWJvdXQgdGltaW5nIGF0dGFja3MgaGVyZVxuICBpZiAoYjEubGVuZ3RoICE9PSBiMi5sZW5ndGgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBiMS5sZW5ndGg7IGkrKykge1xuICAgIGlmIChiMVtpXSAhPT0gYjJbaV0pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGVuc3VyZUJ5dGVzKGhleDogSGV4LCBleHBlY3RlZExlbmd0aD86IG51bWJlcik6IFVpbnQ4QXJyYXkge1xuICAvLyBVaW50OEFycmF5LmZyb20oKSBpbnN0ZWFkIG9mIGhhc2guc2xpY2UoKSBiZWNhdXNlIG5vZGUuanMgQnVmZmVyXG4gIC8vIGlzIGluc3RhbmNlIG9mIFVpbnQ4QXJyYXksIGFuZCBpdHMgc2xpY2UoKSBjcmVhdGVzICoqbXV0YWJsZSoqIGNvcHlcbiAgY29uc3QgYnl0ZXMgPSBoZXggaW5zdGFuY2VvZiBVaW50OEFycmF5ID8gVWludDhBcnJheS5mcm9tKGhleCkgOiBoZXhUb0J5dGVzKGhleCk7XG4gIGlmICh0eXBlb2YgZXhwZWN0ZWRMZW5ndGggPT09ICdudW1iZXInICYmIGJ5dGVzLmxlbmd0aCAhPT0gZXhwZWN0ZWRMZW5ndGgpXG4gICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCAke2V4cGVjdGVkTGVuZ3RofSBieXRlc2ApO1xuICByZXR1cm4gYnl0ZXM7XG59XG5cbi8qKlxuICogQ2hlY2tzIGZvciBudW0gdG8gYmUgaW4gcmFuZ2U6XG4gKiBGb3Igc3RyaWN0ID09IHRydWU6ICBgMCA8ICBudW0gPCBtYXhgLlxuICogRm9yIHN0cmljdCA9PSBmYWxzZTogYDAgPD0gbnVtIDwgbWF4YC5cbiAqIENvbnZlcnRzIG5vbi1mbG9hdCBzYWZlIG51bWJlcnMgdG8gYmlnaW50cy5cbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplU2NhbGFyKG51bTogbnVtYmVyIHwgYmlnaW50LCBtYXg6IGJpZ2ludCwgc3RyaWN0ID0gdHJ1ZSk6IGJpZ2ludCB7XG4gIGlmICghbWF4KSB0aHJvdyBuZXcgVHlwZUVycm9yKCdTcGVjaWZ5IG1heCB2YWx1ZScpO1xuICBpZiAodHlwZW9mIG51bSA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzU2FmZUludGVnZXIobnVtKSkgbnVtID0gQmlnSW50KG51bSk7XG4gIGlmICh0eXBlb2YgbnVtID09PSAnYmlnaW50JyAmJiBudW0gPCBtYXgpIHtcbiAgICBpZiAoc3RyaWN0KSB7XG4gICAgICBpZiAoXzBuIDwgbnVtKSByZXR1cm4gbnVtO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoXzBuIDw9IG51bSkgcmV0dXJuIG51bTtcbiAgICB9XG4gIH1cbiAgdGhyb3cgbmV3IFR5cGVFcnJvcignRXhwZWN0ZWQgdmFsaWQgc2NhbGFyOiAwIDwgc2NhbGFyIDwgbWF4Jyk7XG59XG5cbmZ1bmN0aW9uIGFkanVzdEJ5dGVzMjU1MTkoYnl0ZXM6IFVpbnQ4QXJyYXkpOiBVaW50OEFycmF5IHtcbiAgLy8gU2VjdGlvbiA1OiBGb3IgWDI1NTE5LCBpbiBvcmRlciB0byBkZWNvZGUgMzIgcmFuZG9tIGJ5dGVzIGFzIGFuIGludGVnZXIgc2NhbGFyLFxuICAvLyBzZXQgdGhlIHRocmVlIGxlYXN0IHNpZ25pZmljYW50IGJpdHMgb2YgdGhlIGZpcnN0IGJ5dGVcbiAgYnl0ZXNbMF0gJj0gMjQ4OyAvLyAwYjExMTFfMTAwMFxuICAvLyBhbmQgdGhlIG1vc3Qgc2lnbmlmaWNhbnQgYml0IG9mIHRoZSBsYXN0IHRvIHplcm8sXG4gIGJ5dGVzWzMxXSAmPSAxMjc7IC8vIDBiMDExMV8xMTExXG4gIC8vIHNldCB0aGUgc2Vjb25kIG1vc3Qgc2lnbmlmaWNhbnQgYml0IG9mIHRoZSBsYXN0IGJ5dGUgdG8gMVxuICBieXRlc1szMV0gfD0gNjQ7IC8vIDBiMDEwMF8wMDAwXG4gIHJldHVybiBieXRlcztcbn1cblxuZnVuY3Rpb24gZGVjb2RlU2NhbGFyMjU1MTkobjogSGV4KTogYmlnaW50IHtcbiAgLy8gYW5kLCBmaW5hbGx5LCBkZWNvZGUgYXMgbGl0dGxlLWVuZGlhbi5cbiAgLy8gVGhpcyBtZWFucyB0aGF0IHRoZSByZXN1bHRpbmcgaW50ZWdlciBpcyBvZiB0aGUgZm9ybSAyIF4gMjU0IHBsdXMgZWlnaHQgdGltZXMgYSB2YWx1ZSBiZXR3ZWVuIDAgYW5kIDIgXiAyNTEgLSAxKGluY2x1c2l2ZSkuXG4gIHJldHVybiBieXRlc1RvTnVtYmVyTEUoYWRqdXN0Qnl0ZXMyNTUxOShlbnN1cmVCeXRlcyhuLCAzMikpKTtcbn1cblxuLy8gUHJpdmF0ZSBjb252ZW5pZW5jZSBtZXRob2Rcbi8vIFJGQzgwMzIgNS4xLjVcbmFzeW5jIGZ1bmN0aW9uIGdldEV4dGVuZGVkUHVibGljS2V5KGtleTogUHJpdktleSkge1xuICAvLyBOb3JtYWxpemUgYmlnaW50IC8gbnVtYmVyIC8gc3RyaW5nIHRvIFVpbnQ4QXJyYXlcbiAga2V5ID1cbiAgICB0eXBlb2Yga2V5ID09PSAnYmlnaW50JyB8fCB0eXBlb2Yga2V5ID09PSAnbnVtYmVyJ1xuICAgICAgPyBudW1iZXJUbzMyQnl0ZXNCRShub3JtYWxpemVTY2FsYXIoa2V5LCBNQVhfMjU2QikpXG4gICAgICA6IGVuc3VyZUJ5dGVzKGtleSk7XG4gIGlmIChrZXkubGVuZ3RoICE9PSAzMikgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCAzMiBieXRlc2ApO1xuICAvLyBoYXNoIHRvIHByb2R1Y2UgNjQgYnl0ZXNcbiAgY29uc3QgaGFzaGVkID0gYXdhaXQgdXRpbHMuc2hhNTEyKGtleSk7XG4gIC8vIEZpcnN0IDMyIGJ5dGVzIG9mIDY0YiB1bmlmb3JtaW5nbHkgcmFuZG9tIGlucHV0IGFyZSB0YWtlbixcbiAgLy8gY2xlYXJzIDMgYml0cyBvZiBpdCB0byBwcm9kdWNlIGEgcmFuZG9tIGZpZWxkIGVsZW1lbnQuXG4gIGNvbnN0IGhlYWQgPSBhZGp1c3RCeXRlczI1NTE5KGhhc2hlZC5zbGljZSgwLCAzMikpO1xuICAvLyBTZWNvbmQgMzIgYnl0ZXMgaXMgY2FsbGVkIGtleSBwcmVmaXggKDUuMS42KVxuICBjb25zdCBwcmVmaXggPSBoYXNoZWQuc2xpY2UoMzIsIDY0KTtcbiAgLy8gVGhlIGFjdHVhbCBwcml2YXRlIHNjYWxhclxuICBjb25zdCBzY2FsYXIgPSBtb2QoYnl0ZXNUb051bWJlckxFKGhlYWQpLCBDVVJWRS5sKTtcbiAgLy8gUG9pbnQgb24gRWR3YXJkcyBjdXJ2ZSBha2EgcHVibGljIGtleVxuICBjb25zdCBwb2ludCA9IFBvaW50LkJBU0UubXVsdGlwbHkoc2NhbGFyKTtcbiAgY29uc3QgcG9pbnRCeXRlcyA9IHBvaW50LnRvUmF3Qnl0ZXMoKTtcbiAgcmV0dXJuIHsgaGVhZCwgcHJlZml4LCBzY2FsYXIsIHBvaW50LCBwb2ludEJ5dGVzIH07XG59XG5cbi8vXG4vKipcbiAqIENhbGN1bGF0ZXMgZWQyNTUxOSBwdWJsaWMga2V5LlxuICogMS4gcHJpdmF0ZSBrZXkgaXMgaGFzaGVkIHdpdGggc2hhNTEyLCB0aGVuIGZpcnN0IDMyIGJ5dGVzIGFyZSB0YWtlbiBmcm9tIHRoZSBoYXNoXG4gKiAyLiAzIGxlYXN0IHNpZ25pZmljYW50IGJpdHMgb2YgdGhlIGZpcnN0IGJ5dGUgYXJlIGNsZWFyZWRcbiAqIFJGQzgwMzIgNS4xLjVcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFB1YmxpY0tleShwcml2YXRlS2V5OiBQcml2S2V5KTogUHJvbWlzZTxVaW50OEFycmF5PiB7XG4gIHJldHVybiAoYXdhaXQgZ2V0RXh0ZW5kZWRQdWJsaWNLZXkocHJpdmF0ZUtleSkpLnBvaW50Qnl0ZXM7XG59XG5cbi8qKlxuICogU2lnbnMgbWVzc2FnZSB3aXRoIHByaXZhdGVLZXkuXG4gKiBSRkM4MDMyIDUuMS42XG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzaWduKG1lc3NhZ2U6IEhleCwgcHJpdmF0ZUtleTogSGV4KTogUHJvbWlzZTxVaW50OEFycmF5PiB7XG4gIG1lc3NhZ2UgPSBlbnN1cmVCeXRlcyhtZXNzYWdlKTtcbiAgY29uc3QgeyBwcmVmaXgsIHNjYWxhciwgcG9pbnRCeXRlcyB9ID0gYXdhaXQgZ2V0RXh0ZW5kZWRQdWJsaWNLZXkocHJpdmF0ZUtleSk7XG4gIGNvbnN0IHIgPSBhd2FpdCBzaGE1MTJNb2RxTEUocHJlZml4LCBtZXNzYWdlKTsgLy8gciA9IGhhc2gocHJlZml4ICsgbXNnKVxuICBjb25zdCBSID0gUG9pbnQuQkFTRS5tdWx0aXBseShyKTsgLy8gUiA9IHJHXG4gIGNvbnN0IGsgPSBhd2FpdCBzaGE1MTJNb2RxTEUoUi50b1Jhd0J5dGVzKCksIHBvaW50Qnl0ZXMsIG1lc3NhZ2UpOyAvLyBrID0gaGFzaChSICsgUCArIG1zZylcbiAgY29uc3QgcyA9IG1vZChyICsgayAqIHNjYWxhciwgQ1VSVkUubCk7IC8vIHMgPSByICsga3BcbiAgcmV0dXJuIG5ldyBTaWduYXR1cmUoUiwgcykudG9SYXdCeXRlcygpO1xufVxuXG4vKipcbiAqIFZlcmlmaWVzIGVkMjU1MTkgc2lnbmF0dXJlIGFnYWluc3QgbWVzc2FnZSBhbmQgcHVibGljIGtleS5cbiAqIEFuIGV4dGVuZGVkIGdyb3VwIGVxdWF0aW9uIGlzIGNoZWNrZWQuXG4gKiBSRkM4MDMyIDUuMS43XG4gKiBDb21wbGlhbnQgd2l0aCBaSVAyMTU6XG4gKiAwIDw9IHNpZy5SL3B1YmxpY0tleSA8IDIqKjI1NiAoY2FuIGJlID49IGN1cnZlLlApXG4gKiAwIDw9IHNpZy5zIDwgbFxuICogTm90IGNvbXBsaWFudCB3aXRoIFJGQzgwMzI6IGl0J3Mgbm90IHBvc3NpYmxlIHRvIGNvbXBseSB0byBib3RoIFpJUCAmIFJGQyBhdCB0aGUgc2FtZSB0aW1lLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdmVyaWZ5KHNpZzogU2lnVHlwZSwgbWVzc2FnZTogSGV4LCBwdWJsaWNLZXk6IFB1YktleSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuICBtZXNzYWdlID0gZW5zdXJlQnl0ZXMobWVzc2FnZSk7XG4gIC8vIFdoZW4gaGV4IGlzIHBhc3NlZCwgd2UgY2hlY2sgcHVibGljIGtleSBmdWxseS5cbiAgLy8gV2hlbiBQb2ludCBpbnN0YW5jZSBpcyBwYXNzZWQsIHdlIGFzc3VtZSBpdCBoYXMgYWxyZWFkeSBiZWVuIGNoZWNrZWQsIGZvciBwZXJmb3JtYW5jZS5cbiAgLy8gSWYgdXNlciBwYXNzZXMgUG9pbnQvU2lnIGluc3RhbmNlLCB3ZSBhc3N1bWUgaXQgaGFzIGJlZW4gYWxyZWFkeSB2ZXJpZmllZC5cbiAgLy8gV2UgZG9uJ3QgY2hlY2sgaXRzIGVxdWF0aW9ucyBmb3IgcGVyZm9ybWFuY2UuIFdlIGRvIGNoZWNrIGZvciB2YWxpZCBib3VuZHMgZm9yIHMgdGhvdWdoXG4gIC8vIFdlIGFsd2F5cyBjaGVjayBmb3I6IGEpIHMgYm91bmRzLiBiKSBoZXggdmFsaWRpdHlcbiAgaWYgKCEocHVibGljS2V5IGluc3RhbmNlb2YgUG9pbnQpKSBwdWJsaWNLZXkgPSBQb2ludC5mcm9tSGV4KHB1YmxpY0tleSwgZmFsc2UpO1xuICBjb25zdCB7IHIsIHMgfSA9IHNpZyBpbnN0YW5jZW9mIFNpZ25hdHVyZSA/IHNpZy5hc3NlcnRWYWxpZGl0eSgpIDogU2lnbmF0dXJlLmZyb21IZXgoc2lnKTtcbiAgY29uc3QgU0IgPSBFeHRlbmRlZFBvaW50LkJBU0UubXVsdGlwbHlVbnNhZmUocyk7XG4gIGNvbnN0IGsgPSBhd2FpdCBzaGE1MTJNb2RxTEUoci50b1Jhd0J5dGVzKCksIHB1YmxpY0tleS50b1Jhd0J5dGVzKCksIG1lc3NhZ2UpO1xuICBjb25zdCBrQSA9IEV4dGVuZGVkUG9pbnQuZnJvbUFmZmluZShwdWJsaWNLZXkpLm11bHRpcGx5VW5zYWZlKGspO1xuICBjb25zdCBSa0EgPSBFeHRlbmRlZFBvaW50LmZyb21BZmZpbmUocikuYWRkKGtBKTtcbiAgLy8gWzhdW1NdQiA9IFs4XVIgKyBbOF1ba11BJ1xuICByZXR1cm4gUmtBLnN1YnRyYWN0KFNCKS5tdWx0aXBseVVuc2FmZShDVVJWRS5oKS5lcXVhbHMoRXh0ZW5kZWRQb2ludC5aRVJPKTtcbn1cblxuLyoqXG4gKiBDYWxjdWxhdGVzIFgyNTUxOSBESCBzaGFyZWQgc2VjcmV0IGZyb20gZWQyNTUxOSBwcml2YXRlICYgcHVibGljIGtleXMuXG4gKiBDdXJ2ZTI1NTE5IHVzZWQgaW4gWDI1NTE5IGNvbnN1bWVzIHByaXZhdGUga2V5cyBhcy1pcywgd2hpbGUgZWQyNTUxOSBoYXNoZXMgdGhlbSB3aXRoIHNoYTUxMi5cbiAqIFdoaWNoIG1lYW5zIHdlIHdpbGwgbmVlZCB0byBub3JtYWxpemUgZWQyNTUxOSBzZWVkcyB0byBcImhhc2hlZCByZXByXCIuXG4gKiBAcGFyYW0gcHJpdmF0ZUtleSBlZDI1NTE5IHByaXZhdGUga2V5XG4gKiBAcGFyYW0gcHVibGljS2V5IGVkMjU1MTkgcHVibGljIGtleVxuICogQHJldHVybnMgWDI1NTE5IHNoYXJlZCBrZXlcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFNoYXJlZFNlY3JldChwcml2YXRlS2V5OiBQcml2S2V5LCBwdWJsaWNLZXk6IEhleCk6IFByb21pc2U8VWludDhBcnJheT4ge1xuICBjb25zdCB7IGhlYWQgfSA9IGF3YWl0IGdldEV4dGVuZGVkUHVibGljS2V5KHByaXZhdGVLZXkpO1xuICBjb25zdCB1ID0gUG9pbnQuZnJvbUhleChwdWJsaWNLZXkpLnRvWDI1NTE5KCk7XG4gIHJldHVybiBjdXJ2ZTI1NTE5LnNjYWxhck11bHQoaGVhZCwgdSk7XG59XG5cbi8vIEVuYWJsZSBwcmVjb21wdXRlcy4gU2xvd3MgZG93biBmaXJzdCBwdWJsaWNLZXkgY29tcHV0YXRpb24gYnkgMjBtcy5cblBvaW50LkJBU0UuX3NldFdpbmRvd1NpemUoOCk7XG5cbi8vIGN1cnZlMjU1MTktcmVsYXRlZCBjb2RlXG4vLyBDdXJ2ZSBlcXVhdGlvbjogdl4yID0gdV4zICsgQSp1XjIgKyB1XG4vLyBodHRwczovL2RhdGF0cmFja2VyLmlldGYub3JnL2RvYy9odG1sL3JmYzc3NDhcblxuLy8gY3N3YXAgZnJvbSBSRkM3NzQ4XG5mdW5jdGlvbiBjc3dhcChzd2FwOiBiaWdpbnQsIHhfMjogYmlnaW50LCB4XzM6IGJpZ2ludCk6IFtiaWdpbnQsIGJpZ2ludF0ge1xuICBjb25zdCBkdW1teSA9IG1vZChzd2FwICogKHhfMiAtIHhfMykpO1xuICB4XzIgPSBtb2QoeF8yIC0gZHVtbXkpO1xuICB4XzMgPSBtb2QoeF8zICsgZHVtbXkpO1xuICByZXR1cm4gW3hfMiwgeF8zXTtcbn1cblxuLy8geDI1NTE5IGZyb20gNFxuLyoqXG4gKlxuICogQHBhcmFtIHBvaW50VSB1IGNvb3JkaW5hdGUgKHgpIG9uIE1vbnRnb21lcnkgQ3VydmUgMjU1MTlcbiAqIEBwYXJhbSBzY2FsYXIgYnkgd2hpY2ggdGhlIHBvaW50IHdvdWxkIGJlIG11bHRpcGxpZWRcbiAqIEByZXR1cm5zIG5ldyBQb2ludCBvbiBNb250Z29tZXJ5IGN1cnZlXG4gKi9cbmZ1bmN0aW9uIG1vbnRnb21lcnlMYWRkZXIocG9pbnRVOiBiaWdpbnQsIHNjYWxhcjogYmlnaW50KTogYmlnaW50IHtcbiAgY29uc3QgeyBQIH0gPSBDVVJWRTtcbiAgY29uc3QgdSA9IG5vcm1hbGl6ZVNjYWxhcihwb2ludFUsIFApO1xuICAvLyBTZWN0aW9uIDU6IEltcGxlbWVudGF0aW9ucyBNVVNUIGFjY2VwdCBub24tY2Fub25pY2FsIHZhbHVlcyBhbmQgcHJvY2VzcyB0aGVtIGFzXG4gIC8vIGlmIHRoZXkgaGFkIGJlZW4gcmVkdWNlZCBtb2R1bG8gdGhlIGZpZWxkIHByaW1lLlxuICBjb25zdCBrID0gbm9ybWFsaXplU2NhbGFyKHNjYWxhciwgUCk7XG4gIC8vIFRoZSBjb25zdGFudCBhMjQgaXMgKDQ4NjY2MiAtIDIpIC8gNCA9IDEyMTY2NSBmb3IgY3VydmUyNTUxOS9YMjU1MTlcbiAgY29uc3QgYTI0ID0gQmlnSW50KDEyMTY2NSk7XG4gIGNvbnN0IHhfMSA9IHU7XG4gIGxldCB4XzIgPSBfMW47XG4gIGxldCB6XzIgPSBfMG47XG4gIGxldCB4XzMgPSB1O1xuICBsZXQgel8zID0gXzFuO1xuICBsZXQgc3dhcCA9IF8wbjtcbiAgbGV0IHN3OiBbYmlnaW50LCBiaWdpbnRdO1xuICBmb3IgKGxldCB0ID0gQmlnSW50KDI1NSAtIDEpOyB0ID49IF8wbjsgdC0tKSB7XG4gICAgY29uc3Qga190ID0gKGsgPj4gdCkgJiBfMW47XG4gICAgc3dhcCBePSBrX3Q7XG4gICAgc3cgPSBjc3dhcChzd2FwLCB4XzIsIHhfMyk7XG4gICAgeF8yID0gc3dbMF07XG4gICAgeF8zID0gc3dbMV07XG4gICAgc3cgPSBjc3dhcChzd2FwLCB6XzIsIHpfMyk7XG4gICAgel8yID0gc3dbMF07XG4gICAgel8zID0gc3dbMV07XG4gICAgc3dhcCA9IGtfdDtcblxuICAgIGNvbnN0IEEgPSB4XzIgKyB6XzI7XG4gICAgY29uc3QgQUEgPSBtb2QoQSAqIEEpO1xuICAgIGNvbnN0IEIgPSB4XzIgLSB6XzI7XG4gICAgY29uc3QgQkIgPSBtb2QoQiAqIEIpO1xuICAgIGNvbnN0IEUgPSBBQSAtIEJCO1xuICAgIGNvbnN0IEMgPSB4XzMgKyB6XzM7XG4gICAgY29uc3QgRCA9IHhfMyAtIHpfMztcbiAgICBjb25zdCBEQSA9IG1vZChEICogQSk7XG4gICAgY29uc3QgQ0IgPSBtb2QoQyAqIEIpO1xuICAgIHhfMyA9IG1vZCgoREEgKyBDQikgKiogXzJuKTtcbiAgICB6XzMgPSBtb2QoeF8xICogKERBIC0gQ0IpICoqIF8ybik7XG4gICAgeF8yID0gbW9kKEFBICogQkIpO1xuICAgIHpfMiA9IG1vZChFICogKEFBICsgbW9kKGEyNCAqIEUpKSk7XG4gIH1cbiAgc3cgPSBjc3dhcChzd2FwLCB4XzIsIHhfMyk7XG4gIHhfMiA9IHN3WzBdO1xuICB4XzMgPSBzd1sxXTtcbiAgc3cgPSBjc3dhcChzd2FwLCB6XzIsIHpfMyk7XG4gIHpfMiA9IHN3WzBdO1xuICB6XzMgPSBzd1sxXTtcbiAgY29uc3QgeyBwb3dfcF81XzgsIGIyIH0gPSBwb3dfMl8yNTJfMyh6XzIpO1xuICAvLyB4XihwLTIpIGFrYSB4XigyXjI1NS0yMSlcbiAgY29uc3QgeHAyID0gbW9kKHBvdzIocG93X3BfNV84LCBCaWdJbnQoMykpICogYjIpO1xuICByZXR1cm4gbW9kKHhfMiAqIHhwMik7XG59XG5cbmZ1bmN0aW9uIGVuY29kZVVDb29yZGluYXRlKHU6IGJpZ2ludCk6IFVpbnQ4QXJyYXkge1xuICByZXR1cm4gbnVtYmVyVG8zMkJ5dGVzTEUobW9kKHUsIENVUlZFLlApKTtcbn1cblxuZnVuY3Rpb24gZGVjb2RlVUNvb3JkaW5hdGUodUVuYzogSGV4KTogYmlnaW50IHtcbiAgY29uc3QgdSA9IGVuc3VyZUJ5dGVzKHVFbmMsIDMyKTtcbiAgLy8gU2VjdGlvbiA1OiBXaGVuIHJlY2VpdmluZyBzdWNoIGFuIGFycmF5LCBpbXBsZW1lbnRhdGlvbnMgb2YgWDI1NTE5XG4gIC8vIE1VU1QgbWFzayB0aGUgbW9zdCBzaWduaWZpY2FudCBiaXQgaW4gdGhlIGZpbmFsIGJ5dGUuXG4gIHVbMzFdICY9IDEyNzsgLy8gMGIwMTExXzExMTFcbiAgcmV0dXJuIGJ5dGVzVG9OdW1iZXJMRSh1KTtcbn1cblxuZXhwb3J0IGNvbnN0IGN1cnZlMjU1MTkgPSB7XG4gIEJBU0VfUE9JTlRfVTogJzA5MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAnLFxuXG4gIC8vIGNyeXB0b19zY2FsYXJtdWx0IGFrYSBnZXRTaGFyZWRTZWNyZXRcbiAgc2NhbGFyTXVsdChwcml2YXRlS2V5OiBIZXgsIHB1YmxpY0tleTogSGV4KTogVWludDhBcnJheSB7XG4gICAgY29uc3QgdSA9IGRlY29kZVVDb29yZGluYXRlKHB1YmxpY0tleSk7XG4gICAgY29uc3QgcCA9IGRlY29kZVNjYWxhcjI1NTE5KHByaXZhdGVLZXkpO1xuICAgIGNvbnN0IHB1ID0gbW9udGdvbWVyeUxhZGRlcih1LCBwKTtcbiAgICAvLyBUaGUgcmVzdWx0IHdhcyBub3QgY29udHJpYnV0b3J5XG4gICAgLy8gaHR0cHM6Ly9jci55cC50by9lY2RoLmh0bWwjdmFsaWRhdGVcbiAgICBpZiAocHUgPT09IF8wbikgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHByaXZhdGUgb3IgcHVibGljIGtleSByZWNlaXZlZCcpO1xuICAgIHJldHVybiBlbmNvZGVVQ29vcmRpbmF0ZShwdSk7XG4gIH0sXG5cbiAgLy8gY3J5cHRvX3NjYWxhcm11bHRfYmFzZSBha2EgZ2V0UHVibGljS2V5XG4gIHNjYWxhck11bHRCYXNlKHByaXZhdGVLZXk6IEhleCk6IFVpbnQ4QXJyYXkge1xuICAgIHJldHVybiBjdXJ2ZTI1NTE5LnNjYWxhck11bHQocHJpdmF0ZUtleSwgY3VydmUyNTUxOS5CQVNFX1BPSU5UX1UpO1xuICB9LFxufTtcblxuLy8gR2xvYmFsIHN5bWJvbCBhdmFpbGFibGUgaW4gYnJvd3NlcnMgb25seS4gRW5zdXJlIHdlIGRvIG5vdCBkZXBlbmQgb24gQHR5cGVzL2RvbVxuZGVjbGFyZSBjb25zdCBzZWxmOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHwgdW5kZWZpbmVkO1xuY29uc3QgY3J5cHRvOiB7IG5vZGU/OiBhbnk7IHdlYj86IGFueSB9ID0ge1xuICBub2RlOiBub2RlQ3J5cHRvLFxuICB3ZWI6IHR5cGVvZiBzZWxmID09PSAnb2JqZWN0JyAmJiAnY3J5cHRvJyBpbiBzZWxmID8gc2VsZi5jcnlwdG8gOiB1bmRlZmluZWQsXG59O1xuXG5leHBvcnQgY29uc3QgdXRpbHMgPSB7XG4gIC8vIFRoZSA4LXRvcnNpb24gc3ViZ3JvdXAg4oSwOC5cbiAgLy8gVGhvc2UgYXJlIFwiYnVnZ3lcIiBwb2ludHMsIGlmIHlvdSBtdWx0aXBseSB0aGVtIGJ5IDgsIHlvdSdsbCByZWNlaXZlIFBvaW50LlpFUk8uXG4gIC8vIFBvcnRlZCBmcm9tIGN1cnZlMjU1MTktZGFsZWsuXG4gIFRPUlNJT05fU1VCR1JPVVA6IFtcbiAgICAnMDEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCcsXG4gICAgJ2M3MTc2YTcwM2Q0ZGQ4NGZiYTNjMGI3NjBkMTA2NzBmMmEyMDUzZmEyYzM5Y2NjNjRlYzdmZDc3OTJhYzAzN2EnLFxuICAgICcwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDgwJyxcbiAgICAnMjZlODk1OGZjMmIyMjdiMDQ1YzNmNDg5ZjJlZjk4ZjBkNWRmYWMwNWQzYzYzMzM5YjEzODAyODg2ZDUzZmMwNScsXG4gICAgJ2VjZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmN2YnLFxuICAgICcyNmU4OTU4ZmMyYjIyN2IwNDVjM2Y0ODlmMmVmOThmMGQ1ZGZhYzA1ZDNjNjMzMzliMTM4MDI4ODZkNTNmYzg1JyxcbiAgICAnMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCcsXG4gICAgJ2M3MTc2YTcwM2Q0ZGQ4NGZiYTNjMGI3NjBkMTA2NzBmMmEyMDUzZmEyYzM5Y2NjNjRlYzdmZDc3OTJhYzAzZmEnLFxuICBdLFxuICBieXRlc1RvSGV4LFxuICBnZXRFeHRlbmRlZFB1YmxpY0tleSxcbiAgbW9kLFxuICBpbnZlcnQsXG5cbiAgLyoqXG4gICAqIENhbiB0YWtlIDQwIG9yIG1vcmUgYnl0ZXMgb2YgdW5pZm9ybSBpbnB1dCBlLmcuIGZyb20gQ1NQUk5HIG9yIEtERlxuICAgKiBhbmQgY29udmVydCB0aGVtIGludG8gcHJpdmF0ZSBzY2FsYXIsIHdpdGggdGhlIG1vZHVsbyBiaWFzIGJlaW5nIG5lZ2xpYmxlLlxuICAgKiBBcyBwZXIgRklQUyAxODYgQi4xLjEuXG4gICAqIEBwYXJhbSBoYXNoIGhhc2ggb3V0cHV0IGZyb20gc2hhNTEyLCBvciBhIHNpbWlsYXIgZnVuY3Rpb25cbiAgICogQHJldHVybnMgdmFsaWQgcHJpdmF0ZSBzY2FsYXJcbiAgICovXG4gIGhhc2hUb1ByaXZhdGVTY2FsYXI6IChoYXNoOiBIZXgpOiBiaWdpbnQgPT4ge1xuICAgIGhhc2ggPSBlbnN1cmVCeXRlcyhoYXNoKTtcbiAgICBpZiAoaGFzaC5sZW5ndGggPCA0MCB8fCBoYXNoLmxlbmd0aCA+IDEwMjQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIDQwLTEwMjQgYnl0ZXMgb2YgcHJpdmF0ZSBrZXkgYXMgcGVyIEZJUFMgMTg2Jyk7XG4gICAgY29uc3QgbnVtID0gbW9kKGJ5dGVzVG9OdW1iZXJMRShoYXNoKSwgQ1VSVkUubCk7XG4gICAgLy8gVGhpcyBzaG91bGQgbmV2ZXIgaGFwcGVuXG4gICAgaWYgKG51bSA9PT0gXzBuIHx8IG51bSA9PT0gXzFuKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcHJpdmF0ZSBrZXknKTtcbiAgICByZXR1cm4gbnVtO1xuICB9LFxuXG4gIHJhbmRvbUJ5dGVzOiAoYnl0ZXNMZW5ndGg6IG51bWJlciA9IDMyKTogVWludDhBcnJheSA9PiB7XG4gICAgaWYgKGNyeXB0by53ZWIpIHtcbiAgICAgIHJldHVybiBjcnlwdG8ud2ViLmdldFJhbmRvbVZhbHVlcyhuZXcgVWludDhBcnJheShieXRlc0xlbmd0aCkpO1xuICAgIH0gZWxzZSBpZiAoY3J5cHRvLm5vZGUpIHtcbiAgICAgIGNvbnN0IHsgcmFuZG9tQnl0ZXMgfSA9IGNyeXB0by5ub2RlO1xuICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KHJhbmRvbUJ5dGVzKGJ5dGVzTGVuZ3RoKS5idWZmZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgZW52aXJvbm1lbnQgZG9lc24ndCBoYXZlIHJhbmRvbUJ5dGVzIGZ1bmN0aW9uXCIpO1xuICAgIH1cbiAgfSxcbiAgLy8gTm90ZTogZWQyNTUxOSBwcml2YXRlIGtleXMgYXJlIHVuaWZvcm0gMzItYml0IHN0cmluZ3MuIFdlIGRvIG5vdCBuZWVkXG4gIC8vIHRvIGNoZWNrIGZvciBtb2R1bG8gYmlhcyBsaWtlIHdlIGRvIGluIG5vYmxlLXNlY3AyNTZrMSByYW5kb21Qcml2YXRlS2V5KClcbiAgcmFuZG9tUHJpdmF0ZUtleTogKCk6IFVpbnQ4QXJyYXkgPT4ge1xuICAgIHJldHVybiB1dGlscy5yYW5kb21CeXRlcygzMik7XG4gIH0sXG4gIHNoYTUxMjogYXN5bmMgKG1lc3NhZ2U6IFVpbnQ4QXJyYXkpOiBQcm9taXNlPFVpbnQ4QXJyYXk+ID0+IHtcbiAgICBpZiAoY3J5cHRvLndlYikge1xuICAgICAgY29uc3QgYnVmZmVyID0gYXdhaXQgY3J5cHRvLndlYi5zdWJ0bGUuZGlnZXN0KCdTSEEtNTEyJywgbWVzc2FnZS5idWZmZXIpO1xuICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XG4gICAgfSBlbHNlIGlmIChjcnlwdG8ubm9kZSkge1xuICAgICAgcmV0dXJuIFVpbnQ4QXJyYXkuZnJvbShjcnlwdG8ubm9kZS5jcmVhdGVIYXNoKCdzaGE1MTInKS51cGRhdGUobWVzc2FnZSkuZGlnZXN0KCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgZW52aXJvbm1lbnQgZG9lc24ndCBoYXZlIHNoYTUxMiBmdW5jdGlvblwiKTtcbiAgICB9XG4gIH0sXG4gIC8qKlxuICAgKiBXZSdyZSBkb2luZyBzY2FsYXIgbXVsdGlwbGljYXRpb24gKHVzZWQgaW4gZ2V0UHVibGljS2V5IGV0Yykgd2l0aCBwcmVjb21wdXRlZCBCQVNFX1BPSU5UXG4gICAqIHZhbHVlcy4gVGhpcyBzbG93cyBkb3duIGZpcnN0IGdldFB1YmxpY0tleSgpIGJ5IG1pbGxpc2Vjb25kcyAoc2VlIFNwZWVkIHNlY3Rpb24pLFxuICAgKiBidXQgYWxsb3dzIHRvIHNwZWVkLXVwIHN1YnNlcXVlbnQgZ2V0UHVibGljS2V5KCkgY2FsbHMgdXAgdG8gMjB4LlxuICAgKiBAcGFyYW0gd2luZG93U2l6ZSAyLCA0LCA4LCAxNlxuICAgKi9cbiAgcHJlY29tcHV0ZSh3aW5kb3dTaXplID0gOCwgcG9pbnQgPSBQb2ludC5CQVNFKTogUG9pbnQge1xuICAgIGNvbnN0IGNhY2hlZCA9IHBvaW50LmVxdWFscyhQb2ludC5CQVNFKSA/IHBvaW50IDogbmV3IFBvaW50KHBvaW50LngsIHBvaW50LnkpO1xuICAgIGNhY2hlZC5fc2V0V2luZG93U2l6ZSh3aW5kb3dTaXplKTtcbiAgICBjYWNoZWQubXVsdGlwbHkoXzJuKTtcbiAgICByZXR1cm4gY2FjaGVkO1xuICB9LFxufTtcbiJdfQ==