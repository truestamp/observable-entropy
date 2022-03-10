var State;
(function (State) {
    State[State["PASSTHROUGH"] = 0] = "PASSTHROUGH";
    State[State["PERCENT"] = 1] = "PERCENT";
    State[State["POSITIONAL"] = 2] = "POSITIONAL";
    State[State["PRECISION"] = 3] = "PRECISION";
    State[State["WIDTH"] = 4] = "WIDTH";
})(State || (State = {}));
var WorP;
(function (WorP) {
    WorP[WorP["WIDTH"] = 0] = "WIDTH";
    WorP[WorP["PRECISION"] = 1] = "PRECISION";
})(WorP || (WorP = {}));
class Flags {
    plus;
    dash;
    sharp;
    space;
    zero;
    lessthan;
    width = -1;
    precision = -1;
}
const min = Math.min;
const UNICODE_REPLACEMENT_CHARACTER = "\ufffd";
const DEFAULT_PRECISION = 6;
const FLOAT_REGEXP = /(-?)(\d)\.?(\d*)e([+-])(\d+)/;
var F;
(function (F) {
    F[F["sign"] = 1] = "sign";
    F[F["mantissa"] = 2] = "mantissa";
    F[F["fractional"] = 3] = "fractional";
    F[F["esign"] = 4] = "esign";
    F[F["exponent"] = 5] = "exponent";
})(F || (F = {}));
class Printf {
    format;
    args;
    i;
    state = State.PASSTHROUGH;
    verb = "";
    buf = "";
    argNum = 0;
    flags = new Flags();
    haveSeen;
    tmpError;
    constructor(format, ...args) {
        this.format = format;
        this.args = args;
        this.haveSeen = Array.from({ length: args.length });
        this.i = 0;
    }
    doPrintf() {
        for (; this.i < this.format.length; ++this.i) {
            const c = this.format[this.i];
            switch (this.state) {
                case State.PASSTHROUGH:
                    if (c === "%") {
                        this.state = State.PERCENT;
                    }
                    else {
                        this.buf += c;
                    }
                    break;
                case State.PERCENT:
                    if (c === "%") {
                        this.buf += c;
                        this.state = State.PASSTHROUGH;
                    }
                    else {
                        this.handleFormat();
                    }
                    break;
                default:
                    throw Error("Should be unreachable, certainly a bug in the lib.");
            }
        }
        let extras = false;
        let err = "%!(EXTRA";
        for (let i = 0; i !== this.haveSeen.length; ++i) {
            if (!this.haveSeen[i]) {
                extras = true;
                err += ` '${Deno.inspect(this.args[i])}'`;
            }
        }
        err += ")";
        if (extras) {
            this.buf += err;
        }
        return this.buf;
    }
    handleFormat() {
        this.flags = new Flags();
        const flags = this.flags;
        for (; this.i < this.format.length; ++this.i) {
            const c = this.format[this.i];
            switch (this.state) {
                case State.PERCENT:
                    switch (c) {
                        case "[":
                            this.handlePositional();
                            this.state = State.POSITIONAL;
                            break;
                        case "+":
                            flags.plus = true;
                            break;
                        case "<":
                            flags.lessthan = true;
                            break;
                        case "-":
                            flags.dash = true;
                            flags.zero = false;
                            break;
                        case "#":
                            flags.sharp = true;
                            break;
                        case " ":
                            flags.space = true;
                            break;
                        case "0":
                            flags.zero = !flags.dash;
                            break;
                        default:
                            if (("1" <= c && c <= "9") || c === "." || c === "*") {
                                if (c === ".") {
                                    this.flags.precision = 0;
                                    this.state = State.PRECISION;
                                    this.i++;
                                }
                                else {
                                    this.state = State.WIDTH;
                                }
                                this.handleWidthAndPrecision(flags);
                            }
                            else {
                                this.handleVerb();
                                return;
                            }
                    }
                    break;
                case State.POSITIONAL:
                    if (c === "*") {
                        const worp = this.flags.precision === -1
                            ? WorP.WIDTH
                            : WorP.PRECISION;
                        this.handleWidthOrPrecisionRef(worp);
                        this.state = State.PERCENT;
                        break;
                    }
                    else {
                        this.handleVerb();
                        return;
                    }
                default:
                    throw new Error(`Should not be here ${this.state}, library bug!`);
            }
        }
    }
    handleWidthOrPrecisionRef(wOrP) {
        if (this.argNum >= this.args.length) {
            return;
        }
        const arg = this.args[this.argNum];
        this.haveSeen[this.argNum] = true;
        if (typeof arg === "number") {
            switch (wOrP) {
                case WorP.WIDTH:
                    this.flags.width = arg;
                    break;
                default:
                    this.flags.precision = arg;
            }
        }
        else {
            const tmp = wOrP === WorP.WIDTH ? "WIDTH" : "PREC";
            this.tmpError = `%!(BAD ${tmp} '${this.args[this.argNum]}')`;
        }
        this.argNum++;
    }
    handleWidthAndPrecision(flags) {
        const fmt = this.format;
        for (; this.i !== this.format.length; ++this.i) {
            const c = fmt[this.i];
            switch (this.state) {
                case State.WIDTH:
                    switch (c) {
                        case ".":
                            this.flags.precision = 0;
                            this.state = State.PRECISION;
                            break;
                        case "*":
                            this.handleWidthOrPrecisionRef(WorP.WIDTH);
                            break;
                        default: {
                            const val = parseInt(c);
                            if (isNaN(val)) {
                                this.i--;
                                this.state = State.PERCENT;
                                return;
                            }
                            flags.width = flags.width == -1 ? 0 : flags.width;
                            flags.width *= 10;
                            flags.width += val;
                        }
                    }
                    break;
                case State.PRECISION: {
                    if (c === "*") {
                        this.handleWidthOrPrecisionRef(WorP.PRECISION);
                        break;
                    }
                    const val = parseInt(c);
                    if (isNaN(val)) {
                        this.i--;
                        this.state = State.PERCENT;
                        return;
                    }
                    flags.precision *= 10;
                    flags.precision += val;
                    break;
                }
                default:
                    throw new Error("can't be here. bug.");
            }
        }
    }
    handlePositional() {
        if (this.format[this.i] !== "[") {
            throw new Error("Can't happen? Bug.");
        }
        let positional = 0;
        const format = this.format;
        this.i++;
        let err = false;
        for (; this.i !== this.format.length; ++this.i) {
            if (format[this.i] === "]") {
                break;
            }
            positional *= 10;
            const val = parseInt(format[this.i]);
            if (isNaN(val)) {
                this.tmpError = "%!(BAD INDEX)";
                err = true;
            }
            positional += val;
        }
        if (positional - 1 >= this.args.length) {
            this.tmpError = "%!(BAD INDEX)";
            err = true;
        }
        this.argNum = err ? this.argNum : positional - 1;
        return;
    }
    handleLessThan() {
        const arg = this.args[this.argNum];
        if ((arg || {}).constructor.name !== "Array") {
            throw new Error(`arg ${arg} is not an array. Todo better error handling`);
        }
        let str = "[ ";
        for (let i = 0; i !== arg.length; ++i) {
            if (i !== 0)
                str += ", ";
            str += this._handleVerb(arg[i]);
        }
        return str + " ]";
    }
    handleVerb() {
        const verb = this.format[this.i];
        this.verb = verb;
        if (this.tmpError) {
            this.buf += this.tmpError;
            this.tmpError = undefined;
            if (this.argNum < this.haveSeen.length) {
                this.haveSeen[this.argNum] = true;
            }
        }
        else if (this.args.length <= this.argNum) {
            this.buf += `%!(MISSING '${verb}')`;
        }
        else {
            const arg = this.args[this.argNum];
            this.haveSeen[this.argNum] = true;
            if (this.flags.lessthan) {
                this.buf += this.handleLessThan();
            }
            else {
                this.buf += this._handleVerb(arg);
            }
        }
        this.argNum++;
        this.state = State.PASSTHROUGH;
    }
    _handleVerb(arg) {
        switch (this.verb) {
            case "t":
                return this.pad(arg.toString());
            case "b":
                return this.fmtNumber(arg, 2);
            case "c":
                return this.fmtNumberCodePoint(arg);
            case "d":
                return this.fmtNumber(arg, 10);
            case "o":
                return this.fmtNumber(arg, 8);
            case "x":
                return this.fmtHex(arg);
            case "X":
                return this.fmtHex(arg, true);
            case "e":
                return this.fmtFloatE(arg);
            case "E":
                return this.fmtFloatE(arg, true);
            case "f":
            case "F":
                return this.fmtFloatF(arg);
            case "g":
                return this.fmtFloatG(arg);
            case "G":
                return this.fmtFloatG(arg, true);
            case "s":
                return this.fmtString(arg);
            case "T":
                return this.fmtString(typeof arg);
            case "v":
                return this.fmtV(arg);
            case "j":
                return this.fmtJ(arg);
            default:
                return `%!(BAD VERB '${this.verb}')`;
        }
    }
    pad(s) {
        const padding = this.flags.zero ? "0" : " ";
        if (this.flags.dash) {
            return s.padEnd(this.flags.width, padding);
        }
        return s.padStart(this.flags.width, padding);
    }
    padNum(nStr, neg) {
        let sign;
        if (neg) {
            sign = "-";
        }
        else if (this.flags.plus || this.flags.space) {
            sign = this.flags.plus ? "+" : " ";
        }
        else {
            sign = "";
        }
        const zero = this.flags.zero;
        if (!zero) {
            nStr = sign + nStr;
        }
        const pad = zero ? "0" : " ";
        const len = zero ? this.flags.width - sign.length : this.flags.width;
        if (this.flags.dash) {
            nStr = nStr.padEnd(len, pad);
        }
        else {
            nStr = nStr.padStart(len, pad);
        }
        if (zero) {
            nStr = sign + nStr;
        }
        return nStr;
    }
    fmtNumber(n, radix, upcase = false) {
        let num = Math.abs(n).toString(radix);
        const prec = this.flags.precision;
        if (prec !== -1) {
            this.flags.zero = false;
            num = n === 0 && prec === 0 ? "" : num;
            while (num.length < prec) {
                num = "0" + num;
            }
        }
        let prefix = "";
        if (this.flags.sharp) {
            switch (radix) {
                case 2:
                    prefix += "0b";
                    break;
                case 8:
                    prefix += num.startsWith("0") ? "" : "0";
                    break;
                case 16:
                    prefix += "0x";
                    break;
                default:
                    throw new Error("cannot handle base: " + radix);
            }
        }
        num = num.length === 0 ? num : prefix + num;
        if (upcase) {
            num = num.toUpperCase();
        }
        return this.padNum(num, n < 0);
    }
    fmtNumberCodePoint(n) {
        let s = "";
        try {
            s = String.fromCodePoint(n);
        }
        catch {
            s = UNICODE_REPLACEMENT_CHARACTER;
        }
        return this.pad(s);
    }
    fmtFloatSpecial(n) {
        if (isNaN(n)) {
            this.flags.zero = false;
            return this.padNum("NaN", false);
        }
        if (n === Number.POSITIVE_INFINITY) {
            this.flags.zero = false;
            this.flags.plus = true;
            return this.padNum("Inf", false);
        }
        if (n === Number.NEGATIVE_INFINITY) {
            this.flags.zero = false;
            return this.padNum("Inf", true);
        }
        return "";
    }
    roundFractionToPrecision(fractional, precision) {
        let round = false;
        if (fractional.length > precision) {
            fractional = "1" + fractional;
            let tmp = parseInt(fractional.substr(0, precision + 2)) / 10;
            tmp = Math.round(tmp);
            fractional = Math.floor(tmp).toString();
            round = fractional[0] === "2";
            fractional = fractional.substr(1);
        }
        else {
            while (fractional.length < precision) {
                fractional += "0";
            }
        }
        return [fractional, round];
    }
    fmtFloatE(n, upcase = false) {
        const special = this.fmtFloatSpecial(n);
        if (special !== "") {
            return special;
        }
        const m = n.toExponential().match(FLOAT_REGEXP);
        if (!m) {
            throw Error("can't happen, bug");
        }
        let fractional = m[F.fractional];
        const precision = this.flags.precision !== -1
            ? this.flags.precision
            : DEFAULT_PRECISION;
        let rounding = false;
        [fractional, rounding] = this.roundFractionToPrecision(fractional, precision);
        let e = m[F.exponent];
        let esign = m[F.esign];
        let mantissa = parseInt(m[F.mantissa]);
        if (rounding) {
            mantissa += 1;
            if (10 <= mantissa) {
                mantissa = 1;
                const r = parseInt(esign + e) + 1;
                e = r.toString();
                esign = r < 0 ? "-" : "+";
            }
        }
        e = e.length == 1 ? "0" + e : e;
        const val = `${mantissa}.${fractional}${upcase ? "E" : "e"}${esign}${e}`;
        return this.padNum(val, n < 0);
    }
    fmtFloatF(n) {
        const special = this.fmtFloatSpecial(n);
        if (special !== "") {
            return special;
        }
        function expandNumber(n) {
            if (Number.isSafeInteger(n)) {
                return n.toString() + ".";
            }
            const t = n.toExponential().split("e");
            let m = t[0].replace(".", "");
            const e = parseInt(t[1]);
            if (e < 0) {
                let nStr = "0.";
                for (let i = 0; i !== Math.abs(e) - 1; ++i) {
                    nStr += "0";
                }
                return (nStr += m);
            }
            else {
                const splIdx = e + 1;
                while (m.length < splIdx) {
                    m += "0";
                }
                return m.substr(0, splIdx) + "." + m.substr(splIdx);
            }
        }
        const val = expandNumber(Math.abs(n));
        const arr = val.split(".");
        let dig = arr[0];
        let fractional = arr[1];
        const precision = this.flags.precision !== -1
            ? this.flags.precision
            : DEFAULT_PRECISION;
        let round = false;
        [fractional, round] = this.roundFractionToPrecision(fractional, precision);
        if (round) {
            dig = (parseInt(dig) + 1).toString();
        }
        return this.padNum(`${dig}.${fractional}`, n < 0);
    }
    fmtFloatG(n, upcase = false) {
        const special = this.fmtFloatSpecial(n);
        if (special !== "") {
            return special;
        }
        let P = this.flags.precision !== -1
            ? this.flags.precision
            : DEFAULT_PRECISION;
        P = P === 0 ? 1 : P;
        const m = n.toExponential().match(FLOAT_REGEXP);
        if (!m) {
            throw Error("can't happen");
        }
        const X = parseInt(m[F.exponent]) * (m[F.esign] === "-" ? -1 : 1);
        let nStr = "";
        if (P > X && X >= -4) {
            this.flags.precision = P - (X + 1);
            nStr = this.fmtFloatF(n);
            if (!this.flags.sharp) {
                nStr = nStr.replace(/\.?0*$/, "");
            }
        }
        else {
            this.flags.precision = P - 1;
            nStr = this.fmtFloatE(n);
            if (!this.flags.sharp) {
                nStr = nStr.replace(/\.?0*e/, upcase ? "E" : "e");
            }
        }
        return nStr;
    }
    fmtString(s) {
        if (this.flags.precision !== -1) {
            s = s.substr(0, this.flags.precision);
        }
        return this.pad(s);
    }
    fmtHex(val, upper = false) {
        switch (typeof val) {
            case "number":
                return this.fmtNumber(val, 16, upper);
            case "string": {
                const sharp = this.flags.sharp && val.length !== 0;
                let hex = sharp ? "0x" : "";
                const prec = this.flags.precision;
                const end = prec !== -1 ? min(prec, val.length) : val.length;
                for (let i = 0; i !== end; ++i) {
                    if (i !== 0 && this.flags.space) {
                        hex += sharp ? " 0x" : " ";
                    }
                    const c = (val.charCodeAt(i) & 0xff).toString(16);
                    hex += c.length === 1 ? `0${c}` : c;
                }
                if (upper) {
                    hex = hex.toUpperCase();
                }
                return this.pad(hex);
            }
            default:
                throw new Error("currently only number and string are implemented for hex");
        }
    }
    fmtV(val) {
        if (this.flags.sharp) {
            const options = this.flags.precision !== -1
                ? { depth: this.flags.precision }
                : {};
            return this.pad(Deno.inspect(val, options));
        }
        else {
            const p = this.flags.precision;
            return p === -1 ? val.toString() : val.toString().substr(0, p);
        }
    }
    fmtJ(val) {
        return JSON.stringify(val);
    }
}
export function sprintf(format, ...args) {
    const printf = new Printf(format, ...args);
    return printf.doPrintf();
}
export function printf(format, ...args) {
    const s = sprintf(format, ...args);
    Deno.stdout.writeSync(new TextEncoder().encode(s));
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJpbnRmLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicHJpbnRmLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUtBLElBQUssS0FNSjtBQU5ELFdBQUssS0FBSztJQUNSLCtDQUFXLENBQUE7SUFDWCx1Q0FBTyxDQUFBO0lBQ1AsNkNBQVUsQ0FBQTtJQUNWLDJDQUFTLENBQUE7SUFDVCxtQ0FBSyxDQUFBO0FBQ1AsQ0FBQyxFQU5JLEtBQUssS0FBTCxLQUFLLFFBTVQ7QUFFRCxJQUFLLElBR0o7QUFIRCxXQUFLLElBQUk7SUFDUCxpQ0FBSyxDQUFBO0lBQ0wseUNBQVMsQ0FBQTtBQUNYLENBQUMsRUFISSxJQUFJLEtBQUosSUFBSSxRQUdSO0FBRUQsTUFBTSxLQUFLO0lBQ1QsSUFBSSxDQUFXO0lBQ2YsSUFBSSxDQUFXO0lBQ2YsS0FBSyxDQUFXO0lBQ2hCLEtBQUssQ0FBVztJQUNoQixJQUFJLENBQVc7SUFDZixRQUFRLENBQVc7SUFDbkIsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ1gsU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDO0NBQ2hCO0FBRUQsTUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztBQUNyQixNQUFNLDZCQUE2QixHQUFHLFFBQVEsQ0FBQztBQUMvQyxNQUFNLGlCQUFpQixHQUFHLENBQUMsQ0FBQztBQUM1QixNQUFNLFlBQVksR0FBRyw4QkFBOEIsQ0FBQztBQUVwRCxJQUFLLENBTUo7QUFORCxXQUFLLENBQUM7SUFDSix5QkFBUSxDQUFBO0lBQ1IsaUNBQVEsQ0FBQTtJQUNSLHFDQUFVLENBQUE7SUFDViwyQkFBSyxDQUFBO0lBQ0wsaUNBQVEsQ0FBQTtBQUNWLENBQUMsRUFOSSxDQUFDLEtBQUQsQ0FBQyxRQU1MO0FBRUQsTUFBTSxNQUFNO0lBQ1YsTUFBTSxDQUFTO0lBQ2YsSUFBSSxDQUFZO0lBQ2hCLENBQUMsQ0FBUztJQUVWLEtBQUssR0FBVSxLQUFLLENBQUMsV0FBVyxDQUFDO0lBQ2pDLElBQUksR0FBRyxFQUFFLENBQUM7SUFDVixHQUFHLEdBQUcsRUFBRSxDQUFDO0lBQ1QsTUFBTSxHQUFHLENBQUMsQ0FBQztJQUNYLEtBQUssR0FBVSxJQUFJLEtBQUssRUFBRSxDQUFDO0lBRTNCLFFBQVEsQ0FBWTtJQUdwQixRQUFRLENBQVU7SUFFbEIsWUFBWSxNQUFjLEVBQUUsR0FBRyxJQUFlO1FBQzVDLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQztRQUNwRCxJQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNiLENBQUM7SUFFRCxRQUFRO1FBQ04sT0FBTyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtZQUM1QyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM5QixRQUFRLElBQUksQ0FBQyxLQUFLLEVBQUU7Z0JBQ2xCLEtBQUssS0FBSyxDQUFDLFdBQVc7b0JBQ3BCLElBQUksQ0FBQyxLQUFLLEdBQUcsRUFBRTt3QkFDYixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7cUJBQzVCO3lCQUFNO3dCQUNMLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO3FCQUNmO29CQUNELE1BQU07Z0JBQ1IsS0FBSyxLQUFLLENBQUMsT0FBTztvQkFDaEIsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFO3dCQUNiLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO3dCQUNkLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztxQkFDaEM7eUJBQU07d0JBQ0wsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO3FCQUNyQjtvQkFDRCxNQUFNO2dCQUNSO29CQUNFLE1BQU0sS0FBSyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7YUFDckU7U0FDRjtRQUVELElBQUksTUFBTSxHQUFHLEtBQUssQ0FBQztRQUNuQixJQUFJLEdBQUcsR0FBRyxVQUFVLENBQUM7UUFDckIsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxFQUFFO1lBQy9DLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUNyQixNQUFNLEdBQUcsSUFBSSxDQUFDO2dCQUNkLEdBQUcsSUFBSSxLQUFLLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7YUFDM0M7U0FDRjtRQUNELEdBQUcsSUFBSSxHQUFHLENBQUM7UUFDWCxJQUFJLE1BQU0sRUFBRTtZQUNWLElBQUksQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDO1NBQ2pCO1FBQ0QsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDO0lBQ2xCLENBQUM7SUFHRCxZQUFZO1FBQ1YsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDO1FBQ3pCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUM7UUFDekIsT0FBTyxJQUFJLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsRUFBRTtZQUM1QyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM5QixRQUFRLElBQUksQ0FBQyxLQUFLLEVBQUU7Z0JBQ2xCLEtBQUssS0FBSyxDQUFDLE9BQU87b0JBQ2hCLFFBQVEsQ0FBQyxFQUFFO3dCQUNULEtBQUssR0FBRzs0QkFDTixJQUFJLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQzs0QkFDeEIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsVUFBVSxDQUFDOzRCQUM5QixNQUFNO3dCQUNSLEtBQUssR0FBRzs0QkFDTixLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQzs0QkFDbEIsTUFBTTt3QkFDUixLQUFLLEdBQUc7NEJBQ04sS0FBSyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7NEJBQ3RCLE1BQU07d0JBQ1IsS0FBSyxHQUFHOzRCQUNOLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDOzRCQUNsQixLQUFLLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQzs0QkFDbkIsTUFBTTt3QkFDUixLQUFLLEdBQUc7NEJBQ04sS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7NEJBQ25CLE1BQU07d0JBQ1IsS0FBSyxHQUFHOzRCQUNOLEtBQUssQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDOzRCQUNuQixNQUFNO3dCQUNSLEtBQUssR0FBRzs0QkFFTixLQUFLLENBQUMsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQzs0QkFDekIsTUFBTTt3QkFDUjs0QkFDRSxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFO2dDQUNwRCxJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUU7b0NBQ2IsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxDQUFDO29DQUN6QixJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUM7b0NBQzdCLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQztpQ0FDVjtxQ0FBTTtvQ0FDTCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUM7aUNBQzFCO2dDQUNELElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxLQUFLLENBQUMsQ0FBQzs2QkFDckM7aUNBQU07Z0NBQ0wsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO2dDQUNsQixPQUFPOzZCQUNSO3FCQUNKO29CQUNELE1BQU07Z0JBQ1IsS0FBSyxLQUFLLENBQUMsVUFBVTtvQkFFbkIsSUFBSSxDQUFDLEtBQUssR0FBRyxFQUFFO3dCQUNiLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQzs0QkFDdEMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLOzRCQUNaLENBQUMsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO3dCQUNuQixJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ3JDLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQzt3QkFDM0IsTUFBTTtxQkFDUDt5QkFBTTt3QkFDTCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7d0JBQ2xCLE9BQU87cUJBQ1I7Z0JBQ0g7b0JBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsSUFBSSxDQUFDLEtBQUssZ0JBQWdCLENBQUMsQ0FBQzthQUNyRTtTQUNGO0lBQ0gsQ0FBQztJQU1ELHlCQUF5QixDQUFDLElBQVU7UUFDbEMsSUFBSSxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFO1lBRW5DLE9BQU87U0FDUjtRQUNELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ25DLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQztRQUNsQyxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRTtZQUMzQixRQUFRLElBQUksRUFBRTtnQkFDWixLQUFLLElBQUksQ0FBQyxLQUFLO29CQUNiLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLEdBQUcsQ0FBQztvQkFDdkIsTUFBTTtnQkFDUjtvQkFDRSxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxHQUFHLENBQUM7YUFDOUI7U0FDRjthQUFNO1lBQ0wsTUFBTSxHQUFHLEdBQUcsSUFBSSxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDO1lBQ25ELElBQUksQ0FBQyxRQUFRLEdBQUcsVUFBVSxHQUFHLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztTQUM5RDtRQUNELElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztJQUNoQixDQUFDO0lBTUQsdUJBQXVCLENBQUMsS0FBWTtRQUNsQyxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ3hCLE9BQU8sSUFBSSxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDLEVBQUU7WUFDOUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN0QixRQUFRLElBQUksQ0FBQyxLQUFLLEVBQUU7Z0JBQ2xCLEtBQUssS0FBSyxDQUFDLEtBQUs7b0JBQ2QsUUFBUSxDQUFDLEVBQUU7d0JBQ1QsS0FBSyxHQUFHOzRCQUVOLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLENBQUMsQ0FBQzs0QkFDekIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDOzRCQUM3QixNQUFNO3dCQUNSLEtBQUssR0FBRzs0QkFDTixJQUFJLENBQUMseUJBQXlCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDOzRCQUUzQyxNQUFNO3dCQUNSLE9BQU8sQ0FBQyxDQUFDOzRCQUNQLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQzs0QkFJeEIsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0NBQ2QsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDO2dDQUNULElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQztnQ0FDM0IsT0FBTzs2QkFDUjs0QkFDRCxLQUFLLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQzs0QkFDbEQsS0FBSyxDQUFDLEtBQUssSUFBSSxFQUFFLENBQUM7NEJBQ2xCLEtBQUssQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDO3lCQUNwQjtxQkFDRjtvQkFDRCxNQUFNO2dCQUNSLEtBQUssS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUNwQixJQUFJLENBQUMsS0FBSyxHQUFHLEVBQUU7d0JBQ2IsSUFBSSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQzt3QkFDL0MsTUFBTTtxQkFDUDtvQkFDRCxNQUFNLEdBQUcsR0FBRyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3hCLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFO3dCQUVkLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQzt3QkFDVCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7d0JBQzNCLE9BQU87cUJBQ1I7b0JBQ0QsS0FBSyxDQUFDLFNBQVMsSUFBSSxFQUFFLENBQUM7b0JBQ3RCLEtBQUssQ0FBQyxTQUFTLElBQUksR0FBRyxDQUFDO29CQUN2QixNQUFNO2lCQUNQO2dCQUNEO29CQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQzthQUMxQztTQUNGO0lBQ0gsQ0FBQztJQUdELGdCQUFnQjtRQUNkLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxFQUFFO1lBRS9CLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQztTQUN2QztRQUNELElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztRQUNuQixNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQzNCLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNULElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQztRQUNoQixPQUFPLElBQUksQ0FBQyxDQUFDLEtBQUssSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxFQUFFO1lBQzlDLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7Z0JBQzFCLE1BQU07YUFDUDtZQUNELFVBQVUsSUFBSSxFQUFFLENBQUM7WUFDakIsTUFBTSxHQUFHLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNyQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRTtnQkFJZCxJQUFJLENBQUMsUUFBUSxHQUFHLGVBQWUsQ0FBQztnQkFDaEMsR0FBRyxHQUFHLElBQUksQ0FBQzthQUNaO1lBQ0QsVUFBVSxJQUFJLEdBQUcsQ0FBQztTQUNuQjtRQUNELElBQUksVUFBVSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUN0QyxJQUFJLENBQUMsUUFBUSxHQUFHLGVBQWUsQ0FBQztZQUNoQyxHQUFHLEdBQUcsSUFBSSxDQUFDO1NBQ1o7UUFDRCxJQUFJLENBQUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxHQUFHLENBQUMsQ0FBQztRQUNqRCxPQUFPO0lBQ1QsQ0FBQztJQUdELGNBQWM7UUFFWixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQVEsQ0FBQztRQUMxQyxJQUFJLENBQUMsR0FBRyxJQUFJLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLEtBQUssT0FBTyxFQUFFO1lBQzVDLE1BQU0sSUFBSSxLQUFLLENBQUMsT0FBTyxHQUFHLDhDQUE4QyxDQUFDLENBQUM7U0FDM0U7UUFDRCxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUM7UUFDZixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssR0FBRyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsRUFBRTtZQUNyQyxJQUFJLENBQUMsS0FBSyxDQUFDO2dCQUFFLEdBQUcsSUFBSSxJQUFJLENBQUM7WUFDekIsR0FBRyxJQUFJLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDakM7UUFDRCxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUM7SUFDcEIsQ0FBQztJQUdELFVBQVU7UUFDUixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNqQyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztRQUNqQixJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDakIsSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDO1lBQzFCLElBQUksQ0FBQyxRQUFRLEdBQUcsU0FBUyxDQUFDO1lBQzFCLElBQUksSUFBSSxDQUFDLE1BQU0sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRTtnQkFDdEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDO2FBQ25DO1NBQ0Y7YUFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDMUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxlQUFlLElBQUksSUFBSSxDQUFDO1NBQ3JDO2FBQU07WUFDTCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNuQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDbEMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRTtnQkFDdkIsSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsY0FBYyxFQUFFLENBQUM7YUFDbkM7aUJBQU07Z0JBQ0wsSUFBSSxDQUFDLEdBQUcsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQ25DO1NBQ0Y7UUFDRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDZCxJQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxXQUFXLENBQUM7SUFDakMsQ0FBQztJQUdELFdBQVcsQ0FBQyxHQUFRO1FBQ2xCLFFBQVEsSUFBSSxDQUFDLElBQUksRUFBRTtZQUNqQixLQUFLLEdBQUc7Z0JBQ04sT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ2xDLEtBQUssR0FBRztnQkFDTixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBYSxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzFDLEtBQUssR0FBRztnQkFDTixPQUFPLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxHQUFhLENBQUMsQ0FBQztZQUNoRCxLQUFLLEdBQUc7Z0JBQ04sT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQWEsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUMzQyxLQUFLLEdBQUc7Z0JBQ04sT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQWEsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUMxQyxLQUFLLEdBQUc7Z0JBQ04sT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzFCLEtBQUssR0FBRztnQkFDTixPQUFPLElBQUksQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2hDLEtBQUssR0FBRztnQkFDTixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBYSxDQUFDLENBQUM7WUFDdkMsS0FBSyxHQUFHO2dCQUNOLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFhLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDN0MsS0FBSyxHQUFHLENBQUM7WUFDVCxLQUFLLEdBQUc7Z0JBQ04sT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQWEsQ0FBQyxDQUFDO1lBQ3ZDLEtBQUssR0FBRztnQkFDTixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBYSxDQUFDLENBQUM7WUFDdkMsS0FBSyxHQUFHO2dCQUNOLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFhLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDN0MsS0FBSyxHQUFHO2dCQUNOLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFhLENBQUMsQ0FBQztZQUN2QyxLQUFLLEdBQUc7Z0JBQ04sT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7WUFDcEMsS0FBSyxHQUFHO2dCQUNOLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN4QixLQUFLLEdBQUc7Z0JBQ04sT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3hCO2dCQUNFLE9BQU8sZ0JBQWdCLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQztTQUN4QztJQUNILENBQUM7SUFNRCxHQUFHLENBQUMsQ0FBUztRQUNYLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztRQUU1QyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFO1lBQ25CLE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztTQUM1QztRQUVELE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxPQUFPLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBT0QsTUFBTSxDQUFDLElBQVksRUFBRSxHQUFZO1FBQy9CLElBQUksSUFBWSxDQUFDO1FBQ2pCLElBQUksR0FBRyxFQUFFO1lBQ1AsSUFBSSxHQUFHLEdBQUcsQ0FBQztTQUNaO2FBQU0sSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRTtZQUM5QyxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1NBQ3BDO2FBQU07WUFDTCxJQUFJLEdBQUcsRUFBRSxDQUFDO1NBQ1g7UUFDRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztRQUM3QixJQUFJLENBQUMsSUFBSSxFQUFFO1lBR1QsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7U0FDcEI7UUFFRCxNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO1FBQzdCLE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUM7UUFFckUsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRTtZQUNuQixJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7U0FDOUI7YUFBTTtZQUNMLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztTQUNoQztRQUVELElBQUksSUFBSSxFQUFFO1lBRVIsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7U0FDcEI7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFRRCxTQUFTLENBQUMsQ0FBUyxFQUFFLEtBQWEsRUFBRSxNQUFNLEdBQUcsS0FBSztRQUNoRCxJQUFJLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN0QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQztRQUNsQyxJQUFJLElBQUksS0FBSyxDQUFDLENBQUMsRUFBRTtZQUNmLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQztZQUN4QixHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztZQUN2QyxPQUFPLEdBQUcsQ0FBQyxNQUFNLEdBQUcsSUFBSSxFQUFFO2dCQUN4QixHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsQ0FBQzthQUNqQjtTQUNGO1FBQ0QsSUFBSSxNQUFNLEdBQUcsRUFBRSxDQUFDO1FBQ2hCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUU7WUFDcEIsUUFBUSxLQUFLLEVBQUU7Z0JBQ2IsS0FBSyxDQUFDO29CQUNKLE1BQU0sSUFBSSxJQUFJLENBQUM7b0JBQ2YsTUFBTTtnQkFDUixLQUFLLENBQUM7b0JBRUosTUFBTSxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO29CQUN6QyxNQUFNO2dCQUNSLEtBQUssRUFBRTtvQkFDTCxNQUFNLElBQUksSUFBSSxDQUFDO29CQUNmLE1BQU07Z0JBQ1I7b0JBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsR0FBRyxLQUFLLENBQUMsQ0FBQzthQUNuRDtTQUNGO1FBRUQsR0FBRyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7UUFDNUMsSUFBSSxNQUFNLEVBQUU7WUFDVixHQUFHLEdBQUcsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDO1NBQ3pCO1FBQ0QsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7SUFDakMsQ0FBQztJQU1ELGtCQUFrQixDQUFDLENBQVM7UUFDMUIsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ1gsSUFBSTtZQUNGLENBQUMsR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQzdCO1FBQUMsTUFBTTtZQUNOLENBQUMsR0FBRyw2QkFBNkIsQ0FBQztTQUNuQztRQUNELE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNyQixDQUFDO0lBTUQsZUFBZSxDQUFDLENBQVM7UUFJdkIsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDWixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUM7WUFDeEIsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztTQUNsQztRQUNELElBQUksQ0FBQyxLQUFLLE1BQU0sQ0FBQyxpQkFBaUIsRUFBRTtZQUNsQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUM7WUFDeEIsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1lBQ3ZCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDbEM7UUFDRCxJQUFJLENBQUMsS0FBSyxNQUFNLENBQUMsaUJBQWlCLEVBQUU7WUFDbEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsS0FBSyxDQUFDO1lBQ3hCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDakM7UUFDRCxPQUFPLEVBQUUsQ0FBQztJQUNaLENBQUM7SUFRRCx3QkFBd0IsQ0FDdEIsVUFBa0IsRUFDbEIsU0FBaUI7UUFFakIsSUFBSSxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ2xCLElBQUksVUFBVSxDQUFDLE1BQU0sR0FBRyxTQUFTLEVBQUU7WUFDakMsVUFBVSxHQUFHLEdBQUcsR0FBRyxVQUFVLENBQUM7WUFDOUIsSUFBSSxHQUFHLEdBQUcsUUFBUSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLFNBQVMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUM3RCxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN0QixVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN4QyxLQUFLLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsQ0FBQztZQUM5QixVQUFVLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNuQzthQUFNO1lBQ0wsT0FBTyxVQUFVLENBQUMsTUFBTSxHQUFHLFNBQVMsRUFBRTtnQkFDcEMsVUFBVSxJQUFJLEdBQUcsQ0FBQzthQUNuQjtTQUNGO1FBQ0QsT0FBTyxDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUM3QixDQUFDO0lBT0QsU0FBUyxDQUFDLENBQVMsRUFBRSxNQUFNLEdBQUcsS0FBSztRQUNqQyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3hDLElBQUksT0FBTyxLQUFLLEVBQUUsRUFBRTtZQUNsQixPQUFPLE9BQU8sQ0FBQztTQUNoQjtRQUVELE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDaEQsSUFBSSxDQUFDLENBQUMsRUFBRTtZQUNOLE1BQU0sS0FBSyxDQUFDLG1CQUFtQixDQUFDLENBQUM7U0FDbEM7UUFDRCxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2pDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQztZQUMzQyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTO1lBQ3RCLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQztRQUN0QixJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFDckIsQ0FBQyxVQUFVLEVBQUUsUUFBUSxDQUFDLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixDQUNwRCxVQUFVLEVBQ1YsU0FBUyxDQUNWLENBQUM7UUFFRixJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3RCLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFdkIsSUFBSSxRQUFRLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztRQUN2QyxJQUFJLFFBQVEsRUFBRTtZQUNaLFFBQVEsSUFBSSxDQUFDLENBQUM7WUFDZCxJQUFJLEVBQUUsSUFBSSxRQUFRLEVBQUU7Z0JBQ2xCLFFBQVEsR0FBRyxDQUFDLENBQUM7Z0JBQ2IsTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ2xDLENBQUMsR0FBRyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ2pCLEtBQUssR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQzthQUMzQjtTQUNGO1FBQ0QsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEMsTUFBTSxHQUFHLEdBQUcsR0FBRyxRQUFRLElBQUksVUFBVSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLEdBQUcsS0FBSyxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ3pFLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFNRCxTQUFTLENBQUMsQ0FBUztRQUNqQixNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3hDLElBQUksT0FBTyxLQUFLLEVBQUUsRUFBRTtZQUNsQixPQUFPLE9BQU8sQ0FBQztTQUNoQjtRQUlELFNBQVMsWUFBWSxDQUFDLENBQVM7WUFDN0IsSUFBSSxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxFQUFFO2dCQUMzQixPQUFPLENBQUMsQ0FBQyxRQUFRLEVBQUUsR0FBRyxHQUFHLENBQUM7YUFDM0I7WUFFRCxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsYUFBYSxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1lBQzlCLE1BQU0sQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QixJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ1QsSUFBSSxJQUFJLEdBQUcsSUFBSSxDQUFDO2dCQUNoQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxDQUFDLEVBQUU7b0JBQzFDLElBQUksSUFBSSxHQUFHLENBQUM7aUJBQ2I7Z0JBQ0QsT0FBTyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsQ0FBQzthQUNwQjtpQkFBTTtnQkFDTCxNQUFNLE1BQU0sR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNyQixPQUFPLENBQUMsQ0FBQyxNQUFNLEdBQUcsTUFBTSxFQUFFO29CQUN4QixDQUFDLElBQUksR0FBRyxDQUFDO2lCQUNWO2dCQUNELE9BQU8sQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDckQ7UUFDSCxDQUFDO1FBRUQsTUFBTSxHQUFHLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQVcsQ0FBQztRQUNoRCxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzNCLElBQUksR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNqQixJQUFJLFVBQVUsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFeEIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDO1lBQzNDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVM7WUFDdEIsQ0FBQyxDQUFDLGlCQUFpQixDQUFDO1FBQ3RCLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQztRQUNsQixDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsVUFBVSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1FBQzNFLElBQUksS0FBSyxFQUFFO1lBQ1QsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO1NBQ3RDO1FBQ0QsT0FBTyxJQUFJLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLFVBQVUsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztJQUNwRCxDQUFDO0lBT0QsU0FBUyxDQUFDLENBQVMsRUFBRSxNQUFNLEdBQUcsS0FBSztRQUNqQyxNQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3hDLElBQUksT0FBTyxLQUFLLEVBQUUsRUFBRTtZQUNsQixPQUFPLE9BQU8sQ0FBQztTQUNoQjtRQXlCRCxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsS0FBSyxDQUFDLENBQUM7WUFDakMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUztZQUN0QixDQUFDLENBQUMsaUJBQWlCLENBQUM7UUFDdEIsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRXBCLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxhQUFhLEVBQUUsQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDaEQsSUFBSSxDQUFDLENBQUMsRUFBRTtZQUNOLE1BQU0sS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1NBQzdCO1FBRUQsTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbEUsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ2QsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRTtZQUNwQixJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7WUFDbkMsSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFO2dCQUNyQixJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsRUFBRSxDQUFDLENBQUM7YUFDbkM7U0FDRjthQUFNO1lBQ0wsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUM3QixJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUU7Z0JBQ3JCLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7YUFDbkQ7U0FDRjtRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQU1ELFNBQVMsQ0FBQyxDQUFTO1FBQ2pCLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEtBQUssQ0FBQyxDQUFDLEVBQUU7WUFDL0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7U0FDdkM7UUFDRCxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckIsQ0FBQztJQU9ELE1BQU0sQ0FBQyxHQUFvQixFQUFFLEtBQUssR0FBRyxLQUFLO1FBRXhDLFFBQVEsT0FBTyxHQUFHLEVBQUU7WUFDbEIsS0FBSyxRQUFRO2dCQUNYLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFhLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ2xELEtBQUssUUFBUSxDQUFDLENBQUM7Z0JBQ2IsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUM7Z0JBQ25ELElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQzVCLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDO2dCQUNsQyxNQUFNLEdBQUcsR0FBRyxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDO2dCQUM3RCxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEtBQUssR0FBRyxFQUFFLEVBQUUsQ0FBQyxFQUFFO29CQUM5QixJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUU7d0JBQy9CLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO3FCQUM1QjtvQkFJRCxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDO29CQUNsRCxHQUFHLElBQUksQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztpQkFDckM7Z0JBQ0QsSUFBSSxLQUFLLEVBQUU7b0JBQ1QsR0FBRyxHQUFHLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQztpQkFDekI7Z0JBQ0QsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2FBQ3RCO1lBQ0Q7Z0JBQ0UsTUFBTSxJQUFJLEtBQUssQ0FDYiwwREFBMEQsQ0FDM0QsQ0FBQztTQUNMO0lBQ0gsQ0FBQztJQU1ELElBQUksQ0FBQyxHQUE0QjtRQUMvQixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFO1lBQ3BCLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxLQUFLLENBQUMsQ0FBQztnQkFDekMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFO2dCQUNqQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ1AsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUM7U0FDN0M7YUFBTTtZQUNMLE1BQU0sQ0FBQyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDO1lBQy9CLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQ2hFO0lBQ0gsQ0FBQztJQU1ELElBQUksQ0FBQyxHQUFZO1FBQ2YsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzdCLENBQUM7Q0FDRjtBQVNELE1BQU0sVUFBVSxPQUFPLENBQUMsTUFBYyxFQUFFLEdBQUcsSUFBZTtJQUN4RCxNQUFNLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUMzQyxPQUFPLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQztBQUMzQixDQUFDO0FBUUQsTUFBTSxVQUFVLE1BQU0sQ0FBQyxNQUFjLEVBQUUsR0FBRyxJQUFlO0lBQ3ZELE1BQU0sQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUNuQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLFdBQVcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgMjAxOC0yMDIyIHRoZSBEZW5vIGF1dGhvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuLyoqXG4gKiBUaGlzIGltcGxlbWVudGF0aW9uIGlzIGluc3BpcmVkIGJ5IFBPU0lYIGFuZCBHb2xhbmcgYnV0IGRvZXMgbm90IHBvcnRcbiAqIGltcGxlbWVudGF0aW9uIGNvZGUuICovXG5cbmVudW0gU3RhdGUge1xuICBQQVNTVEhST1VHSCxcbiAgUEVSQ0VOVCxcbiAgUE9TSVRJT05BTCxcbiAgUFJFQ0lTSU9OLFxuICBXSURUSCxcbn1cblxuZW51bSBXb3JQIHtcbiAgV0lEVEgsXG4gIFBSRUNJU0lPTixcbn1cblxuY2xhc3MgRmxhZ3Mge1xuICBwbHVzPzogYm9vbGVhbjtcbiAgZGFzaD86IGJvb2xlYW47XG4gIHNoYXJwPzogYm9vbGVhbjtcbiAgc3BhY2U/OiBib29sZWFuO1xuICB6ZXJvPzogYm9vbGVhbjtcbiAgbGVzc3RoYW4/OiBib29sZWFuO1xuICB3aWR0aCA9IC0xO1xuICBwcmVjaXNpb24gPSAtMTtcbn1cblxuY29uc3QgbWluID0gTWF0aC5taW47XG5jb25zdCBVTklDT0RFX1JFUExBQ0VNRU5UX0NIQVJBQ1RFUiA9IFwiXFx1ZmZmZFwiO1xuY29uc3QgREVGQVVMVF9QUkVDSVNJT04gPSA2O1xuY29uc3QgRkxPQVRfUkVHRVhQID0gLygtPykoXFxkKVxcLj8oXFxkKillKFsrLV0pKFxcZCspLztcblxuZW51bSBGIHtcbiAgc2lnbiA9IDEsXG4gIG1hbnRpc3NhLFxuICBmcmFjdGlvbmFsLFxuICBlc2lnbixcbiAgZXhwb25lbnQsXG59XG5cbmNsYXNzIFByaW50ZiB7XG4gIGZvcm1hdDogc3RyaW5nO1xuICBhcmdzOiB1bmtub3duW107XG4gIGk6IG51bWJlcjtcblxuICBzdGF0ZTogU3RhdGUgPSBTdGF0ZS5QQVNTVEhST1VHSDtcbiAgdmVyYiA9IFwiXCI7XG4gIGJ1ZiA9IFwiXCI7XG4gIGFyZ051bSA9IDA7XG4gIGZsYWdzOiBGbGFncyA9IG5ldyBGbGFncygpO1xuXG4gIGhhdmVTZWVuOiBib29sZWFuW107XG5cbiAgLy8gYmFyZiwgc3RvcmUgcHJlY2lzaW9uIGFuZCB3aWR0aCBlcnJvcnMgZm9yIGxhdGVyIHByb2Nlc3NpbmcgLi4uXG4gIHRtcEVycm9yPzogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKGZvcm1hdDogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pIHtcbiAgICB0aGlzLmZvcm1hdCA9IGZvcm1hdDtcbiAgICB0aGlzLmFyZ3MgPSBhcmdzO1xuICAgIHRoaXMuaGF2ZVNlZW4gPSBBcnJheS5mcm9tKHsgbGVuZ3RoOiBhcmdzLmxlbmd0aCB9KTtcbiAgICB0aGlzLmkgPSAwO1xuICB9XG5cbiAgZG9QcmludGYoKTogc3RyaW5nIHtcbiAgICBmb3IgKDsgdGhpcy5pIDwgdGhpcy5mb3JtYXQubGVuZ3RoOyArK3RoaXMuaSkge1xuICAgICAgY29uc3QgYyA9IHRoaXMuZm9ybWF0W3RoaXMuaV07XG4gICAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgICAgY2FzZSBTdGF0ZS5QQVNTVEhST1VHSDpcbiAgICAgICAgICBpZiAoYyA9PT0gXCIlXCIpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QRVJDRU5UO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZiArPSBjO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBTdGF0ZS5QRVJDRU5UOlxuICAgICAgICAgIGlmIChjID09PSBcIiVcIikge1xuICAgICAgICAgICAgdGhpcy5idWYgKz0gYztcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVNTVEhST1VHSDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVGb3JtYXQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgRXJyb3IoXCJTaG91bGQgYmUgdW5yZWFjaGFibGUsIGNlcnRhaW5seSBhIGJ1ZyBpbiB0aGUgbGliLlwiKTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gY2hlY2sgZm9yIHVuaGFuZGxlZCBhcmdzXG4gICAgbGV0IGV4dHJhcyA9IGZhbHNlO1xuICAgIGxldCBlcnIgPSBcIiUhKEVYVFJBXCI7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgIT09IHRoaXMuaGF2ZVNlZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgIGlmICghdGhpcy5oYXZlU2VlbltpXSkge1xuICAgICAgICBleHRyYXMgPSB0cnVlO1xuICAgICAgICBlcnIgKz0gYCAnJHtEZW5vLmluc3BlY3QodGhpcy5hcmdzW2ldKX0nYDtcbiAgICAgIH1cbiAgICB9XG4gICAgZXJyICs9IFwiKVwiO1xuICAgIGlmIChleHRyYXMpIHtcbiAgICAgIHRoaXMuYnVmICs9IGVycjtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYnVmO1xuICB9XG5cbiAgLy8gJVs8cG9zaXRpb25hbD5dPGZsYWc+Li4uPHZlcmI+XG4gIGhhbmRsZUZvcm1hdCgpOiB2b2lkIHtcbiAgICB0aGlzLmZsYWdzID0gbmV3IEZsYWdzKCk7XG4gICAgY29uc3QgZmxhZ3MgPSB0aGlzLmZsYWdzO1xuICAgIGZvciAoOyB0aGlzLmkgPCB0aGlzLmZvcm1hdC5sZW5ndGg7ICsrdGhpcy5pKSB7XG4gICAgICBjb25zdCBjID0gdGhpcy5mb3JtYXRbdGhpcy5pXTtcbiAgICAgIHN3aXRjaCAodGhpcy5zdGF0ZSkge1xuICAgICAgICBjYXNlIFN0YXRlLlBFUkNFTlQ6XG4gICAgICAgICAgc3dpdGNoIChjKSB7XG4gICAgICAgICAgICBjYXNlIFwiW1wiOlxuICAgICAgICAgICAgICB0aGlzLmhhbmRsZVBvc2l0aW9uYWwoKTtcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBPU0lUSU9OQUw7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIitcIjpcbiAgICAgICAgICAgICAgZmxhZ3MucGx1cyA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIjxcIjpcbiAgICAgICAgICAgICAgZmxhZ3MubGVzc3RoYW4gPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCItXCI6XG4gICAgICAgICAgICAgIGZsYWdzLmRhc2ggPSB0cnVlO1xuICAgICAgICAgICAgICBmbGFncy56ZXJvID0gZmFsc2U7IC8vIG9ubHkgbGVmdCBwYWQgemVyb3MsIGRhc2ggdGFrZXMgcHJlY2VkZW5jZVxuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCIjXCI6XG4gICAgICAgICAgICAgIGZsYWdzLnNoYXJwID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiIFwiOlxuICAgICAgICAgICAgICBmbGFncy5zcGFjZSA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcIjBcIjpcbiAgICAgICAgICAgICAgLy8gb25seSBsZWZ0IHBhZCB6ZXJvcywgZGFzaCB0YWtlcyBwcmVjZWRlbmNlXG4gICAgICAgICAgICAgIGZsYWdzLnplcm8gPSAhZmxhZ3MuZGFzaDtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICBpZiAoKFwiMVwiIDw9IGMgJiYgYyA8PSBcIjlcIikgfHwgYyA9PT0gXCIuXCIgfHwgYyA9PT0gXCIqXCIpIHtcbiAgICAgICAgICAgICAgICBpZiAoYyA9PT0gXCIuXCIpIHtcbiAgICAgICAgICAgICAgICAgIHRoaXMuZmxhZ3MucHJlY2lzaW9uID0gMDtcbiAgICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QUkVDSVNJT047XG4gICAgICAgICAgICAgICAgICB0aGlzLmkrKztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLldJRFRIO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZVdpZHRoQW5kUHJlY2lzaW9uKGZsYWdzKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZVZlcmIoKTtcbiAgICAgICAgICAgICAgICByZXR1cm47IC8vIGFsd2F5cyBlbmQgaW4gdmVyYlxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgfSAvLyBzd2l0Y2ggY1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFN0YXRlLlBPU0lUSU9OQUw6XG4gICAgICAgICAgLy8gVE9ETyhiYXJ0bG9taWVqdSk6IGVpdGhlciBhIHZlcmIgb3IgKiBvbmx5IHZlcmIgZm9yIG5vd1xuICAgICAgICAgIGlmIChjID09PSBcIipcIikge1xuICAgICAgICAgICAgY29uc3Qgd29ycCA9IHRoaXMuZmxhZ3MucHJlY2lzaW9uID09PSAtMVxuICAgICAgICAgICAgICA/IFdvclAuV0lEVEhcbiAgICAgICAgICAgICAgOiBXb3JQLlBSRUNJU0lPTjtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlV2lkdGhPclByZWNpc2lvblJlZih3b3JwKTtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QRVJDRU5UO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlVmVyYigpO1xuICAgICAgICAgICAgcmV0dXJuOyAvLyBhbHdheXMgZW5kIGluIHZlcmJcbiAgICAgICAgICB9XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBTaG91bGQgbm90IGJlIGhlcmUgJHt0aGlzLnN0YXRlfSwgbGlicmFyeSBidWchYCk7XG4gICAgICB9IC8vIHN3aXRjaCBzdGF0ZVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgd2lkdGggb3IgcHJlY2lzaW9uXG4gICAqIEBwYXJhbSB3T3JQXG4gICAqL1xuICBoYW5kbGVXaWR0aE9yUHJlY2lzaW9uUmVmKHdPclA6IFdvclApOiB2b2lkIHtcbiAgICBpZiAodGhpcy5hcmdOdW0gPj0gdGhpcy5hcmdzLmxlbmd0aCkge1xuICAgICAgLy8gaGFuZGxlIFBvc2l0aW9uYWwgc2hvdWxkIGhhdmUgYWxyZWFkeSB0YWtlbiBjYXJlIG9mIGl0Li4uXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGFyZyA9IHRoaXMuYXJnc1t0aGlzLmFyZ051bV07XG4gICAgdGhpcy5oYXZlU2Vlblt0aGlzLmFyZ051bV0gPSB0cnVlO1xuICAgIGlmICh0eXBlb2YgYXJnID09PSBcIm51bWJlclwiKSB7XG4gICAgICBzd2l0Y2ggKHdPclApIHtcbiAgICAgICAgY2FzZSBXb3JQLldJRFRIOlxuICAgICAgICAgIHRoaXMuZmxhZ3Mud2lkdGggPSBhcmc7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhpcy5mbGFncy5wcmVjaXNpb24gPSBhcmc7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRtcCA9IHdPclAgPT09IFdvclAuV0lEVEggPyBcIldJRFRIXCIgOiBcIlBSRUNcIjtcbiAgICAgIHRoaXMudG1wRXJyb3IgPSBgJSEoQkFEICR7dG1wfSAnJHt0aGlzLmFyZ3NbdGhpcy5hcmdOdW1dfScpYDtcbiAgICB9XG4gICAgdGhpcy5hcmdOdW0rKztcbiAgfVxuXG4gIC8qKlxuICAgKiBIYW5kbGUgd2lkdGggYW5kIHByZWNpc2lvblxuICAgKiBAcGFyYW0gZmxhZ3NcbiAgICovXG4gIGhhbmRsZVdpZHRoQW5kUHJlY2lzaW9uKGZsYWdzOiBGbGFncyk6IHZvaWQge1xuICAgIGNvbnN0IGZtdCA9IHRoaXMuZm9ybWF0O1xuICAgIGZvciAoOyB0aGlzLmkgIT09IHRoaXMuZm9ybWF0Lmxlbmd0aDsgKyt0aGlzLmkpIHtcbiAgICAgIGNvbnN0IGMgPSBmbXRbdGhpcy5pXTtcbiAgICAgIHN3aXRjaCAodGhpcy5zdGF0ZSkge1xuICAgICAgICBjYXNlIFN0YXRlLldJRFRIOlxuICAgICAgICAgIHN3aXRjaCAoYykge1xuICAgICAgICAgICAgY2FzZSBcIi5cIjpcbiAgICAgICAgICAgICAgLy8gaW5pdGlhbGl6ZSBwcmVjaXNpb24sICU5LmYgLT4gcHJlY2lzaW9uPTBcbiAgICAgICAgICAgICAgdGhpcy5mbGFncy5wcmVjaXNpb24gPSAwO1xuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUFJFQ0lTSU9OO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCIqXCI6XG4gICAgICAgICAgICAgIHRoaXMuaGFuZGxlV2lkdGhPclByZWNpc2lvblJlZihXb3JQLldJRFRIKTtcbiAgICAgICAgICAgICAgLy8gZm9yY2UgLiBvciBmbGFnIGF0IHRoaXMgcG9pbnRcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OiB7XG4gICAgICAgICAgICAgIGNvbnN0IHZhbCA9IHBhcnNlSW50KGMpO1xuICAgICAgICAgICAgICAvLyBtb3N0IGxpa2VseSBwYXJzZUludCBkb2VzIHNvbWV0aGluZyBzdHVwaWQgdGhhdCBtYWtlc1xuICAgICAgICAgICAgICAvLyBpdCB1bnVzYWJsZSBmb3IgdGhpcyBzY2VuYXJpbyAuLi5cbiAgICAgICAgICAgICAgLy8gaWYgd2UgZW5jb3VudGVyIGEgbm9uIChudW1iZXJ8KnwuKSB3ZSdyZSBkb25lIHdpdGggcHJlYyAmIHdpZFxuICAgICAgICAgICAgICBpZiAoaXNOYU4odmFsKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuaS0tO1xuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QRVJDRU5UO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmbGFncy53aWR0aCA9IGZsYWdzLndpZHRoID09IC0xID8gMCA6IGZsYWdzLndpZHRoO1xuICAgICAgICAgICAgICBmbGFncy53aWR0aCAqPSAxMDtcbiAgICAgICAgICAgICAgZmxhZ3Mud2lkdGggKz0gdmFsO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gLy8gc3dpdGNoIGNcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBTdGF0ZS5QUkVDSVNJT046IHtcbiAgICAgICAgICBpZiAoYyA9PT0gXCIqXCIpIHtcbiAgICAgICAgICAgIHRoaXMuaGFuZGxlV2lkdGhPclByZWNpc2lvblJlZihXb3JQLlBSRUNJU0lPTik7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgdmFsID0gcGFyc2VJbnQoYyk7XG4gICAgICAgICAgaWYgKGlzTmFOKHZhbCkpIHtcbiAgICAgICAgICAgIC8vIG9uZSB0b28gZmFyLCByZXdpbmRcbiAgICAgICAgICAgIHRoaXMuaS0tO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBFUkNFTlQ7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIGZsYWdzLnByZWNpc2lvbiAqPSAxMDtcbiAgICAgICAgICBmbGFncy5wcmVjaXNpb24gKz0gdmFsO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiY2FuJ3QgYmUgaGVyZS4gYnVnLlwiKTtcbiAgICAgIH0gLy8gc3dpdGNoIHN0YXRlXG4gICAgfVxuICB9XG5cbiAgLyoqIEhhbmRsZSBwb3NpdGlvbmFsICovXG4gIGhhbmRsZVBvc2l0aW9uYWwoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZm9ybWF0W3RoaXMuaV0gIT09IFwiW1wiKSB7XG4gICAgICAvLyBzYW5pdHkgb25seVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgaGFwcGVuPyBCdWcuXCIpO1xuICAgIH1cbiAgICBsZXQgcG9zaXRpb25hbCA9IDA7XG4gICAgY29uc3QgZm9ybWF0ID0gdGhpcy5mb3JtYXQ7XG4gICAgdGhpcy5pKys7XG4gICAgbGV0IGVyciA9IGZhbHNlO1xuICAgIGZvciAoOyB0aGlzLmkgIT09IHRoaXMuZm9ybWF0Lmxlbmd0aDsgKyt0aGlzLmkpIHtcbiAgICAgIGlmIChmb3JtYXRbdGhpcy5pXSA9PT0gXCJdXCIpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBwb3NpdGlvbmFsICo9IDEwO1xuICAgICAgY29uc3QgdmFsID0gcGFyc2VJbnQoZm9ybWF0W3RoaXMuaV0pO1xuICAgICAgaWYgKGlzTmFOKHZhbCkpIHtcbiAgICAgICAgLy90aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIC8vICBgaW52YWxpZCBjaGFyYWN0ZXIgaW4gcG9zaXRpb25hbDogJHtmb3JtYXR9WyR7Zm9ybWF0W3RoaXMuaV19XWBcbiAgICAgICAgLy8pO1xuICAgICAgICB0aGlzLnRtcEVycm9yID0gXCIlIShCQUQgSU5ERVgpXCI7XG4gICAgICAgIGVyciA9IHRydWU7XG4gICAgICB9XG4gICAgICBwb3NpdGlvbmFsICs9IHZhbDtcbiAgICB9XG4gICAgaWYgKHBvc2l0aW9uYWwgLSAxID49IHRoaXMuYXJncy5sZW5ndGgpIHtcbiAgICAgIHRoaXMudG1wRXJyb3IgPSBcIiUhKEJBRCBJTkRFWClcIjtcbiAgICAgIGVyciA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMuYXJnTnVtID0gZXJyID8gdGhpcy5hcmdOdW0gOiBwb3NpdGlvbmFsIC0gMTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvKiogSGFuZGxlIGxlc3MgdGhhbiAqL1xuICBoYW5kbGVMZXNzVGhhbigpOiBzdHJpbmcge1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3QgYXJnID0gdGhpcy5hcmdzW3RoaXMuYXJnTnVtXSBhcyBhbnk7XG4gICAgaWYgKChhcmcgfHwge30pLmNvbnN0cnVjdG9yLm5hbWUgIT09IFwiQXJyYXlcIikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBhcmcgJHthcmd9IGlzIG5vdCBhbiBhcnJheS4gVG9kbyBiZXR0ZXIgZXJyb3IgaGFuZGxpbmdgKTtcbiAgICB9XG4gICAgbGV0IHN0ciA9IFwiWyBcIjtcbiAgICBmb3IgKGxldCBpID0gMDsgaSAhPT0gYXJnLmxlbmd0aDsgKytpKSB7XG4gICAgICBpZiAoaSAhPT0gMCkgc3RyICs9IFwiLCBcIjtcbiAgICAgIHN0ciArPSB0aGlzLl9oYW5kbGVWZXJiKGFyZ1tpXSk7XG4gICAgfVxuICAgIHJldHVybiBzdHIgKyBcIiBdXCI7XG4gIH1cblxuICAvKiogSGFuZGxlIHZlcmIgKi9cbiAgaGFuZGxlVmVyYigpOiB2b2lkIHtcbiAgICBjb25zdCB2ZXJiID0gdGhpcy5mb3JtYXRbdGhpcy5pXTtcbiAgICB0aGlzLnZlcmIgPSB2ZXJiO1xuICAgIGlmICh0aGlzLnRtcEVycm9yKSB7XG4gICAgICB0aGlzLmJ1ZiArPSB0aGlzLnRtcEVycm9yO1xuICAgICAgdGhpcy50bXBFcnJvciA9IHVuZGVmaW5lZDtcbiAgICAgIGlmICh0aGlzLmFyZ051bSA8IHRoaXMuaGF2ZVNlZW4ubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMuaGF2ZVNlZW5bdGhpcy5hcmdOdW1dID0gdHJ1ZTsgLy8ga2VlcCB0cmFjayBvZiB1c2VkIGFyZ3NcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuYXJncy5sZW5ndGggPD0gdGhpcy5hcmdOdW0pIHtcbiAgICAgIHRoaXMuYnVmICs9IGAlIShNSVNTSU5HICcke3ZlcmJ9JylgO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBhcmcgPSB0aGlzLmFyZ3NbdGhpcy5hcmdOdW1dOyAvLyBjaGVjayBvdXQgb2YgcmFuZ2VcbiAgICAgIHRoaXMuaGF2ZVNlZW5bdGhpcy5hcmdOdW1dID0gdHJ1ZTsgLy8ga2VlcCB0cmFjayBvZiB1c2VkIGFyZ3NcbiAgICAgIGlmICh0aGlzLmZsYWdzLmxlc3N0aGFuKSB7XG4gICAgICAgIHRoaXMuYnVmICs9IHRoaXMuaGFuZGxlTGVzc1RoYW4oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYnVmICs9IHRoaXMuX2hhbmRsZVZlcmIoYXJnKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5hcmdOdW0rKzsgLy8gaWYgdGhlcmUgaXMgYSBmdXJ0aGVyIHBvc2l0aW9uYWwsIGl0IHdpbGwgcmVzZXQuXG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBU1NUSFJPVUdIO1xuICB9XG5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgX2hhbmRsZVZlcmIoYXJnOiBhbnkpOiBzdHJpbmcge1xuICAgIHN3aXRjaCAodGhpcy52ZXJiKSB7XG4gICAgICBjYXNlIFwidFwiOlxuICAgICAgICByZXR1cm4gdGhpcy5wYWQoYXJnLnRvU3RyaW5nKCkpO1xuICAgICAgY2FzZSBcImJcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10TnVtYmVyKGFyZyBhcyBudW1iZXIsIDIpO1xuICAgICAgY2FzZSBcImNcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10TnVtYmVyQ29kZVBvaW50KGFyZyBhcyBudW1iZXIpO1xuICAgICAgY2FzZSBcImRcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10TnVtYmVyKGFyZyBhcyBudW1iZXIsIDEwKTtcbiAgICAgIGNhc2UgXCJvXCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdE51bWJlcihhcmcgYXMgbnVtYmVyLCA4KTtcbiAgICAgIGNhc2UgXCJ4XCI6XG4gICAgICAgIHJldHVybiB0aGlzLmZtdEhleChhcmcpO1xuICAgICAgY2FzZSBcIlhcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10SGV4KGFyZywgdHJ1ZSk7XG4gICAgICBjYXNlIFwiZVwiOlxuICAgICAgICByZXR1cm4gdGhpcy5mbXRGbG9hdEUoYXJnIGFzIG51bWJlcik7XG4gICAgICBjYXNlIFwiRVwiOlxuICAgICAgICByZXR1cm4gdGhpcy5mbXRGbG9hdEUoYXJnIGFzIG51bWJlciwgdHJ1ZSk7XG4gICAgICBjYXNlIFwiZlwiOlxuICAgICAgY2FzZSBcIkZcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10RmxvYXRGKGFyZyBhcyBudW1iZXIpO1xuICAgICAgY2FzZSBcImdcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10RmxvYXRHKGFyZyBhcyBudW1iZXIpO1xuICAgICAgY2FzZSBcIkdcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10RmxvYXRHKGFyZyBhcyBudW1iZXIsIHRydWUpO1xuICAgICAgY2FzZSBcInNcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10U3RyaW5nKGFyZyBhcyBzdHJpbmcpO1xuICAgICAgY2FzZSBcIlRcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10U3RyaW5nKHR5cGVvZiBhcmcpO1xuICAgICAgY2FzZSBcInZcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10VihhcmcpO1xuICAgICAgY2FzZSBcImpcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10SihhcmcpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIGAlIShCQUQgVkVSQiAnJHt0aGlzLnZlcmJ9JylgO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBQYWQgYSBzdHJpbmdcbiAgICogQHBhcmFtIHMgdGV4dCB0byBwYWRcbiAgICovXG4gIHBhZChzOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGNvbnN0IHBhZGRpbmcgPSB0aGlzLmZsYWdzLnplcm8gPyBcIjBcIiA6IFwiIFwiO1xuXG4gICAgaWYgKHRoaXMuZmxhZ3MuZGFzaCkge1xuICAgICAgcmV0dXJuIHMucGFkRW5kKHRoaXMuZmxhZ3Mud2lkdGgsIHBhZGRpbmcpO1xuICAgIH1cblxuICAgIHJldHVybiBzLnBhZFN0YXJ0KHRoaXMuZmxhZ3Mud2lkdGgsIHBhZGRpbmcpO1xuICB9XG5cbiAgLyoqXG4gICAqIFBhZCBhIG51bWJlclxuICAgKiBAcGFyYW0gblN0clxuICAgKiBAcGFyYW0gbmVnXG4gICAqL1xuICBwYWROdW0oblN0cjogc3RyaW5nLCBuZWc6IGJvb2xlYW4pOiBzdHJpbmcge1xuICAgIGxldCBzaWduOiBzdHJpbmc7XG4gICAgaWYgKG5lZykge1xuICAgICAgc2lnbiA9IFwiLVwiO1xuICAgIH0gZWxzZSBpZiAodGhpcy5mbGFncy5wbHVzIHx8IHRoaXMuZmxhZ3Muc3BhY2UpIHtcbiAgICAgIHNpZ24gPSB0aGlzLmZsYWdzLnBsdXMgPyBcIitcIiA6IFwiIFwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBzaWduID0gXCJcIjtcbiAgICB9XG4gICAgY29uc3QgemVybyA9IHRoaXMuZmxhZ3MuemVybztcbiAgICBpZiAoIXplcm8pIHtcbiAgICAgIC8vIHNpZ24gY29tZXMgaW4gZnJvbnQgb2YgcGFkZGluZyB3aGVuIHBhZGRpbmcgdy8gemVybyxcbiAgICAgIC8vIGluIGZyb20gb2YgdmFsdWUgaWYgcGFkZGluZyB3aXRoIHNwYWNlcy5cbiAgICAgIG5TdHIgPSBzaWduICsgblN0cjtcbiAgICB9XG5cbiAgICBjb25zdCBwYWQgPSB6ZXJvID8gXCIwXCIgOiBcIiBcIjtcbiAgICBjb25zdCBsZW4gPSB6ZXJvID8gdGhpcy5mbGFncy53aWR0aCAtIHNpZ24ubGVuZ3RoIDogdGhpcy5mbGFncy53aWR0aDtcblxuICAgIGlmICh0aGlzLmZsYWdzLmRhc2gpIHtcbiAgICAgIG5TdHIgPSBuU3RyLnBhZEVuZChsZW4sIHBhZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5TdHIgPSBuU3RyLnBhZFN0YXJ0KGxlbiwgcGFkKTtcbiAgICB9XG5cbiAgICBpZiAoemVybykge1xuICAgICAgLy8gc2VlIGFib3ZlXG4gICAgICBuU3RyID0gc2lnbiArIG5TdHI7XG4gICAgfVxuICAgIHJldHVybiBuU3RyO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBhIG51bWJlclxuICAgKiBAcGFyYW0gblxuICAgKiBAcGFyYW0gcmFkaXhcbiAgICogQHBhcmFtIHVwY2FzZVxuICAgKi9cbiAgZm10TnVtYmVyKG46IG51bWJlciwgcmFkaXg6IG51bWJlciwgdXBjYXNlID0gZmFsc2UpOiBzdHJpbmcge1xuICAgIGxldCBudW0gPSBNYXRoLmFicyhuKS50b1N0cmluZyhyYWRpeCk7XG4gICAgY29uc3QgcHJlYyA9IHRoaXMuZmxhZ3MucHJlY2lzaW9uO1xuICAgIGlmIChwcmVjICE9PSAtMSkge1xuICAgICAgdGhpcy5mbGFncy56ZXJvID0gZmFsc2U7XG4gICAgICBudW0gPSBuID09PSAwICYmIHByZWMgPT09IDAgPyBcIlwiIDogbnVtO1xuICAgICAgd2hpbGUgKG51bS5sZW5ndGggPCBwcmVjKSB7XG4gICAgICAgIG51bSA9IFwiMFwiICsgbnVtO1xuICAgICAgfVxuICAgIH1cbiAgICBsZXQgcHJlZml4ID0gXCJcIjtcbiAgICBpZiAodGhpcy5mbGFncy5zaGFycCkge1xuICAgICAgc3dpdGNoIChyYWRpeCkge1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgcHJlZml4ICs9IFwiMGJcIjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSA4OlxuICAgICAgICAgIC8vIGRvbid0IGFubm90YXRlIG9jdGFsIDAgd2l0aCAwLi4uXG4gICAgICAgICAgcHJlZml4ICs9IG51bS5zdGFydHNXaXRoKFwiMFwiKSA/IFwiXCIgOiBcIjBcIjtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAxNjpcbiAgICAgICAgICBwcmVmaXggKz0gXCIweFwiO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhbm5vdCBoYW5kbGUgYmFzZTogXCIgKyByYWRpeCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGRvbid0IGFkZCBwcmVmaXggaW4gZnJvbnQgb2YgdmFsdWUgdHJ1bmNhdGVkIGJ5IHByZWNpc2lvbj0wLCB2YWw9MFxuICAgIG51bSA9IG51bS5sZW5ndGggPT09IDAgPyBudW0gOiBwcmVmaXggKyBudW07XG4gICAgaWYgKHVwY2FzZSkge1xuICAgICAgbnVtID0gbnVtLnRvVXBwZXJDYXNlKCk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnBhZE51bShudW0sIG4gPCAwKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGb3JtYXQgbnVtYmVyIHdpdGggY29kZSBwb2ludHNcbiAgICogQHBhcmFtIG5cbiAgICovXG4gIGZtdE51bWJlckNvZGVQb2ludChuOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIGxldCBzID0gXCJcIjtcbiAgICB0cnkge1xuICAgICAgcyA9IFN0cmluZy5mcm9tQ29kZVBvaW50KG4pO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcyA9IFVOSUNPREVfUkVQTEFDRU1FTlRfQ0hBUkFDVEVSO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wYWQocyk7XG4gIH1cblxuICAvKipcbiAgICogRm9ybWF0IHNwZWNpYWwgZmxvYXRcbiAgICogQHBhcmFtIG5cbiAgICovXG4gIGZtdEZsb2F0U3BlY2lhbChuOiBudW1iZXIpOiBzdHJpbmcge1xuICAgIC8vIGZvcm1hdHRpbmcgb2YgTmFOIGFuZCBJbmYgYXJlIHBhbnRzLW9uLWhlYWRcbiAgICAvLyBzdHVwaWQgYW5kIG1vcmUgb3IgbGVzcyBhcmJpdHJhcnkuXG5cbiAgICBpZiAoaXNOYU4obikpIHtcbiAgICAgIHRoaXMuZmxhZ3MuemVybyA9IGZhbHNlO1xuICAgICAgcmV0dXJuIHRoaXMucGFkTnVtKFwiTmFOXCIsIGZhbHNlKTtcbiAgICB9XG4gICAgaWYgKG4gPT09IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSkge1xuICAgICAgdGhpcy5mbGFncy56ZXJvID0gZmFsc2U7XG4gICAgICB0aGlzLmZsYWdzLnBsdXMgPSB0cnVlO1xuICAgICAgcmV0dXJuIHRoaXMucGFkTnVtKFwiSW5mXCIsIGZhbHNlKTtcbiAgICB9XG4gICAgaWYgKG4gPT09IE51bWJlci5ORUdBVElWRV9JTkZJTklUWSkge1xuICAgICAgdGhpcy5mbGFncy56ZXJvID0gZmFsc2U7XG4gICAgICByZXR1cm4gdGhpcy5wYWROdW0oXCJJbmZcIiwgdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiBcIlwiO1xuICB9XG5cbiAgLyoqXG4gICAqIFJvdW5kIGZyYWN0aW9uIHRvIHByZWNpc2lvblxuICAgKiBAcGFyYW0gZnJhY3Rpb25hbFxuICAgKiBAcGFyYW0gcHJlY2lzaW9uXG4gICAqIEByZXR1cm5zIHR1cGxlIG9mIGZyYWN0aW9uYWwgYW5kIHJvdW5kXG4gICAqL1xuICByb3VuZEZyYWN0aW9uVG9QcmVjaXNpb24oXG4gICAgZnJhY3Rpb25hbDogc3RyaW5nLFxuICAgIHByZWNpc2lvbjogbnVtYmVyLFxuICApOiBbc3RyaW5nLCBib29sZWFuXSB7XG4gICAgbGV0IHJvdW5kID0gZmFsc2U7XG4gICAgaWYgKGZyYWN0aW9uYWwubGVuZ3RoID4gcHJlY2lzaW9uKSB7XG4gICAgICBmcmFjdGlvbmFsID0gXCIxXCIgKyBmcmFjdGlvbmFsOyAvLyBwcmVwZW5kIGEgMSBpbiBjYXNlIG9mIGxlYWRpbmcgMFxuICAgICAgbGV0IHRtcCA9IHBhcnNlSW50KGZyYWN0aW9uYWwuc3Vic3RyKDAsIHByZWNpc2lvbiArIDIpKSAvIDEwO1xuICAgICAgdG1wID0gTWF0aC5yb3VuZCh0bXApO1xuICAgICAgZnJhY3Rpb25hbCA9IE1hdGguZmxvb3IodG1wKS50b1N0cmluZygpO1xuICAgICAgcm91bmQgPSBmcmFjdGlvbmFsWzBdID09PSBcIjJcIjtcbiAgICAgIGZyYWN0aW9uYWwgPSBmcmFjdGlvbmFsLnN1YnN0cigxKTsgLy8gcmVtb3ZlIGV4dHJhIDFcbiAgICB9IGVsc2Uge1xuICAgICAgd2hpbGUgKGZyYWN0aW9uYWwubGVuZ3RoIDwgcHJlY2lzaW9uKSB7XG4gICAgICAgIGZyYWN0aW9uYWwgKz0gXCIwXCI7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBbZnJhY3Rpb25hbCwgcm91bmRdO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBmbG9hdCBFXG4gICAqIEBwYXJhbSBuXG4gICAqIEBwYXJhbSB1cGNhc2VcbiAgICovXG4gIGZtdEZsb2F0RShuOiBudW1iZXIsIHVwY2FzZSA9IGZhbHNlKTogc3RyaW5nIHtcbiAgICBjb25zdCBzcGVjaWFsID0gdGhpcy5mbXRGbG9hdFNwZWNpYWwobik7XG4gICAgaWYgKHNwZWNpYWwgIT09IFwiXCIpIHtcbiAgICAgIHJldHVybiBzcGVjaWFsO1xuICAgIH1cblxuICAgIGNvbnN0IG0gPSBuLnRvRXhwb25lbnRpYWwoKS5tYXRjaChGTE9BVF9SRUdFWFApO1xuICAgIGlmICghbSkge1xuICAgICAgdGhyb3cgRXJyb3IoXCJjYW4ndCBoYXBwZW4sIGJ1Z1wiKTtcbiAgICB9XG4gICAgbGV0IGZyYWN0aW9uYWwgPSBtW0YuZnJhY3Rpb25hbF07XG4gICAgY29uc3QgcHJlY2lzaW9uID0gdGhpcy5mbGFncy5wcmVjaXNpb24gIT09IC0xXG4gICAgICA/IHRoaXMuZmxhZ3MucHJlY2lzaW9uXG4gICAgICA6IERFRkFVTFRfUFJFQ0lTSU9OO1xuICAgIGxldCByb3VuZGluZyA9IGZhbHNlO1xuICAgIFtmcmFjdGlvbmFsLCByb3VuZGluZ10gPSB0aGlzLnJvdW5kRnJhY3Rpb25Ub1ByZWNpc2lvbihcbiAgICAgIGZyYWN0aW9uYWwsXG4gICAgICBwcmVjaXNpb24sXG4gICAgKTtcblxuICAgIGxldCBlID0gbVtGLmV4cG9uZW50XTtcbiAgICBsZXQgZXNpZ24gPSBtW0YuZXNpZ25dO1xuICAgIC8vIHNjaWVudGlmaWMgbm90YXRpb24gb3V0cHV0IHdpdGggZXhwb25lbnQgcGFkZGVkIHRvIG1pbmxlbiAyXG4gICAgbGV0IG1hbnRpc3NhID0gcGFyc2VJbnQobVtGLm1hbnRpc3NhXSk7XG4gICAgaWYgKHJvdW5kaW5nKSB7XG4gICAgICBtYW50aXNzYSArPSAxO1xuICAgICAgaWYgKDEwIDw9IG1hbnRpc3NhKSB7XG4gICAgICAgIG1hbnRpc3NhID0gMTtcbiAgICAgICAgY29uc3QgciA9IHBhcnNlSW50KGVzaWduICsgZSkgKyAxO1xuICAgICAgICBlID0gci50b1N0cmluZygpO1xuICAgICAgICBlc2lnbiA9IHIgPCAwID8gXCItXCIgOiBcIitcIjtcbiAgICAgIH1cbiAgICB9XG4gICAgZSA9IGUubGVuZ3RoID09IDEgPyBcIjBcIiArIGUgOiBlO1xuICAgIGNvbnN0IHZhbCA9IGAke21hbnRpc3NhfS4ke2ZyYWN0aW9uYWx9JHt1cGNhc2UgPyBcIkVcIiA6IFwiZVwifSR7ZXNpZ259JHtlfWA7XG4gICAgcmV0dXJuIHRoaXMucGFkTnVtKHZhbCwgbiA8IDApO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBmbG9hdCBGXG4gICAqIEBwYXJhbSBuXG4gICAqL1xuICBmbXRGbG9hdEYobjogbnVtYmVyKTogc3RyaW5nIHtcbiAgICBjb25zdCBzcGVjaWFsID0gdGhpcy5mbXRGbG9hdFNwZWNpYWwobik7XG4gICAgaWYgKHNwZWNpYWwgIT09IFwiXCIpIHtcbiAgICAgIHJldHVybiBzcGVjaWFsO1xuICAgIH1cblxuICAgIC8vIHN0dXBpZCBoZWxwZXIgdGhhdCB0dXJucyBhIG51bWJlciBpbnRvIGEgKHBvdGVudGlhbGx5KVxuICAgIC8vIFZFUlkgbG9uZyBzdHJpbmcuXG4gICAgZnVuY3Rpb24gZXhwYW5kTnVtYmVyKG46IG51bWJlcik6IHN0cmluZyB7XG4gICAgICBpZiAoTnVtYmVyLmlzU2FmZUludGVnZXIobikpIHtcbiAgICAgICAgcmV0dXJuIG4udG9TdHJpbmcoKSArIFwiLlwiO1xuICAgICAgfVxuXG4gICAgICBjb25zdCB0ID0gbi50b0V4cG9uZW50aWFsKCkuc3BsaXQoXCJlXCIpO1xuICAgICAgbGV0IG0gPSB0WzBdLnJlcGxhY2UoXCIuXCIsIFwiXCIpO1xuICAgICAgY29uc3QgZSA9IHBhcnNlSW50KHRbMV0pO1xuICAgICAgaWYgKGUgPCAwKSB7XG4gICAgICAgIGxldCBuU3RyID0gXCIwLlwiO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSAhPT0gTWF0aC5hYnMoZSkgLSAxOyArK2kpIHtcbiAgICAgICAgICBuU3RyICs9IFwiMFwiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAoblN0ciArPSBtKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHNwbElkeCA9IGUgKyAxO1xuICAgICAgICB3aGlsZSAobS5sZW5ndGggPCBzcGxJZHgpIHtcbiAgICAgICAgICBtICs9IFwiMFwiO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBtLnN1YnN0cigwLCBzcGxJZHgpICsgXCIuXCIgKyBtLnN1YnN0cihzcGxJZHgpO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBhdm9pZGluZyBzaWduIG1ha2VzIHBhZGRpbmcgZWFzaWVyXG4gICAgY29uc3QgdmFsID0gZXhwYW5kTnVtYmVyKE1hdGguYWJzKG4pKSBhcyBzdHJpbmc7XG4gICAgY29uc3QgYXJyID0gdmFsLnNwbGl0KFwiLlwiKTtcbiAgICBsZXQgZGlnID0gYXJyWzBdO1xuICAgIGxldCBmcmFjdGlvbmFsID0gYXJyWzFdO1xuXG4gICAgY29uc3QgcHJlY2lzaW9uID0gdGhpcy5mbGFncy5wcmVjaXNpb24gIT09IC0xXG4gICAgICA/IHRoaXMuZmxhZ3MucHJlY2lzaW9uXG4gICAgICA6IERFRkFVTFRfUFJFQ0lTSU9OO1xuICAgIGxldCByb3VuZCA9IGZhbHNlO1xuICAgIFtmcmFjdGlvbmFsLCByb3VuZF0gPSB0aGlzLnJvdW5kRnJhY3Rpb25Ub1ByZWNpc2lvbihmcmFjdGlvbmFsLCBwcmVjaXNpb24pO1xuICAgIGlmIChyb3VuZCkge1xuICAgICAgZGlnID0gKHBhcnNlSW50KGRpZykgKyAxKS50b1N0cmluZygpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5wYWROdW0oYCR7ZGlnfS4ke2ZyYWN0aW9uYWx9YCwgbiA8IDApO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBmbG9hdCBHXG4gICAqIEBwYXJhbSBuXG4gICAqIEBwYXJhbSB1cGNhc2VcbiAgICovXG4gIGZtdEZsb2F0RyhuOiBudW1iZXIsIHVwY2FzZSA9IGZhbHNlKTogc3RyaW5nIHtcbiAgICBjb25zdCBzcGVjaWFsID0gdGhpcy5mbXRGbG9hdFNwZWNpYWwobik7XG4gICAgaWYgKHNwZWNpYWwgIT09IFwiXCIpIHtcbiAgICAgIHJldHVybiBzcGVjaWFsO1xuICAgIH1cblxuICAgIC8vIFRoZSBkb3VibGUgYXJndW1lbnQgcmVwcmVzZW50aW5nIGEgZmxvYXRpbmctcG9pbnQgbnVtYmVyIHNoYWxsIGJlXG4gICAgLy8gY29udmVydGVkIGluIHRoZSBzdHlsZSBmIG9yIGUgKG9yIGluIHRoZSBzdHlsZSBGIG9yIEUgaW5cbiAgICAvLyB0aGUgY2FzZSBvZiBhIEcgY29udmVyc2lvbiBzcGVjaWZpZXIpLCBkZXBlbmRpbmcgb24gdGhlXG4gICAgLy8gdmFsdWUgY29udmVydGVkIGFuZCB0aGUgcHJlY2lzaW9uLiBMZXQgUCBlcXVhbCB0aGVcbiAgICAvLyBwcmVjaXNpb24gaWYgbm9uLXplcm8sIDYgaWYgdGhlIHByZWNpc2lvbiBpcyBvbWl0dGVkLCBvciAxXG4gICAgLy8gaWYgdGhlIHByZWNpc2lvbiBpcyB6ZXJvLiBUaGVuLCBpZiBhIGNvbnZlcnNpb24gd2l0aCBzdHlsZSBFIHdvdWxkXG4gICAgLy8gaGF2ZSBhbiBleHBvbmVudCBvZiBYOlxuXG4gICAgLy8gICAgIC0gSWYgUCA+IFg+PS00LCB0aGUgY29udmVyc2lvbiBzaGFsbCBiZSB3aXRoIHN0eWxlIGYgKG9yIEYgKVxuICAgIC8vICAgICBhbmQgcHJlY2lzaW9uIFAgLSggWCsxKS5cblxuICAgIC8vICAgICAtIE90aGVyd2lzZSwgdGhlIGNvbnZlcnNpb24gc2hhbGwgYmUgd2l0aCBzdHlsZSBlIChvciBFIClcbiAgICAvLyAgICAgYW5kIHByZWNpc2lvbiBQIC0xLlxuXG4gICAgLy8gRmluYWxseSwgdW5sZXNzIHRoZSAnIycgZmxhZyBpcyB1c2VkLCBhbnkgdHJhaWxpbmcgemVyb3Mgc2hhbGwgYmVcbiAgICAvLyByZW1vdmVkIGZyb20gdGhlIGZyYWN0aW9uYWwgcG9ydGlvbiBvZiB0aGUgcmVzdWx0IGFuZCB0aGVcbiAgICAvLyBkZWNpbWFsLXBvaW50IGNoYXJhY3RlciBzaGFsbCBiZSByZW1vdmVkIGlmIHRoZXJlIGlzIG5vXG4gICAgLy8gZnJhY3Rpb25hbCBwb3J0aW9uIHJlbWFpbmluZy5cblxuICAgIC8vIEEgZG91YmxlIGFyZ3VtZW50IHJlcHJlc2VudGluZyBhbiBpbmZpbml0eSBvciBOYU4gc2hhbGwgYmVcbiAgICAvLyBjb252ZXJ0ZWQgaW4gdGhlIHN0eWxlIG9mIGFuIGYgb3IgRiBjb252ZXJzaW9uIHNwZWNpZmllci5cbiAgICAvLyBodHRwczovL3B1YnMub3Blbmdyb3VwLm9yZy9vbmxpbmVwdWJzLzk2OTk5MTk3OTkvZnVuY3Rpb25zL2ZwcmludGYuaHRtbFxuXG4gICAgbGV0IFAgPSB0aGlzLmZsYWdzLnByZWNpc2lvbiAhPT0gLTFcbiAgICAgID8gdGhpcy5mbGFncy5wcmVjaXNpb25cbiAgICAgIDogREVGQVVMVF9QUkVDSVNJT047XG4gICAgUCA9IFAgPT09IDAgPyAxIDogUDtcblxuICAgIGNvbnN0IG0gPSBuLnRvRXhwb25lbnRpYWwoKS5tYXRjaChGTE9BVF9SRUdFWFApO1xuICAgIGlmICghbSkge1xuICAgICAgdGhyb3cgRXJyb3IoXCJjYW4ndCBoYXBwZW5cIik7XG4gICAgfVxuXG4gICAgY29uc3QgWCA9IHBhcnNlSW50KG1bRi5leHBvbmVudF0pICogKG1bRi5lc2lnbl0gPT09IFwiLVwiID8gLTEgOiAxKTtcbiAgICBsZXQgblN0ciA9IFwiXCI7XG4gICAgaWYgKFAgPiBYICYmIFggPj0gLTQpIHtcbiAgICAgIHRoaXMuZmxhZ3MucHJlY2lzaW9uID0gUCAtIChYICsgMSk7XG4gICAgICBuU3RyID0gdGhpcy5mbXRGbG9hdEYobik7XG4gICAgICBpZiAoIXRoaXMuZmxhZ3Muc2hhcnApIHtcbiAgICAgICAgblN0ciA9IG5TdHIucmVwbGFjZSgvXFwuPzAqJC8sIFwiXCIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmZsYWdzLnByZWNpc2lvbiA9IFAgLSAxO1xuICAgICAgblN0ciA9IHRoaXMuZm10RmxvYXRFKG4pO1xuICAgICAgaWYgKCF0aGlzLmZsYWdzLnNoYXJwKSB7XG4gICAgICAgIG5TdHIgPSBuU3RyLnJlcGxhY2UoL1xcLj8wKmUvLCB1cGNhc2UgPyBcIkVcIiA6IFwiZVwiKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5TdHI7XG4gIH1cblxuICAvKipcbiAgICogRm9ybWF0IHN0cmluZ1xuICAgKiBAcGFyYW0gc1xuICAgKi9cbiAgZm10U3RyaW5nKHM6IHN0cmluZyk6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuZmxhZ3MucHJlY2lzaW9uICE9PSAtMSkge1xuICAgICAgcyA9IHMuc3Vic3RyKDAsIHRoaXMuZmxhZ3MucHJlY2lzaW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMucGFkKHMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEZvcm1hdCBoZXhcbiAgICogQHBhcmFtIHZhbFxuICAgKiBAcGFyYW0gdXBwZXJcbiAgICovXG4gIGZtdEhleCh2YWw6IHN0cmluZyB8IG51bWJlciwgdXBwZXIgPSBmYWxzZSk6IHN0cmluZyB7XG4gICAgLy8gYWxsb3cgb3RoZXJzIHR5cGVzID9cbiAgICBzd2l0Y2ggKHR5cGVvZiB2YWwpIHtcbiAgICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgICAgcmV0dXJuIHRoaXMuZm10TnVtYmVyKHZhbCBhcyBudW1iZXIsIDE2LCB1cHBlcik7XG4gICAgICBjYXNlIFwic3RyaW5nXCI6IHtcbiAgICAgICAgY29uc3Qgc2hhcnAgPSB0aGlzLmZsYWdzLnNoYXJwICYmIHZhbC5sZW5ndGggIT09IDA7XG4gICAgICAgIGxldCBoZXggPSBzaGFycCA/IFwiMHhcIiA6IFwiXCI7XG4gICAgICAgIGNvbnN0IHByZWMgPSB0aGlzLmZsYWdzLnByZWNpc2lvbjtcbiAgICAgICAgY29uc3QgZW5kID0gcHJlYyAhPT0gLTEgPyBtaW4ocHJlYywgdmFsLmxlbmd0aCkgOiB2YWwubGVuZ3RoO1xuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSAhPT0gZW5kOyArK2kpIHtcbiAgICAgICAgICBpZiAoaSAhPT0gMCAmJiB0aGlzLmZsYWdzLnNwYWNlKSB7XG4gICAgICAgICAgICBoZXggKz0gc2hhcnAgPyBcIiAweFwiIDogXCIgXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFRPRE8oYmFydGxvbWllanUpOiBmb3Igbm93IG9ubHkgdGFraW5nIGludG8gYWNjb3VudCB0aGVcbiAgICAgICAgICAvLyBsb3dlciBoYWxmIG9mIHRoZSBjb2RlUG9pbnQsIGllLiBhcyBpZiBhIHN0cmluZ1xuICAgICAgICAgIC8vIGlzIGEgbGlzdCBvZiA4Yml0IHZhbHVlcyBpbnN0ZWFkIG9mIFVDUzIgcnVuZXNcbiAgICAgICAgICBjb25zdCBjID0gKHZhbC5jaGFyQ29kZUF0KGkpICYgMHhmZikudG9TdHJpbmcoMTYpO1xuICAgICAgICAgIGhleCArPSBjLmxlbmd0aCA9PT0gMSA/IGAwJHtjfWAgOiBjO1xuICAgICAgICB9XG4gICAgICAgIGlmICh1cHBlcikge1xuICAgICAgICAgIGhleCA9IGhleC50b1VwcGVyQ2FzZSgpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLnBhZChoZXgpO1xuICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIFwiY3VycmVudGx5IG9ubHkgbnVtYmVyIGFuZCBzdHJpbmcgYXJlIGltcGxlbWVudGVkIGZvciBoZXhcIixcbiAgICAgICAgKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRm9ybWF0IHZhbHVlXG4gICAqIEBwYXJhbSB2YWxcbiAgICovXG4gIGZtdFYodmFsOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IHN0cmluZyB7XG4gICAgaWYgKHRoaXMuZmxhZ3Muc2hhcnApIHtcbiAgICAgIGNvbnN0IG9wdGlvbnMgPSB0aGlzLmZsYWdzLnByZWNpc2lvbiAhPT0gLTFcbiAgICAgICAgPyB7IGRlcHRoOiB0aGlzLmZsYWdzLnByZWNpc2lvbiB9XG4gICAgICAgIDoge307XG4gICAgICByZXR1cm4gdGhpcy5wYWQoRGVuby5pbnNwZWN0KHZhbCwgb3B0aW9ucykpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBwID0gdGhpcy5mbGFncy5wcmVjaXNpb247XG4gICAgICByZXR1cm4gcCA9PT0gLTEgPyB2YWwudG9TdHJpbmcoKSA6IHZhbC50b1N0cmluZygpLnN1YnN0cigwLCBwKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRm9ybWF0IEpTT05cbiAgICogQHBhcmFtIHZhbFxuICAgKi9cbiAgZm10Sih2YWw6IHVua25vd24pOiBzdHJpbmcge1xuICAgIHJldHVybiBKU09OLnN0cmluZ2lmeSh2YWwpO1xuICB9XG59XG5cbi8qKlxuICogQ29udmVydHMgYW5kIGZvcm1hdCBhIHZhcmlhYmxlIG51bWJlciBvZiBgYXJnc2AgYXMgaXMgc3BlY2lmaWVkIGJ5IGBmb3JtYXRgLlxuICogYHNwcmludGZgIHJldHVybnMgdGhlIGZvcm1hdHRlZCBzdHJpbmcuXG4gKlxuICogQHBhcmFtIGZvcm1hdFxuICogQHBhcmFtIGFyZ3NcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNwcmludGYoZm9ybWF0OiBzdHJpbmcsIC4uLmFyZ3M6IHVua25vd25bXSk6IHN0cmluZyB7XG4gIGNvbnN0IHByaW50ZiA9IG5ldyBQcmludGYoZm9ybWF0LCAuLi5hcmdzKTtcbiAgcmV0dXJuIHByaW50Zi5kb1ByaW50ZigpO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGFuZCBmb3JtYXQgYSB2YXJpYWJsZSBudW1iZXIgb2YgYGFyZ3NgIGFzIGlzIHNwZWNpZmllZCBieSBgZm9ybWF0YC5cbiAqIGBwcmludGZgIHdyaXRlcyB0aGUgZm9ybWF0dGVkIHN0cmluZyB0byBzdGFuZGFyZCBvdXRwdXQuXG4gKiBAcGFyYW0gZm9ybWF0XG4gKiBAcGFyYW0gYXJnc1xuICovXG5leHBvcnQgZnVuY3Rpb24gcHJpbnRmKGZvcm1hdDogc3RyaW5nLCAuLi5hcmdzOiB1bmtub3duW10pOiB2b2lkIHtcbiAgY29uc3QgcyA9IHNwcmludGYoZm9ybWF0LCAuLi5hcmdzKTtcbiAgRGVuby5zdGRvdXQud3JpdGVTeW5jKG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShzKSk7XG59XG4iXX0=