// Copyright since 2020, FranckLdx. All rights reserved. MIT license.
export class TimeoutError extends Error {
    isTimeout = true;
}
/** Type guard for TimeoutError */ export function isTimeoutError(error) {
    return error.isTimeout === true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vZGVuby5sYW5kL3gvcmV0cnlAdjIuMC4wL3dhaXQvdGltZW91dEVycm9yLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCBzaW5jZSAyMDIwLCBGcmFuY2tMZHguIEFsbCByaWdodHMgcmVzZXJ2ZWQuIE1JVCBsaWNlbnNlLlxuZXhwb3J0IGNsYXNzIFRpbWVvdXRFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgaXNUaW1lb3V0ID0gdHJ1ZTtcbn1cbi8qKiBUeXBlIGd1YXJkIGZvciBUaW1lb3V0RXJyb3IgKi9cblxuZXhwb3J0IGZ1bmN0aW9uIGlzVGltZW91dEVycm9yKGVycm9yOiBFcnJvcik6IGVycm9yIGlzIFRpbWVvdXRFcnJvciB7XG4gIHJldHVybiAoZXJyb3IgYXMgVGltZW91dEVycm9yKS5pc1RpbWVvdXQgPT09IHRydWU7XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEscUVBQXFFO0FBQ3JFLE9BQU8sTUFBTSxZQUFZLFNBQVMsS0FBSztJQUNyQyxTQUFTLEdBQUcsSUFBSSxDQUFDO0NBQ2xCO0FBQ0Qsa0NBQWtDLENBRWxDLE9BQU8sU0FBUyxjQUFjLENBQUMsS0FBWSxFQUF5QjtJQUNsRSxPQUFPLEFBQUMsS0FBSyxDQUFrQixTQUFTLEtBQUssSUFBSSxDQUFDO0NBQ25EIn0=