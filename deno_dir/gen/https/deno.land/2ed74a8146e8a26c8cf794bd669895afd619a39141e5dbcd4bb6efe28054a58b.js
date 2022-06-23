// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
// Copyright Node.js contributors. All rights reserved. MIT License.
/** ********** NOT IMPLEMENTED
 * ERR_MANIFEST_ASSERT_INTEGRITY
 * ERR_QUICSESSION_VERSION_NEGOTIATION
 * ERR_REQUIRE_ESM
 * ERR_TLS_CERT_ALTNAME_INVALID
 * ERR_WORKER_INVALID_EXEC_ARGV
 * ERR_WORKER_PATH
 * ERR_QUIC_ERROR
 * ERR_SOCKET_BUFFER_SIZE //System error, shouldn't ever happen inside Deno
 * ERR_SYSTEM_ERROR //System error, shouldn't ever happen inside Deno
 * ERR_TTY_INIT_FAILED //System error, shouldn't ever happen inside Deno
 * ERR_INVALID_PACKAGE_CONFIG // package.json stuff, probably useless
 * *********** */ import { getSystemErrorName } from "../util.ts";
import { inspect } from "../internal/util/inspect.mjs";
import { codes } from "./error_codes.ts";
import { codeMap, errorMap, mapSysErrnoToUvErrno } from "../internal_binding/uv.ts";
import { assert } from "../../_util/assert.ts";
import { isWindows } from "../../_util/os.ts";
import { os as osConstants } from "../internal_binding/constants.ts";
const { errno: { ENOTDIR , ENOENT  } ,  } = osConstants;
import { hideStackFrames } from "./hide_stack_frames.ts";
export { errorMap };
const kIsNodeError = Symbol("kIsNodeError");
/**
 * @see https://github.com/nodejs/node/blob/f3eb224/lib/internal/errors.js
 */ const classRegExp = /^([A-Z][a-z0-9]*)+$/;
