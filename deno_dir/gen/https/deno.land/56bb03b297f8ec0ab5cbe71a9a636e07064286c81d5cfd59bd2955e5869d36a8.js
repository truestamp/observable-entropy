import { waitUntil, waitUntilAsync } from "./wait.ts";
export function waitUntilAsyncDecorator(fn, duration, error) {
    return (...args) => {
        const wrappedFn = () => fn(...args);
        return waitUntilAsync(wrappedFn, duration, error);
    };
}
export function waitUntilDecorator(fn, duration, error) {
    return (...args) => {
        const wrappedFn = () => fn(...args);
        return waitUntil(wrappedFn, duration, error);
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb3JhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRlY29yYXRvcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFRdEQsTUFBTSxVQUFVLHVCQUF1QixDQUdyQyxFQUFlLEVBQUUsUUFBaUIsRUFBRSxLQUFhO0lBQ2pELE9BQU8sQ0FBQyxHQUFHLElBQTZCLEVBQTJCLEVBQUU7UUFDbkUsTUFBTSxTQUFTLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDcEMsT0FBTyxjQUFjLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBRS9DLENBQUM7SUFDSixDQUFDLENBQUM7QUFDSixDQUFDO0FBUUQsTUFBTSxVQUFVLGtCQUFrQixDQUdoQyxFQUFLLEVBQUUsUUFBaUIsRUFBRSxLQUFhO0lBQ3ZDLE9BQU8sQ0FBQyxHQUFHLElBQW1CLEVBQWlCLEVBQUU7UUFDL0MsTUFBTSxTQUFTLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDcEMsT0FBTyxTQUFTLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxLQUFLLENBQWtCLENBQUM7SUFDaEUsQ0FBQyxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCBzaW5jZSAyMDIwLCBGcmFuY2tMZHguIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuaW1wb3J0IHsgd2FpdFVudGlsLCB3YWl0VW50aWxBc3luYyB9IGZyb20gXCIuL3dhaXQudHNcIjtcblxuLyoqIGEgd2FpdFVudGlsQXN5bmMgZGVjb3JhdG9yIFxuICogQHBhcmFtIGZuIHRoZSBhc3luYyBmdW5jdGlvbiB0byBleGVjdXRlXG4gKiBAcGFyYW0gZHVyYXRpb24gdGltZW91dCBpbiBtaWxsaXNlY29uZHNcbiAqIEBwYXJhbSBbZXJyb3JdIGN1c3RvbSBlcnJvciB0byB0aHJvdyB3aGVuIGZuIGR1cmF0aW9uIGV4Y2VlZGVkIGR1cmF0aW9uLiBJZiBub3QgcHJvdmlkZWQgYSBUaW1lb3V0RXJyb3IgaXMgdGhyb3duLlxuICogQHJldHVybnMgYSBmdW5jdGlvbiBoYXQgdGFrZXMgc2FtZSBwYXJhbWV0ZXJzIGFzIGZuLiBJdCBjYWxscyBmbiB1c2luZyB3YWl0VW50aWxBc3luYyBhbmQgcmV0dXJucy90aHJvd3MgdGhlIHJlc3VsdHMvZXJyb3Igb2YgdGhpcyBjYWxsPyBcbiovXG5leHBvcnQgZnVuY3Rpb24gd2FpdFVudGlsQXN5bmNEZWNvcmF0b3I8XG4gIC8vIGRlbm8tbGludC1pZ25vcmUgbm8tZXhwbGljaXQtYW55XG4gIFJFVFVSTl9UWVBFIGV4dGVuZHMgKC4uLmFyZ3M6IGFueVtdKSA9PiBQcm9taXNlPGFueT4sXG4+KGZuOiBSRVRVUk5fVFlQRSwgZHVyYXRpb24/OiBudW1iZXIsIGVycm9yPzogRXJyb3IpIHtcbiAgcmV0dXJuICguLi5hcmdzOiBQYXJhbWV0ZXJzPFJFVFVSTl9UWVBFPik6IFJldHVyblR5cGU8UkVUVVJOX1RZUEU+ID0+IHtcbiAgICBjb25zdCB3cmFwcGVkRm4gPSAoKSA9PiBmbiguLi5hcmdzKTtcbiAgICByZXR1cm4gd2FpdFVudGlsQXN5bmMod3JhcHBlZEZuLCBkdXJhdGlvbiwgZXJyb3IpIGFzIFJldHVyblR5cGU8XG4gICAgICBSRVRVUk5fVFlQRVxuICAgID47XG4gIH07XG59XG5cbi8qKiBhIHdhaXRVbnRpbCBkZWNvcmF0b3IgXG4gKiBAcGFyYW0gZm4gdGhlIGZ1bmN0aW9uIHRvIGV4ZWN1dGVcbiAqIEBwYXJhbSBkdXJhdGlvbiB0aW1lb3V0IGluIG1pbGxpc2Vjb25kc1xuICogQHBhcmFtIFtlcnJvcl0gY3VzdG9tIGVycm9yIHRvIHRocm93IHdoZW4gZm4gZHVyYXRpb24gZXhjZWVkZWQgZHVyYXRpb24uIElmIG5vdCBwcm92aWRlZCBhIFRpbWVvdXRFcnJvciBpcyB0aHJvd24uXG4gKiBAcmV0dXJuczogYSBmdW5jdGlvbiBoYXQgdGFrZXMgc2FtZSBwYXJhbWV0ZXJzIGFzIGZuLiBJdCBjYWxscyBmbiB1c2luZyB3YWl0VW50aWwgYW5kIHJldHVybnMvdGhyb3dzIHRoZSByZXN1bHRzL2Vycm9yIG9mIHRoaXMgY2FsbD8gXG4qL1xuZXhwb3J0IGZ1bmN0aW9uIHdhaXRVbnRpbERlY29yYXRvcjxcbiAgLy8gZGVuby1saW50LWlnbm9yZSBuby1leHBsaWNpdC1hbnlcbiAgVCBleHRlbmRzICguLi5hcmdzOiBhbnlbXSkgPT4gYW55LFxuPihmbjogVCwgZHVyYXRpb24/OiBudW1iZXIsIGVycm9yPzogRXJyb3IpIHtcbiAgcmV0dXJuICguLi5hcmdzOiBQYXJhbWV0ZXJzPFQ+KTogUmV0dXJuVHlwZTxUPiA9PiB7XG4gICAgY29uc3Qgd3JhcHBlZEZuID0gKCkgPT4gZm4oLi4uYXJncyk7XG4gICAgcmV0dXJuIHdhaXRVbnRpbCh3cmFwcGVkRm4sIGR1cmF0aW9uLCBlcnJvcikgYXMgUmV0dXJuVHlwZTxUPjtcbiAgfTtcbn1cbiJdfQ==