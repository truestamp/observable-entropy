import { assert } from "../_util/assert.ts";
import { BytesList } from "../bytes/bytes_list.ts";
import { concat, copy } from "../bytes/mod.ts";
const MIN_READ = 32 * 1024;
const MAX_SIZE = 2 ** 32 - 2;
export class Buffer {
    #buf;
    #off = 0;
    constructor(ab) {
        this.#buf = ab === undefined ? new Uint8Array(0) : new Uint8Array(ab);
    }
    bytes(options = { copy: true }) {
        if (options.copy === false)
            return this.#buf.subarray(this.#off);
        return this.#buf.slice(this.#off);
    }
    empty() {
        return this.#buf.byteLength <= this.#off;
    }
    get length() {
        return this.#buf.byteLength - this.#off;
    }
    get capacity() {
        return this.#buf.buffer.byteLength;
    }
    truncate(n) {
        if (n === 0) {
            this.reset();
            return;
        }
        if (n < 0 || n > this.length) {
            throw Error("bytes.Buffer: truncation out of range");
        }
        this.#reslice(this.#off + n);
    }
    reset() {
        this.#reslice(0);
        this.#off = 0;
    }
    #tryGrowByReslice(n) {
        const l = this.#buf.byteLength;
        if (n <= this.capacity - l) {
            this.#reslice(l + n);
            return l;
        }
        return -1;
    }
    #reslice(len) {
        assert(len <= this.#buf.buffer.byteLength);
        this.#buf = new Uint8Array(this.#buf.buffer, 0, len);
    }
    readSync(p) {
        if (this.empty()) {
            this.reset();
            if (p.byteLength === 0) {
                return 0;
            }
            return null;
        }
        const nread = copy(this.#buf.subarray(this.#off), p);
        this.#off += nread;
        return nread;
    }
    read(p) {
        const rr = this.readSync(p);
        return Promise.resolve(rr);
    }
    writeSync(p) {
        const m = this.#grow(p.byteLength);
        return copy(p, this.#buf, m);
    }
    write(p) {
        const n = this.writeSync(p);
        return Promise.resolve(n);
    }
    #grow(n) {
        const m = this.length;
        if (m === 0 && this.#off !== 0) {
            this.reset();
        }
        const i = this.#tryGrowByReslice(n);
        if (i >= 0) {
            return i;
        }
        const c = this.capacity;
        if (n <= Math.floor(c / 2) - m) {
            copy(this.#buf.subarray(this.#off), this.#buf);
        }
        else if (c + n > MAX_SIZE) {
            throw new Error("The buffer cannot be grown beyond the maximum size.");
        }
        else {
            const buf = new Uint8Array(Math.min(2 * c + n, MAX_SIZE));
            copy(this.#buf.subarray(this.#off), buf);
            this.#buf = buf;
        }
        this.#off = 0;
        this.#reslice(Math.min(m + n, MAX_SIZE));
        return m;
    }
    grow(n) {
        if (n < 0) {
            throw Error("Buffer.grow: negative count");
        }
        const m = this.#grow(n);
        this.#reslice(m);
    }
    async readFrom(r) {
        let n = 0;
        const tmp = new Uint8Array(MIN_READ);
        while (true) {
            const shouldGrow = this.capacity - this.length < MIN_READ;
            const buf = shouldGrow
                ? tmp
                : new Uint8Array(this.#buf.buffer, this.length);
            const nread = await r.read(buf);
            if (nread === null) {
                return n;
            }
            if (shouldGrow)
                this.writeSync(buf.subarray(0, nread));
            else
                this.#reslice(this.length + nread);
            n += nread;
        }
    }
    readFromSync(r) {
        let n = 0;
        const tmp = new Uint8Array(MIN_READ);
        while (true) {
            const shouldGrow = this.capacity - this.length < MIN_READ;
            const buf = shouldGrow
                ? tmp
                : new Uint8Array(this.#buf.buffer, this.length);
            const nread = r.readSync(buf);
            if (nread === null) {
                return n;
            }
            if (shouldGrow)
                this.writeSync(buf.subarray(0, nread));
            else
                this.#reslice(this.length + nread);
            n += nread;
        }
    }
}
const DEFAULT_BUF_SIZE = 4096;
const MIN_BUF_SIZE = 16;
const MAX_CONSECUTIVE_EMPTY_READS = 100;
const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);
export class BufferFullError extends Error {
    partial;
    name = "BufferFullError";
    constructor(partial) {
        super("Buffer full");
        this.partial = partial;
    }
}
export class PartialReadError extends Error {
    name = "PartialReadError";
    partial;
    constructor() {
        super("Encountered UnexpectedEof, data only partially read");
    }
}
export class BufReader {
    #buf;
    #rd;
    #r = 0;
    #w = 0;
    #eof = false;
    static create(r, size = DEFAULT_BUF_SIZE) {
        return r instanceof BufReader ? r : new BufReader(r, size);
    }
    constructor(rd, size = DEFAULT_BUF_SIZE) {
        if (size < MIN_BUF_SIZE) {
            size = MIN_BUF_SIZE;
        }
        this.#reset(new Uint8Array(size), rd);
    }
    size() {
        return this.#buf.byteLength;
    }
    buffered() {
        return this.#w - this.#r;
    }
    #fill = async () => {
        if (this.#r > 0) {
            this.#buf.copyWithin(0, this.#r, this.#w);
            this.#w -= this.#r;
            this.#r = 0;
        }
        if (this.#w >= this.#buf.byteLength) {
            throw Error("bufio: tried to fill full buffer");
        }
        for (let i = MAX_CONSECUTIVE_EMPTY_READS; i > 0; i--) {
            const rr = await this.#rd.read(this.#buf.subarray(this.#w));
            if (rr === null) {
                this.#eof = true;
                return;
            }
            assert(rr >= 0, "negative read");
            this.#w += rr;
            if (rr > 0) {
                return;
            }
        }
        throw new Error(`No progress after ${MAX_CONSECUTIVE_EMPTY_READS} read() calls`);
    };
    reset(r) {
        this.#reset(this.#buf, r);
    }
    #reset = (buf, rd) => {
        this.#buf = buf;
        this.#rd = rd;
        this.#eof = false;
    };
    async read(p) {
        let rr = p.byteLength;
        if (p.byteLength === 0)
            return rr;
        if (this.#r === this.#w) {
            if (p.byteLength >= this.#buf.byteLength) {
                const rr = await this.#rd.read(p);
                const nread = rr ?? 0;
                assert(nread >= 0, "negative read");
                return rr;
            }
            this.#r = 0;
            this.#w = 0;
            rr = await this.#rd.read(this.#buf);
            if (rr === 0 || rr === null)
                return rr;
            assert(rr >= 0, "negative read");
            this.#w += rr;
        }
        const copied = copy(this.#buf.subarray(this.#r, this.#w), p, 0);
        this.#r += copied;
        return copied;
    }
    async readFull(p) {
        let bytesRead = 0;
        while (bytesRead < p.length) {
            try {
                const rr = await this.read(p.subarray(bytesRead));
                if (rr === null) {
                    if (bytesRead === 0) {
                        return null;
                    }
                    else {
                        throw new PartialReadError();
                    }
                }
                bytesRead += rr;
            }
            catch (err) {
                if (err instanceof PartialReadError) {
                    err.partial = p.subarray(0, bytesRead);
                }
                else if (err instanceof Error) {
                    const e = new PartialReadError();
                    e.partial = p.subarray(0, bytesRead);
                    e.stack = err.stack;
                    e.message = err.message;
                    e.cause = err.cause;
                    throw err;
                }
                throw err;
            }
        }
        return p;
    }
    async readByte() {
        while (this.#r === this.#w) {
            if (this.#eof)
                return null;
            await this.#fill();
        }
        const c = this.#buf[this.#r];
        this.#r++;
        return c;
    }
    async readString(delim) {
        if (delim.length !== 1) {
            throw new Error("Delimiter should be a single character");
        }
        const buffer = await this.readSlice(delim.charCodeAt(0));
        if (buffer === null)
            return null;
        return new TextDecoder().decode(buffer);
    }
    async readLine() {
        let line = null;
        try {
            line = await this.readSlice(LF);
        }
        catch (err) {
            if (err instanceof Deno.errors.BadResource) {
                throw err;
            }
            let partial;
            if (err instanceof PartialReadError) {
                partial = err.partial;
                assert(partial instanceof Uint8Array, "bufio: caught error from `readSlice()` without `partial` property");
            }
            if (!(err instanceof BufferFullError)) {
                throw err;
            }
            partial = err.partial;
            if (!this.#eof && partial &&
                partial.byteLength > 0 &&
                partial[partial.byteLength - 1] === CR) {
                assert(this.#r > 0, "bufio: tried to rewind past start of buffer");
                this.#r--;
                partial = partial.subarray(0, partial.byteLength - 1);
            }
            if (partial) {
                return { line: partial, more: !this.#eof };
            }
        }
        if (line === null) {
            return null;
        }
        if (line.byteLength === 0) {
            return { line, more: false };
        }
        if (line[line.byteLength - 1] == LF) {
            let drop = 1;
            if (line.byteLength > 1 && line[line.byteLength - 2] === CR) {
                drop = 2;
            }
            line = line.subarray(0, line.byteLength - drop);
        }
        return { line, more: false };
    }
    async readSlice(delim) {
        let s = 0;
        let slice;
        while (true) {
            let i = this.#buf.subarray(this.#r + s, this.#w).indexOf(delim);
            if (i >= 0) {
                i += s;
                slice = this.#buf.subarray(this.#r, this.#r + i + 1);
                this.#r += i + 1;
                break;
            }
            if (this.#eof) {
                if (this.#r === this.#w) {
                    return null;
                }
                slice = this.#buf.subarray(this.#r, this.#w);
                this.#r = this.#w;
                break;
            }
            if (this.buffered() >= this.#buf.byteLength) {
                this.#r = this.#w;
                const oldbuf = this.#buf;
                const newbuf = this.#buf.slice(0);
                this.#buf = newbuf;
                throw new BufferFullError(oldbuf);
            }
            s = this.#w - this.#r;
            try {
                await this.#fill();
            }
            catch (err) {
                if (err instanceof PartialReadError) {
                    err.partial = slice;
                }
                else if (err instanceof Error) {
                    const e = new PartialReadError();
                    e.partial = slice;
                    e.stack = err.stack;
                    e.message = err.message;
                    e.cause = err.cause;
                    throw err;
                }
                throw err;
            }
        }
        return slice;
    }
    async peek(n) {
        if (n < 0) {
            throw Error("negative count");
        }
        let avail = this.#w - this.#r;
        while (avail < n && avail < this.#buf.byteLength && !this.#eof) {
            try {
                await this.#fill();
            }
            catch (err) {
                if (err instanceof PartialReadError) {
                    err.partial = this.#buf.subarray(this.#r, this.#w);
                }
                else if (err instanceof Error) {
                    const e = new PartialReadError();
                    e.partial = this.#buf.subarray(this.#r, this.#w);
                    e.stack = err.stack;
                    e.message = err.message;
                    e.cause = err.cause;
                    throw err;
                }
                throw err;
            }
            avail = this.#w - this.#r;
        }
        if (avail === 0 && this.#eof) {
            return null;
        }
        else if (avail < n && this.#eof) {
            return this.#buf.subarray(this.#r, this.#r + avail);
        }
        else if (avail < n) {
            throw new BufferFullError(this.#buf.subarray(this.#r, this.#w));
        }
        return this.#buf.subarray(this.#r, this.#r + n);
    }
}
class AbstractBufBase {
    buf;
    usedBufferBytes = 0;
    err = null;
    constructor(buf) {
        this.buf = buf;
    }
    size() {
        return this.buf.byteLength;
    }
    available() {
        return this.buf.byteLength - this.usedBufferBytes;
    }
    buffered() {
        return this.usedBufferBytes;
    }
}
export class BufWriter extends AbstractBufBase {
    #writer;
    static create(writer, size = DEFAULT_BUF_SIZE) {
        return writer instanceof BufWriter ? writer : new BufWriter(writer, size);
    }
    constructor(writer, size = DEFAULT_BUF_SIZE) {
        super(new Uint8Array(size <= 0 ? DEFAULT_BUF_SIZE : size));
        this.#writer = writer;
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.#writer = w;
    }
    async flush() {
        if (this.err !== null)
            throw this.err;
        if (this.usedBufferBytes === 0)
            return;
        try {
            const p = this.buf.subarray(0, this.usedBufferBytes);
            let nwritten = 0;
            while (nwritten < p.length) {
                nwritten += await this.#writer.write(p.subarray(nwritten));
            }
        }
        catch (e) {
            if (e instanceof Error) {
                this.err = e;
            }
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    async write(data) {
        if (this.err !== null)
            throw this.err;
        if (data.length === 0)
            return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while (data.byteLength > this.available()) {
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = await this.#writer.write(data);
                }
                catch (e) {
                    if (e instanceof Error) {
                        this.err = e;
                    }
                    throw e;
                }
            }
            else {
                numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                await this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
export class BufWriterSync extends AbstractBufBase {
    #writer;
    static create(writer, size = DEFAULT_BUF_SIZE) {
        return writer instanceof BufWriterSync
            ? writer
            : new BufWriterSync(writer, size);
    }
    constructor(writer, size = DEFAULT_BUF_SIZE) {
        super(new Uint8Array(size <= 0 ? DEFAULT_BUF_SIZE : size));
        this.#writer = writer;
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.#writer = w;
    }
    flush() {
        if (this.err !== null)
            throw this.err;
        if (this.usedBufferBytes === 0)
            return;
        try {
            const p = this.buf.subarray(0, this.usedBufferBytes);
            let nwritten = 0;
            while (nwritten < p.length) {
                nwritten += this.#writer.writeSync(p.subarray(nwritten));
            }
        }
        catch (e) {
            if (e instanceof Error) {
                this.err = e;
            }
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    writeSync(data) {
        if (this.err !== null)
            throw this.err;
        if (data.length === 0)
            return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while (data.byteLength > this.available()) {
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = this.#writer.writeSync(data);
                }
                catch (e) {
                    if (e instanceof Error) {
                        this.err = e;
                    }
                    throw e;
                }
            }
            else {
                numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
function createLPS(pat) {
    const lps = new Uint8Array(pat.length);
    lps[0] = 0;
    let prefixEnd = 0;
    let i = 1;
    while (i < lps.length) {
        if (pat[i] == pat[prefixEnd]) {
            prefixEnd++;
            lps[i] = prefixEnd;
            i++;
        }
        else if (prefixEnd === 0) {
            lps[i] = 0;
            i++;
        }
        else {
            prefixEnd = lps[prefixEnd - 1];
        }
    }
    return lps;
}
export async function* readDelim(reader, delim) {
    const delimLen = delim.length;
    const delimLPS = createLPS(delim);
    const chunks = new BytesList();
    const bufSize = Math.max(1024, delimLen + 1);
    let inspectIndex = 0;
    let matchIndex = 0;
    while (true) {
        const inspectArr = new Uint8Array(bufSize);
        const result = await reader.read(inspectArr);
        if (result === null) {
            yield chunks.concat();
            return;
        }
        else if (result < 0) {
            return;
        }
        chunks.add(inspectArr, 0, result);
        let localIndex = 0;
        while (inspectIndex < chunks.size()) {
            if (inspectArr[localIndex] === delim[matchIndex]) {
                inspectIndex++;
                localIndex++;
                matchIndex++;
                if (matchIndex === delimLen) {
                    const matchEnd = inspectIndex - delimLen;
                    const readyBytes = chunks.slice(0, matchEnd);
                    yield readyBytes;
                    chunks.shift(inspectIndex);
                    inspectIndex = 0;
                    matchIndex = 0;
                }
            }
            else {
                if (matchIndex === 0) {
                    inspectIndex++;
                    localIndex++;
                }
                else {
                    matchIndex = delimLPS[matchIndex - 1];
                }
            }
        }
    }
}
export async function* readStringDelim(reader, delim, decoderOpts) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder(decoderOpts?.encoding, decoderOpts);
    for await (const chunk of readDelim(reader, encoder.encode(delim))) {
        yield decoder.decode(chunk);
    }
}
export async function* readLines(reader, decoderOpts) {
    const bufReader = new BufReader(reader);
    let chunks = [];
    const decoder = new TextDecoder(decoderOpts?.encoding, decoderOpts);
    while (true) {
        const res = await bufReader.readLine();
        if (!res) {
            if (chunks.length > 0) {
                yield decoder.decode(concat(...chunks));
            }
            break;
        }
        chunks.push(res.line);
        if (!res.more) {
            yield decoder.decode(concat(...chunks));
            chunks = [];
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVmZmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYnVmZmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxvQkFBb0IsQ0FBQztBQUM1QyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sd0JBQXdCLENBQUM7QUFDbkQsT0FBTyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsTUFBTSxpQkFBaUIsQ0FBQztBQU8vQyxNQUFNLFFBQVEsR0FBRyxFQUFFLEdBQUcsSUFBSSxDQUFDO0FBQzNCLE1BQU0sUUFBUSxHQUFHLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBaUI3QixNQUFNLE9BQU8sTUFBTTtJQUNqQixJQUFJLENBQWE7SUFDakIsSUFBSSxHQUFHLENBQUMsQ0FBQztJQUVULFlBQVksRUFBd0M7UUFDbEQsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDeEUsQ0FBQztJQVdELEtBQUssQ0FBQyxPQUFPLEdBQUcsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFO1FBQzVCLElBQUksT0FBTyxDQUFDLElBQUksS0FBSyxLQUFLO1lBQUUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDakUsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUdELEtBQUs7UUFDSCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUM7SUFDM0MsQ0FBQztJQUdELElBQUksTUFBTTtRQUNSLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFV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QUksU0FBUyxDQUFDLE1BQU0sRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7UUFDbEUsTUFBTSxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQzdCO0FBQ0gsQ0FBQztBQUdELE1BQU0sQ0FBQyxLQUFLLFNBQVMsQ0FBQyxDQUFDLFNBQVMsQ0FDOUIsTUFBYyxFQUNkLFdBSUM7SUFFRCxNQUFNLFNBQVMsR0FBRyxJQUFJLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN4QyxJQUFJLE1BQU0sR0FBaUIsRUFBRSxDQUFDO0lBQzlCLE1BQU0sT0FBTyxHQUFHLElBQUksV0FBVyxDQUFDLFdBQVcsRUFBRSxRQUFRLEVBQUUsV0FBVyxDQUFDLENBQUM7SUFDcEUsT0FBTyxJQUFJLEVBQUU7UUFDWCxNQUFNLEdBQUcsR0FBRyxNQUFNLFNBQVMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUN2QyxJQUFJLENBQUMsR0FBRyxFQUFFO1lBQ1IsSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDckIsTUFBTSxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUM7YUFDekM7WUFDRCxNQUFNO1NBQ1A7UUFDRCxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QixJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRTtZQUNiLE1BQU0sT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ3hDLE1BQU0sR0FBRyxFQUFFLENBQUM7U0FDYjtLQUNGO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vX3V0aWwvYXNzZXJ0LnRzXCI7XG5pbXBvcnQgeyBCeXRlc0xpc3QgfSBmcm9tIFwiLi4vYnl0ZXMvYnl0ZXNfbGlzdC50c1wiO1xuaW1wb3J0IHsgY29uY2F0LCBjb3B5IH0gZnJvbSBcIi4uL2J5dGVzL21vZC50c1wiO1xuaW1wb3J0IHR5cGUgeyBSZWFkZXIsIFJlYWRlclN5bmMsIFdyaXRlciwgV3JpdGVyU3luYyB9IGZyb20gXCIuL3R5cGVzLmQudHNcIjtcblxuLy8gTUlOX1JFQUQgaXMgdGhlIG1pbmltdW0gQXJyYXlCdWZmZXIgc2l6ZSBwYXNzZWQgdG8gYSByZWFkIGNhbGwgYnlcbi8vIGJ1ZmZlci5SZWFkRnJvbS4gQXMgbG9uZyBhcyB0aGUgQnVmZmVyIGhhcyBhdCBsZWFzdCBNSU5fUkVBRCBieXRlcyBiZXlvbmRcbi8vIHdoYXQgaXMgcmVxdWlyZWQgdG8gaG9sZCB0aGUgY29udGVudHMgb2YgciwgcmVhZEZyb20oKSB3aWxsIG5vdCBncm93IHRoZVxuLy8gdW5kZXJseWluZyBidWZmZXIuXG5jb25zdCBNSU5fUkVBRCA9IDMyICogMTAyNDtcbmNvbnN0IE1BWF9TSVpFID0gMiAqKiAzMiAtIDI7XG5cbi8qKiBBIHZhcmlhYmxlLXNpemVkIGJ1ZmZlciBvZiBieXRlcyB3aXRoIGByZWFkKClgIGFuZCBgd3JpdGUoKWAgbWV0aG9kcy5cbiAqXG4gKiBCdWZmZXIgaXMgYWxtb3N0IGFsd2F5cyB1c2VkIHdpdGggc29tZSBJL08gbGlrZSBmaWxlcyBhbmQgc29ja2V0cy4gSXQgYWxsb3dzXG4gKiBvbmUgdG8gYnVmZmVyIHVwIGEgZG93bmxvYWQgZnJvbSBhIHNvY2tldC4gQnVmZmVyIGdyb3dzIGFuZCBzaHJpbmtzIGFzXG4gKiBuZWNlc3NhcnkuXG4gKlxuICogQnVmZmVyIGlzIE5PVCB0aGUgc2FtZSB0aGluZyBhcyBOb2RlJ3MgQnVmZmVyLiBOb2RlJ3MgQnVmZmVyIHdhcyBjcmVhdGVkIGluXG4gKiAyMDA5IGJlZm9yZSBKYXZhU2NyaXB0IGhhZCB0aGUgY29uY2VwdCBvZiBBcnJheUJ1ZmZlcnMuIEl0J3Mgc2ltcGx5IGFcbiAqIG5vbi1zdGFuZGFyZCBBcnJheUJ1ZmZlci5cbiAqXG4gKiBBcnJheUJ1ZmZlciBpcyBhIGZpeGVkIG1lbW9yeSBhbGxvY2F0aW9uLiBCdWZmZXIgaXMgaW1wbGVtZW50ZWQgb24gdG9wIG9mXG4gKiBBcnJheUJ1ZmZlci5cbiAqXG4gKiBCYXNlZCBvbiBbR28gQnVmZmVyXShodHRwczovL2dvbGFuZy5vcmcvcGtnL2J5dGVzLyNCdWZmZXIpLiAqL1xuXG5leHBvcnQgY2xhc3MgQnVmZmVyIHtcbiAgI2J1ZjogVWludDhBcnJheTsgLy8gY29udGVudHMgYXJlIHRoZSBieXRlcyBidWZbb2ZmIDogbGVuKGJ1ZildXG4gICNvZmYgPSAwOyAvLyByZWFkIGF0IGJ1ZltvZmZdLCB3cml0ZSBhdCBidWZbYnVmLmJ5dGVMZW5ndGhdXG5cbiAgY29uc3RydWN0b3IoYWI/OiBBcnJheUJ1ZmZlckxpa2UgfCBBcnJheUxpa2U8bnVtYmVyPikge1xuICAgIHRoaXMuI2J1ZiA9IGFiID09PSB1bmRlZmluZWQgPyBuZXcgVWludDhBcnJheSgwKSA6IG5ldyBVaW50OEFycmF5KGFiKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm5zIGEgc2xpY2UgaG9sZGluZyB0aGUgdW5yZWFkIHBvcnRpb24gb2YgdGhlIGJ1ZmZlci5cbiAgICpcbiAgICogVGhlIHNsaWNlIGlzIHZhbGlkIGZvciB1c2Ugb25seSB1bnRpbCB0aGUgbmV4dCBidWZmZXIgbW9kaWZpY2F0aW9uICh0aGF0XG4gICAqIGlzLCBvbmx5IHVudGlsIHRoZSBuZXh0IGNhbGwgdG8gYSBtZXRob2QgbGlrZSBgcmVhZCgpYCwgYHdyaXRlKClgLFxuICAgKiBgcmVzZXQoKWAsIG9yIGB0cnVuY2F0ZSgpYCkuIElmIGBvcHRpb25zLmNvcHlgIGlzIGZhbHNlIHRoZSBzbGljZSBhbGlhc2VzIHRoZSBidWZmZXIgY29udGVudCBhdFxuICAgKiBsZWFzdCB1bnRpbCB0aGUgbmV4dCBidWZmZXIgbW9kaWZpY2F0aW9uLCBzbyBpbW1lZGlhdGUgY2hhbmdlcyB0byB0aGVcbiAgICogc2xpY2Ugd2lsbCBhZmZlY3QgdGhlIHJlc3VsdCBvZiBmdXR1cmUgcmVhZHMuXG4gICAqIEBwYXJhbSBvcHRpb25zIERlZmF1bHRzIHRvIGB7IGNvcHk6IHRydWUgfWBcbiAgICovXG4gIGJ5dGVzKG9wdGlvbnMgPSB7IGNvcHk6IHRydWUgfSk6IFVpbnQ4QXJyYXkge1xuICAgIGlmIChvcHRpb25zLmNvcHkgPT09IGZhbHNlKSByZXR1cm4gdGhpcy4jYnVmLnN1YmFycmF5KHRoaXMuI29mZik7XG4gICAgcmV0dXJuIHRoaXMuI2J1Zi5zbGljZSh0aGlzLiNvZmYpO1xuICB9XG5cbiAgLyoqIFJldHVybnMgd2hldGhlciB0aGUgdW5yZWFkIHBvcnRpb24gb2YgdGhlIGJ1ZmZlciBpcyBlbXB0eS4gKi9cbiAgZW1wdHkoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuI2J1Zi5ieXRlTGVuZ3RoIDw9IHRoaXMuI29mZjtcbiAgfVxuXG4gIC8qKiBBIHJlYWQgb25seSBudW1iZXIgb2YgYnl0ZXMgb2YgdGhlIHVucmVhZCBwb3J0aW9uIG9mIHRoZSBidWZmZXIuICovXG4gIGdldCBsZW5ndGgoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy4jYnVmLmJ5dGVMZW5ndGggLSB0aGlzLiNvZmY7XG4gIH1cblxuICAvKiogVGhlIHJlYWQgb25seSBjYXBhY2l0eSBvZiB0aGUgYnVmZmVyJ3MgdW5kZXJseWluZyBieXRlIHNsaWNlLCB0aGF0IGlzLFxuICAgKiB0aGUgdG90YWwgc3BhY2UgYWxsb2NhdGVkIGZvciB0aGUgYnVmZmVyJ3MgZGF0YS4gKi9cbiAgZ2V0IGNhcGFjaXR5KCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuI2J1Zi5idWZmZXIuYnl0ZUxlbmd0aDtcbiAgfVxuXG4gIC8qKiBEaXNjYXJkcyBhbGwgYnV0IHRoZSBmaXJzdCBgbmAgdW5yZWFkIGJ5dGVzIGZyb20gdGhlIGJ1ZmZlciBidXRcbiAgICogY29udGludWVzIHRvIHVzZSB0aGUgc2FtZSBhbGxvY2F0ZWQgc3RvcmFnZS4gSXQgdGhyb3dzIGlmIGBuYCBpc1xuICAgKiBuZWdhdGl2ZSBvciBncmVhdGVyIHRoYW4gdGhlIGxlbmd0aCBvZiB0aGUgYnVmZmVyLiAqL1xuICB0cnVuY2F0ZShuOiBudW1iZXIpOiB2b2lkIHtcbiAgICBpZiAobiA9PT0gMCkge1xuICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAobiA8IDAgfHwgbiA+IHRoaXMubGVuZ3RoKSB7XG4gICAgICB0aHJvdyBFcnJvcihcImJ5dGVzLkJ1ZmZlcjogdHJ1bmNhdGlvbiBvdXQgb2YgcmFuZ2VcIik7XG4gICAgfVxuICAgIHRoaXMuI3Jlc2xpY2UodGhpcy4jb2ZmICsgbik7XG4gIH1cblxuICByZXNldCgpOiB2b2lkIHtcbiAgICB0aGlzLiNyZXNsaWNlKDApO1xuICAgIHRoaXMuI29mZiA9IDA7XG4gIH1cblxuICAjdHJ5R3Jvd0J5UmVzbGljZShuOiBudW1iZXIpIHtcbiAgICBjb25zdCBsID0gdGhpcy4jYnVmLmJ5dGVMZW5ndGg7XG4gICAgaWYgKG4gPD0gdGhpcy5jYXBhY2l0eSAtIGwpIHtcbiAgICAgIHRoaXMuI3Jlc2xpY2UobCArIG4pO1xuICAgICAgcmV0dXJuIGw7XG4gICAgfVxuICAgIHJldHVybiAtMTtcbiAgfVxuXG4gICNyZXNsaWNlKGxlbjogbnVtYmVyKSB7XG4gICAgYXNzZXJ0KGxlbiA8PSB0aGlzLiNidWYuYnVmZmVyLmJ5dGVMZW5ndGgpO1xuICAgIHRoaXMuI2J1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMuI2J1Zi5idWZmZXIsIDAsIGxlbik7XG4gIH1cblxuICAvKiogUmVhZHMgdGhlIG5leHQgYHAubGVuZ3RoYCBieXRlcyBmcm9tIHRoZSBidWZmZXIgb3IgdW50aWwgdGhlIGJ1ZmZlciBpc1xuICAgKiBkcmFpbmVkLiBSZXR1cm5zIHRoZSBudW1iZXIgb2YgYnl0ZXMgcmVhZC4gSWYgdGhlIGJ1ZmZlciBoYXMgbm8gZGF0YSB0b1xuICAgKiByZXR1cm4sIHRoZSByZXR1cm4gaXMgRU9GIChgbnVsbGApLiAqL1xuICByZWFkU3luYyhwOiBVaW50OEFycmF5KTogbnVtYmVyIHwgbnVsbCB7XG4gICAgaWYgKHRoaXMuZW1wdHkoKSkge1xuICAgICAgLy8gQnVmZmVyIGlzIGVtcHR5LCByZXNldCB0byByZWNvdmVyIHNwYWNlLlxuICAgICAgdGhpcy5yZXNldCgpO1xuICAgICAgaWYgKHAuYnl0ZUxlbmd0aCA9PT0gMCkge1xuICAgICAgICAvLyB0aGlzIGVkZ2UgY2FzZSBpcyB0ZXN0ZWQgaW4gJ2J1ZmZlclJlYWRFbXB0eUF0RU9GJyB0ZXN0XG4gICAgICAgIHJldHVybiAwO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IG5yZWFkID0gY29weSh0aGlzLiNidWYuc3ViYXJyYXkodGhpcy4jb2ZmKSwgcCk7XG4gICAgdGhpcy4jb2ZmICs9IG5yZWFkO1xuICAgIHJldHVybiBucmVhZDtcbiAgfVxuXG4gIC8qKiBSZWFkcyB0aGUgbmV4dCBgcC5sZW5ndGhgIGJ5dGVzIGZyb20gdGhlIGJ1ZmZlciBvciB1bnRpbCB0aGUgYnVmZmVyIGlzXG4gICAqIGRyYWluZWQuIFJlc29sdmVzIHRvIHRoZSBudW1iZXIgb2YgYnl0ZXMgcmVhZC4gSWYgdGhlIGJ1ZmZlciBoYXMgbm9cbiAgICogZGF0YSB0byByZXR1cm4sIHJlc29sdmVzIHRvIEVPRiAoYG51bGxgKS5cbiAgICpcbiAgICogTk9URTogVGhpcyBtZXRob2RzIHJlYWRzIGJ5dGVzIHN5bmNocm9ub3VzbHk7IGl0J3MgcHJvdmlkZWQgZm9yXG4gICAqIGNvbXBhdGliaWxpdHkgd2l0aCBgUmVhZGVyYCBpbnRlcmZhY2VzLlxuICAgKi9cbiAgcmVhZChwOiBVaW50OEFycmF5KTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gICAgY29uc3QgcnIgPSB0aGlzLnJlYWRTeW5jKHApO1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocnIpO1xuICB9XG5cbiAgd3JpdGVTeW5jKHA6IFVpbnQ4QXJyYXkpOiBudW1iZXIge1xuICAgIGNvbnN0IG0gPSB0aGlzLiNncm93KHAuYnl0ZUxlbmd0aCk7XG4gICAgcmV0dXJuIGNvcHkocCwgdGhpcy4jYnVmLCBtKTtcbiAgfVxuXG4gIC8qKiBOT1RFOiBUaGlzIG1ldGhvZHMgd3JpdGVzIGJ5dGVzIHN5bmNocm9ub3VzbHk7IGl0J3MgcHJvdmlkZWQgZm9yXG4gICAqIGNvbXBhdGliaWxpdHkgd2l0aCBgV3JpdGVyYCBpbnRlcmZhY2UuICovXG4gIHdyaXRlKHA6IFVpbnQ4QXJyYXkpOiBQcm9taXNlPG51bWJlcj4ge1xuICAgIGNvbnN0IG4gPSB0aGlzLndyaXRlU3luYyhwKTtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG4pO1xuICB9XG5cbiAgI2dyb3cobjogbnVtYmVyKSB7XG4gICAgY29uc3QgbSA9IHRoaXMubGVuZ3RoO1xuICAgIC8vIElmIGJ1ZmZlciBpcyBlbXB0eSwgcmVzZXQgdG8gcmVjb3ZlciBzcGFjZS5cbiAgICBpZiAobSA9PT0gMCAmJiB0aGlzLiNvZmYgIT09IDApIHtcbiAgICAgIHRoaXMucmVzZXQoKTtcbiAgICB9XG4gICAgLy8gRmFzdDogVHJ5IHRvIGdyb3cgYnkgbWVhbnMgb2YgYSByZXNsaWNlLlxuICAgIGNvbnN0IGkgPSB0aGlzLiN0cnlHcm93QnlSZXNsaWNlKG4pO1xuICAgIGlmIChpID49IDApIHtcbiAgICAgIHJldHVybiBpO1xuICAgIH1cbiAgICBjb25zdCBjID0gdGhpcy5jYXBhY2l0eTtcbiAgICBpZiAobiA8PSBNYXRoLmZsb29yKGMgLyAyKSAtIG0pIHtcbiAgICAgIC8vIFdlIGNhbiBzbGlkZSB0aGluZ3MgZG93biBpbnN0ZWFkIG9mIGFsbG9jYXRpbmcgYSBuZXdcbiAgICAgIC8vIEFycmF5QnVmZmVyLiBXZSBvbmx5IG5lZWQgbStuIDw9IGMgdG8gc2xpZGUsIGJ1dFxuICAgICAgLy8gd2UgaW5zdGVhZCBsZXQgY2FwYWNpdHkgZ2V0IHR3aWNlIGFzIGxhcmdlIHNvIHdlXG4gICAgICAvLyBkb24ndCBzcGVuZCBhbGwgb3VyIHRpbWUgY29weWluZy5cbiAgICAgIGNvcHkodGhpcy4jYnVmLnN1YmFycmF5KHRoaXMuI29mZiksIHRoaXMuI2J1Zik7XG4gICAgfSBlbHNlIGlmIChjICsgbiA+IE1BWF9TSVpFKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJUaGUgYnVmZmVyIGNhbm5vdCBiZSBncm93biBiZXlvbmQgdGhlIG1heGltdW0gc2l6ZS5cIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIE5vdCBlbm91Z2ggc3BhY2UgYW55d2hlcmUsIHdlIG5lZWQgdG8gYWxsb2NhdGUuXG4gICAgICBjb25zdCBidWYgPSBuZXcgVWludDhBcnJheShNYXRoLm1pbigyICogYyArIG4sIE1BWF9TSVpFKSk7XG4gICAgICBjb3B5KHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNvZmYpLCBidWYpO1xuICAgICAgdGhpcy4jYnVmID0gYnVmO1xuICAgIH1cbiAgICAvLyBSZXN0b3JlIHRoaXMuI29mZiBhbmQgbGVuKHRoaXMuI2J1ZikuXG4gICAgdGhpcy4jb2ZmID0gMDtcbiAgICB0aGlzLiNyZXNsaWNlKE1hdGgubWluKG0gKyBuLCBNQVhfU0laRSkpO1xuICAgIHJldHVybiBtO1xuICB9XG5cbiAgLyoqIEdyb3dzIHRoZSBidWZmZXIncyBjYXBhY2l0eSwgaWYgbmVjZXNzYXJ5LCB0byBndWFyYW50ZWUgc3BhY2UgZm9yXG4gICAqIGFub3RoZXIgYG5gIGJ5dGVzLiBBZnRlciBgLmdyb3cobilgLCBhdCBsZWFzdCBgbmAgYnl0ZXMgY2FuIGJlIHdyaXR0ZW4gdG9cbiAgICogdGhlIGJ1ZmZlciB3aXRob3V0IGFub3RoZXIgYWxsb2NhdGlvbi4gSWYgYG5gIGlzIG5lZ2F0aXZlLCBgLmdyb3coKWAgd2lsbFxuICAgKiB0aHJvdy4gSWYgdGhlIGJ1ZmZlciBjYW4ndCBncm93IGl0IHdpbGwgdGhyb3cgYW4gZXJyb3IuXG4gICAqXG4gICAqIEJhc2VkIG9uIEdvIExhbmcnc1xuICAgKiBbQnVmZmVyLkdyb3ddKGh0dHBzOi8vZ29sYW5nLm9yZy9wa2cvYnl0ZXMvI0J1ZmZlci5Hcm93KS4gKi9cbiAgZ3JvdyhuOiBudW1iZXIpOiB2b2lkIHtcbiAgICBpZiAobiA8IDApIHtcbiAgICAgIHRocm93IEVycm9yKFwiQnVmZmVyLmdyb3c6IG5lZ2F0aXZlIGNvdW50XCIpO1xuICAgIH1cbiAgICBjb25zdCBtID0gdGhpcy4jZ3JvdyhuKTtcbiAgICB0aGlzLiNyZXNsaWNlKG0pO1xuICB9XG5cbiAgLyoqIFJlYWRzIGRhdGEgZnJvbSBgcmAgdW50aWwgRU9GIChgbnVsbGApIGFuZCBhcHBlbmRzIGl0IHRvIHRoZSBidWZmZXIsXG4gICAqIGdyb3dpbmcgdGhlIGJ1ZmZlciBhcyBuZWVkZWQuIEl0IHJlc29sdmVzIHRvIHRoZSBudW1iZXIgb2YgYnl0ZXMgcmVhZC5cbiAgICogSWYgdGhlIGJ1ZmZlciBiZWNvbWVzIHRvbyBsYXJnZSwgYC5yZWFkRnJvbSgpYCB3aWxsIHJlamVjdCB3aXRoIGFuIGVycm9yLlxuICAgKlxuICAgKiBCYXNlZCBvbiBHbyBMYW5nJ3NcbiAgICogW0J1ZmZlci5SZWFkRnJvbV0oaHR0cHM6Ly9nb2xhbmcub3JnL3BrZy9ieXRlcy8jQnVmZmVyLlJlYWRGcm9tKS4gKi9cbiAgYXN5bmMgcmVhZEZyb20ocjogUmVhZGVyKTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBsZXQgbiA9IDA7XG4gICAgY29uc3QgdG1wID0gbmV3IFVpbnQ4QXJyYXkoTUlOX1JFQUQpO1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBjb25zdCBzaG91bGRHcm93ID0gdGhpcy5jYXBhY2l0eSAtIHRoaXMubGVuZ3RoIDwgTUlOX1JFQUQ7XG4gICAgICAvLyByZWFkIGludG8gdG1wIGJ1ZmZlciBpZiB0aGVyZSdzIG5vdCBlbm91Z2ggcm9vbVxuICAgICAgLy8gb3RoZXJ3aXNlIHJlYWQgZGlyZWN0bHkgaW50byB0aGUgaW50ZXJuYWwgYnVmZmVyXG4gICAgICBjb25zdCBidWYgPSBzaG91bGRHcm93XG4gICAgICAgID8gdG1wXG4gICAgICAgIDogbmV3IFVpbnQ4QXJyYXkodGhpcy4jYnVmLmJ1ZmZlciwgdGhpcy5sZW5ndGgpO1xuXG4gICAgICBjb25zdCBucmVhZCA9IGF3YWl0IHIucmVhZChidWYpO1xuICAgICAgaWYgKG5yZWFkID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBuO1xuICAgICAgfVxuXG4gICAgICAvLyB3cml0ZSB3aWxsIGdyb3cgaWYgbmVlZGVkXG4gICAgICBpZiAoc2hvdWxkR3JvdykgdGhpcy53cml0ZVN5bmMoYnVmLnN1YmFycmF5KDAsIG5yZWFkKSk7XG4gICAgICBlbHNlIHRoaXMuI3Jlc2xpY2UodGhpcy5sZW5ndGggKyBucmVhZCk7XG5cbiAgICAgIG4gKz0gbnJlYWQ7XG4gICAgfVxuICB9XG5cbiAgLyoqIFJlYWRzIGRhdGEgZnJvbSBgcmAgdW50aWwgRU9GIChgbnVsbGApIGFuZCBhcHBlbmRzIGl0IHRvIHRoZSBidWZmZXIsXG4gICAqIGdyb3dpbmcgdGhlIGJ1ZmZlciBhcyBuZWVkZWQuIEl0IHJldHVybnMgdGhlIG51bWJlciBvZiBieXRlcyByZWFkLiBJZiB0aGVcbiAgICogYnVmZmVyIGJlY29tZXMgdG9vIGxhcmdlLCBgLnJlYWRGcm9tU3luYygpYCB3aWxsIHRocm93IGFuIGVycm9yLlxuICAgKlxuICAgKiBCYXNlZCBvbiBHbyBMYW5nJ3NcbiAgICogW0J1ZmZlci5SZWFkRnJvbV0oaHR0cHM6Ly9nb2xhbmcub3JnL3BrZy9ieXRlcy8jQnVmZmVyLlJlYWRGcm9tKS4gKi9cbiAgcmVhZEZyb21TeW5jKHI6IFJlYWRlclN5bmMpOiBudW1iZXIge1xuICAgIGxldCBuID0gMDtcbiAgICBjb25zdCB0bXAgPSBuZXcgVWludDhBcnJheShNSU5fUkVBRCk7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGNvbnN0IHNob3VsZEdyb3cgPSB0aGlzLmNhcGFjaXR5IC0gdGhpcy5sZW5ndGggPCBNSU5fUkVBRDtcbiAgICAgIC8vIHJlYWQgaW50byB0bXAgYnVmZmVyIGlmIHRoZXJlJ3Mgbm90IGVub3VnaCByb29tXG4gICAgICAvLyBvdGhlcndpc2UgcmVhZCBkaXJlY3RseSBpbnRvIHRoZSBpbnRlcm5hbCBidWZmZXJcbiAgICAgIGNvbnN0IGJ1ZiA9IHNob3VsZEdyb3dcbiAgICAgICAgPyB0bXBcbiAgICAgICAgOiBuZXcgVWludDhBcnJheSh0aGlzLiNidWYuYnVmZmVyLCB0aGlzLmxlbmd0aCk7XG5cbiAgICAgIGNvbnN0IG5yZWFkID0gci5yZWFkU3luYyhidWYpO1xuICAgICAgaWYgKG5yZWFkID09PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBuO1xuICAgICAgfVxuXG4gICAgICAvLyB3cml0ZSB3aWxsIGdyb3cgaWYgbmVlZGVkXG4gICAgICBpZiAoc2hvdWxkR3JvdykgdGhpcy53cml0ZVN5bmMoYnVmLnN1YmFycmF5KDAsIG5yZWFkKSk7XG4gICAgICBlbHNlIHRoaXMuI3Jlc2xpY2UodGhpcy5sZW5ndGggKyBucmVhZCk7XG5cbiAgICAgIG4gKz0gbnJlYWQ7XG4gICAgfVxuICB9XG59XG5cbmNvbnN0IERFRkFVTFRfQlVGX1NJWkUgPSA0MDk2O1xuY29uc3QgTUlOX0JVRl9TSVpFID0gMTY7XG5jb25zdCBNQVhfQ09OU0VDVVRJVkVfRU1QVFlfUkVBRFMgPSAxMDA7XG5jb25zdCBDUiA9IFwiXFxyXCIuY2hhckNvZGVBdCgwKTtcbmNvbnN0IExGID0gXCJcXG5cIi5jaGFyQ29kZUF0KDApO1xuXG5leHBvcnQgY2xhc3MgQnVmZmVyRnVsbEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBvdmVycmlkZSBuYW1lID0gXCJCdWZmZXJGdWxsRXJyb3JcIjtcbiAgY29uc3RydWN0b3IocHVibGljIHBhcnRpYWw6IFVpbnQ4QXJyYXkpIHtcbiAgICBzdXBlcihcIkJ1ZmZlciBmdWxsXCIpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBQYXJ0aWFsUmVhZEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBvdmVycmlkZSBuYW1lID0gXCJQYXJ0aWFsUmVhZEVycm9yXCI7XG4gIHBhcnRpYWw/OiBVaW50OEFycmF5O1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVuY291bnRlcmVkIFVuZXhwZWN0ZWRFb2YsIGRhdGEgb25seSBwYXJ0aWFsbHkgcmVhZFwiKTtcbiAgfVxufVxuXG4vKiogUmVzdWx0IHR5cGUgcmV0dXJuZWQgYnkgb2YgQnVmUmVhZGVyLnJlYWRMaW5lKCkuICovXG5leHBvcnQgaW50ZXJmYWNlIFJlYWRMaW5lUmVzdWx0IHtcbiAgbGluZTogVWludDhBcnJheTtcbiAgbW9yZTogYm9vbGVhbjtcbn1cblxuLyoqIEJ1ZlJlYWRlciBpbXBsZW1lbnRzIGJ1ZmZlcmluZyBmb3IgYSBSZWFkZXIgb2JqZWN0LiAqL1xuZXhwb3J0IGNsYXNzIEJ1ZlJlYWRlciBpbXBsZW1lbnRzIFJlYWRlciB7XG4gICNidWYhOiBVaW50OEFycmF5O1xuICAjcmQhOiBSZWFkZXI7IC8vIFJlYWRlciBwcm92aWRlZCBieSBjYWxsZXIuXG4gICNyID0gMDsgLy8gYnVmIHJlYWQgcG9zaXRpb24uXG4gICN3ID0gMDsgLy8gYnVmIHdyaXRlIHBvc2l0aW9uLlxuICAjZW9mID0gZmFsc2U7XG4gIC8vIHByaXZhdGUgbGFzdEJ5dGU6IG51bWJlcjtcbiAgLy8gcHJpdmF0ZSBsYXN0Q2hhclNpemU6IG51bWJlcjtcblxuICAvKiogcmV0dXJuIG5ldyBCdWZSZWFkZXIgdW5sZXNzIHIgaXMgQnVmUmVhZGVyICovXG4gIHN0YXRpYyBjcmVhdGUocjogUmVhZGVyLCBzaXplOiBudW1iZXIgPSBERUZBVUxUX0JVRl9TSVpFKTogQnVmUmVhZGVyIHtcbiAgICByZXR1cm4gciBpbnN0YW5jZW9mIEJ1ZlJlYWRlciA/IHIgOiBuZXcgQnVmUmVhZGVyKHIsIHNpemUpO1xuICB9XG5cbiAgY29uc3RydWN0b3IocmQ6IFJlYWRlciwgc2l6ZTogbnVtYmVyID0gREVGQVVMVF9CVUZfU0laRSkge1xuICAgIGlmIChzaXplIDwgTUlOX0JVRl9TSVpFKSB7XG4gICAgICBzaXplID0gTUlOX0JVRl9TSVpFO1xuICAgIH1cbiAgICB0aGlzLiNyZXNldChuZXcgVWludDhBcnJheShzaXplKSwgcmQpO1xuICB9XG5cbiAgLyoqIFJldHVybnMgdGhlIHNpemUgb2YgdGhlIHVuZGVybHlpbmcgYnVmZmVyIGluIGJ5dGVzLiAqL1xuICBzaXplKCk6IG51bWJlciB7XG4gICAgcmV0dXJuIHRoaXMuI2J1Zi5ieXRlTGVuZ3RoO1xuICB9XG5cbiAgYnVmZmVyZWQoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy4jdyAtIHRoaXMuI3I7XG4gIH1cblxuICAvLyBSZWFkcyBhIG5ldyBjaHVuayBpbnRvIHRoZSBidWZmZXIuXG4gICNmaWxsID0gYXN5bmMgKCkgPT4ge1xuICAgIC8vIFNsaWRlIGV4aXN0aW5nIGRhdGEgdG8gYmVnaW5uaW5nLlxuICAgIGlmICh0aGlzLiNyID4gMCkge1xuICAgICAgdGhpcy4jYnVmLmNvcHlXaXRoaW4oMCwgdGhpcy4jciwgdGhpcy4jdyk7XG4gICAgICB0aGlzLiN3IC09IHRoaXMuI3I7XG4gICAgICB0aGlzLiNyID0gMDtcbiAgICB9XG5cbiAgICBpZiAodGhpcy4jdyA+PSB0aGlzLiNidWYuYnl0ZUxlbmd0aCkge1xuICAgICAgdGhyb3cgRXJyb3IoXCJidWZpbzogdHJpZWQgdG8gZmlsbCBmdWxsIGJ1ZmZlclwiKTtcbiAgICB9XG5cbiAgICAvLyBSZWFkIG5ldyBkYXRhOiB0cnkgYSBsaW1pdGVkIG51bWJlciBvZiB0aW1lcy5cbiAgICBmb3IgKGxldCBpID0gTUFYX0NPTlNFQ1VUSVZFX0VNUFRZX1JFQURTOyBpID4gMDsgaS0tKSB7XG4gICAgICBjb25zdCByciA9IGF3YWl0IHRoaXMuI3JkLnJlYWQodGhpcy4jYnVmLnN1YmFycmF5KHRoaXMuI3cpKTtcbiAgICAgIGlmIChyciA9PT0gbnVsbCkge1xuICAgICAgICB0aGlzLiNlb2YgPSB0cnVlO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBhc3NlcnQocnIgPj0gMCwgXCJuZWdhdGl2ZSByZWFkXCIpO1xuICAgICAgdGhpcy4jdyArPSBycjtcbiAgICAgIGlmIChyciA+IDApIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgIGBObyBwcm9ncmVzcyBhZnRlciAke01BWF9DT05TRUNVVElWRV9FTVBUWV9SRUFEU30gcmVhZCgpIGNhbGxzYCxcbiAgICApO1xuICB9O1xuXG4gIC8qKiBEaXNjYXJkcyBhbnkgYnVmZmVyZWQgZGF0YSwgcmVzZXRzIGFsbCBzdGF0ZSwgYW5kIHN3aXRjaGVzXG4gICAqIHRoZSBidWZmZXJlZCByZWFkZXIgdG8gcmVhZCBmcm9tIHIuXG4gICAqL1xuICByZXNldChyOiBSZWFkZXIpOiB2b2lkIHtcbiAgICB0aGlzLiNyZXNldCh0aGlzLiNidWYsIHIpO1xuICB9XG5cbiAgI3Jlc2V0ID0gKGJ1ZjogVWludDhBcnJheSwgcmQ6IFJlYWRlcik6IHZvaWQgPT4ge1xuICAgIHRoaXMuI2J1ZiA9IGJ1ZjtcbiAgICB0aGlzLiNyZCA9IHJkO1xuICAgIHRoaXMuI2VvZiA9IGZhbHNlO1xuICAgIC8vIHRoaXMubGFzdEJ5dGUgPSAtMTtcbiAgICAvLyB0aGlzLmxhc3RDaGFyU2l6ZSA9IC0xO1xuICB9O1xuXG4gIC8qKiByZWFkcyBkYXRhIGludG8gcC5cbiAgICogSXQgcmV0dXJucyB0aGUgbnVtYmVyIG9mIGJ5dGVzIHJlYWQgaW50byBwLlxuICAgKiBUaGUgYnl0ZXMgYXJlIHRha2VuIGZyb20gYXQgbW9zdCBvbmUgUmVhZCBvbiB0aGUgdW5kZXJseWluZyBSZWFkZXIsXG4gICAqIGhlbmNlIG4gbWF5IGJlIGxlc3MgdGhhbiBsZW4ocCkuXG4gICAqIFRvIHJlYWQgZXhhY3RseSBsZW4ocCkgYnl0ZXMsIHVzZSBpby5SZWFkRnVsbChiLCBwKS5cbiAgICovXG4gIGFzeW5jIHJlYWQocDogVWludDhBcnJheSk6IFByb21pc2U8bnVtYmVyIHwgbnVsbD4ge1xuICAgIGxldCBycjogbnVtYmVyIHwgbnVsbCA9IHAuYnl0ZUxlbmd0aDtcbiAgICBpZiAocC5ieXRlTGVuZ3RoID09PSAwKSByZXR1cm4gcnI7XG5cbiAgICBpZiAodGhpcy4jciA9PT0gdGhpcy4jdykge1xuICAgICAgaWYgKHAuYnl0ZUxlbmd0aCA+PSB0aGlzLiNidWYuYnl0ZUxlbmd0aCkge1xuICAgICAgICAvLyBMYXJnZSByZWFkLCBlbXB0eSBidWZmZXIuXG4gICAgICAgIC8vIFJlYWQgZGlyZWN0bHkgaW50byBwIHRvIGF2b2lkIGNvcHkuXG4gICAgICAgIGNvbnN0IHJyID0gYXdhaXQgdGhpcy4jcmQucmVhZChwKTtcbiAgICAgICAgY29uc3QgbnJlYWQgPSByciA/PyAwO1xuICAgICAgICBhc3NlcnQobnJlYWQgPj0gMCwgXCJuZWdhdGl2ZSByZWFkXCIpO1xuICAgICAgICAvLyBpZiAocnIubnJlYWQgPiAwKSB7XG4gICAgICAgIC8vICAgdGhpcy5sYXN0Qnl0ZSA9IHBbcnIubnJlYWQgLSAxXTtcbiAgICAgICAgLy8gICB0aGlzLmxhc3RDaGFyU2l6ZSA9IC0xO1xuICAgICAgICAvLyB9XG4gICAgICAgIHJldHVybiBycjtcbiAgICAgIH1cblxuICAgICAgLy8gT25lIHJlYWQuXG4gICAgICAvLyBEbyBub3QgdXNlIHRoaXMuZmlsbCwgd2hpY2ggd2lsbCBsb29wLlxuICAgICAgdGhpcy4jciA9IDA7XG4gICAgICB0aGlzLiN3ID0gMDtcbiAgICAgIHJyID0gYXdhaXQgdGhpcy4jcmQucmVhZCh0aGlzLiNidWYpO1xuICAgICAgaWYgKHJyID09PSAwIHx8IHJyID09PSBudWxsKSByZXR1cm4gcnI7XG4gICAgICBhc3NlcnQocnIgPj0gMCwgXCJuZWdhdGl2ZSByZWFkXCIpO1xuICAgICAgdGhpcy4jdyArPSBycjtcbiAgICB9XG5cbiAgICAvLyBjb3B5IGFzIG11Y2ggYXMgd2UgY2FuXG4gICAgY29uc3QgY29waWVkID0gY29weSh0aGlzLiNidWYuc3ViYXJyYXkodGhpcy4jciwgdGhpcy4jdyksIHAsIDApO1xuICAgIHRoaXMuI3IgKz0gY29waWVkO1xuICAgIC8vIHRoaXMubGFzdEJ5dGUgPSB0aGlzLmJ1Zlt0aGlzLnIgLSAxXTtcbiAgICAvLyB0aGlzLmxhc3RDaGFyU2l6ZSA9IC0xO1xuICAgIHJldHVybiBjb3BpZWQ7XG4gIH1cblxuICAvKiogcmVhZHMgZXhhY3RseSBgcC5sZW5ndGhgIGJ5dGVzIGludG8gYHBgLlxuICAgKlxuICAgKiBJZiBzdWNjZXNzZnVsLCBgcGAgaXMgcmV0dXJuZWQuXG4gICAqXG4gICAqIElmIHRoZSBlbmQgb2YgdGhlIHVuZGVybHlpbmcgc3RyZWFtIGhhcyBiZWVuIHJlYWNoZWQsIGFuZCB0aGVyZSBhcmUgbm8gbW9yZVxuICAgKiBieXRlcyBhdmFpbGFibGUgaW4gdGhlIGJ1ZmZlciwgYHJlYWRGdWxsKClgIHJldHVybnMgYG51bGxgIGluc3RlYWQuXG4gICAqXG4gICAqIEFuIGVycm9yIGlzIHRocm93biBpZiBzb21lIGJ5dGVzIGNvdWxkIGJlIHJlYWQsIGJ1dCBub3QgZW5vdWdoIHRvIGZpbGwgYHBgXG4gICAqIGVudGlyZWx5IGJlZm9yZSB0aGUgdW5kZXJseWluZyBzdHJlYW0gcmVwb3J0ZWQgYW4gZXJyb3Igb3IgRU9GLiBBbnkgZXJyb3JcbiAgICogdGhyb3duIHdpbGwgaGF2ZSBhIGBwYXJ0aWFsYCBwcm9wZXJ0eSB0aGF0IGluZGljYXRlcyB0aGUgc2xpY2Ugb2YgdGhlXG4gICAqIGJ1ZmZlciB0aGF0IGhhcyBiZWVuIHN1Y2Nlc3NmdWxseSBmaWxsZWQgd2l0aCBkYXRhLlxuICAgKlxuICAgKiBQb3J0ZWQgZnJvbSBodHRwczovL2dvbGFuZy5vcmcvcGtnL2lvLyNSZWFkRnVsbFxuICAgKi9cbiAgYXN5bmMgcmVhZEZ1bGwocDogVWludDhBcnJheSk6IFByb21pc2U8VWludDhBcnJheSB8IG51bGw+IHtcbiAgICBsZXQgYnl0ZXNSZWFkID0gMDtcbiAgICB3aGlsZSAoYnl0ZXNSZWFkIDwgcC5sZW5ndGgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHJyID0gYXdhaXQgdGhpcy5yZWFkKHAuc3ViYXJyYXkoYnl0ZXNSZWFkKSk7XG4gICAgICAgIGlmIChyciA9PT0gbnVsbCkge1xuICAgICAgICAgIGlmIChieXRlc1JlYWQgPT09IDApIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUGFydGlhbFJlYWRFcnJvcigpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBieXRlc1JlYWQgKz0gcnI7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFBhcnRpYWxSZWFkRXJyb3IpIHtcbiAgICAgICAgICBlcnIucGFydGlhbCA9IHAuc3ViYXJyYXkoMCwgYnl0ZXNSZWFkKTtcbiAgICAgICAgfSBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICAgIGNvbnN0IGUgPSBuZXcgUGFydGlhbFJlYWRFcnJvcigpO1xuICAgICAgICAgIGUucGFydGlhbCA9IHAuc3ViYXJyYXkoMCwgYnl0ZXNSZWFkKTtcbiAgICAgICAgICBlLnN0YWNrID0gZXJyLnN0YWNrO1xuICAgICAgICAgIGUubWVzc2FnZSA9IGVyci5tZXNzYWdlO1xuICAgICAgICAgIGUuY2F1c2UgPSBlcnIuY2F1c2U7XG4gICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHA7XG4gIH1cblxuICAvKiogUmV0dXJucyB0aGUgbmV4dCBieXRlIFswLCAyNTVdIG9yIGBudWxsYC4gKi9cbiAgYXN5bmMgcmVhZEJ5dGUoKTogUHJvbWlzZTxudW1iZXIgfCBudWxsPiB7XG4gICAgd2hpbGUgKHRoaXMuI3IgPT09IHRoaXMuI3cpIHtcbiAgICAgIGlmICh0aGlzLiNlb2YpIHJldHVybiBudWxsO1xuICAgICAgYXdhaXQgdGhpcy4jZmlsbCgpOyAvLyBidWZmZXIgaXMgZW1wdHkuXG4gICAgfVxuICAgIGNvbnN0IGMgPSB0aGlzLiNidWZbdGhpcy4jcl07XG4gICAgdGhpcy4jcisrO1xuICAgIC8vIHRoaXMubGFzdEJ5dGUgPSBjO1xuICAgIHJldHVybiBjO1xuICB9XG5cbiAgLyoqIHJlYWRTdHJpbmcoKSByZWFkcyB1bnRpbCB0aGUgZmlyc3Qgb2NjdXJyZW5jZSBvZiBkZWxpbSBpbiB0aGUgaW5wdXQsXG4gICAqIHJldHVybmluZyBhIHN0cmluZyBjb250YWluaW5nIHRoZSBkYXRhIHVwIHRvIGFuZCBpbmNsdWRpbmcgdGhlIGRlbGltaXRlci5cbiAgICogSWYgUmVhZFN0cmluZyBlbmNvdW50ZXJzIGFuIGVycm9yIGJlZm9yZSBmaW5kaW5nIGEgZGVsaW1pdGVyLFxuICAgKiBpdCByZXR1cm5zIHRoZSBkYXRhIHJlYWQgYmVmb3JlIHRoZSBlcnJvciBhbmQgdGhlIGVycm9yIGl0c2VsZlxuICAgKiAob2Z0ZW4gYG51bGxgKS5cbiAgICogUmVhZFN0cmluZyByZXR1cm5zIGVyciAhPSBuaWwgaWYgYW5kIG9ubHkgaWYgdGhlIHJldHVybmVkIGRhdGEgZG9lcyBub3QgZW5kXG4gICAqIGluIGRlbGltLlxuICAgKiBGb3Igc2ltcGxlIHVzZXMsIGEgU2Nhbm5lciBtYXkgYmUgbW9yZSBjb252ZW5pZW50LlxuICAgKi9cbiAgYXN5bmMgcmVhZFN0cmluZyhkZWxpbTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG4gICAgaWYgKGRlbGltLmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRGVsaW1pdGVyIHNob3VsZCBiZSBhIHNpbmdsZSBjaGFyYWN0ZXJcIik7XG4gICAgfVxuICAgIGNvbnN0IGJ1ZmZlciA9IGF3YWl0IHRoaXMucmVhZFNsaWNlKGRlbGltLmNoYXJDb2RlQXQoMCkpO1xuICAgIGlmIChidWZmZXIgPT09IG51bGwpIHJldHVybiBudWxsO1xuICAgIHJldHVybiBuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUoYnVmZmVyKTtcbiAgfVxuXG4gIC8qKiBgcmVhZExpbmUoKWAgaXMgYSBsb3ctbGV2ZWwgbGluZS1yZWFkaW5nIHByaW1pdGl2ZS4gTW9zdCBjYWxsZXJzIHNob3VsZFxuICAgKiB1c2UgYHJlYWRTdHJpbmcoJ1xcbicpYCBpbnN0ZWFkIG9yIHVzZSBhIFNjYW5uZXIuXG4gICAqXG4gICAqIGByZWFkTGluZSgpYCB0cmllcyB0byByZXR1cm4gYSBzaW5nbGUgbGluZSwgbm90IGluY2x1ZGluZyB0aGUgZW5kLW9mLWxpbmVcbiAgICogYnl0ZXMuIElmIHRoZSBsaW5lIHdhcyB0b28gbG9uZyBmb3IgdGhlIGJ1ZmZlciB0aGVuIGBtb3JlYCBpcyBzZXQgYW5kIHRoZVxuICAgKiBiZWdpbm5pbmcgb2YgdGhlIGxpbmUgaXMgcmV0dXJuZWQuIFRoZSByZXN0IG9mIHRoZSBsaW5lIHdpbGwgYmUgcmV0dXJuZWRcbiAgICogZnJvbSBmdXR1cmUgY2FsbHMuIGBtb3JlYCB3aWxsIGJlIGZhbHNlIHdoZW4gcmV0dXJuaW5nIHRoZSBsYXN0IGZyYWdtZW50XG4gICAqIG9mIHRoZSBsaW5lLiBUaGUgcmV0dXJuZWQgYnVmZmVyIGlzIG9ubHkgdmFsaWQgdW50aWwgdGhlIG5leHQgY2FsbCB0b1xuICAgKiBgcmVhZExpbmUoKWAuXG4gICAqXG4gICAqIFRoZSB0ZXh0IHJldHVybmVkIGZyb20gUmVhZExpbmUgZG9lcyBub3QgaW5jbHVkZSB0aGUgbGluZSBlbmQgKFwiXFxyXFxuXCIgb3JcbiAgICogXCJcXG5cIikuXG4gICAqXG4gICAqIFdoZW4gdGhlIGVuZCBvZiB0aGUgdW5kZXJseWluZyBzdHJlYW0gaXMgcmVhY2hlZCwgdGhlIGZpbmFsIGJ5dGVzIGluIHRoZVxuICAgKiBzdHJlYW0gYXJlIHJldHVybmVkLiBObyBpbmRpY2F0aW9uIG9yIGVycm9yIGlzIGdpdmVuIGlmIHRoZSBpbnB1dCBlbmRzXG4gICAqIHdpdGhvdXQgYSBmaW5hbCBsaW5lIGVuZC4gV2hlbiB0aGVyZSBhcmUgbm8gbW9yZSB0cmFpbGluZyBieXRlcyB0byByZWFkLFxuICAgKiBgcmVhZExpbmUoKWAgcmV0dXJucyBgbnVsbGAuXG4gICAqXG4gICAqIENhbGxpbmcgYHVucmVhZEJ5dGUoKWAgYWZ0ZXIgYHJlYWRMaW5lKClgIHdpbGwgYWx3YXlzIHVucmVhZCB0aGUgbGFzdCBieXRlXG4gICAqIHJlYWQgKHBvc3NpYmx5IGEgY2hhcmFjdGVyIGJlbG9uZ2luZyB0byB0aGUgbGluZSBlbmQpIGV2ZW4gaWYgdGhhdCBieXRlIGlzXG4gICAqIG5vdCBwYXJ0IG9mIHRoZSBsaW5lIHJldHVybmVkIGJ5IGByZWFkTGluZSgpYC5cbiAgICovXG4gIGFzeW5jIHJlYWRMaW5lKCk6IFByb21pc2U8UmVhZExpbmVSZXN1bHQgfCBudWxsPiB7XG4gICAgbGV0IGxpbmU6IFVpbnQ4QXJyYXkgfCBudWxsID0gbnVsbDtcblxuICAgIHRyeSB7XG4gICAgICBsaW5lID0gYXdhaXQgdGhpcy5yZWFkU2xpY2UoTEYpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIERlbm8uZXJyb3JzLkJhZFJlc291cmNlKSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cbiAgICAgIGxldCBwYXJ0aWFsO1xuICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFBhcnRpYWxSZWFkRXJyb3IpIHtcbiAgICAgICAgcGFydGlhbCA9IGVyci5wYXJ0aWFsO1xuICAgICAgICBhc3NlcnQoXG4gICAgICAgICAgcGFydGlhbCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXksXG4gICAgICAgICAgXCJidWZpbzogY2F1Z2h0IGVycm9yIGZyb20gYHJlYWRTbGljZSgpYCB3aXRob3V0IGBwYXJ0aWFsYCBwcm9wZXJ0eVwiLFxuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICAvLyBEb24ndCB0aHJvdyBpZiBgcmVhZFNsaWNlKClgIGZhaWxlZCB3aXRoIGBCdWZmZXJGdWxsRXJyb3JgLCBpbnN0ZWFkIHdlXG4gICAgICAvLyBqdXN0IHJldHVybiB3aGF0ZXZlciBpcyBhdmFpbGFibGUgYW5kIHNldCB0aGUgYG1vcmVgIGZsYWcuXG4gICAgICBpZiAoIShlcnIgaW5zdGFuY2VvZiBCdWZmZXJGdWxsRXJyb3IpKSB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH1cblxuICAgICAgcGFydGlhbCA9IGVyci5wYXJ0aWFsO1xuXG4gICAgICAvLyBIYW5kbGUgdGhlIGNhc2Ugd2hlcmUgXCJcXHJcXG5cIiBzdHJhZGRsZXMgdGhlIGJ1ZmZlci5cbiAgICAgIGlmIChcbiAgICAgICAgIXRoaXMuI2VvZiAmJiBwYXJ0aWFsICYmXG4gICAgICAgIHBhcnRpYWwuYnl0ZUxlbmd0aCA+IDAgJiZcbiAgICAgICAgcGFydGlhbFtwYXJ0aWFsLmJ5dGVMZW5ndGggLSAxXSA9PT0gQ1JcbiAgICAgICkge1xuICAgICAgICAvLyBQdXQgdGhlICdcXHInIGJhY2sgb24gYnVmIGFuZCBkcm9wIGl0IGZyb20gbGluZS5cbiAgICAgICAgLy8gTGV0IHRoZSBuZXh0IGNhbGwgdG8gUmVhZExpbmUgY2hlY2sgZm9yIFwiXFxyXFxuXCIuXG4gICAgICAgIGFzc2VydCh0aGlzLiNyID4gMCwgXCJidWZpbzogdHJpZWQgdG8gcmV3aW5kIHBhc3Qgc3RhcnQgb2YgYnVmZmVyXCIpO1xuICAgICAgICB0aGlzLiNyLS07XG4gICAgICAgIHBhcnRpYWwgPSBwYXJ0aWFsLnN1YmFycmF5KDAsIHBhcnRpYWwuYnl0ZUxlbmd0aCAtIDEpO1xuICAgICAgfVxuXG4gICAgICBpZiAocGFydGlhbCkge1xuICAgICAgICByZXR1cm4geyBsaW5lOiBwYXJ0aWFsLCBtb3JlOiAhdGhpcy4jZW9mIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGxpbmUgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChsaW5lLmJ5dGVMZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybiB7IGxpbmUsIG1vcmU6IGZhbHNlIH07XG4gICAgfVxuXG4gICAgaWYgKGxpbmVbbGluZS5ieXRlTGVuZ3RoIC0gMV0gPT0gTEYpIHtcbiAgICAgIGxldCBkcm9wID0gMTtcbiAgICAgIGlmIChsaW5lLmJ5dGVMZW5ndGggPiAxICYmIGxpbmVbbGluZS5ieXRlTGVuZ3RoIC0gMl0gPT09IENSKSB7XG4gICAgICAgIGRyb3AgPSAyO1xuICAgICAgfVxuICAgICAgbGluZSA9IGxpbmUuc3ViYXJyYXkoMCwgbGluZS5ieXRlTGVuZ3RoIC0gZHJvcCk7XG4gICAgfVxuICAgIHJldHVybiB7IGxpbmUsIG1vcmU6IGZhbHNlIH07XG4gIH1cblxuICAvKiogYHJlYWRTbGljZSgpYCByZWFkcyB1bnRpbCB0aGUgZmlyc3Qgb2NjdXJyZW5jZSBvZiBgZGVsaW1gIGluIHRoZSBpbnB1dCxcbiAgICogcmV0dXJuaW5nIGEgc2xpY2UgcG9pbnRpbmcgYXQgdGhlIGJ5dGVzIGluIHRoZSBidWZmZXIuIFRoZSBieXRlcyBzdG9wXG4gICAqIGJlaW5nIHZhbGlkIGF0IHRoZSBuZXh0IHJlYWQuXG4gICAqXG4gICAqIElmIGByZWFkU2xpY2UoKWAgZW5jb3VudGVycyBhbiBlcnJvciBiZWZvcmUgZmluZGluZyBhIGRlbGltaXRlciwgb3IgdGhlXG4gICAqIGJ1ZmZlciBmaWxscyB3aXRob3V0IGZpbmRpbmcgYSBkZWxpbWl0ZXIsIGl0IHRocm93cyBhbiBlcnJvciB3aXRoIGFcbiAgICogYHBhcnRpYWxgIHByb3BlcnR5IHRoYXQgY29udGFpbnMgdGhlIGVudGlyZSBidWZmZXIuXG4gICAqXG4gICAqIElmIGByZWFkU2xpY2UoKWAgZW5jb3VudGVycyB0aGUgZW5kIG9mIHRoZSB1bmRlcmx5aW5nIHN0cmVhbSBhbmQgdGhlcmUgYXJlXG4gICAqIGFueSBieXRlcyBsZWZ0IGluIHRoZSBidWZmZXIsIHRoZSByZXN0IG9mIHRoZSBidWZmZXIgaXMgcmV0dXJuZWQuIEluIG90aGVyXG4gICAqIHdvcmRzLCBFT0YgaXMgYWx3YXlzIHRyZWF0ZWQgYXMgYSBkZWxpbWl0ZXIuIE9uY2UgdGhlIGJ1ZmZlciBpcyBlbXB0eSxcbiAgICogaXQgcmV0dXJucyBgbnVsbGAuXG4gICAqXG4gICAqIEJlY2F1c2UgdGhlIGRhdGEgcmV0dXJuZWQgZnJvbSBgcmVhZFNsaWNlKClgIHdpbGwgYmUgb3ZlcndyaXR0ZW4gYnkgdGhlXG4gICAqIG5leHQgSS9PIG9wZXJhdGlvbiwgbW9zdCBjbGllbnRzIHNob3VsZCB1c2UgYHJlYWRTdHJpbmcoKWAgaW5zdGVhZC5cbiAgICovXG4gIGFzeW5jIHJlYWRTbGljZShkZWxpbTogbnVtYmVyKTogUHJvbWlzZTxVaW50OEFycmF5IHwgbnVsbD4ge1xuICAgIGxldCBzID0gMDsgLy8gc2VhcmNoIHN0YXJ0IGluZGV4XG4gICAgbGV0IHNsaWNlOiBVaW50OEFycmF5IHwgdW5kZWZpbmVkO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIC8vIFNlYXJjaCBidWZmZXIuXG4gICAgICBsZXQgaSA9IHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNyICsgcywgdGhpcy4jdykuaW5kZXhPZihkZWxpbSk7XG4gICAgICBpZiAoaSA+PSAwKSB7XG4gICAgICAgIGkgKz0gcztcbiAgICAgICAgc2xpY2UgPSB0aGlzLiNidWYuc3ViYXJyYXkodGhpcy4jciwgdGhpcy4jciArIGkgKyAxKTtcbiAgICAgICAgdGhpcy4jciArPSBpICsgMTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIC8vIEVPRj9cbiAgICAgIGlmICh0aGlzLiNlb2YpIHtcbiAgICAgICAgaWYgKHRoaXMuI3IgPT09IHRoaXMuI3cpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBzbGljZSA9IHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNyLCB0aGlzLiN3KTtcbiAgICAgICAgdGhpcy4jciA9IHRoaXMuI3c7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICAvLyBCdWZmZXIgZnVsbD9cbiAgICAgIGlmICh0aGlzLmJ1ZmZlcmVkKCkgPj0gdGhpcy4jYnVmLmJ5dGVMZW5ndGgpIHtcbiAgICAgICAgdGhpcy4jciA9IHRoaXMuI3c7XG4gICAgICAgIC8vICM0NTIxIFRoZSBpbnRlcm5hbCBidWZmZXIgc2hvdWxkIG5vdCBiZSByZXVzZWQgYWNyb3NzIHJlYWRzIGJlY2F1c2UgaXQgY2F1c2VzIGNvcnJ1cHRpb24gb2YgZGF0YS5cbiAgICAgICAgY29uc3Qgb2xkYnVmID0gdGhpcy4jYnVmO1xuICAgICAgICBjb25zdCBuZXdidWYgPSB0aGlzLiNidWYuc2xpY2UoMCk7XG4gICAgICAgIHRoaXMuI2J1ZiA9IG5ld2J1ZjtcbiAgICAgICAgdGhyb3cgbmV3IEJ1ZmZlckZ1bGxFcnJvcihvbGRidWYpO1xuICAgICAgfVxuXG4gICAgICBzID0gdGhpcy4jdyAtIHRoaXMuI3I7IC8vIGRvIG5vdCByZXNjYW4gYXJlYSB3ZSBzY2FubmVkIGJlZm9yZVxuXG4gICAgICAvLyBCdWZmZXIgaXMgbm90IGZ1bGwuXG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCB0aGlzLiNmaWxsKCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIFBhcnRpYWxSZWFkRXJyb3IpIHtcbiAgICAgICAgICBlcnIucGFydGlhbCA9IHNsaWNlO1xuICAgICAgICB9IGVsc2UgaWYgKGVyciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgY29uc3QgZSA9IG5ldyBQYXJ0aWFsUmVhZEVycm9yKCk7XG4gICAgICAgICAgZS5wYXJ0aWFsID0gc2xpY2U7XG4gICAgICAgICAgZS5zdGFjayA9IGVyci5zdGFjaztcbiAgICAgICAgICBlLm1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICAgICAgICBlLmNhdXNlID0gZXJyLmNhdXNlO1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIGxhc3QgYnl0ZSwgaWYgYW55LlxuICAgIC8vIGNvbnN0IGkgPSBzbGljZS5ieXRlTGVuZ3RoIC0gMTtcbiAgICAvLyBpZiAoaSA+PSAwKSB7XG4gICAgLy8gICB0aGlzLmxhc3RCeXRlID0gc2xpY2VbaV07XG4gICAgLy8gICB0aGlzLmxhc3RDaGFyU2l6ZSA9IC0xXG4gICAgLy8gfVxuXG4gICAgcmV0dXJuIHNsaWNlO1xuICB9XG5cbiAgLyoqIGBwZWVrKClgIHJldHVybnMgdGhlIG5leHQgYG5gIGJ5dGVzIHdpdGhvdXQgYWR2YW5jaW5nIHRoZSByZWFkZXIuIFRoZVxuICAgKiBieXRlcyBzdG9wIGJlaW5nIHZhbGlkIGF0IHRoZSBuZXh0IHJlYWQgY2FsbC5cbiAgICpcbiAgICogV2hlbiB0aGUgZW5kIG9mIHRoZSB1bmRlcmx5aW5nIHN0cmVhbSBpcyByZWFjaGVkLCBidXQgdGhlcmUgYXJlIHVucmVhZFxuICAgKiBieXRlcyBsZWZ0IGluIHRoZSBidWZmZXIsIHRob3NlIGJ5dGVzIGFyZSByZXR1cm5lZC4gSWYgdGhlcmUgYXJlIG5vIGJ5dGVzXG4gICAqIGxlZnQgaW4gdGhlIGJ1ZmZlciwgaXQgcmV0dXJucyBgbnVsbGAuXG4gICAqXG4gICAqIElmIGFuIGVycm9yIGlzIGVuY291bnRlcmVkIGJlZm9yZSBgbmAgYnl0ZXMgYXJlIGF2YWlsYWJsZSwgYHBlZWsoKWAgdGhyb3dzXG4gICAqIGFuIGVycm9yIHdpdGggdGhlIGBwYXJ0aWFsYCBwcm9wZXJ0eSBzZXQgdG8gYSBzbGljZSBvZiB0aGUgYnVmZmVyIHRoYXRcbiAgICogY29udGFpbnMgdGhlIGJ5dGVzIHRoYXQgd2VyZSBhdmFpbGFibGUgYmVmb3JlIHRoZSBlcnJvciBvY2N1cnJlZC5cbiAgICovXG4gIGFzeW5jIHBlZWsobjogbnVtYmVyKTogUHJvbWlzZTxVaW50OEFycmF5IHwgbnVsbD4ge1xuICAgIGlmIChuIDwgMCkge1xuICAgICAgdGhyb3cgRXJyb3IoXCJuZWdhdGl2ZSBjb3VudFwiKTtcbiAgICB9XG5cbiAgICBsZXQgYXZhaWwgPSB0aGlzLiN3IC0gdGhpcy4jcjtcbiAgICB3aGlsZSAoYXZhaWwgPCBuICYmIGF2YWlsIDwgdGhpcy4jYnVmLmJ5dGVMZW5ndGggJiYgIXRoaXMuI2VvZikge1xuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgdGhpcy4jZmlsbCgpO1xuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiBQYXJ0aWFsUmVhZEVycm9yKSB7XG4gICAgICAgICAgZXJyLnBhcnRpYWwgPSB0aGlzLiNidWYuc3ViYXJyYXkodGhpcy4jciwgdGhpcy4jdyk7XG4gICAgICAgIH0gZWxzZSBpZiAoZXJyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICBjb25zdCBlID0gbmV3IFBhcnRpYWxSZWFkRXJyb3IoKTtcbiAgICAgICAgICBlLnBhcnRpYWwgPSB0aGlzLiNidWYuc3ViYXJyYXkodGhpcy4jciwgdGhpcy4jdyk7XG4gICAgICAgICAgZS5zdGFjayA9IGVyci5zdGFjaztcbiAgICAgICAgICBlLm1lc3NhZ2UgPSBlcnIubWVzc2FnZTtcbiAgICAgICAgICBlLmNhdXNlID0gZXJyLmNhdXNlO1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9XG4gICAgICBhdmFpbCA9IHRoaXMuI3cgLSB0aGlzLiNyO1xuICAgIH1cblxuICAgIGlmIChhdmFpbCA9PT0gMCAmJiB0aGlzLiNlb2YpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAoYXZhaWwgPCBuICYmIHRoaXMuI2VvZikge1xuICAgICAgcmV0dXJuIHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNyLCB0aGlzLiNyICsgYXZhaWwpO1xuICAgIH0gZWxzZSBpZiAoYXZhaWwgPCBuKSB7XG4gICAgICB0aHJvdyBuZXcgQnVmZmVyRnVsbEVycm9yKHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNyLCB0aGlzLiN3KSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuI2J1Zi5zdWJhcnJheSh0aGlzLiNyLCB0aGlzLiNyICsgbik7XG4gIH1cbn1cblxuYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RCdWZCYXNlIHtcbiAgYnVmOiBVaW50OEFycmF5O1xuICB1c2VkQnVmZmVyQnl0ZXMgPSAwO1xuICBlcnI6IEVycm9yIHwgbnVsbCA9IG51bGw7XG5cbiAgY29uc3RydWN0b3IoYnVmOiBVaW50OEFycmF5KSB7XG4gICAgdGhpcy5idWYgPSBidWY7XG4gIH1cblxuICAvKiogU2l6ZSByZXR1cm5zIHRoZSBzaXplIG9mIHRoZSB1bmRlcmx5aW5nIGJ1ZmZlciBpbiBieXRlcy4gKi9cbiAgc2l6ZSgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLmJ1Zi5ieXRlTGVuZ3RoO1xuICB9XG5cbiAgLyoqIFJldHVybnMgaG93IG1hbnkgYnl0ZXMgYXJlIHVudXNlZCBpbiB0aGUgYnVmZmVyLiAqL1xuICBhdmFpbGFibGUoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5idWYuYnl0ZUxlbmd0aCAtIHRoaXMudXNlZEJ1ZmZlckJ5dGVzO1xuICB9XG5cbiAgLyoqIGJ1ZmZlcmVkIHJldHVybnMgdGhlIG51bWJlciBvZiBieXRlcyB0aGF0IGhhdmUgYmVlbiB3cml0dGVuIGludG8gdGhlXG4gICAqIGN1cnJlbnQgYnVmZmVyLlxuICAgKi9cbiAgYnVmZmVyZWQoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy51c2VkQnVmZmVyQnl0ZXM7XG4gIH1cbn1cblxuLyoqIEJ1ZldyaXRlciBpbXBsZW1lbnRzIGJ1ZmZlcmluZyBmb3IgYW4gZGVuby5Xcml0ZXIgb2JqZWN0LlxuICogSWYgYW4gZXJyb3Igb2NjdXJzIHdyaXRpbmcgdG8gYSBXcml0ZXIsIG5vIG1vcmUgZGF0YSB3aWxsIGJlXG4gKiBhY2NlcHRlZCBhbmQgYWxsIHN1YnNlcXVlbnQgd3JpdGVzLCBhbmQgZmx1c2goKSwgd2lsbCByZXR1cm4gdGhlIGVycm9yLlxuICogQWZ0ZXIgYWxsIGRhdGEgaGFzIGJlZW4gd3JpdHRlbiwgdGhlIGNsaWVudCBzaG91bGQgY2FsbCB0aGVcbiAqIGZsdXNoKCkgbWV0aG9kIHRvIGd1YXJhbnRlZSBhbGwgZGF0YSBoYXMgYmVlbiBmb3J3YXJkZWQgdG9cbiAqIHRoZSB1bmRlcmx5aW5nIGRlbm8uV3JpdGVyLlxuICovXG5leHBvcnQgY2xhc3MgQnVmV3JpdGVyIGV4dGVuZHMgQWJzdHJhY3RCdWZCYXNlIGltcGxlbWVudHMgV3JpdGVyIHtcbiAgI3dyaXRlcjogV3JpdGVyO1xuXG4gIC8qKiByZXR1cm4gbmV3IEJ1ZldyaXRlciB1bmxlc3Mgd3JpdGVyIGlzIEJ1ZldyaXRlciAqL1xuICBzdGF0aWMgY3JlYXRlKHdyaXRlcjogV3JpdGVyLCBzaXplOiBudW1iZXIgPSBERUZBVUxUX0JVRl9TSVpFKTogQnVmV3JpdGVyIHtcbiAgICByZXR1cm4gd3JpdGVyIGluc3RhbmNlb2YgQnVmV3JpdGVyID8gd3JpdGVyIDogbmV3IEJ1ZldyaXRlcih3cml0ZXIsIHNpemUpO1xuICB9XG5cbiAgY29uc3RydWN0b3Iod3JpdGVyOiBXcml0ZXIsIHNpemU6IG51bWJlciA9IERFRkFVTFRfQlVGX1NJWkUpIHtcbiAgICBzdXBlcihuZXcgVWludDhBcnJheShzaXplIDw9IDAgPyBERUZBVUxUX0JVRl9TSVpFIDogc2l6ZSkpO1xuICAgIHRoaXMuI3dyaXRlciA9IHdyaXRlcjtcbiAgfVxuXG4gIC8qKiBEaXNjYXJkcyBhbnkgdW5mbHVzaGVkIGJ1ZmZlcmVkIGRhdGEsIGNsZWFycyBhbnkgZXJyb3IsIGFuZFxuICAgKiByZXNldHMgYnVmZmVyIHRvIHdyaXRlIGl0cyBvdXRwdXQgdG8gdy5cbiAgICovXG4gIHJlc2V0KHc6IFdyaXRlcik6IHZvaWQge1xuICAgIHRoaXMuZXJyID0gbnVsbDtcbiAgICB0aGlzLnVzZWRCdWZmZXJCeXRlcyA9IDA7XG4gICAgdGhpcy4jd3JpdGVyID0gdztcbiAgfVxuXG4gIC8qKiBGbHVzaCB3cml0ZXMgYW55IGJ1ZmZlcmVkIGRhdGEgdG8gdGhlIHVuZGVybHlpbmcgaW8uV3JpdGVyLiAqL1xuICBhc3luYyBmbHVzaCgpIHtcbiAgICBpZiAodGhpcy5lcnIgIT09IG51bGwpIHRocm93IHRoaXMuZXJyO1xuICAgIGlmICh0aGlzLnVzZWRCdWZmZXJCeXRlcyA9PT0gMCkgcmV0dXJuO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHAgPSB0aGlzLmJ1Zi5zdWJhcnJheSgwLCB0aGlzLnVzZWRCdWZmZXJCeXRlcyk7XG4gICAgICBsZXQgbndyaXR0ZW4gPSAwO1xuICAgICAgd2hpbGUgKG53cml0dGVuIDwgcC5sZW5ndGgpIHtcbiAgICAgICAgbndyaXR0ZW4gKz0gYXdhaXQgdGhpcy4jd3JpdGVyLndyaXRlKHAuc3ViYXJyYXkobndyaXR0ZW4pKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRoaXMuZXJyID0gZTtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuXG4gICAgdGhpcy5idWYgPSBuZXcgVWludDhBcnJheSh0aGlzLmJ1Zi5sZW5ndGgpO1xuICAgIHRoaXMudXNlZEJ1ZmZlckJ5dGVzID0gMDtcbiAgfVxuXG4gIC8qKiBXcml0ZXMgdGhlIGNvbnRlbnRzIG9mIGBkYXRhYCBpbnRvIHRoZSBidWZmZXIuICBJZiB0aGUgY29udGVudHMgd29uJ3QgZnVsbHlcbiAgICogZml0IGludG8gdGhlIGJ1ZmZlciwgdGhvc2UgYnl0ZXMgdGhhdCBjYW4gYXJlIGNvcGllZCBpbnRvIHRoZSBidWZmZXIsIHRoZVxuICAgKiBidWZmZXIgaXMgdGhlIGZsdXNoZWQgdG8gdGhlIHdyaXRlciBhbmQgdGhlIHJlbWFpbmluZyBieXRlcyBhcmUgY29waWVkIGludG9cbiAgICogdGhlIG5vdyBlbXB0eSBidWZmZXIuXG4gICAqXG4gICAqIEByZXR1cm4gdGhlIG51bWJlciBvZiBieXRlcyB3cml0dGVuIHRvIHRoZSBidWZmZXIuXG4gICAqL1xuICBhc3luYyB3cml0ZShkYXRhOiBVaW50OEFycmF5KTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBpZiAodGhpcy5lcnIgIT09IG51bGwpIHRocm93IHRoaXMuZXJyO1xuICAgIGlmIChkYXRhLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDA7XG5cbiAgICBsZXQgdG90YWxCeXRlc1dyaXR0ZW4gPSAwO1xuICAgIGxldCBudW1CeXRlc1dyaXR0ZW4gPSAwO1xuICAgIHdoaWxlIChkYXRhLmJ5dGVMZW5ndGggPiB0aGlzLmF2YWlsYWJsZSgpKSB7XG4gICAgICBpZiAodGhpcy5idWZmZXJlZCgpID09PSAwKSB7XG4gICAgICAgIC8vIExhcmdlIHdyaXRlLCBlbXB0eSBidWZmZXIuXG4gICAgICAgIC8vIFdyaXRlIGRpcmVjdGx5IGZyb20gZGF0YSB0byBhdm9pZCBjb3B5LlxuICAgICAgICB0cnkge1xuICAgICAgICAgIG51bUJ5dGVzV3JpdHRlbiA9IGF3YWl0IHRoaXMuI3dyaXRlci53cml0ZShkYXRhKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGlmIChlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgICAgIHRoaXMuZXJyID0gZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbnVtQnl0ZXNXcml0dGVuID0gY29weShkYXRhLCB0aGlzLmJ1ZiwgdGhpcy51c2VkQnVmZmVyQnl0ZXMpO1xuICAgICAgICB0aGlzLnVzZWRCdWZmZXJCeXRlcyArPSBudW1CeXRlc1dyaXR0ZW47XG4gICAgICAgIGF3YWl0IHRoaXMuZmx1c2goKTtcbiAgICAgIH1cbiAgICAgIHRvdGFsQnl0ZXNXcml0dGVuICs9IG51bUJ5dGVzV3JpdHRlbjtcbiAgICAgIGRhdGEgPSBkYXRhLnN1YmFycmF5KG51bUJ5dGVzV3JpdHRlbik7XG4gICAgfVxuXG4gICAgbnVtQnl0ZXNXcml0dGVuID0gY29weShkYXRhLCB0aGlzLmJ1ZiwgdGhpcy51c2VkQnVmZmVyQnl0ZXMpO1xuICAgIHRoaXMudXNlZEJ1ZmZlckJ5dGVzICs9IG51bUJ5dGVzV3JpdHRlbjtcbiAgICB0b3RhbEJ5dGVzV3JpdHRlbiArPSBudW1CeXRlc1dyaXR0ZW47XG4gICAgcmV0dXJuIHRvdGFsQnl0ZXNXcml0dGVuO1xuICB9XG59XG5cbi8qKiBCdWZXcml0ZXJTeW5jIGltcGxlbWVudHMgYnVmZmVyaW5nIGZvciBhIGRlbm8uV3JpdGVyU3luYyBvYmplY3QuXG4gKiBJZiBhbiBlcnJvciBvY2N1cnMgd3JpdGluZyB0byBhIFdyaXRlclN5bmMsIG5vIG1vcmUgZGF0YSB3aWxsIGJlXG4gKiBhY2NlcHRlZCBhbmQgYWxsIHN1YnNlcXVlbnQgd3JpdGVzLCBhbmQgZmx1c2goKSwgd2lsbCByZXR1cm4gdGhlIGVycm9yLlxuICogQWZ0ZXIgYWxsIGRhdGEgaGFzIGJlZW4gd3JpdHRlbiwgdGhlIGNsaWVudCBzaG91bGQgY2FsbCB0aGVcbiAqIGZsdXNoKCkgbWV0aG9kIHRvIGd1YXJhbnRlZSBhbGwgZGF0YSBoYXMgYmVlbiBmb3J3YXJkZWQgdG9cbiAqIHRoZSB1bmRlcmx5aW5nIGRlbm8uV3JpdGVyU3luYy5cbiAqL1xuZXhwb3J0IGNsYXNzIEJ1ZldyaXRlclN5bmMgZXh0ZW5kcyBBYnN0cmFjdEJ1ZkJhc2UgaW1wbGVtZW50cyBXcml0ZXJTeW5jIHtcbiAgI3dyaXRlcjogV3JpdGVyU3luYztcblxuICAvKiogcmV0dXJuIG5ldyBCdWZXcml0ZXJTeW5jIHVubGVzcyB3cml0ZXIgaXMgQnVmV3JpdGVyU3luYyAqL1xuICBzdGF0aWMgY3JlYXRlKFxuICAgIHdyaXRlcjogV3JpdGVyU3luYyxcbiAgICBzaXplOiBudW1iZXIgPSBERUZBVUxUX0JVRl9TSVpFLFxuICApOiBCdWZXcml0ZXJTeW5jIHtcbiAgICByZXR1cm4gd3JpdGVyIGluc3RhbmNlb2YgQnVmV3JpdGVyU3luY1xuICAgICAgPyB3cml0ZXJcbiAgICAgIDogbmV3IEJ1ZldyaXRlclN5bmMod3JpdGVyLCBzaXplKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKHdyaXRlcjogV3JpdGVyU3luYywgc2l6ZTogbnVtYmVyID0gREVGQVVMVF9CVUZfU0laRSkge1xuICAgIHN1cGVyKG5ldyBVaW50OEFycmF5KHNpemUgPD0gMCA/IERFRkFVTFRfQlVGX1NJWkUgOiBzaXplKSk7XG4gICAgdGhpcy4jd3JpdGVyID0gd3JpdGVyO1xuICB9XG5cbiAgLyoqIERpc2NhcmRzIGFueSB1bmZsdXNoZWQgYnVmZmVyZWQgZGF0YSwgY2xlYXJzIGFueSBlcnJvciwgYW5kXG4gICAqIHJlc2V0cyBidWZmZXIgdG8gd3JpdGUgaXRzIG91dHB1dCB0byB3LlxuICAgKi9cbiAgcmVzZXQodzogV3JpdGVyU3luYyk6IHZvaWQge1xuICAgIHRoaXMuZXJyID0gbnVsbDtcbiAgICB0aGlzLnVzZWRCdWZmZXJCeXRlcyA9IDA7XG4gICAgdGhpcy4jd3JpdGVyID0gdztcbiAgfVxuXG4gIC8qKiBGbHVzaCB3cml0ZXMgYW55IGJ1ZmZlcmVkIGRhdGEgdG8gdGhlIHVuZGVybHlpbmcgaW8uV3JpdGVyU3luYy4gKi9cbiAgZmx1c2goKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuZXJyICE9PSBudWxsKSB0aHJvdyB0aGlzLmVycjtcbiAgICBpZiAodGhpcy51c2VkQnVmZmVyQnl0ZXMgPT09IDApIHJldHVybjtcblxuICAgIHRyeSB7XG4gICAgICBjb25zdCBwID0gdGhpcy5idWYuc3ViYXJyYXkoMCwgdGhpcy51c2VkQnVmZmVyQnl0ZXMpO1xuICAgICAgbGV0IG53cml0dGVuID0gMDtcbiAgICAgIHdoaWxlIChud3JpdHRlbiA8IHAubGVuZ3RoKSB7XG4gICAgICAgIG53cml0dGVuICs9IHRoaXMuI3dyaXRlci53cml0ZVN5bmMocC5zdWJhcnJheShud3JpdHRlbikpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhpcy5lcnIgPSBlO1xuICAgICAgfVxuICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICB0aGlzLmJ1ZiA9IG5ldyBVaW50OEFycmF5KHRoaXMuYnVmLmxlbmd0aCk7XG4gICAgdGhpcy51c2VkQnVmZmVyQnl0ZXMgPSAwO1xuICB9XG5cbiAgLyoqIFdyaXRlcyB0aGUgY29udGVudHMgb2YgYGRhdGFgIGludG8gdGhlIGJ1ZmZlci4gIElmIHRoZSBjb250ZW50cyB3b24ndCBmdWxseVxuICAgKiBmaXQgaW50byB0aGUgYnVmZmVyLCB0aG9zZSBieXRlcyB0aGF0IGNhbiBhcmUgY29waWVkIGludG8gdGhlIGJ1ZmZlciwgdGhlXG4gICAqIGJ1ZmZlciBpcyB0aGUgZmx1c2hlZCB0byB0aGUgd3JpdGVyIGFuZCB0aGUgcmVtYWluaW5nIGJ5dGVzIGFyZSBjb3BpZWQgaW50b1xuICAgKiB0aGUgbm93IGVtcHR5IGJ1ZmZlci5cbiAgICpcbiAgICogQHJldHVybiB0aGUgbnVtYmVyIG9mIGJ5dGVzIHdyaXR0ZW4gdG8gdGhlIGJ1ZmZlci5cbiAgICovXG4gIHdyaXRlU3luYyhkYXRhOiBVaW50OEFycmF5KTogbnVtYmVyIHtcbiAgICBpZiAodGhpcy5lcnIgIT09IG51bGwpIHRocm93IHRoaXMuZXJyO1xuICAgIGlmIChkYXRhLmxlbmd0aCA9PT0gMCkgcmV0dXJuIDA7XG5cbiAgICBsZXQgdG90YWxCeXRlc1dyaXR0ZW4gPSAwO1xuICAgIGxldCBudW1CeXRlc1dyaXR0ZW4gPSAwO1xuICAgIHdoaWxlIChkYXRhLmJ5dGVMZW5ndGggPiB0aGlzLmF2YWlsYWJsZSgpKSB7XG4gICAgICBpZiAodGhpcy5idWZmZXJlZCgpID09PSAwKSB7XG4gICAgICAgIC8vIExhcmdlIHdyaXRlLCBlbXB0eSBidWZmZXIuXG4gICAgICAgIC8vIFdyaXRlIGRpcmVjdGx5IGZyb20gZGF0YSB0byBhdm9pZCBjb3B5LlxuICAgICAgICB0cnkge1xuICAgICAgICAgIG51bUJ5dGVzV3JpdHRlbiA9IHRoaXMuI3dyaXRlci53cml0ZVN5bmMoZGF0YSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBpZiAoZSBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgICAgICB0aGlzLmVyciA9IGU7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRocm93IGU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG51bUJ5dGVzV3JpdHRlbiA9IGNvcHkoZGF0YSwgdGhpcy5idWYsIHRoaXMudXNlZEJ1ZmZlckJ5dGVzKTtcbiAgICAgICAgdGhpcy51c2VkQnVmZmVyQnl0ZXMgKz0gbnVtQnl0ZXNXcml0dGVuO1xuICAgICAgICB0aGlzLmZsdXNoKCk7XG4gICAgICB9XG4gICAgICB0b3RhbEJ5dGVzV3JpdHRlbiArPSBudW1CeXRlc1dyaXR0ZW47XG4gICAgICBkYXRhID0gZGF0YS5zdWJhcnJheShudW1CeXRlc1dyaXR0ZW4pO1xuICAgIH1cblxuICAgIG51bUJ5dGVzV3JpdHRlbiA9IGNvcHkoZGF0YSwgdGhpcy5idWYsIHRoaXMudXNlZEJ1ZmZlckJ5dGVzKTtcbiAgICB0aGlzLnVzZWRCdWZmZXJCeXRlcyArPSBudW1CeXRlc1dyaXR0ZW47XG4gICAgdG90YWxCeXRlc1dyaXR0ZW4gKz0gbnVtQnl0ZXNXcml0dGVuO1xuICAgIHJldHVybiB0b3RhbEJ5dGVzV3JpdHRlbjtcbiAgfVxufVxuXG4vKiogR2VuZXJhdGUgbG9uZ2VzdCBwcm9wZXIgcHJlZml4IHdoaWNoIGlzIGFsc28gc3VmZml4IGFycmF5LiAqL1xuZnVuY3Rpb24gY3JlYXRlTFBTKHBhdDogVWludDhBcnJheSk6IFVpbnQ4QXJyYXkge1xuICBjb25zdCBscHMgPSBuZXcgVWludDhBcnJheShwYXQubGVuZ3RoKTtcbiAgbHBzWzBdID0gMDtcbiAgbGV0IHByZWZpeEVuZCA9IDA7XG4gIGxldCBpID0gMTtcbiAgd2hpbGUgKGkgPCBscHMubGVuZ3RoKSB7XG4gICAgaWYgKHBhdFtpXSA9PSBwYXRbcHJlZml4RW5kXSkge1xuICAgICAgcHJlZml4RW5kKys7XG4gICAgICBscHNbaV0gPSBwcmVmaXhFbmQ7XG4gICAgICBpKys7XG4gICAgfSBlbHNlIGlmIChwcmVmaXhFbmQgPT09IDApIHtcbiAgICAgIGxwc1tpXSA9IDA7XG4gICAgICBpKys7XG4gICAgfSBlbHNlIHtcbiAgICAgIHByZWZpeEVuZCA9IGxwc1twcmVmaXhFbmQgLSAxXTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGxwcztcbn1cblxuLyoqIFJlYWQgZGVsaW1pdGVkIGJ5dGVzIGZyb20gYSBSZWFkZXIuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24qIHJlYWREZWxpbShcbiAgcmVhZGVyOiBSZWFkZXIsXG4gIGRlbGltOiBVaW50OEFycmF5LFxuKTogQXN5bmNJdGVyYWJsZUl0ZXJhdG9yPFVpbnQ4QXJyYXk+IHtcbiAgLy8gQXZvaWQgdW5pY29kZSBwcm9ibGVtc1xuICBjb25zdCBkZWxpbUxlbiA9IGRlbGltLmxlbmd0aDtcbiAgY29uc3QgZGVsaW1MUFMgPSBjcmVhdGVMUFMoZGVsaW0pO1xuICBjb25zdCBjaHVua3MgPSBuZXcgQnl0ZXNMaXN0KCk7XG4gIGNvbnN0IGJ1ZlNpemUgPSBNYXRoLm1heCgxMDI0LCBkZWxpbUxlbiArIDEpO1xuXG4gIC8vIE1vZGlmaWVkIEtNUFxuICBsZXQgaW5zcGVjdEluZGV4ID0gMDtcbiAgbGV0IG1hdGNoSW5kZXggPSAwO1xuICB3aGlsZSAodHJ1ZSkge1xuICAgIGNvbnN0IGluc3BlY3RBcnIgPSBuZXcgVWludDhBcnJheShidWZTaXplKTtcbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZWFkZXIucmVhZChpbnNwZWN0QXJyKTtcbiAgICBpZiAocmVzdWx0ID09PSBudWxsKSB7XG4gICAgICAvLyBZaWVsZCBsYXN0IGNodW5rLlxuICAgICAgeWllbGQgY2h1bmtzLmNvbmNhdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH0gZWxzZSBpZiAocmVzdWx0IDwgMCkge1xuICAgICAgLy8gRGlzY2FyZCBhbGwgcmVtYWluaW5nIGFuZCBzaWxlbnRseSBmYWlsLlxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjaHVua3MuYWRkKGluc3BlY3RBcnIsIDAsIHJlc3VsdCk7XG4gICAgbGV0IGxvY2FsSW5kZXggPSAwO1xuICAgIHdoaWxlIChpbnNwZWN0SW5kZXggPCBjaHVua3Muc2l6ZSgpKSB7XG4gICAgICBpZiAoaW5zcGVjdEFycltsb2NhbEluZGV4XSA9PT0gZGVsaW1bbWF0Y2hJbmRleF0pIHtcbiAgICAgICAgaW5zcGVjdEluZGV4Kys7XG4gICAgICAgIGxvY2FsSW5kZXgrKztcbiAgICAgICAgbWF0Y2hJbmRleCsrO1xuICAgICAgICBpZiAobWF0Y2hJbmRleCA9PT0gZGVsaW1MZW4pIHtcbiAgICAgICAgICAvLyBGdWxsIG1hdGNoXG4gICAgICAgICAgY29uc3QgbWF0Y2hFbmQgPSBpbnNwZWN0SW5kZXggLSBkZWxpbUxlbjtcbiAgICAgICAgICBjb25zdCByZWFkeUJ5dGVzID0gY2h1bmtzLnNsaWNlKDAsIG1hdGNoRW5kKTtcbiAgICAgICAgICB5aWVsZCByZWFkeUJ5dGVzO1xuICAgICAgICAgIC8vIFJlc2V0IG1hdGNoLCBkaWZmZXJlbnQgZnJvbSBLTVAuXG4gICAgICAgICAgY2h1bmtzLnNoaWZ0KGluc3BlY3RJbmRleCk7XG4gICAgICAgICAgaW5zcGVjdEluZGV4ID0gMDtcbiAgICAgICAgICBtYXRjaEluZGV4ID0gMDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaWYgKG1hdGNoSW5kZXggPT09IDApIHtcbiAgICAgICAgICBpbnNwZWN0SW5kZXgrKztcbiAgICAgICAgICBsb2NhbEluZGV4Kys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbWF0Y2hJbmRleCA9IGRlbGltTFBTW21hdGNoSW5kZXggLSAxXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG4vKiogUmVhZCBkZWxpbWl0ZWQgc3RyaW5ncyBmcm9tIGEgUmVhZGVyLiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uKiByZWFkU3RyaW5nRGVsaW0oXG4gIHJlYWRlcjogUmVhZGVyLFxuICBkZWxpbTogc3RyaW5nLFxuICBkZWNvZGVyT3B0cz86IHtcbiAgICBlbmNvZGluZz86IHN0cmluZztcbiAgICBmYXRhbD86IGJvb2xlYW47XG4gICAgaWdub3JlQk9NPzogYm9vbGVhbjtcbiAgfSxcbik6IEFzeW5jSXRlcmFibGVJdGVyYXRvcjxzdHJpbmc+IHtcbiAgY29uc3QgZW5jb2RlciA9IG5ldyBUZXh0RW5jb2RlcigpO1xuICBjb25zdCBkZWNvZGVyID0gbmV3IFRleHREZWNvZGVyKGRlY29kZXJPcHRzPy5lbmNvZGluZywgZGVjb2Rlck9wdHMpO1xuICBmb3IgYXdhaXQgKGNvbnN0IGNodW5rIG9mIHJlYWREZWxpbShyZWFkZXIsIGVuY29kZXIuZW5jb2RlKGRlbGltKSkpIHtcbiAgICB5aWVsZCBkZWNvZGVyLmRlY29kZShjaHVuayk7XG4gIH1cbn1cblxuLyoqIFJlYWQgc3RyaW5ncyBsaW5lLWJ5LWxpbmUgZnJvbSBhIFJlYWRlci4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiogcmVhZExpbmVzKFxuICByZWFkZXI6IFJlYWRlcixcbiAgZGVjb2Rlck9wdHM/OiB7XG4gICAgZW5jb2Rpbmc/OiBzdHJpbmc7XG4gICAgZmF0YWw/OiBib29sZWFuO1xuICAgIGlnbm9yZUJPTT86IGJvb2xlYW47XG4gIH0sXG4pOiBBc3luY0l0ZXJhYmxlSXRlcmF0b3I8c3RyaW5nPiB7XG4gIGNvbnN0IGJ1ZlJlYWRlciA9IG5ldyBCdWZSZWFkZXIocmVhZGVyKTtcbiAgbGV0IGNodW5rczogVWludDhBcnJheVtdID0gW107XG4gIGNvbnN0IGRlY29kZXIgPSBuZXcgVGV4dERlY29kZXIoZGVjb2Rlck9wdHM/LmVuY29kaW5nLCBkZWNvZGVyT3B0cyk7XG4gIHdoaWxlICh0cnVlKSB7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgYnVmUmVhZGVyLnJlYWRMaW5lKCk7XG4gICAgaWYgKCFyZXMpIHtcbiAgICAgIGlmIChjaHVua3MubGVuZ3RoID4gMCkge1xuICAgICAgICB5aWVsZCBkZWNvZGVyLmRlY29kZShjb25jYXQoLi4uY2h1bmtzKSk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2h1bmtzLnB1c2gocmVzLmxpbmUpO1xuICAgIGlmICghcmVzLm1vcmUpIHtcbiAgICAgIHlpZWxkIGRlY29kZXIuZGVjb2RlKGNvbmNhdCguLi5jaHVua3MpKTtcbiAgICAgIGNodW5rcyA9IFtdO1xuICAgIH1cbiAgfVxufVxuIl19