/**
 * @see https://github.com/nodejs/node/blob/f3eb224/lib/internal/errors.js
 * @description Sorted by a rough estimate on most frequently used entries.
 */ const kTypes = [
    "string",
    "function",
    "number",
    "object",
    // Accept 'Function' and 'Object' as alternative to the lower cased version.
    "Function",
    "Object",
    "boolean",
    "bigint",
    "symbol", 
];
// Node uses an AbortError that isn't exactly the same as the DOMException
// to make usage of the error in userland and readable-stream easier.
// It is a regular error with `.code` and `.name`.
export class AbortError extends Error {
    code;
    constructor(){
        super("The operation was aborted");
        this.code = "ABORT_ERR";
        this.name = "AbortError";
    }
}
function addNumericalSeparator(val) {
    let res = "";
    let i = val.length;
    const start = val[0] === "-" ? 1 : 0;
    for(; i >= start + 4; i -= 3){
        res = `_${val.slice(i - 3, i)}${res}`;
    }
    return `${val.slice(0, i)}${res}`;
}
const captureLargerStackTrace = hideStackFrames(function captureLargerStackTrace(err) {
    // @ts-ignore this function is not available in lib.dom.d.ts
    Error.captureStackTrace(err);
    return err;
});
/**
 * This creates an error compatible with errors produced in the C++
 * This function should replace the deprecated
 * `exceptionWithHostPort()` function.
 *
 * @param err A libuv error number
 * @param syscall
 * @param address
 * @param port
 * @return The error.
 */ export const uvExceptionWithHostPort = hideStackFrames(function uvExceptionWithHostPort(err, syscall, address, port) {
    const { 0: code , 1: uvmsg  } = uvErrmapGet(err) || uvUnmappedError;
    const message = `${syscall} ${code}: ${uvmsg}`;
    let details = "";
    if (port && port > 0) {
        details = ` ${address}:${port}`;
    } else if (address) {
        details = ` ${address}`;
    }
    // deno-lint-ignore no-explicit-any
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
/**
 * This used to be `util._errnoException()`.
 *
 * @param err A libuv error number
 * @param syscall
 * @param original
 * @return A `ErrnoException`
 */ export const errnoException = hideStackFrames(function errnoException(err, syscall, original) {
    const code = getSystemErrorName(err);
    const message = original ? `${syscall} ${code} ${original}` : `${syscall} ${code}`;
    // deno-lint-ignore no-explicit-any
    const ex = new Error(message);
    ex.errno = err;
    ex.code = code;
    ex.syscall = syscall;
    return captureLargerStackTrace(ex);
});
function uvErrmapGet(name) {
    return errorMap.get(name);
}
const uvUnmappedError = [
    "UNKNOWN",
    "unknown error"
];
/**
 * This creates an error compatible with errors produced in the C++
 * function UVException using a context object with data assembled in C++.
 * The goal is to migrate them to ERR_* errors later when compatibility is
 * not a concern.
 *
 * @param ctx
 * @return The error.
 */ export const uvException = hideStackFrames(function uvException(ctx) {
    const { 0: code , 1: uvmsg  } = uvErrmapGet(ctx.errno) || uvUnmappedError;
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
    // deno-lint-ignore no-explicit-any
    const err = new Error(message);
    for (const prop of Object.keys(ctx)){
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
/**
 * Deprecated, new function is `uvExceptionWithHostPort()`
 * New function added the error description directly
 * from C++. this method for backwards compatibility
 * @param err A libuv error number
 * @param syscall
 * @param address
 * @param port
 * @param additional
 */ export const exceptionWithHostPort = hideStackFrames(function exceptionWithHostPort(err, syscall, address, port, additional) {
    const code = getSystemErrorName(err);
    let details = "";
    if (port && port > 0) {
        details = ` ${address}:${port}`;
    } else if (address) {
        details = ` ${address}`;
    }
    if (additional) {
        details += ` - Local (${additional})`;
    }
    // deno-lint-ignore no-explicit-any
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
/**
 * @param code A libuv error number or a c-ares error code
 * @param syscall
 * @param hostname
 */ export const dnsException = hideStackFrames(function(code, syscall, hostname) {
    let errno;
    // If `code` is of type number, it is a libuv error number, else it is a
    // c-ares error code.
    if (typeof code === "number") {
        errno = code;
        // ENOTFOUND is not a proper POSIX error, but this error has been in place
        // long enough that it's not practical to remove it.
        if (code === codeMap.get("EAI_NODATA") || code === codeMap.get("EAI_NONAME")) {
            code = "ENOTFOUND"; // Fabricated error name.
        } else {
            code = getSystemErrorName(code);
        }
    }
    const message = `${syscall} ${code}${hostname ? ` ${hostname}` : ""}`;
    // deno-lint-ignore no-explicit-any
    const ex = new Error(message);
    ex.errno = errno;
    ex.code = code;
    ex.syscall = syscall;
    if (hostname) {
        ex.hostname = hostname;
    }
    return captureLargerStackTrace(ex);
});
/**
 * All error instances in Node have additional methods and properties
 * This export class is meant to be extended by these instances abstracting native JS error instances
 */ export class NodeErrorAbstraction extends Error {
    code;
    constructor(name, code, message){
        super(message);
        this.code = code;
        this.name = name;
        //This number changes depending on the name of this class
        //20 characters as of now
        this.stack = this.stack && `${name} [${this.code}]${this.stack.slice(20)}`;
    }
    toString() {
        return `${this.name} [${this.code}]: ${this.message}`;
    }
}
export class NodeError extends NodeErrorAbstraction {
    constructor(code, message){
        super(Error.prototype.name, code, message);
    }
}
export class NodeSyntaxError extends NodeErrorAbstraction {
    constructor(code, message){
        super(SyntaxError.prototype.name, code, message);
        Object.setPrototypeOf(this, SyntaxError.prototype);
        this.toString = function() {
            return `${this.name} [${this.code}]: ${this.message}`;
        };
    }
}
export class NodeRangeError extends NodeErrorAbstraction {
    constructor(code, message){
        super(RangeError.prototype.name, code, message);
        Object.setPrototypeOf(this, RangeError.prototype);
        this.toString = function() {
            return `${this.name} [${this.code}]: ${this.message}`;
        };
    }
}
export class NodeTypeError extends NodeErrorAbstraction {
    constructor(code, message){
        super(TypeError.prototype.name, code, message);
        Object.setPrototypeOf(this, TypeError.prototype);
        this.toString = function() {
            return `${this.name} [${this.code}]: ${this.message}`;
        };
    }
}
export class NodeURIError extends NodeErrorAbstraction {
    constructor(code, message){
        super(URIError.prototype.name, code, message);
        Object.setPrototypeOf(this, URIError.prototype);
        this.toString = function() {
            return `${this.name} [${this.code}]: ${this.message}`;
        };
    }
}
// A specialized Error that includes an additional info property with
// additional information about the error condition.
// It has the properties present in a UVException but with a custom error
// message followed by the uv error code and uv error message.
// It also has its own error code with the original uv error context put into
// `err.info`.
// The context passed into this error must have .code, .syscall and .message,
// and may have .path and .dest.
class NodeSystemError extends NodeErrorAbstraction {
    constructor(key, context, msgPrefix){
        let message = `${msgPrefix}: ${context.syscall} returned ` + `${context.code} (${context.message})`;
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
                configurable: true
            },
            info: {
                value: context,
                enumerable: true,
                configurable: true,
                writable: false
            },
            errno: {
                get () {
                    return context.errno;
                },
                set: (value)=>{
                    context.errno = value;
                },
                enumerable: true,
                configurable: true
            },
            syscall: {
                get () {
                    return context.syscall;
                },
                set: (value)=>{
                    context.syscall = value;
                },
                enumerable: true,
                configurable: true
            }
        });
        if (context.path !== undefined) {
            Object.defineProperty(this, "path", {
                get () {
                    return context.path;
                },
                set: (value)=>{
                    context.path = value;
                },
                enumerable: true,
                configurable: true
            });
        }
        if (context.dest !== undefined) {
            Object.defineProperty(this, "dest", {
                get () {
                    return context.dest;
                },
                set: (value)=>{
                    context.dest = value;
                },
                enumerable: true,
                configurable: true
            });
        }
    }
    toString() {
        return `${this.name} [${this.code}]: ${this.message}`;
    }
}
function makeSystemErrorWithCode(key, msgPrfix) {
    return class NodeError extends NodeSystemError {
        constructor(ctx){
            super(key, ctx, msgPrfix);
        }
    };
}
export const ERR_FS_EISDIR = makeSystemErrorWithCode("ERR_FS_EISDIR", "Path is a directory");
function createInvalidArgType(name, expected) {
    // https://github.com/nodejs/node/blob/f3eb224/lib/internal/errors.js#L1037-L1087
    expected = Array.isArray(expected) ? expected : [
        expected
    ];
    let msg = "The ";
    if (name.endsWith(" argument")) {
        // For cases like 'first argument'
        msg += `${name} `;
    } else {
        const type = name.includes(".") ? "property" : "argument";
        msg += `"${name}" ${type} `;
    }
    msg += "must be ";
    const types = [];
    const instances = [];
    const other = [];
    for (const value of expected){
        if (kTypes.includes(value)) {
            types.push(value.toLocaleLowerCase());
        } else if (classRegExp.test(value)) {
            instances.push(value);
        } else {
            other.push(value);
        }
    }
    // Special handle `object` in case other instances are allowed to outline
    // the differences between each other.
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
        } else if (types.length === 2) {
            msg += `one of type ${types[0]} or ${types[1]}`;
        } else {
            msg += `of type ${types[0]}`;
        }
        if (instances.length > 0 || other.length > 0) {
            msg += " or ";
        }
    }
    if (instances.length > 0) {
        if (instances.length > 2) {
            const last1 = instances.pop();
            msg += `an instance of ${instances.join(", ")}, or ${last1}`;
        } else {
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
            const last2 = other.pop();
            msg += `one of ${other.join(", ")}, or ${last2}`;
        } else if (other.length === 2) {
            msg += `one of ${other[0]} or ${other[1]}`;
        } else {
            if (other[0].toLowerCase() !== other[0]) {
                msg += "an ";
            }
            msg += `${other[0]}`;
        }
    }
    return msg;
}
export class ERR_INVALID_ARG_TYPE_RANGE extends NodeRangeError {
    constructor(name, expected, actual){
        const msg = createInvalidArgType(name, expected);
        super("ERR_INVALID_ARG_TYPE", `${msg}.${invalidArgTypeHelper(actual)}`);
    }
}
export class ERR_INVALID_ARG_TYPE extends NodeTypeError {
    constructor(name, expected, actual){
        const msg = createInvalidArgType(name, expected);
        super("ERR_INVALID_ARG_TYPE", `${msg}.${invalidArgTypeHelper(actual)}`);
    }
    static RangeError = ERR_INVALID_ARG_TYPE_RANGE;
}
class ERR_INVALID_ARG_VALUE_RANGE extends NodeRangeError {
    constructor(name, value, reason = "is invalid"){
        const type = name.includes(".") ? "property" : "argument";
        const inspected = inspect(value);
        super("ERR_INVALID_ARG_VALUE", `The ${type} '${name}' ${reason}. Received ${inspected}`);
    }
}
export class ERR_INVALID_ARG_VALUE extends NodeTypeError {
    constructor(name, value, reason = "is invalid"){
        const type = name.includes(".") ? "property" : "argument";
        const inspected = inspect(value);
        super("ERR_INVALID_ARG_VALUE", `The ${type} '${name}' ${reason}. Received ${inspected}`);
    }
    static RangeError = ERR_INVALID_ARG_VALUE_RANGE;
}
// A helper function to simplify checking for ERR_INVALID_ARG_TYPE output.
// deno-lint-ignore no-explicit-any
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
        return ` Received ${inspect(input, {
            depth: -1
        })}`;
    }
    let inspected = inspect(input, {
        colors: false
    });
    if (inspected.length > 25) {
        inspected = `${inspected.slice(0, 25)}...`;
    }
    return ` Received type ${typeof input} (${inspected})`;
}
export class ERR_OUT_OF_RANGE extends RangeError {
    code = "ERR_OUT_OF_RANGE";
    constructor(str, range, input, replaceDefaultBoolean = false){
        assert(range, 'Missing "range" argument');
        let msg = replaceDefaultBoolean ? str : `The value of "${str}" is out of range.`;
        let received;
        if (Number.isInteger(input) && Math.abs(input) > 2 ** 32) {
            received = addNumericalSeparator(String(input));
        } else if (typeof input === "bigint") {
            received = String(input);
            if (input > 2n ** 32n || input < -(2n ** 32n)) {
                received = addNumericalSeparator(received);
            }
            received += "n";
        } else {
            received = inspect(input);
        }
        msg += ` It must be ${range}. Received ${received}`;
        super(msg);
        const { name  } = this;
        // Add the error code to the name to include it in the stack trace.
        this.name = `${name} [${this.code}]`;
        // Access the stack to generate the error message including the error code from the name.
        this.stack;
        // Reset the name to the actual name.
        this.name = name;
    }
}
export class ERR_AMBIGUOUS_ARGUMENT extends NodeTypeError {
    constructor(x, y){
        super("ERR_AMBIGUOUS_ARGUMENT", `The "${x}" argument is ambiguous. ${y}`);
    }
}
export class ERR_ARG_NOT_ITERABLE extends NodeTypeError {
    constructor(x){
        super("ERR_ARG_NOT_ITERABLE", `${x} must be iterable`);
    }
}
export class ERR_ASSERTION extends NodeError {
    constructor(x){
        super("ERR_ASSERTION", `${x}`);
    }
}
export class ERR_ASYNC_CALLBACK extends NodeTypeError {
    constructor(x){
        super("ERR_ASYNC_CALLBACK", `${x} must be a function`);
    }
}
export class ERR_ASYNC_TYPE extends NodeTypeError {
    constructor(x){
        super("ERR_ASYNC_TYPE", `Invalid name for async "type": ${x}`);
    }
}
export class ERR_BROTLI_INVALID_PARAM extends NodeRangeError {
    constructor(x){
        super("ERR_BROTLI_INVALID_PARAM", `${x} is not a valid Brotli parameter`);
    }
}
export class ERR_BUFFER_OUT_OF_BOUNDS extends NodeRangeError {
    constructor(name){
        super("ERR_BUFFER_OUT_OF_BOUNDS", name ? `"${name}" is outside of buffer bounds` : "Attempt to access memory outside buffer bounds");
    }
}
export class ERR_BUFFER_TOO_LARGE extends NodeRangeError {
    constructor(x){
        super("ERR_BUFFER_TOO_LARGE", `Cannot create a Buffer larger than ${x} bytes`);
    }
}
export class ERR_CANNOT_WATCH_SIGINT extends NodeError {
    constructor(){
        super("ERR_CANNOT_WATCH_SIGINT", "Cannot watch for SIGINT signals");
    }
}
export class ERR_CHILD_CLOSED_BEFORE_REPLY extends NodeError {
    constructor(){
        super("ERR_CHILD_CLOSED_BEFORE_REPLY", "Child closed before reply received");
    }
}
export class ERR_CHILD_PROCESS_IPC_REQUIRED extends NodeError {
    constructor(x){
        super("ERR_CHILD_PROCESS_IPC_REQUIRED", `Forked processes must have an IPC channel, missing value 'ipc' in ${x}`);
    }
}
export class ERR_CHILD_PROCESS_STDIO_MAXBUFFER extends NodeRangeError {
    constructor(x){
        super("ERR_CHILD_PROCESS_STDIO_MAXBUFFER", `${x} maxBuffer length exceeded`);
    }
}
export class ERR_CONSOLE_WRITABLE_STREAM extends NodeTypeError {
    constructor(x){
        super("ERR_CONSOLE_WRITABLE_STREAM", `Console expects a writable stream instance for ${x}`);
    }
}
export class ERR_CONTEXT_NOT_INITIALIZED extends NodeError {
    constructor(){
        super("ERR_CONTEXT_NOT_INITIALIZED", "context used is not initialized");
    }
}
export class ERR_CPU_USAGE extends NodeError {
    constructor(x){
        super("ERR_CPU_USAGE", `Unable to obtain cpu usage ${x}`);
    }
}
export class ERR_CRYPTO_CUSTOM_ENGINE_NOT_SUPPORTED extends NodeError {
    constructor(){
        super("ERR_CRYPTO_CUSTOM_ENGINE_NOT_SUPPORTED", "Custom engines not supported by this OpenSSL");
    }
}
export class ERR_CRYPTO_ECDH_INVALID_FORMAT extends NodeTypeError {
    constructor(x){
        super("ERR_CRYPTO_ECDH_INVALID_FORMAT", `Invalid ECDH format: ${x}`);
    }
}
export class ERR_CRYPTO_ECDH_INVALID_PUBLIC_KEY extends NodeError {
    constructor(){
        super("ERR_CRYPTO_ECDH_INVALID_PUBLIC_KEY", "Public key is not valid for specified curve");
    }
}
export class ERR_CRYPTO_ENGINE_UNKNOWN extends NodeError {
    constructor(x){
        super("ERR_CRYPTO_ENGINE_UNKNOWN", `Engine "${x}" was not found`);
    }
}
export class ERR_CRYPTO_FIPS_FORCED extends NodeError {
    constructor(){
        super("ERR_CRYPTO_FIPS_FORCED", "Cannot set FIPS mode, it was forced with --force-fips at startup.");
    }
}
export class ERR_CRYPTO_FIPS_UNAVAILABLE extends NodeError {
    constructor(){
        super("ERR_CRYPTO_FIPS_UNAVAILABLE", "Cannot set FIPS mode in a non-FIPS build.");
    }
}
export class ERR_CRYPTO_HASH_FINALIZED extends NodeError {
    constructor(){
        super("ERR_CRYPTO_HASH_FINALIZED", "Digest already called");
    }
}
export class ERR_CRYPTO_HASH_UPDATE_FAILED extends NodeError {
    constructor(){
        super("ERR_CRYPTO_HASH_UPDATE_FAILED", "Hash update failed");
    }
}
export class ERR_CRYPTO_INCOMPATIBLE_KEY extends NodeError {
    constructor(x, y){
        super("ERR_CRYPTO_INCOMPATIBLE_KEY", `Incompatible ${x}: ${y}`);
    }
}
export class ERR_CRYPTO_INCOMPATIBLE_KEY_OPTIONS extends NodeError {
    constructor(x, y){
        super("ERR_CRYPTO_INCOMPATIBLE_KEY_OPTIONS", `The selected key encoding ${x} ${y}.`);
    }
}
export class ERR_CRYPTO_INVALID_DIGEST extends NodeTypeError {
    constructor(x){
        super("ERR_CRYPTO_INVALID_DIGEST", `Invalid digest: ${x}`);
    }
}
export class ERR_CRYPTO_INVALID_KEY_OBJECT_TYPE extends NodeTypeError {
    constructor(x, y){
        super("ERR_CRYPTO_INVALID_KEY_OBJECT_TYPE", `Invalid key object type ${x}, expected ${y}.`);
    }
}
export class ERR_CRYPTO_INVALID_STATE extends NodeError {
    constructor(x){
        super("ERR_CRYPTO_INVALID_STATE", `Invalid state for operation ${x}`);
    }
}
export class ERR_CRYPTO_PBKDF2_ERROR extends NodeError {
    constructor(){
        super("ERR_CRYPTO_PBKDF2_ERROR", "PBKDF2 error");
    }
}
export class ERR_CRYPTO_SCRYPT_INVALID_PARAMETER extends NodeError {
    constructor(){
        super("ERR_CRYPTO_SCRYPT_INVALID_PARAMETER", "Invalid scrypt parameter");
    }
}
export class ERR_CRYPTO_SCRYPT_NOT_SUPPORTED extends NodeError {
    constructor(){
        super("ERR_CRYPTO_SCRYPT_NOT_SUPPORTED", "Scrypt algorithm not supported");
    }
}
export class ERR_CRYPTO_SIGN_KEY_REQUIRED extends NodeError {
    constructor(){
        super("ERR_CRYPTO_SIGN_KEY_REQUIRED", "No key provided to sign");
    }
}
export class ERR_DIR_CLOSED extends NodeError {
    constructor(){
        super("ERR_DIR_CLOSED", "Directory handle was closed");
    }
}
export class ERR_DIR_CONCURRENT_OPERATION extends NodeError {
    constructor(){
        super("ERR_DIR_CONCURRENT_OPERATION", "Cannot do synchronous work on directory handle with concurrent asynchronous operations");
    }
}
export class ERR_DNS_SET_SERVERS_FAILED extends NodeError {
    constructor(x, y){
        super("ERR_DNS_SET_SERVERS_FAILED", `c-ares failed to set servers: "${x}" [${y}]`);
    }
}
export class ERR_DOMAIN_CALLBACK_NOT_AVAILABLE extends NodeError {
    constructor(){
        super("ERR_DOMAIN_CALLBACK_NOT_AVAILABLE", "A callback was registered through " + "process.setUncaughtExceptionCaptureCallback(), which is mutually " + "exclusive with using the `domain` module");
    }
}
export class ERR_DOMAIN_CANNOT_SET_UNCAUGHT_EXCEPTION_CAPTURE extends NodeError {
    constructor(){
        super("ERR_DOMAIN_CANNOT_SET_UNCAUGHT_EXCEPTION_CAPTURE", "The `domain` module is in use, which is mutually exclusive with calling " + "process.setUncaughtExceptionCaptureCallback()");
    }
}
export class ERR_ENCODING_INVALID_ENCODED_DATA extends NodeErrorAbstraction {
    errno;
    constructor(encoding, ret){
        super(TypeError.prototype.name, "ERR_ENCODING_INVALID_ENCODED_DATA", `The encoded data was not valid for encoding ${encoding}`);
        Object.setPrototypeOf(this, TypeError.prototype);
        this.errno = ret;
    }
}
export class ERR_ENCODING_NOT_SUPPORTED extends NodeRangeError {
    constructor(x){
        super("ERR_ENCODING_NOT_SUPPORTED", `The "${x}" encoding is not supported`);
    }
}
export class ERR_EVAL_ESM_CANNOT_PRINT extends NodeError {
    constructor(){
        super("ERR_EVAL_ESM_CANNOT_PRINT", `--print cannot be used with ESM input`);
    }
}
export class ERR_EVENT_RECURSION extends NodeError {
    constructor(x){
        super("ERR_EVENT_RECURSION", `The event "${x}" is already being dispatched`);
    }
}
export class ERR_FEATURE_UNAVAILABLE_ON_PLATFORM extends NodeTypeError {
    constructor(x){
        super("ERR_FEATURE_UNAVAILABLE_ON_PLATFORM", `The feature ${x} is unavailable on the current platform, which is being used to run Node.js`);
    }
}
export class ERR_FS_FILE_TOO_LARGE extends NodeRangeError {
    constructor(x){
        super("ERR_FS_FILE_TOO_LARGE", `File size (${x}) is greater than 2 GB`);
    }
}
export class ERR_FS_INVALID_SYMLINK_TYPE extends NodeError {
    constructor(x){
        super("ERR_FS_INVALID_SYMLINK_TYPE", `Symlink type must be one of "dir", "file", or "junction". Received "${x}"`);
    }
}
export class ERR_HTTP2_ALTSVC_INVALID_ORIGIN extends NodeTypeError {
    constructor(){
        super("ERR_HTTP2_ALTSVC_INVALID_ORIGIN", `HTTP/2 ALTSVC frames require a valid origin`);
    }
}
export class ERR_HTTP2_ALTSVC_LENGTH extends NodeTypeError {
    constructor(){
        super("ERR_HTTP2_ALTSVC_LENGTH", `HTTP/2 ALTSVC frames are limited to 16382 bytes`);
    }
}
export class ERR_HTTP2_CONNECT_AUTHORITY extends NodeError {
    constructor(){
        super("ERR_HTTP2_CONNECT_AUTHORITY", `:authority header is required for CONNECT requests`);
    }
}
export class ERR_HTTP2_CONNECT_PATH extends NodeError {
    constructor(){
        super("ERR_HTTP2_CONNECT_PATH", `The :path header is forbidden for CONNECT requests`);
    }
}
export class ERR_HTTP2_CONNECT_SCHEME extends NodeError {
    constructor(){
        super("ERR_HTTP2_CONNECT_SCHEME", `The :scheme header is forbidden for CONNECT requests`);
    }
}
export class ERR_HTTP2_GOAWAY_SESSION extends NodeError {
    constructor(){
        super("ERR_HTTP2_GOAWAY_SESSION", `New streams cannot be created after receiving a GOAWAY`);
    }
}
export class ERR_HTTP2_HEADERS_AFTER_RESPOND extends NodeError {
    constructor(){
        super("ERR_HTTP2_HEADERS_AFTER_RESPOND", `Cannot specify additional headers after response initiated`);
    }
}
export class ERR_HTTP2_HEADERS_SENT extends NodeError {
    constructor(){
        super("ERR_HTTP2_HEADERS_SENT", `Response has already been initiated.`);
    }
}
export class ERR_HTTP2_HEADER_SINGLE_VALUE extends NodeTypeError {
    constructor(x){
        super("ERR_HTTP2_HEADER_SINGLE_VALUE", `Header field "${x}" must only have a single value`);
    }
}
export class ERR_HTTP2_INFO_STATUS_NOT_ALLOWED extends NodeRangeError {
    constructor(){
        super("ERR_HTTP2_INFO_STATUS_NOT_ALLOWED", `Informational status codes cannot be used`);
    }
}
export class ERR_HTTP2_INVALID_CONNECTION_HEADERS extends NodeTypeError {
    constructor(x){
        super("ERR_HTTP2_INVALID_CONNECTION_HEADERS", `HTTP/1 Connection specific headers are forbidden: "${x}"`);
    }
}
export class ERR_HTTP2_INVALID_HEADER_VALUE extends NodeTypeError {
    constructor(x, y){
        super("ERR_HTTP2_INVALID_HEADER_VALUE", `Invalid value "${x}" for header "${y}"`);
    }
}
export class ERR_HTTP2_INVALID_INFO_STATUS extends NodeRangeError {
    constructor(x){
        super("ERR_HTTP2_INVALID_INFO_STATUS", `Invalid informational status code: ${x}`);
    }
}
export class ERR_HTTP2_INVALID_ORIGIN extends NodeTypeError {
    constructor(){
        super("ERR_HTTP2_INVALID_ORIGIN", `HTTP/2 ORIGIN frames require a valid origin`);
    }
}
export class ERR_HTTP2_INVALID_PACKED_SETTINGS_LENGTH extends NodeRangeError {
    constructor(){
        super("ERR_HTTP2_INVALID_PACKED_SETTINGS_LENGTH", `Packed settings length must be a multiple of six`);
    }
}
export class ERR_HTTP2_INVALID_PSEUDOHEADER extends NodeTypeError {
    constructor(x){
        super("ERR_HTTP2_INVALID_PSEUDOHEADER", `"${x}" is an invalid pseudoheader or is used incorrectly`);
    }
}
export class ERR_HTTP2_INVALID_SESSION extends NodeError {
    constructor(){
        super("ERR_HTTP2_INVALID_SESSION", `The session has been destroyed`);
    }
}
export class ERR_HTTP2_INVALID_STREAM extends NodeError {
    constructor(){
        super("ERR_HTTP2_INVALID_STREAM", `The stream has been destroyed`);
    }
}
export class ERR_HTTP2_MAX_PENDING_SETTINGS_ACK extends NodeError {
    constructor(){
        super("ERR_HTTP2_MAX_PENDING_SETTINGS_ACK", `Maximum number of pending settings acknowledgements`);
    }
}
export class ERR_HTTP2_NESTED_PUSH extends NodeError {
    constructor(){
        super("ERR_HTTP2_NESTED_PUSH", `A push stream cannot initiate another push stream.`);
    }
}
export class ERR_HTTP2_NO_SOCKET_MANIPULATION extends NodeError {
    constructor(){
        super("ERR_HTTP2_NO_SOCKET_MANIPULATION", `HTTP/2 sockets should not be directly manipulated (e.g. read and written)`);
    }
}
export class ERR_HTTP2_ORIGIN_LENGTH extends NodeTypeError {
    constructor(){
        super("ERR_HTTP2_ORIGIN_LENGTH", `HTTP/2 ORIGIN frames are limited to 16382 bytes`);
    }
}
export class ERR_HTTP2_OUT_OF_STREAMS extends NodeError {
    constructor(){
        super("ERR_HTTP2_OUT_OF_STREAMS", `No stream ID is available because maximum stream ID has been reached`);
    }
}
export class ERR_HTTP2_PAYLOAD_FORBIDDEN extends NodeError {
    constructor(x){
        super("ERR_HTTP2_PAYLOAD_FORBIDDEN", `Responses with ${x} status must not have a payload`);
    }
}
export class ERR_HTTP2_PING_CANCEL extends NodeError {
    constructor(){
        super("ERR_HTTP2_PING_CANCEL", `HTTP2 ping cancelled`);
    }
}
export class ERR_HTTP2_PING_LENGTH extends NodeRangeError {
    constructor(){
        super("ERR_HTTP2_PING_LENGTH", `HTTP2 ping payload must be 8 bytes`);
    }
}
export class ERR_HTTP2_PSEUDOHEADER_NOT_ALLOWED extends NodeTypeError {
    constructor(){
        super("ERR_HTTP2_PSEUDOHEADER_NOT_ALLOWED", `Cannot set HTTP/2 pseudo-headers`);
    }
}
export class ERR_HTTP2_PUSH_DISABLED extends NodeError {
    constructor(){
        super("ERR_HTTP2_PUSH_DISABLED", `HTTP/2 client has disabled push streams`);
    }
}
export class ERR_HTTP2_SEND_FILE extends NodeError {
    constructor(){
        super("ERR_HTTP2_SEND_FILE", `Directories cannot be sent`);
    }
}
export class ERR_HTTP2_SEND_FILE_NOSEEK extends NodeError {
    constructor(){
        super("ERR_HTTP2_SEND_FILE_NOSEEK", `Offset or length can only be specified for regular files`);
    }
}
export class ERR_HTTP2_SESSION_ERROR extends NodeError {
    constructor(x){
        super("ERR_HTTP2_SESSION_ERROR", `Session closed with error code ${x}`);
    }
}
export class ERR_HTTP2_SETTINGS_CANCEL extends NodeError {
    constructor(){
        super("ERR_HTTP2_SETTINGS_CANCEL", `HTTP2 session settings canceled`);
    }
}
export class ERR_HTTP2_SOCKET_BOUND extends NodeError {
    constructor(){
        super("ERR_HTTP2_SOCKET_BOUND", `The socket is already bound to an Http2Session`);
    }
}
export class ERR_HTTP2_SOCKET_UNBOUND extends NodeError {
    constructor(){
        super("ERR_HTTP2_SOCKET_UNBOUND", `The socket has been disconnected from the Http2Session`);
    }
}
export class ERR_HTTP2_STATUS_101 extends NodeError {
    constructor(){
        super("ERR_HTTP2_STATUS_101", `HTTP status code 101 (Switching Protocols) is forbidden in HTTP/2`);
    }
}
export class ERR_HTTP2_STATUS_INVALID extends NodeRangeError {
    constructor(x){
        super("ERR_HTTP2_STATUS_INVALID", `Invalid status code: ${x}`);
    }
}
export class ERR_HTTP2_STREAM_ERROR extends NodeError {
    constructor(x){
        super("ERR_HTTP2_STREAM_ERROR", `Stream closed with error code ${x}`);
    }
}
export class ERR_HTTP2_STREAM_SELF_DEPENDENCY extends NodeError {
    constructor(){
        super("ERR_HTTP2_STREAM_SELF_DEPENDENCY", `A stream cannot depend on itself`);
    }
}
export class ERR_HTTP2_TRAILERS_ALREADY_SENT extends NodeError {
    constructor(){
        super("ERR_HTTP2_TRAILERS_ALREADY_SENT", `Trailing headers have already been sent`);
    }
}
export class ERR_HTTP2_TRAILERS_NOT_READY extends NodeError {
    constructor(){
        super("ERR_HTTP2_TRAILERS_NOT_READY", `Trailing headers cannot be sent until after the wantTrailers event is emitted`);
    }
}
export class ERR_HTTP2_UNSUPPORTED_PROTOCOL extends NodeError {
    constructor(x){
        super("ERR_HTTP2_UNSUPPORTED_PROTOCOL", `protocol "${x}" is unsupported.`);
    }
}
export class ERR_HTTP_HEADERS_SENT extends NodeError {
    constructor(x){
        super("ERR_HTTP_HEADERS_SENT", `Cannot ${x} headers after they are sent to the client`);
    }
}
export class ERR_HTTP_INVALID_HEADER_VALUE extends NodeTypeError {
    constructor(x, y){
        super("ERR_HTTP_INVALID_HEADER_VALUE", `Invalid value "${x}" for header "${y}"`);
    }
}
export class ERR_HTTP_INVALID_STATUS_CODE extends NodeRangeError {
    constructor(x){
        super("ERR_HTTP_INVALID_STATUS_CODE", `Invalid status code: ${x}`);
    }
}
export class ERR_HTTP_SOCKET_ENCODING extends NodeError {
    constructor(){
        super("ERR_HTTP_SOCKET_ENCODING", `Changing the socket encoding is not allowed per RFC7230 Section 3.`);
    }
}
export class ERR_HTTP_TRAILER_INVALID extends NodeError {
    constructor(){
        super("ERR_HTTP_TRAILER_INVALID", `Trailers are invalid with this transfer encoding`);
    }
}
export class ERR_INCOMPATIBLE_OPTION_PAIR extends NodeTypeError {
    constructor(x, y){
        super("ERR_INCOMPATIBLE_OPTION_PAIR", `Option "${x}" cannot be used in combination with option "${y}"`);
    }
}
export class ERR_INPUT_TYPE_NOT_ALLOWED extends NodeError {
    constructor(){
        super("ERR_INPUT_TYPE_NOT_ALLOWED", `--input-type can only be used with string input via --eval, --print, or STDIN`);
    }
}
export class ERR_INSPECTOR_ALREADY_ACTIVATED extends NodeError {
    constructor(){
        super("ERR_INSPECTOR_ALREADY_ACTIVATED", `Inspector is already activated. Close it with inspector.close() before activating it again.`);
    }
}
export class ERR_INSPECTOR_ALREADY_CONNECTED extends NodeError {
    constructor(x){
        super("ERR_INSPECTOR_ALREADY_CONNECTED", `${x} is already connected`);
    }
}
export class ERR_INSPECTOR_CLOSED extends NodeError {
    constructor(){
        super("ERR_INSPECTOR_CLOSED", `Session was closed`);
    }
}
export class ERR_INSPECTOR_COMMAND extends NodeError {
    constructor(x, y){
        super("ERR_INSPECTOR_COMMAND", `Inspector error ${x}: ${y}`);
    }
}
export class ERR_INSPECTOR_NOT_ACTIVE extends NodeError {
    constructor(){
        super("ERR_INSPECTOR_NOT_ACTIVE", `Inspector is not active`);
    }
}
export class ERR_INSPECTOR_NOT_AVAILABLE extends NodeError {
    constructor(){
        super("ERR_INSPECTOR_NOT_AVAILABLE", `Inspector is not available`);
    }
}
export class ERR_INSPECTOR_NOT_CONNECTED extends NodeError {
    constructor(){
        super("ERR_INSPECTOR_NOT_CONNECTED", `Session is not connected`);
    }
}
export class ERR_INSPECTOR_NOT_WORKER extends NodeError {
    constructor(){
        super("ERR_INSPECTOR_NOT_WORKER", `Current thread is not a worker`);
    }
}
export class ERR_INVALID_ASYNC_ID extends NodeRangeError {
    constructor(x, y){
        super("ERR_INVALID_ASYNC_ID", `Invalid ${x} value: ${y}`);
    }
}
export class ERR_INVALID_BUFFER_SIZE extends NodeRangeError {
    constructor(x){
        super("ERR_INVALID_BUFFER_SIZE", `Buffer size must be a multiple of ${x}`);
    }
}
export class ERR_INVALID_CALLBACK extends NodeTypeError {
    constructor(object){
        super("ERR_INVALID_CALLBACK", `Callback must be a function. Received ${inspect(object)}`);
    }
}
export class ERR_INVALID_CURSOR_POS extends NodeTypeError {
    constructor(){
        super("ERR_INVALID_CURSOR_POS", `Cannot set cursor row without setting its column`);
    }
}
export class ERR_INVALID_FD extends NodeRangeError {
    constructor(x){
        super("ERR_INVALID_FD", `"fd" must be a positive integer: ${x}`);
    }
}
export class ERR_INVALID_FD_TYPE extends NodeTypeError {
    constructor(x){
        super("ERR_INVALID_FD_TYPE", `Unsupported fd type: ${x}`);
    }
}
export class ERR_INVALID_FILE_URL_HOST extends NodeTypeError {
    constructor(x){
        super("ERR_INVALID_FILE_URL_HOST", `File URL host must be "localhost" or empty on ${x}`);
    }
}
export class ERR_INVALID_FILE_URL_PATH extends NodeTypeError {
    constructor(x){
        super("ERR_INVALID_FILE_URL_PATH", `File URL path ${x}`);
    }
}
export class ERR_INVALID_HANDLE_TYPE extends NodeTypeError {
    constructor(){
        super("ERR_INVALID_HANDLE_TYPE", `This handle type cannot be sent`);
    }
}
export class ERR_INVALID_HTTP_TOKEN extends NodeTypeError {
    constructor(x, y){
        super("ERR_INVALID_HTTP_TOKEN", `${x} must be a valid HTTP token ["${y}"]`);
    }
}
export class ERR_INVALID_IP_ADDRESS extends NodeTypeError {
    constructor(x){
        super("ERR_INVALID_IP_ADDRESS", `Invalid IP address: ${x}`);
    }
}
export class ERR_INVALID_OPT_VALUE_ENCODING extends NodeTypeError {
    constructor(x){
        super("ERR_INVALID_OPT_VALUE_ENCODING", `The value "${x}" is invalid for option "encoding"`);
    }
}
export class ERR_INVALID_PERFORMANCE_MARK extends NodeError {
    constructor(x){
        super("ERR_INVALID_PERFORMANCE_MARK", `The "${x}" performance mark has not been set`);
    }
}
export class ERR_INVALID_PROTOCOL extends NodeTypeError {
    constructor(x, y){
        super("ERR_INVALID_PROTOCOL", `Protocol "${x}" not supported. Expected "${y}"`);
    }
}
export class ERR_INVALID_REPL_EVAL_CONFIG extends NodeTypeError {
    constructor(){
        super("ERR_INVALID_REPL_EVAL_CONFIG", `Cannot specify both "breakEvalOnSigint" and "eval" for REPL`);
    }
}
export class ERR_INVALID_REPL_INPUT extends NodeTypeError {
    constructor(x){
        super("ERR_INVALID_REPL_INPUT", `${x}`);
    }
}
export class ERR_INVALID_SYNC_FORK_INPUT extends NodeTypeError {
    constructor(x){
        super("ERR_INVALID_SYNC_FORK_INPUT", `Asynchronous forks do not support Buffer, TypedArray, DataView or string input: ${x}`);
    }
}
export class ERR_INVALID_THIS extends NodeTypeError {
    constructor(x){
        super("ERR_INVALID_THIS", `Value of "this" must be of type ${x}`);
    }
}
export class ERR_INVALID_TUPLE extends NodeTypeError {
    constructor(x, y){
        super("ERR_INVALID_TUPLE", `${x} must be an iterable ${y} tuple`);
    }
}
export class ERR_INVALID_URI extends NodeURIError {
    constructor(){
        super("ERR_INVALID_URI", `URI malformed`);
    }
}
export class ERR_IPC_CHANNEL_CLOSED extends NodeError {
    constructor(){
        super("ERR_IPC_CHANNEL_CLOSED", `Channel closed`);
    }
}
export class ERR_IPC_DISCONNECTED extends NodeError {
    constructor(){
        super("ERR_IPC_DISCONNECTED", `IPC channel is already disconnected`);
    }
}
export class ERR_IPC_ONE_PIPE extends NodeError {
    constructor(){
        super("ERR_IPC_ONE_PIPE", `Child process can have only one IPC pipe`);
    }
}
export class ERR_IPC_SYNC_FORK extends NodeError {
    constructor(){
        super("ERR_IPC_SYNC_FORK", `IPC cannot be used with synchronous forks`);
    }
}
export class ERR_MANIFEST_DEPENDENCY_MISSING extends NodeError {
    constructor(x, y){
        super("ERR_MANIFEST_DEPENDENCY_MISSING", `Manifest resource ${x} does not list ${y} as a dependency specifier`);
    }
}
export class ERR_MANIFEST_INTEGRITY_MISMATCH extends NodeSyntaxError {
    constructor(x){
        super("ERR_MANIFEST_INTEGRITY_MISMATCH", `Manifest resource ${x} has multiple entries but integrity lists do not match`);
    }
}
export class ERR_MANIFEST_INVALID_RESOURCE_FIELD extends NodeTypeError {
    constructor(x, y){
        super("ERR_MANIFEST_INVALID_RESOURCE_FIELD", `Manifest resource ${x} has invalid property value for ${y}`);
    }
}
export class ERR_MANIFEST_TDZ extends NodeError {
    constructor(){
        super("ERR_MANIFEST_TDZ", `Manifest initialization has not yet run`);
    }
}
export class ERR_MANIFEST_UNKNOWN_ONERROR extends NodeSyntaxError {
    constructor(x){
        super("ERR_MANIFEST_UNKNOWN_ONERROR", `Manifest specified unknown error behavior "${x}".`);
    }
}
export class ERR_METHOD_NOT_IMPLEMENTED extends NodeError {
    constructor(x){
        super("ERR_METHOD_NOT_IMPLEMENTED", `The ${x} method is not implemented`);
    }
}
export class ERR_MISSING_ARGS extends NodeTypeError {
    constructor(...args){
        let msg = "The ";
        const len = args.length;
        const wrap = (a)=>`"${a}"`;
        args = args.map((a)=>Array.isArray(a) ? a.map(wrap).join(" or ") : wrap(a));
        switch(len){
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
    constructor(x){
        super("ERR_MISSING_OPTION", `${x} is required`);
    }
}
export class ERR_MULTIPLE_CALLBACK extends NodeError {
    constructor(){
        super("ERR_MULTIPLE_CALLBACK", `Callback called multiple times`);
    }
}
export class ERR_NAPI_CONS_FUNCTION extends NodeTypeError {
    constructor(){
        super("ERR_NAPI_CONS_FUNCTION", `Constructor must be a function`);
    }
}
export class ERR_NAPI_INVALID_DATAVIEW_ARGS extends NodeRangeError {
    constructor(){
        super("ERR_NAPI_INVALID_DATAVIEW_ARGS", `byte_offset + byte_length should be less than or equal to the size in bytes of the array passed in`);
    }
}
export class ERR_NAPI_INVALID_TYPEDARRAY_ALIGNMENT extends NodeRangeError {
    constructor(x, y){
        super("ERR_NAPI_INVALID_TYPEDARRAY_ALIGNMENT", `start offset of ${x} should be a multiple of ${y}`);
    }
}
export class ERR_NAPI_INVALID_TYPEDARRAY_LENGTH extends NodeRangeError {
    constructor(){
        super("ERR_NAPI_INVALID_TYPEDARRAY_LENGTH", `Invalid typed array length`);
    }
}
export class ERR_NO_CRYPTO extends NodeError {
    constructor(){
        super("ERR_NO_CRYPTO", `Node.js is not compiled with OpenSSL crypto support`);
    }
}
export class ERR_NO_ICU extends NodeTypeError {
    constructor(x){
        super("ERR_NO_ICU", `${x} is not supported on Node.js compiled without ICU`);
    }
}
export class ERR_QUICCLIENTSESSION_FAILED extends NodeError {
    constructor(x){
        super("ERR_QUICCLIENTSESSION_FAILED", `Failed to create a new QuicClientSession: ${x}`);
    }
}
export class ERR_QUICCLIENTSESSION_FAILED_SETSOCKET extends NodeError {
    constructor(){
        super("ERR_QUICCLIENTSESSION_FAILED_SETSOCKET", `Failed to set the QuicSocket`);
    }
}
export class ERR_QUICSESSION_DESTROYED extends NodeError {
    constructor(x){
        super("ERR_QUICSESSION_DESTROYED", `Cannot call ${x} after a QuicSession has been destroyed`);
    }
}
export class ERR_QUICSESSION_INVALID_DCID extends NodeError {
    constructor(x){
        super("ERR_QUICSESSION_INVALID_DCID", `Invalid DCID value: ${x}`);
    }
}
export class ERR_QUICSESSION_UPDATEKEY extends NodeError {
    constructor(){
        super("ERR_QUICSESSION_UPDATEKEY", `Unable to update QuicSession keys`);
    }
}
export class ERR_QUICSOCKET_DESTROYED extends NodeError {
    constructor(x){
        super("ERR_QUICSOCKET_DESTROYED", `Cannot call ${x} after a QuicSocket has been destroyed`);
    }
}
export class ERR_QUICSOCKET_INVALID_STATELESS_RESET_SECRET_LENGTH extends NodeError {
    constructor(){
        super("ERR_QUICSOCKET_INVALID_STATELESS_RESET_SECRET_LENGTH", `The stateResetToken must be exactly 16-bytes in length`);
    }
}
export class ERR_QUICSOCKET_LISTENING extends NodeError {
    constructor(){
        super("ERR_QUICSOCKET_LISTENING", `This QuicSocket is already listening`);
    }
}
export class ERR_QUICSOCKET_UNBOUND extends NodeError {
    constructor(x){
        super("ERR_QUICSOCKET_UNBOUND", `Cannot call ${x} before a QuicSocket has been bound`);
    }
}
export class ERR_QUICSTREAM_DESTROYED extends NodeError {
    constructor(x){
        super("ERR_QUICSTREAM_DESTROYED", `Cannot call ${x} after a QuicStream has been destroyed`);
    }
}
export class ERR_QUICSTREAM_INVALID_PUSH extends NodeError {
    constructor(){
        super("ERR_QUICSTREAM_INVALID_PUSH", `Push streams are only supported on client-initiated, bidirectional streams`);
    }
}
export class ERR_QUICSTREAM_OPEN_FAILED extends NodeError {
    constructor(){
        super("ERR_QUICSTREAM_OPEN_FAILED", `Opening a new QuicStream failed`);
    }
}
export class ERR_QUICSTREAM_UNSUPPORTED_PUSH extends NodeError {
    constructor(){
        super("ERR_QUICSTREAM_UNSUPPORTED_PUSH", `Push streams are not supported on this QuicSession`);
    }
}
export class ERR_QUIC_TLS13_REQUIRED extends NodeError {
    constructor(){
        super("ERR_QUIC_TLS13_REQUIRED", `QUIC requires TLS version 1.3`);
    }
}
export class ERR_SCRIPT_EXECUTION_INTERRUPTED extends NodeError {
    constructor(){
        super("ERR_SCRIPT_EXECUTION_INTERRUPTED", "Script execution was interrupted by `SIGINT`");
    }
}
export class ERR_SERVER_ALREADY_LISTEN extends NodeError {
    constructor(){
        super("ERR_SERVER_ALREADY_LISTEN", `Listen method has been called more than once without closing.`);
    }
}
export class ERR_SERVER_NOT_RUNNING extends NodeError {
    constructor(){
        super("ERR_SERVER_NOT_RUNNING", `Server is not running.`);
    }
}
export class ERR_SOCKET_ALREADY_BOUND extends NodeError {
    constructor(){
        super("ERR_SOCKET_ALREADY_BOUND", `Socket is already bound`);
    }
}
export class ERR_SOCKET_BAD_BUFFER_SIZE extends NodeTypeError {
    constructor(){
        super("ERR_SOCKET_BAD_BUFFER_SIZE", `Buffer size must be a positive integer`);
    }
}
export class ERR_SOCKET_BAD_PORT extends NodeRangeError {
    constructor(name, port, allowZero = true){
        assert(typeof allowZero === "boolean", "The 'allowZero' argument must be of type boolean.");
        const operator = allowZero ? ">=" : ">";
        super("ERR_SOCKET_BAD_PORT", `${name} should be ${operator} 0 and < 65536. Received ${port}.`);
    }
}
export class ERR_SOCKET_BAD_TYPE extends NodeTypeError {
    constructor(){
        super("ERR_SOCKET_BAD_TYPE", `Bad socket type specified. Valid types are: udp4, udp6`);
    }
}
export class ERR_SOCKET_CLOSED extends NodeError {
    constructor(){
        super("ERR_SOCKET_CLOSED", `Socket is closed`);
    }
}
export class ERR_SOCKET_DGRAM_IS_CONNECTED extends NodeError {
    constructor(){
        super("ERR_SOCKET_DGRAM_IS_CONNECTED", `Already connected`);
    }
}
export class ERR_SOCKET_DGRAM_NOT_CONNECTED extends NodeError {
    constructor(){
        super("ERR_SOCKET_DGRAM_NOT_CONNECTED", `Not connected`);
    }
}
export class ERR_SOCKET_DGRAM_NOT_RUNNING extends NodeError {
    constructor(){
        super("ERR_SOCKET_DGRAM_NOT_RUNNING", `Not running`);
    }
}
export class ERR_SRI_PARSE extends NodeSyntaxError {
    constructor(name, char, position){
        super("ERR_SRI_PARSE", `Subresource Integrity string ${name} had an unexpected ${char} at position ${position}`);
    }
}
export class ERR_STREAM_ALREADY_FINISHED extends NodeError {
    constructor(x){
        super("ERR_STREAM_ALREADY_FINISHED", `Cannot call ${x} after a stream was finished`);
    }
}
export class ERR_STREAM_CANNOT_PIPE extends NodeError {
    constructor(){
        super("ERR_STREAM_CANNOT_PIPE", `Cannot pipe, not readable`);
    }
}
export class ERR_STREAM_DESTROYED extends NodeError {
    constructor(x){
        super("ERR_STREAM_DESTROYED", `Cannot call ${x} after a stream was destroyed`);
    }
}
export class ERR_STREAM_NULL_VALUES extends NodeTypeError {
    constructor(){
        super("ERR_STREAM_NULL_VALUES", `May not write null values to stream`);
    }
}
export class ERR_STREAM_PREMATURE_CLOSE extends NodeError {
    constructor(){
        super("ERR_STREAM_PREMATURE_CLOSE", `Premature close`);
    }
}
export class ERR_STREAM_PUSH_AFTER_EOF extends NodeError {
    constructor(){
        super("ERR_STREAM_PUSH_AFTER_EOF", `stream.push() after EOF`);
    }
}
export class ERR_STREAM_UNSHIFT_AFTER_END_EVENT extends NodeError {
    constructor(){
        super("ERR_STREAM_UNSHIFT_AFTER_END_EVENT", `stream.unshift() after end event`);
    }
}
export class ERR_STREAM_WRAP extends NodeError {
    constructor(){
        super("ERR_STREAM_WRAP", `Stream has StringDecoder set or is in objectMode`);
    }
}
export class ERR_STREAM_WRITE_AFTER_END extends NodeError {
    constructor(){
        super("ERR_STREAM_WRITE_AFTER_END", `write after end`);
    }
}
export class ERR_SYNTHETIC extends NodeError {
    constructor(){
        super("ERR_SYNTHETIC", `JavaScript Callstack`);
    }
}
export class ERR_TLS_CERT_ALTNAME_INVALID extends NodeError {
    reason;
    host;
    cert;
    constructor(reason, host, cert){
        super("ERR_TLS_CERT_ALTNAME_INVALID", `Hostname/IP does not match certificate's altnames: ${reason}`);
        this.reason = reason;
        this.host = host;
        this.cert = cert;
    }
}
export class ERR_TLS_DH_PARAM_SIZE extends NodeError {
    constructor(x){
        super("ERR_TLS_DH_PARAM_SIZE", `DH parameter size ${x} is less than 2048`);
    }
}
export class ERR_TLS_HANDSHAKE_TIMEOUT extends NodeError {
    constructor(){
        super("ERR_TLS_HANDSHAKE_TIMEOUT", `TLS handshake timeout`);
    }
}
export class ERR_TLS_INVALID_CONTEXT extends NodeTypeError {
    constructor(x){
        super("ERR_TLS_INVALID_CONTEXT", `${x} must be a SecureContext`);
    }
}
export class ERR_TLS_INVALID_STATE extends NodeError {
    constructor(){
        super("ERR_TLS_INVALID_STATE", `TLS socket connection must be securely established`);
    }
}
export class ERR_TLS_INVALID_PROTOCOL_VERSION extends NodeTypeError {
    constructor(protocol, x){
        super("ERR_TLS_INVALID_PROTOCOL_VERSION", `${protocol} is not a valid ${x} TLS protocol version`);
    }
}
export class ERR_TLS_PROTOCOL_VERSION_CONFLICT extends NodeTypeError {
    constructor(prevProtocol, protocol){
        super("ERR_TLS_PROTOCOL_VERSION_CONFLICT", `TLS protocol version ${prevProtocol} conflicts with secureProtocol ${protocol}`);
    }
}
export class ERR_TLS_RENEGOTIATION_DISABLED extends NodeError {
    constructor(){
        super("ERR_TLS_RENEGOTIATION_DISABLED", `TLS session renegotiation disabled for this socket`);
    }
}
export class ERR_TLS_REQUIRED_SERVER_NAME extends NodeError {
    constructor(){
        super("ERR_TLS_REQUIRED_SERVER_NAME", `"servername" is required parameter for Server.addContext`);
    }
}
export class ERR_TLS_SESSION_ATTACK extends NodeError {
    constructor(){
        super("ERR_TLS_SESSION_ATTACK", `TLS session renegotiation attack detected`);
    }
}
export class ERR_TLS_SNI_FROM_SERVER extends NodeError {
    constructor(){
        super("ERR_TLS_SNI_FROM_SERVER", `Cannot issue SNI from a TLS server-side socket`);
    }
}
export class ERR_TRACE_EVENTS_CATEGORY_REQUIRED extends NodeTypeError {
    constructor(){
        super("ERR_TRACE_EVENTS_CATEGORY_REQUIRED", `At least one category is required`);
    }
}
export class ERR_TRACE_EVENTS_UNAVAILABLE extends NodeError {
    constructor(){
        super("ERR_TRACE_EVENTS_UNAVAILABLE", `Trace events are unavailable`);
    }
}
export class ERR_UNAVAILABLE_DURING_EXIT extends NodeError {
    constructor(){
        super("ERR_UNAVAILABLE_DURING_EXIT", `Cannot call function in process exit handler`);
    }
}
export class ERR_UNCAUGHT_EXCEPTION_CAPTURE_ALREADY_SET extends NodeError {
    constructor(){
        super("ERR_UNCAUGHT_EXCEPTION_CAPTURE_ALREADY_SET", "`process.setupUncaughtExceptionCapture()` was called while a capture callback was already active");
    }
}
export class ERR_UNESCAPED_CHARACTERS extends NodeTypeError {
    constructor(x){
        super("ERR_UNESCAPED_CHARACTERS", `${x} contains unescaped characters`);
    }
}
export class ERR_UNHANDLED_ERROR extends NodeError {
    constructor(x){
        super("ERR_UNHANDLED_ERROR", `Unhandled error. (${x})`);
    }
}
export class ERR_UNKNOWN_BUILTIN_MODULE extends NodeError {
    constructor(x){
        super("ERR_UNKNOWN_BUILTIN_MODULE", `No such built-in module: ${x}`);
    }
}
export class ERR_UNKNOWN_CREDENTIAL extends NodeError {
    constructor(x, y){
        super("ERR_UNKNOWN_CREDENTIAL", `${x} identifier does not exist: ${y}`);
    }
}
export class ERR_UNKNOWN_ENCODING extends NodeTypeError {
    constructor(x){
        super("ERR_UNKNOWN_ENCODING", `Unknown encoding: ${x}`);
    }
}
export class ERR_UNKNOWN_FILE_EXTENSION extends NodeTypeError {
    constructor(x, y){
        super("ERR_UNKNOWN_FILE_EXTENSION", `Unknown file extension "${x}" for ${y}`);
    }
}
export class ERR_UNKNOWN_MODULE_FORMAT extends NodeRangeError {
    constructor(x){
        super("ERR_UNKNOWN_MODULE_FORMAT", `Unknown module format: ${x}`);
    }
}
export class ERR_UNKNOWN_SIGNAL extends NodeTypeError {
    constructor(x){
        super("ERR_UNKNOWN_SIGNAL", `Unknown signal: ${x}`);
    }
}
export class ERR_UNSUPPORTED_DIR_IMPORT extends NodeError {
    constructor(x, y){
        super("ERR_UNSUPPORTED_DIR_IMPORT", `Directory import '${x}' is not supported resolving ES modules, imported from ${y}`);
    }
}
export class ERR_UNSUPPORTED_ESM_URL_SCHEME extends NodeError {
    constructor(){
        super("ERR_UNSUPPORTED_ESM_URL_SCHEME", `Only file and data URLs are supported by the default ESM loader`);
    }
}
export class ERR_V8BREAKITERATOR extends NodeError {
    constructor(){
        super("ERR_V8BREAKITERATOR", `Full ICU data not installed. See https://github.com/nodejs/node/wiki/Intl`);
    }
}
export class ERR_VALID_PERFORMANCE_ENTRY_TYPE extends NodeError {
    constructor(){
        super("ERR_VALID_PERFORMANCE_ENTRY_TYPE", `At least one valid performance entry type is required`);
    }
}
export class ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING extends NodeTypeError {
    constructor(){
        super("ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING", `A dynamic import callback was not specified.`);
    }
}
export class ERR_VM_MODULE_ALREADY_LINKED extends NodeError {
    constructor(){
        super("ERR_VM_MODULE_ALREADY_LINKED", `Module has already been linked`);
    }
}
export class ERR_VM_MODULE_CANNOT_CREATE_CACHED_DATA extends NodeError {
    constructor(){
        super("ERR_VM_MODULE_CANNOT_CREATE_CACHED_DATA", `Cached data cannot be created for a module which has been evaluated`);
    }
}
export class ERR_VM_MODULE_DIFFERENT_CONTEXT extends NodeError {
    constructor(){
        super("ERR_VM_MODULE_DIFFERENT_CONTEXT", `Linked modules must use the same context`);
    }
}
export class ERR_VM_MODULE_LINKING_ERRORED extends NodeError {
    constructor(){
        super("ERR_VM_MODULE_LINKING_ERRORED", `Linking has already failed for the provided module`);
    }
}
export class ERR_VM_MODULE_NOT_MODULE extends NodeError {
    constructor(){
        super("ERR_VM_MODULE_NOT_MODULE", `Provided module is not an instance of Module`);
    }
}
export class ERR_VM_MODULE_STATUS extends NodeError {
    constructor(x){
        super("ERR_VM_MODULE_STATUS", `Module status ${x}`);
    }
}
export class ERR_WASI_ALREADY_STARTED extends NodeError {
    constructor(){
        super("ERR_WASI_ALREADY_STARTED", `WASI instance has already started`);
    }
}
export class ERR_WORKER_INIT_FAILED extends NodeError {
    constructor(x){
        super("ERR_WORKER_INIT_FAILED", `Worker initialization failure: ${x}`);
    }
}
export class ERR_WORKER_NOT_RUNNING extends NodeError {
    constructor(){
        super("ERR_WORKER_NOT_RUNNING", `Worker instance not running`);
    }
}
export class ERR_WORKER_OUT_OF_MEMORY extends NodeError {
    constructor(x){
        super("ERR_WORKER_OUT_OF_MEMORY", `Worker terminated due to reaching memory limit: ${x}`);
    }
}
export class ERR_WORKER_UNSERIALIZABLE_ERROR extends NodeError {
    constructor(){
        super("ERR_WORKER_UNSERIALIZABLE_ERROR", `Serializing an uncaught exception failed`);
    }
}
export class ERR_WORKER_UNSUPPORTED_EXTENSION extends NodeTypeError {
    constructor(x){
        super("ERR_WORKER_UNSUPPORTED_EXTENSION", `The worker script extension must be ".js", ".mjs", or ".cjs". Received "${x}"`);
    }
}
export class ERR_WORKER_UNSUPPORTED_OPERATION extends NodeTypeError {
    constructor(x){
        super("ERR_WORKER_UNSUPPORTED_OPERATION", `${x} is not supported in workers`);
    }
}
export class ERR_ZLIB_INITIALIZATION_FAILED extends NodeError {
    constructor(){
        super("ERR_ZLIB_INITIALIZATION_FAILED", `Initialization failed`);
    }
}
export class ERR_FALSY_VALUE_REJECTION extends NodeError {
    reason;
    constructor(reason){
        super("ERR_FALSY_VALUE_REJECTION", "Promise was rejected with falsy value");
        this.reason = reason;
    }
}
export class ERR_HTTP2_INVALID_SETTING_VALUE extends NodeRangeError {
    actual;
    min;
    max;
    constructor(name, actual, min, max){
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
    constructor(error){
        super("ERR_HTTP2_STREAM_CANCEL", typeof error.message === "string" ? `The pending stream has been canceled (caused by: ${error.message})` : "The pending stream has been canceled");
        if (error) {
            this.cause = error;
        }
    }
}
export class ERR_INVALID_ADDRESS_FAMILY extends NodeRangeError {
    host;
    port;
    constructor(addressType, host, port){
        super("ERR_INVALID_ADDRESS_FAMILY", `Invalid address family: ${addressType} ${host}:${port}`);
        this.host = host;
        this.port = port;
    }
}
export class ERR_INVALID_CHAR extends NodeTypeError {
    constructor(name, field){
        super("ERR_INVALID_CHAR", field ? `Invalid character in ${name}` : `Invalid character in ${name} ["${field}"]`);
    }
}
export class ERR_INVALID_OPT_VALUE extends NodeTypeError {
    constructor(name, value){
        super("ERR_INVALID_OPT_VALUE", `The value "${value}" is invalid for option "${name}"`);
    }
}
export class ERR_INVALID_RETURN_PROPERTY extends NodeTypeError {
    constructor(input, name, prop, value){
        super("ERR_INVALID_RETURN_PROPERTY", `Expected a valid ${input} to be returned for the "${prop}" from the "${name}" function but got ${value}.`);
    }
}
// deno-lint-ignore no-explicit-any
function buildReturnPropertyType(value) {
    if (value && value.constructor && value.constructor.name) {
        return `instance of ${value.constructor.name}`;
    } else {
        return `type ${typeof value}`;
    }
}
export class ERR_INVALID_RETURN_PROPERTY_VALUE extends NodeTypeError {
    constructor(input, name, prop, value){
        super("ERR_INVALID_RETURN_PROPERTY_VALUE", `Expected ${input} to be returned for the "${prop}" from the "${name}" function but got ${buildReturnPropertyType(value)}.`);
    }
}
export class ERR_INVALID_RETURN_VALUE extends NodeTypeError {
    constructor(input, name, value){
        super("ERR_INVALID_RETURN_VALUE", `Expected ${input} to be returned from the "${name}" function but got ${buildReturnPropertyType(value)}.`);
    }
}
export class ERR_INVALID_URL extends NodeTypeError {
    input;
    constructor(input){
        super("ERR_INVALID_URL", `Invalid URL: ${input}`);
        this.input = input;
    }
}
export class ERR_INVALID_URL_SCHEME extends NodeTypeError {
    constructor(expected){
        expected = Array.isArray(expected) ? expected : [
            expected
        ];
        const res = expected.length === 2 ? `one of scheme ${expected[0]} or ${expected[1]}` : `of scheme ${expected[0]}`;
        super("ERR_INVALID_URL_SCHEME", `The URL must be ${res}`);
    }
}
export class ERR_MODULE_NOT_FOUND extends NodeError {
    constructor(path, base, type = "package"){
        super("ERR_MODULE_NOT_FOUND", `Cannot find ${type} '${path}' imported from ${base}`);
    }
}
export class ERR_INVALID_PACKAGE_CONFIG extends NodeError {
    constructor(path, base, message){
        const msg = `Invalid package config ${path}${base ? ` while importing ${base}` : ""}${message ? `. ${message}` : ""}`;
        super("ERR_INVALID_PACKAGE_CONFIG", msg);
    }
}
export class ERR_INVALID_MODULE_SPECIFIER extends NodeTypeError {
    constructor(request, reason, base){
        super("ERR_INVALID_MODULE_SPECIFIER", `Invalid module "${request}" ${reason}${base ? ` imported from ${base}` : ""}`);
    }
}
export class ERR_INVALID_PACKAGE_TARGET extends NodeError {
    constructor(pkgPath, key, // deno-lint-ignore no-explicit-any
    target, isImport, base){
        let msg;
        const relError = typeof target === "string" && !isImport && target.length && !target.startsWith("./");
        if (key === ".") {
            assert(isImport === false);
            msg = `Invalid "exports" main target ${JSON.stringify(target)} defined ` + `in the package config ${pkgPath}package.json${base ? ` imported from ${base}` : ""}${relError ? '; targets must start with "./"' : ""}`;
        } else {
            msg = `Invalid "${isImport ? "imports" : "exports"}" target ${JSON.stringify(target)} defined for '${key}' in the package config ${pkgPath}package.json${base ? ` imported from ${base}` : ""}${relError ? '; targets must start with "./"' : ""}`;
        }
        super("ERR_INVALID_PACKAGE_TARGET", msg);
    }
}
export class ERR_PACKAGE_IMPORT_NOT_DEFINED extends NodeTypeError {
    constructor(specifier, packagePath, base){
        const msg = `Package import specifier "${specifier}" is not defined${packagePath ? ` in package ${packagePath}package.json` : ""} imported from ${base}`;
        super("ERR_PACKAGE_IMPORT_NOT_DEFINED", msg);
    }
}
export class ERR_PACKAGE_PATH_NOT_EXPORTED extends NodeError {
    constructor(subpath, pkgPath, basePath){
        let msg;
        if (subpath === ".") {
            msg = `No "exports" main defined in ${pkgPath}package.json${basePath ? ` imported from ${basePath}` : ""}`;
        } else {
            msg = `Package subpath '${subpath}' is not defined by "exports" in ${pkgPath}package.json${basePath ? ` imported from ${basePath}` : ""}`;
        }
        super("ERR_PACKAGE_PATH_NOT_EXPORTED", msg);
    }
}
export class ERR_INTERNAL_ASSERTION extends NodeError {
    constructor(message){
        const suffix = "This is caused by either a bug in Node.js " + "or incorrect usage of Node.js internals.\n" + "Please open an issue with this stack trace at " + "https://github.com/nodejs/node/issues\n";
        super("ERR_INTERNAL_ASSERTION", message === undefined ? suffix : `${message}\n${suffix}`);
    }
}
// Using `fs.rmdir` on a path that is a file results in an ENOENT error on Windows and an ENOTDIR error on POSIX.
export class ERR_FS_RMDIR_ENOTDIR extends NodeSystemError {
    constructor(path){
        const code = isWindows ? "ENOENT" : "ENOTDIR";
        const ctx = {
            message: "not a directory",
            path,
            syscall: "rmdir",
            code,
            errno: isWindows ? ENOENT : ENOTDIR
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
        ...ctx
    });
    return ex;
}
function extractOsErrorNumberFromErrorMessage(e) {
    const match = e instanceof Error ? e.message.match(/\(os error (\d+)\)/) : false;
    if (match) {
        return +match[1];
    }
    return undefined;
}
export function connResetException(msg) {
    const ex = new Error(msg);
    // deno-lint-ignore no-explicit-any
    (ex).code = "ECONNRESET";
    return ex;
}
export function aggregateTwoErrors(innerError, outerError) {
    if (innerError && outerError && innerError !== outerError) {
        if (Array.isArray(outerError.errors)) {
            // If `outerError` is already an `AggregateError`.
            outerError.errors.push(innerError);
            return outerError;
        }
        // eslint-disable-next-line no-restricted-syntax
        const err = new AggregateError([
            outerError,
            innerError, 
        ], outerError.message);
        // deno-lint-ignore no-explicit-any
        (err).code = outerError.code;
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
// TODO(kt3k): assign all error classes here.
export { codes, hideStackFrames };
export default {
    AbortError,
    aggregateTwoErrors,
    codes
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjEyOS4wL25vZGUvaW50ZXJuYWwvZXJyb3JzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCAyMDE4LTIwMjIgdGhlIERlbm8gYXV0aG9ycy4gQWxsIHJpZ2h0cyByZXNlcnZlZC4gTUlUIGxpY2Vuc2UuXG4vLyBDb3B5cmlnaHQgTm9kZS5qcyBjb250cmlidXRvcnMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBMaWNlbnNlLlxuLyoqICoqKioqKioqKiogTk9UIElNUExFTUVOVEVEXG4gKiBFUlJfTUFOSUZFU1RfQVNTRVJUX0lOVEVHUklUWVxuICogRVJSX1FVSUNTRVNTSU9OX1ZFUlNJT05fTkVHT1RJQVRJT05cbiAqIEVSUl9SRVFVSVJFX0VTTVxuICogRVJSX1RMU19DRVJUX0FMVE5BTUVfSU5WQUxJRFxuICogRVJSX1dPUktFUl9JTlZBTElEX0VYRUNfQVJHVlxuICogRVJSX1dPUktFUl9QQVRIXG4gKiBFUlJfUVVJQ19FUlJPUlxuICogRVJSX1NPQ0tFVF9CVUZGRVJfU0laRSAvL1N5c3RlbSBlcnJvciwgc2hvdWxkbid0IGV2ZXIgaGFwcGVuIGluc2lkZSBEZW5vXG4gKiBFUlJfU1lTVEVNX0VSUk9SIC8vU3lzdGVtIGVycm9yLCBzaG91bGRuJ3QgZXZlciBoYXBwZW4gaW5zaWRlIERlbm9cbiAqIEVSUl9UVFlfSU5JVF9GQUlMRUQgLy9TeXN0ZW0gZXJyb3IsIHNob3VsZG4ndCBldmVyIGhhcHBlbiBpbnNpZGUgRGVub1xuICogRVJSX0lOVkFMSURfUEFDS0FHRV9DT05GSUcgLy8gcGFja2FnZS5qc29uIHN0dWZmLCBwcm9iYWJseSB1c2VsZXNzXG4gKiAqKioqKioqKioqKiAqL1xuXG5pbXBvcnQgeyBnZXRTeXN0ZW1FcnJvck5hbWUgfSBmcm9tIFwiLi4vdXRpbC50c1wiO1xuaW1wb3J0IHsgaW5zcGVjdCB9IGZyb20gXCIuLi9pbnRlcm5hbC91dGlsL2luc3BlY3QubWpzXCI7XG5pbXBvcnQgeyBjb2RlcyB9IGZyb20gXCIuL2Vycm9yX2NvZGVzLnRzXCI7XG5pbXBvcnQge1xuICBjb2RlTWFwLFxuICBlcnJvck1hcCxcbiAgbWFwU3lzRXJybm9Ub1V2RXJybm8sXG59IGZyb20gXCIuLi9pbnRlcm5hbF9iaW5kaW5nL3V2LnRzXCI7XG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tIFwiLi4vLi4vX3V0aWwvYXNzZXJ0LnRzXCI7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tIFwiLi4vLi4vX3V0aWwvb3MudHNcIjtcbmltcG9ydCB7IG9zIGFzIG9zQ29uc3RhbnRzIH0gZnJvbSBcIi4uL2ludGVybmFsX2JpbmRpbmcvY29uc3RhbnRzLnRzXCI7XG5jb25zdCB7XG4gIGVycm5vOiB7IEVOT1RESVIsIEVOT0VOVCB9LFxufSA9IG9zQ29uc3RhbnRzO1xuaW1wb3J0IHsgaGlkZVN0YWNrRnJhbWVzIH0gZnJvbSBcIi4vaGlkZV9zdGFja19mcmFtZXMudHNcIjtcblxuZXhwb3J0IHsgZXJyb3JNYXAgfTtcblxuY29uc3Qga0lzTm9kZUVycm9yID0gU3ltYm9sKFwia0lzTm9kZUVycm9yXCIpO1xuXG4vKipcbiAqIEBzZWUgaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvZjNlYjIyNC9saWIvaW50ZXJuYWwvZXJyb3JzLmpzXG4gKi9cbmNvbnN0IGNsYXNzUmVnRXhwID0gL14oW0EtWl1bYS16MC05XSopKyQvO1xuXG4vKipcbiAqIEBzZWUgaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL2Jsb2IvZjNlYjIyNC9saWIvaW50ZXJuYWwvZXJyb3JzLmpzXG4gKiBAZGVzY3JpcHRpb24gU29ydGVkIGJ5IGEgcm91Z2ggZXN0aW1hdGUgb24gbW9zdCBmcmVxdWVudGx5IHVzZWQgZW50cmllcy5cbiAqL1xuY29uc3Qga1R5cGVzID0gW1xuICBcInN0cmluZ1wiLFxuICBcImZ1bmN0aW9uXCIsXG4gIFwibnVtYmVyXCIsXG4gIFwib2JqZWN0XCIsXG4gIC8vIEFjY2VwdCAnRnVuY3Rpb24nIGFuZCAnT2JqZWN0JyBhcyBhbHRlcm5hdGl2ZSB0byB0aGUgbG93ZXIgY2FzZWQgdmVyc2lvbi5cbiAgXCJGdW5jdGlvblwiLFxuICBcIk9iamVjdFwiLFxuICBcImJvb2xlYW5cIixcbiAgXCJiaWdpbnRcIixcbiAgXCJzeW1ib2xcIixcbl07XG5cbi8vIE5vZGUgdXNlcyBhbiBBYm9ydEVycm9yIHRoYXQgaXNuJ3QgZXhhY3RseSB0aGUgc2FtZSBhcyB0aGUgRE9NRXhjZXB0aW9uXG4vLyB0byBtYWtlIHVzYWdlIG9mIHRoZSBlcnJvciBpbiB1c2VybGFuZCBhbmQgcmVhZGFibGUtc3RyZWFtIGVhc2llci5cbi8vIEl0IGlzIGEgcmVndWxhciBlcnJvciB3aXRoIGAuY29kZWAgYW5kIGAubmFtZWAuXG5leHBvcnQgY2xhc3MgQWJvcnRFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29kZTogc3RyaW5nO1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiVGhlIG9wZXJhdGlvbiB3YXMgYWJvcnRlZFwiKTtcbiAgICB0aGlzLmNvZGUgPSBcIkFCT1JUX0VSUlwiO1xuICAgIHRoaXMubmFtZSA9IFwiQWJvcnRFcnJvclwiO1xuICB9XG59XG5cbi8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG50eXBlIEdlbmVyaWNGdW5jdGlvbiA9ICguLi5hcmdzOiBhbnlbXSkgPT4gYW55O1xuXG5mdW5jdGlvbiBhZGROdW1lcmljYWxTZXBhcmF0b3IodmFsOiBzdHJpbmcpIHtcbiAgbGV0IHJlcyA9IFwiXCI7XG4gIGxldCBpID0gdmFsLmxlbmd0aDtcbiAgY29uc3Qgc3RhcnQgPSB2YWxbMF0gPT09IFwiLVwiID8gMSA6IDA7XG4gIGZvciAoOyBpID49IHN0YXJ0ICsgNDsgaSAtPSAzKSB7XG4gICAgcmVzID0gYF8ke3ZhbC5zbGljZShpIC0gMywgaSl9JHtyZXN9YDtcbiAgfVxuICByZXR1cm4gYCR7dmFsLnNsaWNlKDAsIGkpfSR7cmVzfWA7XG59XG5cbmNvbnN0IGNhcHR1cmVMYXJnZXJTdGFja1RyYWNlID0gaGlkZVN0YWNrRnJhbWVzKFxuICBmdW5jdGlvbiBjYXB0dXJlTGFyZ2VyU3RhY2tUcmFjZShlcnIpIHtcbiAgICAvLyBAdHMtaWdub3JlIHRoaXMgZnVuY3Rpb24gaXMgbm90IGF2YWlsYWJsZSBpbiBsaWIuZG9tLmQudHNcbiAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZShlcnIpO1xuXG4gICAgcmV0dXJuIGVycjtcbiAgfSxcbik7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXJybm9FeGNlcHRpb24gZXh0ZW5kcyBFcnJvciB7XG4gIGVycm5vPzogbnVtYmVyO1xuICBjb2RlPzogc3RyaW5nO1xuICBwYXRoPzogc3RyaW5nO1xuICBzeXNjYWxsPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIFRoaXMgY3JlYXRlcyBhbiBlcnJvciBjb21wYXRpYmxlIHdpdGggZXJyb3JzIHByb2R1Y2VkIGluIHRoZSBDKytcbiAqIFRoaXMgZnVuY3Rpb24gc2hvdWxkIHJlcGxhY2UgdGhlIGRlcHJlY2F0ZWRcbiAqIGBleGNlcHRpb25XaXRoSG9zdFBvcnQoKWAgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIGVyciBBIGxpYnV2IGVycm9yIG51bWJlclxuICogQHBhcmFtIHN5c2NhbGxcbiAqIEBwYXJhbSBhZGRyZXNzXG4gKiBAcGFyYW0gcG9ydFxuICogQHJldHVybiBUaGUgZXJyb3IuXG4gKi9cbmV4cG9ydCBjb25zdCB1dkV4Y2VwdGlvbldpdGhIb3N0UG9ydCA9IGhpZGVTdGFja0ZyYW1lcyhcbiAgZnVuY3Rpb24gdXZFeGNlcHRpb25XaXRoSG9zdFBvcnQoXG4gICAgZXJyOiBudW1iZXIsXG4gICAgc3lzY2FsbDogc3RyaW5nLFxuICAgIGFkZHJlc3M/OiBzdHJpbmcgfCBudWxsLFxuICAgIHBvcnQ/OiBudW1iZXIgfCBudWxsLFxuICApIHtcbiAgICBjb25zdCB7IDA6IGNvZGUsIDE6IHV2bXNnIH0gPSB1dkVycm1hcEdldChlcnIpIHx8IHV2VW5tYXBwZWRFcnJvcjtcbiAgICBjb25zdCBtZXNzYWdlID0gYCR7c3lzY2FsbH0gJHtjb2RlfTogJHt1dm1zZ31gO1xuICAgIGxldCBkZXRhaWxzID0gXCJcIjtcblxuICAgIGlmIChwb3J0ICYmIHBvcnQgPiAwKSB7XG4gICAgICBkZXRhaWxzID0gYCAke2FkZHJlc3N9OiR7cG9ydH1gO1xuICAgIH0gZWxzZSBpZiAoYWRkcmVzcykge1xuICAgICAgZGV0YWlscyA9IGAgJHthZGRyZXNzfWA7XG4gICAgfVxuXG4gICAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgICBjb25zdCBleDogYW55ID0gbmV3IEVycm9yKGAke21lc3NhZ2V9JHtkZXRhaWxzfWApO1xuICAgIGV4LmNvZGUgPSBjb2RlO1xuICAgIGV4LmVycm5vID0gZXJyO1xuICAgIGV4LnN5c2NhbGwgPSBzeXNjYWxsO1xuICAgIGV4LmFkZHJlc3MgPSBhZGRyZXNzO1xuXG4gICAgaWYgKHBvcnQpIHtcbiAgICAgIGV4LnBvcnQgPSBwb3J0O1xuICAgIH1cblxuICAgIHJldHVybiBjYXB0dXJlTGFyZ2VyU3RhY2tUcmFjZShleCk7XG4gIH0sXG4pO1xuXG4vKipcbiAqIFRoaXMgdXNlZCB0byBiZSBgdXRpbC5fZXJybm9FeGNlcHRpb24oKWAuXG4gKlxuICogQHBhcmFtIGVyciBBIGxpYnV2IGVycm9yIG51bWJlclxuICogQHBhcmFtIHN5c2NhbGxcbiAqIEBwYXJhbSBvcmlnaW5hbFxuICogQHJldHVybiBBIGBFcnJub0V4Y2VwdGlvbmBcbiAqL1xuZXhwb3J0IGNvbnN0IGVycm5vRXhjZXB0aW9uID0gaGlkZVN0YWNrRnJhbWVzKGZ1bmN0aW9uIGVycm5vRXhjZXB0aW9uKFxuICBlcnIsXG4gIHN5c2NhbGwsXG4gIG9yaWdpbmFsPyxcbik6IEVycm5vRXhjZXB0aW9uIHtcbiAgY29uc3QgY29kZSA9IGdldFN5c3RlbUVycm9yTmFtZShlcnIpO1xuICBjb25zdCBtZXNzYWdlID0gb3JpZ2luYWxcbiAgICA/IGAke3N5c2NhbGx9ICR7Y29kZX0gJHtvcmlnaW5hbH1gXG4gICAgOiBgJHtzeXNjYWxsfSAke2NvZGV9YDtcblxuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICBjb25zdCBleDogYW55ID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuICBleC5lcnJubyA9IGVycjtcbiAgZXguY29kZSA9IGNvZGU7XG4gIGV4LnN5c2NhbGwgPSBzeXNjYWxsO1xuXG4gIHJldHVybiBjYXB0dXJlTGFyZ2VyU3RhY2tUcmFjZShleCk7XG59KTtcblxuZnVuY3Rpb24gdXZFcnJtYXBHZXQobmFtZTogbnVtYmVyKSB7XG4gIHJldHVybiBlcnJvck1hcC5nZXQobmFtZSk7XG59XG5cbmNvbnN0IHV2VW5tYXBwZWRFcnJvciA9IFtcIlVOS05PV05cIiwgXCJ1bmtub3duIGVycm9yXCJdO1xuXG4vKipcbiAqIFRoaXMgY3JlYXRlcyBhbiBlcnJvciBjb21wYXRpYmxlIHdpdGggZXJyb3JzIHByb2R1Y2VkIGluIHRoZSBDKytcbiAqIGZ1bmN0aW9uIFVWRXhjZXB0aW9uIHVzaW5nIGEgY29udGV4dCBvYmplY3Qgd2l0aCBkYXRhIGFzc2VtYmxlZCBpbiBDKysuXG4gKiBUaGUgZ29hbCBpcyB0byBtaWdyYXRlIHRoZW0gdG8gRVJSXyogZXJyb3JzIGxhdGVyIHdoZW4gY29tcGF0aWJpbGl0eSBpc1xuICogbm90IGEgY29uY2Vybi5cbiAqXG4gKiBAcGFyYW0gY3R4XG4gKiBAcmV0dXJuIFRoZSBlcnJvci5cbiAqL1xuZXhwb3J0IGNvbnN0IHV2RXhjZXB0aW9uID0gaGlkZVN0YWNrRnJhbWVzKGZ1bmN0aW9uIHV2RXhjZXB0aW9uKGN0eCkge1xuICBjb25zdCB7IDA6IGNvZGUsIDE6IHV2bXNnIH0gPSB1dkVycm1hcEdldChjdHguZXJybm8pIHx8IHV2VW5tYXBwZWRFcnJvcjtcblxuICBsZXQgbWVzc2FnZSA9IGAke2NvZGV9OiAke2N0eC5tZXNzYWdlIHx8IHV2bXNnfSwgJHtjdHguc3lzY2FsbH1gO1xuXG4gIGxldCBwYXRoO1xuICBsZXQgZGVzdDtcblxuICBpZiAoY3R4LnBhdGgpIHtcbiAgICBwYXRoID0gY3R4LnBhdGgudG9TdHJpbmcoKTtcbiAgICBtZXNzYWdlICs9IGAgJyR7cGF0aH0nYDtcbiAgfVxuICBpZiAoY3R4LmRlc3QpIHtcbiAgICBkZXN0ID0gY3R4LmRlc3QudG9TdHJpbmcoKTtcbiAgICBtZXNzYWdlICs9IGAgLT4gJyR7ZGVzdH0nYDtcbiAgfVxuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGVycjogYW55ID0gbmV3IEVycm9yKG1lc3NhZ2UpO1xuXG4gIGZvciAoY29uc3QgcHJvcCBvZiBPYmplY3Qua2V5cyhjdHgpKSB7XG4gICAgaWYgKHByb3AgPT09IFwibWVzc2FnZVwiIHx8IHByb3AgPT09IFwicGF0aFwiIHx8IHByb3AgPT09IFwiZGVzdFwiKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBlcnJbcHJvcF0gPSBjdHhbcHJvcF07XG4gIH1cblxuICBlcnIuY29kZSA9IGNvZGU7XG5cbiAgaWYgKHBhdGgpIHtcbiAgICBlcnIucGF0aCA9IHBhdGg7XG4gIH1cblxuICBpZiAoZGVzdCkge1xuICAgIGVyci5kZXN0ID0gZGVzdDtcbiAgfVxuXG4gIHJldHVybiBjYXB0dXJlTGFyZ2VyU3RhY2tUcmFjZShlcnIpO1xufSk7XG5cbi8qKlxuICogRGVwcmVjYXRlZCwgbmV3IGZ1bmN0aW9uIGlzIGB1dkV4Y2VwdGlvbldpdGhIb3N0UG9ydCgpYFxuICogTmV3IGZ1bmN0aW9uIGFkZGVkIHRoZSBlcnJvciBkZXNjcmlwdGlvbiBkaXJlY3RseVxuICogZnJvbSBDKysuIHRoaXMgbWV0aG9kIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuICogQHBhcmFtIGVyciBBIGxpYnV2IGVycm9yIG51bWJlclxuICogQHBhcmFtIHN5c2NhbGxcbiAqIEBwYXJhbSBhZGRyZXNzXG4gKiBAcGFyYW0gcG9ydFxuICogQHBhcmFtIGFkZGl0aW9uYWxcbiAqL1xuZXhwb3J0IGNvbnN0IGV4Y2VwdGlvbldpdGhIb3N0UG9ydCA9IGhpZGVTdGFja0ZyYW1lcyhcbiAgZnVuY3Rpb24gZXhjZXB0aW9uV2l0aEhvc3RQb3J0KFxuICAgIGVycjogbnVtYmVyLFxuICAgIHN5c2NhbGw6IHN0cmluZyxcbiAgICBhZGRyZXNzOiBzdHJpbmcsXG4gICAgcG9ydDogbnVtYmVyLFxuICAgIGFkZGl0aW9uYWw/OiBzdHJpbmcsXG4gICkge1xuICAgIGNvbnN0IGNvZGUgPSBnZXRTeXN0ZW1FcnJvck5hbWUoZXJyKTtcbiAgICBsZXQgZGV0YWlscyA9IFwiXCI7XG5cbiAgICBpZiAocG9ydCAmJiBwb3J0ID4gMCkge1xuICAgICAgZGV0YWlscyA9IGAgJHthZGRyZXNzfToke3BvcnR9YDtcbiAgICB9IGVsc2UgaWYgKGFkZHJlc3MpIHtcbiAgICAgIGRldGFpbHMgPSBgICR7YWRkcmVzc31gO1xuICAgIH1cblxuICAgIGlmIChhZGRpdGlvbmFsKSB7XG4gICAgICBkZXRhaWxzICs9IGAgLSBMb2NhbCAoJHthZGRpdGlvbmFsfSlgO1xuICAgIH1cblxuICAgIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gICAgY29uc3QgZXg6IGFueSA9IG5ldyBFcnJvcihgJHtzeXNjYWxsfSAke2NvZGV9JHtkZXRhaWxzfWApO1xuICAgIGV4LmVycm5vID0gZXJyO1xuICAgIGV4LmNvZGUgPSBjb2RlO1xuICAgIGV4LnN5c2NhbGwgPSBzeXNjYWxsO1xuICAgIGV4LmFkZHJlc3MgPSBhZGRyZXNzO1xuXG4gICAgaWYgKHBvcnQpIHtcbiAgICAgIGV4LnBvcnQgPSBwb3J0O1xuICAgIH1cblxuICAgIHJldHVybiBjYXB0dXJlTGFyZ2VyU3RhY2tUcmFjZShleCk7XG4gIH0sXG4pO1xuXG4vKipcbiAqIEBwYXJhbSBjb2RlIEEgbGlidXYgZXJyb3IgbnVtYmVyIG9yIGEgYy1hcmVzIGVycm9yIGNvZGVcbiAqIEBwYXJhbSBzeXNjYWxsXG4gKiBAcGFyYW0gaG9zdG5hbWVcbiAqL1xuZXhwb3J0IGNvbnN0IGRuc0V4Y2VwdGlvbiA9IGhpZGVTdGFja0ZyYW1lcyhmdW5jdGlvbiAoY29kZSwgc3lzY2FsbCwgaG9zdG5hbWUpIHtcbiAgbGV0IGVycm5vO1xuXG4gIC8vIElmIGBjb2RlYCBpcyBvZiB0eXBlIG51bWJlciwgaXQgaXMgYSBsaWJ1diBlcnJvciBudW1iZXIsIGVsc2UgaXQgaXMgYVxuICAvLyBjLWFyZXMgZXJyb3IgY29kZS5cbiAgaWYgKHR5cGVvZiBjb2RlID09PSBcIm51bWJlclwiKSB7XG4gICAgZXJybm8gPSBjb2RlO1xuICAgIC8vIEVOT1RGT1VORCBpcyBub3QgYSBwcm9wZXIgUE9TSVggZXJyb3IsIGJ1dCB0aGlzIGVycm9yIGhhcyBiZWVuIGluIHBsYWNlXG4gICAgLy8gbG9uZyBlbm91Z2ggdGhhdCBpdCdzIG5vdCBwcmFjdGljYWwgdG8gcmVtb3ZlIGl0LlxuICAgIGlmIChcbiAgICAgIGNvZGUgPT09IGNvZGVNYXAuZ2V0KFwiRUFJX05PREFUQVwiKSB8fFxuICAgICAgY29kZSA9PT0gY29kZU1hcC5nZXQoXCJFQUlfTk9OQU1FXCIpXG4gICAgKSB7XG4gICAgICBjb2RlID0gXCJFTk9URk9VTkRcIjsgLy8gRmFicmljYXRlZCBlcnJvciBuYW1lLlxuICAgIH0gZWxzZSB7XG4gICAgICBjb2RlID0gZ2V0U3lzdGVtRXJyb3JOYW1lKGNvZGUpO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IG1lc3NhZ2UgPSBgJHtzeXNjYWxsfSAke2NvZGV9JHtob3N0bmFtZSA/IGAgJHtob3N0bmFtZX1gIDogXCJcIn1gO1xuXG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIGNvbnN0IGV4OiBhbnkgPSBuZXcgRXJyb3IobWVzc2FnZSk7XG4gIGV4LmVycm5vID0gZXJybm87XG4gIGV4LmNvZGUgPSBjb2RlO1xuICBleC5zeXNjYWxsID0gc3lzY2FsbDtcblxuICBpZiAoaG9zdG5hbWUpIHtcbiAgICBleC5ob3N0bmFtZSA9IGhvc3RuYW1lO1xuICB9XG5cbiAgcmV0dXJuIGNhcHR1cmVMYXJnZXJTdGFja1RyYWNlKGV4KTtcbn0pO1xuXG4vKipcbiAqIEFsbCBlcnJvciBpbnN0YW5jZXMgaW4gTm9kZSBoYXZlIGFkZGl0aW9uYWwgbWV0aG9kcyBhbmQgcHJvcGVydGllc1xuICogVGhpcyBleHBvcnQgY2xhc3MgaXMgbWVhbnQgdG8gYmUgZXh0ZW5kZWQgYnkgdGhlc2UgaW5zdGFuY2VzIGFic3RyYWN0aW5nIG5hdGl2ZSBKUyBlcnJvciBpbnN0YW5jZXNcbiAqL1xuZXhwb3J0IGNsYXNzIE5vZGVFcnJvckFic3RyYWN0aW9uIGV4dGVuZHMgRXJyb3Ige1xuICBjb2RlOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBjb2RlOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMuY29kZSA9IGNvZGU7XG4gICAgdGhpcy5uYW1lID0gbmFtZTtcbiAgICAvL1RoaXMgbnVtYmVyIGNoYW5nZXMgZGVwZW5kaW5nIG9uIHRoZSBuYW1lIG9mIHRoaXMgY2xhc3NcbiAgICAvLzIwIGNoYXJhY3RlcnMgYXMgb2Ygbm93XG4gICAgdGhpcy5zdGFjayA9IHRoaXMuc3RhY2sgJiYgYCR7bmFtZX0gWyR7dGhpcy5jb2RlfV0ke3RoaXMuc3RhY2suc2xpY2UoMjApfWA7XG4gIH1cblxuICBvdmVycmlkZSB0b1N0cmluZygpIHtcbiAgICByZXR1cm4gYCR7dGhpcy5uYW1lfSBbJHt0aGlzLmNvZGV9XTogJHt0aGlzLm1lc3NhZ2V9YDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTm9kZUVycm9yIGV4dGVuZHMgTm9kZUVycm9yQWJzdHJhY3Rpb24ge1xuICBjb25zdHJ1Y3Rvcihjb2RlOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKEVycm9yLnByb3RvdHlwZS5uYW1lLCBjb2RlLCBtZXNzYWdlKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgTm9kZVN5bnRheEVycm9yIGV4dGVuZHMgTm9kZUVycm9yQWJzdHJhY3Rpb25cbiAgaW1wbGVtZW50cyBTeW50YXhFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGNvZGU6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoU3ludGF4RXJyb3IucHJvdG90eXBlLm5hbWUsIGNvZGUsIG1lc3NhZ2UpO1xuICAgIE9iamVjdC5zZXRQcm90b3R5cGVPZih0aGlzLCBTeW50YXhFcnJvci5wcm90b3R5cGUpO1xuICAgIHRoaXMudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gYCR7dGhpcy5uYW1lfSBbJHt0aGlzLmNvZGV9XTogJHt0aGlzLm1lc3NhZ2V9YDtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBOb2RlUmFuZ2VFcnJvciBleHRlbmRzIE5vZGVFcnJvckFic3RyYWN0aW9uIHtcbiAgY29uc3RydWN0b3IoY29kZTogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihSYW5nZUVycm9yLnByb3RvdHlwZS5uYW1lLCBjb2RlLCBtZXNzYWdlKTtcbiAgICBPYmplY3Quc2V0UHJvdG90eXBlT2YodGhpcywgUmFuZ2VFcnJvci5wcm90b3R5cGUpO1xuICAgIHRoaXMudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gYCR7dGhpcy5uYW1lfSBbJHt0aGlzLmNvZGV9XTogJHt0aGlzLm1lc3NhZ2V9YDtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBOb2RlVHlwZUVycm9yIGV4dGVuZHMgTm9kZUVycm9yQWJzdHJhY3Rpb24gaW1wbGVtZW50cyBUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcihjb2RlOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykge1xuICAgIHN1cGVyKFR5cGVFcnJvci5wcm90b3R5cGUubmFtZSwgY29kZSwgbWVzc2FnZSk7XG4gICAgT2JqZWN0LnNldFByb3RvdHlwZU9mKHRoaXMsIFR5cGVFcnJvci5wcm90b3R5cGUpO1xuICAgIHRoaXMudG9TdHJpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gYCR7dGhpcy5uYW1lfSBbJHt0aGlzLmNvZGV9XTogJHt0aGlzLm1lc3NhZ2V9YDtcbiAgICB9O1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBOb2RlVVJJRXJyb3IgZXh0ZW5kcyBOb2RlRXJyb3JBYnN0cmFjdGlvbiBpbXBsZW1lbnRzIFVSSUVycm9yIHtcbiAgY29uc3RydWN0b3IoY29kZTogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpIHtcbiAgICBzdXBlcihVUklFcnJvci5wcm90b3R5cGUubmFtZSwgY29kZSwgbWVzc2FnZSk7XG4gICAgT2JqZWN0LnNldFByb3RvdHlwZU9mKHRoaXMsIFVSSUVycm9yLnByb3RvdHlwZSk7XG4gICAgdGhpcy50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBgJHt0aGlzLm5hbWV9IFske3RoaXMuY29kZX1dOiAke3RoaXMubWVzc2FnZX1gO1xuICAgIH07XG4gIH1cbn1cblxuaW50ZXJmYWNlIE5vZGVTeXN0ZW1FcnJvckN0eCB7XG4gIGNvZGU6IHN0cmluZztcbiAgc3lzY2FsbDogc3RyaW5nO1xuICBtZXNzYWdlOiBzdHJpbmc7XG4gIGVycm5vOiBudW1iZXI7XG4gIHBhdGg/OiBzdHJpbmc7XG4gIGRlc3Q/OiBzdHJpbmc7XG59XG4vLyBBIHNwZWNpYWxpemVkIEVycm9yIHRoYXQgaW5jbHVkZXMgYW4gYWRkaXRpb25hbCBpbmZvIHByb3BlcnR5IHdpdGhcbi8vIGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGVycm9yIGNvbmRpdGlvbi5cbi8vIEl0IGhhcyB0aGUgcHJvcGVydGllcyBwcmVzZW50IGluIGEgVVZFeGNlcHRpb24gYnV0IHdpdGggYSBjdXN0b20gZXJyb3Jcbi8vIG1lc3NhZ2UgZm9sbG93ZWQgYnkgdGhlIHV2IGVycm9yIGNvZGUgYW5kIHV2IGVycm9yIG1lc3NhZ2UuXG4vLyBJdCBhbHNvIGhhcyBpdHMgb3duIGVycm9yIGNvZGUgd2l0aCB0aGUgb3JpZ2luYWwgdXYgZXJyb3IgY29udGV4dCBwdXQgaW50b1xuLy8gYGVyci5pbmZvYC5cbi8vIFRoZSBjb250ZXh0IHBhc3NlZCBpbnRvIHRoaXMgZXJyb3IgbXVzdCBoYXZlIC5jb2RlLCAuc3lzY2FsbCBhbmQgLm1lc3NhZ2UsXG4vLyBhbmQgbWF5IGhhdmUgLnBhdGggYW5kIC5kZXN0LlxuY2xhc3MgTm9kZVN5c3RlbUVycm9yIGV4dGVuZHMgTm9kZUVycm9yQWJzdHJhY3Rpb24ge1xuICBjb25zdHJ1Y3RvcihrZXk6IHN0cmluZywgY29udGV4dDogTm9kZVN5c3RlbUVycm9yQ3R4LCBtc2dQcmVmaXg6IHN0cmluZykge1xuICAgIGxldCBtZXNzYWdlID0gYCR7bXNnUHJlZml4fTogJHtjb250ZXh0LnN5c2NhbGx9IHJldHVybmVkIGAgK1xuICAgICAgYCR7Y29udGV4dC5jb2RlfSAoJHtjb250ZXh0Lm1lc3NhZ2V9KWA7XG5cbiAgICBpZiAoY29udGV4dC5wYXRoICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIG1lc3NhZ2UgKz0gYCAke2NvbnRleHQucGF0aH1gO1xuICAgIH1cbiAgICBpZiAoY29udGV4dC5kZXN0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIG1lc3NhZ2UgKz0gYCA9PiAke2NvbnRleHQuZGVzdH1gO1xuICAgIH1cblxuICAgIHN1cGVyKFwiU3lzdGVtRXJyb3JcIiwga2V5LCBtZXNzYWdlKTtcblxuICAgIGNhcHR1cmVMYXJnZXJTdGFja1RyYWNlKHRoaXMpO1xuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgICAgW2tJc05vZGVFcnJvcl06IHtcbiAgICAgICAgdmFsdWU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IGZhbHNlLFxuICAgICAgICB3cml0YWJsZTogZmFsc2UsXG4gICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBpbmZvOiB7XG4gICAgICAgIHZhbHVlOiBjb250ZXh0LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgICBlcnJubzoge1xuICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnRleHQuZXJybm87XG4gICAgICAgIH0sXG4gICAgICAgIHNldDogKHZhbHVlKSA9PiB7XG4gICAgICAgICAgY29udGV4dC5lcnJubyA9IHZhbHVlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB9LFxuICAgICAgc3lzY2FsbDoge1xuICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnRleHQuc3lzY2FsbDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiAodmFsdWUpID0+IHtcbiAgICAgICAgICBjb250ZXh0LnN5c2NhbGwgPSB2YWx1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIGlmIChjb250ZXh0LnBhdGggIT09IHVuZGVmaW5lZCkge1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIFwicGF0aFwiLCB7XG4gICAgICAgIGdldCgpIHtcbiAgICAgICAgICByZXR1cm4gY29udGV4dC5wYXRoO1xuICAgICAgICB9LFxuICAgICAgICBzZXQ6ICh2YWx1ZSkgPT4ge1xuICAgICAgICAgIGNvbnRleHQucGF0aCA9IHZhbHVlO1xuICAgICAgICB9LFxuICAgICAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoY29udGV4dC5kZXN0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBcImRlc3RcIiwge1xuICAgICAgICBnZXQoKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnRleHQuZGVzdDtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiAodmFsdWUpID0+IHtcbiAgICAgICAgICBjb250ZXh0LmRlc3QgPSB2YWx1ZTtcbiAgICAgICAgfSxcbiAgICAgICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgb3ZlcnJpZGUgdG9TdHJpbmcoKSB7XG4gICAgcmV0dXJuIGAke3RoaXMubmFtZX0gWyR7dGhpcy5jb2RlfV06ICR7dGhpcy5tZXNzYWdlfWA7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWFrZVN5c3RlbUVycm9yV2l0aENvZGUoa2V5OiBzdHJpbmcsIG1zZ1ByZml4OiBzdHJpbmcpIHtcbiAgcmV0dXJuIGNsYXNzIE5vZGVFcnJvciBleHRlbmRzIE5vZGVTeXN0ZW1FcnJvciB7XG4gICAgY29uc3RydWN0b3IoY3R4OiBOb2RlU3lzdGVtRXJyb3JDdHgpIHtcbiAgICAgIHN1cGVyKGtleSwgY3R4LCBtc2dQcmZpeCk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgY29uc3QgRVJSX0ZTX0VJU0RJUiA9IG1ha2VTeXN0ZW1FcnJvcldpdGhDb2RlKFxuICBcIkVSUl9GU19FSVNESVJcIixcbiAgXCJQYXRoIGlzIGEgZGlyZWN0b3J5XCIsXG4pO1xuXG5mdW5jdGlvbiBjcmVhdGVJbnZhbGlkQXJnVHlwZShcbiAgbmFtZTogc3RyaW5nLFxuICBleHBlY3RlZDogc3RyaW5nIHwgc3RyaW5nW10sXG4pOiBzdHJpbmcge1xuICAvLyBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvYmxvYi9mM2ViMjI0L2xpYi9pbnRlcm5hbC9lcnJvcnMuanMjTDEwMzctTDEwODdcbiAgZXhwZWN0ZWQgPSBBcnJheS5pc0FycmF5KGV4cGVjdGVkKSA/IGV4cGVjdGVkIDogW2V4cGVjdGVkXTtcbiAgbGV0IG1zZyA9IFwiVGhlIFwiO1xuICBpZiAobmFtZS5lbmRzV2l0aChcIiBhcmd1bWVudFwiKSkge1xuICAgIC8vIEZvciBjYXNlcyBsaWtlICdmaXJzdCBhcmd1bWVudCdcbiAgICBtc2cgKz0gYCR7bmFtZX0gYDtcbiAgfSBlbHNlIHtcbiAgICBjb25zdCB0eXBlID0gbmFtZS5pbmNsdWRlcyhcIi5cIikgPyBcInByb3BlcnR5XCIgOiBcImFyZ3VtZW50XCI7XG4gICAgbXNnICs9IGBcIiR7bmFtZX1cIiAke3R5cGV9IGA7XG4gIH1cbiAgbXNnICs9IFwibXVzdCBiZSBcIjtcblxuICBjb25zdCB0eXBlcyA9IFtdO1xuICBjb25zdCBpbnN0YW5jZXMgPSBbXTtcbiAgY29uc3Qgb3RoZXIgPSBbXTtcbiAgZm9yIChjb25zdCB2YWx1ZSBvZiBleHBlY3RlZCkge1xuICAgIGlmIChrVHlwZXMuaW5jbHVkZXModmFsdWUpKSB7XG4gICAgICB0eXBlcy5wdXNoKHZhbHVlLnRvTG9jYWxlTG93ZXJDYXNlKCkpO1xuICAgIH0gZWxzZSBpZiAoY2xhc3NSZWdFeHAudGVzdCh2YWx1ZSkpIHtcbiAgICAgIGluc3RhbmNlcy5wdXNoKHZhbHVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3RoZXIucHVzaCh2YWx1ZSk7XG4gICAgfVxuICB9XG5cbiAgLy8gU3BlY2lhbCBoYW5kbGUgYG9iamVjdGAgaW4gY2FzZSBvdGhlciBpbnN0YW5jZXMgYXJlIGFsbG93ZWQgdG8gb3V0bGluZVxuICAvLyB0aGUgZGlmZmVyZW5jZXMgYmV0d2VlbiBlYWNoIG90aGVyLlxuICBpZiAoaW5zdGFuY2VzLmxlbmd0aCA+IDApIHtcbiAgICBjb25zdCBwb3MgPSB0eXBlcy5pbmRleE9mKFwib2JqZWN0XCIpO1xuICAgIGlmIChwb3MgIT09IC0xKSB7XG4gICAgICB0eXBlcy5zcGxpY2UocG9zLCAxKTtcbiAgICAgIGluc3RhbmNlcy5wdXNoKFwiT2JqZWN0XCIpO1xuICAgIH1cbiAgfVxuXG4gIGlmICh0eXBlcy5sZW5ndGggPiAwKSB7XG4gICAgaWYgKHR5cGVzLmxlbmd0aCA+IDIpIHtcbiAgICAgIGNvbnN0IGxhc3QgPSB0eXBlcy5wb3AoKTtcbiAgICAgIG1zZyArPSBgb25lIG9mIHR5cGUgJHt0eXBlcy5qb2luKFwiLCBcIil9LCBvciAke2xhc3R9YDtcbiAgICB9IGVsc2UgaWYgKHR5cGVzLmxlbmd0aCA9PT0gMikge1xuICAgICAgbXNnICs9IGBvbmUgb2YgdHlwZSAke3R5cGVzWzBdfSBvciAke3R5cGVzWzFdfWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1zZyArPSBgb2YgdHlwZSAke3R5cGVzWzBdfWA7XG4gICAgfVxuICAgIGlmIChpbnN0YW5jZXMubGVuZ3RoID4gMCB8fCBvdGhlci5sZW5ndGggPiAwKSB7XG4gICAgICBtc2cgKz0gXCIgb3IgXCI7XG4gICAgfVxuICB9XG5cbiAgaWYgKGluc3RhbmNlcy5sZW5ndGggPiAwKSB7XG4gICAgaWYgKGluc3RhbmNlcy5sZW5ndGggPiAyKSB7XG4gICAgICBjb25zdCBsYXN0ID0gaW5zdGFuY2VzLnBvcCgpO1xuICAgICAgbXNnICs9IGBhbiBpbnN0YW5jZSBvZiAke2luc3RhbmNlcy5qb2luKFwiLCBcIil9LCBvciAke2xhc3R9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgbXNnICs9IGBhbiBpbnN0YW5jZSBvZiAke2luc3RhbmNlc1swXX1gO1xuICAgICAgaWYgKGluc3RhbmNlcy5sZW5ndGggPT09IDIpIHtcbiAgICAgICAgbXNnICs9IGAgb3IgJHtpbnN0YW5jZXNbMV19YDtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG90aGVyLmxlbmd0aCA+IDApIHtcbiAgICAgIG1zZyArPSBcIiBvciBcIjtcbiAgICB9XG4gIH1cblxuICBpZiAob3RoZXIubGVuZ3RoID4gMCkge1xuICAgIGlmIChvdGhlci5sZW5ndGggPiAyKSB7XG4gICAgICBjb25zdCBsYXN0ID0gb3RoZXIucG9wKCk7XG4gICAgICBtc2cgKz0gYG9uZSBvZiAke290aGVyLmpvaW4oXCIsIFwiKX0sIG9yICR7bGFzdH1gO1xuICAgIH0gZWxzZSBpZiAob3RoZXIubGVuZ3RoID09PSAyKSB7XG4gICAgICBtc2cgKz0gYG9uZSBvZiAke290aGVyWzBdfSBvciAke290aGVyWzFdfWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChvdGhlclswXS50b0xvd2VyQ2FzZSgpICE9PSBvdGhlclswXSkge1xuICAgICAgICBtc2cgKz0gXCJhbiBcIjtcbiAgICAgIH1cbiAgICAgIG1zZyArPSBgJHtvdGhlclswXX1gO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtc2c7XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9BUkdfVFlQRV9SQU5HRSBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBleHBlY3RlZDogc3RyaW5nIHwgc3RyaW5nW10sIGFjdHVhbDogdW5rbm93bikge1xuICAgIGNvbnN0IG1zZyA9IGNyZWF0ZUludmFsaWRBcmdUeXBlKG5hbWUsIGV4cGVjdGVkKTtcblxuICAgIHN1cGVyKFwiRVJSX0lOVkFMSURfQVJHX1RZUEVcIiwgYCR7bXNnfS4ke2ludmFsaWRBcmdUeXBlSGVscGVyKGFjdHVhbCl9YCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX0FSR19UWVBFIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgZXhwZWN0ZWQ6IHN0cmluZyB8IHN0cmluZ1tdLCBhY3R1YWw6IHVua25vd24pIHtcbiAgICBjb25zdCBtc2cgPSBjcmVhdGVJbnZhbGlkQXJnVHlwZShuYW1lLCBleHBlY3RlZCk7XG5cbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX0FSR19UWVBFXCIsIGAke21zZ30uJHtpbnZhbGlkQXJnVHlwZUhlbHBlcihhY3R1YWwpfWApO1xuICB9XG5cbiAgc3RhdGljIFJhbmdlRXJyb3IgPSBFUlJfSU5WQUxJRF9BUkdfVFlQRV9SQU5HRTtcbn1cblxuY2xhc3MgRVJSX0lOVkFMSURfQVJHX1ZBTFVFX1JBTkdFIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHZhbHVlOiB1bmtub3duLCByZWFzb246IHN0cmluZyA9IFwiaXMgaW52YWxpZFwiKSB7XG4gICAgY29uc3QgdHlwZSA9IG5hbWUuaW5jbHVkZXMoXCIuXCIpID8gXCJwcm9wZXJ0eVwiIDogXCJhcmd1bWVudFwiO1xuICAgIGNvbnN0IGluc3BlY3RlZCA9IGluc3BlY3QodmFsdWUpO1xuXG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlZBTElEX0FSR19WQUxVRVwiLFxuICAgICAgYFRoZSAke3R5cGV9ICcke25hbWV9JyAke3JlYXNvbn0uIFJlY2VpdmVkICR7aW5zcGVjdGVkfWAsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfQVJHX1ZBTFVFIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgdmFsdWU6IHVua25vd24sIHJlYXNvbjogc3RyaW5nID0gXCJpcyBpbnZhbGlkXCIpIHtcbiAgICBjb25zdCB0eXBlID0gbmFtZS5pbmNsdWRlcyhcIi5cIikgPyBcInByb3BlcnR5XCIgOiBcImFyZ3VtZW50XCI7XG4gICAgY29uc3QgaW5zcGVjdGVkID0gaW5zcGVjdCh2YWx1ZSk7XG5cbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOVkFMSURfQVJHX1ZBTFVFXCIsXG4gICAgICBgVGhlICR7dHlwZX0gJyR7bmFtZX0nICR7cmVhc29ufS4gUmVjZWl2ZWQgJHtpbnNwZWN0ZWR9YCxcbiAgICApO1xuICB9XG5cbiAgc3RhdGljIFJhbmdlRXJyb3IgPSBFUlJfSU5WQUxJRF9BUkdfVkFMVUVfUkFOR0U7XG59XG5cbi8vIEEgaGVscGVyIGZ1bmN0aW9uIHRvIHNpbXBsaWZ5IGNoZWNraW5nIGZvciBFUlJfSU5WQUxJRF9BUkdfVFlQRSBvdXRwdXQuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZnVuY3Rpb24gaW52YWxpZEFyZ1R5cGVIZWxwZXIoaW5wdXQ6IGFueSkge1xuICBpZiAoaW5wdXQgPT0gbnVsbCkge1xuICAgIHJldHVybiBgIFJlY2VpdmVkICR7aW5wdXR9YDtcbiAgfVxuICBpZiAodHlwZW9mIGlucHV0ID09PSBcImZ1bmN0aW9uXCIgJiYgaW5wdXQubmFtZSkge1xuICAgIHJldHVybiBgIFJlY2VpdmVkIGZ1bmN0aW9uICR7aW5wdXQubmFtZX1gO1xuICB9XG4gIGlmICh0eXBlb2YgaW5wdXQgPT09IFwib2JqZWN0XCIpIHtcbiAgICBpZiAoaW5wdXQuY29uc3RydWN0b3IgJiYgaW5wdXQuY29uc3RydWN0b3IubmFtZSkge1xuICAgICAgcmV0dXJuIGAgUmVjZWl2ZWQgYW4gaW5zdGFuY2Ugb2YgJHtpbnB1dC5jb25zdHJ1Y3Rvci5uYW1lfWA7XG4gICAgfVxuICAgIHJldHVybiBgIFJlY2VpdmVkICR7aW5zcGVjdChpbnB1dCwgeyBkZXB0aDogLTEgfSl9YDtcbiAgfVxuICBsZXQgaW5zcGVjdGVkID0gaW5zcGVjdChpbnB1dCwgeyBjb2xvcnM6IGZhbHNlIH0pO1xuICBpZiAoaW5zcGVjdGVkLmxlbmd0aCA+IDI1KSB7XG4gICAgaW5zcGVjdGVkID0gYCR7aW5zcGVjdGVkLnNsaWNlKDAsIDI1KX0uLi5gO1xuICB9XG4gIHJldHVybiBgIFJlY2VpdmVkIHR5cGUgJHt0eXBlb2YgaW5wdXR9ICgke2luc3BlY3RlZH0pYDtcbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9PVVRfT0ZfUkFOR0UgZXh0ZW5kcyBSYW5nZUVycm9yIHtcbiAgY29kZSA9IFwiRVJSX09VVF9PRl9SQU5HRVwiO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHN0cjogc3RyaW5nLFxuICAgIHJhbmdlOiBzdHJpbmcsXG4gICAgaW5wdXQ6IHVua25vd24sXG4gICAgcmVwbGFjZURlZmF1bHRCb29sZWFuID0gZmFsc2UsXG4gICkge1xuICAgIGFzc2VydChyYW5nZSwgJ01pc3NpbmcgXCJyYW5nZVwiIGFyZ3VtZW50Jyk7XG4gICAgbGV0IG1zZyA9IHJlcGxhY2VEZWZhdWx0Qm9vbGVhblxuICAgICAgPyBzdHJcbiAgICAgIDogYFRoZSB2YWx1ZSBvZiBcIiR7c3RyfVwiIGlzIG91dCBvZiByYW5nZS5gO1xuICAgIGxldCByZWNlaXZlZDtcbiAgICBpZiAoTnVtYmVyLmlzSW50ZWdlcihpbnB1dCkgJiYgTWF0aC5hYnMoaW5wdXQgYXMgbnVtYmVyKSA+IDIgKiogMzIpIHtcbiAgICAgIHJlY2VpdmVkID0gYWRkTnVtZXJpY2FsU2VwYXJhdG9yKFN0cmluZyhpbnB1dCkpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGlucHV0ID09PSBcImJpZ2ludFwiKSB7XG4gICAgICByZWNlaXZlZCA9IFN0cmluZyhpbnB1dCk7XG4gICAgICBpZiAoaW5wdXQgPiAybiAqKiAzMm4gfHwgaW5wdXQgPCAtKDJuICoqIDMybikpIHtcbiAgICAgICAgcmVjZWl2ZWQgPSBhZGROdW1lcmljYWxTZXBhcmF0b3IocmVjZWl2ZWQpO1xuICAgICAgfVxuICAgICAgcmVjZWl2ZWQgKz0gXCJuXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlY2VpdmVkID0gaW5zcGVjdChpbnB1dCk7XG4gICAgfVxuICAgIG1zZyArPSBgIEl0IG11c3QgYmUgJHtyYW5nZX0uIFJlY2VpdmVkICR7cmVjZWl2ZWR9YDtcblxuICAgIHN1cGVyKG1zZyk7XG5cbiAgICBjb25zdCB7IG5hbWUgfSA9IHRoaXM7XG4gICAgLy8gQWRkIHRoZSBlcnJvciBjb2RlIHRvIHRoZSBuYW1lIHRvIGluY2x1ZGUgaXQgaW4gdGhlIHN0YWNrIHRyYWNlLlxuICAgIHRoaXMubmFtZSA9IGAke25hbWV9IFske3RoaXMuY29kZX1dYDtcbiAgICAvLyBBY2Nlc3MgdGhlIHN0YWNrIHRvIGdlbmVyYXRlIHRoZSBlcnJvciBtZXNzYWdlIGluY2x1ZGluZyB0aGUgZXJyb3IgY29kZSBmcm9tIHRoZSBuYW1lLlxuICAgIHRoaXMuc3RhY2s7XG4gICAgLy8gUmVzZXQgdGhlIG5hbWUgdG8gdGhlIGFjdHVhbCBuYW1lLlxuICAgIHRoaXMubmFtZSA9IG5hbWU7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9BTUJJR1VPVVNfQVJHVU1FTlQgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9BTUJJR1VPVVNfQVJHVU1FTlRcIiwgYFRoZSBcIiR7eH1cIiBhcmd1bWVudCBpcyBhbWJpZ3VvdXMuICR7eX1gKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0FSR19OT1RfSVRFUkFCTEUgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfQVJHX05PVF9JVEVSQUJMRVwiLCBgJHt4fSBtdXN0IGJlIGl0ZXJhYmxlYCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9BU1NFUlRJT04gZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9BU1NFUlRJT05cIiwgYCR7eH1gKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0FTWU5DX0NBTExCQUNLIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0FTWU5DX0NBTExCQUNLXCIsIGAke3h9IG11c3QgYmUgYSBmdW5jdGlvbmApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQVNZTkNfVFlQRSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9BU1lOQ19UWVBFXCIsIGBJbnZhbGlkIG5hbWUgZm9yIGFzeW5jIFwidHlwZVwiOiAke3h9YCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9CUk9UTElfSU5WQUxJRF9QQVJBTSBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfQlJPVExJX0lOVkFMSURfUEFSQU1cIiwgYCR7eH0gaXMgbm90IGEgdmFsaWQgQnJvdGxpIHBhcmFtZXRlcmApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQlVGRkVSX09VVF9PRl9CT1VORFMgZXh0ZW5kcyBOb2RlUmFuZ2VFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG5hbWU/OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0JVRkZFUl9PVVRfT0ZfQk9VTkRTXCIsXG4gICAgICBuYW1lXG4gICAgICAgID8gYFwiJHtuYW1lfVwiIGlzIG91dHNpZGUgb2YgYnVmZmVyIGJvdW5kc2BcbiAgICAgICAgOiBcIkF0dGVtcHQgdG8gYWNjZXNzIG1lbW9yeSBvdXRzaWRlIGJ1ZmZlciBib3VuZHNcIixcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQlVGRkVSX1RPT19MQVJHRSBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9CVUZGRVJfVE9PX0xBUkdFXCIsXG4gICAgICBgQ2Fubm90IGNyZWF0ZSBhIEJ1ZmZlciBsYXJnZXIgdGhhbiAke3h9IGJ5dGVzYCxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ0FOTk9UX1dBVENIX1NJR0lOVCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0NBTk5PVF9XQVRDSF9TSUdJTlRcIiwgXCJDYW5ub3Qgd2F0Y2ggZm9yIFNJR0lOVCBzaWduYWxzXCIpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ0hJTERfQ0xPU0VEX0JFRk9SRV9SRVBMWSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfQ0hJTERfQ0xPU0VEX0JFRk9SRV9SRVBMWVwiLFxuICAgICAgXCJDaGlsZCBjbG9zZWQgYmVmb3JlIHJlcGx5IHJlY2VpdmVkXCIsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NISUxEX1BST0NFU1NfSVBDX1JFUVVJUkVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9DSElMRF9QUk9DRVNTX0lQQ19SRVFVSVJFRFwiLFxuICAgICAgYEZvcmtlZCBwcm9jZXNzZXMgbXVzdCBoYXZlIGFuIElQQyBjaGFubmVsLCBtaXNzaW5nIHZhbHVlICdpcGMnIGluICR7eH1gLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DSElMRF9QUk9DRVNTX1NURElPX01BWEJVRkZFUiBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9DSElMRF9QUk9DRVNTX1NURElPX01BWEJVRkZFUlwiLFxuICAgICAgYCR7eH0gbWF4QnVmZmVyIGxlbmd0aCBleGNlZWRlZGAsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NPTlNPTEVfV1JJVEFCTEVfU1RSRUFNIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfQ09OU09MRV9XUklUQUJMRV9TVFJFQU1cIixcbiAgICAgIGBDb25zb2xlIGV4cGVjdHMgYSB3cml0YWJsZSBzdHJlYW0gaW5zdGFuY2UgZm9yICR7eH1gLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DT05URVhUX05PVF9JTklUSUFMSVpFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0NPTlRFWFRfTk9UX0lOSVRJQUxJWkVEXCIsIFwiY29udGV4dCB1c2VkIGlzIG5vdCBpbml0aWFsaXplZFwiKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NQVV9VU0FHRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0NQVV9VU0FHRVwiLCBgVW5hYmxlIHRvIG9idGFpbiBjcHUgdXNhZ2UgJHt4fWApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ1JZUFRPX0NVU1RPTV9FTkdJTkVfTk9UX1NVUFBPUlRFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfQ1JZUFRPX0NVU1RPTV9FTkdJTkVfTk9UX1NVUFBPUlRFRFwiLFxuICAgICAgXCJDdXN0b20gZW5naW5lcyBub3Qgc3VwcG9ydGVkIGJ5IHRoaXMgT3BlblNTTFwiLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fRUNESF9JTlZBTElEX0ZPUk1BVCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9DUllQVE9fRUNESF9JTlZBTElEX0ZPUk1BVFwiLCBgSW52YWxpZCBFQ0RIIGZvcm1hdDogJHt4fWApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ1JZUFRPX0VDREhfSU5WQUxJRF9QVUJMSUNfS0VZIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9DUllQVE9fRUNESF9JTlZBTElEX1BVQkxJQ19LRVlcIixcbiAgICAgIFwiUHVibGljIGtleSBpcyBub3QgdmFsaWQgZm9yIHNwZWNpZmllZCBjdXJ2ZVwiLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fRU5HSU5FX1VOS05PV04gZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9DUllQVE9fRU5HSU5FX1VOS05PV05cIiwgYEVuZ2luZSBcIiR7eH1cIiB3YXMgbm90IGZvdW5kYCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fRklQU19GT1JDRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0NSWVBUT19GSVBTX0ZPUkNFRFwiLFxuICAgICAgXCJDYW5ub3Qgc2V0IEZJUFMgbW9kZSwgaXQgd2FzIGZvcmNlZCB3aXRoIC0tZm9yY2UtZmlwcyBhdCBzdGFydHVwLlwiLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fRklQU19VTkFWQUlMQUJMRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfQ1JZUFRPX0ZJUFNfVU5BVkFJTEFCTEVcIixcbiAgICAgIFwiQ2Fubm90IHNldCBGSVBTIG1vZGUgaW4gYSBub24tRklQUyBidWlsZC5cIixcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ1JZUFRPX0hBU0hfRklOQUxJWkVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfQ1JZUFRPX0hBU0hfRklOQUxJWkVEXCIsIFwiRGlnZXN0IGFscmVhZHkgY2FsbGVkXCIpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ1JZUFRPX0hBU0hfVVBEQVRFX0ZBSUxFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0NSWVBUT19IQVNIX1VQREFURV9GQUlMRURcIiwgXCJIYXNoIHVwZGF0ZSBmYWlsZWRcIik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fSU5DT01QQVRJQkxFX0tFWSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZywgeTogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfQ1JZUFRPX0lOQ09NUEFUSUJMRV9LRVlcIiwgYEluY29tcGF0aWJsZSAke3h9OiAke3l9YCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fSU5DT01QQVRJQkxFX0tFWV9PUFRJT05TIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0NSWVBUT19JTkNPTVBBVElCTEVfS0VZX09QVElPTlNcIixcbiAgICAgIGBUaGUgc2VsZWN0ZWQga2V5IGVuY29kaW5nICR7eH0gJHt5fS5gLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fSU5WQUxJRF9ESUdFU1QgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfQ1JZUFRPX0lOVkFMSURfRElHRVNUXCIsIGBJbnZhbGlkIGRpZ2VzdDogJHt4fWApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ1JZUFRPX0lOVkFMSURfS0VZX09CSkVDVF9UWVBFIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZywgeTogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9DUllQVE9fSU5WQUxJRF9LRVlfT0JKRUNUX1RZUEVcIixcbiAgICAgIGBJbnZhbGlkIGtleSBvYmplY3QgdHlwZSAke3h9LCBleHBlY3RlZCAke3l9LmAsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NSWVBUT19JTlZBTElEX1NUQVRFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfQ1JZUFRPX0lOVkFMSURfU1RBVEVcIiwgYEludmFsaWQgc3RhdGUgZm9yIG9wZXJhdGlvbiAke3h9YCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9DUllQVE9fUEJLREYyX0VSUk9SIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfQ1JZUFRPX1BCS0RGMl9FUlJPUlwiLCBcIlBCS0RGMiBlcnJvclwiKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0NSWVBUT19TQ1JZUFRfSU5WQUxJRF9QQVJBTUVURVIgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9DUllQVE9fU0NSWVBUX0lOVkFMSURfUEFSQU1FVEVSXCIsIFwiSW52YWxpZCBzY3J5cHQgcGFyYW1ldGVyXCIpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ1JZUFRPX1NDUllQVF9OT1RfU1VQUE9SVEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfQ1JZUFRPX1NDUllQVF9OT1RfU1VQUE9SVEVEXCIsIFwiU2NyeXB0IGFsZ29yaXRobSBub3Qgc3VwcG9ydGVkXCIpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfQ1JZUFRPX1NJR05fS0VZX1JFUVVJUkVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfQ1JZUFRPX1NJR05fS0VZX1JFUVVJUkVEXCIsIFwiTm8ga2V5IHByb3ZpZGVkIHRvIHNpZ25cIik7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9ESVJfQ0xPU0VEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfRElSX0NMT1NFRFwiLCBcIkRpcmVjdG9yeSBoYW5kbGUgd2FzIGNsb3NlZFwiKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0RJUl9DT05DVVJSRU5UX09QRVJBVElPTiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfRElSX0NPTkNVUlJFTlRfT1BFUkFUSU9OXCIsXG4gICAgICBcIkNhbm5vdCBkbyBzeW5jaHJvbm91cyB3b3JrIG9uIGRpcmVjdG9yeSBoYW5kbGUgd2l0aCBjb25jdXJyZW50IGFzeW5jaHJvbm91cyBvcGVyYXRpb25zXCIsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0ROU19TRVRfU0VSVkVSU19GQUlMRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfRE5TX1NFVF9TRVJWRVJTX0ZBSUxFRFwiLFxuICAgICAgYGMtYXJlcyBmYWlsZWQgdG8gc2V0IHNlcnZlcnM6IFwiJHt4fVwiIFske3l9XWAsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0RPTUFJTl9DQUxMQkFDS19OT1RfQVZBSUxBQkxFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9ET01BSU5fQ0FMTEJBQ0tfTk9UX0FWQUlMQUJMRVwiLFxuICAgICAgXCJBIGNhbGxiYWNrIHdhcyByZWdpc3RlcmVkIHRocm91Z2ggXCIgK1xuICAgICAgICBcInByb2Nlc3Muc2V0VW5jYXVnaHRFeGNlcHRpb25DYXB0dXJlQ2FsbGJhY2soKSwgd2hpY2ggaXMgbXV0dWFsbHkgXCIgK1xuICAgICAgICBcImV4Y2x1c2l2ZSB3aXRoIHVzaW5nIHRoZSBgZG9tYWluYCBtb2R1bGVcIixcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfRE9NQUlOX0NBTk5PVF9TRVRfVU5DQVVHSFRfRVhDRVBUSU9OX0NBUFRVUkVcbiAgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0RPTUFJTl9DQU5OT1RfU0VUX1VOQ0FVR0hUX0VYQ0VQVElPTl9DQVBUVVJFXCIsXG4gICAgICBcIlRoZSBgZG9tYWluYCBtb2R1bGUgaXMgaW4gdXNlLCB3aGljaCBpcyBtdXR1YWxseSBleGNsdXNpdmUgd2l0aCBjYWxsaW5nIFwiICtcbiAgICAgICAgXCJwcm9jZXNzLnNldFVuY2F1Z2h0RXhjZXB0aW9uQ2FwdHVyZUNhbGxiYWNrKClcIixcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfRU5DT0RJTkdfSU5WQUxJRF9FTkNPREVEX0RBVEEgZXh0ZW5kcyBOb2RlRXJyb3JBYnN0cmFjdGlvblxuICBpbXBsZW1lbnRzIFR5cGVFcnJvciB7XG4gIGVycm5vOiBudW1iZXI7XG4gIGNvbnN0cnVjdG9yKGVuY29kaW5nOiBzdHJpbmcsIHJldDogbnVtYmVyKSB7XG4gICAgc3VwZXIoXG4gICAgICBUeXBlRXJyb3IucHJvdG90eXBlLm5hbWUsXG4gICAgICBcIkVSUl9FTkNPRElOR19JTlZBTElEX0VOQ09ERURfREFUQVwiLFxuICAgICAgYFRoZSBlbmNvZGVkIGRhdGEgd2FzIG5vdCB2YWxpZCBmb3IgZW5jb2RpbmcgJHtlbmNvZGluZ31gLFxuICAgICk7XG4gICAgT2JqZWN0LnNldFByb3RvdHlwZU9mKHRoaXMsIFR5cGVFcnJvci5wcm90b3R5cGUpO1xuXG4gICAgdGhpcy5lcnJubyA9IHJldDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0VOQ09ESU5HX05PVF9TVVBQT1JURUQgZXh0ZW5kcyBOb2RlUmFuZ2VFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0VOQ09ESU5HX05PVF9TVVBQT1JURURcIiwgYFRoZSBcIiR7eH1cIiBlbmNvZGluZyBpcyBub3Qgc3VwcG9ydGVkYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfRVZBTF9FU01fQ0FOTk9UX1BSSU5UIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfRVZBTF9FU01fQ0FOTk9UX1BSSU5UXCIsIGAtLXByaW50IGNhbm5vdCBiZSB1c2VkIHdpdGggRVNNIGlucHV0YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfRVZFTlRfUkVDVVJTSU9OIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9FVkVOVF9SRUNVUlNJT05cIixcbiAgICAgIGBUaGUgZXZlbnQgXCIke3h9XCIgaXMgYWxyZWFkeSBiZWluZyBkaXNwYXRjaGVkYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0ZFQVRVUkVfVU5BVkFJTEFCTEVfT05fUExBVEZPUk0gZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9GRUFUVVJFX1VOQVZBSUxBQkxFX09OX1BMQVRGT1JNXCIsXG4gICAgICBgVGhlIGZlYXR1cmUgJHt4fSBpcyB1bmF2YWlsYWJsZSBvbiB0aGUgY3VycmVudCBwbGF0Zm9ybSwgd2hpY2ggaXMgYmVpbmcgdXNlZCB0byBydW4gTm9kZS5qc2AsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9GU19GSUxFX1RPT19MQVJHRSBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfRlNfRklMRV9UT09fTEFSR0VcIiwgYEZpbGUgc2l6ZSAoJHt4fSkgaXMgZ3JlYXRlciB0aGFuIDIgR0JgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9GU19JTlZBTElEX1NZTUxJTktfVFlQRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfRlNfSU5WQUxJRF9TWU1MSU5LX1RZUEVcIixcbiAgICAgIGBTeW1saW5rIHR5cGUgbXVzdCBiZSBvbmUgb2YgXCJkaXJcIiwgXCJmaWxlXCIsIG9yIFwianVuY3Rpb25cIi4gUmVjZWl2ZWQgXCIke3h9XCJgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfQUxUU1ZDX0lOVkFMSURfT1JJR0lOIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfQUxUU1ZDX0lOVkFMSURfT1JJR0lOXCIsXG4gICAgICBgSFRUUC8yIEFMVFNWQyBmcmFtZXMgcmVxdWlyZSBhIHZhbGlkIG9yaWdpbmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9BTFRTVkNfTEVOR1RIIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfQUxUU1ZDX0xFTkdUSFwiLFxuICAgICAgYEhUVFAvMiBBTFRTVkMgZnJhbWVzIGFyZSBsaW1pdGVkIHRvIDE2MzgyIGJ5dGVzYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX0NPTk5FQ1RfQVVUSE9SSVRZIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9DT05ORUNUX0FVVEhPUklUWVwiLFxuICAgICAgYDphdXRob3JpdHkgaGVhZGVyIGlzIHJlcXVpcmVkIGZvciBDT05ORUNUIHJlcXVlc3RzYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX0NPTk5FQ1RfUEFUSCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfQ09OTkVDVF9QQVRIXCIsXG4gICAgICBgVGhlIDpwYXRoIGhlYWRlciBpcyBmb3JiaWRkZW4gZm9yIENPTk5FQ1QgcmVxdWVzdHNgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfQ09OTkVDVF9TQ0hFTUUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX0NPTk5FQ1RfU0NIRU1FXCIsXG4gICAgICBgVGhlIDpzY2hlbWUgaGVhZGVyIGlzIGZvcmJpZGRlbiBmb3IgQ09OTkVDVCByZXF1ZXN0c2AsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9HT0FXQVlfU0VTU0lPTiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfR09BV0FZX1NFU1NJT05cIixcbiAgICAgIGBOZXcgc3RyZWFtcyBjYW5ub3QgYmUgY3JlYXRlZCBhZnRlciByZWNlaXZpbmcgYSBHT0FXQVlgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfSEVBREVSU19BRlRFUl9SRVNQT05EIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9IRUFERVJTX0FGVEVSX1JFU1BPTkRcIixcbiAgICAgIGBDYW5ub3Qgc3BlY2lmeSBhZGRpdGlvbmFsIGhlYWRlcnMgYWZ0ZXIgcmVzcG9uc2UgaW5pdGlhdGVkYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX0hFQURFUlNfU0VOVCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0hUVFAyX0hFQURFUlNfU0VOVFwiLCBgUmVzcG9uc2UgaGFzIGFscmVhZHkgYmVlbiBpbml0aWF0ZWQuYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfSEVBREVSX1NJTkdMRV9WQUxVRSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX0hFQURFUl9TSU5HTEVfVkFMVUVcIixcbiAgICAgIGBIZWFkZXIgZmllbGQgXCIke3h9XCIgbXVzdCBvbmx5IGhhdmUgYSBzaW5nbGUgdmFsdWVgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfSU5GT19TVEFUVVNfTk9UX0FMTE9XRUQgZXh0ZW5kcyBOb2RlUmFuZ2VFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfSU5GT19TVEFUVVNfTk9UX0FMTE9XRURcIixcbiAgICAgIGBJbmZvcm1hdGlvbmFsIHN0YXR1cyBjb2RlcyBjYW5ub3QgYmUgdXNlZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9JTlZBTElEX0NPTk5FQ1RJT05fSEVBREVSUyBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX0lOVkFMSURfQ09OTkVDVElPTl9IRUFERVJTXCIsXG4gICAgICBgSFRUUC8xIENvbm5lY3Rpb24gc3BlY2lmaWMgaGVhZGVycyBhcmUgZm9yYmlkZGVuOiBcIiR7eH1cImAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9JTlZBTElEX0hFQURFUl9WQUxVRSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfSU5WQUxJRF9IRUFERVJfVkFMVUVcIixcbiAgICAgIGBJbnZhbGlkIHZhbHVlIFwiJHt4fVwiIGZvciBoZWFkZXIgXCIke3l9XCJgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfSU5WQUxJRF9JTkZPX1NUQVRVUyBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9JTlZBTElEX0lORk9fU1RBVFVTXCIsXG4gICAgICBgSW52YWxpZCBpbmZvcm1hdGlvbmFsIHN0YXR1cyBjb2RlOiAke3h9YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX0lOVkFMSURfT1JJR0lOIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfSU5WQUxJRF9PUklHSU5cIixcbiAgICAgIGBIVFRQLzIgT1JJR0lOIGZyYW1lcyByZXF1aXJlIGEgdmFsaWQgb3JpZ2luYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX0lOVkFMSURfUEFDS0VEX1NFVFRJTkdTX0xFTkdUSCBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9JTlZBTElEX1BBQ0tFRF9TRVRUSU5HU19MRU5HVEhcIixcbiAgICAgIGBQYWNrZWQgc2V0dGluZ3MgbGVuZ3RoIG11c3QgYmUgYSBtdWx0aXBsZSBvZiBzaXhgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfSU5WQUxJRF9QU0VVRE9IRUFERVIgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9JTlZBTElEX1BTRVVET0hFQURFUlwiLFxuICAgICAgYFwiJHt4fVwiIGlzIGFuIGludmFsaWQgcHNldWRvaGVhZGVyIG9yIGlzIHVzZWQgaW5jb3JyZWN0bHlgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfSU5WQUxJRF9TRVNTSU9OIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSFRUUDJfSU5WQUxJRF9TRVNTSU9OXCIsIGBUaGUgc2Vzc2lvbiBoYXMgYmVlbiBkZXN0cm95ZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9JTlZBTElEX1NUUkVBTSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0hUVFAyX0lOVkFMSURfU1RSRUFNXCIsIGBUaGUgc3RyZWFtIGhhcyBiZWVuIGRlc3Ryb3llZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX01BWF9QRU5ESU5HX1NFVFRJTkdTX0FDSyBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUDJfTUFYX1BFTkRJTkdfU0VUVElOR1NfQUNLXCIsXG4gICAgICBgTWF4aW11bSBudW1iZXIgb2YgcGVuZGluZyBzZXR0aW5ncyBhY2tub3dsZWRnZW1lbnRzYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX05FU1RFRF9QVVNIIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9ORVNURURfUFVTSFwiLFxuICAgICAgYEEgcHVzaCBzdHJlYW0gY2Fubm90IGluaXRpYXRlIGFub3RoZXIgcHVzaCBzdHJlYW0uYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX05PX1NPQ0tFVF9NQU5JUFVMQVRJT04gZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX05PX1NPQ0tFVF9NQU5JUFVMQVRJT05cIixcbiAgICAgIGBIVFRQLzIgc29ja2V0cyBzaG91bGQgbm90IGJlIGRpcmVjdGx5IG1hbmlwdWxhdGVkIChlLmcuIHJlYWQgYW5kIHdyaXR0ZW4pYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX09SSUdJTl9MRU5HVEggZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9PUklHSU5fTEVOR1RIXCIsXG4gICAgICBgSFRUUC8yIE9SSUdJTiBmcmFtZXMgYXJlIGxpbWl0ZWQgdG8gMTYzODIgYnl0ZXNgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfT1VUX09GX1NUUkVBTVMgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX09VVF9PRl9TVFJFQU1TXCIsXG4gICAgICBgTm8gc3RyZWFtIElEIGlzIGF2YWlsYWJsZSBiZWNhdXNlIG1heGltdW0gc3RyZWFtIElEIGhhcyBiZWVuIHJlYWNoZWRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfUEFZTE9BRF9GT1JCSURERU4gZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX1BBWUxPQURfRk9SQklEREVOXCIsXG4gICAgICBgUmVzcG9uc2VzIHdpdGggJHt4fSBzdGF0dXMgbXVzdCBub3QgaGF2ZSBhIHBheWxvYWRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfUElOR19DQU5DRUwgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9IVFRQMl9QSU5HX0NBTkNFTFwiLCBgSFRUUDIgcGluZyBjYW5jZWxsZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9QSU5HX0xFTkdUSCBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSFRUUDJfUElOR19MRU5HVEhcIiwgYEhUVFAyIHBpbmcgcGF5bG9hZCBtdXN0IGJlIDggYnl0ZXNgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9QU0VVRE9IRUFERVJfTk9UX0FMTE9XRUQgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9QU0VVRE9IRUFERVJfTk9UX0FMTE9XRURcIixcbiAgICAgIGBDYW5ub3Qgc2V0IEhUVFAvMiBwc2V1ZG8taGVhZGVyc2AsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9QVVNIX0RJU0FCTEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSFRUUDJfUFVTSF9ESVNBQkxFRFwiLCBgSFRUUC8yIGNsaWVudCBoYXMgZGlzYWJsZWQgcHVzaCBzdHJlYW1zYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfU0VORF9GSUxFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSFRUUDJfU0VORF9GSUxFXCIsIGBEaXJlY3RvcmllcyBjYW5ub3QgYmUgc2VudGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1NFTkRfRklMRV9OT1NFRUsgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX1NFTkRfRklMRV9OT1NFRUtcIixcbiAgICAgIGBPZmZzZXQgb3IgbGVuZ3RoIGNhbiBvbmx5IGJlIHNwZWNpZmllZCBmb3IgcmVndWxhciBmaWxlc2AsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9TRVNTSU9OX0VSUk9SIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfSFRUUDJfU0VTU0lPTl9FUlJPUlwiLCBgU2Vzc2lvbiBjbG9zZWQgd2l0aCBlcnJvciBjb2RlICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9TRVRUSU5HU19DQU5DRUwgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9IVFRQMl9TRVRUSU5HU19DQU5DRUxcIiwgYEhUVFAyIHNlc3Npb24gc2V0dGluZ3MgY2FuY2VsZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9TT0NLRVRfQk9VTkQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX1NPQ0tFVF9CT1VORFwiLFxuICAgICAgYFRoZSBzb2NrZXQgaXMgYWxyZWFkeSBib3VuZCB0byBhbiBIdHRwMlNlc3Npb25gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfU09DS0VUX1VOQk9VTkQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX1NPQ0tFVF9VTkJPVU5EXCIsXG4gICAgICBgVGhlIHNvY2tldCBoYXMgYmVlbiBkaXNjb25uZWN0ZWQgZnJvbSB0aGUgSHR0cDJTZXNzaW9uYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFAyX1NUQVRVU18xMDEgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFAyX1NUQVRVU18xMDFcIixcbiAgICAgIGBIVFRQIHN0YXR1cyBjb2RlIDEwMSAoU3dpdGNoaW5nIFByb3RvY29scykgaXMgZm9yYmlkZGVuIGluIEhUVFAvMmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9TVEFUVVNfSU5WQUxJRCBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfSFRUUDJfU1RBVFVTX0lOVkFMSURcIiwgYEludmFsaWQgc3RhdHVzIGNvZGU6ICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9TVFJFQU1fRVJST1IgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9IVFRQMl9TVFJFQU1fRVJST1JcIiwgYFN0cmVhbSBjbG9zZWQgd2l0aCBlcnJvciBjb2RlICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9TVFJFQU1fU0VMRl9ERVBFTkRFTkNZIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9TVFJFQU1fU0VMRl9ERVBFTkRFTkNZXCIsXG4gICAgICBgQSBzdHJlYW0gY2Fubm90IGRlcGVuZCBvbiBpdHNlbGZgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfVFJBSUxFUlNfQUxSRUFEWV9TRU5UIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9UUkFJTEVSU19BTFJFQURZX1NFTlRcIixcbiAgICAgIGBUcmFpbGluZyBoZWFkZXJzIGhhdmUgYWxyZWFkeSBiZWVuIHNlbnRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUDJfVFJBSUxFUlNfTk9UX1JFQURZIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9UUkFJTEVSU19OT1RfUkVBRFlcIixcbiAgICAgIGBUcmFpbGluZyBoZWFkZXJzIGNhbm5vdCBiZSBzZW50IHVudGlsIGFmdGVyIHRoZSB3YW50VHJhaWxlcnMgZXZlbnQgaXMgZW1pdHRlZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9VTlNVUFBPUlRFRF9QUk9UT0NPTCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0hUVFAyX1VOU1VQUE9SVEVEX1BST1RPQ09MXCIsIGBwcm90b2NvbCBcIiR7eH1cIiBpcyB1bnN1cHBvcnRlZC5gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQX0hFQURFUlNfU0VOVCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSFRUUF9IRUFERVJTX1NFTlRcIixcbiAgICAgIGBDYW5ub3QgJHt4fSBoZWFkZXJzIGFmdGVyIHRoZXkgYXJlIHNlbnQgdG8gdGhlIGNsaWVudGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQX0lOVkFMSURfSEVBREVSX1ZBTFVFIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZywgeTogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQX0lOVkFMSURfSEVBREVSX1ZBTFVFXCIsXG4gICAgICBgSW52YWxpZCB2YWx1ZSBcIiR7eH1cIiBmb3IgaGVhZGVyIFwiJHt5fVwiYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFBfSU5WQUxJRF9TVEFUVVNfQ09ERSBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfSFRUUF9JTlZBTElEX1NUQVRVU19DT0RFXCIsIGBJbnZhbGlkIHN0YXR1cyBjb2RlOiAke3h9YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSFRUUF9TT0NLRVRfRU5DT0RJTkcgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0hUVFBfU09DS0VUX0VOQ09ESU5HXCIsXG4gICAgICBgQ2hhbmdpbmcgdGhlIHNvY2tldCBlbmNvZGluZyBpcyBub3QgYWxsb3dlZCBwZXIgUkZDNzIzMCBTZWN0aW9uIDMuYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0hUVFBfVFJBSUxFUl9JTlZBTElEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQX1RSQUlMRVJfSU5WQUxJRFwiLFxuICAgICAgYFRyYWlsZXJzIGFyZSBpbnZhbGlkIHdpdGggdGhpcyB0cmFuc2ZlciBlbmNvZGluZ2AsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTkNPTVBBVElCTEVfT1BUSU9OX1BBSVIgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOQ09NUEFUSUJMRV9PUFRJT05fUEFJUlwiLFxuICAgICAgYE9wdGlvbiBcIiR7eH1cIiBjYW5ub3QgYmUgdXNlZCBpbiBjb21iaW5hdGlvbiB3aXRoIG9wdGlvbiBcIiR7eX1cImAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlBVVF9UWVBFX05PVF9BTExPV0VEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlBVVF9UWVBFX05PVF9BTExPV0VEXCIsXG4gICAgICBgLS1pbnB1dC10eXBlIGNhbiBvbmx5IGJlIHVzZWQgd2l0aCBzdHJpbmcgaW5wdXQgdmlhIC0tZXZhbCwgLS1wcmludCwgb3IgU1RESU5gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5TUEVDVE9SX0FMUkVBRFlfQUNUSVZBVEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlNQRUNUT1JfQUxSRUFEWV9BQ1RJVkFURURcIixcbiAgICAgIGBJbnNwZWN0b3IgaXMgYWxyZWFkeSBhY3RpdmF0ZWQuIENsb3NlIGl0IHdpdGggaW5zcGVjdG9yLmNsb3NlKCkgYmVmb3JlIGFjdGl2YXRpbmcgaXQgYWdhaW4uYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOU1BFQ1RPUl9BTFJFQURZX0NPTk5FQ1RFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX0lOU1BFQ1RPUl9BTFJFQURZX0NPTk5FQ1RFRFwiLCBgJHt4fSBpcyBhbHJlYWR5IGNvbm5lY3RlZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOU1BFQ1RPUl9DTE9TRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9JTlNQRUNUT1JfQ0xPU0VEXCIsIGBTZXNzaW9uIHdhcyBjbG9zZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlNQRUNUT1JfQ09NTUFORCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IG51bWJlciwgeTogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5TUEVDVE9SX0NPTU1BTkRcIiwgYEluc3BlY3RvciBlcnJvciAke3h9OiAke3l9YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5TUEVDVE9SX05PVF9BQ1RJVkUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9JTlNQRUNUT1JfTk9UX0FDVElWRVwiLCBgSW5zcGVjdG9yIGlzIG5vdCBhY3RpdmVgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlNQRUNUT1JfTk9UX0FWQUlMQUJMRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0lOU1BFQ1RPUl9OT1RfQVZBSUxBQkxFXCIsIGBJbnNwZWN0b3IgaXMgbm90IGF2YWlsYWJsZWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOU1BFQ1RPUl9OT1RfQ09OTkVDVEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5TUEVDVE9SX05PVF9DT05ORUNURURcIiwgYFNlc3Npb24gaXMgbm90IGNvbm5lY3RlZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOU1BFQ1RPUl9OT1RfV09SS0VSIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5TUEVDVE9SX05PVF9XT1JLRVJcIiwgYEN1cnJlbnQgdGhyZWFkIGlzIG5vdCBhIHdvcmtlcmApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfQVNZTkNfSUQgZXh0ZW5kcyBOb2RlUmFuZ2VFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZywgeTogc3RyaW5nIHwgbnVtYmVyKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9BU1lOQ19JRFwiLCBgSW52YWxpZCAke3h9IHZhbHVlOiAke3l9YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9CVUZGRVJfU0laRSBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9CVUZGRVJfU0laRVwiLCBgQnVmZmVyIHNpemUgbXVzdCBiZSBhIG11bHRpcGxlIG9mICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX0NBTExCQUNLIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG9iamVjdDogdW5rbm93bikge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9DQUxMQkFDS1wiLFxuICAgICAgYENhbGxiYWNrIG11c3QgYmUgYSBmdW5jdGlvbi4gUmVjZWl2ZWQgJHtpbnNwZWN0KG9iamVjdCl9YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfQ1VSU09SX1BPUyBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOVkFMSURfQ1VSU09SX1BPU1wiLFxuICAgICAgYENhbm5vdCBzZXQgY3Vyc29yIHJvdyB3aXRob3V0IHNldHRpbmcgaXRzIGNvbHVtbmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX0ZEIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX0ZEXCIsIGBcImZkXCIgbXVzdCBiZSBhIHBvc2l0aXZlIGludGVnZXI6ICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX0ZEX1RZUEUgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9GRF9UWVBFXCIsIGBVbnN1cHBvcnRlZCBmZCB0eXBlOiAke3h9YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9GSUxFX1VSTF9IT1NUIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9GSUxFX1VSTF9IT1NUXCIsXG4gICAgICBgRmlsZSBVUkwgaG9zdCBtdXN0IGJlIFwibG9jYWxob3N0XCIgb3IgZW1wdHkgb24gJHt4fWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX0ZJTEVfVVJMX1BBVEggZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9GSUxFX1VSTF9QQVRIXCIsIGBGaWxlIFVSTCBwYXRoICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX0hBTkRMRV9UWVBFIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0lOVkFMSURfSEFORExFX1RZUEVcIiwgYFRoaXMgaGFuZGxlIHR5cGUgY2Fubm90IGJlIHNlbnRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX0hUVFBfVE9LRU4gZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX0hUVFBfVE9LRU5cIiwgYCR7eH0gbXVzdCBiZSBhIHZhbGlkIEhUVFAgdG9rZW4gW1wiJHt5fVwiXWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfSVBfQUREUkVTUyBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX0lQX0FERFJFU1NcIiwgYEludmFsaWQgSVAgYWRkcmVzczogJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfT1BUX1ZBTFVFX0VOQ09ESU5HIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9PUFRfVkFMVUVfRU5DT0RJTkdcIixcbiAgICAgIGBUaGUgdmFsdWUgXCIke3h9XCIgaXMgaW52YWxpZCBmb3Igb3B0aW9uIFwiZW5jb2RpbmdcImAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX1BFUkZPUk1BTkNFX01BUksgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOVkFMSURfUEVSRk9STUFOQ0VfTUFSS1wiLFxuICAgICAgYFRoZSBcIiR7eH1cIiBwZXJmb3JtYW5jZSBtYXJrIGhhcyBub3QgYmVlbiBzZXRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9QUk9UT0NPTCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcsIHk6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9QUk9UT0NPTFwiLFxuICAgICAgYFByb3RvY29sIFwiJHt4fVwiIG5vdCBzdXBwb3J0ZWQuIEV4cGVjdGVkIFwiJHt5fVwiYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfUkVQTF9FVkFMX0NPTkZJRyBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOVkFMSURfUkVQTF9FVkFMX0NPTkZJR1wiLFxuICAgICAgYENhbm5vdCBzcGVjaWZ5IGJvdGggXCJicmVha0V2YWxPblNpZ2ludFwiIGFuZCBcImV2YWxcIiBmb3IgUkVQTGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX1JFUExfSU5QVVQgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9SRVBMX0lOUFVUXCIsIGAke3h9YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9TWU5DX0ZPUktfSU5QVVQgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlZBTElEX1NZTkNfRk9SS19JTlBVVFwiLFxuICAgICAgYEFzeW5jaHJvbm91cyBmb3JrcyBkbyBub3Qgc3VwcG9ydCBCdWZmZXIsIFR5cGVkQXJyYXksIERhdGFWaWV3IG9yIHN0cmluZyBpbnB1dDogJHt4fWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX1RISVMgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9USElTXCIsIGBWYWx1ZSBvZiBcInRoaXNcIiBtdXN0IGJlIG9mIHR5cGUgJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfVFVQTEUgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9JTlZBTElEX1RVUExFXCIsIGAke3h9IG11c3QgYmUgYW4gaXRlcmFibGUgJHt5fSB0dXBsZWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfVVJJIGV4dGVuZHMgTm9kZVVSSUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9VUklcIiwgYFVSSSBtYWxmb3JtZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9JUENfQ0hBTk5FTF9DTE9TRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9JUENfQ0hBTk5FTF9DTE9TRURcIiwgYENoYW5uZWwgY2xvc2VkYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSVBDX0RJU0NPTk5FQ1RFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0lQQ19ESVNDT05ORUNURURcIiwgYElQQyBjaGFubmVsIGlzIGFscmVhZHkgZGlzY29ubmVjdGVkYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSVBDX09ORV9QSVBFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfSVBDX09ORV9QSVBFXCIsIGBDaGlsZCBwcm9jZXNzIGNhbiBoYXZlIG9ubHkgb25lIElQQyBwaXBlYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfSVBDX1NZTkNfRk9SSyBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX0lQQ19TWU5DX0ZPUktcIiwgYElQQyBjYW5ub3QgYmUgdXNlZCB3aXRoIHN5bmNocm9ub3VzIGZvcmtzYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTUFOSUZFU1RfREVQRU5ERU5DWV9NSVNTSU5HIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX01BTklGRVNUX0RFUEVOREVOQ1lfTUlTU0lOR1wiLFxuICAgICAgYE1hbmlmZXN0IHJlc291cmNlICR7eH0gZG9lcyBub3QgbGlzdCAke3l9IGFzIGEgZGVwZW5kZW5jeSBzcGVjaWZpZXJgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTUFOSUZFU1RfSU5URUdSSVRZX01JU01BVENIIGV4dGVuZHMgTm9kZVN5bnRheEVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9NQU5JRkVTVF9JTlRFR1JJVFlfTUlTTUFUQ0hcIixcbiAgICAgIGBNYW5pZmVzdCByZXNvdXJjZSAke3h9IGhhcyBtdWx0aXBsZSBlbnRyaWVzIGJ1dCBpbnRlZ3JpdHkgbGlzdHMgZG8gbm90IG1hdGNoYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX01BTklGRVNUX0lOVkFMSURfUkVTT1VSQ0VfRklFTEQgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX01BTklGRVNUX0lOVkFMSURfUkVTT1VSQ0VfRklFTERcIixcbiAgICAgIGBNYW5pZmVzdCByZXNvdXJjZSAke3h9IGhhcyBpbnZhbGlkIHByb3BlcnR5IHZhbHVlIGZvciAke3l9YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX01BTklGRVNUX1REWiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX01BTklGRVNUX1REWlwiLCBgTWFuaWZlc3QgaW5pdGlhbGl6YXRpb24gaGFzIG5vdCB5ZXQgcnVuYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTUFOSUZFU1RfVU5LTk9XTl9PTkVSUk9SIGV4dGVuZHMgTm9kZVN5bnRheEVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9NQU5JRkVTVF9VTktOT1dOX09ORVJST1JcIixcbiAgICAgIGBNYW5pZmVzdCBzcGVjaWZpZWQgdW5rbm93biBlcnJvciBiZWhhdmlvciBcIiR7eH1cIi5gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTUVUSE9EX05PVF9JTVBMRU1FTlRFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX01FVEhPRF9OT1RfSU1QTEVNRU5URURcIiwgYFRoZSAke3h9IG1ldGhvZCBpcyBub3QgaW1wbGVtZW50ZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9NSVNTSU5HX0FSR1MgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoLi4uYXJnczogKHN0cmluZyB8IHN0cmluZ1tdKVtdKSB7XG4gICAgbGV0IG1zZyA9IFwiVGhlIFwiO1xuXG4gICAgY29uc3QgbGVuID0gYXJncy5sZW5ndGg7XG5cbiAgICBjb25zdCB3cmFwID0gKGE6IHVua25vd24pID0+IGBcIiR7YX1cImA7XG5cbiAgICBhcmdzID0gYXJncy5tYXAoKGEpID0+XG4gICAgICBBcnJheS5pc0FycmF5KGEpID8gYS5tYXAod3JhcCkuam9pbihcIiBvciBcIikgOiB3cmFwKGEpXG4gICAgKTtcblxuICAgIHN3aXRjaCAobGVuKSB7XG4gICAgICBjYXNlIDE6XG4gICAgICAgIG1zZyArPSBgJHthcmdzWzBdfSBhcmd1bWVudGA7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBtc2cgKz0gYCR7YXJnc1swXX0gYW5kICR7YXJnc1sxXX0gYXJndW1lbnRzYDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBtc2cgKz0gYXJncy5zbGljZSgwLCBsZW4gLSAxKS5qb2luKFwiLCBcIik7XG4gICAgICAgIG1zZyArPSBgLCBhbmQgJHthcmdzW2xlbiAtIDFdfSBhcmd1bWVudHNgO1xuICAgICAgICBicmVhaztcbiAgICB9XG5cbiAgICBzdXBlcihcIkVSUl9NSVNTSU5HX0FSR1NcIiwgYCR7bXNnfSBtdXN0IGJlIHNwZWNpZmllZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX01JU1NJTkdfT1BUSU9OIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX01JU1NJTkdfT1BUSU9OXCIsIGAke3h9IGlzIHJlcXVpcmVkYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTVVMVElQTEVfQ0FMTEJBQ0sgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9NVUxUSVBMRV9DQUxMQkFDS1wiLCBgQ2FsbGJhY2sgY2FsbGVkIG11bHRpcGxlIHRpbWVzYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTkFQSV9DT05TX0ZVTkNUSU9OIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX05BUElfQ09OU19GVU5DVElPTlwiLCBgQ29uc3RydWN0b3IgbXVzdCBiZSBhIGZ1bmN0aW9uYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfTkFQSV9JTlZBTElEX0RBVEFWSUVXX0FSR1MgZXh0ZW5kcyBOb2RlUmFuZ2VFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfTkFQSV9JTlZBTElEX0RBVEFWSUVXX0FSR1NcIixcbiAgICAgIGBieXRlX29mZnNldCArIGJ5dGVfbGVuZ3RoIHNob3VsZCBiZSBsZXNzIHRoYW4gb3IgZXF1YWwgdG8gdGhlIHNpemUgaW4gYnl0ZXMgb2YgdGhlIGFycmF5IHBhc3NlZCBpbmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9OQVBJX0lOVkFMSURfVFlQRURBUlJBWV9BTElHTk1FTlQgZXh0ZW5kcyBOb2RlUmFuZ2VFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZywgeTogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9OQVBJX0lOVkFMSURfVFlQRURBUlJBWV9BTElHTk1FTlRcIixcbiAgICAgIGBzdGFydCBvZmZzZXQgb2YgJHt4fSBzaG91bGQgYmUgYSBtdWx0aXBsZSBvZiAke3l9YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX05BUElfSU5WQUxJRF9UWVBFREFSUkFZX0xFTkdUSCBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfTkFQSV9JTlZBTElEX1RZUEVEQVJSQVlfTEVOR1RIXCIsIGBJbnZhbGlkIHR5cGVkIGFycmF5IGxlbmd0aGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX05PX0NSWVBUTyBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfTk9fQ1JZUFRPXCIsXG4gICAgICBgTm9kZS5qcyBpcyBub3QgY29tcGlsZWQgd2l0aCBPcGVuU1NMIGNyeXB0byBzdXBwb3J0YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX05PX0lDVSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX05PX0lDVVwiLFxuICAgICAgYCR7eH0gaXMgbm90IHN1cHBvcnRlZCBvbiBOb2RlLmpzIGNvbXBpbGVkIHdpdGhvdXQgSUNVYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1FVSUNDTElFTlRTRVNTSU9OX0ZBSUxFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfUVVJQ0NMSUVOVFNFU1NJT05fRkFJTEVEXCIsXG4gICAgICBgRmFpbGVkIHRvIGNyZWF0ZSBhIG5ldyBRdWljQ2xpZW50U2Vzc2lvbjogJHt4fWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9RVUlDQ0xJRU5UU0VTU0lPTl9GQUlMRURfU0VUU09DS0VUIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9RVUlDQ0xJRU5UU0VTU0lPTl9GQUlMRURfU0VUU09DS0VUXCIsXG4gICAgICBgRmFpbGVkIHRvIHNldCB0aGUgUXVpY1NvY2tldGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9RVUlDU0VTU0lPTl9ERVNUUk9ZRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1FVSUNTRVNTSU9OX0RFU1RST1lFRFwiLFxuICAgICAgYENhbm5vdCBjYWxsICR7eH0gYWZ0ZXIgYSBRdWljU2Vzc2lvbiBoYXMgYmVlbiBkZXN0cm95ZWRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfUVVJQ1NFU1NJT05fSU5WQUxJRF9EQ0lEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfUVVJQ1NFU1NJT05fSU5WQUxJRF9EQ0lEXCIsIGBJbnZhbGlkIERDSUQgdmFsdWU6ICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9RVUlDU0VTU0lPTl9VUERBVEVLRVkgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9RVUlDU0VTU0lPTl9VUERBVEVLRVlcIiwgYFVuYWJsZSB0byB1cGRhdGUgUXVpY1Nlc3Npb24ga2V5c2ApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1FVSUNTT0NLRVRfREVTVFJPWUVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9RVUlDU09DS0VUX0RFU1RST1lFRFwiLFxuICAgICAgYENhbm5vdCBjYWxsICR7eH0gYWZ0ZXIgYSBRdWljU29ja2V0IGhhcyBiZWVuIGRlc3Ryb3llZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9RVUlDU09DS0VUX0lOVkFMSURfU1RBVEVMRVNTX1JFU0VUX1NFQ1JFVF9MRU5HVEhcbiAgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1FVSUNTT0NLRVRfSU5WQUxJRF9TVEFURUxFU1NfUkVTRVRfU0VDUkVUX0xFTkdUSFwiLFxuICAgICAgYFRoZSBzdGF0ZVJlc2V0VG9rZW4gbXVzdCBiZSBleGFjdGx5IDE2LWJ5dGVzIGluIGxlbmd0aGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9RVUlDU09DS0VUX0xJU1RFTklORyBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1FVSUNTT0NLRVRfTElTVEVOSU5HXCIsIGBUaGlzIFF1aWNTb2NrZXQgaXMgYWxyZWFkeSBsaXN0ZW5pbmdgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9RVUlDU09DS0VUX1VOQk9VTkQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1FVSUNTT0NLRVRfVU5CT1VORFwiLFxuICAgICAgYENhbm5vdCBjYWxsICR7eH0gYmVmb3JlIGEgUXVpY1NvY2tldCBoYXMgYmVlbiBib3VuZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9RVUlDU1RSRUFNX0RFU1RST1lFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfUVVJQ1NUUkVBTV9ERVNUUk9ZRURcIixcbiAgICAgIGBDYW5ub3QgY2FsbCAke3h9IGFmdGVyIGEgUXVpY1N0cmVhbSBoYXMgYmVlbiBkZXN0cm95ZWRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfUVVJQ1NUUkVBTV9JTlZBTElEX1BVU0ggZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1FVSUNTVFJFQU1fSU5WQUxJRF9QVVNIXCIsXG4gICAgICBgUHVzaCBzdHJlYW1zIGFyZSBvbmx5IHN1cHBvcnRlZCBvbiBjbGllbnQtaW5pdGlhdGVkLCBiaWRpcmVjdGlvbmFsIHN0cmVhbXNgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfUVVJQ1NUUkVBTV9PUEVOX0ZBSUxFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1FVSUNTVFJFQU1fT1BFTl9GQUlMRURcIiwgYE9wZW5pbmcgYSBuZXcgUXVpY1N0cmVhbSBmYWlsZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9RVUlDU1RSRUFNX1VOU1VQUE9SVEVEX1BVU0ggZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1FVSUNTVFJFQU1fVU5TVVBQT1JURURfUFVTSFwiLFxuICAgICAgYFB1c2ggc3RyZWFtcyBhcmUgbm90IHN1cHBvcnRlZCBvbiB0aGlzIFF1aWNTZXNzaW9uYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1FVSUNfVExTMTNfUkVRVUlSRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9RVUlDX1RMUzEzX1JFUVVJUkVEXCIsIGBRVUlDIHJlcXVpcmVzIFRMUyB2ZXJzaW9uIDEuM2ApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NDUklQVF9FWEVDVVRJT05fSU5URVJSVVBURUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1NDUklQVF9FWEVDVVRJT05fSU5URVJSVVBURURcIixcbiAgICAgIFwiU2NyaXB0IGV4ZWN1dGlvbiB3YXMgaW50ZXJydXB0ZWQgYnkgYFNJR0lOVGBcIixcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NFUlZFUl9BTFJFQURZX0xJU1RFTiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfU0VSVkVSX0FMUkVBRFlfTElTVEVOXCIsXG4gICAgICBgTGlzdGVuIG1ldGhvZCBoYXMgYmVlbiBjYWxsZWQgbW9yZSB0aGFuIG9uY2Ugd2l0aG91dCBjbG9zaW5nLmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TRVJWRVJfTk9UX1JVTk5JTkcgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9TRVJWRVJfTk9UX1JVTk5JTkdcIiwgYFNlcnZlciBpcyBub3QgcnVubmluZy5gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TT0NLRVRfQUxSRUFEWV9CT1VORCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1NPQ0tFVF9BTFJFQURZX0JPVU5EXCIsIGBTb2NrZXQgaXMgYWxyZWFkeSBib3VuZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NPQ0tFVF9CQURfQlVGRkVSX1NJWkUgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9TT0NLRVRfQkFEX0JVRkZFUl9TSVpFXCIsXG4gICAgICBgQnVmZmVyIHNpemUgbXVzdCBiZSBhIHBvc2l0aXZlIGludGVnZXJgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfU09DS0VUX0JBRF9QT1JUIGV4dGVuZHMgTm9kZVJhbmdlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHBvcnQ6IHVua25vd24sIGFsbG93WmVybyA9IHRydWUpIHtcbiAgICBhc3NlcnQoXG4gICAgICB0eXBlb2YgYWxsb3daZXJvID09PSBcImJvb2xlYW5cIixcbiAgICAgIFwiVGhlICdhbGxvd1plcm8nIGFyZ3VtZW50IG11c3QgYmUgb2YgdHlwZSBib29sZWFuLlwiLFxuICAgICk7XG5cbiAgICBjb25zdCBvcGVyYXRvciA9IGFsbG93WmVybyA/IFwiPj1cIiA6IFwiPlwiO1xuXG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9TT0NLRVRfQkFEX1BPUlRcIixcbiAgICAgIGAke25hbWV9IHNob3VsZCBiZSAke29wZXJhdG9yfSAwIGFuZCA8IDY1NTM2LiBSZWNlaXZlZCAke3BvcnR9LmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TT0NLRVRfQkFEX1RZUEUgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9TT0NLRVRfQkFEX1RZUEVcIixcbiAgICAgIGBCYWQgc29ja2V0IHR5cGUgc3BlY2lmaWVkLiBWYWxpZCB0eXBlcyBhcmU6IHVkcDQsIHVkcDZgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfU09DS0VUX0NMT1NFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1NPQ0tFVF9DTE9TRURcIiwgYFNvY2tldCBpcyBjbG9zZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TT0NLRVRfREdSQU1fSVNfQ09OTkVDVEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfU09DS0VUX0RHUkFNX0lTX0NPTk5FQ1RFRFwiLCBgQWxyZWFkeSBjb25uZWN0ZWRgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TT0NLRVRfREdSQU1fTk9UX0NPTk5FQ1RFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1NPQ0tFVF9ER1JBTV9OT1RfQ09OTkVDVEVEXCIsIGBOb3QgY29ubmVjdGVkYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfU09DS0VUX0RHUkFNX05PVF9SVU5OSU5HIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfU09DS0VUX0RHUkFNX05PVF9SVU5OSU5HXCIsIGBOb3QgcnVubmluZ2ApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NSSV9QQVJTRSBleHRlbmRzIE5vZGVTeW50YXhFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgY2hhcjogc3RyaW5nLCBwb3NpdGlvbjogbnVtYmVyKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9TUklfUEFSU0VcIixcbiAgICAgIGBTdWJyZXNvdXJjZSBJbnRlZ3JpdHkgc3RyaW5nICR7bmFtZX0gaGFkIGFuIHVuZXhwZWN0ZWQgJHtjaGFyfSBhdCBwb3NpdGlvbiAke3Bvc2l0aW9ufWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TVFJFQU1fQUxSRUFEWV9GSU5JU0hFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfU1RSRUFNX0FMUkVBRFlfRklOSVNIRURcIixcbiAgICAgIGBDYW5ub3QgY2FsbCAke3h9IGFmdGVyIGEgc3RyZWFtIHdhcyBmaW5pc2hlZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TVFJFQU1fQ0FOTk9UX1BJUEUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9TVFJFQU1fQ0FOTk9UX1BJUEVcIiwgYENhbm5vdCBwaXBlLCBub3QgcmVhZGFibGVgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TVFJFQU1fREVTVFJPWUVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9TVFJFQU1fREVTVFJPWUVEXCIsXG4gICAgICBgQ2Fubm90IGNhbGwgJHt4fSBhZnRlciBhIHN0cmVhbSB3YXMgZGVzdHJveWVkYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NUUkVBTV9OVUxMX1ZBTFVFUyBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9TVFJFQU1fTlVMTF9WQUxVRVNcIiwgYE1heSBub3Qgd3JpdGUgbnVsbCB2YWx1ZXMgdG8gc3RyZWFtYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfU1RSRUFNX1BSRU1BVFVSRV9DTE9TRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1NUUkVBTV9QUkVNQVRVUkVfQ0xPU0VcIiwgYFByZW1hdHVyZSBjbG9zZWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NUUkVBTV9QVVNIX0FGVEVSX0VPRiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1NUUkVBTV9QVVNIX0FGVEVSX0VPRlwiLCBgc3RyZWFtLnB1c2goKSBhZnRlciBFT0ZgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TVFJFQU1fVU5TSElGVF9BRlRFUl9FTkRfRVZFTlQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1NUUkVBTV9VTlNISUZUX0FGVEVSX0VORF9FVkVOVFwiLFxuICAgICAgYHN0cmVhbS51bnNoaWZ0KCkgYWZ0ZXIgZW5kIGV2ZW50YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1NUUkVBTV9XUkFQIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9TVFJFQU1fV1JBUFwiLFxuICAgICAgYFN0cmVhbSBoYXMgU3RyaW5nRGVjb2RlciBzZXQgb3IgaXMgaW4gb2JqZWN0TW9kZWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9TVFJFQU1fV1JJVEVfQUZURVJfRU5EIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfU1RSRUFNX1dSSVRFX0FGVEVSX0VORFwiLCBgd3JpdGUgYWZ0ZXIgZW5kYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfU1lOVEhFVElDIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfU1lOVEhFVElDXCIsIGBKYXZhU2NyaXB0IENhbGxzdGFja2ApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1RMU19DRVJUX0FMVE5BTUVfSU5WQUxJRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIHJlYXNvbjogc3RyaW5nO1xuICBob3N0OiBzdHJpbmc7XG4gIGNlcnQ6IHN0cmluZztcblxuICBjb25zdHJ1Y3RvcihyZWFzb246IHN0cmluZywgaG9zdDogc3RyaW5nLCBjZXJ0OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1RMU19DRVJUX0FMVE5BTUVfSU5WQUxJRFwiLFxuICAgICAgYEhvc3RuYW1lL0lQIGRvZXMgbm90IG1hdGNoIGNlcnRpZmljYXRlJ3MgYWx0bmFtZXM6ICR7cmVhc29ufWAsXG4gICAgKTtcbiAgICB0aGlzLnJlYXNvbiA9IHJlYXNvbjtcbiAgICB0aGlzLmhvc3QgPSBob3N0O1xuICAgIHRoaXMuY2VydCA9IGNlcnQ7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVExTX0RIX1BBUkFNX1NJWkUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9UTFNfREhfUEFSQU1fU0laRVwiLCBgREggcGFyYW1ldGVyIHNpemUgJHt4fSBpcyBsZXNzIHRoYW4gMjA0OGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1RMU19IQU5EU0hBS0VfVElNRU9VVCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1RMU19IQU5EU0hBS0VfVElNRU9VVFwiLCBgVExTIGhhbmRzaGFrZSB0aW1lb3V0YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVExTX0lOVkFMSURfQ09OVEVYVCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9UTFNfSU5WQUxJRF9DT05URVhUXCIsIGAke3h9IG11c3QgYmUgYSBTZWN1cmVDb250ZXh0YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVExTX0lOVkFMSURfU1RBVEUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1RMU19JTlZBTElEX1NUQVRFXCIsXG4gICAgICBgVExTIHNvY2tldCBjb25uZWN0aW9uIG11c3QgYmUgc2VjdXJlbHkgZXN0YWJsaXNoZWRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVExTX0lOVkFMSURfUFJPVE9DT0xfVkVSU0lPTiBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcihwcm90b2NvbDogc3RyaW5nLCB4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1RMU19JTlZBTElEX1BST1RPQ09MX1ZFUlNJT05cIixcbiAgICAgIGAke3Byb3RvY29sfSBpcyBub3QgYSB2YWxpZCAke3h9IFRMUyBwcm90b2NvbCB2ZXJzaW9uYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1RMU19QUk9UT0NPTF9WRVJTSU9OX0NPTkZMSUNUIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHByZXZQcm90b2NvbDogc3RyaW5nLCBwcm90b2NvbDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9UTFNfUFJPVE9DT0xfVkVSU0lPTl9DT05GTElDVFwiLFxuICAgICAgYFRMUyBwcm90b2NvbCB2ZXJzaW9uICR7cHJldlByb3RvY29sfSBjb25mbGljdHMgd2l0aCBzZWN1cmVQcm90b2NvbCAke3Byb3RvY29sfWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9UTFNfUkVORUdPVElBVElPTl9ESVNBQkxFRCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVExTX1JFTkVHT1RJQVRJT05fRElTQUJMRURcIixcbiAgICAgIGBUTFMgc2Vzc2lvbiByZW5lZ290aWF0aW9uIGRpc2FibGVkIGZvciB0aGlzIHNvY2tldGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9UTFNfUkVRVUlSRURfU0VSVkVSX05BTUUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1RMU19SRVFVSVJFRF9TRVJWRVJfTkFNRVwiLFxuICAgICAgYFwic2VydmVybmFtZVwiIGlzIHJlcXVpcmVkIHBhcmFtZXRlciBmb3IgU2VydmVyLmFkZENvbnRleHRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVExTX1NFU1NJT05fQVRUQUNLIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9UTFNfU0VTU0lPTl9BVFRBQ0tcIixcbiAgICAgIGBUTFMgc2Vzc2lvbiByZW5lZ290aWF0aW9uIGF0dGFjayBkZXRlY3RlZGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9UTFNfU05JX0ZST01fU0VSVkVSIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9UTFNfU05JX0ZST01fU0VSVkVSXCIsXG4gICAgICBgQ2Fubm90IGlzc3VlIFNOSSBmcm9tIGEgVExTIHNlcnZlci1zaWRlIHNvY2tldGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9UUkFDRV9FVkVOVFNfQ0FURUdPUllfUkVRVUlSRUQgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9UUkFDRV9FVkVOVFNfQ0FURUdPUllfUkVRVUlSRURcIixcbiAgICAgIGBBdCBsZWFzdCBvbmUgY2F0ZWdvcnkgaXMgcmVxdWlyZWRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVFJBQ0VfRVZFTlRTX1VOQVZBSUxBQkxFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXCJFUlJfVFJBQ0VfRVZFTlRTX1VOQVZBSUxBQkxFXCIsIGBUcmFjZSBldmVudHMgYXJlIHVuYXZhaWxhYmxlYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVU5BVkFJTEFCTEVfRFVSSU5HX0VYSVQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1VOQVZBSUxBQkxFX0RVUklOR19FWElUXCIsXG4gICAgICBgQ2Fubm90IGNhbGwgZnVuY3Rpb24gaW4gcHJvY2VzcyBleGl0IGhhbmRsZXJgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVU5DQVVHSFRfRVhDRVBUSU9OX0NBUFRVUkVfQUxSRUFEWV9TRVQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1VOQ0FVR0hUX0VYQ0VQVElPTl9DQVBUVVJFX0FMUkVBRFlfU0VUXCIsXG4gICAgICBcImBwcm9jZXNzLnNldHVwVW5jYXVnaHRFeGNlcHRpb25DYXB0dXJlKClgIHdhcyBjYWxsZWQgd2hpbGUgYSBjYXB0dXJlIGNhbGxiYWNrIHdhcyBhbHJlYWR5IGFjdGl2ZVwiLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVU5FU0NBUEVEX0NIQVJBQ1RFUlMgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfVU5FU0NBUEVEX0NIQVJBQ1RFUlNcIiwgYCR7eH0gY29udGFpbnMgdW5lc2NhcGVkIGNoYXJhY3RlcnNgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9VTkhBTkRMRURfRVJST1IgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9VTkhBTkRMRURfRVJST1JcIiwgYFVuaGFuZGxlZCBlcnJvci4gKCR7eH0pYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVU5LTk9XTl9CVUlMVElOX01PRFVMRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHg6IHN0cmluZykge1xuICAgIHN1cGVyKFwiRVJSX1VOS05PV05fQlVJTFRJTl9NT0RVTEVcIiwgYE5vIHN1Y2ggYnVpbHQtaW4gbW9kdWxlOiAke3h9YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVU5LTk9XTl9DUkVERU5USUFMIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9VTktOT1dOX0NSRURFTlRJQUxcIiwgYCR7eH0gaWRlbnRpZmllciBkb2VzIG5vdCBleGlzdDogJHt5fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1VOS05PV05fRU5DT0RJTkcgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfVU5LTk9XTl9FTkNPRElOR1wiLCBgVW5rbm93biBlbmNvZGluZzogJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1VOS05PV05fRklMRV9FWFRFTlNJT04gZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1VOS05PV05fRklMRV9FWFRFTlNJT05cIixcbiAgICAgIGBVbmtub3duIGZpbGUgZXh0ZW5zaW9uIFwiJHt4fVwiIGZvciAke3l9YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1VOS05PV05fTU9EVUxFX0ZPUk1BVCBleHRlbmRzIE5vZGVSYW5nZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfVU5LTk9XTl9NT0RVTEVfRk9STUFUXCIsIGBVbmtub3duIG1vZHVsZSBmb3JtYXQ6ICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9VTktOT1dOX1NJR05BTCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcIkVSUl9VTktOT1dOX1NJR05BTFwiLCBgVW5rbm93biBzaWduYWw6ICR7eH1gKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9VTlNVUFBPUlRFRF9ESVJfSU1QT1JUIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nLCB5OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1VOU1VQUE9SVEVEX0RJUl9JTVBPUlRcIixcbiAgICAgIGBEaXJlY3RvcnkgaW1wb3J0ICcke3h9JyBpcyBub3Qgc3VwcG9ydGVkIHJlc29sdmluZyBFUyBtb2R1bGVzLCBpbXBvcnRlZCBmcm9tICR7eX1gLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVU5TVVBQT1JURURfRVNNX1VSTF9TQ0hFTUUgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1VOU1VQUE9SVEVEX0VTTV9VUkxfU0NIRU1FXCIsXG4gICAgICBgT25seSBmaWxlIGFuZCBkYXRhIFVSTHMgYXJlIHN1cHBvcnRlZCBieSB0aGUgZGVmYXVsdCBFU00gbG9hZGVyYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1Y4QlJFQUtJVEVSQVRPUiBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVjhCUkVBS0lURVJBVE9SXCIsXG4gICAgICBgRnVsbCBJQ1UgZGF0YSBub3QgaW5zdGFsbGVkLiBTZWUgaHR0cHM6Ly9naXRodWIuY29tL25vZGVqcy9ub2RlL3dpa2kvSW50bGAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9WQUxJRF9QRVJGT1JNQU5DRV9FTlRSWV9UWVBFIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9WQUxJRF9QRVJGT1JNQU5DRV9FTlRSWV9UWVBFXCIsXG4gICAgICBgQXQgbGVhc3Qgb25lIHZhbGlkIHBlcmZvcm1hbmNlIGVudHJ5IHR5cGUgaXMgcmVxdWlyZWRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVk1fRFlOQU1JQ19JTVBPUlRfQ0FMTEJBQ0tfTUlTU0lORyBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1ZNX0RZTkFNSUNfSU1QT1JUX0NBTExCQUNLX01JU1NJTkdcIixcbiAgICAgIGBBIGR5bmFtaWMgaW1wb3J0IGNhbGxiYWNrIHdhcyBub3Qgc3BlY2lmaWVkLmAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9WTV9NT0RVTEVfQUxSRUFEWV9MSU5LRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9WTV9NT0RVTEVfQUxSRUFEWV9MSU5LRURcIiwgYE1vZHVsZSBoYXMgYWxyZWFkeSBiZWVuIGxpbmtlZGApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1ZNX01PRFVMRV9DQU5OT1RfQ1JFQVRFX0NBQ0hFRF9EQVRBIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9WTV9NT0RVTEVfQ0FOTk9UX0NSRUFURV9DQUNIRURfREFUQVwiLFxuICAgICAgYENhY2hlZCBkYXRhIGNhbm5vdCBiZSBjcmVhdGVkIGZvciBhIG1vZHVsZSB3aGljaCBoYXMgYmVlbiBldmFsdWF0ZWRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfVk1fTU9EVUxFX0RJRkZFUkVOVF9DT05URVhUIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9WTV9NT0RVTEVfRElGRkVSRU5UX0NPTlRFWFRcIixcbiAgICAgIGBMaW5rZWQgbW9kdWxlcyBtdXN0IHVzZSB0aGUgc2FtZSBjb250ZXh0YCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1ZNX01PRFVMRV9MSU5LSU5HX0VSUk9SRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1ZNX01PRFVMRV9MSU5LSU5HX0VSUk9SRURcIixcbiAgICAgIGBMaW5raW5nIGhhcyBhbHJlYWR5IGZhaWxlZCBmb3IgdGhlIHByb3ZpZGVkIG1vZHVsZWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9WTV9NT0RVTEVfTk9UX01PRFVMRSBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfVk1fTU9EVUxFX05PVF9NT0RVTEVcIixcbiAgICAgIGBQcm92aWRlZCBtb2R1bGUgaXMgbm90IGFuIGluc3RhbmNlIG9mIE1vZHVsZWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9WTV9NT0RVTEVfU1RBVFVTIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfVk1fTU9EVUxFX1NUQVRVU1wiLCBgTW9kdWxlIHN0YXR1cyAke3h9YCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfV0FTSV9BTFJFQURZX1NUQVJURUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9XQVNJX0FMUkVBRFlfU1RBUlRFRFwiLCBgV0FTSSBpbnN0YW5jZSBoYXMgYWxyZWFkeSBzdGFydGVkYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfV09SS0VSX0lOSVRfRkFJTEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfV09SS0VSX0lOSVRfRkFJTEVEXCIsIGBXb3JrZXIgaW5pdGlhbGl6YXRpb24gZmFpbHVyZTogJHt4fWApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1dPUktFUl9OT1RfUlVOTklORyBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKCkge1xuICAgIHN1cGVyKFwiRVJSX1dPUktFUl9OT1RfUlVOTklOR1wiLCBgV29ya2VyIGluc3RhbmNlIG5vdCBydW5uaW5nYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfV09SS0VSX09VVF9PRl9NRU1PUlkgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1dPUktFUl9PVVRfT0ZfTUVNT1JZXCIsXG4gICAgICBgV29ya2VyIHRlcm1pbmF0ZWQgZHVlIHRvIHJlYWNoaW5nIG1lbW9yeSBsaW1pdDogJHt4fWAsXG4gICAgKTtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9XT1JLRVJfVU5TRVJJQUxJWkFCTEVfRVJST1IgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1dPUktFUl9VTlNFUklBTElaQUJMRV9FUlJPUlwiLFxuICAgICAgYFNlcmlhbGl6aW5nIGFuIHVuY2F1Z2h0IGV4Y2VwdGlvbiBmYWlsZWRgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfV09SS0VSX1VOU1VQUE9SVEVEX0VYVEVOU0lPTiBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3Rvcih4OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX1dPUktFUl9VTlNVUFBPUlRFRF9FWFRFTlNJT05cIixcbiAgICAgIGBUaGUgd29ya2VyIHNjcmlwdCBleHRlbnNpb24gbXVzdCBiZSBcIi5qc1wiLCBcIi5tanNcIiwgb3IgXCIuY2pzXCIuIFJlY2VpdmVkIFwiJHt4fVwiYCxcbiAgICApO1xuICB9XG59XG5leHBvcnQgY2xhc3MgRVJSX1dPUktFUl9VTlNVUFBPUlRFRF9PUEVSQVRJT04gZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IoeDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9XT1JLRVJfVU5TVVBQT1JURURfT1BFUkFUSU9OXCIsXG4gICAgICBgJHt4fSBpcyBub3Qgc3VwcG9ydGVkIGluIHdvcmtlcnNgLFxuICAgICk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfWkxJQl9JTklUSUFMSVpBVElPTl9GQUlMRUQgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcigpIHtcbiAgICBzdXBlcihcIkVSUl9aTElCX0lOSVRJQUxJWkFUSU9OX0ZBSUxFRFwiLCBgSW5pdGlhbGl6YXRpb24gZmFpbGVkYCk7XG4gIH1cbn1cbmV4cG9ydCBjbGFzcyBFUlJfRkFMU1lfVkFMVUVfUkVKRUNUSU9OIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgcmVhc29uOiBzdHJpbmc7XG4gIGNvbnN0cnVjdG9yKHJlYXNvbjogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfRkFMU1lfVkFMVUVfUkVKRUNUSU9OXCIsIFwiUHJvbWlzZSB3YXMgcmVqZWN0ZWQgd2l0aCBmYWxzeSB2YWx1ZVwiKTtcbiAgICB0aGlzLnJlYXNvbiA9IHJlYXNvbjtcbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9JTlZBTElEX1NFVFRJTkdfVkFMVUUgZXh0ZW5kcyBOb2RlUmFuZ2VFcnJvciB7XG4gIGFjdHVhbDogdW5rbm93bjtcbiAgbWluPzogbnVtYmVyO1xuICBtYXg/OiBudW1iZXI7XG5cbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBhY3R1YWw6IHVua25vd24sIG1pbj86IG51bWJlciwgbWF4PzogbnVtYmVyKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9JTlZBTElEX1NFVFRJTkdfVkFMVUVcIixcbiAgICAgIGBJbnZhbGlkIHZhbHVlIGZvciBzZXR0aW5nIFwiJHtuYW1lfVwiOiAke2FjdHVhbH1gLFxuICAgICk7XG4gICAgdGhpcy5hY3R1YWwgPSBhY3R1YWw7XG4gICAgaWYgKG1pbiAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLm1pbiA9IG1pbjtcbiAgICAgIHRoaXMubWF4ID0gbWF4O1xuICAgIH1cbiAgfVxufVxuZXhwb3J0IGNsYXNzIEVSUl9IVFRQMl9TVFJFQU1fQ0FOQ0VMIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgb3ZlcnJpZGUgY2F1c2U/OiBFcnJvcjtcbiAgY29uc3RydWN0b3IoZXJyb3I6IEVycm9yKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9IVFRQMl9TVFJFQU1fQ0FOQ0VMXCIsXG4gICAgICB0eXBlb2YgZXJyb3IubWVzc2FnZSA9PT0gXCJzdHJpbmdcIlxuICAgICAgICA/IGBUaGUgcGVuZGluZyBzdHJlYW0gaGFzIGJlZW4gY2FuY2VsZWQgKGNhdXNlZCBieTogJHtlcnJvci5tZXNzYWdlfSlgXG4gICAgICAgIDogXCJUaGUgcGVuZGluZyBzdHJlYW0gaGFzIGJlZW4gY2FuY2VsZWRcIixcbiAgICApO1xuICAgIGlmIChlcnJvcikge1xuICAgICAgdGhpcy5jYXVzZSA9IGVycm9yO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfQUREUkVTU19GQU1JTFkgZXh0ZW5kcyBOb2RlUmFuZ2VFcnJvciB7XG4gIGhvc3Q6IHN0cmluZztcbiAgcG9ydDogbnVtYmVyO1xuICBjb25zdHJ1Y3RvcihhZGRyZXNzVHlwZTogc3RyaW5nLCBob3N0OiBzdHJpbmcsIHBvcnQ6IG51bWJlcikge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9BRERSRVNTX0ZBTUlMWVwiLFxuICAgICAgYEludmFsaWQgYWRkcmVzcyBmYW1pbHk6ICR7YWRkcmVzc1R5cGV9ICR7aG9zdH06JHtwb3J0fWAsXG4gICAgKTtcbiAgICB0aGlzLmhvc3QgPSBob3N0O1xuICAgIHRoaXMucG9ydCA9IHBvcnQ7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX0NIQVIgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCBmaWVsZD86IHN0cmluZykge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9DSEFSXCIsXG4gICAgICBmaWVsZFxuICAgICAgICA/IGBJbnZhbGlkIGNoYXJhY3RlciBpbiAke25hbWV9YFxuICAgICAgICA6IGBJbnZhbGlkIGNoYXJhY3RlciBpbiAke25hbWV9IFtcIiR7ZmllbGR9XCJdYCxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9PUFRfVkFMVUUgZXh0ZW5kcyBOb2RlVHlwZUVycm9yIHtcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB2YWx1ZTogdW5rbm93bikge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfSU5WQUxJRF9PUFRfVkFMVUVcIixcbiAgICAgIGBUaGUgdmFsdWUgXCIke3ZhbHVlfVwiIGlzIGludmFsaWQgZm9yIG9wdGlvbiBcIiR7bmFtZX1cImAsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfUkVUVVJOX1BST1BFUlRZIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGlucHV0OiBzdHJpbmcsIG5hbWU6IHN0cmluZywgcHJvcDogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKSB7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlZBTElEX1JFVFVSTl9QUk9QRVJUWVwiLFxuICAgICAgYEV4cGVjdGVkIGEgdmFsaWQgJHtpbnB1dH0gdG8gYmUgcmV0dXJuZWQgZm9yIHRoZSBcIiR7cHJvcH1cIiBmcm9tIHRoZSBcIiR7bmFtZX1cIiBmdW5jdGlvbiBidXQgZ290ICR7dmFsdWV9LmAsXG4gICAgKTtcbiAgfVxufVxuXG4vLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuZnVuY3Rpb24gYnVpbGRSZXR1cm5Qcm9wZXJ0eVR5cGUodmFsdWU6IGFueSkge1xuICBpZiAodmFsdWUgJiYgdmFsdWUuY29uc3RydWN0b3IgJiYgdmFsdWUuY29uc3RydWN0b3IubmFtZSkge1xuICAgIHJldHVybiBgaW5zdGFuY2Ugb2YgJHt2YWx1ZS5jb25zdHJ1Y3Rvci5uYW1lfWA7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGB0eXBlICR7dHlwZW9mIHZhbHVlfWA7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX1JFVFVSTl9QUk9QRVJUWV9WQUxVRSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihpbnB1dDogc3RyaW5nLCBuYW1lOiBzdHJpbmcsIHByb3A6IHN0cmluZywgdmFsdWU6IHVua25vd24pIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOVkFMSURfUkVUVVJOX1BST1BFUlRZX1ZBTFVFXCIsXG4gICAgICBgRXhwZWN0ZWQgJHtpbnB1dH0gdG8gYmUgcmV0dXJuZWQgZm9yIHRoZSBcIiR7cHJvcH1cIiBmcm9tIHRoZSBcIiR7bmFtZX1cIiBmdW5jdGlvbiBidXQgZ290ICR7XG4gICAgICAgIGJ1aWxkUmV0dXJuUHJvcGVydHlUeXBlKFxuICAgICAgICAgIHZhbHVlLFxuICAgICAgICApXG4gICAgICB9LmAsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfUkVUVVJOX1ZBTFVFIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKGlucHV0OiBzdHJpbmcsIG5hbWU6IHN0cmluZywgdmFsdWU6IHVua25vd24pIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOVkFMSURfUkVUVVJOX1ZBTFVFXCIsXG4gICAgICBgRXhwZWN0ZWQgJHtpbnB1dH0gdG8gYmUgcmV0dXJuZWQgZnJvbSB0aGUgXCIke25hbWV9XCIgZnVuY3Rpb24gYnV0IGdvdCAke1xuICAgICAgICBidWlsZFJldHVyblByb3BlcnR5VHlwZShcbiAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgKVxuICAgICAgfS5gLFxuICAgICk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9JTlZBTElEX1VSTCBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBpbnB1dDogc3RyaW5nO1xuICBjb25zdHJ1Y3RvcihpbnB1dDogc3RyaW5nKSB7XG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9VUkxcIiwgYEludmFsaWQgVVJMOiAke2lucHV0fWApO1xuICAgIHRoaXMuaW5wdXQgPSBpbnB1dDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfVVJMX1NDSEVNRSBleHRlbmRzIE5vZGVUeXBlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihleHBlY3RlZDogc3RyaW5nIHwgW3N0cmluZ10gfCBbc3RyaW5nLCBzdHJpbmddKSB7XG4gICAgZXhwZWN0ZWQgPSBBcnJheS5pc0FycmF5KGV4cGVjdGVkKSA/IGV4cGVjdGVkIDogW2V4cGVjdGVkXTtcbiAgICBjb25zdCByZXMgPSBleHBlY3RlZC5sZW5ndGggPT09IDJcbiAgICAgID8gYG9uZSBvZiBzY2hlbWUgJHtleHBlY3RlZFswXX0gb3IgJHtleHBlY3RlZFsxXX1gXG4gICAgICA6IGBvZiBzY2hlbWUgJHtleHBlY3RlZFswXX1gO1xuICAgIHN1cGVyKFwiRVJSX0lOVkFMSURfVVJMX1NDSEVNRVwiLCBgVGhlIFVSTCBtdXN0IGJlICR7cmVzfWApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfTU9EVUxFX05PVF9GT1VORCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHBhdGg6IHN0cmluZywgYmFzZTogc3RyaW5nLCB0eXBlOiBzdHJpbmcgPSBcInBhY2thZ2VcIikge1xuICAgIHN1cGVyKFxuICAgICAgXCJFUlJfTU9EVUxFX05PVF9GT1VORFwiLFxuICAgICAgYENhbm5vdCBmaW5kICR7dHlwZX0gJyR7cGF0aH0nIGltcG9ydGVkIGZyb20gJHtiYXNlfWAsXG4gICAgKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX0lOVkFMSURfUEFDS0FHRV9DT05GSUcgZXh0ZW5kcyBOb2RlRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihwYXRoOiBzdHJpbmcsIGJhc2U/OiBzdHJpbmcsIG1lc3NhZ2U/OiBzdHJpbmcpIHtcbiAgICBjb25zdCBtc2cgPSBgSW52YWxpZCBwYWNrYWdlIGNvbmZpZyAke3BhdGh9JHtcbiAgICAgIGJhc2UgPyBgIHdoaWxlIGltcG9ydGluZyAke2Jhc2V9YCA6IFwiXCJcbiAgICB9JHttZXNzYWdlID8gYC4gJHttZXNzYWdlfWAgOiBcIlwifWA7XG4gICAgc3VwZXIoXCJFUlJfSU5WQUxJRF9QQUNLQUdFX0NPTkZJR1wiLCBtc2cpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9NT0RVTEVfU1BFQ0lGSUVSIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKHJlcXVlc3Q6IHN0cmluZywgcmVhc29uOiBzdHJpbmcsIGJhc2U/OiBzdHJpbmcpIHtcbiAgICBzdXBlcihcbiAgICAgIFwiRVJSX0lOVkFMSURfTU9EVUxFX1NQRUNJRklFUlwiLFxuICAgICAgYEludmFsaWQgbW9kdWxlIFwiJHtyZXF1ZXN0fVwiICR7cmVhc29ufSR7XG4gICAgICAgIGJhc2UgPyBgIGltcG9ydGVkIGZyb20gJHtiYXNlfWAgOiBcIlwiXG4gICAgICB9YCxcbiAgICApO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfSU5WQUxJRF9QQUNLQUdFX1RBUkdFVCBleHRlbmRzIE5vZGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHBrZ1BhdGg6IHN0cmluZyxcbiAgICBrZXk6IHN0cmluZyxcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIHRhcmdldDogYW55LFxuICAgIGlzSW1wb3J0PzogYm9vbGVhbixcbiAgICBiYXNlPzogc3RyaW5nLFxuICApIHtcbiAgICBsZXQgbXNnOiBzdHJpbmc7XG4gICAgY29uc3QgcmVsRXJyb3IgPSB0eXBlb2YgdGFyZ2V0ID09PSBcInN0cmluZ1wiICYmXG4gICAgICAhaXNJbXBvcnQgJiZcbiAgICAgIHRhcmdldC5sZW5ndGggJiZcbiAgICAgICF0YXJnZXQuc3RhcnRzV2l0aChcIi4vXCIpO1xuICAgIGlmIChrZXkgPT09IFwiLlwiKSB7XG4gICAgICBhc3NlcnQoaXNJbXBvcnQgPT09IGZhbHNlKTtcbiAgICAgIG1zZyA9IGBJbnZhbGlkIFwiZXhwb3J0c1wiIG1haW4gdGFyZ2V0ICR7SlNPTi5zdHJpbmdpZnkodGFyZ2V0KX0gZGVmaW5lZCBgICtcbiAgICAgICAgYGluIHRoZSBwYWNrYWdlIGNvbmZpZyAke3BrZ1BhdGh9cGFja2FnZS5qc29uJHtcbiAgICAgICAgICBiYXNlID8gYCBpbXBvcnRlZCBmcm9tICR7YmFzZX1gIDogXCJcIlxuICAgICAgICB9JHtyZWxFcnJvciA/ICc7IHRhcmdldHMgbXVzdCBzdGFydCB3aXRoIFwiLi9cIicgOiBcIlwifWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1zZyA9IGBJbnZhbGlkIFwiJHtpc0ltcG9ydCA/IFwiaW1wb3J0c1wiIDogXCJleHBvcnRzXCJ9XCIgdGFyZ2V0ICR7XG4gICAgICAgIEpTT04uc3RyaW5naWZ5KFxuICAgICAgICAgIHRhcmdldCxcbiAgICAgICAgKVxuICAgICAgfSBkZWZpbmVkIGZvciAnJHtrZXl9JyBpbiB0aGUgcGFja2FnZSBjb25maWcgJHtwa2dQYXRofXBhY2thZ2UuanNvbiR7XG4gICAgICAgIGJhc2UgPyBgIGltcG9ydGVkIGZyb20gJHtiYXNlfWAgOiBcIlwiXG4gICAgICB9JHtyZWxFcnJvciA/ICc7IHRhcmdldHMgbXVzdCBzdGFydCB3aXRoIFwiLi9cIicgOiBcIlwifWA7XG4gICAgfVxuICAgIHN1cGVyKFwiRVJSX0lOVkFMSURfUEFDS0FHRV9UQVJHRVRcIiwgbXNnKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRVJSX1BBQ0tBR0VfSU1QT1JUX05PVF9ERUZJTkVEIGV4dGVuZHMgTm9kZVR5cGVFcnJvciB7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHNwZWNpZmllcjogc3RyaW5nLFxuICAgIHBhY2thZ2VQYXRoOiBzdHJpbmcgfCB1bmRlZmluZWQsXG4gICAgYmFzZTogc3RyaW5nLFxuICApIHtcbiAgICBjb25zdCBtc2cgPSBgUGFja2FnZSBpbXBvcnQgc3BlY2lmaWVyIFwiJHtzcGVjaWZpZXJ9XCIgaXMgbm90IGRlZmluZWQke1xuICAgICAgcGFja2FnZVBhdGggPyBgIGluIHBhY2thZ2UgJHtwYWNrYWdlUGF0aH1wYWNrYWdlLmpzb25gIDogXCJcIlxuICAgIH0gaW1wb3J0ZWQgZnJvbSAke2Jhc2V9YDtcblxuICAgIHN1cGVyKFwiRVJSX1BBQ0tBR0VfSU1QT1JUX05PVF9ERUZJTkVEXCIsIG1zZyk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEVSUl9QQUNLQUdFX1BBVEhfTk9UX0VYUE9SVEVEIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3Ioc3VicGF0aDogc3RyaW5nLCBwa2dQYXRoOiBzdHJpbmcsIGJhc2VQYXRoPzogc3RyaW5nKSB7XG4gICAgbGV0IG1zZzogc3RyaW5nO1xuICAgIGlmIChzdWJwYXRoID09PSBcIi5cIikge1xuICAgICAgbXNnID0gYE5vIFwiZXhwb3J0c1wiIG1haW4gZGVmaW5lZCBpbiAke3BrZ1BhdGh9cGFja2FnZS5qc29uJHtcbiAgICAgICAgYmFzZVBhdGggPyBgIGltcG9ydGVkIGZyb20gJHtiYXNlUGF0aH1gIDogXCJcIlxuICAgICAgfWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIG1zZyA9XG4gICAgICAgIGBQYWNrYWdlIHN1YnBhdGggJyR7c3VicGF0aH0nIGlzIG5vdCBkZWZpbmVkIGJ5IFwiZXhwb3J0c1wiIGluICR7cGtnUGF0aH1wYWNrYWdlLmpzb24ke1xuICAgICAgICAgIGJhc2VQYXRoID8gYCBpbXBvcnRlZCBmcm9tICR7YmFzZVBhdGh9YCA6IFwiXCJcbiAgICAgICAgfWA7XG4gICAgfVxuXG4gICAgc3VwZXIoXCJFUlJfUEFDS0FHRV9QQVRIX05PVF9FWFBPUlRFRFwiLCBtc2cpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBFUlJfSU5URVJOQUxfQVNTRVJUSU9OIGV4dGVuZHMgTm9kZUVycm9yIHtcbiAgY29uc3RydWN0b3IobWVzc2FnZT86IHN0cmluZykge1xuICAgIGNvbnN0IHN1ZmZpeCA9IFwiVGhpcyBpcyBjYXVzZWQgYnkgZWl0aGVyIGEgYnVnIGluIE5vZGUuanMgXCIgK1xuICAgICAgXCJvciBpbmNvcnJlY3QgdXNhZ2Ugb2YgTm9kZS5qcyBpbnRlcm5hbHMuXFxuXCIgK1xuICAgICAgXCJQbGVhc2Ugb3BlbiBhbiBpc3N1ZSB3aXRoIHRoaXMgc3RhY2sgdHJhY2UgYXQgXCIgK1xuICAgICAgXCJodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvaXNzdWVzXFxuXCI7XG4gICAgc3VwZXIoXG4gICAgICBcIkVSUl9JTlRFUk5BTF9BU1NFUlRJT05cIixcbiAgICAgIG1lc3NhZ2UgPT09IHVuZGVmaW5lZCA/IHN1ZmZpeCA6IGAke21lc3NhZ2V9XFxuJHtzdWZmaXh9YCxcbiAgICApO1xuICB9XG59XG5cbi8vIFVzaW5nIGBmcy5ybWRpcmAgb24gYSBwYXRoIHRoYXQgaXMgYSBmaWxlIHJlc3VsdHMgaW4gYW4gRU5PRU5UIGVycm9yIG9uIFdpbmRvd3MgYW5kIGFuIEVOT1RESVIgZXJyb3Igb24gUE9TSVguXG5leHBvcnQgY2xhc3MgRVJSX0ZTX1JNRElSX0VOT1RESVIgZXh0ZW5kcyBOb2RlU3lzdGVtRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihwYXRoOiBzdHJpbmcpIHtcbiAgICBjb25zdCBjb2RlID0gaXNXaW5kb3dzID8gXCJFTk9FTlRcIiA6IFwiRU5PVERJUlwiO1xuICAgIGNvbnN0IGN0eDogTm9kZVN5c3RlbUVycm9yQ3R4ID0ge1xuICAgICAgbWVzc2FnZTogXCJub3QgYSBkaXJlY3RvcnlcIixcbiAgICAgIHBhdGgsXG4gICAgICBzeXNjYWxsOiBcInJtZGlyXCIsXG4gICAgICBjb2RlLFxuICAgICAgZXJybm86IGlzV2luZG93cyA/IEVOT0VOVCA6IEVOT1RESVIsXG4gICAgfTtcbiAgICBzdXBlcihjb2RlLCBjdHgsIFwiUGF0aCBpcyBub3QgYSBkaXJlY3RvcnlcIik7XG4gIH1cbn1cblxuaW50ZXJmYWNlIFV2RXhjZXB0aW9uQ29udGV4dCB7XG4gIHN5c2NhbGw6IHN0cmluZztcbn1cbmV4cG9ydCBmdW5jdGlvbiBkZW5vRXJyb3JUb05vZGVFcnJvcihlOiBFcnJvciwgY3R4OiBVdkV4Y2VwdGlvbkNvbnRleHQpIHtcbiAgY29uc3QgZXJybm8gPSBleHRyYWN0T3NFcnJvck51bWJlckZyb21FcnJvck1lc3NhZ2UoZSk7XG4gIGlmICh0eXBlb2YgZXJybm8gPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICByZXR1cm4gZTtcbiAgfVxuXG4gIGNvbnN0IGV4ID0gdXZFeGNlcHRpb24oe1xuICAgIGVycm5vOiBtYXBTeXNFcnJub1RvVXZFcnJubyhlcnJubyksXG4gICAgLi4uY3R4LFxuICB9KTtcbiAgcmV0dXJuIGV4O1xufVxuXG5mdW5jdGlvbiBleHRyYWN0T3NFcnJvck51bWJlckZyb21FcnJvck1lc3NhZ2UoZTogdW5rbm93bik6IG51bWJlciB8IHVuZGVmaW5lZCB7XG4gIGNvbnN0IG1hdGNoID0gZSBpbnN0YW5jZW9mIEVycm9yXG4gICAgPyBlLm1lc3NhZ2UubWF0Y2goL1xcKG9zIGVycm9yIChcXGQrKVxcKS8pXG4gICAgOiBmYWxzZTtcblxuICBpZiAobWF0Y2gpIHtcbiAgICByZXR1cm4gK21hdGNoWzFdO1xuICB9XG5cbiAgcmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbm5SZXNldEV4Y2VwdGlvbihtc2c6IHN0cmluZykge1xuICBjb25zdCBleCA9IG5ldyBFcnJvcihtc2cpO1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAoZXggYXMgYW55KS5jb2RlID0gXCJFQ09OTlJFU0VUXCI7XG4gIHJldHVybiBleDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFnZ3JlZ2F0ZVR3b0Vycm9ycyhcbiAgaW5uZXJFcnJvcjogQWdncmVnYXRlRXJyb3IsXG4gIG91dGVyRXJyb3I6IEFnZ3JlZ2F0ZUVycm9yICYgeyBjb2RlOiBzdHJpbmcgfSxcbikge1xuICBpZiAoaW5uZXJFcnJvciAmJiBvdXRlckVycm9yICYmIGlubmVyRXJyb3IgIT09IG91dGVyRXJyb3IpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShvdXRlckVycm9yLmVycm9ycykpIHtcbiAgICAgIC8vIElmIGBvdXRlckVycm9yYCBpcyBhbHJlYWR5IGFuIGBBZ2dyZWdhdGVFcnJvcmAuXG4gICAgICBvdXRlckVycm9yLmVycm9ycy5wdXNoKGlubmVyRXJyb3IpO1xuICAgICAgcmV0dXJuIG91dGVyRXJyb3I7XG4gICAgfVxuICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby1yZXN0cmljdGVkLXN5bnRheFxuICAgIGNvbnN0IGVyciA9IG5ldyBBZ2dyZWdhdGVFcnJvcihcbiAgICAgIFtcbiAgICAgICAgb3V0ZXJFcnJvcixcbiAgICAgICAgaW5uZXJFcnJvcixcbiAgICAgIF0sXG4gICAgICBvdXRlckVycm9yLm1lc3NhZ2UsXG4gICAgKTtcbiAgICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICAgIChlcnIgYXMgYW55KS5jb2RlID0gb3V0ZXJFcnJvci5jb2RlO1xuICAgIHJldHVybiBlcnI7XG4gIH1cbiAgcmV0dXJuIGlubmVyRXJyb3IgfHwgb3V0ZXJFcnJvcjtcbn1cbmNvZGVzLkVSUl9JUENfQ0hBTk5FTF9DTE9TRUQgPSBFUlJfSVBDX0NIQU5ORUxfQ0xPU0VEO1xuY29kZXMuRVJSX0lOVkFMSURfQVJHX1RZUEUgPSBFUlJfSU5WQUxJRF9BUkdfVFlQRTtcbmNvZGVzLkVSUl9JTlZBTElEX0FSR19WQUxVRSA9IEVSUl9JTlZBTElEX0FSR19WQUxVRTtcbmNvZGVzLkVSUl9JTlZBTElEX0NBTExCQUNLID0gRVJSX0lOVkFMSURfQ0FMTEJBQ0s7XG5jb2Rlcy5FUlJfT1VUX09GX1JBTkdFID0gRVJSX09VVF9PRl9SQU5HRTtcbmNvZGVzLkVSUl9TT0NLRVRfQkFEX1BPUlQgPSBFUlJfU09DS0VUX0JBRF9QT1JUO1xuY29kZXMuRVJSX0JVRkZFUl9PVVRfT0ZfQk9VTkRTID0gRVJSX0JVRkZFUl9PVVRfT0ZfQk9VTkRTO1xuY29kZXMuRVJSX1VOS05PV05fRU5DT0RJTkcgPSBFUlJfVU5LTk9XTl9FTkNPRElORztcbi8vIFRPRE8oa3Qzayk6IGFzc2lnbiBhbGwgZXJyb3IgY2xhc3NlcyBoZXJlLlxuXG5leHBvcnQgeyBjb2RlcywgaGlkZVN0YWNrRnJhbWVzIH07XG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgQWJvcnRFcnJvcixcbiAgYWdncmVnYXRlVHdvRXJyb3JzLFxuICBjb2Rlcyxcbn07XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsMEVBQTBFO0FBQzFFLG9FQUFvRTtBQUNwRTs7Ozs7Ozs7Ozs7O2lCQVlpQixD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