/*! noble-ed25519 - MIT License (c) Paul Miller (paulmillr.com) */
const CURVE = {
    a: -1n,
    d: 37095705934669439343138083508754565189542113879843219016388785533085940283555n,
    P: 2n ** 255n - 19n,
    n: 2n ** 252n + 27742317777372353535851937790883648493n,
    h: 8n,
    Gx: 15112221349535400772501151409588531511454012693041857206046113283949847762202n,
    Gy: 46316835694926478169428394003475163141307993866256225615783033603165251855960n,
};
export { CURVE };
const ENCODING_LENGTH = 32;
const DIV_8_MINUS_3 = (CURVE.P + 3n) / 8n;
const I = powMod(2n, (CURVE.P + 1n) / 4n, CURVE.P);
const SQRT_M1 = 19681161376707505956807079304988542015446066515923890162744021073123829784752n;
const INVSQRT_A_MINUS_D = 54469307008909316920995813868745141605393597292927456921205312896311721017578n;
const SQRT_AD_MINUS_ONE = 25063068953384623474111414158702152701244531502492656460079210482610430750235n;
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
    static BASE = new ExtendedPoint(CURVE.Gx, CURVE.Gy, 1n, mod(CURVE.Gx * CURVE.Gy));
    static ZERO = new ExtendedPoint(0n, 1n, 1n, 0n);
    static fromAffine(p) {
        if (!(p instanceof Point)) {
            throw new TypeError('ExtendedPoint#fromAffine: expected Point');
        }
        if (p.equals(Point.ZERO))
            return ExtendedPoint.ZERO;
        return new ExtendedPoint(p.x, p.y, 1n, mod(p.x * p.y));
    }
    static toAffineBatch(points) {
        const toInv = invertBatch(points.map((p) => p.z));
        return points.map((p, i) => p.toAffine(toInv[i]));
    }
    static normalizeZ(points) {
        return this.toAffineBatch(points).map(this.fromAffine);
    }
    static fromRistrettoHash(hash) {
        const r1 = bytesToNumberRst(hash.slice(0, ENCODING_LENGTH));
        const R1 = this.elligatorRistrettoFlavor(r1);
        const r2 = bytesToNumberRst(hash.slice(ENCODING_LENGTH, ENCODING_LENGTH * 2));
        const R2 = this.elligatorRistrettoFlavor(r2);
        return R1.add(R2);
    }
    static elligatorRistrettoFlavor(r0) {
        const { d } = CURVE;
        const oneMinusDSq = mod(1n - d ** 2n);
        const dMinusOneSq = (d - 1n) ** 2n;
        const r = SQRT_M1 * (r0 * r0);
        const NS = mod((r + 1n) * oneMinusDSq);
        let c = mod(-1n);
        const D = mod((c - d * r) * mod(r + d));
        let { isNotZeroSquare, value: S } = sqrtRatio(NS, D);
        let sPrime = mod(S * r0);
        sPrime = edIsNegative(sPrime) ? sPrime : mod(-sPrime);
        S = isNotZeroSquare ? S : sPrime;
        c = isNotZeroSquare ? c : r;
        const NT = c * (r - 1n) * dMinusOneSq - D;
        const sSquared = S * S;
        const W0 = (S + S) * D;
        const W1 = NT * SQRT_AD_MINUS_ONE;
        const W2 = 1n - sSquared;
        const W3 = 1n + sSquared;
        return new ExtendedPoint(mod(W0 * W3), mod(W2 * W1), mod(W1 * W3), mod(W0 * W2));
    }
    static fromRistrettoBytes(bytes) {
        const s = bytesToNumberRst(bytes);
        const sEncodingIsCanonical = equalBytes(numberToBytesPadded(s, ENCODING_LENGTH), bytes);
        const sIsNegative = edIsNegative(s);
        if (!sEncodingIsCanonical || sIsNegative) {
            throw new Error('Cannot convert bytes to Ristretto Point');
        }
        const s2 = s * s;
        const u1 = 1n - s2;
        const u2 = 1n + s2;
        const squaredU2 = u2 * u2;
        const v = u1 * u1 * -CURVE.d - squaredU2;
        const { isNotZeroSquare, value: I } = invertSqrt(mod(v * squaredU2));
        const Dx = I * u2;
        const Dy = I * Dx * v;
        let x = mod((s + s) * Dx);
        if (edIsNegative(x))
            x = mod(-x);
        const y = mod(u1 * Dy);
        const t = mod(x * y);
        if (!isNotZeroSquare || edIsNegative(t) || y === 0n) {
            throw new Error('Cannot convert bytes to Ristretto Point');
        }
        return new ExtendedPoint(x, y, 1n, t);
    }
    toRistrettoBytes() {
        let { x, y, z, t } = this;
        const u1 = (z + y) * (z - y);
        const u2 = x * y;
        const { value: invsqrt } = invertSqrt(mod(u2 ** 2n * u1));
        const i1 = invsqrt * u1;
        const i2 = invsqrt * u2;
        const invz = i1 * i2 * t;
        let invDeno = i2;
        if (edIsNegative(t * invz)) {
            const iX = mod(x * SQRT_M1);
            const iY = mod(y * SQRT_M1);
            x = iY;
            y = iX;
            invDeno = mod(i1 * INVSQRT_A_MINUS_D);
        }
        if (edIsNegative(x * invz))
            y = mod(-y);
        let s = mod((z - y) * invDeno);
        if (edIsNegative(s))
            s = mod(-s);
        return numberToBytesPadded(s, ENCODING_LENGTH);
    }
    equals(other) {
        const a = this;
        const b = other;
        const [T1, T2, Z1, Z2] = [a.t, b.t, a.z, b.z];
        return mod(T1 * Z2) === mod(T2 * Z1);
    }
    negate() {
        return new ExtendedPoint(mod(-this.x), this.y, this.z, mod(-this.t));
    }
    double() {
        const X1 = this.x;
        const Y1 = this.y;
        const Z1 = this.z;
        const { a } = CURVE;
        const A = mod(X1 ** 2n);
        const B = mod(Y1 ** 2n);
        const C = mod(2n * Z1 ** 2n);
        const D = mod(a * A);
        const E = mod((X1 + Y1) ** 2n - A - B);
        const G = mod(D + B);
        const F = mod(G - C);
        const H = mod(D - B);
        const X3 = mod(E * F);
        const Y3 = mod(G * H);
        const T3 = mod(E * H);
        const Z3 = mod(F * G);
        return new ExtendedPoint(X3, Y3, Z3, T3);
    }
    add(other) {
        const X1 = this.x;
        const Y1 = this.y;
        const Z1 = this.z;
        const T1 = this.t;
        const X2 = other.x;
        const Y2 = other.y;
        const Z2 = other.z;
        const T2 = other.t;
        const A = mod((Y1 - X1) * (Y2 + X2));
        const B = mod((Y1 + X1) * (Y2 - X2));
        const F = mod(B - A);
        if (F === 0n) {
            return this.double();
        }
        const C = mod(Z1 * 2n * T2);
        const D = mod(T1 * 2n * Z2);
        const E = mod(D + C);
        const G = mod(B + A);
        const H = mod(D - C);
        const X3 = mod(E * F);
        const Y3 = mod(G * H);
        const T3 = mod(E * H);
        const Z3 = mod(F * G);
        return new ExtendedPoint(X3, Y3, Z3, T3);
    }
    subtract(other) {
        return this.add(other.negate());
    }
    multiplyUnsafe(scalar) {
        if (typeof scalar !== 'number' && typeof scalar !== 'bigint') {
            throw new TypeError('Point#multiply: expected number or bigint');
        }
        let n = mod(BigInt(scalar), CURVE.n);
        if (n <= 0) {
            throw new Error('Point#multiply: invalid scalar, expected positive integer');
        }
        let p = ExtendedPoint.ZERO;
        let d = this;
        while (n > 0n) {
            if (n & 1n)
                p = p.add(d);
            d = d.double();
            n >>= 1n;
        }
        return p;
    }
    precomputeWindow(W) {
        const windows = 256 / W + 1;
        let points = [];
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
        const windows = 256 / W + 1;
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
                n += 1n;
            }
            if (wbits === 0) {
                f = f.add(window % 2 ? precomputes[offset].negate() : precomputes[offset]);
            }
            else {
                const cached = precomputes[offset + Math.abs(wbits) - 1];
                p = p.add(wbits < 0 ? cached.negate() : cached);
            }
        }
        return [p, f];
    }
    multiply(scalar, affinePoint) {
        if (typeof scalar !== 'number' && typeof scalar !== 'bigint') {
            throw new TypeError('Point#multiply: expected number or bigint');
        }
        const n = mod(BigInt(scalar), CURVE.n);
        if (n <= 0) {
            throw new Error('Point#multiply: invalid scalar, expected positive integer');
        }
        return ExtendedPoint.normalizeZ(this.wNAF(n, affinePoint))[0];
    }
    toAffine(invZ = invert(this.z)) {
        const x = mod(this.x * invZ);
        const y = mod(this.y * invZ);
        return new Point(x, y);
    }
}
const pointPrecomputes = new WeakMap();
class Point {
    x;
    y;
    static BASE = new Point(CURVE.Gx, CURVE.Gy);
    static ZERO = new Point(0n, 1n);
    _WINDOW_SIZE;
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    _setWindowSize(windowSize) {
        this._WINDOW_SIZE = windowSize;
        pointPrecomputes.delete(this);
    }
    static fromHex(hash) {
        const { d, P } = CURVE;
        const bytes = hash instanceof Uint8Array ? hash : hexToBytes(hash);
        const len = bytes.length - 1;
        const normedLast = bytes[len] & ~0x80;
        const isLastByteOdd = (bytes[len] & 0x80) !== 0;
        const normed = Uint8Array.from(Array.from(bytes.slice(0, len)).concat(normedLast));
        const y = bytesToNumberLE(normed);
        if (y >= P) {
            throw new Error('Point#fromHex expects hex <= Fp');
        }
        const sqrY = y * y;
        const sqrX = mod((sqrY - 1n) * invert(d * sqrY + 1n));
        let x = powMod(sqrX, DIV_8_MINUS_3);
        if (mod(x * x - sqrX) !== 0n) {
            x = mod(x * I);
        }
        const isXOdd = (x & 1n) === 1n;
        if (isLastByteOdd !== isXOdd) {
            x = mod(-x);
        }
        return new Point(x, y);
    }
    toRawBytes() {
        const hex = numberToHex(this.y);
        const u8 = new Uint8Array(ENCODING_LENGTH);
        for (let i = hex.length - 2, j = 0; j < ENCODING_LENGTH && i >= 0; i -= 2, j++) {
            u8[j] = parseInt(hex[i] + hex[i + 1], 16);
        }
        const mask = this.x & 1n ? 0x80 : 0;
        u8[ENCODING_LENGTH - 1] |= mask;
        return u8;
    }
    toHex() {
        return bytesToHex(this.toRawBytes());
    }
    toX25519() {
        return mod((1n + this.y) * invert(1n - this.y));
    }
    equals(other) {
        return this.x === other.x && this.y === other.y;
    }
    negate() {
        return new Point(this.x, mod(-this.y));
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
class SignResult {
    r;
    s;
    constructor(r, s) {
        this.r = r;
        this.s = s;
    }
    static fromHex(hex) {
        hex = ensureBytes(hex);
        const r = Point.fromHex(hex.slice(0, 32));
        const s = bytesToNumberLE(hex.slice(32));
        return new SignResult(r, s);
    }
    toRawBytes() {
        const numberBytes = hexToBytes(numberToHex(this.s)).reverse();
        const sBytes = new Uint8Array(ENCODING_LENGTH);
        sBytes.set(numberBytes);
        const res = new Uint8Array(ENCODING_LENGTH * 2);
        res.set(this.r.toRawBytes());
        res.set(sBytes, 32);
        return res;
    }
    toHex() {
        return bytesToHex(this.toRawBytes());
    }
}
export { ExtendedPoint, Point, SignResult };
function concatBytes(...arrays) {
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
function bytesToHex(uint8a) {
    let hex = '';
    for (let i = 0; i < uint8a.length; i++) {
        hex += uint8a[i].toString(16).padStart(2, '0');
    }
    return hex;
}
function pad64(num) {
    return num.toString(16).padStart(ENCODING_LENGTH * 2, '0');
}
function hexToBytes(hex) {
    hex = hex.length & 1 ? `0${hex}` : hex;
    const array = new Uint8Array(hex.length / 2);
    for (let i = 0; i < array.length; i++) {
        let j = i * 2;
        array[i] = Number.parseInt(hex.slice(j, j + 2), 16);
    }
    return array;
}
function numberToHex(num) {
    const hex = num.toString(16);
    return hex.length & 1 ? `0${hex}` : hex;
}
function numberToBytesPadded(num, length = ENCODING_LENGTH) {
    const hex = numberToHex(num).padStart(length * 2, '0');
    return hexToBytes(hex).reverse();
}
function edIsNegative(num) {
    const hex = numberToHex(mod(num));
    const byte = Number.parseInt(hex.slice(hex.length - 2, hex.length), 16);
    return Boolean(byte & 1);
}
function bytesToNumberLE(uint8a) {
    let value = 0n;
    for (let i = 0; i < uint8a.length; i++) {
        value += BigInt(uint8a[i]) << (8n * BigInt(i));
    }
    return value;
}
function load8(input, padding = 0) {
    return (BigInt(input[0 + padding]) |
        (BigInt(input[1 + padding]) << 8n) |
        (BigInt(input[2 + padding]) << 16n) |
        (BigInt(input[3 + padding]) << 24n) |
        (BigInt(input[4 + padding]) << 32n) |
        (BigInt(input[5 + padding]) << 40n) |
        (BigInt(input[6 + padding]) << 48n) |
        (BigInt(input[7 + padding]) << 56n));
}
const low51bitMask = (1n << 51n) - 1n;
function bytesToNumberRst(bytes) {
    const octet1 = load8(bytes, 0) & low51bitMask;
    const octet2 = (load8(bytes, 6) >> 3n) & low51bitMask;
    const octet3 = (load8(bytes, 12) >> 6n) & low51bitMask;
    const octet4 = (load8(bytes, 19) >> 1n) & low51bitMask;
    const octet5 = (load8(bytes, 24) >> 12n) & low51bitMask;
    return mod(octet1 + (octet2 << 51n) + (octet3 << 102n) + (octet4 << 153n) + (octet5 << 204n));
}
function mod(a, b = CURVE.P) {
    const res = a % b;
    return res >= 0n ? res : b + res;
}
function powMod(a, power, m = CURVE.P) {
    let res = 1n;
    while (power > 0n) {
        if (power & 1n) {
            res = mod(res * a, m);
        }
        power >>= 1n;
        a = mod(a * a, m);
    }
    return res;
}
function egcd(a, b) {
    let [x, y, u, v] = [0n, 1n, 1n, 0n];
    while (a !== 0n) {
        let q = b / a;
        let r = b % a;
        let m = x - u * q;
        let n = y - v * q;
        [b, a] = [a, r];
        [x, y] = [u, v];
        [u, v] = [m, n];
    }
    let gcd = b;
    return [gcd, x, y];
}
function invert(number, modulo = CURVE.P) {
    if (number === 0n || modulo <= 0n) {
        throw new Error('invert: expected positive integers');
    }
    let [gcd, x] = egcd(mod(number, modulo), modulo);
    if (gcd !== 1n) {
        throw new Error('invert: does not exist');
    }
    return mod(x, modulo);
}
function invertBatch(nums, n = CURVE.P) {
    const len = nums.length;
    const scratch = new Array(len);
    let acc = 1n;
    for (let i = 0; i < len; i++) {
        if (nums[i] === 0n)
            continue;
        scratch[i] = acc;
        acc = mod(acc * nums[i], n);
    }
    acc = invert(acc, n);
    for (let i = len - 1; i >= 0; i--) {
        if (nums[i] === 0n)
            continue;
        let tmp = mod(acc * nums[i], n);
        nums[i] = mod(acc * scratch[i], n);
        acc = tmp;
    }
    return nums;
}
function invertSqrt(number) {
    return sqrtRatio(1n, number);
}
function powMod2(t, power) {
    const { P } = CURVE;
    let res = t;
    while (power-- > 0n) {
        res *= res;
        res %= P;
    }
    return res;
}
function pow_2_252_3(t) {
    t = mod(t);
    const { P } = CURVE;
    const t0 = (t * t) % P;
    const t1 = t0 ** 4n % P;
    const t2 = (t * t1) % P;
    const t3 = (t0 * t2) % P;
    const t4 = t3 ** 2n % P;
    const t5 = (t2 * t4) % P;
    const t6 = powMod2(t5, 5n);
    const t7 = (t6 * t5) % P;
    const t8 = powMod2(t7, 10n);
    const t9 = (t8 * t7) % P;
    const t10 = powMod2(t9, 20n);
    const t11 = (t10 * t9) % P;
    const t12 = powMod2(t11, 10n);
    const t13 = (t12 * t7) % P;
    const t14 = powMod2(t13, 50n);
    const t15 = (t14 * t13) % P;
    const t16 = powMod2(t15, 100n);
    const t17 = (t16 * t15) % P;
    const t18 = powMod2(t17, 50n);
    const t19 = (t18 * t13) % P;
    const t20 = (t19 * t19) % P;
    const t21 = (t20 * t20 * t) % P;
    return t21;
}
function sqrtRatio(t, v) {
    const v3 = mod(v * v * v);
    const v7 = mod(v3 * v3 * v);
    let r = mod(pow_2_252_3(t * v7) * t * v3);
    const check = mod(r * r * v);
    const i = SQRT_M1;
    const correctSignSqrt = check === t;
    const flippedSignSqrt = check === mod(-t);
    const flippedSignSqrtI = check === mod(mod(-t) * i);
    const rPrime = mod(SQRT_M1 * r);
    r = flippedSignSqrt || flippedSignSqrtI ? rPrime : r;
    if (edIsNegative(r))
        r = mod(-r);
    const isNotZeroSquare = correctSignSqrt || flippedSignSqrt;
    return { isNotZeroSquare, value: mod(r) };
}
async function sha512ToNumberLE(...args) {
    const messageArray = concatBytes(...args);
    const hash = await utils.sha512(messageArray);
    const value = bytesToNumberLE(hash);
    return mod(value, CURVE.n);
}
function keyPrefix(privateBytes) {
    return privateBytes.slice(ENCODING_LENGTH);
}
function encodePrivate(privateBytes) {
    const last = ENCODING_LENGTH - 1;
    const head = privateBytes.slice(0, ENCODING_LENGTH);
    head[0] &= 248;
    head[last] &= 127;
    head[last] |= 64;
    return bytesToNumberLE(head);
}
function ensureBytes(hash) {
    return hash instanceof Uint8Array ? hash : hexToBytes(hash);
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
function ensurePrivInputBytes(privateKey) {
    if (privateKey instanceof Uint8Array)
        return privateKey;
    if (typeof privateKey === 'string')
        return hexToBytes(privateKey.padStart(ENCODING_LENGTH * 2, '0'));
    return hexToBytes(pad64(BigInt(privateKey)));
}
export async function getPublicKey(privateKey) {
    const privBytes = await utils.sha512(ensurePrivInputBytes(privateKey));
    const publicKey = Point.BASE.multiply(encodePrivate(privBytes));
    return typeof privateKey === 'string' ? publicKey.toHex() : publicKey.toRawBytes();
}
export async function sign(hash, privateKey) {
    const privBytes = await utils.sha512(ensurePrivInputBytes(privateKey));
    const p = encodePrivate(privBytes);
    const P = Point.BASE.multiply(p);
    const msg = ensureBytes(hash);
    const r = await sha512ToNumberLE(keyPrefix(privBytes), msg);
    const R = Point.BASE.multiply(r);
    const h = await sha512ToNumberLE(R.toRawBytes(), P.toRawBytes(), msg);
    const S = mod(r + h * p, CURVE.n);
    const sig = new SignResult(R, S);
    return typeof hash === 'string' ? sig.toHex() : sig.toRawBytes();
}
export async function verify(signature, hash, publicKey) {
    hash = ensureBytes(hash);
    if (!(publicKey instanceof Point))
        publicKey = Point.fromHex(publicKey);
    if (!(signature instanceof SignResult))
        signature = SignResult.fromHex(signature);
    const h = await sha512ToNumberLE(signature.r.toRawBytes(), publicKey.toRawBytes(), hash);
    const Ph = ExtendedPoint.fromAffine(publicKey).multiplyUnsafe(h);
    const Gs = ExtendedPoint.BASE.multiply(signature.s);
    const RPh = ExtendedPoint.fromAffine(signature.r).add(Ph);
    return Gs.equals(RPh);
}
Point.BASE._setWindowSize(8);
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
    randomPrivateKey: (bytesLength = 32) => {
        if (typeof window == 'object' && 'crypto' in window) {
            return window.crypto.getRandomValues(new Uint8Array(bytesLength));
        }
        else if (typeof process === 'object' && 'node' in process.versions) {
            const { randomBytes } = require('crypto');
            return new Uint8Array(randomBytes(bytesLength).buffer);
        }
        else {
            throw new Error("The environment doesn't have randomBytes function");
        }
    },
    sha512: async (message) => {
        if (typeof window == 'object' && 'crypto' in window) {
            const buffer = await window.crypto.subtle.digest('SHA-512', message.buffer);
            return new Uint8Array(buffer);
        }
        else if (typeof process === 'object' && 'node' in process.versions) {
            const { createHash } = require('crypto');
            const hash = createHash('sha512');
            hash.update(message);
            return Uint8Array.from(hash.digest());
        }
        else {
            throw new Error("The environment doesn't have sha512 function");
        }
    },
    precompute(windowSize = 8, point = Point.BASE) {
        const cached = point.equals(Point.BASE) ? point : new Point(point.x, point.y);
        cached._setWindowSize(windowSize);
        cached.multiply(1n);
        return cached;
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxrRUFBa0U7QUFNbEUsTUFBTSxLQUFLLEdBQUc7SUFFWixDQUFDLEVBQUUsQ0FBQyxFQUFFO0lBR04sQ0FBQyxFQUFFLDhFQUE4RTtJQUVqRixDQUFDLEVBQUUsRUFBRSxJQUFJLElBQUksR0FBRyxHQUFHO0lBRW5CLENBQUMsRUFBRSxFQUFFLElBQUksSUFBSSxHQUFHLHVDQUF1QztJQUV2RCxDQUFDLEVBQUUsRUFBRTtJQUVMLEVBQUUsRUFBRSw4RUFBOEU7SUFDbEYsRUFBRSxFQUFFLDhFQUE4RTtDQUNuRixDQUFDO0FBR0YsT0FBTyxFQUFFLEtBQUssRUFBRSxDQUFDO0FBTWpCLE1BQU0sZUFBZSxHQUFHLEVBQUUsQ0FBQztBQUczQixNQUFNLGFBQWEsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBRzFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFHbkQsTUFBTSxPQUFPLEdBQUcsOEVBQThFLENBQUM7QUFHL0YsTUFBTSxpQkFBaUIsR0FBRyw4RUFBOEUsQ0FBQztBQUd6RyxNQUFNLGlCQUFpQixHQUFHLDhFQUE4RSxDQUFDO0FBS3pHLE1BQU0sYUFBYTtJQUNFO0lBQWtCO0lBQWtCO0lBQWtCO0lBQXpFLFlBQW1CLENBQVMsRUFBUyxDQUFTLEVBQVMsQ0FBUyxFQUFTLENBQVM7UUFBL0QsTUFBQyxHQUFELENBQUMsQ0FBUTtRQUFTLE1BQUMsR0FBRCxDQUFDLENBQVE7UUFBUyxNQUFDLEdBQUQsQ0FBQyxDQUFRO1FBQVMsTUFBQyxHQUFELENBQUMsQ0FBUTtJQUFHLENBQUM7SUFFdEYsTUFBTSxDQUFDLElBQUksR0FBRyxJQUFJLGFBQWEsQ0FBQyxLQUFLLENBQUMsRUFBRSxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxHQUFHLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ2xGLE1BQU0sQ0FBQyxJQUFJLEdBQUcsSUFBSSxhQUFhLENBQUMsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDaEQsTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFRO1FBQ3hCLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBWSxLQUFLLENBQUMsRUFBRTtZQUN6QixNQUFNLElBQUksU0FBUyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7U0FDakU7UUFDRCxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUFFLE9BQU8sYUFBYSxDQUFDLElBQUksQ0FBQztRQUNwRCxPQUFPLElBQUksYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUlELE1BQU0sQ0FBQyxhQUFhLENBQUMsTUFBdUI7UUFDMUMsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2xELE9BQU8sTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBRUQsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUF1QjtRQUN2QyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBS0QsTUFBTSxDQUFDLGlCQUFpQixDQUFDLElBQWdCO1FBQ3ZDLE1BQU0sRUFBRSxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxDQUFDLENBQUM7UUFDNUQsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUFDLEVBQUUsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sRUFBRSxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxFQUFFLGVBQWUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlFLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM3QyxPQUFPLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDcEIsQ0FBQztJQUtPLE1BQU0sQ0FBQyx3QkFBd0IsQ0FBQyxFQUFVO1FBQ2hELE1BQU0sRUFBRSxDQUFDLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFDcEIsTUFBTSxXQUFXLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxDQUFDLElBQUksRUFBRSxDQUFDLENBQUM7UUFDdEMsTUFBTSxXQUFXLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ25DLE1BQU0sQ0FBQyxHQUFHLE9BQU8sR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUM5QixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsV0FBVyxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDakIsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDeEMsSUFBSSxFQUFFLGVBQWUsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLEdBQUcsU0FBUyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNyRCxJQUFJLE1BQU0sR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQ3pCLE1BQU0sR0FBRyxZQUFZLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDdEQsQ0FBQyxHQUFHLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7UUFDakMsQ0FBQyxHQUFHLGVBQWUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDNUIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLFdBQVcsR0FBRyxDQUFDLENBQUM7UUFDMUMsTUFBTSxRQUFRLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN2QixNQUFNLEVBQUUsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDdkIsTUFBTSxFQUFFLEdBQUcsRUFBRSxHQUFHLGlCQUFpQixDQUFDO1FBQ2xDLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxRQUFRLENBQUM7UUFDekIsTUFBTSxFQUFFLEdBQUcsRUFBRSxHQUFHLFFBQVEsQ0FBQztRQUN6QixPQUFPLElBQUksYUFBYSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztJQUNuRixDQUFDO0lBRUQsTUFBTSxDQUFDLGtCQUFrQixDQUFDLEtBQWlCO1FBV3pDLE1BQU0sQ0FBQyxHQUFHLGdCQUFnQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sb0JBQW9CLEdBQUcsVUFBVSxDQUFDLG1CQUFtQixDQUFDLENBQUMsRUFBRSxlQUFlLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN4RixNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDcEMsSUFBSSxDQUFDLG9CQUFvQixJQUFJLFdBQVcsRUFBRTtZQUN4QyxNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7U0FDNUQ7UUFDRCxNQUFNLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2pCLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUM7UUFDbkIsTUFBTSxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsQ0FBQztRQUNuQixNQUFNLFNBQVMsR0FBRyxFQUFFLEdBQUcsRUFBRSxDQUFDO1FBRTFCLE1BQU0sQ0FBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLFNBQVMsQ0FBQztRQUN6QyxNQUFNLEVBQUUsZUFBZSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ3JFLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7UUFDbEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFFdEIsSUFBSSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBQzFCLElBQUksWUFBWSxDQUFDLENBQUMsQ0FBQztZQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVqQyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxDQUFDO1FBRXZCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDckIsSUFBSSxDQUFDLGVBQWUsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsRUFBRTtZQUNuRCxNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7U0FDNUQ7UUFDRCxPQUFPLElBQUksYUFBYSxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRCxnQkFBZ0I7UUFDZCxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDO1FBRTFCLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQzdCLE1BQU0sRUFBRSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFFakIsTUFBTSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMxRCxNQUFNLEVBQUUsR0FBRyxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ3hCLE1BQU0sRUFBRSxHQUFHLE9BQU8sR0FBRyxFQUFFLENBQUM7UUFDeEIsTUFBTSxJQUFJLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDekIsSUFBSSxPQUFPLEdBQUcsRUFBRSxDQUFDO1FBQ2pCLElBQUksWUFBWSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsRUFBRTtZQUUxQixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxDQUFDO1lBQzVCLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUM7WUFDNUIsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNQLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDUCxPQUFPLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDO1NBQ3ZDO1FBQ0QsSUFBSSxZQUFZLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQztZQUFFLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN4QyxJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLENBQUM7UUFDL0IsSUFBSSxZQUFZLENBQUMsQ0FBQyxDQUFDO1lBQUUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2pDLE9BQU8sbUJBQW1CLENBQUMsQ0FBQyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFJRCxNQUFNLENBQUMsS0FBb0I7UUFDekIsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDO1FBQ2YsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDO1FBQ2hCLE1BQU0sQ0FBQyxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5QyxPQUFPLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEtBQUssR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztJQUN2QyxDQUFDO0lBR0QsTUFBTTtRQUNKLE9BQU8sSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUN2RSxDQUFDO0lBS0QsTUFBTTtRQUNKLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDbEIsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNsQixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ2xCLE1BQU0sRUFBRSxDQUFDLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFDcEIsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUN4QixNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3hCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQzdCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDckIsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdkMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUNyQixNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3JCLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDckIsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN0QixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ3RCLE1BQU0sRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDdEIsTUFBTSxFQUFFLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN0QixPQUFPLElBQUksYUFBYSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7SUFLRCxHQUFHLENBQUMsS0FBb0I7UUFDdEIsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNsQixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ2xCLE1BQU0sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDbEIsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNsQixNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ25CLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDbkIsTUFBTSxFQUFFLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUNuQixNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO1FBQ25CLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ3JDLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7UUFDckIsSUFBSSxDQUFDLEtBQUssRUFBRSxFQUFFO1lBRVosT0FBTyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7U0FDdEI7UUFDRCxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLENBQUMsQ0FBQztRQUM1QixNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFF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TSxFQUFFLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3ZCLE1BQU0sRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3hCLE1BQU0sRUFBRSxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN4QixNQUFNLEVBQUUsR0FBRyxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDekIsTUFBTSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDeEIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3pCLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDM0IsTUFBTSxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3pCLE1BQU0sRUFBRSxHQUFHLE9BQU8sQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDNUIsTUFBTSxFQUFFLEdBQUcsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3pCLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxFQUFFLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDN0IsTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzNCLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDOUIsTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzNCLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDOUIsTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzVCLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7SUFDL0IsTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzVCLE1BQU0sR0FBRyxHQUFHLE9BQU8sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDOUIsTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRzVCLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM1QixNQUFNLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2hDLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQUVELFNBQVMsU0FBUyxDQUFDLENBQVMsRUFBRSxDQUFTO0lBd0JyQyxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUMxQixNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUM1QixJQUFJLENBQUMsR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7SUFDMUMsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDN0IsTUFBTSxDQUFDLEdBQUcsT0FBTyxDQUFDO0lBQ2xCLE1BQU0sZUFBZSxHQUFHLEtBQUssS0FBSyxDQUFDLENBQUM7SUFDcEMsTUFBTSxlQUFlLEdBQUcsS0FBSyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzFDLE1BQU0sZ0JBQWdCLEdBQUcs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QUFDLFFBQVEsRUFBRTtZQUVwRSxNQUFNLEVBQUUsVUFBVSxFQUFFLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3pDLE1BQU0sSUFBSSxHQUFHLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUNsQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ3JCLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztTQUN2QzthQUFNO1lBQ0wsTUFBTSxJQUFJLEtBQUssQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFDO1NBQ2pFO0lBQ0gsQ0FBQztJQUNELFVBQVUsQ0FBQyxVQUFVLEdBQUcsQ0FBQyxFQUFFLEtBQUssR0FBRyxLQUFLLENBQUMsSUFBSTtRQUMzQyxNQUFNLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5RSxNQUFNLENBQUMsY0FBYyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDcEIsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztDQUNGLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiEgbm9ibGUtZWQyNTUxOSAtIE1JVCBMaWNlbnNlIChjKSBQYXVsIE1pbGxlciAocGF1bG1pbGxyLmNvbSkgKi9cblxuLy8gVGhhbmtzIERKQiBodHRwczovL2VkMjU1MTkuY3IueXAudG9cbi8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmM4MDMyLCBodHRwczovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9FZERTQVxuLy8gSW5jbHVkZXMgUmlzdHJldHRvLiBodHRwczovL3Jpc3RyZXR0by5ncm91cFxuXG5jb25zdCBDVVJWRSA9IHtcbiAgLy8gUGFyYW1zOiBhLCBiXG4gIGE6IC0xbixcbiAgLy8gRXF1YWwgdG8gLTEyMTY2NS8xMjE2NjYgb3ZlciBmaW5pdGUgZmllbGQuXG4gIC8vIE5lZ2F0aXZlIG51bWJlciBpcyBQIC0gbnVtYmVyLCBhbmQgZGl2aXNpb24gaXMgaW52ZXJ0KG51bWJlciwgUClcbiAgZDogMzcwOTU3MDU5MzQ2Njk0MzkzNDMxMzgwODM1MDg3NTQ1NjUxODk1NDIxMTM4Nzk4NDMyMTkwMTYzODg3ODU1MzMwODU5NDAyODM1NTVuLFxuICAvLyBGaW5pdGUgZmllbGQg7aC17bS9cCBvdmVyIHdoaWNoIHdlJ2xsIGRvIGNhbGN1bGF0aW9uc1xuICBQOiAybiAqKiAyNTVuIC0gMTluLFxuICAvLyBTdWJncm91cCBvcmRlciBha2EgQ1xuICBuOiAybiAqKiAyNTJuICsgMjc3NDIzMTc3NzczNzIzNTM1MzU4NTE5Mzc3OTA4ODM2NDg0OTNuLFxuICAvLyBDb2ZhY3RvclxuICBoOiA4bixcbiAgLy8gQmFzZSBwb2ludCAoeCwgeSkgYWthIGdlbmVyYXRvciBwb2ludFxuICBHeDogMTUxMTIyMjEzNDk1MzU0MDA3NzI1MDExNTE0MDk1ODg1MzE1MTE0NTQwMTI2OTMwNDE4NTcyMDYwNDYxMTMyODM5NDk4NDc3NjIyMDJuLFxuICBHeTogNDYzMTY4MzU2OTQ5MjY0NzgxNjk0MjgzOTQwMDM0NzUxNjMxNDEzMDc5OTM4NjYyNTYyMjU2MTU3ODMwMzM2MDMxNjUyNTE4NTU5NjBuLFxufTtcblxuLy8gQ2xlYW5lciBvdXRwdXQgdGhpcyB3YXkuXG5leHBvcnQgeyBDVVJWRSB9O1xuXG50eXBlIFByaXZLZXkgPSBVaW50OEFycmF5IHwgc3RyaW5nIHwgYmlnaW50IHwgbnVtYmVyO1xudHlwZSBQdWJLZXkgPSBVaW50OEFycmF5IHwgc3RyaW5nIHwgUG9pbnQ7XG50eXBlIEhleCA9IFVpbnQ4QXJyYXkgfCBzdHJpbmc7XG50eXBlIFNpZ25hdHVyZSA9IFVpbnQ4QXJyYXkgfCBzdHJpbmcgfCBTaWduUmVzdWx0O1xuY29uc3QgRU5DT0RJTkdfTEVOR1RIID0gMzI7XG5cbi8vIChQICsgMykgLyA4XG5jb25zdCBESVZfOF9NSU5VU18zID0gKENVUlZFLlAgKyAzbikgLyA4bjtcblxuLy8gMiAqKiAoUCArIDEpIC8gNFxuY29uc3QgSSA9IHBvd01vZCgybiwgKENVUlZFLlAgKyAxbikgLyA0biwgQ1VSVkUuUCk7XG5cbi8vIHNxcnQoLTEgJSBQKVxuY29uc3QgU1FSVF9NMSA9IDE5NjgxMTYxMzc2NzA3NTA1OTU2ODA3MDc5MzA0OTg4NTQyMDE1NDQ2MDY2NTE1OTIzODkwMTYyNzQ0MDIxMDczMTIzODI5Nzg0NzUybjtcblxuLy8gMSAvIHNxcnQoYS1kKVxuY29uc3QgSU5WU1FSVF9BX01JTlVTX0QgPSA1NDQ2OTMwNzAwODkwOTMxNjkyMDk5NTgxMzg2ODc0NTE0MTYwNTM5MzU5NzI5MjkyNzQ1NjkyMTIwNTMxMjg5NjMxMTcyMTAxNzU3OG47XG5cbi8vIHNxcnQoYSpkIC0gMSlcbmNvbnN0IFNRUlRfQURfTUlOVVNfT05FID0gMjUwNjMwNjg5NTMzODQ2MjM0NzQxMTE0MTQxNTg3MDIxNTI3MDEyNDQ1MzE1MDI0OTI2NTY0NjAwNzkyMTA0ODI2MTA0MzA3NTAyMzVuO1xuXG4vLyBEZWZhdWx0IFBvaW50IHdvcmtzIGluIGRlZmF1bHQgYWthIGFmZmluZSBjb29yZGluYXRlczogKHgsIHkpXG4vLyBFeHRlbmRlZCBQb2ludCB3b3JrcyBpbiBleHRlbmRlZCBjb29yZGluYXRlczogKHgsIHksIHosIHQpIOKIiyAoeD14L3osIHk9eS96LCB0PXh5KVxuLy8gaHR0cHM6Ly9lbi53aWtpcGVkaWEub3JnL3dpa2kvVHdpc3RlZF9FZHdhcmRzX2N1cnZlI0V4dGVuZGVkX2Nvb3JkaW5hdGVzXG5jbGFzcyBFeHRlbmRlZFBvaW50IHtcbiAgY29uc3RydWN0b3IocHVibGljIHg6IGJpZ2ludCwgcHVibGljIHk6IGJpZ2ludCwgcHVibGljIHo6IGJpZ2ludCwgcHVibGljIHQ6IGJpZ2ludCkge31cblxuICBzdGF0aWMgQkFTRSA9IG5ldyBFeHRlbmRlZFBvaW50KENVUlZFLkd4LCBDVVJWRS5HeSwgMW4sIG1vZChDVVJWRS5HeCAqIENVUlZFLkd5KSk7XG4gIHN0YXRpYyBaRVJPID0gbmV3IEV4dGVuZGVkUG9pbnQoMG4sIDFuLCAxbiwgMG4pO1xuICBzdGF0aWMgZnJvbUFmZmluZShwOiBQb2ludCk6IEV4dGVuZGVkUG9pbnQge1xuICAgIGlmICghKHAgaW5zdGFuY2VvZiBQb2ludCkpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4dGVuZGVkUG9pbnQjZnJvbUFmZmluZTogZXhwZWN0ZWQgUG9pbnQnKTtcbiAgICB9XG4gICAgaWYgKHAuZXF1YWxzKFBvaW50LlpFUk8pKSByZXR1cm4gRXh0ZW5kZWRQb2ludC5aRVJPO1xuICAgIHJldHVybiBuZXcgRXh0ZW5kZWRQb2ludChwLngsIHAueSwgMW4sIG1vZChwLnggKiBwLnkpKTtcbiAgfVxuICAvLyBUYWtlcyBhIGJ1bmNoIG9mIEphY29iaWFuIFBvaW50cyBidXQgZXhlY3V0ZXMgb25seSBvbmVcbiAgLy8gaW52ZXJ0IG9uIGFsbCBvZiB0aGVtLiBpbnZlcnQgaXMgdmVyeSBzbG93IG9wZXJhdGlvbixcbiAgLy8gc28gdGhpcyBpbXByb3ZlcyBwZXJmb3JtYW5jZSBtYXNzaXZlbHkuXG4gIHN0YXRpYyB0b0FmZmluZUJhdGNoKHBvaW50czogRXh0ZW5kZWRQb2ludFtdKTogUG9pbnRbXSB7XG4gICAgY29uc3QgdG9JbnYgPSBpbnZlcnRCYXRjaChwb2ludHMubWFwKChwKSA9PiBwLnopKTtcbiAgICByZXR1cm4gcG9pbnRzLm1hcCgocCwgaSkgPT4gcC50b0FmZmluZSh0b0ludltpXSkpO1xuICB9XG5cbiAgc3RhdGljIG5vcm1hbGl6ZVoocG9pbnRzOiBFeHRlbmRlZFBvaW50W10pOiBFeHRlbmRlZFBvaW50W10ge1xuICAgIHJldHVybiB0aGlzLnRvQWZmaW5lQmF0Y2gocG9pbnRzKS5tYXAodGhpcy5mcm9tQWZmaW5lKTtcbiAgfVxuXG4gIC8vIFJpc3RyZXR0by1yZWxhdGVkIG1ldGhvZHMuXG5cbiAgLy8gVGhlIGhhc2gtdG8tZ3JvdXAgb3BlcmF0aW9uIGFwcGxpZXMgRWxsaWdhdG9yIHR3aWNlIGFuZCBhZGRzIHRoZSByZXN1bHRzLlxuICBzdGF0aWMgZnJvbVJpc3RyZXR0b0hhc2goaGFzaDogVWludDhBcnJheSk6IEV4dGVuZGVkUG9pbnQge1xuICAgIGNvbnN0IHIxID0gYnl0ZXNUb051bWJlclJzdChoYXNoLnNsaWNlKDAsIEVOQ09ESU5HX0xFTkdUSCkpO1xuICAgIGNvbnN0IFIxID0gdGhpcy5lbGxpZ2F0b3JSaXN0cmV0dG9GbGF2b3IocjEpO1xuICAgIGNvbnN0IHIyID0gYnl0ZXNUb051bWJlclJzdChoYXNoLnNsaWNlKEVOQ09ESU5HX0xFTkdUSCwgRU5DT0RJTkdfTEVOR1RIICogMikpO1xuICAgIGNvbnN0IFIyID0gdGhpcy5lbGxpZ2F0b3JSaXN0cmV0dG9GbGF2b3IocjIpO1xuICAgIHJldHVybiBSMS5hZGQoUjIpO1xuICB9XG5cbiAgLy8gQ29tcHV0ZXMgdGhlIFJpc3RyZXR0byBFbGxpZ2F0b3IgbWFwLlxuICAvLyBUaGlzIG1ldGhvZCBpcyBub3QgcHVibGljIGJlY2F1c2UgaXQncyBqdXN0IHVzZWQgZm9yIGhhc2hpbmdcbiAgLy8gdG8gYSBwb2ludCAtLSBwcm9wZXIgZWxsaWdhdG9yIHN1cHBvcnQgaXMgZGVmZXJyZWQgZm9yIG5vdy5cbiAgcHJpdmF0ZSBzdGF0aWMgZWxsaWdhdG9yUmlzdHJldHRvRmxhdm9yKHIwOiBiaWdpbnQpIHtcbiAgICBjb25zdCB7IGQgfSA9IENVUlZFO1xuICAgIGNvbnN0IG9uZU1pbnVzRFNxID0gbW9kKDFuIC0gZCAqKiAybik7XG4gICAgY29uc3QgZE1pbnVzT25lU3EgPSAoZCAtIDFuKSAqKiAybjtcbiAgICBjb25zdCByID0gU1FSVF9NMSAqIChyMCAqIHIwKTtcbiAgICBjb25zdCBOUyA9IG1vZCgociArIDFuKSAqIG9uZU1pbnVzRFNxKTtcbiAgICBsZXQgYyA9IG1vZCgtMW4pO1xuICAgIGNvbnN0IEQgPSBtb2QoKGMgLSBkICogcikgKiBtb2QociArIGQpKTtcbiAgICBsZXQgeyBpc05vdFplcm9TcXVhcmUsIHZhbHVlOiBTIH0gPSBzcXJ0UmF0aW8oTlMsIEQpO1xuICAgIGxldCBzUHJpbWUgPSBtb2QoUyAqIHIwKTtcbiAgICBzUHJpbWUgPSBlZElzTmVnYXRpdmUoc1ByaW1lKSA/IHNQcmltZSA6IG1vZCgtc1ByaW1lKTtcbiAgICBTID0gaXNOb3RaZXJvU3F1YXJlID8gUyA6IHNQcmltZTtcbiAgICBjID0gaXNOb3RaZXJvU3F1YXJlID8gYyA6IHI7XG4gICAgY29uc3QgTlQgPSBjICogKHIgLSAxbikgKiBkTWludXNPbmVTcSAtIEQ7XG4gICAgY29uc3Qgc1NxdWFyZWQgPSBTICogUztcbiAgICBjb25zdCBXMCA9IChTICsgUykgKiBEO1xuICAgIGNvbnN0IFcxID0gTlQgKiBTUVJUX0FEX01JTlVTX09ORTtcbiAgICBjb25zdCBXMiA9IDFuIC0gc1NxdWFyZWQ7XG4gICAgY29uc3QgVzMgPSAxbiArIHNTcXVhcmVkO1xuICAgIHJldHVybiBuZXcgRXh0ZW5kZWRQb2ludChtb2QoVzAgKiBXMyksIG1vZChXMiAqIFcxKSwgbW9kKFcxICogVzMpLCBtb2QoVzAgKiBXMikpO1xuICB9XG5cbiAgc3RhdGljIGZyb21SaXN0cmV0dG9CeXRlcyhieXRlczogVWludDhBcnJheSkge1xuICAgIC8vIFN0ZXAgMS4gQ2hlY2sgcyBmb3IgdmFsaWRpdHk6XG4gICAgLy8gMS5hKSBzIG11c3QgYmUgMzIgYnl0ZXMgKHdlIGdldCB0aGlzIGZyb20gdGhlIHR5cGUgc3lzdGVtKVxuICAgIC8vIDEuYikgcyA8IHBcbiAgICAvLyAxLmMpIHMgaXMgbm9ubmVnYXRpdmVcbiAgICAvL1xuICAgIC8vIE91ciBkZWNvZGluZyByb3V0aW5lIGlnbm9yZXMgdGhlIGhpZ2ggYml0LCBzbyB0aGUgb25seVxuICAgIC8vIHBvc3NpYmxlIGZhaWx1cmUgZm9yIDEuYikgaXMgaWYgc29tZW9uZSBlbmNvZGVzIHMgaW4gMC4uMThcbiAgICAvLyBhcyBzK3AgaW4gMl4yNTUtMTkuLjJeMjU1LTEuICBXZSBjYW4gY2hlY2sgdGhpcyBieVxuICAgIC8vIGNvbnZlcnRpbmcgYmFjayB0byBieXRlcywgYW5kIGNoZWNraW5nIHRoYXQgd2UgZ2V0IHRoZVxuICAgIC8vIG9yaWdpbmFsIGlucHV0LCBzaW5jZSBvdXIgZW5jb2Rpbmcgcm91dGluZSBpcyBjYW5vbmljYWwuXG4gICAgY29uc3QgcyA9IGJ5dGVzVG9OdW1iZXJSc3QoYnl0ZXMpO1xuICAgIGNvbnN0IHNFbmNvZGluZ0lzQ2Fub25pY2FsID0gZXF1YWxCeXRlcyhudW1iZXJUb0J5dGVzUGFkZGVkKHMsIEVOQ09ESU5HX0xFTkdUSCksIGJ5dGVzKTtcbiAgICBjb25zdCBzSXNOZWdhdGl2ZSA9IGVkSXNOZWdhdGl2ZShzKTtcbiAgICBpZiAoIXNFbmNvZGluZ0lzQ2Fub25pY2FsIHx8IHNJc05lZ2F0aXZlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBjb252ZXJ0IGJ5dGVzIHRvIFJpc3RyZXR0byBQb2ludCcpO1xuICAgIH1cbiAgICBjb25zdCBzMiA9IHMgKiBzO1xuICAgIGNvbnN0IHUxID0gMW4gLSBzMjsgLy8gMSArIGFzwrJcbiAgICBjb25zdCB1MiA9IDFuICsgczI7IC8vIDEgLSBhc8KyIHdoZXJlIGE9LTFcbiAgICBjb25zdCBzcXVhcmVkVTIgPSB1MiAqIHUyOyAvLyAoMSAtIGFzwrIpwrJcbiAgICAvLyB2ID09IGFkKDErYXPCsinCsiAtICgxLWFzwrIpwrIgd2hlcmUgZD0tMTIxNjY1LzEyMTY2NlxuICAgIGNvbnN0IHYgPSB1MSAqIHUxICogLUNVUlZFLmQgLSBzcXVhcmVkVTI7XG4gICAgY29uc3QgeyBpc05vdFplcm9TcXVhcmUsIHZhbHVlOiBJIH0gPSBpbnZlcnRTcXJ0KG1vZCh2ICogc3F1YXJlZFUyKSk7IC8vIDEvc3FydCh2KnVfMsKyKVxuICAgIGNvbnN0IER4ID0gSSAqIHUyO1xuICAgIGNvbnN0IER5ID0gSSAqIER4ICogdjsgLy8gMS91MlxuICAgIC8vIHggPT0gfCAycy9zcXJ0KHYpIHwgPT0gKyBzcXJ0KDRzwrIvKGFkKDErYXPCsinCsiAtICgxLWFzwrIpwrIpKVxuICAgIGxldCB4ID0gbW9kKChzICsgcykgKiBEeCk7XG4gICAgaWYgKGVkSXNOZWdhdGl2ZSh4KSkgeCA9IG1vZCgteCk7XG4gICAgLy8geSA9PSAoMS1hc8KyKS8oMSthc8KyKVxuICAgIGNvbnN0IHkgPSBtb2QodTEgKiBEeSk7XG4gICAgLy8gdCA9PSAoKDErYXPCsikgc3FydCg0c8KyLyhhZCgxK2FzwrIpwrIgLSAoMS1hc8KyKcKyKSkpLygxLWFzwrIpXG4gICAgY29uc3QgdCA9IG1vZCh4ICogeSk7XG4gICAgaWYgKCFpc05vdFplcm9TcXVhcmUgfHwgZWRJc05lZ2F0aXZlKHQpIHx8IHkgPT09IDBuKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBjb252ZXJ0IGJ5dGVzIHRvIFJpc3RyZXR0byBQb2ludCcpO1xuICAgIH1cbiAgICByZXR1cm4gbmV3IEV4dGVuZGVkUG9pbnQoeCwgeSwgMW4sIHQpO1xuICB9XG5cbiAgdG9SaXN0cmV0dG9CeXRlcygpIHtcbiAgICBsZXQgeyB4LCB5LCB6LCB0IH0gPSB0aGlzO1xuICAgIC8vIHUxID0gKHowICsgeTApICogKHowIC0geTApXG4gICAgY29uc3QgdTEgPSAoeiArIHkpICogKHogLSB5KTtcbiAgICBjb25zdCB1MiA9IHggKiB5O1xuICAgIC8vIElnbm9yZSByZXR1cm4gdmFsdWUgc2luY2UgdGhpcyBpcyBhbHdheXMgc3F1YXJlXG4gICAgY29uc3QgeyB2YWx1ZTogaW52c3FydCB9ID0gaW52ZXJ0U3FydChtb2QodTIgKiogMm4gKiB1MSkpO1xuICAgIGNvbnN0IGkxID0gaW52c3FydCAqIHUxO1xuICAgIGNvbnN0IGkyID0gaW52c3FydCAqIHUyO1xuICAgIGNvbnN0IGludnogPSBpMSAqIGkyICogdDtcbiAgICBsZXQgaW52RGVubyA9IGkyO1xuICAgIGlmIChlZElzTmVnYXRpdmUodCAqIGludnopKSB7XG4gICAgICAvLyBJcyByb3RhdGVkXG4gICAgICBjb25zdCBpWCA9IG1vZCh4ICogU1FSVF9NMSk7XG4gICAgICBjb25zdCBpWSA9IG1vZCh5ICogU1FSVF9NMSk7XG4gICAgICB4ID0gaVk7XG4gICAgICB5ID0gaVg7XG4gICAgICBpbnZEZW5vID0gbW9kKGkxICogSU5WU1FSVF9BX01JTlVTX0QpO1xuICAgIH1cbiAgICBpZiAoZWRJc05lZ2F0aXZlKHggKiBpbnZ6KSkgeSA9IG1vZCgteSk7XG4gICAgbGV0IHMgPSBtb2QoKHogLSB5KSAqIGludkRlbm8pO1xuICAgIGlmIChlZElzTmVnYXRpdmUocykpIHMgPSBtb2QoLXMpO1xuICAgIHJldHVybiBudW1iZXJUb0J5dGVzUGFkZGVkKHMsIEVOQ09ESU5HX0xFTkdUSCk7XG4gIH1cbiAgLy8gUmlzdHJldHRvIG1ldGhvZHMgZW5kLlxuXG4gIC8vIENvbXBhcmUgb25lIHBvaW50IHRvIGFub3RoZXIuXG4gIGVxdWFscyhvdGhlcjogRXh0ZW5kZWRQb2ludCk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGEgPSB0aGlzO1xuICAgIGNvbnN0IGIgPSBvdGhlcjtcbiAgICBjb25zdCBbVDEsIFQyLCBaMSwgWjJdID0gW2EudCwgYi50LCBhLnosIGIuel07XG4gICAgcmV0dXJuIG1vZChUMSAqIFoyKSA9PT0gbW9kKFQyICogWjEpO1xuICB9XG5cbiAgLy8gSW52ZXJzZXMgcG9pbnQgdG8gb25lIGNvcnJlc3BvbmRpbmcgdG8gKHgsIC15KSBpbiBBZmZpbmUgY29vcmRpbmF0ZXMuXG4gIG5lZ2F0ZSgpOiBFeHRlbmRlZFBvaW50IHtcbiAgICByZXR1cm4gbmV3IEV4dGVuZGVkUG9pbnQobW9kKC10aGlzLngpLCB0aGlzLnksIHRoaXMueiwgbW9kKC10aGlzLnQpKTtcbiAgfVxuXG4gIC8vIEZhc3QgYWxnbyBmb3IgZG91YmxpbmcgRXh0ZW5kZWQgUG9pbnQgd2hlbiBjdXJ2ZSdzIGE9LTEuXG4gIC8vIGh0dHA6Ly9oeXBlcmVsbGlwdGljLm9yZy9FRkQvZzFwL2F1dG8tdHdpc3RlZC1leHRlbmRlZC0xLmh0bWwjZG91YmxpbmctZGJsLTIwMDgtaHdjZFxuICAvLyBDb3N0OiAzTSArIDRTICsgMSphICsgN2FkZCArIDEqMi5cbiAgZG91YmxlKCk6IEV4dGVuZGVkUG9pbnQge1xuICAgIGNvbnN0IFgxID0gdGhpcy54O1xuICAgIGNvbnN0IFkxID0gdGhpcy55O1xuICAgIGNvbnN0IFoxID0gdGhpcy56O1xuICAgIGNvbnN0IHsgYSB9ID0gQ1VSVkU7XG4gICAgY29uc3QgQSA9IG1vZChYMSAqKiAybik7XG4gICAgY29uc3QgQiA9IG1vZChZMSAqKiAybik7XG4gICAgY29uc3QgQyA9IG1vZCgybiAqIFoxICoqIDJuKTtcbiAgICBjb25zdCBEID0gbW9kKGEgKiBBKTtcbiAgICBjb25zdCBFID0gbW9kKChYMSArIFkxKSAqKiAybiAtIEEgLSBCKTtcbiAgICBjb25zdCBHID0gbW9kKEQgKyBCKTtcbiAgICBjb25zdCBGID0gbW9kKEcgLSBDKTtcbiAgICBjb25zdCBIID0gbW9kKEQgLSBCKTtcbiAgICBjb25zdCBYMyA9IG1vZChFICogRik7XG4gICAgY29uc3QgWTMgPSBtb2QoRyAqIEgpO1xuICAgIGNvbnN0IFQzID0gbW9kKEUgKiBIKTtcbiAgICBjb25zdCBaMyA9IG1vZChGICogRyk7XG4gICAgcmV0dXJuIG5ldyBFeHRlbmRlZFBvaW50KFgzLCBZMywgWjMsIFQzKTtcbiAgfVxuXG4gIC8vIEZhc3QgYWxnbyBmb3IgYWRkaW5nIDIgRXh0ZW5kZWQgUG9pbnRzIHdoZW4gY3VydmUncyBhPS0xLlxuICAvLyBodHRwOi8vaHlwZXJlbGxpcHRpYy5vcmcvRUZEL2cxcC9hdXRvLXR3aXN0ZWQtZXh0ZW5kZWQtMS5odG1sI2FkZGl0aW9uLWFkZC0yMDA4LWh3Y2QtNFxuICAvLyBDb3N0OiA4TSArIDhhZGQgKyAyKjIuXG4gIGFkZChvdGhlcjogRXh0ZW5kZWRQb2ludCk6IEV4dGVuZGVkUG9pbnQge1xuICAgIGNvbnN0IFgxID0gdGhpcy54O1xuICAgIGNvbnN0IFkxID0gdGhpcy55O1xuICAgIGNvbnN0IFoxID0gdGhpcy56O1xuICAgIGNvbnN0IFQxID0gdGhpcy50O1xuICAgIGNvbnN0IFgyID0gb3RoZXIueDtcbiAgICBjb25zdCBZMiA9IG90aGVyLnk7XG4gICAgY29uc3QgWjIgPSBvdGhlci56O1xuICAgIGNvbnN0IFQyID0gb3RoZXIudDtcbiAgICBjb25zdCBBID0gbW9kKChZMSAtIFgxKSAqIChZMiArIFgyKSk7XG4gICAgY29uc3QgQiA9IG1vZCgoWTEgKyBYMSkgKiAoWTIgLSBYMikpO1xuICAgIGNvbnN0IEYgPSBtb2QoQiAtIEEpO1xuICAgIGlmIChGID09PSAwbikge1xuICAgICAgLy8gU2FtZSBwb2ludC5cbiAgICAgIHJldHVybiB0aGlzLmRvdWJsZSgpO1xuICAgIH1cbiAgICBjb25zdCBDID0gbW9kKFoxICogMm4gKiBUMik7XG4gICAgY29uc3QgRCA9IG1vZChUMSAqIDJuICogWjIpO1xuICAgIGNvbnN0IEUgPSBtb2QoRCArIEMpO1xuICAgIGNvbnN0IEcgPSBtb2QoQiArIEEpO1xuICAgIGNvbnN0IEggPSBtb2QoRCAtIEMpO1xuICAgIGNvbnN0IFgzID0gbW9kKEUgKiBGKTtcbiAgICBjb25zdCBZMyA9IG1vZChHICogSCk7XG4gICAgY29uc3QgVDMgPSBtb2QoRSAqIEgpO1xuICAgIGNvbnN0IFozID0gbW9kKEYgKiBHKTtcbiAgICByZXR1cm4gbmV3IEV4dGVuZGVkUG9pbnQoWDMsIFkzLCBaMywgVDMpO1xuICB9XG5cbiAgc3VidHJhY3Qob3RoZXI6IEV4dGVuZGVkUG9pbnQpOiBFeHRlbmRlZFBvaW50IHtcbiAgICByZXR1cm4gdGhpcy5hZGQob3RoZXIubmVnYXRlKCkpO1xuICB9XG5cbiAgLy8gTm9uLWNvbnN0YW50LXRpbWUgbXVsdGlwbGljYXRpb24uIFVzZXMgZG91YmxlLWFuZC1hZGQgYWxnb3JpdGhtLlxuICAvLyBJdCdzIGZhc3RlciwgYnV0IHNob3VsZCBvbmx5IGJlIHVzZWQgd2hlbiB5b3UgZG9uJ3QgY2FyZSBhYm91dFxuICAvLyBhbiBleHBvc2VkIHByaXZhdGUga2V5IGUuZy4gc2lnIHZlcmlmaWNhdGlvbi5cbiAgbXVsdGlwbHlVbnNhZmUoc2NhbGFyOiBiaWdpbnQpOiBFeHRlbmRlZFBvaW50IHtcbiAgICBpZiAodHlwZW9mIHNjYWxhciAhPT0gJ251bWJlcicgJiYgdHlwZW9mIHNjYWxhciAhPT0gJ2JpZ2ludCcpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1BvaW50I211bHRpcGx5OiBleHBlY3RlZCBudW1iZXIgb3IgYmlnaW50Jyk7XG4gICAgfVxuICAgIGxldCBuID0gbW9kKEJpZ0ludChzY2FsYXIpLCBDVVJWRS5uKTtcbiAgICBpZiAobiA8PSAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BvaW50I211bHRpcGx5OiBpbnZhbGlkIHNjYWxhciwgZXhwZWN0ZWQgcG9zaXRpdmUgaW50ZWdlcicpO1xuICAgIH1cbiAgICBsZXQgcCA9IEV4dGVuZGVkUG9pbnQuWkVSTztcbiAgICBsZXQgZDogRXh0ZW5kZWRQb2ludCA9IHRoaXM7XG4gICAgd2hpbGUgKG4gPiAwbikge1xuICAgICAgaWYgKG4gJiAxbikgcCA9IHAuYWRkKGQpO1xuICAgICAgZCA9IGQuZG91YmxlKCk7XG4gICAgICBuID4+PSAxbjtcbiAgICB9XG4gICAgcmV0dXJuIHA7XG4gIH1cblxuICBwcml2YXRlIHByZWNvbXB1dGVXaW5kb3coVzogbnVtYmVyKTogRXh0ZW5kZWRQb2ludFtdIHtcbiAgICBjb25zdCB3aW5kb3dzID0gMjU2IC8gVyArIDE7XG4gICAgbGV0IHBvaW50czogRXh0ZW5kZWRQb2ludFtdID0gW107XG4gICAgbGV0IHA6IEV4dGVuZGVkUG9pbnQgPSB0aGlzO1xuICAgIGxldCBiYXNlID0gcDtcbiAgICBmb3IgKGxldCB3aW5kb3cgPSAwOyB3aW5kb3cgPCB3aW5kb3dzOyB3aW5kb3crKykge1xuICAgICAgYmFzZSA9IHA7XG4gICAgICBwb2ludHMucHVzaChiYXNlKTtcbiAgICAgIGZvciAobGV0IGkgPSAxOyBpIDwgMiAqKiAoVyAtIDEpOyBpKyspIHtcbiAgICAgICAgYmFzZSA9IGJhc2UuYWRkKHApO1xuICAgICAgICBwb2ludHMucHVzaChiYXNlKTtcbiAgICAgIH1cbiAgICAgIHAgPSBiYXNlLmRvdWJsZSgpO1xuICAgIH1cbiAgICByZXR1cm4gcG9pbnRzO1xuICB9XG5cbiAgcHJpdmF0ZSB3TkFGKG46IGJpZ2ludCwgYWZmaW5lUG9pbnQ/OiBQb2ludCk6IFtFeHRlbmRlZFBvaW50LCBFeHRlbmRlZFBvaW50XSB7XG4gICAgaWYgKCFhZmZpbmVQb2ludCAmJiB0aGlzLmVxdWFscyhFeHRlbmRlZFBvaW50LkJBU0UpKSBhZmZpbmVQb2ludCA9IFBvaW50LkJBU0U7XG4gICAgY29uc3QgVyA9IChhZmZpbmVQb2ludCAmJiBhZmZpbmVQb2ludC5fV0lORE9XX1NJWkUpIHx8IDE7XG4gICAgaWYgKDI1NiAlIFcpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUG9pbnQjd05BRjogSW52YWxpZCBwcmVjb21wdXRhdGlvbiB3aW5kb3csIG11c3QgYmUgcG93ZXIgb2YgMicpO1xuICAgIH1cblxuICAgIGxldCBwcmVjb21wdXRlcyA9IGFmZmluZVBvaW50ICYmIHBvaW50UHJlY29tcHV0ZXMuZ2V0KGFmZmluZVBvaW50KTtcbiAgICBpZiAoIXByZWNvbXB1dGVzKSB7XG4gICAgICBwcmVjb21wdXRlcyA9IHRoaXMucHJlY29tcHV0ZVdpbmRvdyhXKTtcbiAgICAgIGlmIChhZmZpbmVQb2ludCAmJiBXICE9PSAxKSB7XG4gICAgICAgIHByZWNvbXB1dGVzID0gRXh0ZW5kZWRQb2ludC5ub3JtYWxpemVaKHByZWNvbXB1dGVzKTtcbiAgICAgICAgcG9pbnRQcmVjb21wdXRlcy5zZXQoYWZmaW5lUG9pbnQsIHByZWNvbXB1dGVzKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgcCA9IEV4dGVuZGVkUG9pbnQuWkVSTztcbiAgICBsZXQgZiA9IEV4dGVuZGVkUG9pbnQuWkVSTztcblxuICAgIGNvbnN0IHdpbmRvd3MgPSAyNTYgLyBXICsgMTtcbiAgICBjb25zdCB3aW5kb3dTaXplID0gMiAqKiAoVyAtIDEpO1xuICAgIGNvbnN0IG1hc2sgPSBCaWdJbnQoMiAqKiBXIC0gMSk7IC8vIENyZWF0ZSBtYXNrIHdpdGggVyBvbmVzOiAwYjExMTEgZm9yIFc9NCBldGMuXG4gICAgY29uc3QgbWF4TnVtYmVyID0gMiAqKiBXO1xuICAgIGNvbnN0IHNoaWZ0QnkgPSBCaWdJbnQoVyk7XG5cbiAgICBmb3IgKGxldCB3aW5kb3cgPSAwOyB3aW5kb3cgPCB3aW5kb3dzOyB3aW5kb3crKykge1xuICAgICAgY29uc3Qgb2Zmc2V0ID0gd2luZG93ICogd2luZG93U2l6ZTtcbiAgICAgIC8vIEV4dHJhY3QgVyBiaXRzLlxuICAgICAgbGV0IHdiaXRzID0gTnVtYmVyKG4gJiBtYXNrKTtcblxuICAgICAgLy8gU2hpZnQgbnVtYmVyIGJ5IFcgYml0cy5cbiAgICAgIG4gPj49IHNoaWZ0Qnk7XG5cbiAgICAgIC8vIElmIHRoZSBiaXRzIGFyZSBiaWdnZXIgdGhhbiBtYXggc2l6ZSwgd2UnbGwgc3BsaXQgdGhvc2UuXG4gICAgICAvLyArMjI0ID0+IDI1NiAtIDMyXG4gICAgICBpZiAod2JpdHMgPiB3aW5kb3dTaXplKSB7XG4gICAgICAgIHdiaXRzIC09IG1heE51bWJlcjtcbiAgICAgICAgbiArPSAxbjtcbiAgICAgIH1cblxuICAgICAgLy8gQ2hlY2sgaWYgd2UncmUgb250byBaZXJvIHBvaW50LlxuICAgICAgLy8gQWRkIHJhbmRvbSBwb2ludCBpbnNpZGUgY3VycmVudCB3aW5kb3cgdG8gZi5cbiAgICAgIGlmICh3Yml0cyA9PT0gMCkge1xuICAgICAgICBmID0gZi5hZGQod2luZG93ICUgMiA/IHByZWNvbXB1dGVzW29mZnNldF0ubmVnYXRlKCkgOiBwcmVjb21wdXRlc1tvZmZzZXRdKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGNhY2hlZCA9IHByZWNvbXB1dGVzW29mZnNldCArIE1hdGguYWJzKHdiaXRzKSAtIDFdO1xuICAgICAgICBwID0gcC5hZGQod2JpdHMgPCAwID8gY2FjaGVkLm5lZ2F0ZSgpIDogY2FjaGVkKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIFtwLCBmXTtcbiAgfVxuXG4gIC8vIENvbnN0YW50IHRpbWUgbXVsdGlwbGljYXRpb24uXG4gIC8vIFVzZXMgd05BRiBtZXRob2QuIFdpbmRvd2VkIG1ldGhvZCBtYXkgYmUgMTAlIGZhc3RlcixcbiAgLy8gYnV0IHRha2VzIDJ4IGxvbmdlciB0byBnZW5lcmF0ZSBhbmQgY29uc3VtZXMgMnggbWVtb3J5LlxuICBtdWx0aXBseShzY2FsYXI6IG51bWJlciB8IGJpZ2ludCwgYWZmaW5lUG9pbnQ/OiBQb2ludCk6IEV4dGVuZGVkUG9pbnQge1xuICAgIGlmICh0eXBlb2Ygc2NhbGFyICE9PSAnbnVtYmVyJyAmJiB0eXBlb2Ygc2NhbGFyICE9PSAnYmlnaW50Jykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignUG9pbnQjbXVsdGlwbHk6IGV4cGVjdGVkIG51bWJlciBvciBiaWdpbnQnKTtcbiAgICB9XG4gICAgY29uc3QgbiA9IG1vZChCaWdJbnQoc2NhbGFyKSwgQ1VSVkUubik7XG4gICAgaWYgKG4gPD0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdQb2ludCNtdWx0aXBseTogaW52YWxpZCBzY2FsYXIsIGV4cGVjdGVkIHBvc2l0aXZlIGludGVnZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIEV4dGVuZGVkUG9pbnQubm9ybWFsaXplWih0aGlzLndOQUYobiwgYWZmaW5lUG9pbnQpKVswXTtcbiAgfVxuXG4gIC8vIENvbnZlcnRzIEV4dGVuZGVkIHBvaW50IHRvIGRlZmF1bHQgKHgsIHkpIGNvb3JkaW5hdGVzLlxuICAvLyBDYW4gYWNjZXB0IHByZWNvbXB1dGVkIFpeLTEgLSBmb3IgZXhhbXBsZSwgZnJvbSBpbnZlcnRCYXRjaC5cbiAgdG9BZmZpbmUoaW52WjogYmlnaW50ID0gaW52ZXJ0KHRoaXMueikpOiBQb2ludCB7XG4gICAgY29uc3QgeCA9IG1vZCh0aGlzLnggKiBpbnZaKTtcbiAgICBjb25zdCB5ID0gbW9kKHRoaXMueSAqIGludlopO1xuICAgIHJldHVybiBuZXcgUG9pbnQoeCwgeSk7XG4gIH1cbn1cblxuLy8gU3RvcmVzIHByZWNvbXB1dGVkIHZhbHVlcyBmb3IgcG9pbnRzLlxuY29uc3QgcG9pbnRQcmVjb21wdXRlcyA9IG5ldyBXZWFrTWFwPFBvaW50LCBFeHRlbmRlZFBvaW50W10+KCk7XG5cbi8vIERlZmF1bHQgUG9pbnQgd29ya3MgaW4gZGVmYXVsdCBha2EgYWZmaW5lIGNvb3JkaW5hdGVzOiAoeCwgeSlcbmNsYXNzIFBvaW50IHtcbiAgLy8gQmFzZSBwb2ludCBha2EgZ2VuZXJhdG9yXG4gIC8vIHB1YmxpY19rZXkgPSBQb2ludC5CQVNFICogcHJpdmF0ZV9rZXlcbiAgc3RhdGljIEJBU0U6IFBvaW50ID0gbmV3IFBvaW50KENVUlZFLkd4LCBDVVJWRS5HeSk7XG4gIC8vIElkZW50aXR5IHBvaW50IGFrYSBwb2ludCBhdCBpbmZpbml0eVxuICAvLyBwb2ludCA9IHBvaW50ICsgemVyb19wb2ludFxuICBzdGF0aWMgWkVSTzogUG9pbnQgPSBuZXcgUG9pbnQoMG4sIDFuKTtcbiAgLy8gV2UgY2FsY3VsYXRlIHByZWNvbXB1dGVzIGZvciBlbGxpcHRpYyBjdXJ2ZSBwb2ludCBtdWx0aXBsaWNhdGlvblxuICAvLyB1c2luZyB3aW5kb3dlZCBtZXRob2QuIFRoaXMgc3BlY2lmaWVzIHdpbmRvdyBzaXplIGFuZFxuICAvLyBzdG9yZXMgcHJlY29tcHV0ZWQgdmFsdWVzLiBVc3VhbGx5IG9ubHkgYmFzZSBwb2ludCB3b3VsZCBiZSBwcmVjb21wdXRlZC5cbiAgX1dJTkRPV19TSVpFPzogbnVtYmVyO1xuXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyB4OiBiaWdpbnQsIHB1YmxpYyB5OiBiaWdpbnQpIHt9XG5cbiAgLy8gXCJQcml2YXRlIG1ldGhvZFwiLCBkb24ndCB1c2UgaXQgZGlyZWN0bHkuXG4gIF9zZXRXaW5kb3dTaXplKHdpbmRvd1NpemU6IG51bWJlcikge1xuICAgIHRoaXMuX1dJTkRPV19TSVpFID0gd2luZG93U2l6ZTtcbiAgICBwb2ludFByZWNvbXB1dGVzLmRlbGV0ZSh0aGlzKTtcbiAgfVxuICAvLyBDb252ZXJ0cyBoYXNoIHN0cmluZyBvciBVaW50OEFycmF5IHRvIFBvaW50LlxuICAvLyBVc2VzIGFsZ28gZnJvbSBSRkM4MDMyIDUuMS4zLlxuICBzdGF0aWMgZnJvbUhleChoYXNoOiBIZXgpIHtcbiAgICBjb25zdCB7IGQsIFAgfSA9IENVUlZFO1xuICAgIGNvbnN0IGJ5dGVzID0gaGFzaCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkgPyBoYXNoIDogaGV4VG9CeXRlcyhoYXNoKTtcbiAgICBjb25zdCBsZW4gPSBieXRlcy5sZW5ndGggLSAxO1xuICAgIGNvbnN0IG5vcm1lZExhc3QgPSBieXRlc1tsZW5dICYgfjB4ODA7XG4gICAgY29uc3QgaXNMYXN0Qnl0ZU9kZCA9IChieXRlc1tsZW5dICYgMHg4MCkgIT09IDA7XG4gICAgY29uc3Qgbm9ybWVkID0gVWludDhBcnJheS5mcm9tKEFycmF5LmZyb20oYnl0ZXMuc2xpY2UoMCwgbGVuKSkuY29uY2F0KG5vcm1lZExhc3QpKTtcbiAgICBjb25zdCB5ID0gYnl0ZXNUb051bWJlckxFKG5vcm1lZCk7XG4gICAgaWYgKHkgPj0gUCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdQb2ludCNmcm9tSGV4IGV4cGVjdHMgaGV4IDw9IEZwJyk7XG4gICAgfVxuICAgIGNvbnN0IHNxclkgPSB5ICogeTtcbiAgICBjb25zdCBzcXJYID0gbW9kKChzcXJZIC0gMW4pICogaW52ZXJ0KGQgKiBzcXJZICsgMW4pKTtcbiAgICAvLyBsZXQgeCA9IHBvd18yXzI1Ml8zKHNxclgpO1xuICAgIGxldCB4ID0gcG93TW9kKHNxclgsIERJVl84X01JTlVTXzMpO1xuICAgIGlmIChtb2QoeCAqIHggLSBzcXJYKSAhPT0gMG4pIHtcbiAgICAgIHggPSBtb2QoeCAqIEkpO1xuICAgIH1cbiAgICBjb25zdCBpc1hPZGQgPSAoeCAmIDFuKSA9PT0gMW47XG4gICAgaWYgKGlzTGFzdEJ5dGVPZGQgIT09IGlzWE9kZCkge1xuICAgICAgeCA9IG1vZCgteCk7XG4gICAgfVxuICAgIHJldHVybiBuZXcgUG9pbnQoeCwgeSk7XG4gIH1cblxuICAvKipcbiAgICogQ29udmVydHMgcG9pbnQgdG8gY29tcHJlc3NlZCByZXByZXNlbnRhdGlvbiBvZiBpdHMgWS5cbiAgICogRUNEU0EgdXNlcyBgMDQke3h9JHt5fWAgdG8gcmVwcmVzZW50IGxvbmcgZm9ybSBhbmRcbiAgICogYDAyJHt4fWAgLyBgMDMke3h9YCB0byByZXByZXNlbnQgc2hvcnQgZm9ybSxcbiAgICogd2hlcmUgbGVhZGluZyBiaXQgc2lnbmlmaWVzIHBvc2l0aXZlIG9yIG5lZ2F0aXZlIFkuXG4gICAqIEVERFNBIChlZDI1NTE5KSB1c2VzIHNob3J0IGZvcm0uXG4gICAqL1xuICB0b1Jhd0J5dGVzKCk6IFVpbnQ4QXJyYXkge1xuICAgIGNvbnN0IGhleCA9IG51bWJlclRvSGV4KHRoaXMueSk7XG4gICAgY29uc3QgdTggPSBuZXcgVWludDhBcnJheShFTkNPRElOR19MRU5HVEgpO1xuICAgIGZvciAobGV0IGkgPSBoZXgubGVuZ3RoIC0gMiwgaiA9IDA7IGogPCBFTkNPRElOR19MRU5HVEggJiYgaSA+PSAwOyBpIC09IDIsIGorKykge1xuICAgICAgdThbal0gPSBwYXJzZUludChoZXhbaV0gKyBoZXhbaSArIDFdLCAxNik7XG4gICAgfVxuICAgIGNvbnN0IG1hc2sgPSB0aGlzLnggJiAxbiA/IDB4ODAgOiAwO1xuICAgIHU4W0VOQ09ESU5HX0xFTkdUSCAtIDFdIHw9IG1hc2s7XG4gICAgcmV0dXJuIHU4O1xuICB9XG5cbiAgLy8gU2FtZSBhcyB0b1Jhd0J5dGVzLCBidXQgcmV0dXJucyBzdHJpbmcuXG4gIHRvSGV4KCk6IHN0cmluZyB7XG4gICAgcmV0dXJuIGJ5dGVzVG9IZXgodGhpcy50b1Jhd0J5dGVzKCkpO1xuICB9XG5cbiAgLy8gQ29udmVydHMgdG8gTW9udGdvbWVyeTsgYWthIHggY29vcmRpbmF0ZSBvZiBjdXJ2ZTI1NTE5LlxuICAvLyBXZSBkb24ndCBoYXZlIGZyb21YMjU1MTksIGJlY2F1c2Ugd2UgZG9uJ3Qga25vdyBzaWduIVxuICB0b1gyNTUxOSgpIHtcbiAgICAvLyBjdXJ2ZTI1NTE5IGlzIGJpcmF0aW9uYWxseSBlcXVpdmFsZW50IHRvIGVkMjU1MTlcbiAgICAvLyB4LCB5OiBlZDI1NTE5IGNvb3JkaW5hdGVzXG4gICAgLy8gdSwgdjogeDI1NTE5IGNvb3JkaW5hdGVzXG4gICAgLy8gdSA9ICgxICsgeSkgLyAoMSAtIHkpXG4gICAgLy8gU2VlIGh0dHBzOi8vYmxvZy5maWxpcHBvLmlvL3VzaW5nLWVkMjU1MTkta2V5cy1mb3ItZW5jcnlwdGlvblxuICAgIHJldHVybiBtb2QoKDFuICsgdGhpcy55KSAqIGludmVydCgxbiAtIHRoaXMueSkpO1xuICB9XG5cbiAgZXF1YWxzKG90aGVyOiBQb2ludCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLnggPT09IG90aGVyLnggJiYgdGhpcy55ID09PSBvdGhlci55O1xuICB9XG5cbiAgbmVnYXRlKCkge1xuICAgIHJldHVybiBuZXcgUG9pbnQodGhpcy54LCBtb2QoLXRoaXMueSkpO1xuICB9XG5cbiAgYWRkKG90aGVyOiBQb2ludCkge1xuICAgIHJldHVybiBFeHRlbmRlZFBvaW50LmZyb21BZmZpbmUodGhpcykuYWRkKEV4dGVuZGVkUG9pbnQuZnJvbUFmZmluZShvdGhlcikpLnRvQWZmaW5lKCk7XG4gIH1cblxuICBzdWJ0cmFjdChvdGhlcjogUG9pbnQpIHtcbiAgICByZXR1cm4gdGhpcy5hZGQob3RoZXIubmVnYXRlKCkpO1xuICB9XG5cbiAgLy8gQ29uc3RhbnQgdGltZSBtdWx0aXBsaWNhdGlvbi5cbiAgbXVsdGlwbHkoc2NhbGFyOiBiaWdpbnQpOiBQb2ludCB7XG4gICAgcmV0dXJuIEV4dGVuZGVkUG9pbnQuZnJvbUFmZmluZSh0aGlzKS5tdWx0aXBseShzY2FsYXIsIHRoaXMpLnRvQWZmaW5lKCk7XG4gIH1cbn1cblxuY2xhc3MgU2lnblJlc3VsdCB7XG4gIGNvbnN0cnVjdG9yKHB1YmxpYyByOiBQb2ludCwgcHVibGljIHM6IGJpZ2ludCkge31cblxuICBzdGF0aWMgZnJvbUhleChoZXg6IEhleCkge1xuICAgIGhleCA9IGVuc3VyZUJ5dGVzKGhleCk7XG4gICAgY29uc3QgciA9IFBvaW50LmZyb21IZXgoaGV4LnNsaWNlKDAsIDMyKSk7XG4gICAgY29uc3QgcyA9IGJ5dGVzVG9OdW1iZXJMRShoZXguc2xpY2UoMzIpKTtcbiAgICByZXR1cm4gbmV3IFNpZ25SZXN1bHQociwgcyk7XG4gIH1cblxuICB0b1Jhd0J5dGVzKCkge1xuICAgIGNvbnN0IG51bWJlckJ5dGVzID0gaGV4VG9CeXRlcyhudW1iZXJUb0hleCh0aGlzLnMpKS5yZXZlcnNlKCk7XG4gICAgY29uc3Qgc0J5dGVzID0gbmV3IFVpbnQ4QXJyYXkoRU5DT0RJTkdfTEVOR1RIKTtcbiAgICBzQnl0ZXMuc2V0KG51bWJlckJ5dGVzKTtcbiAgICBjb25zdCByZXMgPSBuZXcgVWludDhBcnJheShFTkNPRElOR19MRU5HVEggKiAyKTtcbiAgICByZXMuc2V0KHRoaXMuci50b1Jhd0J5dGVzKCkpO1xuICAgIHJlcy5zZXQoc0J5dGVzLCAzMik7XG4gICAgcmV0dXJuIHJlcztcbiAgICAvLyByZXR1cm4gY29uY2F0VHlwZWRBcnJheXModGhpcy5yLnRvUmF3Qnl0ZXMoKSwgc0J5dGVzKTtcbiAgfVxuXG4gIHRvSGV4KCkge1xuICAgIHJldHVybiBieXRlc1RvSGV4KHRoaXMudG9SYXdCeXRlcygpKTtcbiAgfVxufVxuXG5leHBvcnQgeyBFeHRlbmRlZFBvaW50LCBQb2ludCwgU2lnblJlc3VsdCB9O1xuXG5mdW5jdGlvbiBjb25jYXRCeXRlcyguLi5hcnJheXM6IFVpbnQ4QXJyYXlbXSk6IFVpbnQ4QXJyYXkge1xuICBpZiAoYXJyYXlzLmxlbmd0aCA9PT0gMSkgcmV0dXJuIGFycmF5c1swXTtcbiAgY29uc3QgbGVuZ3RoID0gYXJyYXlzLnJlZHVjZSgoYSwgYXJyKSA9PiBhICsgYXJyLmxlbmd0aCwgMCk7XG4gIGNvbnN0IHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KGxlbmd0aCk7XG4gIGZvciAobGV0IGkgPSAwLCBwYWQgPSAwOyBpIDwgYXJyYXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgYXJyID0gYXJyYXlzW2ldO1xuICAgIHJlc3VsdC5zZXQoYXJyLCBwYWQpO1xuICAgIHBhZCArPSBhcnIubGVuZ3RoO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbi8vIENvbnZlcnQgYmV0d2VlbiB0eXBlc1xuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5mdW5jdGlvbiBieXRlc1RvSGV4KHVpbnQ4YTogVWludDhBcnJheSk6IHN0cmluZyB7XG4gIC8vIHByZS1jYWNoaW5nIGNoYXJzIGNvdWxkIHNwZWVkIHRoaXMgdXAgNnguXG4gIGxldCBoZXggPSAnJztcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB1aW50OGEubGVuZ3RoOyBpKyspIHtcbiAgICBoZXggKz0gdWludDhhW2ldLnRvU3RyaW5nKDE2KS5wYWRTdGFydCgyLCAnMCcpO1xuICB9XG4gIHJldHVybiBoZXg7XG59XG5cbmZ1bmN0aW9uIHBhZDY0KG51bTogbnVtYmVyIHwgYmlnaW50KTogc3RyaW5nIHtcbiAgcmV0dXJuIG51bS50b1N0cmluZygxNikucGFkU3RhcnQoRU5DT0RJTkdfTEVOR1RIICogMiwgJzAnKTtcbn1cblxuZnVuY3Rpb24gaGV4VG9CeXRlcyhoZXg6IHN0cmluZyk6IFVpbnQ4QXJyYXkge1xuICBoZXggPSBoZXgubGVuZ3RoICYgMSA/IGAwJHtoZXh9YCA6IGhleDtcbiAgY29uc3QgYXJyYXkgPSBuZXcgVWludDhBcnJheShoZXgubGVuZ3RoIC8gMik7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpKyspIHtcbiAgICBsZXQgaiA9IGkgKiAyO1xuICAgIGFycmF5W2ldID0gTnVtYmVyLnBhcnNlSW50KGhleC5zbGljZShqLCBqICsgMiksIDE2KTtcbiAgfVxuICByZXR1cm4gYXJyYXk7XG59XG5cbmZ1bmN0aW9uIG51bWJlclRvSGV4KG51bTogbnVtYmVyIHwgYmlnaW50KTogc3RyaW5nIHtcbiAgY29uc3QgaGV4ID0gbnVtLnRvU3RyaW5nKDE2KTtcbiAgcmV0dXJuIGhleC5sZW5ndGggJiAxID8gYDAke2hleH1gIDogaGV4O1xufVxuXG5mdW5jdGlvbiBudW1iZXJUb0J5dGVzUGFkZGVkKG51bTogYmlnaW50LCBsZW5ndGg6IG51bWJlciA9IEVOQ09ESU5HX0xFTkdUSCkge1xuICBjb25zdCBoZXggPSBudW1iZXJUb0hleChudW0pLnBhZFN0YXJ0KGxlbmd0aCAqIDIsICcwJyk7XG4gIHJldHVybiBoZXhUb0J5dGVzKGhleCkucmV2ZXJzZSgpO1xufVxuXG5mdW5jdGlvbiBlZElzTmVnYXRpdmUobnVtOiBiaWdpbnQpIHtcbiAgY29uc3QgaGV4ID0gbnVtYmVyVG9IZXgobW9kKG51bSkpO1xuICBjb25zdCBieXRlID0gTnVtYmVyLnBhcnNlSW50KGhleC5zbGljZShoZXgubGVuZ3RoIC0gMiwgaGV4Lmxlbmd0aCksIDE2KTtcbiAgcmV0dXJuIEJvb2xlYW4oYnl0ZSAmIDEpO1xufVxuXG4vLyBMaXR0bGUgRW5kaWFuXG5mdW5jdGlvbiBieXRlc1RvTnVtYmVyTEUodWludDhhOiBVaW50OEFycmF5KTogYmlnaW50IHtcbiAgbGV0IHZhbHVlID0gMG47XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdWludDhhLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFsdWUgKz0gQmlnSW50KHVpbnQ4YVtpXSkgPDwgKDhuICogQmlnSW50KGkpKTtcbiAgfVxuICByZXR1cm4gdmFsdWU7XG59XG5cbmZ1bmN0aW9uIGxvYWQ4KGlucHV0OiBVaW50OEFycmF5LCBwYWRkaW5nID0gMCkge1xuICByZXR1cm4gKFxuICAgIEJpZ0ludChpbnB1dFswICsgcGFkZGluZ10pIHxcbiAgICAoQmlnSW50KGlucHV0WzEgKyBwYWRkaW5nXSkgPDwgOG4pIHxcbiAgICAoQmlnSW50KGlucHV0WzIgKyBwYWRkaW5nXSkgPDwgMTZuKSB8XG4gICAgKEJpZ0ludChpbnB1dFszICsgcGFkZGluZ10pIDw8IDI0bikgfFxuICAgIChCaWdJbnQoaW5wdXRbNCArIHBhZGRpbmddKSA8PCAzMm4pIHxcbiAgICAoQmlnSW50KGlucHV0WzUgKyBwYWRkaW5nXSkgPDwgNDBuKSB8XG4gICAgKEJpZ0ludChpbnB1dFs2ICsgcGFkZGluZ10pIDw8IDQ4bikgfFxuICAgIChCaWdJbnQoaW5wdXRbNyArIHBhZGRpbmddKSA8PCA1Nm4pXG4gICk7XG59XG5jb25zdCBsb3c1MWJpdE1hc2sgPSAoMW4gPDwgNTFuKSAtIDFuO1xuLy8gQ1VTVE9NIGFycmF5IHRvIG51bWJlci5cbmZ1bmN0aW9uIGJ5dGVzVG9OdW1iZXJSc3QoYnl0ZXM6IFVpbnQ4QXJyYXkpIHtcbiAgY29uc3Qgb2N0ZXQxID0gbG9hZDgoYnl0ZXMsIDApICYgbG93NTFiaXRNYXNrO1xuICBjb25zdCBvY3RldDIgPSAobG9hZDgoYnl0ZXMsIDYpID4+IDNuKSAmIGxvdzUxYml0TWFzaztcbiAgY29uc3Qgb2N0ZXQzID0gKGxvYWQ4KGJ5dGVzLCAxMikgPj4gNm4pICYgbG93NTFiaXRNYXNrO1xuICBjb25zdCBvY3RldDQgPSAobG9hZDgoYnl0ZXMsIDE5KSA+PiAxbikgJiBsb3c1MWJpdE1hc2s7XG4gIGNvbnN0IG9jdGV0NSA9IChsb2FkOChieXRlcywgMjQpID4+IDEybikgJiBsb3c1MWJpdE1hc2s7XG4gIHJldHVybiBtb2Qob2N0ZXQxICsgKG9jdGV0MiA8PCA1MW4pICsgKG9jdGV0MyA8PCAxMDJuKSArIChvY3RldDQgPDwgMTUzbikgKyAob2N0ZXQ1IDw8IDIwNG4pKTtcbn1cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gbW9kKGE6IGJpZ2ludCwgYjogYmlnaW50ID0gQ1VSVkUuUCkge1xuICBjb25zdCByZXMgPSBhICUgYjtcbiAgcmV0dXJuIHJlcyA+PSAwbiA/IHJlcyA6IGIgKyByZXM7XG59XG5cbmZ1bmN0aW9uIHBvd01vZChhOiBiaWdpbnQsIHBvd2VyOiBiaWdpbnQsIG06IGJpZ2ludCA9IENVUlZFLlApIHtcbiAgbGV0IHJlcyA9IDFuO1xuICB3aGlsZSAocG93ZXIgPiAwbikge1xuICAgIGlmIChwb3dlciAmIDFuKSB7XG4gICAgICByZXMgPSBtb2QocmVzICogYSwgbSk7XG4gICAgfVxuICAgIHBvd2VyID4+PSAxbjtcbiAgICBhID0gbW9kKGEgKiBhLCBtKTtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG4vLyBFdWNsZWRpYW4gR0NEXG4vLyBodHRwczovL2JyaWxsaWFudC5vcmcvd2lraS9leHRlbmRlZC1ldWNsaWRlYW4tYWxnb3JpdGhtL1xuZnVuY3Rpb24gZWdjZChhOiBiaWdpbnQsIGI6IGJpZ2ludCkge1xuICBsZXQgW3gsIHksIHUsIHZdID0gWzBuLCAxbiwgMW4sIDBuXTtcbiAgd2hpbGUgKGEgIT09IDBuKSB7XG4gICAgbGV0IHEgPSBiIC8gYTtcbiAgICBsZXQgciA9IGIgJSBhO1xuICAgIGxldCBtID0geCAtIHUgKiBxO1xuICAgIGxldCBuID0geSAtIHYgKiBxO1xuICAgIFtiLCBhXSA9IFthLCByXTtcbiAgICBbeCwgeV0gPSBbdSwgdl07XG4gICAgW3UsIHZdID0gW20sIG5dO1xuICB9XG4gIGxldCBnY2QgPSBiO1xuICByZXR1cm4gW2djZCwgeCwgeV07XG59XG5cbmZ1bmN0aW9uIGludmVydChudW1iZXI6IGJpZ2ludCwgbW9kdWxvOiBiaWdpbnQgPSBDVVJWRS5QKSB7XG4gIGlmIChudW1iZXIgPT09IDBuIHx8IG1vZHVsbyA8PSAwbikge1xuICAgIHRocm93IG5ldyBFcnJvcignaW52ZXJ0OiBleHBlY3RlZCBwb3NpdGl2ZSBpbnRlZ2VycycpO1xuICB9XG4gIGxldCBbZ2NkLCB4XSA9IGVnY2QobW9kKG51bWJlciwgbW9kdWxvKSwgbW9kdWxvKTtcbiAgaWYgKGdjZCAhPT0gMW4pIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmVydDogZG9lcyBub3QgZXhpc3QnKTtcbiAgfVxuICByZXR1cm4gbW9kKHgsIG1vZHVsbyk7XG59XG5cbmZ1bmN0aW9uIGludmVydEJhdGNoKG51bXM6IGJpZ2ludFtdLCBuOiBiaWdpbnQgPSBDVVJWRS5QKTogYmlnaW50W10ge1xuICBjb25zdCBsZW4gPSBudW1zLmxlbmd0aDtcbiAgY29uc3Qgc2NyYXRjaCA9IG5ldyBBcnJheShsZW4pO1xuICBsZXQgYWNjID0gMW47XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAobnVtc1tpXSA9PT0gMG4pIGNvbnRpbnVlO1xuICAgIHNjcmF0Y2hbaV0gPSBhY2M7XG4gICAgYWNjID0gbW9kKGFjYyAqIG51bXNbaV0sIG4pO1xuICB9XG4gIGFjYyA9IGludmVydChhY2MsIG4pO1xuICBmb3IgKGxldCBpID0gbGVuIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICBpZiAobnVtc1tpXSA9PT0gMG4pIGNvbnRpbnVlO1xuICAgIGxldCB0bXAgPSBtb2QoYWNjICogbnVtc1tpXSwgbik7XG4gICAgbnVtc1tpXSA9IG1vZChhY2MgKiBzY3JhdGNoW2ldLCBuKTtcbiAgICBhY2MgPSB0bXA7XG4gIH1cbiAgcmV0dXJuIG51bXM7XG59XG5cbi8vIEF0dGVtcHQgdG8gY29tcHV0ZSBgc3FydCgxL251bWJlcilgIGluIGNvbnN0YW50IHRpbWUuXG5mdW5jdGlvbiBpbnZlcnRTcXJ0KG51bWJlcjogYmlnaW50KSB7XG4gIHJldHVybiBzcXJ0UmF0aW8oMW4sIG51bWJlcik7XG59XG5cbmZ1bmN0aW9uIHBvd01vZDIodDogYmlnaW50LCBwb3dlcjogYmlnaW50KSB7XG4gIGNvbnN0IHsgUCB9ID0gQ1VSVkU7XG4gIGxldCByZXMgPSB0O1xuICB3aGlsZSAocG93ZXItLSA+IDBuKSB7XG4gICAgcmVzICo9IHJlcztcbiAgICByZXMgJT0gUDtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG4vLyBQb3cgdG8gUF9ESVY0XzEuXG5mdW5jdGlvbiBwb3dfMl8yNTJfMyh0OiBiaWdpbnQpIHtcbiAgdCA9IG1vZCh0KTtcbiAgY29uc3QgeyBQIH0gPSBDVVJWRTtcbiAgY29uc3QgdDAgPSAodCAqIHQpICUgUDtcbiAgY29uc3QgdDEgPSB0MCAqKiA0biAlIFA7XG4gIGNvbnN0IHQyID0gKHQgKiB0MSkgJSBQO1xuICBjb25zdCB0MyA9ICh0MCAqIHQyKSAlIFA7XG4gIGNvbnN0IHQ0ID0gdDMgKiogMm4gJSBQO1xuICBjb25zdCB0NSA9ICh0MiAqIHQ0KSAlIFA7XG4gIGNvbnN0IHQ2ID0gcG93TW9kMih0NSwgNW4pO1xuICBjb25zdCB0NyA9ICh0NiAqIHQ1KSAlIFA7XG4gIGNvbnN0IHQ4ID0gcG93TW9kMih0NywgMTBuKTtcbiAgY29uc3QgdDkgPSAodDggKiB0NykgJSBQO1xuICBjb25zdCB0MTAgPSBwb3dNb2QyKHQ5LCAyMG4pO1xuICBjb25zdCB0MTEgPSAodDEwICogdDkpICUgUDtcbiAgY29uc3QgdDEyID0gcG93TW9kMih0MTEsIDEwbik7XG4gIGNvbnN0IHQxMyA9ICh0MTIgKiB0NykgJSBQO1xuICBjb25zdCB0MTQgPSBwb3dNb2QyKHQxMywgNTBuKTtcbiAgY29uc3QgdDE1ID0gKHQxNCAqIHQxMykgJSBQO1xuICBjb25zdCB0MTYgPSBwb3dNb2QyKHQxNSwgMTAwbik7XG4gIGNvbnN0IHQxNyA9ICh0MTYgKiB0MTUpICUgUDtcbiAgY29uc3QgdDE4ID0gcG93TW9kMih0MTcsIDUwbik7XG4gIGNvbnN0IHQxOSA9ICh0MTggKiB0MTMpICUgUDtcblxuICAvLyB0MTkgPSB0ICoqICgyICoqIDI1MCAtIDEpXG4gIGNvbnN0IHQyMCA9ICh0MTkgKiB0MTkpICUgUDtcbiAgY29uc3QgdDIxID0gKHQyMCAqIHQyMCAqIHQpICUgUDtcbiAgcmV0dXJuIHQyMTtcbn1cblxuZnVuY3Rpb24gc3FydFJhdGlvKHQ6IGJpZ2ludCwgdjogYmlnaW50KSB7XG4gIC8vIFVzaW5nIHRoZSBzYW1lIHRyaWNrIGFzIGluIGVkMjU1MTkgZGVjb2RpbmcsIHdlIG1lcmdlIHRoZVxuICAvLyBpbnZlcnNpb24sIHRoZSBzcXVhcmUgcm9vdCwgYW5kIHRoZSBzcXVhcmUgdGVzdCBhcyBmb2xsb3dzLlxuICAvL1xuICAvLyBUbyBjb21wdXRlIHNxcnQozrEpLCB3ZSBjYW4gY29tcHV0ZSDOsiA9IM6xXigocCszKS84KS5cbiAgLy8gVGhlbiDOsl4yID0gwrHOsSwgc28gbXVsdGlwbHlpbmcgzrIgYnkgc3FydCgtMSkgaWYgbmVjZXNzYXJ5XG4gIC8vIGdpdmVzIHNxcnQozrEpLlxuICAvL1xuICAvLyBUbyBjb21wdXRlIDEvc3FydCjOsSksIHdlIG9ic2VydmUgdGhhdFxuICAvLyAgICAxL86yID0gzrFeKHAtMSAtIChwKzMpLzgpID0gzrFeKCg3cC0xMSkvOClcbiAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgPSDOsV4zICogKM6xXjcpXigocC01KS84KS5cbiAgLy9cbiAgLy8gV2UgY2FuIHRoZXJlZm9yZSBjb21wdXRlIHNxcnQodS92KSA9IHNxcnQodSkvc3FydCh2KVxuICAvLyBieSBmaXJzdCBjb21wdXRpbmdcbiAgLy8gICAgciA9IHVeKChwKzMpLzgpIHZeKHAtMS0ocCszKS84KVxuICAvLyAgICAgID0gdSB1XigocC01KS84KSB2XjMgKHZeNyleKChwLTUpLzgpXG4gIC8vICAgICAgPSAodXZeMykgKHV2XjcpXigocC01KS84KS5cbiAgLy9cbiAgLy8gSWYgdiBpcyBub256ZXJvIGFuZCB1L3YgaXMgc3F1YXJlLCB0aGVuIHJeMiA9IMKxdS92LFxuICAvLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzbyB2cl4yID0gwrF1LlxuICAvLyBJZiB2cl4yID0gIHUsIHRoZW4gc3FydCh1L3YpID0gci5cbiAgLy8gSWYgdnJeMiA9IC11LCB0aGVuIHNxcnQodS92KSA9IHIqc3FydCgtMSkuXG4gIC8vXG4gIC8vIElmIHYgaXMgemVybywgciBpcyBhbHNvIHplcm8uXG4gIGNvbnN0IHYzID0gbW9kKHYgKiB2ICogdik7XG4gIGNvbnN0IHY3ID0gbW9kKHYzICogdjMgKiB2KTtcbiAgbGV0IHIgPSBtb2QocG93XzJfMjUyXzModCAqIHY3KSAqIHQgKiB2Myk7XG4gIGNvbnN0IGNoZWNrID0gbW9kKHIgKiByICogdik7XG4gIGNvbnN0IGkgPSBTUVJUX00xO1xuICBjb25zdCBjb3JyZWN0U2lnblNxcnQgPSBjaGVjayA9PT0gdDtcbiAgY29uc3QgZmxpcHBlZFNpZ25TcXJ0ID0gY2hlY2sgPT09IG1vZCgtdCk7XG4gIGNvbnN0IGZsaXBwZWRTaWduU3FydEkgPSBjaGVjayA9PT0gbW9kKG1vZCgtdCkgKiBpKTtcbiAgY29uc3QgclByaW1lID0gbW9kKFNRUlRfTTEgKiByKTtcbiAgciA9IGZsaXBwZWRTaWduU3FydCB8fCBmbGlwcGVkU2lnblNxcnRJID8gclByaW1lIDogcjtcbiAgaWYgKGVkSXNOZWdhdGl2ZShyKSkgciA9IG1vZCgtcik7XG4gIGNvbnN0IGlzTm90WmVyb1NxdWFyZSA9IGNvcnJlY3RTaWduU3FydCB8fCBmbGlwcGVkU2lnblNxcnQ7XG4gIHJldHVybiB7IGlzTm90WmVyb1NxdWFyZSwgdmFsdWU6IG1vZChyKSB9O1xufVxuXG4vLyBNYXRoIGVuZFxuXG5hc3luYyBmdW5jdGlvbiBzaGE1MTJUb051bWJlckxFKC4uLmFyZ3M6IFVpbnQ4QXJyYXlbXSk6IFByb21pc2U8YmlnaW50PiB7XG4gIGNvbnN0IG1lc3NhZ2VBcnJheSA9IGNvbmNhdEJ5dGVzKC4uLmFyZ3MpO1xuICBjb25zdCBoYXNoID0gYXdhaXQgdXRpbHMuc2hhNTEyKG1lc3NhZ2VBcnJheSk7XG4gIGNvbnN0IHZhbHVlID0gYnl0ZXNUb051bWJlckxFKGhhc2gpO1xuICByZXR1cm4gbW9kKHZhbHVlLCBDVVJWRS5uKTtcbn1cblxuZnVuY3Rpb24ga2V5UHJlZml4KHByaXZhdGVCeXRlczogVWludDhBcnJheSkge1xuICByZXR1cm4gcHJpdmF0ZUJ5dGVzLnNsaWNlKEVOQ09ESU5HX0xFTkdUSCk7XG59XG5cbmZ1bmN0aW9uIGVuY29kZVByaXZhdGUocHJpdmF0ZUJ5dGVzOiBVaW50OEFycmF5KTogYmlnaW50IHtcbiAgY29uc3QgbGFzdCA9IEVOQ09ESU5HX0xFTkdUSCAtIDE7XG4gIGNvbnN0IGhlYWQgPSBwcml2YXRlQnl0ZXMuc2xpY2UoMCwgRU5DT0RJTkdfTEVOR1RIKTtcbiAgaGVhZFswXSAmPSAyNDg7XG4gIGhlYWRbbGFzdF0gJj0gMTI3O1xuICBoZWFkW2xhc3RdIHw9IDY0O1xuXG4gIHJldHVybiBieXRlc1RvTnVtYmVyTEUoaGVhZCk7XG59XG5cbmZ1bmN0aW9uIGVuc3VyZUJ5dGVzKGhhc2g6IEhleCk6IFVpbnQ4QXJyYXkge1xuICByZXR1cm4gaGFzaCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkgPyBoYXNoIDogaGV4VG9CeXRlcyhoYXNoKTtcbn1cblxuZnVuY3Rpb24gZXF1YWxCeXRlcyhiMTogVWludDhBcnJheSwgYjI6IFVpbnQ4QXJyYXkpIHtcbiAgaWYgKGIxLmxlbmd0aCAhPT0gYjIubGVuZ3RoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgYjEubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoYjFbaV0gIT09IGIyW2ldKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBlbnN1cmVQcml2SW5wdXRCeXRlcyhwcml2YXRlS2V5OiBQcml2S2V5KTogVWludDhBcnJheSB7XG4gIGlmIChwcml2YXRlS2V5IGluc3RhbmNlb2YgVWludDhBcnJheSkgcmV0dXJuIHByaXZhdGVLZXk7XG4gIGlmICh0eXBlb2YgcHJpdmF0ZUtleSA9PT0gJ3N0cmluZycpXG4gICAgcmV0dXJuIGhleFRvQnl0ZXMocHJpdmF0ZUtleS5wYWRTdGFydChFTkNPRElOR19MRU5HVEggKiAyLCAnMCcpKTtcbiAgcmV0dXJuIGhleFRvQnl0ZXMocGFkNjQoQmlnSW50KHByaXZhdGVLZXkpKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRQdWJsaWNLZXkocHJpdmF0ZUtleTogVWludDhBcnJheSk6IFByb21pc2U8VWludDhBcnJheT47XG5leHBvcnQgZnVuY3Rpb24gZ2V0UHVibGljS2V5KHByaXZhdGVLZXk6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPjtcbmV4cG9ydCBmdW5jdGlvbiBnZXRQdWJsaWNLZXkocHJpdmF0ZUtleTogYmlnaW50IHwgbnVtYmVyKTogUHJvbWlzZTxVaW50OEFycmF5PjtcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRQdWJsaWNLZXkocHJpdmF0ZUtleTogUHJpdktleSkge1xuICBjb25zdCBwcml2Qnl0ZXMgPSBhd2FpdCB1dGlscy5zaGE1MTIoZW5zdXJlUHJpdklucHV0Qnl0ZXMocHJpdmF0ZUtleSkpO1xuICBjb25zdCBwdWJsaWNLZXkgPSBQb2ludC5CQVNFLm11bHRpcGx5KGVuY29kZVByaXZhdGUocHJpdkJ5dGVzKSk7XG4gIHJldHVybiB0eXBlb2YgcHJpdmF0ZUtleSA9PT0gJ3N0cmluZycgPyBwdWJsaWNLZXkudG9IZXgoKSA6IHB1YmxpY0tleS50b1Jhd0J5dGVzKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaWduKGhhc2g6IFVpbnQ4QXJyYXksIHByaXZhdGVLZXk6IEhleCk6IFByb21pc2U8VWludDhBcnJheT47XG5leHBvcnQgZnVuY3Rpb24gc2lnbihoYXNoOiBzdHJpbmcsIHByaXZhdGVLZXk6IEhleCk6IFByb21pc2U8c3RyaW5nPjtcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzaWduKGhhc2g6IEhleCwgcHJpdmF0ZUtleTogSGV4KSB7XG4gIGNvbnN0IHByaXZCeXRlcyA9IGF3YWl0IHV0aWxzLnNoYTUxMihlbnN1cmVQcml2SW5wdXRCeXRlcyhwcml2YXRlS2V5KSk7XG4gIGNvbnN0IHAgPSBlbmNvZGVQcml2YXRlKHByaXZCeXRlcyk7XG4gIGNvbnN0IFAgPSBQb2ludC5CQVNFLm11bHRpcGx5KHApO1xuICBjb25zdCBtc2cgPSBlbnN1cmVCeXRlcyhoYXNoKTtcbiAgY29uc3QgciA9IGF3YWl0IHNoYTUxMlRvTnVtYmVyTEUoa2V5UHJlZml4KHByaXZCeXRlcyksIG1zZyk7XG4gIGNvbnN0IFIgPSBQb2ludC5CQVNFLm11bHRpcGx5KHIpO1xuICBjb25zdCBoID0gYXdhaXQgc2hhNTEyVG9OdW1iZXJMRShSLnRvUmF3Qnl0ZXMoKSwgUC50b1Jhd0J5dGVzKCksIG1zZyk7XG4gIGNvbnN0IFMgPSBtb2QociArIGggKiBwLCBDVVJWRS5uKTtcbiAgY29uc3Qgc2lnID0gbmV3IFNpZ25SZXN1bHQoUiwgUyk7XG4gIHJldHVybiB0eXBlb2YgaGFzaCA9PT0gJ3N0cmluZycgPyBzaWcudG9IZXgoKSA6IHNpZy50b1Jhd0J5dGVzKCk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB2ZXJpZnkoc2lnbmF0dXJlOiBTaWduYXR1cmUsIGhhc2g6IEhleCwgcHVibGljS2V5OiBQdWJLZXkpIHtcbiAgaGFzaCA9IGVuc3VyZUJ5dGVzKGhhc2gpO1xuICBpZiAoIShwdWJsaWNLZXkgaW5zdGFuY2VvZiBQb2ludCkpIHB1YmxpY0tleSA9IFBvaW50LmZyb21IZXgocHVibGljS2V5KTtcbiAgaWYgKCEoc2lnbmF0dXJlIGluc3RhbmNlb2YgU2lnblJlc3VsdCkpIHNpZ25hdHVyZSA9IFNpZ25SZXN1bHQuZnJvbUhleChzaWduYXR1cmUpO1xuICBjb25zdCBoID0gYXdhaXQgc2hhNTEyVG9OdW1iZXJMRShzaWduYXR1cmUuci50b1Jhd0J5dGVzKCksIHB1YmxpY0tleS50b1Jhd0J5dGVzKCksIGhhc2gpO1xuICBjb25zdCBQaCA9IEV4dGVuZGVkUG9pbnQuZnJvbUFmZmluZShwdWJsaWNLZXkpLm11bHRpcGx5VW5zYWZlKGgpO1xuICBjb25zdCBHcyA9IEV4dGVuZGVkUG9pbnQuQkFTRS5tdWx0aXBseShzaWduYXR1cmUucyk7XG4gIGNvbnN0IFJQaCA9IEV4dGVuZGVkUG9pbnQuZnJvbUFmZmluZShzaWduYXR1cmUucikuYWRkKFBoKTtcbiAgcmV0dXJuIEdzLmVxdWFscyhSUGgpO1xufVxuXG4vLyBFbmFibGUgcHJlY29tcHV0ZXMuIFNsb3dzIGRvd24gZmlyc3QgcHVibGljS2V5IGNvbXB1dGF0aW9uIGJ5IDIwbXMuXG5Qb2ludC5CQVNFLl9zZXRXaW5kb3dTaXplKDgpO1xuXG5leHBvcnQgY29uc3QgdXRpbHMgPSB7XG4gIC8vIFRoZSA4LXRvcnNpb24gc3ViZ3JvdXAg4oSwOC5cbiAgLy8gVGhvc2UgYXJlIFwiYnVnZ3lcIiBwb2ludHMsIGlmIHlvdSBtdWx0aXBseSB0aGVtIGJ5IDgsIHlvdSdsbCByZWNlaXZlIFBvaW50LlpFUk8uXG4gIC8vIFBvcnRlZCBmcm9tIGN1cnZlMjU1MTktZGFsZWsuXG4gIFRPUlNJT05fU1VCR1JPVVA6IFtcbiAgICAnMDEwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCcsXG4gICAgJ2M3MTc2YTcwM2Q0ZGQ4NGZiYTNjMGI3NjBkMTA2NzBmMmEyMDUzZmEyYzM5Y2NjNjRlYzdmZDc3OTJhYzAzN2EnLFxuICAgICcwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDgwJyxcbiAgICAnMjZlODk1OGZjMmIyMjdiMDQ1YzNmNDg5ZjJlZjk4ZjBkNWRmYWMwNWQzYzYzMzM5YjEzODAyODg2ZDUzZmMwNScsXG4gICAgJ2VjZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmN2YnLFxuICAgICcyNmU4OTU4ZmMyYjIyN2IwNDVjM2Y0ODlmMmVmOThmMGQ1ZGZhYzA1ZDNjNjMzMzliMTM4MDI4ODZkNTNmYzg1JyxcbiAgICAnMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMCcsXG4gICAgJ2M3MTc2YTcwM2Q0ZGQ4NGZiYTNjMGI3NjBkMTA2NzBmMmEyMDUzZmEyYzM5Y2NjNjRlYzdmZDc3OTJhYzAzZmEnLFxuICBdLFxuICByYW5kb21Qcml2YXRlS2V5OiAoYnl0ZXNMZW5ndGg6IG51bWJlciA9IDMyKTogVWludDhBcnJheSA9PiB7XG4gICAgLy8gQHRzLWlnbm9yZVxuICAgIGlmICh0eXBlb2Ygd2luZG93ID09ICdvYmplY3QnICYmICdjcnlwdG8nIGluIHdpbmRvdykge1xuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgcmV0dXJuIHdpbmRvdy5jcnlwdG8uZ2V0UmFuZG9tVmFsdWVzKG5ldyBVaW50OEFycmF5KGJ5dGVzTGVuZ3RoKSk7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvY2VzcyA9PT0gJ29iamVjdCcgJiYgJ25vZGUnIGluIHByb2Nlc3MudmVyc2lvbnMpIHtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIGNvbnN0IHsgcmFuZG9tQnl0ZXMgfSA9IHJlcXVpcmUoJ2NyeXB0bycpO1xuICAgICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KHJhbmRvbUJ5dGVzKGJ5dGVzTGVuZ3RoKS5idWZmZXIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgZW52aXJvbm1lbnQgZG9lc24ndCBoYXZlIHJhbmRvbUJ5dGVzIGZ1bmN0aW9uXCIpO1xuICAgIH1cbiAgfSxcbiAgc2hhNTEyOiBhc3luYyAobWVzc2FnZTogVWludDhBcnJheSk6IFByb21pc2U8VWludDhBcnJheT4gPT4ge1xuICAgIC8vIEB0cy1pZ25vcmVcbiAgICBpZiAodHlwZW9mIHdpbmRvdyA9PSAnb2JqZWN0JyAmJiAnY3J5cHRvJyBpbiB3aW5kb3cpIHtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IHdpbmRvdy5jcnlwdG8uc3VidGxlLmRpZ2VzdCgnU0hBLTUxMicsIG1lc3NhZ2UuYnVmZmVyKTtcbiAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgIHJldHVybiBuZXcgVWludDhBcnJheShidWZmZXIpO1xuICAgICAgLy8gQHRzLWlnbm9yZVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIHByb2Nlc3MgPT09ICdvYmplY3QnICYmICdub2RlJyBpbiBwcm9jZXNzLnZlcnNpb25zKSB7XG4gICAgICAvLyBAdHMtaWdub3JlXG4gICAgICBjb25zdCB7IGNyZWF0ZUhhc2ggfSA9IHJlcXVpcmUoJ2NyeXB0bycpO1xuICAgICAgY29uc3QgaGFzaCA9IGNyZWF0ZUhhc2goJ3NoYTUxMicpO1xuICAgICAgaGFzaC51cGRhdGUobWVzc2FnZSk7XG4gICAgICByZXR1cm4gVWludDhBcnJheS5mcm9tKGhhc2guZGlnZXN0KCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgZW52aXJvbm1lbnQgZG9lc24ndCBoYXZlIHNoYTUxMiBmdW5jdGlvblwiKTtcbiAgICB9XG4gIH0sXG4gIHByZWNvbXB1dGUod2luZG93U2l6ZSA9IDgsIHBvaW50ID0gUG9pbnQuQkFTRSk6IFBvaW50IHtcbiAgICBjb25zdCBjYWNoZWQgPSBwb2ludC5lcXVhbHMoUG9pbnQuQkFTRSkgPyBwb2ludCA6IG5ldyBQb2ludChwb2ludC54LCBwb2ludC55KTtcbiAgICBjYWNoZWQuX3NldFdpbmRvd1NpemUod2luZG93U2l6ZSk7XG4gICAgY2FjaGVkLm11bHRpcGx5KDFuKTtcbiAgICByZXR1cm4gY2FjaGVkO1xuICB9LFxufTtcbiJdfQ==