import { getSystemErrorName } from "../util.ts";
import { inspect } from "../internal/util/inspect.mjs";
import { codes } from "./error_codes.ts";
import { codeMap, errorMap, mapSysErrnoToUvErrno, } from "../internal_binding/uv.ts";
import { assert } from "../../_util/assert.ts";
import { isWindows } from "../../_util/os.ts";
import { os as osConstants } from "../internal_binding/constants.ts";
const { errno: { ENOTDIR, ENOENT }, } = osConstants;
import { hideStackFrames } from "./hide_stack_frames.ts";
export { errorMap };
const kIsNodeError = Symbol("kIsNodeError");
const classRegExp = /^([A-Z][a-z0-9]*)+$/;
const kTypes = [
    "string",
    "function",
    "number",
    "object",
    "Function",
    "Object",
    "boolean",
    "bigint",
    "symbol",
];
export class AbortError extends Error {
    code;
    constructor() {
        super("The operation was aborted");
        this.code = "ABORT_ERR";
        this.name = "AbortError";
    }
}
function addNumericalSeparator(val) {
    let res = "";
    let i = val.length;
    const start = val[0] === "-" ? 1 : 0;
    for (; i >= start + 4; i -= 3) {
        res = `_${val.slice(i - 3, i)}${res}`;
    }
    return `${val.slice(0, i)}${res}`;
}
const captureLargerStackTrace = hideStackFrames(function captureLargerStackTrace(err) {
    Error.captureStackTrace(err);
    return err;
});
export const uvExceptionWithHostPort = hideStackFrames(function uvExceptionWithHostPort(err, syscall, address, port) {
    const { 0: code, 1: uvmsg } = uvErrmapGet(err) || uvUnmappedError;
    const message = `${syscall} ${code}: ${uvmsg}`;
    let details = "";
    if (port && port > 0) {
        details = ` ${address}:${port}`;
    }
    else if (address) {
        details = ` ${address}`;
    }
    const ex = new Error(`${message}${details}`);
    ex.code = code;
    ex.errno = err;
    ex.syscall = syscall;
    ex.address = address;
    if (port) {
        ex.port = port;
    }
    return captureLargerStackTrace(ex);
});
export const errnoException = hideStackFrames(function errnoException(err, syscall, original) {
    const code = getSystemErrorName(err);
    const message = original
        ? `${syscall} ${code} ${original}`
        : `${syscall} ${code}`;
    const ex = new Error(message);
    ex.errno = err;
    ex.code = code;
    ex.syscall = syscall;
    return captureLargerStackTrace(ex);
});
function uvErrmapGet(name) {
    return errorMap.get(name);
}
const uvUnmappedError = ["UNKNOWN", "unknown error"];
export const uvException = hideStackFrames(function uvException(ctx) {
    const { 0: code, 1: uvmsg } = uvErrmapGet(ctx.errno) || uvUnmappedError;
    let message = `${code}: ${ctx.message || uvmsg}, ${ctx.syscall}`;
    let path;
    let dest;
    if (ctx.path) {
        path = ctx.path.toString();
        message += ` '${path}'`;
    }
    if (ctx.dest) {
        dest = ctx.dest.toString();
        message += ` -> '${dest}'`;
    }
    const err = new Error(message);
    for (const prop of Object.keys(ctx)) {
        if (prop === "message" || prop === "path" || prop === "dest") {
            continue;
        }
        err[prop] = ctx[prop];
    }
    err.code = code;
    if (path) {
        err.path = path;
    }
    if (dest) {
        err.dest = dest;
    }
    return captureLargerStackTrace(err);
});
export const exceptionWithHostPort = hideStackFrames(function exceptionWithHostPort(err, syscall, address, port, additional) {
    const code = getSystemErrorName(err);
    let details = "";
    if (port && port > 0) {
        details = ` ${address}:${port}`;
    }
    else if (address) {
        details = ` ${address}`;
    }
    if (additional) {
        details += ` - Local (${additional})`;
    }
    const ex = new Error(`${syscall} ${code}${details}`);
    ex.errno = err;
    ex.code = code;
    ex.syscall = syscall;
    ex.address = address;
    if (port) {
        ex.port = port;
    }
    return captureLargerStackTrace(ex);
});
export const dnsException = hideStackFrames(function (code, syscall, hostname) {
    let errno;
    if (typeof code === "number") {
        errno = code;
        if (code === codeMap.get("EAI_NODATA") ||
            code === codeMap.get("EAI_NONAME")) {
            code = "ENOTFOUND";
        }
        else {
            code = getSystemErrorName(code);
        }
    }
    const message = `${syscall} ${code}${hostname ? ` ${hostname}` : ""}`;
    const ex = new Error(message);
    ex.errno = errno;
    ex.code = code;
    ex.syscall = syscall;
    if (hostname) {
        ex.hostname = hostname;
    }
    return captureLargerStackTrace(ex);
});
export class NodeErrorAbstraction extends Error {
    code;
    constructor(name, code, message) {
        super(message);
        this.code = code;
        this.name = name;
        this.stack = this.stack && `${name} [${this.code}]${this.stack.slice(20)}`;
    }
    toString() {
        return `${this.name} [${this.code}]: ${this.message}`;
    }
}
export class NodeError extends NodeErrorAbstraction {
    constructor(code, message) {
        super(Error.prototype.name, code, message);
    }
}
export class NodeSyntaxError extends NodeErrorAbstraction {
    constructor(code, message) {
        super(SyntaxError.prototype.name, code, message);
        Object.setPrototypeOf(this, SyntaxError.prototype);
        this.toString = function () {
            return `${this.name} [${this.code}]: ${this.message}`;
        };
    }
}
export class NodeRangeError extends NodeErrorAbstraction {
    constructor(code, message) {
        super(RangeError.prototype.name, code, message);
        Object.setPrototypeOf(this, RangeError.prototype);
        this.toString = function () {
            return `${this.name} [${this.code}]: ${this.message}`;
        };
    }
}
export class NodeTypeError extends NodeErrorAbstraction {
    constructor(code, message) {
        super(TypeError.prototype.name, code, message);
        Object.setPrototypeOf(this, TypeError.prototype);
        this.toString = function () {
            return `${this.name} [${this.code}]: ${this.message}`;
        };
    }
}
export class NodeURIError extends NodeErrorAbstraction {
    constructor(code, message) {
        super(URIError.prototype.name, code, message);
        Object.setPrototypeOf(this, URIError.prototype);
        this.toString = function () {
            return `${this.name} [${this.code}]: ${this.message}`;
        };
    }
}
class NodeSystemError extends NodeErrorAbstraction {
    constructor(key, context, msgPrefix) {
        let message = `${msgPrefix}: ${context.syscall} returned ` +
            `${context.code} (${context.message})`;
        if (context.path !== undefined) {
            message += ` ${context.path}`;
        }
        if (context.dest !== undefined) {
            message += ` => ${context.dest}`;
        }
        super("SystemError", key, message);
        captureLargerStackTrace(this);
        Object.defineProperties(this, {
            [kIsNodeError]: {
                value: true,
                enumerable: false,
                writable: false,
                configurable: true,
            },
            info: {
                value: context,
                enumerable: true,
                configurable: true,
                writable: false,
            },
            errno: {
                get() {
                    return context.errno;
                },
                set: (value) => {
                    context.errno = value;
                },
                enumerable: true,
                configurable: true,
            },
            syscall: {
                get() {
                    return context.syscall;
                },
                set: (value) => {
                    context.syscall = value;
                },
                enumerable: true,
                configurable: true,
            },
        });
        if (context.path !== undefined) {
            Object.defineProperty(this, "path", {
                get() {
                    return context.path;
                },
                set: (value) => {
                    context.path = value;
                },
                enumerable: true,
                configurable: true,
            });
        }
        if (context.dest !== undefined) {
            Object.defineProperty(this, "dest", {
                get() {
                    return context.dest;
                },
                set: (value) => {
                    context.dest = value;
                },
                enumerable: true,
                configurable: true,
            });
        }
    }
    toString() {
        return `${this.name} [${this.code}]: ${this.message}`;
    }
}
function makeSystemErrorWithCode(key, msgPrfix) {
    return class NodeError extends NodeSystemError {
        constructor(ctx) {
            super(key, ctx, msgPrfix);
        }
    };
}
export const ERR_FS_EISDIR = makeSystemErrorWithCode("ERR_FS_EISDIR", "Path is a directory");
function createInvalidArgType(name, expected) {
    expected = Array.isArray(expected) ? expected : [expected];
    let msg = "The ";
    if (name.endsWith(" argument")) {
        msg += `${name} `;
    }
    else {
        const type = name.includes(".") ? "property" : "argument";
        msg += `"${name}" ${type} `;
    }
    msg += "must be ";
    const types = [];
    const instances = [];
    const other = [];
    for (const value of expected) {
        if (kTypes.includes(value)) {
            types.push(value.toLocaleLowerCase());
        }
        else if (classRegExp.test(value)) {
            instances.push(value);
        }
        else {
            other.push(value);
        }
    }
    if (instances.length > 0) {
        const pos = types.indexOf("object");
        if (pos !== -1) {
            types.splice(pos, 1);
            instances.push("Object");
        }
    }
    if (types.length > 0) {
        if (types.length > 2) {
            const last = types.pop();
            msg += `one of type ${types.join(", ")}, or ${last}`;
        }
        else if (types.length === 2) {
            msg += `one of type ${types[0]} or ${types[1]}`;
        }
        else {
            msg += `of type ${types[0]}`;
        }
        if (instances.length > 0 || other.length > 0) {
            msg += " or ";
        }
    }
    if (instances.length > 0) {
        if (instances.length > 2) {
            const last = instances.pop();
            msg += `an instance of ${instances.join(", ")}, or ${last}`;
        }
        else {
            msg += `an instance of ${instances[0]}`;
            if (instances.length === 2) {
                msg += ` or ${instances[1]}`;
            }
        }
        if (other.length > 0) {
            msg += " or ";
        }
    }
    if (other.length > 0) {
        if (other.length > 2) {
            const last = other.pop();
            msg += `one of ${other.join(", ")}, or ${last}`;
        }
        else if (other.length === 2) {
            msg += `one of ${other[0]} or ${other[1]}`;
        }
        else {
            if (other[0].toLowerCase() !== other[0]) {
                msg += "an ";
            }
            msg += `${other[0]}`;
        }
    }
    return msg;
}
export class ERR_INVALID_ARG_TYPE_RANGE extends NodeRangeError {
    constructor(name, expected, actual) {
        const msg = createInvalidArgType(name, expected);
        super("ERR_INVALID_ARG_TYPE", `${msg}.${invalidArgTypeHelper(actual)}`);
    }
}
export class ERR_INVALID_ARG_TYPE extends NodeTypeError {
    constructor(name, expected, actual) {
        const msg = createInvalidArgType(name, expected);
        super("ERR_INVALID_ARG_TYPE", `${msg}.${invalidArgTypeHelper(actual)}`);
    }
    static RangeError = ERR_INVALID_ARG_TYPE_RANGE;
}
class ERR_INVALID_ARG_VALUE_RANGE extends NodeRangeError {
    constructor(name, value, reason = "is invalid") {
        const type = name.includes(".") ? "property" : "argument";
        const inspected = inspect(value);
        super("ERR_INVALID_ARG_VALUE", `The ${type} '${name}' ${reason}. Received ${inspected}`);
    }
}
export class ERR_INVALID_ARG_VALUE extends NodeTypeError {
    constructor(name, value, reason = "is invalid") {
        const type = name.includes(".") ? "property" : "argument";
        const inspected = inspect(value);
        super("ERR_INVALID_ARG_VALUE", `The ${type} '${name}' ${reason}. Received ${inspected}`);
    }
    static RangeError = ERR_INVALID_ARG_VALUE_RANGE;
}
function invalidArgTypeHelper(input) {
    if (input == null) {
        return ` Received ${input}`;
    }
    if (typeof input === "function" && input.name) {
        return ` Received function ${input.name}`;
    }
    if (typeof input === "object") {
        if (input.constructor && input.constructor.name) {
            return ` Received an instance of ${input.constructor.name}`;
        }
        return ` Received ${inspect(input, { depth: -1 })}`;
    }
    let inspected = inspect(input, { colors: false });
    if (inspected.length > 25) {
        inspected = `${inspected.slice(0, 25)}...`;
    }
    return ` Received type ${typeof input} (${inspected})`;
}
export class ERR_OUT_OF_RANGE extends RangeError {
    code = "ERR_OUT_OF_RANGE";
    constructor(str, range, input, replaceDefaultBoolean = false) {
        assert(range, 'Missing "range" argument');
        let msg = replaceDefaultBoolean
            ? str
            : `The value of "${str}" is out of range.`;
        let received;
        if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
            received = addNumericalSeparator(String(input));
        }
        else if (typeof input === "bigint") {
            received = String(input);
            if (input > 2n ** 32n || input < -(2n ** 32n)) {
                received = addNumericalSeparator(received);
            }
            received += "n";
        }
        else {
            received = inspect(input);
        }
        msg += ` It must be ${range}. Received ${received}`;
        super(msg);
        const { name } = this;
        this.name = `${name} [${this.code}]`;
        this.stack;
        this.name = name;
    }
}
export class ERR_AMBIGUOUS_ARGUMENT extends NodeTypeError {
    constructor(x, y) {
        super("ERR_AMBIGUOUS_ARGUMENT", `The "${x}" argument is ambiguous. ${y}`);
    }
}
export class ERR_ARG_NOT_ITERABLE extends NodeTypeError {
    constructor(x) {
        super("ERR_ARG_NOT_ITERABLE", `${x} must be iterable`);
    }
}
export class ERR_ASSERTION extends NodeError {
    constructor(x) {
        super("ERR_ASSERTION", `${x}`);
    }
}
export class ERR_ASYNC_CALLBACK extends NodeTypeError {
    constructor(x) {
        super("ERR_ASYNC_CALLBACK", `${x} must be a function`);
    }
}
export class ERR_ASYNC_TYPE extends NodeTypeError {
    constructor(x) {
        super("ERR_ASYNC_TYPE", `Invalid name for async "type": ${x}`);
    }
}
export class ERR_BROTLI_INVALID_PARAM extends NodeRangeError {
    constructor(x) {
        super("ERR_BROTLI_INVALID_PARAM", `${x} is not a valid Brotli parameter`);
    }
}
export class ERR_BUFFER_OUT_OF_BOUNDS extends NodeRangeError {
    constructor(name) {
        super("ERR_BUFFER_OUT_OF_BOUNDS", name
            ? `"${name}" is outside of buffer bounds`
            : "Attempt to access memory outside buffer bounds");
    }
}
export class ERR_BUFFER_TOO_LARGE extends NodeRangeError {
    constructor(x) {
        super("ERR_BUFFER_TOO_LARGE", `Cannot create a Buffer larger than ${x} bytes`);
    }
}
export class ERR_CANNOT_WATCH_SIGINT extends NodeError {
    constructor() {
        super("ERR_CANNOT_WATCH_SIGINT", "Cannot watch for SIGINT signals");
    }
}
export class ERR_CHILD_CLOSED_BEFORE_REPLY extends NodeError {
    constructor() {
        super("ERR_CHILD_CLOSED_BEFORE_REPLY", "Child closed before reply received");
    }
}
export class ERR_CHILD_PROCESS_IPC_REQUIRED extends NodeError {
    constructor(x) {
        super("ERR_CHILD_PROCESS_IPC_REQUIRED", `Forked processes must have an IPC channel, missing value 'ipc' in ${x}`);
    }
}
export class ERR_CHILD_PROCESS_STDIO_MAXBUFFER extends NodeRangeError {
    constructor(x) {
        super("ERR_CHILD_PROCESS_STDIO_MAXBUFFER", `${x} maxBuffer length exceeded`);
    }
}
export class ERR_CONSOLE_WRITABLE_STREAM extends NodeTypeError {
    constructor(x) {
        super("ERR_CONSOLE_WRITABLE_STREAM", `Console expects a writable stream instance for ${x}`);
    }
}
export class ERR_CONTEXT_NOT_INITIALIZED extends NodeError {
    constructor() {
        super("ERR_CONTEXT_NOT_INITIALIZED", "context used is not initialized");
    }
}
export class ERR_CPU_USAGE extends NodeError {
    constructor(x) {
        super("ERR_CPU_USAGE", `Unable to obtain cpu usage ${x}`);
    }
}
export class ERR_CRYPTO_CUSTOM_ENGINE_NOT_SUPPORTED extends NodeError {
    constructor() {
        super("ERR_CRYPTO_CUSTOM_ENGINE_NOT_SUPPORTED", "Custom engines not supported by this OpenSSL");
    }
}
export class ERR_CRYPTO_ECDH_INVALID_FORMAT extends NodeTypeError {
    constructor(x) {
        super("ERR_CRYPTO_ECDH_INVALID_FORMAT", `Invalid ECDH format: ${x}`);
    }
}
export class ERR_CRYPTO_ECDH_INVALID_PUBLIC_KEY extends NodeError {
    constructor() {
        super("ERR_CRYPTO_ECDH_INVALID_PUBLIC_KEY", "Public key is not valid for specified curve");
    }
}
export class ERR_CRYPTO_ENGINE_UNKNOWN extends NodeError {
    constructor(x) {
        super("ERR_CRYPTO_ENGINE_UNKNOWN", `Engine "${x}" was not found`);
    }
}
export class ERR_CRYPTO_FIPS_FORCED extends NodeError {
    constructor() {
        super("ERR_CRYPTO_FIPS_FORCED", "Cannot set FIPS mode, it was forced with --force-fips at startup.");
    }
}
export class ERR_CRYPTO_FIPS_UNAVAILABLE extends NodeError {
    constructor() {
        super("ERR_CRYPTO_FIPS_UNAVAILABLE", "Cannot set FIPS mode in a non-FIPS build.");
    }
}
export class ERR_CRYPTO_HASH_FINALIZED extends NodeError {
    constructor() {
        super("ERR_CRYPTO_HASH_FINALIZED", "Digest already called");
    }
}
export class ERR_CRYPTO_HASH_UPDATE_FAILED extends NodeError {
    constructor() {
        super("ERR_CRYPTO_HASH_UPDATE_FAILED", "Hash update failed");
    }
}
export class ERR_CRYPTO_INCOMPATIBLE_KEY extends NodeError {
    constructor(x, y) {
        super("ERR_CRYPTO_INCOMPATIBLE_KEY", `Incompatible ${x}: ${y}`);
    }
}
export class ERR_CRYPTO_INCOMPATIBLE_KEY_OPTIONS extends NodeError {
    constructor(x, y) {
        super("ERR_CRYPTO_INCOMPATIBLE_KEY_OPTIONS", `The selected key encoding ${x} ${y}.`);
    }
}
export class ERR_CRYPTO_INVALID_DIGEST extends NodeTypeError {
    constructor(x) {
        super("ERR_CRYPTO_INVALID_DIGEST", `Invalid digest: ${x}`);
    }
}
export class ERR_CRYPTO_INVALID_KEY_OBJECT_TYPE extends NodeTypeError {
    constructor(x, y) {
        super("ERR_CRYPTO_INVALID_KEY_OBJECT_TYPE", `Invalid key object type ${x}, expected ${y}.`);
    }
}
export class ERR_CRYPTO_INVALID_STATE extends NodeError {
    constructor(x) {
        super("ERR_CRYPTO_INVALID_STATE", `Invalid state for operation ${x}`);
    }
}
export class ERR_CRYPTO_PBKDF2_ERROR extends NodeError {
    constructor() {
        super("ERR_CRYPTO_PBKDF2_ERROR", "PBKDF2 error");
    }
}
export class ERR_CRYPTO_SCRYPT_INVALID_PARAMETER extends NodeError {
    constructor() {
        super("ERR_CRYPTO_SCRYPT_INVALID_PARAMETER", "Invalid scrypt parameter");
    }
}
export class ERR_CRYPTO_SCRYPT_NOT_SUPPORTED extends NodeError {
    constructor() {
        super("ERR_CRYPTO_SCRYPT_NOT_SUPPORTED", "Scrypt algorithm not supported");
    }
}
export class ERR_CRYPTO_SIGN_KEY_REQUIRED extends NodeError {
    constructor() {
        super("ERR_CRYPTO_SIGN_KEY_REQUIRED", "No key provided to sign");
    }
}
export class ERR_DIR_CLOSED extends NodeError {
    constructor() {
        super("ERR_DIR_CLOSED", "Directory handle was closed");
    }
}
export class ERR_DIR_CONCURRENT_OPERATION extends NodeError {
    constructor() {
        super("ERR_DIR_CONCURRENT_OPERATION", "Cannot do synchronous work on directory handle with concurrent asynchronous operations");
    }
}
export class ERR_DNS_SET_SERVERS_FAILED extends NodeError {
    constructor(x, y) {
        super("ERR_DNS_SET_SERVERS_FAILED", `c-ares failed to set servers: "${x}" [${y}]`);
    }
}
export class ERR_DOMAIN_CALLBACK_NOT_AVAILABLE extends NodeError {
    constructor() {
        super("ERR_DOMAIN_CALLBACK_NOT_AVAILABLE", "A callback was registered through " +
            "process.setUncaughtExceptionCaptureCallback(), which is mutually " +
            "exclusive with using the `domain` module");
    }
}
export class ERR_DOMAIN_CANNOT_SET_UNCAUGHT_EXCEPTION_CAPTURE extends NodeError {
    constructor() {
        super("ERR_DOMAIN_CANNOT_SET_UNCAUGHT_EXCEPTION_CAPTURE", "The `domain` module is in use, which is mutually exclusive with calling " +
            "process.setUncaughtExceptionCaptureCallback()");
    }
}
export class ERR_ENCODING_INVALID_ENCODED_DATA extends NodeErrorAbstraction {
    errno;
    constructor(encoding, ret) {
        super(TypeError.prototype.name, "ERR_ENCODING_INVALID_ENCODED_DATA", `The encoded data was not valid for encoding ${encoding}`);
        Object.setPrototypeOf(this, TypeError.prototype);
        this.errno = ret;
    }
}
export class ERR_ENCODING_NOT_SUPPORTED extends NodeRangeError {
    constructor(x) {
        super("ERR_ENCODING_NOT_SUPPORTED", `The "${x}" encoding is not supported`);
    }
}
export class ERR_EVAL_ESM_CANNOT_PRINT extends NodeError {
    constructor() {
        super("ERR_EVAL_ESM_CANNOT_PRINT", `--print cannot be used with ESM input`);
    }
}
export class ERR_EVENT_RECURSION extends NodeError {
    constructor(x) {
        super("ERR_EVENT_RECURSION", `The event "${x}" is already being dispatched`);
    }
}
export class ERR_FEATURE_UNAVAILABLE_ON_PLATFORM extends NodeTypeError {
    constructor(x) {
        super("ERR_FEATURE_UNAVAILABLE_ON_PLATFORM", `The feature ${x} is unavailable on the current platform, which is being used to run Node.js`);
    }
}
export class ERR_FS_FILE_TOO_LARGE extends NodeRangeError {
    constructor(x) {
        super("ERR_FS_FILE_TOO_LARGE", `File size (${x}) is greater than 2 GB`);
    }
}
export class ERR_FS_INVALID_SYMLINK_TYPE extends NodeError {
    constructor(x) {
        super("ERR_FS_INVALID_SYMLINK_TYPE", `Symlink type must be one of "dir", "file", or "junction". Received "${x}"`);
    }
}
export class ERR_HTTP2_ALTSVC_INVALID_ORIGIN extends NodeTypeError {
    constructor() {
        super("ERR_HTTP2_ALTSVC_INVALID_ORIGIN", `HTTP/2 ALTSVC frames require a valid origin`);
    }
}
export class ERR_HTTP2_ALTSVC_LENGTH extends NodeTypeError {
    constructor() {
        super("ERR_HTTP2_ALTSVC_LENGTH", `HTTP/2 ALTSVC frames are limited to 16382 bytes`);
    }
}
export class ERR_HTTP2_CONNECT_AUTHORITY extends NodeError {
    constructor() {
        super("ERR_HTTP2_CONNECT_AUTHORITY", `:authority header is required for CONNECT requests`);
    }
}
export class ERR_HTTP2_CONNECT_PATH extends NodeError {
    constructor() {
        super("ERR_HTTP2_CONNECT_PATH", `The :path header is forbidden for CONNECT requests`);
    }
}
export class ERR_HTTP2_CONNECT_SCHEME extends NodeError {
    constructor() {
        super("ERR_HTTP2_CONNECT_SCHEME", `The :scheme header is forbidden for CONNECT requests`);
    }
}
export class ERR_HTTP2_GOAWAY_SESSION extends NodeError {
    constructor() {
        super("ERR_HTTP2_GOAWAY_SESSION", `New streams cannot be created after receiving a GOAWAY`);
    }
}
export class ERR_HTTP2_HEADERS_AFTER_RESPOND extends NodeError {
    constructor() {
        super("ERR_HTTP2_HEADERS_AFTER_RESPOND", `Cannot specify additional headers after response initiated`);
    }
}
export class ERR_HTTP2_HEADERS_SENT extends NodeError {
    constructor() {
        super("ERR_HTTP2_HEADERS_SENT", `Response has already been initiated.`);
    }
}
export class ERR_HTTP2_HEADER_SINGLE_VALUE extends NodeTypeError {
    constructor(x) {
        super("ERR_HTTP2_HEADER_SINGLE_VALUE", `Header field "${x}" must only have a single value`);
    }
}
export class ERR_HTTP2_INFO_STATUS_NOT_ALLOWED extends NodeRangeError {
    constructor() {
        super("ERR_HTTP2_INFO_STATUS_NOT_ALLOWED", `Informational status codes cannot be used`);
    }
}
export class ERR_HTTP2_INVALID_CONNECTION_HEADERS extends NodeTypeError {
    constructor(x) {
        super("ERR_HTTP2_INVALID_CONNECTION_HEADERS", `HTTP/1 Connection specific headers are forbidden: "${x}"`);
    }
}
export class ERR_HTTP2_INVALID_HEADER_VALUE extends NodeTypeError {
    constructor(x, y) {
        super("ERR_HTTP2_INVALID_HEADER_VALUE", `Invalid value "${x}" for header "${y}"`);
    }
}
export class ERR_HTTP2_INVALID_INFO_STATUS extends NodeRangeError {
    constructor(x) {
        super("ERR_HTTP2_INVALID_INFO_STATUS", `Invalid informational status code: ${x}`);
    }
}
export class ERR_HTTP2_INVALID_ORIGIN extends NodeTypeError {
    constructor() {
        super("ERR_HTTP2_INVALID_ORIGIN", `HTTP/2 ORIGIN frames require a valid origin`);
    }
}
export class ERR_HTTP2_INVALID_PACKED_SETTINGS_LENGTH extends NodeRangeError {
    constructor() {
        super("ERR_HTTP2_INVALID_PACKED_SETTINGS_LENGTH", `Packed settings length must be a multiple of six`);
    }
}
export class ERR_HTTP2_INVALID_PSEUDOHEADER extends NodeTypeError {
    constructor(x) {
        super("ERR_HTTP2_INVALID_PSEUDOHEADER", `"${x}" is an invalid pseudoheader or is used incorrectly`);
    }
}
export class ERR_HTTP2_INVALID_SESSION extends NodeError {
    constructor() {
        super("ERR_HTTP2_INVALID_SESSION", `The session has been destroyed`);
    }
}
export class ERR_HTTP2_INVALID_STREAM extends NodeError {
    constructor() {
        super("ERR_HTTP2_INVALID_STREAM", `The stream has been destroyed`);
    }
}
export class ERR_HTTP2_MAX_PENDING_SETTINGS_ACK extends NodeError {
    constructor() {
        super("ERR_HTTP2_MAX_PENDING_SETTINGS_ACK", `Maximum number of pending settings acknowledgements`);
    }
}
export class ERR_HTTP2_NESTED_PUSH extends NodeError {
    constructor() {
        super("ERR_HTTP2_NESTED_PUSH", `A push stream cannot initiate another push stream.`);
    }
}
export class ERR_HTTP2_NO_SOCKET_MANIPULATION extends NodeError {
    constructor() {
        super("ERR_HTTP2_NO_SOCKET_MANIPULATION", `HTTP/2 sockets should not be directly manipulated (e.g. read and written)`);
    }
}
export class ERR_HTTP2_ORIGIN_LENGTH extends NodeTypeError {
    constructor() {
        super("ERR_HTTP2_ORIGIN_LENGTH", `HTTP/2 ORIGIN frames are limited to 16382 bytes`);
    }
}
export class ERR_HTTP2_OUT_OF_STREAMS extends NodeError {
    constructor() {
        super("ERR_HTTP2_OUT_OF_STREAMS", `No stream ID is available because maximum stream ID has been reached`);
    }
}
export class ERR_HTTP2_PAYLOAD_FORBIDDEN extends NodeError {
    constructor(x) {
        super("ERR_HTTP2_PAYLOAD_FORBIDDEN", `Responses with ${x} status must not have a payload`);
    }
}
export class ERR_HTTP2_PING_CANCEL extends NodeError {
    constructor() {
        super("ERR_HTTP2_PING_CANCEL", `HTTP2 ping cancelled`);
    }
}
export class ERR_HTTP2_PING_LENGTH extends NodeRangeError {
    constructor() {
        super("ERR_HTTP2_PING_LENGTH", `HTTP2 ping payload must be 8 bytes`);
    }
}
export class ERR_HTTP2_PSEUDOHEADER_NOT_ALLOWED extends NodeTypeError {
    constructor() {
        super("ERR_HTTP2_PSEUDOHEADER_NOT_ALLOWED", `Cannot set HTTP/2 pseudo-headers`);
    }
}
export class ERR_HTTP2_PUSH_DISABLED extends NodeError {
    constructor() {
        super("ERR_HTTP2_PUSH_DISABLED", `HTTP/2 client has disabled push streams`);
    }
}
export class ERR_HTTP2_SEND_FILE extends NodeError {
    constructor() {
        super("ERR_HTTP2_SEND_FILE", `Directories cannot be sent`);
    }
}
export class ERR_HTTP2_SEND_FILE_NOSEEK extends NodeError {
    constructor() {
        super("ERR_HTTP2_SEND_FILE_NOSEEK", `Offset or length can only be specified for regular files`);
    }
}
export class ERR_HTTP2_SESSION_ERROR extends NodeError {
    constructor(x) {
        super("ERR_HTTP2_SESSION_ERROR", `Session closed with error code ${x}`);
    }
}
export class ERR_HTTP2_SETTINGS_CANCEL extends NodeError {
    constructor() {
        super("ERR_HTTP2_SETTINGS_CANCEL", `HTTP2 session settings canceled`);
    }
}
export class ERR_HTTP2_SOCKET_BOUND extends NodeError {
    constructor() {
        super("ERR_HTTP2_SOCKET_BOUND", `The socket is already bound to an Http2Session`);
    }
}
export class ERR_HTTP2_SOCKET_UNBOUND extends NodeError {
    constructor() {
        super("ERR_HTTP2_SOCKET_UNBOUND", `The socket has been disconnected from the Http2Session`);
    }
}
export class ERR_HTTP2_STATUS_101 extends NodeError {
    constructor() {
        super("ERR_HTTP2_STATUS_101", `HTTP status code 101 (Switching Protocols) is forbidden in HTTP/2`);
    }
}
export class ERR_HTTP2_STATUS_INVALID extends NodeRangeError {
    constructor(x) {
        super("ERR_HTTP2_STATUS_INVALID", `Invalid status code: ${x}`);
    }
}
export class ERR_HTTP2_STREAM_ERROR extends NodeError {
    constructor(x) {
        super("ERR_HTTP2_STREAM_ERROR", `Stream closed with error code ${x}`);
    }
}
export class ERR_HTTP2_STREAM_SELF_DEPENDENCY extends NodeError {
    constructor() {
        super("ERR_HTTP2_STREAM_SELF_DEPENDENCY", `A stream cannot depend on itself`);
    }
}
export class ERR_HTTP2_TRAILERS_ALREADY_SENT extends NodeError {
    constructor() {
        super("ERR_HTTP2_TRAILERS_ALREADY_SENT", `Trailing headers have already been sent`);
    }
}
export class ERR_HTTP2_TRAILERS_NOT_READY extends NodeError {
    constructor() {
        super("ERR_HTTP2_TRAILERS_NOT_READY", `Trailing headers cannot be sent until after the wantTrailers event is emitted`);
    }
}
export class ERR_HTTP2_UNSUPPORTED_PROTOCOL extends NodeError {
    constructor(x) {
        super("ERR_HTTP2_UNSUPPORTED_PROTOCOL", `protocol "${x}" is unsupported.`);
    }
}
export class ERR_HTTP_HEADERS_SENT extends NodeError {
    constructor(x) {
        super("ERR_HTTP_HEADERS_SENT", `Cannot ${x} headers after they are sent to the client`);
    }
}
export class ERR_HTTP_INVALID_HEADER_VALUE extends NodeTypeError {
    constructor(x, y) {
        super("ERR_HTTP_INVALID_HEADER_VALUE", `Invalid value "${x}" for header "${y}"`);
    }
}
export class ERR_HTTP_INVALID_STATUS_CODE extends NodeRangeError {
    constructor(x) {
        super("ERR_HTTP_INVALID_STATUS_CODE", `Invalid status code: ${x}`);
    }
}
export class ERR_HTTP_SOCKET_ENCODING extends NodeError {
    constructor() {
        super("ERR_HTTP_SOCKET_ENCODING", `Changing the socket encoding is not allowed per RFC7230 Section 3.`);
    }
}
export class ERR_HTTP_TRAILER_INVALID extends NodeError {
    constructor() {
        super("ERR_HTTP_TRAILER_INVALID", `Trailers are invalid with this transfer encoding`);
    }
}
export class ERR_INCOMPATIBLE_OPTION_PAIR extends NodeTypeError {
    constructor(x, y) {
        super("ERR_INCOMPATIBLE_OPTION_PAIR", `Option "${x}" cannot be used in combination with option "${y}"`);
    }
}
export class ERR_INPUT_TYPE_NOT_ALLOWED extends NodeError {
    constructor() {
        super("ERR_INPUT_TYPE_NOT_ALLOWED", `--input-type can only be used with string input via --eval, --print, or STDIN`);
    }
}
export class ERR_INSPECTOR_ALREADY_ACTIVATED extends NodeError {
    constructor() {
        super("ERR_INSPECTOR_ALREADY_ACTIVATED", `Inspector is already activated. Close it with inspector.close() before activating it again.`);
    }
}
export class ERR_INSPECTOR_ALREADY_CONNECTED extends NodeError {
    constructor(x) {
        super("ERR_INSPECTOR_ALREADY_CONNECTED", `${x} is already connected`);
    }
}
export class ERR_INSPECTOR_CLOSED extends NodeError {
    constructor() {
        super("ERR_INSPECTOR_CLOSED", `Session was closed`);
    }
}
export class ERR_INSPECTOR_COMMAND extends NodeError {
    constructor(x, y) {
        super("ERR_INSPECTOR_COMMAND", `Inspector error ${x}: ${y}`);
    }
}
export class ERR_INSPECTOR_NOT_ACTIVE extends NodeError {
    constructor() {
        super("ERR_INSPECTOR_NOT_ACTIVE", `Inspector is not active`);
    }
}
export class ERR_INSPECTOR_NOT_AVAILABLE extends NodeError {
    constructor() {
        super("ERR_INSPECTOR_NOT_AVAILABLE", `Inspector is not available`);
    }
}
export class ERR_INSPECTOR_NOT_CONNECTED extends NodeError {
    constructor() {
        super("ERR_INSPECTOR_NOT_CONNECTED", `Session is not connected`);
    }
}
export class ERR_INSPECTOR_NOT_WORKER extends NodeError {
    constructor() {
        super("ERR_INSPECTOR_NOT_WORKER", `Current thread is not a worker`);
    }
}
export class ERR_INVALID_ASYNC_ID extends NodeRangeError {
    constructor(x, y) {
        super("ERR_INVALID_ASYNC_ID", `Invalid ${x} value: ${y}`);
    }
}
export class ERR_INVALID_BUFFER_SIZE extends NodeRangeError {
    constructor(x) {
        super("ERR_INVALID_BUFFER_SIZE", `Buffer size must be a multiple of ${x}`);
    }
}
export class ERR_INVALID_CALLBACK extends NodeTypeError {
    constructor(object) {
        super("ERR_INVALID_CALLBACK", `Callback must be a function. Received ${inspect(object)}`);
    }
}
export class ERR_INVALID_CURSOR_POS extends NodeTypeError {
    constructor() {
        super("ERR_INVALID_CURSOR_POS", `Cannot set cursor row without setting its column`);
    }
}
export class ERR_INVALID_FD extends NodeRangeError {
    constructor(x) {
        super("ERR_INVALID_FD", `"fd" must be a positive integer: ${x}`);
    }
}
export class ERR_INVALID_FD_TYPE extends NodeTypeError {
    constructor(x) {
        super("ERR_INVALID_FD_TYPE", `Unsupported fd type: ${x}`);
    }
}
export class ERR_INVALID_FILE_URL_HOST extends NodeTypeError {
    constructor(x) {
        super("ERR_INVALID_FILE_URL_HOST", `File URL host must be "localhost" or empty on ${x}`);
    }
}
export class ERR_INVALID_FILE_URL_PATH extends NodeTypeError {
    constructor(x) {
        super("ERR_INVALID_FILE_URL_PATH", `File URL path ${x}`);
    }
}
export class ERR_INVALID_HANDLE_TYPE extends NodeTypeError {
    constructor() {
        super("ERR_INVALID_HANDLE_TYPE", `This handle type cannot be sent`);
    }
}
export class ERR_INVALID_HTTP_TOKEN extends NodeTypeError {
    constructor(x, y) {
        super("ERR_INVALID_HTTP_TOKEN", `${x} must be a valid HTTP token ["${y}"]`);
    }
}
export class ERR_INVALID_IP_ADDRESS extends NodeTypeError {
    constructor(x) {
        super("ERR_INVALID_IP_ADDRESS", `Invalid IP address: ${x}`);
    }
}
export class ERR_INVALID_OPT_VALUE_ENCODING extends NodeTypeError {
    constructor(x) {
        super("ERR_INVALID_OPT_VALUE_ENCODING", `The value "${x}" is invalid for option "encoding"`);
    }
}
export class ERR_INVALID_PERFORMANCE_MARK extends NodeError {
    constructor(x) {
        super("ERR_INVALID_PERFORMANCE_MARK", `The "${x}" performance mark has not been set`);
    }
}
export class ERR_INVALID_PROTOCOL extends NodeTypeError {
    constructor(x, y) {
        super("ERR_INVALID_PROTOCOL", `Protocol "${x}" not supported. Expected "${y}"`);
    }
}
export class ERR_INVALID_REPL_EVAL_CONFIG extends NodeTypeError {
    constructor() {
        super("ERR_INVALID_REPL_EVAL_CONFIG", `Cannot specify both "breakEvalOnSigint" and "eval" for REPL`);
    }
}
export class ERR_INVALID_REPL_INPUT extends NodeTypeError {
    constructor(x) {
        super("ERR_INVALID_REPL_INPUT", `${x}`);
    }
}
export class ERR_INVALID_SYNC_FORK_INPUT extends NodeTypeError {
    constructor(x) {
        super("ERR_INVALID_SYNC_FORK_INPUT", `Asynchronous forks do not support Buffer, TypedArray, DataView or string input: ${x}`);
    }
}
export class ERR_INVALID_THIS extends NodeTypeError {
    constructor(x) {
        super("ERR_INVALID_THIS", `Value of "this" must be of type ${x}`);
    }
}
export class ERR_INVALID_TUPLE extends NodeTypeError {
    constructor(x, y) {
        super("ERR_INVALID_TUPLE", `${x} must be an iterable ${y} tuple`);
    }
}
export class ERR_INVALID_URI extends NodeURIError {
    constructor() {
        super("ERR_INVALID_URI", `URI malformed`);
    }
}
export class ERR_IPC_CHANNEL_CLOSED extends NodeError {
    constructor() {
        super("ERR_IPC_CHANNEL_CLOSED", `Channel closed`);
    }
}
export class ERR_IPC_DISCONNECTED extends NodeError {
    constructor() {
        super("ERR_IPC_DISCONNECTED", `IPC channel is already disconnected`);
    }
}
export class ERR_IPC_ONE_PIPE extends NodeError {
    constructor() {
        super("ERR_IPC_ONE_PIPE", `Child process can have only one IPC pipe`);
    }
}
export class ERR_IPC_SYNC_FORK extends NodeError {
    constructor() {
        super("ERR_IPC_SYNC_FORK", `IPC cannot be used with synchronous forks`);
    }
}
export class ERR_MANIFEST_DEPENDENCY_MISSING extends NodeError {
    constructor(x, y) {
        super("ERR_MANIFEST_DEPENDENCY_MISSING", `Manifest resource ${x} does not list ${y} as a dependency specifier`);
    }
}
export class ERR_MANIFEST_INTEGRITY_MISMATCH extends NodeSyntaxError {
    constructor(x) {
        super("ERR_MANIFEST_INTEGRITY_MISMATCH", `Manifest resource ${x} has multiple entries but integrity lists do not match`);
    }
}
export class ERR_MANIFEST_INVALID_RESOURCE_FIELD extends NodeTypeError {
    constructor(x, y) {
        super("ERR_MANIFEST_INVALID_RESOURCE_FIELD", `Manifest resource ${x} has invalid property value for ${y}`);
    }
}
export class ERR_MANIFEST_TDZ extends NodeError {
    constructor() {
        super("ERR_MANIFEST_TDZ", `Manifest initialization has not yet run`);
    }
}
export class ERR_MANIFEST_UNKNOWN_ONERROR extends NodeSyntaxError {
    constructor(x) {
        super("ERR_MANIFEST_UNKNOWN_ONERROR", `Manifest specified unknown error behavior "${x}".`);
    }
}
export class ERR_METHOD_NOT_IMPLEMENTED extends NodeError {
    constructor(x) {
        super("ERR_METHOD_NOT_IMPLEMENTED", `The ${x} method is not implemented`);
    }
}
export class ERR_MISSING_ARGS extends NodeTypeError {
    constructor(...args) {
        let msg = "The ";
        const len = args.length;
        const wrap = (a) => `"${a}"`;
        args = args.map((a) => Array.isArray(a) ? a.map(wrap).join(" or ") : wrap(a));
        switch (len) {
            case 1:
                msg += `${args[0]} argument`;
                break;
            case 2:
                msg += `${args[0]} and ${args[1]} arguments`;
                break;
            default:
                msg += args.slice(0, len - 1).join(", ");
                msg += `, and ${args[len - 1]} arguments`;
                break;
        }
        super("ERR_MISSING_ARGS", `${msg} must be specified`);
    }
}
export class ERR_MISSING_OPTION extends NodeTypeError {
    constructor(x) {
        super("ERR_MISSING_OPTION", `${x} is required`);
    }
}
export class ERR_MULTIPLE_CALLBACK extends NodeError {
    constructor() {
        super("ERR_MULTIPLE_CALLBACK", `Callback called multiple times`);
    }
}
export class ERR_NAPI_CONS_FUNCTION extends NodeTypeError {
    constructor() {
        super("ERR_NAPI_CONS_FUNCTION", `Constructor must be a function`);
    }
}
export class ERR_NAPI_INVALID_DATAVIEW_ARGS extends NodeRangeError {
    constructor() {
        super("ERR_NAPI_INVALID_DATAVIEW_ARGS", `byte_offset + byte_length should be less than or equal to the size in bytes of the array passed in`);
    }
}
export class ERR_NAPI_INVALID_TYPEDARRAY_ALIGNMENT extends NodeRangeError {
    constructor(x, y) {
        super("ERR_NAPI_INVALID_TYPEDARRAY_ALIGNMENT", `start offset of ${x} should be a multiple of ${y}`);
    }
}
export class ERR_NAPI_INVALID_TYPEDARRAY_LENGTH extends NodeRangeError {
    constructor() {
        super("ERR_NAPI_INVALID_TYPEDARRAY_LENGTH", `Invalid typed array length`);
    }
}
export class ERR_NO_CRYPTO extends NodeError {
    constructor() {
        super("ERR_NO_CRYPTO", `Node.js is not compiled with OpenSSL crypto support`);
    }
}
export class ERR_NO_ICU extends NodeTypeError {
    constructor(x) {
        super("ERR_NO_ICU", `${x} is not supported on Node.js compiled without ICU`);
    }
}
export class ERR_QUICCLIENTSESSION_FAILED extends NodeError {
    constructor(x) {
        super("ERR_QUICCLIENTSESSION_FAILED", `Failed to create a new QuicClientSession: ${x}`);
    }
}
export class ERR_QUICCLIENTSESSION_FAILED_SETSOCKET extends NodeError {
    constructor() {
        super("ERR_QUICCLIENTSESSION_FAILED_SETSOCKET", `Failed to set the QuicSocket`);
    }
}
export class ERR_QUICSESSION_DESTROYED extends NodeError {
    constructor(x) {
        super("ERR_QUICSESSION_DESTROYED", `Cannot call ${x} after a QuicSession has been destroyed`);
    }
}
export class ERR_QUICSESSION_INVALID_DCID extends NodeError {
    constructor(x) {
        super("ERR_QUICSESSION_INVALID_DCID", `Invalid DCID value: ${x}`);
    }
}
export class ERR_QUICSESSION_UPDATEKEY extends NodeError {
    constructor() {
        super("ERR_QUICSESSION_UPDATEKEY", `Unable to update QuicSession keys`);
    }
}
export class ERR_QUICSOCKET_DESTROYED extends NodeError {
    constructor(x) {
        super("ERR_QUICSOCKET_DESTROYED", `Cannot call ${x} after a QuicSocket has been destroyed`);
    }
}
export class ERR_QUICSOCKET_INVALID_STATELESS_RESET_SECRET_LENGTH extends NodeError {
    constructor() {
        super("ERR_QUICSOCKET_INVALID_STATELESS_RESET_SECRET_LENGTH", `The stateResetToken must be exactly 16-bytes in length`);
    }
}
export class ERR_QUICSOCKET_LISTENING extends NodeError {
    constructor() {
        super("ERR_QUICSOCKET_LISTENING", `This QuicSocket is already listening`);
    }
}
export class ERR_QUICSOCKET_UNBOUND extends NodeError {
    constructor(x) {
        super("ERR_QUICSOCKET_UNBOUND", `Cannot call ${x} before a QuicSocket has been bound`);
    }
}
export class ERR_QUICSTREAM_DESTROYED extends NodeError {
    constructor(x) {
        super("ERR_QUICSTREAM_DESTROYED", `Cannot call ${x} after a QuicStream has been destroyed`);
    }
}
export class ERR_QUICSTREAM_INVALID_PUSH extends NodeError {
    constructor() {
        super("ERR_QUICSTREAM_INVALID_PUSH", `Push streams are only supported on client-initiated, bidirectional streams`);
    }
}
export class ERR_QUICSTREAM_OPEN_FAILED extends NodeError {
    constructor() {
        super("ERR_QUICSTREAM_OPEN_FAILED", `Opening a new QuicStream failed`);
    }
}
export class ERR_QUICSTREAM_UNSUPPORTED_PUSH extends NodeError {
    constructor() {
        super("ERR_QUICSTREAM_UNSUPPORTED_PUSH", `Push streams are not supported on this QuicSession`);
    }
}
export class ERR_QUIC_TLS13_REQUIRED extends NodeError {
    constructor() {
        super("ERR_QUIC_TLS13_REQUIRED", `QUIC requires TLS version 1.3`);
    }
}
export class ERR_SCRIPT_EXECUTION_INTERRUPTED extends NodeError {
    constructor() {
        super("ERR_SCRIPT_EXECUTION_INTERRUPTED", "Script execution was interrupted by `SIGINT`");
    }
}
export class ERR_SERVER_ALREADY_LISTEN extends NodeError {
    constructor() {
        super("ERR_SERVER_ALREADY_LISTEN", `Listen method has been called more than once without closing.`);
    }
}
export class ERR_SERVER_NOT_RUNNING extends NodeError {
    constructor() {
        super("ERR_SERVER_NOT_RUNNING", `Server is not running.`);
    }
}
export class ERR_SOCKET_ALREADY_BOUND extends NodeError {
    constructor() {
        super("ERR_SOCKET_ALREADY_BOUND", `Socket is already bound`);
    }
}
export class ERR_SOCKET_BAD_BUFFER_SIZE extends NodeTypeError {
    constructor() {
        super("ERR_SOCKET_BAD_BUFFER_SIZE", `Buffer size must be a positive integer`);
    }
}
export class ERR_SOCKET_BAD_PORT extends NodeRangeError {
    constructor(name, port, allowZero = true) {
        assert(typeof allowZero === "boolean", "The 'allowZero' argument must be of type boolean.");
        const operator = allowZero ? ">=" : ">";
        super("ERR_SOCKET_BAD_PORT", `${name} should be ${operator} 0 and < 65536. Received ${port}.`);
    }
}
export class ERR_SOCKET_BAD_TYPE extends NodeTypeError {
    constructor() {
        super("ERR_SOCKET_BAD_TYPE", `Bad socket type specified. Valid types are: udp4, udp6`);
    }
}
export class ERR_SOCKET_CLOSED extends NodeError {
    constructor() {
        super("ERR_SOCKET_CLOSED", `Socket is closed`);
    }
}
export class ERR_SOCKET_DGRAM_IS_CONNECTED extends NodeError {
    constructor() {
        super("ERR_SOCKET_DGRAM_IS_CONNECTED", `Already connected`);
    }
}
export class ERR_SOCKET_DGRAM_NOT_CONNECTED extends NodeError {
    constructor() {
        super("ERR_SOCKET_DGRAM_NOT_CONNECTED", `Not connected`);
    }
}
export class ERR_SOCKET_DGRAM_NOT_RUNNING extends NodeError {
    constructor() {
        super("ERR_SOCKET_DGRAM_NOT_RUNNING", `Not running`);
    }
}
export class ERR_SRI_PARSE extends NodeSyntaxError {
    constructor(name, char, position) {
        super("ERR_SRI_PARSE", `Subresource Integrity string ${name} had an unexpected ${char} at position ${position}`);
    }
}
export class ERR_STREAM_ALREADY_FINISHED extends NodeError {
    constructor(x) {
        super("ERR_STREAM_ALREADY_FINISHED", `Cannot call ${x} after a stream was finished`);
    }
}
export class ERR_STREAM_CANNOT_PIPE extends NodeError {
    constructor() {
        super("ERR_STREAM_CANNOT_PIPE", `Cannot pipe, not readable`);
    }
}
export class ERR_STREAM_DESTROYED extends NodeError {
    constructor(x) {
        super("ERR_STREAM_DESTROYED", `Cannot call ${x} after a stream was destroyed`);
    }
}
export class ERR_STREAM_NULL_VALUES extends NodeTypeError {
    constructor() {
        super("ERR_STREAM_NULL_VALUES", `May not write null values to stream`);
    }
}
export class ERR_STREAM_PREMATURE_CLOSE extends NodeError {
    constructor() {
        super("ERR_STREAM_PREMATURE_CLOSE", `Premature close`);
    }
}
export class ERR_STREAM_PUSH_AFTER_EOF extends NodeError {
    constructor() {
        super("ERR_STREAM_PUSH_AFTER_EOF", `stream.push() after EOF`);
    }
}
export class ERR_STREAM_UNSHIFT_AFTER_END_EVENT extends NodeError {
    constructor() {
        super("ERR_STREAM_UNSHIFT_AFTER_END_EVENT", `stream.unshift() after end event`);
    }
}
export class ERR_STREAM_WRAP extends NodeError {
    constructor() {
        super("ERR_STREAM_WRAP", `Stream has StringDecoder set or is in objectMode`);
    }
}
export class ERR_STREAM_WRITE_AFTER_END extends NodeError {
    constructor() {
        super("ERR_STREAM_WRITE_AFTER_END", `write after end`);
    }
}
export class ERR_SYNTHETIC extends NodeError {
    constructor() {
        super("ERR_SYNTHETIC", `JavaScript Callstack`);
    }
}
export class ERR_TLS_CERT_ALTNAME_INVALID extends NodeError {
    reason;
    host;
    cert;
    constructor(reason, host, cert) {
        super("ERR_TLS_CERT_ALTNAME_INVALID", `Hostname/IP does not match certificate's altnames: ${reason}`);
        this.reason = reason;
        this.host = host;
        this.cert = cert;
    }
}
export class ERR_TLS_DH_PARAM_SIZE extends NodeError {
    constructor(x) {
        super("ERR_TLS_DH_PARAM_SIZE", `DH parameter size ${x} is less than 2048`);
    }
}
export class ERR_TLS_HANDSHAKE_TIMEOUT extends NodeError {
    constructor() {
        super("ERR_TLS_HANDSHAKE_TIMEOUT", `TLS handshake timeout`);
    }
}
export class ERR_TLS_INVALID_CONTEXT extends NodeTypeError {
    constructor(x) {
        super("ERR_TLS_INVALID_CONTEXT", `${x} must be a SecureContext`);
    }
}
export class ERR_TLS_INVALID_STATE extends NodeError {
    constructor() {
        super("ERR_TLS_INVALID_STATE", `TLS socket connection must be securely established`);
    }
}
export class ERR_TLS_INVALID_PROTOCOL_VERSION extends NodeTypeError {
    constructor(protocol, x) {
        super("ERR_TLS_INVALID_PROTOCOL_VERSION", `${protocol} is not a valid ${x} TLS protocol version`);
    }
}
export class ERR_TLS_PROTOCOL_VERSION_CONFLICT extends NodeTypeError {
    constructor(prevProtocol, protocol) {
        super("ERR_TLS_PROTOCOL_VERSION_CONFLICT", `TLS protocol version ${prevProtocol} conflicts with secureProtocol ${protocol}`);
    }
}
export class ERR_TLS_RENEGOTIATION_DISABLED extends NodeError {
    constructor() {
        super("ERR_TLS_RENEGOTIATION_DISABLED", `TLS session renegotiation disabled for this socket`);
    }
}
export class ERR_TLS_REQUIRED_SERVER_NAME extends NodeError {
    constructor() {
        super("ERR_TLS_REQUIRED_SERVER_NAME", `"servername" is required parameter for Server.addContext`);
    }
}
export class ERR_TLS_SESSION_ATTACK extends NodeError {
    constructor() {
        super("ERR_TLS_SESSION_ATTACK", `TLS session renegotiation attack detected`);
    }
}
export class ERR_TLS_SNI_FROM_SERVER extends NodeError {
    constructor() {
        super("ERR_TLS_SNI_FROM_SERVER", `Cannot issue SNI from a TLS server-side socket`);
    }
}
export class ERR_TRACE_EVENTS_CATEGORY_REQUIRED extends NodeTypeError {
    constructor() {
        super("ERR_TRACE_EVENTS_CATEGORY_REQUIRED", `At least one category is required`);
    }
}
export class ERR_TRACE_EVENTS_UNAVAILABLE extends NodeError {
    constructor() {
        super("ERR_TRACE_EVENTS_UNAVAILABLE", `Trace events are unavailable`);
    }
}
export class ERR_UNAVAILABLE_DURING_EXIT extends NodeError {
    constructor() {
        super("ERR_UNAVAILABLE_DURING_EXIT", `Cannot call function in process exit handler`);
    }
}
export class ERR_UNCAUGHT_EXCEPTION_CAPTURE_ALREADY_SET extends NodeError {
    constructor() {
        super("ERR_UNCAUGHT_EXCEPTION_CAPTURE_ALREADY_SET", "`process.setupUncaughtExceptionCapture()` was called while a capture callback was already active");
    }
}
export class ERR_UNESCAPED_CHARACTERS extends NodeTypeError {
    constructor(x) {
        super("ERR_UNESCAPED_CHARACTERS", `${x} contains unescaped characters`);
    }
}
export class ERR_UNHANDLED_ERROR extends NodeError {
    constructor(x) {
        super("ERR_UNHANDLED_ERROR", `Unhandled error. (${x})`);
    }
}
export class ERR_UNKNOWN_BUILTIN_MODULE extends NodeError {
    constructor(x) {
        super("ERR_UNKNOWN_BUILTIN_MODULE", `No such built-in module: ${x}`);
    }
}
export class ERR_UNKNOWN_CREDENTIAL extends NodeError {
    constructor(x, y) {
        super("ERR_UNKNOWN_CREDENTIAL", `${x} identifier does not exist: ${y}`);
    }
}
export class ERR_UNKNOWN_ENCODING extends NodeTypeError {
    constructor(x) {
        super("ERR_UNKNOWN_ENCODING", `Unknown encoding: ${x}`);
    }
}
export class ERR_UNKNOWN_FILE_EXTENSION extends NodeTypeError {
    constructor(x, y) {
        super("ERR_UNKNOWN_FILE_EXTENSION", `Unknown file extension "${x}" for ${y}`);
    }
}
export class ERR_UNKNOWN_MODULE_FORMAT extends NodeRangeError {
    constructor(x) {
        super("ERR_UNKNOWN_MODULE_FORMAT", `Unknown module format: ${x}`);
    }
}
export class ERR_UNKNOWN_SIGNAL extends NodeTypeError {
    constructor(x) {
        super("ERR_UNKNOWN_SIGNAL", `Unknown signal: ${x}`);
    }
}
export class ERR_UNSUPPORTED_DIR_IMPORT extends NodeError {
    constructor(x, y) {
        super("ERR_UNSUPPORTED_DIR_IMPORT", `Directory import '${x}' is not supported resolving ES modules, imported from ${y}`);
    }
}
export class ERR_UNSUPPORTED_ESM_URL_SCHEME extends NodeError {
    constructor() {
        super("ERR_UNSUPPORTED_ESM_URL_SCHEME", `Only file and data URLs are supported by the default ESM loader`);
    }
}
export class ERR_V8BREAKITERATOR extends NodeError {
    constructor() {
        super("ERR_V8BREAKITERATOR", `Full ICU data not installed. See https://github.com/nodejs/node/wiki/Intl`);
    }
}
export class ERR_VALID_PERFORMANCE_ENTRY_TYPE extends NodeError {
    constructor() {
        super("ERR_VALID_PERFORMANCE_ENTRY_TYPE", `At least one valid performance entry type is required`);
    }
}
export class ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING extends NodeTypeError {
    constructor() {
        super("ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING", `A dynamic import callback was not specified.`);
    }
}
export class ERR_VM_MODULE_ALREADY_LINKED extends NodeError {
    constructor() {
        super("ERR_VM_MODULE_ALREADY_LINKED", `Module has already been linked`);
    }
}
export class ERR_VM_MODULE_CANNOT_CREATE_CACHED_DATA extends NodeError {
    constructor() {
        super("ERR_VM_MODULE_CANNOT_CREATE_CACHED_DATA", `Cached data cannot be created for a module which has been evaluated`);
    }
}
export class ERR_VM_MODULE_DIFFERENT_CONTEXT extends NodeError {
    constructor() {
        super("ERR_VM_MODULE_DIFFERENT_CONTEXT", `Linked modules must use the same context`);
    }
}
export class ERR_VM_MODULE_LINKING_ERRORED extends NodeError {
    constructor() {
        super("ERR_VM_MODULE_LINKING_ERRORED", `Linking has already failed for the provided module`);
    }
}
export class ERR_VM_MODULE_NOT_MODULE extends NodeError {
    constructor() {
        super("ERR_VM_MODULE_NOT_MODULE", `Provided module is not an instance of Module`);
    }
}
export class ERR_VM_MODULE_STATUS extends NodeError {
    constructor(x) {
        super("ERR_VM_MODULE_STATUS", `Module status ${x}`);
    }
}
export class ERR_WASI_ALREADY_STARTED extends NodeError {
    constructor() {
        super("ERR_WASI_ALREADY_STARTED", `WASI instance has already started`);
    }
}
export class ERR_WORKER_INIT_FAILED extends NodeError {
    constructor(x) {
        super("ERR_WORKER_INIT_FAILED", `Worker initialization failure: ${x}`);
    }
}
export class ERR_WORKER_NOT_RUNNING extends NodeError {
    constructor() {
        super("ERR_WORKER_NOT_RUNNING", `Worker instance not running`);
    }
}
export class ERR_WORKER_OUT_OF_MEMORY extends NodeError {
    constructor(x) {
        super("ERR_WORKER_OUT_OF_MEMORY", `Worker terminated due to reaching memory limit: ${x}`);
    }
}
export class ERR_WORKER_UNSERIALIZABLE_ERROR extends NodeError {
    constructor() {
        super("ERR_WORKER_UNSERIALIZABLE_ERROR", `Serializing an uncaught exception failed`);
    }
}
export class ERR_WORKER_UNSUPPORTED_EXTENSION extends NodeTypeError {
    constructor(x) {
        super("ERR_WORKER_UNSUPPORTED_EXTENSION", `The worker script extension must be ".js", ".mjs", or ".cjs". Received "${x}"`);
    }
}
export class ERR_WORKER_UNSUPPORTED_OPERATION extends NodeTypeError {
    constructor(x) {
        super("ERR_WORKER_UNSUPPORTED_OPERATION", `${x} is not supported in workers`);
    }
}
export class ERR_ZLIB_INITIALIZATION_FAILED extends NodeError {
    constructor() {
        super("ERR_ZLIB_INITIALIZATION_FAILED", `Initialization failed`);
    }
}
export class ERR_FALSY_VALUE_REJECTION extends NodeError {
    reason;
    constructor(reason) {
        super("ERR_FALSY_VALUE_REJECTION", "Promise was rejected with falsy value");
        this.reason = reason;
    }
}
export class ERR_HTTP2_INVALID_SETTING_VALUE extends NodeRangeError {
    actual;
    min;
    max;
    constructor(name, actual, min, max) {
        super("ERR_HTTP2_INVALID_SETTING_VALUE", `Invalid value for setting "${name}": ${actual}`);
        this.actual = actual;
        if (min !== undefined) {
            this.min = min;
            this.max = max;
        }
    }
}
export class ERR_HTTP2_STREAM_CANCEL extends NodeError {
    cause;
    constructor(error) {
        super("ERR_HTTP2_STREAM_CANCEL", typeof error.message === "string"
            ? `The pending stream has been canceled (caused by: ${error.message})`
            : "The pending stream has been canceled");
        if (error) {
            this.cause = error;
        }
    }
}
export class ERR_INVALID_ADDRESS_FAMILY extends NodeRangeError {
    host;
    port;
    constructor(addressType, host, port) {
        super("ERR_INVALID_ADDRESS_FAMILY", `Invalid address family: ${addressType} ${host}:${port}`);
        this.host = host;
        this.port = port;
    }
}
export class ERR_INVALID_CHAR extends NodeTypeError {
    constructor(name, field) {
        super("ERR_INVALID_CHAR", field
            ? `Invalid character in ${name}`
            : `Invalid character in ${name} ["${field}"]`);
    }
}
export class ERR_INVALID_OPT_VALUE extends NodeTypeError {
    constructor(name, value) {
        super("ERR_INVALID_OPT_VALUE", `The value "${value}" is invalid for option "${name}"`);
    }
}
export class ERR_INVALID_RETURN_PROPERTY extends NodeTypeError {
    constructor(input, name, prop, value) {
        super("ERR_INVALID_RETURN_PROPERTY", `Expected a valid ${input} to be returned for the "${prop}" from the "${name}" function but got ${value}.`);
    }
}
function buildReturnPropertyType(value) {
    if (value && value.constructor && value.constructor.name) {
        return `instance of ${value.constructor.name}`;
    }
    else {
        return `type ${typeof value}`;
    }
}
export class ERR_INVALID_RETURN_PROPERTY_VALUE extends NodeTypeError {
    constructor(input, name, prop, value) {
        super("ERR_INVALID_RETURN_PROPERTY_VALUE", `Expected ${input} to be returned for the "${prop}" from the "${name}" function but got ${buildReturnPropertyType(value)}.`);
    }
}
export class ERR_INVALID_RETURN_VALUE extends NodeTypeError {
    constructor(input, name, value) {
        super("ERR_INVALID_RETURN_VALUE", `Expected ${input} to be returned from the "${name}" function but got ${buildReturnPropertyType(value)}.`);
    }
}
export class ERR_INVALID_URL extends NodeTypeError {
    input;
    constructor(input) {
        super("ERR_INVALID_URL", `Invalid URL: ${input}`);
        this.input = input;
    }
}
export class ERR_INVALID_URL_SCHEME extends NodeTypeError {
    constructor(expected) {
        expected = Array.isArray(expected) ? expected : [expected];
        const res = expected.length === 2
            ? `one of scheme ${expected[0]} or ${expected[1]}`
            : `of scheme ${expected[0]}`;
        super("ERR_INVALID_URL_SCHEME", `The URL must be ${res}`);
    }
}
export class ERR_MODULE_NOT_FOUND extends NodeError {
    constructor(path, base, type = "package") {
        super("ERR_MODULE_NOT_FOUND", `Cannot find ${type} '${path}' imported from ${base}`);
    }
}
export class ERR_INVALID_PACKAGE_CONFIG extends NodeError {
    constructor(path, base, message) {
        const msg = `Invalid package config ${path}${base ? ` while importing ${base}` : ""}${message ? `. ${message}` : ""}`;
        super("ERR_INVALID_PACKAGE_CONFIG", msg);
    }
}
export class ERR_INVALID_MODULE_SPECIFIER extends NodeTypeError {
    constructor(request, reason, base) {
        super("ERR_INVALID_MODULE_SPECIFIER", `Invalid module "${request}" ${reason}${base ? ` imported from ${base}` : ""}`);
    }
}
export class ERR_INVALID_PACKAGE_TARGET extends NodeError {
    constructor(pkgPath, key, target, isImport, base) {
        let msg;
        const relError = typeof target === "string" &&
            !isImport &&
            target.length &&
            !target.startsWith("./");
        if (key === ".") {
            assert(isImport === false);
            msg = `Invalid "exports" main target ${JSON.stringify(target)} defined ` +
                `in the package config ${pkgPath}package.json${base ? ` imported from ${base}` : ""}${relError ? '; targets must start with "./"' : ""}`;
        }
        else {
            msg = `Invalid "${isImport ? "imports" : "exports"}" target ${JSON.stringify(target)} defined for '${key}' in the package config ${pkgPath}package.json${base ? ` imported from ${base}` : ""}${relError ? '; targets must start with "./"' : ""}`;
        }
        super("ERR_INVALID_PACKAGE_TARGET", msg);
    }
}
export class ERR_PACKAGE_IMPORT_NOT_DEFINED extends NodeTypeError {
    constructor(specifier, packagePath, base) {
        const msg = `Package import specifier "${specifier}" is not defined${packagePath ? ` in package ${packagePath}package.json` : ""} imported from ${base}`;
        super("ERR_PACKAGE_IMPORT_NOT_DEFINED", msg);
    }
}
export class ERR_PACKAGE_PATH_NOT_EXPORTED extends NodeError {
    constructor(subpath, pkgPath, basePath) {
        let msg;
        if (subpath === ".") {
            msg = `No "exports" main defined in ${pkgPath}package.json${basePath ? ` imported from ${basePath}` : ""}`;
        }
        else {
            msg =
                `Package subpath '${subpath}' is not defined by "exports" in ${pkgPath}package.json${basePath ? ` imported from ${basePath}` : ""}`;
        }
        super("ERR_PACKAGE_PATH_NOT_EXPORTED", msg);
    }
}
export class ERR_INTERNAL_ASSERTION extends NodeError {
    constructor(message) {
        const suffix = "This is caused by either a bug in Node.js " +
            "or incorrect usage of Node.js internals.\n" +
            "Please open an issue with this stack trace at " +
            "https://github.com/nodejs/node/issues\n";
        super("ERR_INTERNAL_ASSERTION", message === undefined ? suffix : `${message}\n${suffix}`);
    }
}
export class ERR_FS_RMDIR_ENOTDIR extends NodeSystemError {
    constructor(path) {
        const code = isWindows ? "ENOENT" : "ENOTDIR";
        const ctx = {
            message: "not a directory",
            path,
            syscall: "rmdir",
            code,
            errno: isWindows ? ENOENT : ENOTDIR,
        };
        super(code, ctx, "Path is not a directory");
    }
}
export function denoErrorToNodeError(e, ctx) {
    const errno = extractOsErrorNumberFromErrorMessage(e);
    if (typeof errno === "undefined") {
        return e;
    }
    const ex = uvException({
        errno: mapSysErrnoToUvErrno(errno),
        ...ctx,
    });
    return ex;
}
function extractOsErrorNumberFromErrorMessage(e) {
    const match = e instanceof Error
        ? e.message.match(/\(os error (\d+)\)/)
        : false;
    if (match) {
        return +match[1];
    }
    return undefined;
}
export function connResetException(msg) {
    const ex = new Error(msg);
    ex.code = "ECONNRESET";
    return ex;
}
export function aggregateTwoErrors(innerError, outerError) {
    if (innerError && outerError && innerError !== outerError) {
        if (Array.isArray(outerError.errors)) {
            outerError.errors.push(innerError);
            return outerError;
        }
        const err = new AggregateError([
            outerError,
            innerError,
        ], outerError.message);
        err.code = outerError.code;
        return err;
    }
    return innerError || outerError;
}
codes.ERR_IPC_CHANNEL_CLOSED = ERR_IPC_CHANNEL_CLOSED;
codes.ERR_INVALID_ARG_TYPE = ERR_INVALID_ARG_TYPE;
codes.ERR_INVALID_ARG_VALUE = ERR_INVALID_ARG_VALUE;
codes.ERR_INVALID_CALLBACK = ERR_INVALID_CALLBACK;
codes.ERR_OUT_OF_RANGE = ERR_OUT_OF_RANGE;
codes.ERR_SOCKET_BAD_PORT = ERR_SOCKET_BAD_PORT;
codes.ERR_BUFFER_OUT_OF_BOUNDS = ERR_BUFFER_OUT_OF_BOUNDS;
codes.ERR_UNKNOWN_ENCODING = ERR_UNKNOWN_ENCODING;
export { codes, hideStackFrames };
export default {
    AbortError,
    aggregateTwoErrors,
    codes,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3JzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZXJyb3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQWdCQSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxZQUFZLENBQUM7QUFDaEQsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLDhCQUE4QixDQUFDO0FBQ3ZELE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUN6QyxPQUFPLEVBQ0wsT0FBTyxFQUNQLFFBQVEsRUFDUixvQkFBb0IsR0FDckIsTUFBTSwyQkFBMkIsQ0FBQztBQUNuQyxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sdUJBQXVCLENBQUM7QUFDL0MsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1CQUFtQixDQUFDO0FBQzlDLE9BQU8sRUFBRSxFQUFFLElBQUksV0FBVyxFQUFFLE1BQU0sa0NBQWtDLENBQUM7QUFDckUsTUFBTSxFQUNKLEtBQUssRUFBRSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsR0FDM0IsR0FBRyxXQUFXLENBQUM7QUFDaEIsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLHdCQUF3QixDQUFDO0FBRXpELE9BQU8sRUFBRSxRQUFRLEVBQUUsQ0FBQztBQUVwQixNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7QUFLNUMsTUFBTSxXQUFXLEdBQUcscUJBQXFCLENBQUM7QUFNMUMsTUFBTSxNQUFNLEdBQUc7SUFDYixRQUFRO0lBQ1IsVUFBVTtJQUNWLFFBQVE7SUFDUixRQUFRO0lBRVIsVUFBVTtJQUNWLFFBQVE7SUFDUixTQUFTO0lBQ1QsUUFBUTtJQUNSLFFBQVE7Q0FDVCxDQUFDO0FBS0YsTUFBTSxPQUFPLFVBQVcsU0FBUSxLQUFLO0lBQ25DLElBQUksQ0FBUztJQUViO1FBQ0UsS0FBSyxDQUFDLDJCQUEyQixDQUFDLENBQUM7UUFDbkMsSUFBSSxDQUFDLElBQUksR0FBRyxXQUFXLENBQUM7UUFDeEIs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O0FBRWxDLGVBQWU7SUFDYixVQUFVO0lBQ1Ysa0JBQWtCO0lBQ2xCLEtBQUs7Q0FDTixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMiB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIENvcHlyaWdodCBOb2RlLmpzIGNvbnRyaWJ1dG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIExpY2Vuc2UuXG4vKiogKioqKioqKioqKiBOT1QgSU1QTEVNRU5URURcbiAqIEVSUl9NQU5JRkVTVF9BU1NFUlRfSU5URUdSSVRZXG4gKiBFUlJfUVVJQ1NFU1NJT05fVkVSU0lPTl9ORUdPVElBVElPTlxuICogRVJSX1JFUVVJUkVfRVNNXG4gKiBFUlJfVExTX0NFUlRfQUxUTkFNRV9JTlZBTElEXG4gKiBFUlJfV09SS0VSX0lOVkFMSURfRVhFQ19BUkdWXG4gKiBFUlJfV09SS0VSX1BBVEhcbiAqIEVSUl9RVUlDX0VSUk9SXG4gKiBFUlJfU09DS0VUX0JVRkZFUl9TSVpFIC8vU3lzdGVtIGVycm9yLCBzaG91bGRuJ3QgZXZlciBoYXBwZW4gaW5zaWRlIERlbm9cbiAqIEVSUl9TWVNURU1fRVJST1IgLy9TeXN0ZW0gZXJyb3IsIHNob3VsZG4ndCBldmVyIGhhcHBlbiBpbnNpZGUgRGVub1xuICogRVJSX1RUWV9JTklUX0ZBSUxFRCAvL1N5c3RlbSBlcnJvciwgc2hvdWxkbid0IGV2ZXIgaGFwcGVuIGluc2lkZSBEZW5vXG4gKiBFUlJfSU5WQUxJRF9QQUNLQUdFX0NPTkZJRyAvLyBwYWNrYWdlLmpzb24gc3R1ZmYsIHByb2JhYmx5IHVzZWxlc3NcbiAqICoqKioqKioqKioqICovXG5cbmltcG9ydCB7IGdldFN5c3RlbUVycm9yTmFtZSB9IGZyb20gXCIuLi91dGlsLnRzXCI7XG5pbXBvcnQgeyBpbnNwZWN0IH0gZnJvbSBcIi4uL2ludGVybmFsL3V0aWwvaW5zcGVjdC5tanNcIjtcbmltcG9ydCB7IGNvZGVzIH0gZnJvbSBcIi4vZXJyb3JfY29kZXMudHNcIjtcbmltcG9ydCB7XG4gIGNvZGVNYXAsXG4gIGVycm9yTWFwLFxuICBtYXBTeXNFcnJub1RvVXZFcnJubyxcbn0gZnJvbSBcIi4uL2ludGVybmFsX2JpbmRpbmcvdXYudHNcIjtcbmltcG9ydCB7IGFzc2VydCB9IGZyb20gXCIuLi8uLi9fdXRpbC9hc3NlcnQudHNcIjtcbmltcG9ydCB7IGlzV2luZG93cyB9IGZyb20gXCIuLi8uLi9fdXRpbC9vcy50c1wiO1xuaW1wb3J0IHsgb3MgYXMgb3NDb25zdGFudHMgfSBmcm9tIFwiLi4vaW50ZXJuYWxfYmluZGluZy9jb25zdGFudHMudHNcIjtcbmNvbnN0IHtcbiAgZXJybm86IHsgRU5PVERJUiwgRU5PRU5UIH0sXG59ID0gb3NDb25zdGFudHM7XG5pbXBvcnQgeyBoaWRlU3RhY2tGcmFtZXMgfSBmcm9tIFwiLi9oaWRlX3N0YWNrX2ZyYW1lcy50c1wiO1xuXG5leHBvcnQgeyBlcnJvck1hcCB9O1xuXG5jb25zdCBrSXNOb2RlRXJyb3IgPSBTeW1ib2woXCJrSXNOb2RlRXJyb3JcIik7XG5cbi8qKlxuICogQHNlZSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9mM2ViMjI0L2xpYi9pbnRlcm5hbC9lcnJvcnMuanNcbiAqL1xuY29uc3QgY2xhc3NSZWdFeHAgPSAvXihbQS1aXVthLXowLTldKikrJC87XG5cbi8qKlxuICogQHNlZSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9mM2ViMjI0L2xpYi9pbnRlcm5hbC9lcnJvcnMuanNcbiAqIEBkZXNjcmlwdGlvbiBTb3J0ZWQgYnkgYSByb3VnaCBlc3RpbWF0ZSBvbiBtb3N0IGZyZXF1ZW50bHkgdXNlZCBlbnRyaWVzLlxuICovXG5jb25zdCBrVHlwZXMgPSBbXG4gIFwic3RyaW5nXCIsXG4gIFwiZnVuY3Rpb25cIixcbiAgXCJudW1iZXJcIixcbiAgXCJvYmplY3RcIixcbiAgLy8gQWNjZXB0ICdGdW5jdGlvbicgYW5kICdPYmplY3QnIGFzIGFsdGVybmF0aXZlIHRvIHRoZSBsb3dlciBjYXNlZCB2ZXJzaW9uLlxuICBcIkZ1bmN0aW9uXCIsXG4gIFwiT2JqZWN0XCIsXG4gIFwiYm9vbGVhblwiLFxuICBcImJpZ2ludFwiLFxuICBcInN5bWJvbFwiLFxuXTtcblxuLy8gTm9kZSB1c2VzIGFuIEFib3J0RXJyb3IgdGhhdCBpc24ndCBleGFjdGx5IHRoZSBzYW1lIGFzIHRoZSBET01FeGNlcHRpb25cbi8vIHRvIG1ha2UgdXNhZ2Ugb2YgdGhlIGVycm9yIGluIHVzZXJsYW5kIGFuZCByZWFkYWJsZS1zdHJlYW0gZWFzaWVyLlxuLy8gSXQgaXMgYSByZWd1bGFyIGVycm9yIHdpdGggYC5jb2RlYCBhbmQgYC5uYW1lYC5cbmV4cG9ydCBjbGFzcyBBYm9ydEVycm9yIGV4dGVuZHMgRXJyb3Ige1xuICBjb2RlOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJUaGUgb3BlcmF0aW9uIHdhcyBhYm9ydGVkXCIpO1xuICAgIHRoaXMuY29kZSA9IFwiQUJPUlRfRVJSXCI7XG4gICAgdGhpcy5uYW1lID0gXCJBYm9ydEVycm9yXCI7XG4gIH1cbn1cblxuLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbnR5cGUgR2VuZXJpY0Z1bmN0aW9uID0gKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk7XG5cbmZ1bmN0aW9uIGFkZE51bWVyaWNhbFNlcGFyYXRvcih2YWw6IHN0cmluZykge1xuICBsZXQgcmVzID0gXCJcIjtcbiAgbGV0IGkgPSB2YWwubGVuZ3RoO1xuICBjb25zdCBzdGFydCA9IHZhbFswXSA9PT0gXCItXCIgPyAxIDogMDtcbiAgZm9yICg7IGkgPj0gc3RhcnQgKyA0OyBpIC09IDMpIHtcbiAgICByZXMgPSBgXyR7dmFsLnNsaWNlKGkgLSAzLCBpKX0ke3Jlc31gO1xuICB9XG4gIHJldHVybiBgJHt2YWwuc2xpY2UoMCwgaSl9JHtyZXN9YDtcbn1cblxuY29uc3QgY2FwdHVyZUxhcmdlclN0YWNrVHJhY2UgPSBoaWRlU3RhY2tGcmFtZXMoXG4gIGZ1bmN0aW9uIGNhcHR1cmVMYXJnZXJTdGFja1RyYWNlKGVycikge1xuICAgIC8vIEB0cy1pZ25vcmUgdGhpcyBmdW5jdGlvbiBpcyBub3QgYXZhaWxhYmxlIGluIGxpYi5kb20uZC50c1xuICAgIEVycm9yLmNhcHR1cmVTdGFja1RyYWNlKGVycik7XG5cbiAgICByZXR1cm4gZXJyO1xuICB9LFxuKTtcblxuZXhwb3J0IGludGVyZmFjZSBFcnJub0V4Y2VwdGlvbiBleHRlbmRzIEVycm9yIHtcbiAgZXJybm8/OiBudW1iZXI7XG4gIGNvZGU/OiBzdHJpbmc7XG4gIHBhdGg/OiBzdHJpbmc7XG4gIHN5c2NhbGw/OiBzdHJpbmc7XG59XG5cbi8qKlxuICogVGhpcyBjcmVhdGVzIGFuIGVycm9yIGNvbXBhdGlibGUgd2l0aCBlcnJvcnMgcHJvZHVjZWQgaW4gdGhlIEMrK1xuICogVGhpcyBmdW5jdGlvbiBzaG91bGQgcmVwbGFjZSB0aGUgZGVwcmVjYXRlZFxuICogYGV4Y2VwdGlvbldpdGhIb3N0UG9ydCgpYCBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0gZXJyIEEgbGlidXYgZXJyb3IgbnVtYmVyXG4gKiBAcGFyYW0gc3lzY2FsbFxuICogQHBhcmFtIGFkZHJlc3NcbiAqIEBwYXJhbSBwb3J0XG4gKiBAcmV0dXJuIFRoZSBlcnJvci5cbiAqL1xuZXhwb3J0IGNvbnN0IHV2RXhjZXB0aW9uV2l0aEhvc3RQb3J0ID0gaGlkZVN0YWNrRnJhbWVzKFxuICBmdW5jdGlvbiB1dkV4Y2VwdGlvbldpdGhIb3N0UG9ydChcbiAgICBlcnI6IG51bWJlcixcbiAgICBzeXNjYWxsOiBzdHJpbmcsXG4gICAgYWRkcmVzcz86IHN0cmluZyB8IG51bGwsXG4gICAgcG9ydD86IG51bWJlciB8IG51bGwsXG4gICkge1xuICAgIGNvbnN0IHsgMDogY29kZSwgMTogdXZtc2cgfSA9IHV2RXJybWFwR2V0KGVycikgfHwgdXZVbm1hcHBlZEVycm9yO1xuICAgIGNvbnN0IG1lc3NhZ2UgPSBgJHtzeXNjYWxsfSAke2NvZGV9OiAke3V2bXNnfWA7XG4gICAgbGV0IGRldGFpbHMgPSBcIlwiO1xuXG4gICAgaWYgKHBvcnQgJiYgcG9ydCA+IDApIHtcbiAgICAgIGRldGFpbHMgPSBgICR7YWRkcmVzc306JHtwb3J0fWA7XG4gICAgfSBlbHNlIGlmIChhZGRyZXNzKSB7XG4gICAgICBkZXRhaWxzID0gYCAke2FkZHJlc3N9YDtcbiAgICB9XG5cbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIGNvbnN0IGV4OiBhbnkgPSBuZXcgRXJyb3IoYCR7bWVzc2FnZX0ke2RldGFpbHN9YCk7XG4gICAgZXguY29kZSA9IGNvZGU7XG4gICAgZXguZXJybm8gPSBlcnI7XG4gICAgZXguc3lzY2FsbCA9IHN5c2NhbGw7XG4gICAgZXguYWRkcmVzcyA9IGFkZHJlc3M7XG5cbiAgICBpZiAocG9ydCkge1xuICAgICAgZXgucG9ydCA9IHBvcnQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNhcHR1cmVMYXJnZXJTdGFja1RyYWNlKGV4KTtcbiAgfSxcbik7XG5cbi8qKlxuICogVGhpcyB1c2VkIHRvIGJlIGB1dGlsLl9lcnJub0V4Y2VwdGlvbigpYC5cbiAqXG4gKiBAcGFyYW0gZXJyIEEgbGlidXYgZXJyb3IgbnVtYmVyXG4gKiBAcGFyYW0gc3lzY2FsbFxuICogQHBhcmFtIG9yaWdpbmFsXG4gKiBAcmV0dXJuIEEgYEVycm5vRXhjZXB0aW9uYFxuICovXG5leHBvcnQgY29uc3QgZXJybm9FeGNlcHRpb24gPSBoaWRlU3RhY2tGcmFtZXMoZnVuY3Rpb24gZXJybm9FeGNlcHRpb24oXG4gIGVycixcbiAgc3lzY2FsbCxcbiAgb3JpZ2luYWw/LFxuKTogRXJybm9FeGNlcHRpb24ge1xuICBjb25zdCBjb2RlID0gZ2V0U3lzdGVtRXJyb3JOYW1lKGVycik7XG4gIGNvbnN0IG1lc3NhZ2UgPSBvcmlnaW5hbFxuICAgID8gYCR7c3lzY2FsbH0gJHtjb2RlfSAke29yaWdpbmFsfWBcbiAgICA6IGAke3N5c2NhbGx9ICR7Y29kZX1gO1xuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGV4OiBhbnkgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIGV4LmVycm5vID0gZXJyO1xuICBleC5jb2RlID0gY29kZTtcbiAgZXguc3lzY2FsbCA9IHN5c2NhbGw7XG5cbiAgcmV0dXJuIGNhcHR1cmVMYXJnZXJTdGFja1RyYWNlKGV4KTtcbn0pO1xuXG5mdW5jdGlvbiB1dkVycm1hcEdldChuYW1lOiBudW1iZXIpIHtcbiAgcmV0dXJuIGVycm9yTWFwLmdldChuYW1lKTtcbn1cblxuY29uc3QgdXZVbm1hcHBlZEVycm9yID0gW1wiVU5LTk9XTlwiLCBcInVua25vd24gZXJyb3JcIl07XG5cbi8qKlxuICogVGhpcyBjcmVhdGVzIGFuIGVycm9yIGNvbXBhdGlibGUgd2l0aCBlcnJvcnMgcHJvZHVjZWQgaW4gdGhlIEMrK1xuICogZnVuY3Rpb24gVVZFeGNlcHRpb24gdXNpbmcgYSBjb250ZXh0IG9iamVjdCB3aXRoIGRhdGEgYXNzZW1ibGVkIGluIEMrKy5cbiAqIFRoZSBnb2FsIGlzIHRvIG1pZ3JhdGUgdGhlbSB0byBFUlJfKiBlcnJvcnMgbGF0ZXIgd2hlbiBjb21wYXRpYmlsaXR5IGlzXG4gKiBub3QgYSBjb25jZXJuLlxuICpcbiAqIEBwYXJhbSBjdHhcbiAqIEByZXR1cm4gVGhlIGVycm9yLlxuICovXG5leHBvcnQgY29uc3QgdXZFeGNlcHRpb24gPSBoaWRlU3RhY2tGcmFtZXMoZnVuY3Rpb24gdXZFeGNlcHRpb24oY3R4KSB7XG4gIGNvbnN0IHsgMDogY29kZSwgMTogdXZtc2cgfSA9IHV2RXJybWFwR2V0KGN0eC5lcnJubykgfHwgdXZVbm1hcHBlZEVycm9yO1xuXG4gIGxldCBtZXNzYWdlID0gYCR7Y29kZX06ICR7Y3R4Lm1lc3NhZ2UgfHwgdXZtc2d9LCAke2N0eC5zeXNjYWxsfWA7XG5cbiAgbGV0IHBhdGg7XG4gIGxldCBkZXN0O1xuXG4gIGlmIChjdHgucGF0aCkge1xuICAgIHBhdGggPSBjdHgucGF0aC50b1N0cmluZygpO1xuICAgIG1lc3NhZ2UgKz0gYCAnJHtwYXRofSdgO1xuICB9XG4gIGlmIChjdHguZGVzdCkge1xuICAgIGRlc3QgPSBjdHguZGVzdC50b1N0cmluZygpO1xuICAgIG1lc3NhZ2UgKz0gYCAtPiAnJHtkZXN0fSdgO1xuICB9XG5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgY29uc3QgZXJyOiBhbnkgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG5cbiAgZm9yIChjb25zdCBwcm9wIG9mIE9iamVjdC5rZXlzKGN0eCkpIHtcbiAgICBpZiAocHJvcCA9PT0gXCJtZXNzYWdlXCIgfHwgcHJvcCA9PT0gXCJwYXRoXCIgfHwgcHJvcCA9PT0gXCJkZXN0XCIpIHtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGVycltwcm9wXSA9IGN0eFtwcm9wXTtcbiAgfVxuXG4gIGVyci5jb2RlID0gY29kZTtcblxuICBpZiAocGF0aCkge1xuICAgIGVyci5wYXRoID0gcGF0aDtcbiAgfVxuXG4gIGlmIChkZXN0KSB7XG4gICAgZXJyLmRlc3QgPSBkZXN0O1xuICB9XG5cbiAgcmV0dXJuIGNhcHR1cmVMYXJnZXJTdGFja1RyYWNlKGVycik7XG59KTtcblxuLyoqXG4gKiBEZXByZWNhdGVkLCBuZXcgZnVuY3Rpb24gaXMgYHV2RXhjZXB0aW9uV2l0aEhvc3RQb3J0KClgXG4gKiBOZXcgZnVuY3Rpb24gYWRkZWQgdGhlIGVycm9yIGRlc2NyaXB0aW9uIGRpcmVjdGx5XG4gKiBmcm9tIEMrKy4gdGhpcyBtZXRob2QgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5XG4gKiBAcGFyYW0gZXJyIEEgbGlidXYgZXJyb3IgbnVtYmVyXG4gKiBAcGFyYW0gc3lzY2FsbFxuICogQHBhcmFtIGFkZHJlc3NcbiAqIEBwYXJhbSBwb3J0XG4gKiBAcGFyYW0gYWRkaXRpb25hbFxuICovXG5leHBvcnQgY29uc3QgZXhjZXB0aW9uV2l0aEhvc3RQb3J0ID0gaGlkZVN0YWNrRnJhbWVzKFxuICBmdW5jdGlvbiBleGNlcHRpb25XaXRoSG9zdFBvcnQoXG4gICAgZXJyOiBudW1iZXIsXG4gICAgc3lzY2FsbDogc3RyaW5nLFxuICAgIGFkZHJlc3M6IHN0cmluZyxcbiAgICBwb3J0OiBudW1iZXIsXG4gICAgYWRkaXRpb25hbD86IHN0cmluZyxcbiAgKSB7XG4gICAgY29uc3QgY29kZSA9IGdldFN5c3RlbUVycm9yTmFtZShlcnIpO1xuICAgIGxldCBkZXRhaWxzID0gXCJcIjtcblxuICAgIGlmIChwb3J0ICYmIHBvcnQgPiAwKSB7XG4gICAgICBkZXRhaWxzID0gYCAke2FkZHJlc3N9OiR7cG9ydH1gO1xuICAgIH0gZWxzZSBpZiAoYWRkcmVzcykge1xuICAgICAgZGV0YWlscyA9IGAgJHthZGRyZXNzfWA7XG4gICAgfVxuXG4gICAgaWYgKGFkZGl0aW9uYWwpIHtcbiAgICAgIGRldGFpbHMgKz0gYCAtIExvY2FsICgke2FkZGl0aW9uYWx9KWA7XG4gICAgfVxuXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCBleDogYW55ID0gbmV3IEVycm9yKGAke3N5c2NhbGx9ICR7Y29kZX0ke2RldGFpbHN9YCk7XG4gICAgZXguZXJybm8gPSBlcnI7XG4gICAgZXguY29kZSA9IGNvZGU7XG4gICAgZXguc3lzY2FsbCA9IHN5c2NhbGw7XG4gICAgZXguYWRkcmVzcyA9IGFkZHJlc3M7XG5cbiAgICBpZiAocG9ydCkge1xuICAgICAgZXgucG9ydCA9IHBvcnQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGNhcHR1cmVMYXJnZXJTdGFja1RyYWNlKGV4KTtcbiAgfSxcbik7XG5cbi8qKlxuICogQHBhcmFtIGNvZGUgQSBsaWJ1diBlcnJvciBudW1iZXIgb3IgYSBjLWFyZXMgZXJyb3IgY29kZVxuICogQHBhcmFtIHN5c2NhbGxcbiAqIEBwYXJhbSBob3N0bmFtZVxuICovXG5leHBvcnQgY29uc3QgZG5zRXhjZXB0aW9uID0gaGlkZVN0YWNrRnJhbWVzKGZ1bmN0aW9uIChjb2RlLCBzeXNjYWxsLCBob3N0bmFtZSkge1xuICBsZXQgZXJybm87XG5cbiAgLy8gSWYgYGNvZGVgIGlzIG9mIHR5cGUgbnVtYmVyLCBpdCBpcyBhIGxpYnV2IGVycm9yIG51bWJlciwgZWxzZSBpdCBpcyBhXG4gIC8vIGMtYXJlcyBlcnJvciBjb2RlLlxuICBpZiAodHlwZW9mIGNvZGUgPT09IFwibnVtYmVyXCIpIHtcbiAgICBlcnJubyA9IGNvZGU7XG4gICAgLy8gRU5PVEZPVU5EIGlzIG5vdCBhIHByb3BlciBQT1NJWCBlcnJvciwgYnV0IHRoaXMgZXJyb3IgaGFzIGJlZW4gaW4gcGxhY2VcbiAgICAvLyBsb25nIGVub3VnaCB0aGF0IGl0J3Mgbm90IHByYWN0aWNhbCB0byByZW1vdmUgaXQuXG4gICAgaWYgKFxuICAgICAgY29kZSA9PT0gY29kZU1hcC5nZXQoXCJFQUlfTk9EQVRBXCIpIHx8XG4gICAgICBjb2RlID09PSBjb2RlTWFwLmdldChcIkVBSV9OT05BTUVcIilcbiAgICApIHtcbiAgICAgIGNvZGUgPSBcIkVOT1RGT1VORFwiOyAvLyBGYWJyaWNhdGVkIGVycm9yIG5hbWUuXG4gICAgfSBlbHNlIHtcbiAgICAgIGNvZGUgPSBnZXRTeXN0ZW1FcnJvck5hbWUoY29kZSk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgbWVzc2FnZSA9IGAke3N5c2NhbGx9ICR7Y29kZX0ke2hvc3RuYW1lID8gYCAke2hvc3RuYW1lfWAgOiBcIlwifWA7XG5cbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgY29uc3QgZXg6IGFueSA9IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgZXguZXJybm8gPSBlcnJubztcbiAgZXguY29kZSA9IGNvZGU7XG4gIGV4LnN5c2NhbGwgPSBzeXNjYWxsO1xuXG4gIGlmIChob3N0bmFtZSkge1xuICAgIGV4Lmhvc3RuYW1lID0gaG9zdG5hbWU7XG4gIH1cblxuICByZXR1cm4gY2FwdHVyZUxhcmdlclN0YWNrVHJhY2UoZXgpO1xufSk7XG5cbi8qKlxuICogQWxsIGVycm9yIGluc3RhbmNlcyBpbiBOb2RlIGhhdmUgYWRkaXRpb25hbCBtZXRob2RzIGFuZCBwcm9wZXJ0aWVzXG4gKiBUaGlzIGV4cG9ydCBjbGFzcyBpcyBtZWFudCB0byBiZSBleHRlbmRlZCBieSB0aGVzZSBpbnN0YW5jZXMgYWJzdHJhY3RpbmcgbmF0aXZlIEpTIGVycm9yIGluc3RhbmNlc1xuICovXG5leHBvcnQgY2xhc3MgTm9kZUVycm9yQWJzdHJhY3Rpb24gZXh0ZW5kcyBFcnJvciB7XG4gIGNvZGU6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGNvZGU6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIobWVzc2FnZSk7XG4gICAgdGhpcy5jb2RlID0gY29kZTtcbiAgICB0aGlzLm5hbWUgPSBuYW1lO1xuICAgIC8vVGhpcyBudW1iZXIgY2hhbmdlcyBkZXBlbmRpbmcgb24gdGhlIG5hbWUgb2YgdGhpcyBjbGFzc1xuICAgIC8vMjAgY2hhcmFjdGVycyBhcyBvZiBub3dcbiAgICB0aGlzLnN0YWNrID0gdGhpcy5zdGFjayAmJiBgJHtuYW1lfSBbJHt0aGlzLmNvZGV9XSR7dGhpcy5zdGFjay5zbGljZSgyMCl9YDtcbiAgfVxuXG4gIG92ZXJyaWRlIHRvU3RyaW5nKCkge1xuICAgIHJldHVybiBgJHt0aGlzLm5hbWV9IFske3RoaXMuY29kZX1dOiAke3RoaXMubWVzc2FnZX1gO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBOb2RlRXJyb3IgZXh0ZW5kcyBOb2RlRXJyb3JBYnN0cmFjdGlvbiB7XG4gIGNvbnN0cnVjdG9yKGNvZGU6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoRXJyb3IucHJvdG90eXBlLm5hbWUsIGNvZGUsIG1lc3NhZ2UpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBOb2RlU3ludGF4RXJyb3IgZXh0ZW5kcyBOb2RlRXJyb3JBYnN0cmFjdGlvblxuICBpbXBsZW1lbnRzIFN5bnRheEVycm9yIHtcbiAgY29uc3RydWN0b3IoY29kZTogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihTeW50YXhFcnJvci5wcm90b3R5cGUubmFtZSwgY29kZSwgbWVzc2FnZSk7XG4gICAgT2JqZWN0LnNldFByb3RvdHlwZU9mKHRoaXMsIFN5bnRheEVycm9yLnByb3RvdHlwZSk7XG4gICAgdGhpcy50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBgJHt0aGlzLm5hbWV9IFske3RoaXMuY29kZX1dOiAke3RoaXMubWVzc2FnZX1gO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE5vZGVSYW5nZUVycm9yIGV4dGVuZHMgTm9kZUVycm9yQWJzdHJhY3Rpb24ge1xuICBjb25zdHJ1Y3Rvcihjb2RlOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKFJhbmdlRXJyb3IucHJvdG90eXBlLm5hbWUsIGNvZGUsIG1lc3NhZ2UpO1xuICAgIE9iamVjdC5zZXRQcm90b3R5cGVPZih0aGlzLCBSYW5nZUVycm9yLnByb3RvdHlwZSk7XG4gICAgdGhpcy50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBgJHt0aGlzLm5hbWV9IFske3RoaXMuY29kZX1dOiAke3RoaXMubWVzc2FnZX1gO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE5vZGVUeXBlRXJyb3IgZXh0ZW5kcyBOb2RlRXJyb3JBYnN0cmFjdGlvbiBpbXBsZW1lbnRzIFR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGNvZGU6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoVHlwZUVycm9yLnByb3RvdHlwZS5uYW1lLCBjb2RlLCBtZXNzYWdlKTtcbiAgICBPYmplY3Quc2V0UHJvdG90eXBlT2YodGhpcywgVHlwZUVycm9yLnByb3RvdHlwZSk7XG4gICAgdGhpcy50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBgJHt0aGlzLm5hbWV9IFske3RoaXMuY29kZX1dOiAke3RoaXMubWVzc2FnZX1gO1xuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE5vZGVVUklFcnJvciBleHRlbmRzIE5vZGVFcnJvckFic3RyYWN0aW9uIGltcGxlbWVudHMgVVJJRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcihjb2RlOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKFVSSUVycm9yLnByb3RvdHlwZS5uYW1lLCBjb2RlLCBtZXNzYWdlKTtcbiAgICBPYmplY3Quc2V0UHJvdG90eXBlT2YodGhpcywgVVJJRXJyb3IucHJvdG90eXBlKTtcbiAgICB0aGlzLnRvU3RyaW5nID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGAke3RoaXMubmFtZX0gWyR7dGhpcy5jb2RlfV06ICR7dGhpcy5tZXNzYWdlfWA7XG4gICAgfTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgTm9kZVN5c3RlbUVycm9yQ3R4IHtcbiAgY29kZTogc3RyaW5nO1xuICBzeXNjYWxsOiBzdHJpbmc7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgZXJybm86IG51bWJlcjtcbiAgcGF0aD86IHN0cmluZztcbiAgZGVzdD86IHN0cmluZztcbn1cbi8vIEEgc3BlY2lhbGl6ZWQgRXJyb3IgdGhhdCBpbmNsdWRlcyBhbiBhZGRpdGlvbmFsIGluZm8gcHJvcGVydHkgd2l0aFxuLy8gYWRkaXRpb25hbCBpbmZvcm1hdGlvbiBhYm91dCB0aGUgZXJyb3IgY29uZGl0aW9uLlxuLy8gSXQgaGFzIHRoZSBwcm9wZXJ0aWVzIHByZXNlbnQgaW4gYSBVVkV4Y2VwdGlvbiBidXQgd2l0aCBhIGN1c3RvbSBlcnJvclxuLy8gbWVzc2FnZSBmb2xsb3dlZCBieSB0aGUgdXYgZXJyb3IgY29kZSBhbmQgdXYgZXJyb3IgbWVzc2FnZS5cbi8vIEl0IGFsc28gaGFzIGl0cyBvd24gZXJyb3IgY29kZSB3aXRoIHRoZSBvcmlnaW5hbCB1diBlcnJvciBjb250ZXh0IHB1dCBpbnRvXG4vLyBgZXJyLmluZm9gLlxuLy8gVGhlIGNvbnRleHQgcGFzc2VkIGludG8gdGhpcyBlcnJvciBtdXN0IGhhdmUgLmNvZGUsIC5zeXNjYWxsIGFuZCAubWVzc2FnZSxcbi8vIGFuZCBtYXkgaGF2ZSAucGF0aCBhbmQgLmRlc3QuXG5jbGFzcyBOb2RlU3lzdGVtRXJyb3IgZXh0ZW5kcyBOb2RlRXJyb3JBYnN0cmFjdGlvbiB7XG4gIGNvbnN0cnVjdG9yKGtleTogc3RyaW5nLCBjb250ZXh0OiBOb2RlU3lzdGVtRXJyb3JDdHgsIG1zZ1ByZWZpeDogc3RyaW5nKSB7XG4gICAgbGV0IG1lc3NhZ2UgPSBgJHttc2dQcmVmaXh9OiAke2NvbnRleHQuc3lzY2FsbH0gcmV0dXJuZWQgYCArXG4gICAgICBgJHtjb250ZXh0LmNvZGV9ICgke2NvbnRleHQubWVzc2FnZX0pYDtcblxuICAgIGlmIChjb250ZXh0LnBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgbWVzc2FnZSArPSBgICR7Y29udGV4dC5wYXRofWA7XG4gICAgfVxuICAgIGlmIChjb250ZXh0LmRlc3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgbWVzc2FnZSArPSBgID0+ICR7Y29udGV4dC5kZXN0fWA7XG4gICAgfVxuXG4gICAgc3VwZXIoXCJTeXN0ZW1FcnJvclwiLCBrZXksIG1lc3NhZ2UpO1xuXG4gICAgY2FwdHVyZUxhcmdlclN0YWNrVHJhY2UodGhpcyk7XG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICBba0lzTm9kZUVycm9yXToge1xuICAgICAgICB2YWx1ZTogdHJ1ZSxcbiAgICAgICAgZW51bWVyYWJsZTogZmFsc2UsXG4gICAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIGluZm86IHtcbiAgICAgICAgdmFsdWU6IGNvbnRleHQsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgd3JpdGFibGU6IGZhbHNlLFxuICAgICAgfSxcbiAgICAgIGVycm5vOiB7XG4gICAgICAgIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gY29udGV4dC5lcnJubztcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiAodmFsdWUpID0+IHtcbiAgICAgICAgICBjb250ZXh0LmVycm5vID0gdmFsdWU7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBzeXNjYWxsOiB7XG4gICAgICAgIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gY29udGV4dC5zeXNjYWxsO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6ICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIGNvbnRleHQuc3lzY2FsbCA9IHZhbHVlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgaWYgKGNvbnRleHQucGF0aCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgXCJwYXRoXCIsIHtcbiAgICAgICAgZ2V0KCkge1xuICAgICAgICAgIHJldHVybiBjb250ZXh0LnBhdGg7XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogKHZhbHVlKSA9PiB7XG4gICAgICAgICAgY29udGV4dC5wYXRoID0gdmFsdWU7XG4gICAgICAgIH0sXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChjb250ZXh0LmRlc3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwiZGVzdFwiLCB7XG4gICAgICAgIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gY29udGV4dC5kZXN0O1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6ICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIGNvbnRleHQuZGVzdCA9IHZhbHVlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBvdmVycmlkZSB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5uYW1lfSBbJHt0aGlzLmNvZGV9XTogJHt0aGlzLm1lc3NhZ2V9YDtcbiAgfVxufVxuXG5mdW5jdGlvbiBtYWtlU3lzdGVtRXJyb3JXaXRoQ29kZShrZXk6IHN0cmluZywgbXNnUHJmaXg6IHN0cmluZykge1xuICByZXR1cm4gY2xhc3MgTm9kZUVycm9yIGV4dGVuZHMgTm9kZVN5c3RlbUVycm9yIHtcbiAgICBjb25zdHJ1Y3RvcihjdHg6IE5vZGVTeXN0ZW1FcnJvckN0eCkge1xuICAgICAgc3VwZXIoa2V5LCBjdHgsIG1zZ1ByZml4KTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBjb25zdCBFUlJfRlNfRUlTRElSID0gbWFrZVN5c3RlbUVycm9yV2l0aENvZGUoXG4gIFwiRVJSX0ZTX0VJU0RJUlwiLFxuICBcIlBhdGggaXMgYSBkaXJlY3RvcnlcIixcbik7XG5cbmZ1bmN0aW9uIGNyZWF0ZUludmFsaWRBcmdUeXBlKFxuICBuYW1lOiBzdHJpbmcsXG4gIGV4cGVjdGVkOiBzdHJpbmcgfCBzdHJpbmdbXSxcbik6IHN0cmluZyB7XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9ibG9iL2YzZWIyMjQvbGliL2ludGVybmFsL2Vycm9ycy5qcyNMMTAzNy1MMTA4N1xuICBleHBlY3RlZCA9IEFycmF5LmlzQXJyYXkoZXhwZWN0ZWQpID8gZXhwZWN0ZWQgOiBbZXhwZWN0ZWRdO1xuICBsZXQgbXNnID0gXCJUaGUgXCI7XG4gIGlmIChuYW1lLmVuZHNXaXRoKFwiIGFyZ3VtZW50XCIpKSB7XG4gICAgLy8gRm9yIGNhc2VzIGxpa2UgJ2ZpcnN0IGFyZ3VtZW50J1xuICAgIG1zZyArPSBgJHtuYW1lfSBgO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IHR5cGUgPSBuYW1lLmluY2x1ZGVzKFwiLlwiKSA/IFwicHJvcGVydHlcIiA6IFwiYXJndW1lbnRcIjtcbiAgICBtc2cgKz0gYFwiJHtuYW1lfVwiICR7dHlwZX0gYDtcbiAgfVxuICBtc2cgKz0gXCJtdXN0IGJlIFwiO1xuXG4gIGNvbnN0IHR5cGVzID0gW107XG4gIGNvbnN0IGluc3RhbmNlcyA9IFtdO1xuICBjb25zdCBvdGhlciA9IFtdO1xuICBmb3IgKGNvbnN0IHZhbHVlIG9mIGV4cGVjdGVkKSB7XG4gICAgaWYgKGtUeXBlcy5pbmNsdWRlcyh2YWx1ZSkpIHtcbiAgICAgIHR5cGVzLnB1c2godmFsdWUudG9Mb2NhbGVMb3dlckNhc2UoKSk7XG4gICAgfSBlbHNlIGlmIChjbGFzc1JlZ0V4cC50ZXN0KHZhbHVlKSkge1xuICAgICAgaW5zdGFuY2VzLnB1c2godmFsdWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdGhlci5wdXNoKHZhbHVlKTtcbiAgICB9XG4gIH1cblxuICAvLyBTcGVjaWFsIGhhbmRsZSBgb2JqZWN0YCBpbiBjYXNlIG90aGVyIGluc3RhbmNlcyBhcmUgYWxsb3dlZCB0byBvdXRsaW5lXG4gIC8vIHRoZSBkaWZmZXJlbmNlcyBiZXR3ZWVuIGVhY2ggb3RoZXIuXG4gIGlmIChpbnN0YW5jZXMubGVuZ3RoID4gMCkge1xuICAgIGNvbnN0IHBvcyA9IHR5cGVzLmluZGV4T2YoXCJvYmplY3RcIik7XG4gICAgaWYgKHBvcyAhPT0gLTEpIHtcbiAgICAgIHR5cGVzLnNwbGljZShwb3MsIDEpO1xuICAgICAgaW5zdGFuY2VzLnB1c2goXCJPYmplY3RcIik7XG4gICAgfVxuICB9XG5cbiAgaWYgKHR5cGVzLmxlbmd0aCA+IDApIHtcbiAgICBpZiAodHlwZXMubGVuZ3RoID4gMikge1xuICAgICAgY29uc3QgbGFzdCA9IHR5cGVzLnBvcCgpO1xuICAgICAgbXNnICs9IGBvbmUgb2YgdHlwZSAke3R5cGVzLmpvaW4oXCIsIFwiKX0sIG9yICR7bGFzdH1gO1xuICAgIH0gZWxzZSBpZiAodHlwZXMubGVuZ3RoID09PSAyKSB7XG4gICAgICBtc2cgKz0gYG9uZSBvZiB0eXBlICR7dHlwZXNbMF19IG9yICR7dHlwZXNbMV19YDtcbiAgICB9IGVsc2Uge1xuICAgICAgbXNnICs9IGBvZiB0eXBlICR7dHlwZXNbMF19YDtcbiAgICB9XG4gICAgaWYgKGluc3RhbmNlcy5sZW5ndGggPiAwIHx8IG90aGVyLmxlbmd0aCA+IDApIHtcbiAgICAgIG1zZyArPSBcIiBvciBcIjtcbiAgICB9XG4gIH1cblxuICBpZiAoaW5zdGFuY2VzLmxlbmd0aCA+IDApIHtcbiAgICBpZiAoaW5zdGFuY2VzLmxlbmd0aCA+IDIpIHtcbiAgICAgIGNvbnN0IGxhc3QgPSBpbnN0YW5jZXMucG9wKCk7XG4gICAgICBtc2cgKz0gYGFuIGluc3RhbmNlIG9mICR7aW5zdGFuY2VzLmpvaW4oXCIsIFwiKX0sIG9yICR7bGFzdH1gO1xuICAgIH0gZWxzZSB7XG4gICAgICBtc2cgKz0gYGFuIGluc3RhbmNlIG9mICR7aW5zdGFuY2VzWzBdfWA7XG4gICAgICBpZiAoaW5zdGFuY2VzLmxlbmd0aCA9PT0gMikge1xuICAgICAgICBtc2cgKz0gYCBvciAke2luc3RhbmNlc1sxXX1gO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAob3RoZXIubGVuZ3RoID4gMCkge1xuICAgICAgbXNnICs9IFwiIG9yIFwiO1xuICAgIH1cbiAgfVxuXG4gIGlmIChvdGhlci5sZW5ndGggPiAwKSB7XG4gICAgaWYgKG90aGVyLmxlbmd0aCA+IDIpIHtcbiAgICAgIGNvbnN0IGxhc3QgPSBvdGhlci5wb3AoKTtcbiAgICAgIG1zZyArPSBgb25lIG9mICR7b3RoZXIuam9pbihcIiwgXCIpfSwgb3IgJHtsYXN0fWA7XG4gICAgfSBlbHNlIGlmIChvdGhlci5sZW5ndGggPT09IDIpIHtcbiAgICAgIG1zZyArPSBgb25lIG9mICR7b3RoZXJbMF19IG9yICR7b3RoZXJbMV19YDtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG90aGVyWzBdLnRvTG93ZXJDYXNlKCkgIT09IG90aGVyWzBdKSB7XG4gICAgICAgIG1zZyArPSBcImFuIFwiO1xuICAgICAgfVxuICAgICAgbXNnICs9IGAke290aGVyWzBdfWA7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG1zZztcbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX0FSR19UWVBFX1JBTkdFIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmcgfCBzdHJpbmdbXSwgYWN0dWFsOiB1bmtub3duKSB7XG4gICAgY29uc3QgbXNnID0gY3JlYXRlSW52YWxpZEFyZ1R5cGUobmFtZSwgZXhwZWN0ZWQpO1xuXG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9BUkdfVFlQRVwiLCBgJHttc2d9LiR7aW52YWxpZEFyZ1R5cGVIZWxwZXIoYWN0dWFsKX1gKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfQVJHX1RZUEUgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBleHBlY3RlZDogc3RyaW5nIHwgc3RyaW5nW10sIGFjdHVhbDogdW5rbm93bikge1xuICAgIGNvbnN0IG1zZyA9IGNyZWF0ZUludmFsaWRBcmdUeXBlKG5hbWUsIGV4cGVjdGVkKTtcblxuICAgIHN1cGVyKFwiRVJSX0lOVkFMSURfQVJHX1RZUEVcIiwgYCR7bXNnfS4ke2ludmFsaWRBcmdUeXBlSGVscGVyKGFjdHVhbCl9YCk7XG4gIH1cblxuICBzdGF0aWMgUmFuZ2VFcnJvciA9IEVSUl9JTlZBTElEX0FSR19UWVBFX1JBTkdFO1xufVxuXG5jbGFzcyBFUlJfSU5WQUxJRF9BUkdfVkFMVUVfUkFOR0UgZXh0ZW5kcyBOb2RlUmFuZ2VFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgdmFsdWU6IHVua25vd24sIHJlYXNvbjogc3RyaW5nID0gXCJpcyBpbnZhbGlkXCIpIHtcbiAgICBjb25zdCB0eXBlID0gbmFtZS5pbmNsdWRlcyhcIi5cIikgPyBcInByb3BlcnR5XCIgOiBcImFyZ3VtZW50XCI7XG4gICAgY29uc3QgaW5zcGVjdGVkID0gaW5zcGVjdCh2YWx1ZSk7XG5cbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOVkFMSURfQVJHX1ZBTFVFXCIsXG4gICAgICBgVGhlICR7dHlwZX0gJyR7bmFtZX0nICR7cmVhc29ufS4gUmVjZWl2ZWQgJHtpbnNwZWN0ZWR9YCxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9BUkdfVkFMVUUgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB2YWx1ZTogdW5rbm93biwgcmVhc29uOiBzdHJpbmcgPSBcImlzIGludmFsaWRcIikge1xuICAgIGNvbnN0IHR5cGUgPSBuYW1lLmluY2x1ZGVzKFwiLlwiKSA/IFwicHJvcGVydHlcIiA6IFwiYXJndW1lbnRcIjtcbiAgICBjb25zdCBpbnNwZWN0ZWQgPSBpbnNwZWN0KHZhbHVlKTtcblxuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9BUkdfVkFMVUVcIixcbiAgICAgIGBUaGUgJHt0eXBlfSAnJHtuYW1lfScgJHtyZWFzb259LiBSZWNlaXZlZCAke2luc3BlY3RlZH1gLFxuICAgICk7XG4gIH1cblxuICBzdGF0aWMgUmFuZ2VFcnJvciA9IEVSUl9JTlZBTElEX0FSR19WQUxVRV9SQU5HRTtcbn1cblxuLy8gQSBoZWxwZXIgZnVuY3Rpb24gdG8gc2ltcGxpZnkgY2hlY2tpbmcgZm9yIEVSUl9JTlZBTElEX0FSR19UWVBFIG91dHB1dC5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5mdW5jdGlvbiBpbnZhbGlkQXJnVHlwZUhlbHBlcihpbnB1dDogYW55KSB7XG4gIGlmIChpbnB1dCA9PSBudWxsKSB7XG4gICAgcmV0dXJuIGAgUmVjZWl2ZWQgJHtpbnB1dH1gO1xuICB9XG4gIGlmICh0eXBlb2YgaW5wdXQgPT09IFwiZnVuY3Rpb25cIiAmJiBpbnB1dC5uYW1lKSB7XG4gICAgcmV0dXJuIGAgUmVjZWl2ZWQgZnVuY3Rpb24gJHtpbnB1dC5uYW1lfWA7XG4gIH1cbiAgaWYgKHR5cGVvZiBpbnB1dCA9PT0gXCJvYmplY3RcIikge1xuICAgIGlmIChpbnB1dC5jb25zdHJ1Y3RvciAmJiBpbnB1dC5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgICByZXR1cm4gYCBSZWNlaXZlZCBhbiBpbnN0YW5jZSBvZiAke2lucHV0LmNvbnN0cnVjdG9yLm5hbWV9YDtcbiAgICB9XG4gICAgcmV0dXJuIGAgUmVjZWl2ZWQgJHtpbnNwZWN0KGlucHV0LCB7IGRlcHRoOiAtMSB9KX1gO1xuICB9XG4gIGxldCBpbnNwZWN0ZWQgPSBpbnNwZWN0KGlucHV0LCB7IGNvbG9yczogZmFsc2UgfSk7XG4gIGlmIChpbnNwZWN0ZWQubGVuZ3RoID4gMjUpIHtcbiAgICBpbnNwZWN0ZWQgPSBgJHtpbnNwZWN0ZWQuc2xpY2UoMCwgMjUpfS4uLmA7XG4gIH1cbiAgcmV0dXJuIGAgUmVjZWl2ZWQgdHlwZSAke3R5cGVvZiBpbnB1dH0gKCR7aW5zcGVjdGVkfSlgO1xufVxuXG5leHBvcnQgY2xhc3MgRVJSX09VVF9PRl9SQU5HRSBleHRlbmRzIFJhbmdlRXJyb3Ige1xuICBjb2RlID0gXCJFUlJfT1VUX09GX1JBTkdFXCI7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgc3RyOiBzdHJpbmcsXG4gICAgcmFuZ2U6IHN0cmluZyxcbiAgICBpbnB1dDogdW5rbm93bixcbiAgICByZXBsYWNlRGVmYXVsdEJvb2xlYW4gPSBmYWxzZSxcbiAgKSB7XG4gICAgYXNzZXJ0KHJhbmdlLCAnTWlzc2luZyBcInJhbmdlXCIgYXJndW1lbnQnKTtcbiAgICBsZXQgbXNnID0gcmVwbGFjZURlZmF1bHRCb29sZWFuXG4gICAgICA/IHN0clxuICAgICAgOiBgVGhlIHZhbHVlIG9mIFwiJHtzdHJ9XCIgaXMgb3V0IG9mIHJhbmdlLmA7XG4gICAgbGV0IHJlY2VpdmVkO1xuICAgIGlmIChOdW1iZXIuaXNJbnRlZ2VyKGlucHV0KSAmJiBNYXRoLmFicyhpbnB1dCBhcyBudW1iZXIpID4gMiAqKiAzMikge1xuICAgICAgcmVjZWl2ZWQgPSBhZGROdW1lcmljYWxTZXBhcmF0b3IoU3RyaW5nKGlucHV0KSk7XG4gICAgfSBlbHNlIGlmICh0eXBlb2YgaW5wdXQgPT09IFwiYmlnaW50XCIpIHtcbiAgICAgIHJlY2VpdmVkID0gU3RyaW5nKGlucHV0KTtcbiAgICAgIGlmIChpbnB1dCA+IDJuICoqIDMybiB8fCBpbnB1dCA8IC0oMm4gKiogMzJuKSkge1xuICAgICAgICByZWNlaXZlZCA9IGFkZE51bWVyaWNhbFNlcGFyYXRvcihyZWNlaXZlZCk7XG4gICAgICB9XG4gICAgICByZWNlaXZlZCArPSBcIm5cIjtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVjZWl2ZWQgPSBpbnNwZWN0KGlucHV0KTtcbiAgICB9XG4gICAgbXNnICs9IGAgSXQgbXVzdCBiZSAke3JhbmdlfS4gUmVjZWl2ZWQgJHtyZWNlaXZlZH1gO1xuXG4gICAgc3VwZXIobXNnKTtcblxuICAgIGNvbnN0IHsgbmFtZSB9ID0gdGhpcztcbiAgICAvLyBBZGQgdGhlIGVycm9yIGNvZGUgdG8gdGhlIG5hbWUgdG8gaW5jbHVkZSBpdCBpbiB0aGUgc3RhY2sgdHJhY2UuXG4gICAgdGhpcy5uYW1lID0gYCR7bmFtZX0gWyR7dGhpcy5jb2RlfV1gO1xuICAgIC8vIEFjY2VzcyB0aGUgc3RhY2sgdG8gZ2VuZXJhdGUgdGhlIGVycm9yIG1lc3NhZ2UgaW5jbHVkaW5nIHRoZSBlcnJvciBjb2RlIGZyb20gdGhlIG5hbWUuXG4gICAgdGhpcy5zdGFjaztcbiAgICAvLyBSZXNldCB0aGUgbmFtZSB0byB0aGUgYWN0dWFsIG5hbWUuXG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0FNQklHVU9VU19BUkdVTUVOVCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0FNQklHVU9VU19BUkdVTUVOVFwiLCBgVGhlIFwiJHt4fVwiIGFyZ3VtZW50IGlzIGFtYmlndW91cy4gJHt5fWApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQVJHX05PVF9JVEVSQUJMRSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9BUkdfTk9UX0lURVJBQkxFXCIsIGAke3h9IG11c3QgYmUgaXRlcmFibGVgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0FTU0VSVElPTiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0FTU0VSVElPTlwiLCBgJHt4fWApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQVNZTkNfQ0FMTEJBQ0sgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfQVNZTkNfQ0FMTEJBQ0tcIiwgYCR7eH0gbXVzdCBiZSBhIGZ1bmN0aW9uYCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9BU1lOQ19UWVBFIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0FTWU5DX1RZUEVcIiwgYEludmFsaWQgbmFtZSBmb3IgYXN5bmMgXCJ0eXBlXCI6ICR7eH1gKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0JST1RMSV9JTlZBTElEX1BBUkFNIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9CUk9UTElfSU5WQUxJRF9QQVJBTVwiLCBgJHt4fSBpcyBub3QgYSB2YWxpZCBCcm90bGkgcGFyYW1ldGVyYCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9CVUZGRVJfT1VUX09GX0JPVU5EUyBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IobmFtZT86IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfQlVGRkVSX09VVF9PRl9CT1VORFNcIixcbiAgICAgIG5hbWVcbiAgICAgICAgPyBgXCIke25hbWV9XCIgaXMgb3V0c2lkZSBvZiBidWZmZXIgYm91bmRzYFxuICAgICAgICA6IFwiQXR0ZW1wdCB0byBhY2Nlc3MgbWVtb3J5IG91dHNpZGUgYnVmZmVyIGJvdW5kc1wiLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9CVUZGRVJfVE9PX0xBUkdFIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0JVRkZFUl9UT09fTEFSR0VcIixcbiAgICAgIGBDYW5ub3QgY3JlYXRlIGEgQnVmZmVyIGxhcmdlciB0aGFuICR7eH0gYnl0ZXNgLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DQU5OT1RfV0FUQ0hfU0lHSU5UIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfQ0FOTk9UX1dBVENIX1NJR0lOVFwiLCBcIkNhbm5vdCB3YXRjaCBmb3IgU0lHSU5UIHNpZ25hbHNcIik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DSElMRF9DTE9TRURfQkVGT1JFX1JFUExZIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9DSElMRF9DTE9TRURfQkVGT1JFX1JFUExZXCIsXG4gICAgICBcIkNoaWxkIGNsb3NlZCBiZWZvcmUgcmVwbHkgcmVjZWl2ZWRcIixcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ0hJTERfUFJPQ0VTU19JUENfUkVRVUlSRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0NISUxEX1BST0NFU1NfSVBDX1JFUVVJUkVEXCIsXG4gICAgICBgRm9ya2VkIHByb2Nlc3NlcyBtdXN0IGhhdmUgYW4gSVBDIGNoYW5uZWwsIG1pc3NpbmcgdmFsdWUgJ2lwYycgaW4gJHt4fWAsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NISUxEX1BST0NFU1NfU1RESU9fTUFYQlVGRkVSIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0NISUxEX1BST0NFU1NfU1RESU9fTUFYQlVGRkVSXCIsXG4gICAgICBgJHt4fSBtYXhCdWZmZXIgbGVuZ3RoIGV4Y2VlZGVkYCxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ09OU09MRV9XUklUQUJMRV9TVFJFQU0gZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9DT05TT0xFX1dSSVRBQkxFX1NUUkVBTVwiLFxuICAgICAgYENvbnNvbGUgZXhwZWN0cyBhIHdyaXRhYmxlIHN0cmVhbSBpbnN0YW5jZSBmb3IgJHt4fWAsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NPTlRFWFRfTk9UX0lOSVRJQUxJWkVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfQ09OVEVYVF9OT1RfSU5JVElBTElaRURcIiwgXCJjb250ZXh0IHVzZWQgaXMgbm90IGluaXRpYWxpemVkXCIpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ1BVX1VTQUdFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfQ1BVX1VTQUdFXCIsIGBVbmFibGUgdG8gb2J0YWluIGNwdSB1c2FnZSAke3h9YCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fQ1VTVE9NX0VOR0lORV9OT1RfU1VQUE9SVEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9DUllQVE9fQ1VTVE9NX0VOR0lORV9OT1RfU1VQUE9SVEVEXCIsXG4gICAgICBcIkN1c3RvbSBlbmdpbmVzIG5vdCBzdXBwb3J0ZWQgYnkgdGhpcyBPcGVuU1NMXCIsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NSWVBUT19FQ0RIX0lOVkFMSURfRk9STUFUIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0NSWVBUT19FQ0RIX0lOVkFMSURfRk9STUFUXCIsIGBJbnZhbGlkIEVDREggZm9ybWF0OiAke3h9YCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fRUNESF9JTlZBTElEX1BVQkxJQ19LRVkgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0NSWVBUT19FQ0RIX0lOVkFMSURfUFVCTElDX0tFWVwiLFxuICAgICAgXCJQdWJsaWMga2V5IGlzIG5vdCB2YWxpZCBmb3Igc3BlY2lmaWVkIGN1cnZlXCIsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NSWVBUT19FTkdJTkVfVU5LTk9XTiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0NSWVBUT19FTkdJTkVfVU5LTk9XTlwiLCBgRW5naW5lIFwiJHt4fVwiIHdhcyBub3QgZm91bmRgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NSWVBUT19GSVBTX0ZPUkNFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfQ1JZUFRPX0ZJUFNfRk9SQ0VEXCIsXG4gICAgICBcIkNhbm5vdCBzZXQgRklQUyBtb2RlLCBpdCB3YXMgZm9yY2VkIHdpdGggLS1mb3JjZS1maXBzIGF0IHN0YXJ0dXAuXCIsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NSWVBUT19GSVBTX1VOQVZBSUxBQkxFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9DUllQVE9fRklQU19VTkFWQUlMQUJMRVwiLFxuICAgICAgXCJDYW5ub3Qgc2V0IEZJUFMgbW9kZSBpbiBhIG5vbi1GSVBTIGJ1aWxkLlwiLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fSEFTSF9GSU5BTElaRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9DUllQVE9fSEFTSF9GSU5BTElaRURcIiwgXCJEaWdlc3QgYWxyZWFkeSBjYWxsZWRcIik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fSEFTSF9VUERBVEVfRkFJTEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfQ1JZUFRPX0hBU0hfVVBEQVRFX0ZBSUxFRFwiLCBcIkhhc2ggdXBkYXRlIGZhaWxlZFwiKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NSWVBUT19JTkNPTVBBVElCTEVfS0VZIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9DUllQVE9fSU5DT01QQVRJQkxFX0tFWVwiLCBgSW5jb21wYXRpYmxlICR7eH06ICR7eX1gKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NSWVBUT19JTkNPTVBBVElCTEVfS0VZX09QVElPTlMgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfQ1JZUFRPX0lOQ09NUEFUSUJMRV9LRVlfT1BUSU9OU1wiLFxuICAgICAgYFRoZSBzZWxlY3RlZCBrZXkgZW5jb2RpbmcgJHt4fSAke3l9LmAsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NSWVBUT19JTlZBTElEX0RJR0VTVCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9DUllQVE9fSU5WQUxJRF9ESUdFU1RcIiwgYEludmFsaWQgZGlnZXN0OiAke3h9YCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fSU5WQUxJRF9LRVlfT0JKRUNUX1RZUEUgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0NSWVBUT19JTlZBTElEX0tFWV9PQkpFQ1RfVFlQRVwiLFxuICAgICAgYEludmFsaWQga2V5IG9iamVjdCB0eXBlICR7eH0sIGV4cGVjdGVkICR7eX0uYCxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ1JZUFRPX0lOVkFMSURfU1RBVEUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9DUllQVE9fSU5WQUxJRF9TVEFURVwiLCBgSW52YWxpZCBzdGF0ZSBmb3Igb3BlcmF0aW9uICR7eH1gKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NSWVBUT19QQktERjJfRVJST1IgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9DUllQVE9fUEJLREYyX0VSUk9SXCIsIFwiUEJLREYyIGVycm9yXCIpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ1JZUFRPX1NDUllQVF9JTlZBTElEX1BBUkFNRVRFUiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0NSWVBUT19TQ1JZUFRfSU5WQUxJRF9QQVJBTUVURVJcIiwgXCJJbnZhbGlkIHNjcnlwdCBwYXJhbWV0ZXJcIik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fU0NSWVBUX05PVF9TVVBQT1JURUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9DUllQVE9fU0NSWVBUX05PVF9TVVBQT1JURURcIiwgXCJTY3J5cHQgYWxnb3JpdGhtIG5vdCBzdXBwb3J0ZWRcIik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fU0lHTl9LRVlfUkVRVUlSRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9DUllQVE9fU0lHTl9LRVlfUkVRVUlSRURcIiwgXCJObyBrZXkgcHJvdmlkZWQgdG8gc2lnblwiKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0RJUl9DTE9TRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9ESVJfQ0xPU0VEXCIsIFwiRGlyZWN0b3J5IGhhbmRsZSB3YXMgY2xvc2VkXCIpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfRElSX0NPTkNVUlJFTlRfT1BFUkFUSU9OIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9ESVJfQ09OQ1VSUkVOVF9PUEVSQVRJT05cIixcbiAgICAgIFwiQ2Fubm90IGRvIHN5bmNocm9ub3VzIHdvcmsgb24gZGlyZWN0b3J5IGhhbmRsZSB3aXRoIGNvbmN1cnJlbnQgYXN5bmNocm9ub3VzIG9wZXJhdGlvbnNcIixcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfRE5TX1NFVF9TRVJWRVJTX0ZBSUxFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZywgeTogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9ETlNfU0VUX1NFUlZFUlNfRkFJTEVEXCIsXG4gICAgICBgYy1hcmVzIGZhaWxlZCB0byBzZXQgc2VydmVyczogXCIke3h9XCIgWyR7eX1dYCxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfRE9NQUlOX0NBTExCQUNLX05PVF9BVkFJTEFCTEUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0RPTUFJTl9DQUxMQkFDS19OT1RfQVZBSUxBQkxFXCIsXG4gICAgICBcIkEgY2FsbGJhY2sgd2FzIHJlZ2lzdGVyZWQgdGhyb3VnaCBcIiArXG4gICAgICAgIFwicHJvY2Vzcy5zZXRVbmNhdWdodEV4Y2VwdGlvbkNhcHR1cmVDYWxsYmFjaygpLCB3aGljaCBpcyBtdXR1YWxseSBcIiArXG4gICAgICAgIFwiZXhjbHVzaXZlIHdpdGggdXNpbmcgdGhlIGBkb21haW5gIG1vZHVsZVwiLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9ET01BSU5fQ0FOTk9UX1NFVF9VTkNBVUdIVF9FWENFUFRJT05fQ0FQVFVSRVxuICBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfRE9NQUlOX0NBTk5PVF9TRVRfVU5DQVVHSFRfRVhDRVBUSU9OX0NBUFRVUkVcIixcbiAgICAgIFwiVGhlIGBkb21haW5gIG1vZHVsZSBpcyBpbiB1c2UsIHdoaWNoIGlzIG11dHVhbGx5IGV4Y2x1c2l2ZSB3aXRoIGNhbGxpbmcgXCIgK1xuICAgICAgICBcInByb2Nlc3Muc2V0VW5jYXVnaHRFeGNlcHRpb25DYXB0dXJlQ2FsbGJhY2soKVwiLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9FTkNPRElOR19JTlZBTElEX0VOQ09ERURfREFUQSBleHRlbmRzIE5vZGVFcnJvckFic3RyYWN0aW9uXG4gIGltcGxlbWVudHMgVHlwZUVycm9yIHtcbiAgZXJybm86IG51bWJlcjtcbiAgY29uc3RydWN0b3IoZW5jb2Rpbmc6IHN0cmluZywgcmV0OiBudW1iZXIpIHtcbiAgICBzdXBlcihcbiAgICAgIFR5cGVFcnJvci5wcm90b3R5cGUubmFtZSxcbiAgICAgIFwiRVJSX0VOQ09ESU5HX0lOVkFMSURfRU5DT0RFRF9EQVRBXCIsXG4gICAgICBgVGhlIGVuY29kZWQgZGF0YSB3YXMgbm90IHZhbGlkIGZvciBlbmNvZGluZyAke2VuY29kaW5nfWAsXG4gICAgKTtcbiAgICBPYmplY3Quc2V0UHJvdG90eXBlT2YodGhpcywgVHlwZUVycm9yLnByb3RvdHlwZSk7XG5cbiAgICB0aGlzLmVycm5vID0gcmV0O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfRU5DT0RJTkdfTk9UX1NVUFBPUlRFRCBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfRU5DT0RJTkdfTk9UX1NVUFBPUlRFRFwiLCBgVGhlIFwiJHt4fVwiIGVuY29kaW5nIGlzIG5vdCBzdXBwb3J0ZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9FVkFMX0VTTV9DQU5OT1RfUFJJTlQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9FVkFMX0VTTV9DQU5OT1RfUFJJTlRcIiwgYC0tcHJpbnQgY2Fubm90IGJlIHVzZWQgd2l0aCBFU00gaW5wdXRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9FVkVOVF9SRUNVUlNJT04gZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0VWRU5UX1JFQ1VSU0lPTlwiLFxuICAgICAgYFRoZSBldmVudCBcIiR7eH1cIiBpcyBhbHJlYWR5IGJlaW5nIGRpc3BhdGNoZWRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfRkVBVFVSRV9VTkFWQUlMQUJMRV9PTl9QTEFURk9STSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0ZFQVRVUkVfVU5BVkFJTEFCTEVfT05fUExBVEZPUk1cIixcbiAgICAgIGBUaGUgZmVhdHVyZSAke3h9IGlzIHVuYXZhaWxhYmxlIG9uIHRoZSBjdXJyZW50IHBsYXRmb3JtLCB3aGljaCBpcyBiZWluZyB1c2VkIHRvIHJ1biBOb2RlLmpzYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0ZTX0ZJTEVfVE9PX0xBUkdFIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9GU19GSUxFX1RPT19MQVJHRVwiLCBgRmlsZSBzaXplICgke3h9KSBpcyBncmVhdGVyIHRoYW4gMiBHQmApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0ZTX0lOVkFMSURfU1lNTElOS19UWVBFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9GU19JTlZBTElEX1NZTUxJTktfVFlQRVwiLFxuICAgICAgYFN5bWxpbmsgdHlwZSBtdXN0IGJlIG9uZSBvZiBcImRpclwiLCBcImZpbGVcIiwgb3IgXCJqdW5jdGlvblwiLiBSZWNlaXZlZCBcIiR7eH1cImAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9BTFRTVkNfSU5WQUxJRF9PUklHSU4gZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9BTFRTVkNfSU5WQUxJRF9PUklHSU5cIixcbiAgICAgIGBIVFRQLzIgQUxUU1ZDIGZyYW1lcyByZXF1aXJlIGEgdmFsaWQgb3JpZ2luYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX0FMVFNWQ19MRU5HVEggZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9BTFRTVkNfTEVOR1RIXCIsXG4gICAgICBgSFRUUC8yIEFMVFNWQyBmcmFtZXMgYXJlIGxpbWl0ZWQgdG8gMTYzODIgYnl0ZXNgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfQ09OTkVDVF9BVVRIT1JJVFkgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX0NPTk5FQ1RfQVVUSE9SSVRZXCIsXG4gICAgICBgOmF1dGhvcml0eSBoZWFkZXIgaXMgcmVxdWlyZWQgZm9yIENPTk5FQ1QgcmVxdWVzdHNgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfQ09OTkVDVF9QQVRIIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9DT05ORUNUX1BBVEhcIixcbiAgICAgIGBUaGUgOnBhdGggaGVhZGVyIGlzIGZvcmJpZGRlbiBmb3IgQ09OTkVDVCByZXF1ZXN0c2AsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9DT05ORUNUX1NDSEVNRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfQ09OTkVDVF9TQ0hFTUVcIixcbiAgICAgIGBUaGUgOnNjaGVtZSBoZWFkZXIgaXMgZm9yYmlkZGVuIGZvciBDT05ORUNUIHJlcXVlc3RzYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX0dPQVdBWV9TRVNTSU9OIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9HT0FXQVlfU0VTU0lPTlwiLFxuICAgICAgYE5ldyBzdHJlYW1zIGNhbm5vdCBiZSBjcmVhdGVkIGFmdGVyIHJlY2VpdmluZyBhIEdPQVdBWWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9IRUFERVJTX0FGVEVSX1JFU1BPTkQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX0hFQURFUlNfQUZURVJfUkVTUE9ORFwiLFxuICAgICAgYENhbm5vdCBzcGVjaWZ5IGFkZGl0aW9uYWwgaGVhZGVycyBhZnRlciByZXNwb25zZSBpbml0aWF0ZWRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfSEVBREVSU19TRU5UIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSFRUUDJfSEVBREVSU19TRU5UXCIsIGBSZXNwb25zZSBoYXMgYWxyZWFkeSBiZWVuIGluaXRpYXRlZC5gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9IRUFERVJfU0lOR0xFX1ZBTFVFIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfSEVBREVSX1NJTkdMRV9WQUxVRVwiLFxuICAgICAgYEhlYWRlciBmaWVsZCBcIiR7eH1cIiBtdXN0IG9ubHkgaGF2ZSBhIHNpbmdsZSB2YWx1ZWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9JTkZPX1NUQVRVU19OT1RfQUxMT1dFRCBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9JTkZPX1NUQVRVU19OT1RfQUxMT1dFRFwiLFxuICAgICAgYEluZm9ybWF0aW9uYWwgc3RhdHVzIGNvZGVzIGNhbm5vdCBiZSB1c2VkYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX0lOVkFMSURfQ09OTkVDVElPTl9IRUFERVJTIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfSU5WQUxJRF9DT05ORUNUSU9OX0hFQURFUlNcIixcbiAgICAgIGBIVFRQLzEgQ29ubmVjdGlvbiBzcGVjaWZpYyBoZWFkZXJzIGFyZSBmb3JiaWRkZW46IFwiJHt4fVwiYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX0lOVkFMSURfSEVBREVSX1ZBTFVFIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZywgeTogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9JTlZBTElEX0hFQURFUl9WQUxVRVwiLFxuICAgICAgYEludmFsaWQgdmFsdWUgXCIke3h9XCIgZm9yIGhlYWRlciBcIiR7eX1cImAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9JTlZBTElEX0lORk9fU1RBVFVTIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX0lOVkFMSURfSU5GT19TVEFUVVNcIixcbiAgICAgIGBJbnZhbGlkIGluZm9ybWF0aW9uYWwgc3RhdHVzIGNvZGU6ICR7eH1gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfSU5WQUxJRF9PUklHSU4gZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9JTlZBTElEX09SSUdJTlwiLFxuICAgICAgYEhUVFAvMiBPUklHSU4gZnJhbWVzIHJlcXVpcmUgYSB2YWxpZCBvcmlnaW5gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfSU5WQUxJRF9QQUNLRURfU0VUVElOR1NfTEVOR1RIIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX0lOVkFMSURfUEFDS0VEX1NFVFRJTkdTX0xFTkdUSFwiLFxuICAgICAgYFBhY2tlZCBzZXR0aW5ncyBsZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIHNpeGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9JTlZBTElEX1BTRVVET0hFQURFUiBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX0lOVkFMSURfUFNFVURPSEVBREVSXCIsXG4gICAgICBgXCIke3h9XCIgaXMgYW4gaW52YWxpZCBwc2V1ZG9oZWFkZXIgb3IgaXMgdXNlZCBpbmNvcnJlY3RseWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9JTlZBTElEX1NFU1NJT04gZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9IVFRQMl9JTlZBTElEX1NFU1NJT05cIiwgYFRoZSBzZXNzaW9uIGhhcyBiZWVuIGRlc3Ryb3llZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX0lOVkFMSURfU1RSRUFNIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSFRUUDJfSU5WQUxJRF9TVFJFQU1cIiwgYFRoZSBzdHJlYW0gaGFzIGJlZW4gZGVzdHJveWVkYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfTUFYX1BFTkRJTkdfU0VUVElOR1NfQUNLIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9NQVhfUEVORElOR19TRVRUSU5HU19BQ0tcIixcbiAgICAgIGBNYXhpbXVtIG51bWJlciBvZiBwZW5kaW5nIHNldHRpbmdzIGFja25vd2xlZGdlbWVudHNgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfTkVTVEVEX1BVU0ggZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX05FU1RFRF9QVVNIXCIsXG4gICAgICBgQSBwdXNoIHN0cmVhbSBjYW5ub3QgaW5pdGlhdGUgYW5vdGhlciBwdXNoIHN0cmVhbS5gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfTk9fU09DS0VUX01BTklQVUxBVElPTiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfTk9fU09DS0VUX01BTklQVUxBVElPTlwiLFxuICAgICAgYEhUVFAvMiBzb2NrZXRzIHNob3VsZCBub3QgYmUgZGlyZWN0bHkgbWFuaXB1bGF0ZWQgKGUuZy4gcmVhZCBhbmQgd3JpdHRlbilgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfT1JJR0lOX0xFTkdUSCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX09SSUdJTl9MRU5HVEhcIixcbiAgICAgIGBIVFRQLzIgT1JJR0lOIGZyYW1lcyBhcmUgbGltaXRlZCB0byAxNjM4MiBieXRlc2AsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9PVVRfT0ZfU1RSRUFNUyBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfT1VUX09GX1NUUkVBTVNcIixcbiAgICAgIGBObyBzdHJlYW0gSUQgaXMgYXZhaWxhYmxlIGJlY2F1c2UgbWF4aW11bSBzdHJlYW0gSUQgaGFzIGJlZW4gcmVhY2hlZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9QQVlMT0FEX0ZPUkJJRERFTiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfUEFZTE9BRF9GT1JCSURERU5cIixcbiAgICAgIGBSZXNwb25zZXMgd2l0aCAke3h9IHN0YXR1cyBtdXN0IG5vdCBoYXZlIGEgcGF5bG9hZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9QSU5HX0NBTkNFTCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0hUVFAyX1BJTkdfQ0FOQ0VMXCIsIGBIVFRQMiBwaW5nIGNhbmNlbGxlZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1BJTkdfTEVOR1RIIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9IVFRQMl9QSU5HX0xFTkdUSFwiLCBgSFRUUDIgcGluZyBwYXlsb2FkIG11c3QgYmUgOCBieXRlc2ApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1BTRVVET0hFQURFUl9OT1RfQUxMT1dFRCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX1BTRVVET0hFQURFUl9OT1RfQUxMT1dFRFwiLFxuICAgICAgYENhbm5vdCBzZXQgSFRUUC8yIHBzZXVkby1oZWFkZXJzYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1BVU0hfRElTQUJMRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9IVFRQMl9QVVNIX0RJU0FCTEVEXCIsIGBIVFRQLzIgY2xpZW50IGhhcyBkaXNhYmxlZCBwdXNoIHN0cmVhbXNgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9TRU5EX0ZJTEUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9IVFRQMl9TRU5EX0ZJTEVcIiwgYERpcmVjdG9yaWVzIGNhbm5vdCBiZSBzZW50YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfU0VORF9GSUxFX05PU0VFSyBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfU0VORF9GSUxFX05PU0VFS1wiLFxuICAgICAgYE9mZnNldCBvciBsZW5ndGggY2FuIG9ubHkgYmUgc3BlY2lmaWVkIGZvciByZWd1bGFyIGZpbGVzYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1NFU1NJT05fRVJST1IgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9IVFRQMl9TRVNTSU9OX0VSUk9SXCIsIGBTZXNzaW9uIGNsb3NlZCB3aXRoIGVycm9yIGNvZGUgJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1NFVFRJTkdTX0NBTkNFTCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0hUVFAyX1NFVFRJTkdTX0NBTkNFTFwiLCBgSFRUUDIgc2Vzc2lvbiBzZXR0aW5ncyBjYW5jZWxlZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1NPQ0tFVF9CT1VORCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfU09DS0VUX0JPVU5EXCIsXG4gICAgICBgVGhlIHNvY2tldCBpcyBhbHJlYWR5IGJvdW5kIHRvIGFuIEh0dHAyU2Vzc2lvbmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9TT0NLRVRfVU5CT1VORCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfU09DS0VUX1VOQk9VTkRcIixcbiAgICAgIGBUaGUgc29ja2V0IGhhcyBiZWVuIGRpc2Nvbm5lY3RlZCBmcm9tIHRoZSBIdHRwMlNlc3Npb25gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfU1RBVFVTXzEwMSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfU1RBVFVTXzEwMVwiLFxuICAgICAgYEhUVFAgc3RhdHVzIGNvZGUgMTAxIChTd2l0Y2hpbmcgUHJvdG9jb2xzKSBpcyBmb3JiaWRkZW4gaW4gSFRUUC8yYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1NUQVRVU19JTlZBTElEIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9IVFRQMl9TVEFUVVNfSU5WQUxJRFwiLCBgSW52YWxpZCBzdGF0dXMgY29kZTogJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1NUUkVBTV9FUlJPUiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0hUVFAyX1NUUkVBTV9FUlJPUlwiLCBgU3RyZWFtIGNsb3NlZCB3aXRoIGVycm9yIGNvZGUgJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1NUUkVBTV9TRUxGX0RFUEVOREVOQ1kgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX1NUUkVBTV9TRUxGX0RFUEVOREVOQ1lcIixcbiAgICAgIGBBIHN0cmVhbSBjYW5ub3QgZGVwZW5kIG9uIGl0c2VsZmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9UUkFJTEVSU19BTFJFQURZX1NFTlQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX1RSQUlMRVJTX0FMUkVBRFlfU0VOVFwiLFxuICAgICAgYFRyYWlsaW5nIGhlYWRlcnMgaGF2ZSBhbHJlYWR5IGJlZW4gc2VudGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9UUkFJTEVSU19OT1RfUkVBRFkgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX1RSQUlMRVJTX05PVF9SRUFEWVwiLFxuICAgICAgYFRyYWlsaW5nIGhlYWRlcnMgY2Fubm90IGJlIHNlbnQgdW50aWwgYWZ0ZXIgdGhlIHdhbnRUcmFpbGVycyBldmVudCBpcyBlbWl0dGVkYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1VOU1VQUE9SVEVEX1BST1RPQ09MIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfSFRUUDJfVU5TVVBQT1JURURfUFJPVE9DT0xcIiwgYHByb3RvY29sIFwiJHt4fVwiIGlzIHVuc3VwcG9ydGVkLmApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFBfSEVBREVSU19TRU5UIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQX0hFQURFUlNfU0VOVFwiLFxuICAgICAgYENhbm5vdCAke3h9IGhlYWRlcnMgYWZ0ZXIgdGhleSBhcmUgc2VudCB0byB0aGUgY2xpZW50YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFBfSU5WQUxJRF9IRUFERVJfVkFMVUUgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFBfSU5WQUxJRF9IRUFERVJfVkFMVUVcIixcbiAgICAgIGBJbnZhbGlkIHZhbHVlIFwiJHt4fVwiIGZvciBoZWFkZXIgXCIke3l9XCJgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUF9JTlZBTElEX1NUQVRVU19DT0RFIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9IVFRQX0lOVkFMSURfU1RBVFVTX0NPREVcIiwgYEludmFsaWQgc3RhdHVzIGNvZGU6ICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQX1NPQ0tFVF9FTkNPRElORyBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUF9TT0NLRVRfRU5DT0RJTkdcIixcbiAgICAgIGBDaGFuZ2luZyB0aGUgc29ja2V0IGVuY29kaW5nIGlzIG5vdCBhbGxvd2VkIHBlciBSRkM3MjMwIFNlY3Rpb24gMy5gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUF9UUkFJTEVSX0lOVkFMSUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFBfVFJBSUxFUl9JTlZBTElEXCIsXG4gICAgICBgVHJhaWxlcnMgYXJlIGludmFsaWQgd2l0aCB0aGlzIHRyYW5zZmVyIGVuY29kaW5nYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOQ09NUEFUSUJMRV9PUFRJT05fUEFJUiBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5DT01QQVRJQkxFX09QVElPTl9QQUlSXCIsXG4gICAgICBgT3B0aW9uIFwiJHt4fVwiIGNhbm5vdCBiZSB1c2VkIGluIGNvbWJpbmF0aW9uIHdpdGggb3B0aW9uIFwiJHt5fVwiYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOUFVUX1RZUEVfTk9UX0FMTE9XRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOUFVUX1RZUEVfTk9UX0FMTE9XRURcIixcbiAgICAgIGAtLWlucHV0LXR5cGUgY2FuIG9ubHkgYmUgdXNlZCB3aXRoIHN0cmluZyBpbnB1dCB2aWEgLS1ldmFsLCAtLXByaW50LCBvciBTVERJTmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlNQRUNUT1JfQUxSRUFEWV9BQ1RJVkFURUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOU1BFQ1RPUl9BTFJFQURZX0FDVElWQVRFRFwiLFxuICAgICAgYEluc3BlY3RvciBpcyBhbHJlYWR5IGFjdGl2YXRlZC4gQ2xvc2UgaXQgd2l0aCBpbnNwZWN0b3IuY2xvc2UoKSBiZWZvcmUgYWN0aXZhdGluZyBpdCBhZ2Fpbi5gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5TUEVDVE9SX0FMUkVBRFlfQ09OTkVDVEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5TUEVDVE9SX0FMUkVBRFlfQ09OTkVDVEVEXCIsIGAke3h9IGlzIGFscmVhZHkgY29ubmVjdGVkYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5TUEVDVE9SX0NMT1NFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0lOU1BFQ1RPUl9DTE9TRURcIiwgYFNlc3Npb24gd2FzIGNsb3NlZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOU1BFQ1RPUl9DT01NQU5EIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogbnVtYmVyLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9JTlNQRUNUT1JfQ09NTUFORFwiLCBgSW5zcGVjdG9yIGVycm9yICR7eH06ICR7eX1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlNQRUNUT1JfTk9UX0FDVElWRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0lOU1BFQ1RPUl9OT1RfQUNUSVZFXCIsIGBJbnNwZWN0b3IgaXMgbm90IGFjdGl2ZWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOU1BFQ1RPUl9OT1RfQVZBSUxBQkxFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5TUEVDVE9SX05PVF9BVkFJTEFCTEVcIiwgYEluc3BlY3RvciBpcyBub3QgYXZhaWxhYmxlYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5TUEVDVE9SX05PVF9DT05ORUNURUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9JTlNQRUNUT1JfTk9UX0NPTk5FQ1RFRFwiLCBgU2Vzc2lvbiBpcyBub3QgY29ubmVjdGVkYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5TUEVDVE9SX05PVF9XT1JLRVIgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9JTlNQRUNUT1JfTk9UX1dPUktFUlwiLCBgQ3VycmVudCB0aHJlYWQgaXMgbm90IGEgd29ya2VyYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9BU1lOQ19JRCBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcgfCBudW1iZXIpIHtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX0FTWU5DX0lEXCIsIGBJbnZhbGlkICR7eH0gdmFsdWU6ICR7eX1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX0JVRkZFUl9TSVpFIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX0JVRkZFUl9TSVpFXCIsIGBCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgbXVsdGlwbGUgb2YgJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfQ0FMTEJBQ0sgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3Iob2JqZWN0OiB1bmtub3duKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlZBTElEX0NBTExCQUNLXCIsXG4gICAgICBgQ2FsbGJhY2sgbXVzdCBiZSBhIGZ1bmN0aW9uLiBSZWNlaXZlZCAke2luc3BlY3Qob2JqZWN0KX1gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9DVVJTT1JfUE9TIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9DVVJTT1JfUE9TXCIsXG4gICAgICBgQ2Fubm90IHNldCBjdXJzb3Igcm93IHdpdGhvdXQgc2V0dGluZyBpdHMgY29sdW1uYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfRkQgZXh0ZW5kcyBOb2RlUmFuZ2VFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0lOVkFMSURfRkRcIiwgYFwiZmRcIiBtdXN0IGJlIGEgcG9zaXRpdmUgaW50ZWdlcjogJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfRkRfVFlQRSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX0ZEX1RZUEVcIiwgYFVuc3VwcG9ydGVkIGZkIHR5cGU6ICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX0ZJTEVfVVJMX0hPU1QgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlZBTElEX0ZJTEVfVVJMX0hPU1RcIixcbiAgICAgIGBGaWxlIFVSTCBob3N0IG11c3QgYmUgXCJsb2NhbGhvc3RcIiBvciBlbXB0eSBvbiAke3h9YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfRklMRV9VUkxfUEFUSCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX0ZJTEVfVVJMX1BBVEhcIiwgYEZpbGUgVVJMIHBhdGggJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfSEFORExFX1RZUEUgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9IQU5ETEVfVFlQRVwiLCBgVGhpcyBoYW5kbGUgdHlwZSBjYW5ub3QgYmUgc2VudGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfSFRUUF9UT0tFTiBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0lOVkFMSURfSFRUUF9UT0tFTlwiLCBgJHt4fSBtdXN0IGJlIGEgdmFsaWQgSFRUUCB0b2tlbiBbXCIke3l9XCJdYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9JUF9BRERSRVNTIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0lOVkFMSURfSVBfQUREUkVTU1wiLCBgSW52YWxpZCBJUCBhZGRyZXNzOiAke3h9YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9PUFRfVkFMVUVfRU5DT0RJTkcgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlZBTElEX09QVF9WQUxVRV9FTkNPRElOR1wiLFxuICAgICAgYFRoZSB2YWx1ZSBcIiR7eH1cIiBpcyBpbnZhbGlkIGZvciBvcHRpb24gXCJlbmNvZGluZ1wiYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfUEVSRk9STUFOQ0VfTUFSSyBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9QRVJGT1JNQU5DRV9NQVJLXCIsXG4gICAgICBgVGhlIFwiJHt4fVwiIHBlcmZvcm1hbmNlIG1hcmsgaGFzIG5vdCBiZWVuIHNldGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX1BST1RPQ09MIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZywgeTogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlZBTElEX1BST1RPQ09MXCIsXG4gICAgICBgUHJvdG9jb2wgXCIke3h9XCIgbm90IHN1cHBvcnRlZC4gRXhwZWN0ZWQgXCIke3l9XCJgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9SRVBMX0VWQUxfQ09ORklHIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9SRVBMX0VWQUxfQ09ORklHXCIsXG4gICAgICBgQ2Fubm90IHNwZWNpZnkgYm90aCBcImJyZWFrRXZhbE9uU2lnaW50XCIgYW5kIFwiZXZhbFwiIGZvciBSRVBMYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfUkVQTF9JTlBVVCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX1JFUExfSU5QVVRcIiwgYCR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX1NZTkNfRk9SS19JTlBVVCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOVkFMSURfU1lOQ19GT1JLX0lOUFVUXCIsXG4gICAgICBgQXN5bmNocm9ub3VzIGZvcmtzIGRvIG5vdCBzdXBwb3J0IEJ1ZmZlciwgVHlwZWRBcnJheSwgRGF0YVZpZXcgb3Igc3RyaW5nIGlucHV0OiAke3h9YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfVEhJUyBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX1RISVNcIiwgYFZhbHVlIG9mIFwidGhpc1wiIG11c3QgYmUgb2YgdHlwZSAke3h9YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9UVVBMRSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0lOVkFMSURfVFVQTEVcIiwgYCR7eH0gbXVzdCBiZSBhbiBpdGVyYWJsZSAke3l9IHR1cGxlYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9VUkkgZXh0ZW5kcyBOb2RlVVJJRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX1VSSVwiLCBgVVJJIG1hbGZvcm1lZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lQQ19DSEFOTkVMX0NMT1NFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0lQQ19DSEFOTkVMX0NMT1NFRFwiLCBgQ2hhbm5lbCBjbG9zZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JUENfRElTQ09OTkVDVEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSVBDX0RJU0NPTk5FQ1RFRFwiLCBgSVBDIGNoYW5uZWwgaXMgYWxyZWFkeSBkaXNjb25uZWN0ZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JUENfT05FX1BJUEUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9JUENfT05FX1BJUEVcIiwgYENoaWxkIHByb2Nlc3MgY2FuIGhhdmUgb25seSBvbmUgSVBDIHBpcGVgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JUENfU1lOQ19GT1JLIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSVBDX1NZTkNfRk9SS1wiLCBgSVBDIGNhbm5vdCBiZSB1c2VkIHdpdGggc3luY2hyb25vdXMgZm9ya3NgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9NQU5JRkVTVF9ERVBFTkRFTkNZX01JU1NJTkcgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfTUFOSUZFU1RfREVQRU5ERU5DWV9NSVNTSU5HXCIsXG4gICAgICBgTWFuaWZlc3QgcmVzb3VyY2UgJHt4fSBkb2VzIG5vdCBsaXN0ICR7eX0gYXMgYSBkZXBlbmRlbmN5IHNwZWNpZmllcmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9NQU5JRkVTVF9JTlRFR1JJVFlfTUlTTUFUQ0ggZXh0ZW5kcyBOb2RlU3ludGF4RXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX01BTklGRVNUX0lOVEVHUklUWV9NSVNNQVRDSFwiLFxuICAgICAgYE1hbmlmZXN0IHJlc291cmNlICR7eH0gaGFzIG11bHRpcGxlIGVudHJpZXMgYnV0IGludGVncml0eSBsaXN0cyBkbyBub3QgbWF0Y2hgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTUFOSUZFU1RfSU5WQUxJRF9SRVNPVVJDRV9GSUVMRCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfTUFOSUZFU1RfSU5WQUxJRF9SRVNPVVJDRV9GSUVMRFwiLFxuICAgICAgYE1hbmlmZXN0IHJlc291cmNlICR7eH0gaGFzIGludmFsaWQgcHJvcGVydHkgdmFsdWUgZm9yICR7eX1gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTUFOSUZFU1RfVERaIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfTUFOSUZFU1RfVERaXCIsIGBNYW5pZmVzdCBpbml0aWFsaXphdGlvbiBoYXMgbm90IHlldCBydW5gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9NQU5JRkVTVF9VTktOT1dOX09ORVJST1IgZXh0ZW5kcyBOb2RlU3ludGF4RXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX01BTklGRVNUX1VOS05PV05fT05FUlJPUlwiLFxuICAgICAgYE1hbmlmZXN0IHNwZWNpZmllZCB1bmtub3duIGVycm9yIGJlaGF2aW9yIFwiJHt4fVwiLmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9NRVRIT0RfTk9UX0lNUExFTUVOVEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfTUVUSE9EX05PVF9JTVBMRU1FTlRFRFwiLCBgVGhlICR7eH0gbWV0aG9kIGlzIG5vdCBpbXBsZW1lbnRlZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX01JU1NJTkdfQVJHUyBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvciguLi5hcmdzOiAoc3RyaW5nIHwgc3RyaW5nW10pW10pIHtcbiAgICBsZXQgbXNnID0gXCJUaGUgXCI7XG5cbiAgICBjb25zdCBsZW4gPSBhcmdzLmxlbmd0aDtcblxuICAgIGNvbnN0IHdyYXAgPSAoYTogdW5rbm93bikgPT4gYFwiJHthfVwiYDtcblxuICAgIGFyZ3MgPSBhcmdzLm1hcCgoYSkgPT5cbiAgICAgIEFycmF5LmlzQXJyYXkoYSkgPyBhLm1hcCh3cmFwKS5qb2luKFwiIG9yIFwiKSA6IHdyYXAoYSlcbiAgICApO1xuXG4gICAgc3dpdGNoIChsZW4pIHtcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgbXNnICs9IGAke2FyZ3NbMF19IGFyZ3VtZW50YDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIG1zZyArPSBgJHthcmdzWzBdfSBhbmQgJHthcmdzWzFdfSBhcmd1bWVudHNgO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIG1zZyArPSBhcmdzLnNsaWNlKDAsIGxlbiAtIDEpLmpvaW4oXCIsIFwiKTtcbiAgICAgICAgbXNnICs9IGAsIGFuZCAke2FyZ3NbbGVuIC0gMV19IGFyZ3VtZW50c2A7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHN1cGVyKFwiRVJSX01JU1NJTkdfQVJHU1wiLCBgJHttc2d9IG11c3QgYmUgc3BlY2lmaWVkYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTUlTU0lOR19PUFRJT04gZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfTUlTU0lOR19PUFRJT05cIiwgYCR7eH0gaXMgcmVxdWlyZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9NVUxUSVBMRV9DQUxMQkFDSyBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX01VTFRJUExFX0NBTExCQUNLXCIsIGBDYWxsYmFjayBjYWxsZWQgbXVsdGlwbGUgdGltZXNgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9OQVBJX0NPTlNfRlVOQ1RJT04gZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfTkFQSV9DT05TX0ZVTkNUSU9OXCIsIGBDb25zdHJ1Y3RvciBtdXN0IGJlIGEgZnVuY3Rpb25gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9OQVBJX0lOVkFMSURfREFUQVZJRVdfQVJHUyBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9OQVBJX0lOVkFMSURfREFUQVZJRVdfQVJHU1wiLFxuICAgICAgYGJ5dGVfb2Zmc2V0ICsgYnl0ZV9sZW5ndGggc2hvdWxkIGJlIGxlc3MgdGhhbiBvciBlcXVhbCB0byB0aGUgc2l6ZSBpbiBieXRlcyBvZiB0aGUgYXJyYXkgcGFzc2VkIGluYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX05BUElfSU5WQUxJRF9UWVBFREFSUkFZX0FMSUdOTUVOVCBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX05BUElfSU5WQUxJRF9UWVBFREFSUkFZX0FMSUdOTUVOVFwiLFxuICAgICAgYHN0YXJ0IG9mZnNldCBvZiAke3h9IHNob3VsZCBiZSBhIG11bHRpcGxlIG9mICR7eX1gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTkFQSV9JTlZBTElEX1RZUEVEQVJSQVlfTEVOR1RIIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9OQVBJX0lOVkFMSURfVFlQRURBUlJBWV9MRU5HVEhcIiwgYEludmFsaWQgdHlwZWQgYXJyYXkgbGVuZ3RoYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTk9fQ1JZUFRPIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9OT19DUllQVE9cIixcbiAgICAgIGBOb2RlLmpzIGlzIG5vdCBjb21waWxlZCB3aXRoIE9wZW5TU0wgY3J5cHRvIHN1cHBvcnRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTk9fSUNVIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfTk9fSUNVXCIsXG4gICAgICBgJHt4fSBpcyBub3Qgc3VwcG9ydGVkIG9uIE5vZGUuanMgY29tcGlsZWQgd2l0aG91dCBJQ1VgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfUVVJQ0NMSUVOVFNFU1NJT05fRkFJTEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9RVUlDQ0xJRU5UU0VTU0lPTl9GQUlMRURcIixcbiAgICAgIGBGYWlsZWQgdG8gY3JlYXRlIGEgbmV3IFF1aWNDbGllbnRTZXNzaW9uOiAke3h9YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1FVSUNDTElFTlRTRVNTSU9OX0ZBSUxFRF9TRVRTT0NLRVQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1FVSUNDTElFTlRTRVNTSU9OX0ZBSUxFRF9TRVRTT0NLRVRcIixcbiAgICAgIGBGYWlsZWQgdG8gc2V0IHRoZSBRdWljU29ja2V0YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1FVSUNTRVNTSU9OX0RFU1RST1lFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfUVVJQ1NFU1NJT05fREVTVFJPWUVEXCIsXG4gICAgICBgQ2Fubm90IGNhbGwgJHt4fSBhZnRlciBhIFF1aWNTZXNzaW9uIGhhcyBiZWVuIGRlc3Ryb3llZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9RVUlDU0VTU0lPTl9JTlZBTElEX0RDSUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9RVUlDU0VTU0lPTl9JTlZBTElEX0RDSURcIiwgYEludmFsaWQgRENJRCB2YWx1ZTogJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1FVSUNTRVNTSU9OX1VQREFURUtFWSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1FVSUNTRVNTSU9OX1VQREFURUtFWVwiLCBgVW5hYmxlIHRvIHVwZGF0ZSBRdWljU2Vzc2lvbiBrZXlzYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfUVVJQ1NPQ0tFVF9ERVNUUk9ZRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1FVSUNTT0NLRVRfREVTVFJPWUVEXCIsXG4gICAgICBgQ2Fubm90IGNhbGwgJHt4fSBhZnRlciBhIFF1aWNTb2NrZXQgaGFzIGJlZW4gZGVzdHJveWVkYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1FVSUNTT0NLRVRfSU5WQUxJRF9TVEFURUxFU1NfUkVTRVRfU0VDUkVUX0xFTkdUSFxuICBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfUVVJQ1NPQ0tFVF9JTlZBTElEX1NUQVRFTEVTU19SRVNFVF9TRUNSRVRfTEVOR1RIXCIsXG4gICAgICBgVGhlIHN0YXRlUmVzZXRUb2tlbiBtdXN0IGJlIGV4YWN0bHkgMTYtYnl0ZXMgaW4gbGVuZ3RoYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1FVSUNTT0NLRVRfTElTVEVOSU5HIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfUVVJQ1NPQ0tFVF9MSVNURU5JTkdcIiwgYFRoaXMgUXVpY1NvY2tldCBpcyBhbHJlYWR5IGxpc3RlbmluZ2ApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1FVSUNTT0NLRVRfVU5CT1VORCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfUVVJQ1NPQ0tFVF9VTkJPVU5EXCIsXG4gICAgICBgQ2Fubm90IGNhbGwgJHt4fSBiZWZvcmUgYSBRdWljU29ja2V0IGhhcyBiZWVuIGJvdW5kYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1FVSUNTVFJFQU1fREVTVFJPWUVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9RVUlDU1RSRUFNX0RFU1RST1lFRFwiLFxuICAgICAgYENhbm5vdCBjYWxsICR7eH0gYWZ0ZXIgYSBRdWljU3RyZWFtIGhhcyBiZWVuIGRlc3Ryb3llZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9RVUlDU1RSRUFNX0lOVkFMSURfUFVTSCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfUVVJQ1NUUkVBTV9JTlZBTElEX1BVU0hcIixcbiAgICAgIGBQdXNoIHN0cmVhbXMgYXJlIG9ubHkgc3VwcG9ydGVkIG9uIGNsaWVudC1pbml0aWF0ZWQsIGJpZGlyZWN0aW9uYWwgc3RyZWFtc2AsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9RVUlDU1RSRUFNX09QRU5fRkFJTEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfUVVJQ1NUUkVBTV9PUEVOX0ZBSUxFRFwiLCBgT3BlbmluZyBhIG5ldyBRdWljU3RyZWFtIGZhaWxlZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1FVSUNTVFJFQU1fVU5TVVBQT1JURURfUFVTSCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfUVVJQ1NUUkVBTV9VTlNVUFBPUlRFRF9QVVNIXCIsXG4gICAgICBgUHVzaCBzdHJlYW1zIGFyZSBub3Qgc3VwcG9ydGVkIG9uIHRoaXMgUXVpY1Nlc3Npb25gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfUVVJQ19UTFMxM19SRVFVSVJFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1FVSUNfVExTMTNfUkVRVUlSRURcIiwgYFFVSUMgcmVxdWlyZXMgVExTIHZlcnNpb24gMS4zYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfU0NSSVBUX0VYRUNVVElPTl9JTlRFUlJVUFRFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfU0NSSVBUX0VYRUNVVElPTl9JTlRFUlJVUFRFRFwiLFxuICAgICAgXCJTY3JpcHQgZXhlY3V0aW9uIHdhcyBpbnRlcnJ1cHRlZCBieSBgU0lHSU5UYFwiLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfU0VSVkVSX0FMUkVBRFlfTElTVEVOIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9TRVJWRVJfQUxSRUFEWV9MSVNURU5cIixcbiAgICAgIGBMaXN0ZW4gbWV0aG9kIGhhcyBiZWVuIGNhbGxlZCBtb3JlIHRoYW4gb25jZSB3aXRob3V0IGNsb3NpbmcuYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NFUlZFUl9OT1RfUlVOTklORyBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1NFUlZFUl9OT1RfUlVOTklOR1wiLCBgU2VydmVyIGlzIG5vdCBydW5uaW5nLmApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NPQ0tFVF9BTFJFQURZX0JPVU5EIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfU09DS0VUX0FMUkVBRFlfQk9VTkRcIiwgYFNvY2tldCBpcyBhbHJlYWR5IGJvdW5kYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfU09DS0VUX0JBRF9CVUZGRVJfU0laRSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1NPQ0tFVF9CQURfQlVGRkVSX1NJWkVcIixcbiAgICAgIGBCdWZmZXIgc2l6ZSBtdXN0IGJlIGEgcG9zaXRpdmUgaW50ZWdlcmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TT0NLRVRfQkFEX1BPUlQgZXh0ZW5kcyBOb2RlUmFuZ2VFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgcG9ydDogdW5rbm93biwgYWxsb3daZXJvID0gdHJ1ZSkge1xuICAgIGFzc2VydChcbiAgICAgIHR5cGVvZiBhbGxvd1plcm8gPT09IFwiYm9vbGVhblwiLFxuICAgICAgXCJUaGUgJ2FsbG93WmVybycgYXJndW1lbnQgbXVzdCBiZSBvZiB0eXBlIGJvb2xlYW4uXCIsXG4gICAgKTtcblxuICAgIGNvbnN0IG9wZXJhdG9yID0gYWxsb3daZXJvID8gXCI+PVwiIDogXCI+XCI7XG5cbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1NPQ0tFVF9CQURfUE9SVFwiLFxuICAgICAgYCR7bmFtZX0gc2hvdWxkIGJlICR7b3BlcmF0b3J9IDAgYW5kIDwgNjU1MzYuIFJlY2VpdmVkICR7cG9ydH0uYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NPQ0tFVF9CQURfVFlQRSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1NPQ0tFVF9CQURfVFlQRVwiLFxuICAgICAgYEJhZCBzb2NrZXQgdHlwZSBzcGVjaWZpZWQuIFZhbGlkIHR5cGVzIGFyZTogdWRwNCwgdWRwNmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TT0NLRVRfQ0xPU0VEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfU09DS0VUX0NMT1NFRFwiLCBgU29ja2V0IGlzIGNsb3NlZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NPQ0tFVF9ER1JBTV9JU19DT05ORUNURUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9TT0NLRVRfREdSQU1fSVNfQ09OTkVDVEVEXCIsIGBBbHJlYWR5IGNvbm5lY3RlZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NPQ0tFVF9ER1JBTV9OT1RfQ09OTkVDVEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfU09DS0VUX0RHUkFNX05PVF9DT05ORUNURURcIiwgYE5vdCBjb25uZWN0ZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TT0NLRVRfREdSQU1fTk9UX1JVTk5JTkcgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9TT0NLRVRfREdSQU1fTk9UX1JVTk5JTkdcIiwgYE5vdCBydW5uaW5nYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfU1JJX1BBUlNFIGV4dGVuZHMgTm9kZVN5bnRheEVycm9yIHtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBjaGFyOiBzdHJpbmcsIHBvc2l0aW9uOiBudW1iZXIpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1NSSV9QQVJTRVwiLFxuICAgICAgYFN1YnJlc291cmNlIEludGVncml0eSBzdHJpbmcgJHtuYW1lfSBoYWQgYW4gdW5leHBlY3RlZCAke2NoYXJ9IGF0IHBvc2l0aW9uICR7cG9zaXRpb259YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NUUkVBTV9BTFJFQURZX0ZJTklTSEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9TVFJFQU1fQUxSRUFEWV9GSU5JU0hFRFwiLFxuICAgICAgYENhbm5vdCBjYWxsICR7eH0gYWZ0ZXIgYSBzdHJlYW0gd2FzIGZpbmlzaGVkYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NUUkVBTV9DQU5OT1RfUElQRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1NUUkVBTV9DQU5OT1RfUElQRVwiLCBgQ2Fubm90IHBpcGUsIG5vdCByZWFkYWJsZWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NUUkVBTV9ERVNUUk9ZRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1NUUkVBTV9ERVNUUk9ZRURcIixcbiAgICAgIGBDYW5ub3QgY2FsbCAke3h9IGFmdGVyIGEgc3RyZWFtIHdhcyBkZXN0cm95ZWRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfU1RSRUFNX05VTExfVkFMVUVTIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1NUUkVBTV9OVUxMX1ZBTFVFU1wiLCBgTWF5IG5vdCB3cml0ZSBudWxsIHZhbHVlcyB0byBzdHJlYW1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TVFJFQU1fUFJFTUFUVVJFX0NMT1NFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfU1RSRUFNX1BSRU1BVFVSRV9DTE9TRVwiLCBgUHJlbWF0dXJlIGNsb3NlYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfU1RSRUFNX1BVU0hfQUZURVJfRU9GIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfU1RSRUFNX1BVU0hfQUZURVJfRU9GXCIsIGBzdHJlYW0ucHVzaCgpIGFmdGVyIEVPRmApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NUUkVBTV9VTlNISUZUX0FGVEVSX0VORF9FVkVOVCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfU1RSRUFNX1VOU0hJRlRfQUZURVJfRU5EX0VWRU5UXCIsXG4gICAgICBgc3RyZWFtLnVuc2hpZnQoKSBhZnRlciBlbmQgZXZlbnRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfU1RSRUFNX1dSQVAgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1NUUkVBTV9XUkFQXCIsXG4gICAgICBgU3RyZWFtIGhhcyBTdHJpbmdEZWNvZGVyIHNldCBvciBpcyBpbiBvYmplY3RNb2RlYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NUUkVBTV9XUklURV9BRlRFUl9FTkQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9TVFJFQU1fV1JJVEVfQUZURVJfRU5EXCIsIGB3cml0ZSBhZnRlciBlbmRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TWU5USEVUSUMgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9TWU5USEVUSUNcIiwgYEphdmFTY3JpcHQgQ2FsbHN0YWNrYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVExTX0NFUlRfQUxUTkFNRV9JTlZBTElEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgcmVhc29uOiBzdHJpbmc7XG4gIGhvc3Q6IHN0cmluZztcbiAgY2VydDogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKHJlYXNvbjogc3RyaW5nLCBob3N0OiBzdHJpbmcsIGNlcnQ6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVExTX0NFUlRfQUxUTkFNRV9JTlZBTElEXCIsXG4gICAgICBgSG9zdG5hbWUvSVAgZG9lcyBub3QgbWF0Y2ggY2VydGlmaWNhdGUncyBhbHRuYW1lczogJHtyZWFzb259YCxcbiAgICApO1xuICAgIHRoaXMucmVhc29uID0gcmVhc29uO1xuICAgIHRoaXMuaG9zdCA9IGhvc3Q7XG4gICAgdGhpcy5jZXJ0ID0gY2VydDtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9UTFNfREhfUEFSQU1fU0laRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX1RMU19ESF9QQVJBTV9TSVpFXCIsIGBESCBwYXJhbWV0ZXIgc2l6ZSAke3h9IGlzIGxlc3MgdGhhbiAyMDQ4YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVExTX0hBTkRTSEFLRV9USU1FT1VUIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfVExTX0hBTkRTSEFLRV9USU1FT1VUXCIsIGBUTFMgaGFuZHNoYWtlIHRpbWVvdXRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9UTFNfSU5WQUxJRF9DT05URVhUIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX1RMU19JTlZBTElEX0NPTlRFWFRcIiwgYCR7eH0gbXVzdCBiZSBhIFNlY3VyZUNvbnRleHRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9UTFNfSU5WQUxJRF9TVEFURSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVExTX0lOVkFMSURfU1RBVEVcIixcbiAgICAgIGBUTFMgc29ja2V0IGNvbm5lY3Rpb24gbXVzdCBiZSBzZWN1cmVseSBlc3RhYmxpc2hlZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9UTFNfSU5WQUxJRF9QUk9UT0NPTF9WRVJTSU9OIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHByb3RvY29sOiBzdHJpbmcsIHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVExTX0lOVkFMSURfUFJPVE9DT0xfVkVSU0lPTlwiLFxuICAgICAgYCR7cHJvdG9jb2x9IGlzIG5vdCBhIHZhbGlkICR7eH0gVExTIHByb3RvY29sIHZlcnNpb25gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVExTX1BST1RPQ09MX1ZFUlNJT05fQ09ORkxJQ1QgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IocHJldlByb3RvY29sOiBzdHJpbmcsIHByb3RvY29sOiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1RMU19QUk9UT0NPTF9WRVJTSU9OX0NPTkZMSUNUXCIsXG4gICAgICBgVExTIHByb3RvY29sIHZlcnNpb24gJHtwcmV2UHJvdG9jb2x9IGNvbmZsaWN0cyB3aXRoIHNlY3VyZVByb3RvY29sICR7cHJvdG9jb2x9YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1RMU19SRU5FR09USUFUSU9OX0RJU0FCTEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9UTFNfUkVORUdPVElBVElPTl9ESVNBQkxFRFwiLFxuICAgICAgYFRMUyBzZXNzaW9uIHJlbmVnb3RpYXRpb24gZGlzYWJsZWQgZm9yIHRoaXMgc29ja2V0YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1RMU19SRVFVSVJFRF9TRVJWRVJfTkFNRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVExTX1JFUVVJUkVEX1NFUlZFUl9OQU1FXCIsXG4gICAgICBgXCJzZXJ2ZXJuYW1lXCIgaXMgcmVxdWlyZWQgcGFyYW1ldGVyIGZvciBTZXJ2ZXIuYWRkQ29udGV4dGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9UTFNfU0VTU0lPTl9BVFRBQ0sgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1RMU19TRVNTSU9OX0FUVEFDS1wiLFxuICAgICAgYFRMUyBzZXNzaW9uIHJlbmVnb3RpYXRpb24gYXR0YWNrIGRldGVjdGVkYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1RMU19TTklfRlJPTV9TRVJWRVIgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1RMU19TTklfRlJPTV9TRVJWRVJcIixcbiAgICAgIGBDYW5ub3QgaXNzdWUgU05JIGZyb20gYSBUTFMgc2VydmVyLXNpZGUgc29ja2V0YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1RSQUNFX0VWRU5UU19DQVRFR09SWV9SRVFVSVJFRCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1RSQUNFX0VWRU5UU19DQVRFR09SWV9SRVFVSVJFRFwiLFxuICAgICAgYEF0IGxlYXN0IG9uZSBjYXRlZ29yeSBpcyByZXF1aXJlZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9UUkFDRV9FVkVOVFNfVU5BVkFJTEFCTEUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9UUkFDRV9FVkVOVFNfVU5BVkFJTEFCTEVcIiwgYFRyYWNlIGV2ZW50cyBhcmUgdW5hdmFpbGFibGVgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9VTkFWQUlMQUJMRV9EVVJJTkdfRVhJVCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVU5BVkFJTEFCTEVfRFVSSU5HX0VYSVRcIixcbiAgICAgIGBDYW5ub3QgY2FsbCBmdW5jdGlvbiBpbiBwcm9jZXNzIGV4aXQgaGFuZGxlcmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9VTkNBVUdIVF9FWENFUFRJT05fQ0FQVFVSRV9BTFJFQURZX1NFVCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVU5DQVVHSFRfRVhDRVBUSU9OX0NBUFRVUkVfQUxSRUFEWV9TRVRcIixcbiAgICAgIFwiYHByb2Nlc3Muc2V0dXBVbmNhdWdodEV4Y2VwdGlvbkNhcHR1cmUoKWAgd2FzIGNhbGxlZCB3aGlsZSBhIGNhcHR1cmUgY2FsbGJhY2sgd2FzIGFscmVhZHkgYWN0aXZlXCIsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9VTkVTQ0FQRURfQ0hBUkFDVEVSUyBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9VTkVTQ0FQRURfQ0hBUkFDVEVSU1wiLCBgJHt4fSBjb250YWlucyB1bmVzY2FwZWQgY2hhcmFjdGVyc2ApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1VOSEFORExFRF9FUlJPUiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX1VOSEFORExFRF9FUlJPUlwiLCBgVW5oYW5kbGVkIGVycm9yLiAoJHt4fSlgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9VTktOT1dOX0JVSUxUSU5fTU9EVUxFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfVU5LTk9XTl9CVUlMVElOX01PRFVMRVwiLCBgTm8gc3VjaCBidWlsdC1pbiBtb2R1bGU6ICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9VTktOT1dOX0NSRURFTlRJQUwgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX1VOS05PV05fQ1JFREVOVElBTFwiLCBgJHt4fSBpZGVudGlmaWVyIGRvZXMgbm90IGV4aXN0OiAke3l9YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVU5LTk9XTl9FTkNPRElORyBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9VTktOT1dOX0VOQ09ESU5HXCIsIGBVbmtub3duIGVuY29kaW5nOiAke3h9YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVU5LTk9XTl9GSUxFX0VYVEVOU0lPTiBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVU5LTk9XTl9GSUxFX0VYVEVOU0lPTlwiLFxuICAgICAgYFVua25vd24gZmlsZSBleHRlbnNpb24gXCIke3h9XCIgZm9yICR7eX1gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVU5LTk9XTl9NT0RVTEVfRk9STUFUIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9VTktOT1dOX01PRFVMRV9GT1JNQVRcIiwgYFVua25vd24gbW9kdWxlIGZvcm1hdDogJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1VOS05PV05fU0lHTkFMIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX1VOS05PV05fU0lHTkFMXCIsIGBVbmtub3duIHNpZ25hbDogJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1VOU1VQUE9SVEVEX0RJUl9JTVBPUlQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVU5TVVBQT1JURURfRElSX0lNUE9SVFwiLFxuICAgICAgYERpcmVjdG9yeSBpbXBvcnQgJyR7eH0nIGlzIG5vdCBzdXBwb3J0ZWQgcmVzb2x2aW5nIEVTIG1vZHVsZXMsIGltcG9ydGVkIGZyb20gJHt5fWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9VTlNVUFBPUlRFRF9FU01fVVJMX1NDSEVNRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVU5TVVBQT1JURURfRVNNX1VSTF9TQ0hFTUVcIixcbiAgICAgIGBPbmx5IGZpbGUgYW5kIGRhdGEgVVJMcyBhcmUgc3VwcG9ydGVkIGJ5IHRoZSBkZWZhdWx0IEVTTSBsb2FkZXJgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVjhCUkVBS0lURVJBVE9SIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9WOEJSRUFLSVRFUkFUT1JcIixcbiAgICAgIGBGdWxsIElDVSBkYXRhIG5vdCBpbnN0YWxsZWQuIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvd2lraS9JbnRsYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1ZBTElEX1BFUkZPUk1BTkNFX0VOVFJZX1RZUEUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1ZBTElEX1BFUkZPUk1BTkNFX0VOVFJZX1RZUEVcIixcbiAgICAgIGBBdCBsZWFzdCBvbmUgdmFsaWQgcGVyZm9ybWFuY2UgZW50cnkgdHlwZSBpcyByZXF1aXJlZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9WTV9EWU5BTUlDX0lNUE9SVF9DQUxMQkFDS19NSVNTSU5HIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVk1fRFlOQU1JQ19JTVBPUlRfQ0FMTEJBQ0tfTUlTU0lOR1wiLFxuICAgICAgYEEgZHluYW1pYyBpbXBvcnQgY2FsbGJhY2sgd2FzIG5vdCBzcGVjaWZpZWQuYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1ZNX01PRFVMRV9BTFJFQURZX0xJTktFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1ZNX01PRFVMRV9BTFJFQURZX0xJTktFRFwiLCBgTW9kdWxlIGhhcyBhbHJlYWR5IGJlZW4gbGlua2VkYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVk1fTU9EVUxFX0NBTk5PVF9DUkVBVEVfQ0FDSEVEX0RBVEEgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1ZNX01PRFVMRV9DQU5OT1RfQ1JFQVRFX0NBQ0hFRF9EQVRBXCIsXG4gICAgICBgQ2FjaGVkIGRhdGEgY2Fubm90IGJlIGNyZWF0ZWQgZm9yIGEgbW9kdWxlIHdoaWNoIGhhcyBiZWVuIGV2YWx1YXRlZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9WTV9NT0RVTEVfRElGRkVSRU5UX0NPTlRFWFQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1ZNX01PRFVMRV9ESUZGRVJFTlRfQ09OVEVYVFwiLFxuICAgICAgYExpbmtlZCBtb2R1bGVzIG11c3QgdXNlIHRoZSBzYW1lIGNvbnRleHRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVk1fTU9EVUxFX0xJTktJTkdfRVJST1JFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVk1fTU9EVUxFX0xJTktJTkdfRVJST1JFRFwiLFxuICAgICAgYExpbmtpbmcgaGFzIGFscmVhZHkgZmFpbGVkIGZvciB0aGUgcHJvdmlkZWQgbW9kdWxlYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1ZNX01PRFVMRV9OT1RfTU9EVUxFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9WTV9NT0RVTEVfTk9UX01PRFVMRVwiLFxuICAgICAgYFByb3ZpZGVkIG1vZHVsZSBpcyBub3QgYW4gaW5zdGFuY2Ugb2YgTW9kdWxlYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1ZNX01PRFVMRV9TVEFUVVMgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9WTV9NT0RVTEVfU1RBVFVTXCIsIGBNb2R1bGUgc3RhdHVzICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9XQVNJX0FMUkVBRFlfU1RBUlRFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1dBU0lfQUxSRUFEWV9TVEFSVEVEXCIsIGBXQVNJIGluc3RhbmNlIGhhcyBhbHJlYWR5IHN0YXJ0ZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9XT1JLRVJfSU5JVF9GQUlMRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9XT1JLRVJfSU5JVF9GQUlMRURcIiwgYFdvcmtlciBpbml0aWFsaXphdGlvbiBmYWlsdXJlOiAke3h9YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfV09SS0VSX05PVF9SVU5OSU5HIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfV09SS0VSX05PVF9SVU5OSU5HXCIsIGBXb3JrZXIgaW5zdGFuY2Ugbm90IHJ1bm5pbmdgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9XT1JLRVJfT1VUX09GX01FTU9SWSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfV09SS0VSX09VVF9PRl9NRU1PUllcIixcbiAgICAgIGBXb3JrZXIgdGVybWluYXRlZCBkdWUgdG8gcmVhY2hpbmcgbWVtb3J5IGxpbWl0OiAke3h9YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1dPUktFUl9VTlNFUklBTElaQUJMRV9FUlJPUiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfV09SS0VSX1VOU0VSSUFMSVpBQkxFX0VSUk9SXCIsXG4gICAgICBgU2VyaWFsaXppbmcgYW4gdW5jYXVnaHQgZXhjZXB0aW9uIGZhaWxlZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9XT1JLRVJfVU5TVVBQT1JURURfRVhURU5TSU9OIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfV09SS0VSX1VOU1VQUE9SVEVEX0VYVEVOU0lPTlwiLFxuICAgICAgYFRoZSB3b3JrZXIgc2NyaXB0IGV4dGVuc2lvbiBtdXN0IGJlIFwiLmpzXCIsIFwiLm1qc1wiLCBvciBcIi5janNcIi4gUmVjZWl2ZWQgXCIke3h9XCJgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfV09SS0VSX1VOU1VQUE9SVEVEX09QRVJBVElPTiBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1dPUktFUl9VTlNVUFBPUlRFRF9PUEVSQVRJT05cIixcbiAgICAgIGAke3h9IGlzIG5vdCBzdXBwb3J0ZWQgaW4gd29ya2Vyc2AsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9aTElCX0lOSVRJQUxJWkFUSU9OX0ZBSUxFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1pMSUJfSU5JVElBTElaQVRJT05fRkFJTEVEXCIsIGBJbml0aWFsaXphdGlvbiBmYWlsZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9GQUxTWV9WQUxVRV9SRUpFQ1RJT04gZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICByZWFzb246IHN0cmluZztcbiAgY29uc3RydWN0b3IocmVhc29uOiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9GQUxTWV9WQUxVRV9SRUpFQ1RJT05cIiwgXCJQcm9taXNlIHdhcyByZWplY3RlZCB3aXRoIGZhbHN5IHZhbHVlXCIpO1xuICAgIHRoaXMucmVhc29uID0gcmVhc29uO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX0lOVkFMSURfU0VUVElOR19WQUxVRSBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgYWN0dWFsOiB1bmtub3duO1xuICBtaW4/OiBudW1iZXI7XG4gIG1heD86IG51bWJlcjtcblxuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGFjdHVhbDogdW5rbm93biwgbWluPzogbnVtYmVyLCBtYXg/OiBudW1iZXIpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX0lOVkFMSURfU0VUVElOR19WQUxVRVwiLFxuICAgICAgYEludmFsaWQgdmFsdWUgZm9yIHNldHRpbmcgXCIke25hbWV9XCI6ICR7YWN0dWFsfWAsXG4gICAgKTtcbiAgICB0aGlzLmFjdHVhbCA9IGFjdHVhbDtcbiAgICBpZiAobWluICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMubWluID0gbWluO1xuICAgICAgdGhpcy5tYXggPSBtYXg7XG4gICAgfVxuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1NUUkVBTV9DQU5DRUwgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBvdmVycmlkZSBjYXVzZT86IEVycm9yO1xuICBjb25zdHJ1Y3RvcihlcnJvcjogRXJyb3IpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX1NUUkVBTV9DQU5DRUxcIixcbiAgICAgIHR5cGVvZiBlcnJvci5tZXNzYWdlID09PSBcInN0cmluZ1wiXG4gICAgICAgID8gYFRoZSBwZW5kaW5nIHN0cmVhbSBoYXMgYmVlbiBjYW5jZWxlZCAoY2F1c2VkIGJ5OiAke2Vycm9yLm1lc3NhZ2V9KWBcbiAgICAgICAgOiBcIlRoZSBwZW5kaW5nIHN0cmVhbSBoYXMgYmVlbiBjYW5jZWxlZFwiLFxuICAgICk7XG4gICAgaWYgKGVycm9yKSB7XG4gICAgICB0aGlzLmNhdXNlID0gZXJyb3I7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9BRERSRVNTX0ZBTUlMWSBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgaG9zdDogc3RyaW5nO1xuICBwb3J0OiBudW1iZXI7XG4gIGNvbnN0cnVjdG9yKGFkZHJlc3NUeXBlOiBzdHJpbmcsIGhvc3Q6IHN0cmluZywgcG9ydDogbnVtYmVyKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlZBTElEX0FERFJFU1NfRkFNSUxZXCIsXG4gICAgICBgSW52YWxpZCBhZGRyZXNzIGZhbWlseTogJHthZGRyZXNzVHlwZX0gJHtob3N0fToke3BvcnR9YCxcbiAgICApO1xuICAgIHRoaXMuaG9zdCA9IGhvc3Q7XG4gICAgdGhpcy5wb3J0ID0gcG9ydDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfQ0hBUiBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGZpZWxkPzogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlZBTElEX0NIQVJcIixcbiAgICAgIGZpZWxkXG4gICAgICAgID8gYEludmFsaWQgY2hhcmFjdGVyIGluICR7bmFtZX1gXG4gICAgICAgIDogYEludmFsaWQgY2hhcmFjdGVyIGluICR7bmFtZX0gW1wiJHtmaWVsZH1cIl1gLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX09QVF9WQUxVRSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHZhbHVlOiB1bmtub3duKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlZBTElEX09QVF9WQUxVRVwiLFxuICAgICAgYFRoZSB2YWx1ZSBcIiR7dmFsdWV9XCIgaXMgaW52YWxpZCBmb3Igb3B0aW9uIFwiJHtuYW1lfVwiYCxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9SRVRVUk5fUFJPUEVSVFkgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoaW5wdXQ6IHN0cmluZywgbmFtZTogc3RyaW5nLCBwcm9wOiBzdHJpbmcsIHZhbHVlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOVkFMSURfUkVUVVJOX1BST1BFUlRZXCIsXG4gICAgICBgRXhwZWN0ZWQgYSB2YWxpZCAke2lucHV0fSB0byBiZSByZXR1cm5lZCBmb3IgdGhlIFwiJHtwcm9wfVwiIGZyb20gdGhlIFwiJHtuYW1lfVwiIGZ1bmN0aW9uIGJ1dCBnb3QgJHt2YWx1ZX0uYCxcbiAgICApO1xuICB9XG59XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG5mdW5jdGlvbiBidWlsZFJldHVyblByb3BlcnR5VHlwZSh2YWx1ZTogYW55KSB7XG4gIGlmICh2YWx1ZSAmJiB2YWx1ZS5jb25zdHJ1Y3RvciAmJiB2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIGBpbnN0YW5jZSBvZiAke3ZhbHVlLmNvbnN0cnVjdG9yLm5hbWV9YDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gYHR5cGUgJHt0eXBlb2YgdmFsdWV9YDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfUkVUVVJOX1BST1BFUlRZX1ZBTFVFIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGlucHV0OiBzdHJpbmcsIG5hbWU6IHN0cmluZywgcHJvcDogc3RyaW5nLCB2YWx1ZTogdW5rbm93bikge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9SRVRVUk5fUFJPUEVSVFlfVkFMVUVcIixcbiAgICAgIGBFeHBlY3RlZCAke2lucHV0fSB0byBiZSByZXR1cm5lZCBmb3IgdGhlIFwiJHtwcm9wfVwiIGZyb20gdGhlIFwiJHtuYW1lfVwiIGZ1bmN0aW9uIGJ1dCBnb3QgJHtcbiAgICAgICAgYnVpbGRSZXR1cm5Qcm9wZXJ0eVR5cGUoXG4gICAgICAgICAgdmFsdWUsXG4gICAgICAgIClcbiAgICAgIH0uYCxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9SRVRVUk5fVkFMVUUgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoaW5wdXQ6IHN0cmluZywgbmFtZTogc3RyaW5nLCB2YWx1ZTogdW5rbm93bikge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9SRVRVUk5fVkFMVUVcIixcbiAgICAgIGBFeHBlY3RlZCAke2lucHV0fSB0byBiZSByZXR1cm5lZCBmcm9tIHRoZSBcIiR7bmFtZX1cIiBmdW5jdGlvbiBidXQgZ290ICR7XG4gICAgICAgIGJ1aWxkUmV0dXJuUHJvcGVydHlUeXBlKFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICApXG4gICAgICB9LmAsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfVVJMIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGlucHV0OiBzdHJpbmc7XG4gIGNvbnN0cnVjdG9yKGlucHV0OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX1VSTFwiLCBgSW52YWxpZCBVUkw6ICR7aW5wdXR9YCk7XG4gICAgdGhpcy5pbnB1dCA9IGlucHV0O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9VUkxfU0NIRU1FIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGV4cGVjdGVkOiBzdHJpbmcgfCBbc3RyaW5nXSB8IFtzdHJpbmcsIHN0cmluZ10pIHtcbiAgICBleHBlY3RlZCA9IEFycmF5LmlzQXJyYXkoZXhwZWN0ZWQpID8gZXhwZWN0ZWQgOiBbZXhwZWN0ZWRdO1xuICAgIGNvbnN0IHJlcyA9IGV4cGVjdGVkLmxlbmd0aCA9PT0gMlxuICAgICAgPyBgb25lIG9mIHNjaGVtZSAke2V4cGVjdGVkWzBdfSBvciAke2V4cGVjdGVkWzFdfWBcbiAgICAgIDogYG9mIHNjaGVtZSAke2V4cGVjdGVkWzBdfWA7XG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9VUkxfU0NIRU1FXCIsIGBUaGUgVVJMIG11c3QgYmUgJHtyZXN9YCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9NT0RVTEVfTk9UX0ZPVU5EIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IocGF0aDogc3RyaW5nLCBiYXNlOiBzdHJpbmcsIHR5cGU6IHN0cmluZyA9IFwicGFja2FnZVwiKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9NT0RVTEVfTk9UX0ZPVU5EXCIsXG4gICAgICBgQ2Fubm90IGZpbmQgJHt0eXBlfSAnJHtwYXRofScgaW1wb3J0ZWQgZnJvbSAke2Jhc2V9YCxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9QQUNLQUdFX0NPTkZJRyBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHBhdGg6IHN0cmluZywgYmFzZT86IHN0cmluZywgbWVzc2FnZT86IHN0cmluZykge1xuICAgIGNvbnN0IG1zZyA9IGBJbnZhbGlkIHBhY2thZ2UgY29uZmlnICR7cGF0aH0ke1xuICAgICAgYmFzZSA/IGAgd2hpbGUgaW1wb3J0aW5nICR7YmFzZX1gIDogXCJcIlxuICAgIH0ke21lc3NhZ2UgPyBgLiAke21lc3NhZ2V9YCA6IFwiXCJ9YDtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX1BBQ0tBR0VfQ09ORklHXCIsIG1zZyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX01PRFVMRV9TUEVDSUZJRVIgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IocmVxdWVzdDogc3RyaW5nLCByZWFzb246IHN0cmluZywgYmFzZT86IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9NT0RVTEVfU1BFQ0lGSUVSXCIsXG4gICAgICBgSW52YWxpZCBtb2R1bGUgXCIke3JlcXVlc3R9XCIgJHtyZWFzb259JHtcbiAgICAgICAgYmFzZSA/IGAgaW1wb3J0ZWQgZnJvbSAke2Jhc2V9YCA6IFwiXCJcbiAgICAgIH1gLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX1BBQ0tBR0VfVEFSR0VUIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgcGtnUGF0aDogc3RyaW5nLFxuICAgIGtleTogc3RyaW5nLFxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgdGFyZ2V0OiBhbnksXG4gICAgaXNJbXBvcnQ/OiBib29sZWFuLFxuICAgIGJhc2U/OiBzdHJpbmcsXG4gICkge1xuICAgIGxldCBtc2c6IHN0cmluZztcbiAgICBjb25zdCByZWxFcnJvciA9IHR5cGVvZiB0YXJnZXQgPT09IFwic3RyaW5nXCIgJiZcbiAgICAgICFpc0ltcG9ydCAmJlxuICAgICAgdGFyZ2V0Lmxlbmd0aCAmJlxuICAgICAgIXRhcmdldC5zdGFydHNXaXRoKFwiLi9cIik7XG4gICAgaWYgKGtleSA9PT0gXCIuXCIpIHtcbiAgICAgIGFzc2VydChpc0ltcG9ydCA9PT0gZmFsc2UpO1xuICAgICAgbXNnID0gYEludmFsaWQgXCJleHBvcnRzXCIgbWFpbiB0YXJnZXQgJHtKU09OLnN0cmluZ2lmeSh0YXJnZXQpfSBkZWZpbmVkIGAgK1xuICAgICAgICBgaW4gdGhlIHBhY2thZ2UgY29uZmlnICR7cGtnUGF0aH1wYWNrYWdlLmpzb24ke1xuICAgICAgICAgIGJhc2UgPyBgIGltcG9ydGVkIGZyb20gJHtiYXNlfWAgOiBcIlwiXG4gICAgICAgIH0ke3JlbEVycm9yID8gJzsgdGFyZ2V0cyBtdXN0IHN0YXJ0IHdpdGggXCIuL1wiJyA6IFwiXCJ9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgbXNnID0gYEludmFsaWQgXCIke2lzSW1wb3J0ID8gXCJpbXBvcnRzXCIgOiBcImV4cG9ydHNcIn1cIiB0YXJnZXQgJHtcbiAgICAgICAgSlNPTi5zdHJpbmdpZnkoXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICApXG4gICAgICB9IGRlZmluZWQgZm9yICcke2tleX0nIGluIHRoZSBwYWNrYWdlIGNvbmZpZyAke3BrZ1BhdGh9cGFja2FnZS5qc29uJHtcbiAgICAgICAgYmFzZSA/IGAgaW1wb3J0ZWQgZnJvbSAke2Jhc2V9YCA6IFwiXCJcbiAgICAgIH0ke3JlbEVycm9yID8gJzsgdGFyZ2V0cyBtdXN0IHN0YXJ0IHdpdGggXCIuL1wiJyA6IFwiXCJ9YDtcbiAgICB9XG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9QQUNLQUdFX1RBUkdFVFwiLCBtc2cpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfUEFDS0FHRV9JTVBPUlRfTk9UX0RFRklORUQgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgc3BlY2lmaWVyOiBzdHJpbmcsXG4gICAgcGFja2FnZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCxcbiAgICBiYXNlOiBzdHJpbmcsXG4gICkge1xuICAgIGNvbnN0IG1zZyA9IGBQYWNrYWdlIGltcG9ydCBzcGVjaWZpZXIgXCIke3NwZWNpZmllcn1cIiBpcyBub3QgZGVmaW5lZCR7XG4gICAgICBwYWNrYWdlUGF0aCA/IGAgaW4gcGFja2FnZSAke3BhY2thZ2VQYXRofXBhY2thZ2UuanNvbmAgOiBcIlwiXG4gICAgfSBpbXBvcnRlZCBmcm9tICR7YmFzZX1gO1xuXG4gICAgc3VwZXIoXCJFUlJfUEFDS0FHRV9JTVBPUlRfTk9UX0RFRklORURcIiwgbXNnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX1BBQ0tBR0VfUEFUSF9OT1RfRVhQT1JURUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihzdWJwYXRoOiBzdHJpbmcsIHBrZ1BhdGg6IHN0cmluZywgYmFzZVBhdGg/OiBzdHJpbmcpIHtcbiAgICBsZXQgbXNnOiBzdHJpbmc7XG4gICAgaWYgKHN1YnBhdGggPT09IFwiLlwiKSB7XG4gICAgICBtc2cgPSBgTm8gXCJleHBvcnRzXCIgbWFpbiBkZWZpbmVkIGluICR7cGtnUGF0aH1wYWNrYWdlLmpzb24ke1xuICAgICAgICBiYXNlUGF0aCA/IGAgaW1wb3J0ZWQgZnJvbSAke2Jhc2VQYXRofWAgOiBcIlwiXG4gICAgICB9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgbXNnID1cbiAgICAgICAgYFBhY2thZ2Ugc3VicGF0aCAnJHtzdWJwYXRofScgaXMgbm90IGRlZmluZWQgYnkgXCJleHBvcnRzXCIgaW4gJHtwa2dQYXRofXBhY2thZ2UuanNvbiR7XG4gICAgICAgICAgYmFzZVBhdGggPyBgIGltcG9ydGVkIGZyb20gJHtiYXNlUGF0aH1gIDogXCJcIlxuICAgICAgICB9YDtcbiAgICB9XG5cbiAgICBzdXBlcihcIkVSUl9QQUNLQUdFX1BBVEhfTk9UX0VYUE9SVEVEXCIsIG1zZyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9JTlRFUk5BTF9BU1NFUlRJT04gZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtZXNzYWdlPzogc3RyaW5nKSB7XG4gICAgY29uc3Qgc3VmZml4ID0gXCJUaGlzIGlzIGNhdXNlZCBieSBlaXRoZXIgYSBidWcgaW4gTm9kZS5qcyBcIiArXG4gICAgICBcIm9yIGluY29ycmVjdCB1c2FnZSBvZiBOb2RlLmpzIGludGVybmFscy5cXG5cIiArXG4gICAgICBcIlBsZWFzZSBvcGVuIGFuIGlzc3VlIHdpdGggdGhpcyBzdGFjayB0cmFjZSBhdCBcIiArXG4gICAgICBcImh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9pc3N1ZXNcXG5cIjtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOVEVSTkFMX0FTU0VSVElPTlwiLFxuICAgICAgbWVzc2FnZSA9PT0gdW5kZWZpbmVkID8gc3VmZml4IDogYCR7bWVzc2FnZX1cXG4ke3N1ZmZpeH1gLFxuICAgICk7XG4gIH1cbn1cblxuLy8gVXNpbmcgYGZzLnJtZGlyYCBvbiBhIHBhdGggdGhhdCBpcyBhIGZpbGUgcmVzdWx0cyBpbiBhbiBFTk9FTlQgZXJyb3Igb24gV2luZG93cyBhbmQgYW4gRU5PVERJUiBlcnJvciBvbiBQT1NJWC5cbmV4cG9ydCBjbGFzcyBFUlJfRlNfUk1ESVJfRU5PVERJUiBleHRlbmRzIE5vZGVTeXN0ZW1FcnJvciB7XG4gIGNvbnN0cnVjdG9yKHBhdGg6IHN0cmluZykge1xuICAgIGNvbnN0IGNvZGUgPSBpc1dpbmRvd3MgPyBcIkVOT0VOVFwiIDogXCJFTk9URElSXCI7XG4gICAgY29uc3QgY3R4OiBOb2RlU3lzdGVtRXJyb3JDdHggPSB7XG4gICAgICBtZXNzYWdlOiBcIm5vdCBhIGRpcmVjdG9yeVwiLFxuICAgICAgcGF0aCxcbiAgICAgIHN5c2NhbGw6IFwicm1kaXJcIixcbiAgICAgIGNvZGUsXG4gICAgICBlcnJubzogaXNXaW5kb3dzID8gRU5PRU5UIDogRU5PVERJUixcbiAgICB9O1xuICAgIHN1cGVyKGNvZGUsIGN0eCwgXCJQYXRoIGlzIG5vdCBhIGRpcmVjdG9yeVwiKTtcbiAgfVxufVxuXG5pbnRlcmZhY2UgVXZFeGNlcHRpb25Db250ZXh0IHtcbiAgc3lzY2FsbDogc3RyaW5nO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGRlbm9FcnJvclRvTm9kZUVycm9yKGU6IEVycm9yLCBjdHg6IFV2RXhjZXB0aW9uQ29udGV4dCkge1xuICBjb25zdCBlcnJubyA9IGV4dHJhY3RPc0Vycm9yTnVtYmVyRnJvbUVycm9yTWVzc2FnZShlKTtcbiAgaWYgKHR5cGVvZiBlcnJubyA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgIHJldHVybiBlO1xuICB9XG5cbiAgY29uc3QgZXggPSB1dkV4Y2VwdGlvbih7XG4gICAgZXJybm86IG1hcFN5c0Vycm5vVG9VdkVycm5vKGVycm5vKSxcbiAgICAuLi5jdHgsXG4gIH0pO1xuICByZXR1cm4gZXg7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RPc0Vycm9yTnVtYmVyRnJvbUVycm9yTWVzc2FnZShlOiB1bmtub3duKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcbiAgY29uc3QgbWF0Y2ggPSBlIGluc3RhbmNlb2YgRXJyb3JcbiAgICA/IGUubWVzc2FnZS5tYXRjaCgvXFwob3MgZXJyb3IgKFxcZCspXFwpLylcbiAgICA6IGZhbHNlO1xuXG4gIGlmIChtYXRjaCkge1xuICAgIHJldHVybiArbWF0Y2hbMV07XG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY29ublJlc2V0RXhjZXB0aW9uKG1zZzogc3RyaW5nKSB7XG4gIGNvbnN0IGV4ID0gbmV3IEVycm9yKG1zZyk7XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIChleCBhcyBhbnkpLmNvZGUgPSBcIkVDT05OUkVTRVRcIjtcbiAgcmV0dXJuIGV4O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYWdncmVnYXRlVHdvRXJyb3JzKFxuICBpbm5lckVycm9yOiBBZ2dyZWdhdGVFcnJvcixcbiAgb3V0ZXJFcnJvcjogQWdncmVnYXRlRXJyb3IgJiB7IGNvZGU6IHN0cmluZyB9LFxuKSB7XG4gIGlmIChpbm5lckVycm9yICYmIG91dGVyRXJyb3IgJiYgaW5uZXJFcnJvciAhPT0gb3V0ZXJFcnJvcikge1xuICAgIGlmIChBcnJheS5pc0FycmF5KG91dGVyRXJyb3IuZXJyb3JzKSkge1xuICAgICAgLy8gSWYgYG91dGVyRXJyb3JgIGlzIGFscmVhZHkgYW4gYEFnZ3JlZ2F0ZUVycm9yYC5cbiAgICAgIG91dGVyRXJyb3IuZXJyb3JzLnB1c2goaW5uZXJFcnJvcik7XG4gICAgICByZXR1cm4gb3V0ZXJFcnJvcjtcbiAgICB9XG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXJlc3RyaWN0ZWQtc3ludGF4XG4gICAgY29uc3QgZXJyID0gbmV3IEFnZ3JlZ2F0ZUVycm9yKFxuICAgICAgW1xuICAgICAgICBvdXRlckVycm9yLFxuICAgICAgICBpbm5lckVycm9yLFxuICAgICAgXSxcbiAgICAgIG91dGVyRXJyb3IubWVzc2FnZSxcbiAgICApO1xuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgKGVyciBhcyBhbnkpLmNvZGUgPSBvdXRlckVycm9yLmNvZGU7XG4gICAgcmV0dXJuIGVycjtcbiAgfVxuICByZXR1cm4gaW5uZXJFcnJvciB8fCBvdXRlckVycm9yO1xufVxuY29kZXMuRVJSX0lQQ19DSEFOTkVMX0NMT1NFRCA9IEVSUl9JUENfQ0hBTk5FTF9DTE9TRUQ7XG5jb2Rlcy5FUlJfSU5WQUxJRF9BUkdfVFlQRSA9IEVSUl9JTlZBTElEX0FSR19UWVBFO1xuY29kZXMuRVJSX0lOVkFMSURfQVJHX1ZBTFVFID0gRVJSX0lOVkFMSURfQVJHX1ZBTFVFO1xuY29kZXMuRVJSX0lOVkFMSURfQ0FMTEJBQ0sgPSBFUlJfSU5WQUxJRF9DQUxMQkFDSztcbmNvZGVzLkVSUl9PVVRfT0ZfUkFOR0UgPSBFUlJfT1VUX09GX1JBTkdFO1xuY29kZXMuRVJSX1NPQ0tFVF9CQURfUE9SVCA9IEVSUl9TT0NLRVRfQkFEX1BPUlQ7XG5jb2Rlcy5FUlJfQlVGRkVSX09VVF9PRl9CT1VORFMgPSBFUlJfQlVGRkVSX09VVF9PRl9CT1VORFM7XG5jb2Rlcy5FUlJfVU5LTk9XTl9FTkNPRElORyA9IEVSUl9VTktOT1dOX0VOQ09ESU5HO1xuLy8gVE9ETyhrdDNrKTogYXNzaWduIGFsbCBlcnJvciBjbGFzc2VzIGhlcmUuXG5cbmV4cG9ydCB7IGNvZGVzLCBoaWRlU3RhY2tGcmFtZXMgfTtcblxuZXhwb3J0IGRlZmF1bHQge1xuICBBYm9ydEVycm9yLFxuICBhZ2dyZWdhdGVUd29FcnJvcnMsXG4gIGNvZGVzLFxufTtcbiJdfQ==