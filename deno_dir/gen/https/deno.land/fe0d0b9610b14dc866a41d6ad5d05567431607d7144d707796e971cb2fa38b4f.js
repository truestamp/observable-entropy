/** Creates a Promise with the `reject` and `resolve` functions
 * placed as methods on the promise object itself. It allows you to do:
 *
 *     const p = deferred<number>();
 *     // ...
 *     p.resolve(42);
 */ export function deferred() {
    let methods;
    const promise = new Promise((resolve, reject)=>{
        methods = {
            resolve,
            reject
        };
    });
    return Object.assign(promise, methods);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3N0ZEAwLjk4LjAvYXN5bmMvZGVmZXJyZWQudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IDIwMTgtMjAyMSB0aGUgRGVubyBhdXRob3JzLiBBbGwgcmlnaHRzIHJlc2VydmVkLiBNSVQgbGljZW5zZS5cbi8vIFRPRE8ocnkpIEl0J2QgYmUgYmV0dGVyIHRvIG1ha2UgRGVmZXJyZWQgYSBjbGFzcyB0aGF0IGluaGVyaXRzIGZyb21cbi8vIFByb21pc2UsIHJhdGhlciB0aGFuIGFuIGludGVyZmFjZS4gVGhpcyBpcyBwb3NzaWJsZSBpbiBFUzIwMTYsIGhvd2V2ZXJcbi8vIHR5cGVzY3JpcHQgcHJvZHVjZXMgYnJva2VuIGNvZGUgd2hlbiB0YXJnZXRpbmcgRVM1IGNvZGUuXG4vLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL01pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy8xNTIwMlxuLy8gQXQgdGhlIHRpbWUgb2Ygd3JpdGluZywgdGhlIGdpdGh1YiBpc3N1ZSBpcyBjbG9zZWQgYnV0IHRoZSBwcm9ibGVtIHJlbWFpbnMuXG5leHBvcnQgaW50ZXJmYWNlIERlZmVycmVkPFQ+IGV4dGVuZHMgUHJvbWlzZTxUPiB7XG4gIHJlc29sdmUodmFsdWU/OiBUIHwgUHJvbWlzZUxpa2U8VD4pOiB2b2lkO1xuICAvLyBkZW5vLWxpbnQtaWdub3JlIG5vLWV4cGxpY2l0LWFueVxuICByZWplY3QocmVhc29uPzogYW55KTogdm9pZDtcbn1cblxuLyoqIENyZWF0ZXMgYSBQcm9taXNlIHdpdGggdGhlIGByZWplY3RgIGFuZCBgcmVzb2x2ZWAgZnVuY3Rpb25zXG4gKiBwbGFjZWQgYXMgbWV0aG9kcyBvbiB0aGUgcHJvbWlzZSBvYmplY3QgaXRzZWxmLiBJdCBhbGxvd3MgeW91IHRvIGRvOlxuICpcbiAqICAgICBjb25zdCBwID0gZGVmZXJyZWQ8bnVtYmVyPigpO1xuICogICAgIC8vIC4uLlxuICogICAgIHAucmVzb2x2ZSg0Mik7XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWZlcnJlZDxUPigpOiBEZWZlcnJlZDxUPiB7XG4gIGxldCBtZXRob2RzO1xuICBjb25zdCBwcm9taXNlID0gbmV3IFByb21pc2U8VD4oKHJlc29sdmUsIHJlamVjdCk6IHZvaWQgPT4ge1xuICAgIG1ldGhvZHMgPSB7IHJlc29sdmUsIHJlamVjdCB9O1xuICB9KTtcbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24ocHJvbWlzZSwgbWV0aG9kcykgYXMgRGVmZXJyZWQ8VD47XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBWUE7Ozs7OztHQU1HLENBQ0gsT0FBTyxTQUFTLFFBQVEsR0FBbUI7SUFDekMsSUFBSSxPQUFPLEFBQUM7SUFDWixNQUFNLE9BQU8sR0FBRyxJQUFJLE9BQU8sQ0FBSSxDQUFDLE9BQU8sRUFBRSxNQUFNLEdBQVc7UUFDeEQsT0FBTyxHQUFHO1lBQUUsT0FBTztZQUFFLE1BQU07U0FBRSxDQUFDO0tBQy9CLENBQUMsQUFBQztJQUNILE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQWdCO0NBQ3ZEIn0=