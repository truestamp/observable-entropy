import init, { create_hash as createHash, digest_hash as digestHash, source, update_hash as updateHash, } from "./wasm.js";
import * as hex from "../../encoding/hex.ts";
import * as base64 from "../../encoding/base64.ts";
await init(source);
const TYPE_ERROR_MSG = "hash: `data` is invalid type";
export class Hash {
    #hash;
    #digested;
    constructor(algorithm) {
        this.#hash = createHash(algorithm);
        this.#digested = false;
    }
    update(data) {
        let msg;
        if (typeof data === "string") {
            msg = new TextEncoder().encode(data);
        }
        else if (typeof data === "object") {
            if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
                msg = new Uint8Array(data);
            }
            else {
                throw new Error(TYPE_ERROR_MSG);
            }
        }
        else {
            throw new Error(TYPE_ERROR_MSG);
        }
        updateHash(this.#hash, msg);
        return this;
    }
    digest() {
        if (this.#digested)
            throw new Error("hash: already digested");
        this.#digested = true;
        return digestHash(this.#hash);
    }
    toString(format = "hex") {
        const finalized = new Uint8Array(this.digest());
        switch (format) {
            case "hex":
                return hex.encodeToString(finalized);
            case "base64":
                return base64.encode(finalized);
            default:
                throw new Error("hash: invalid format");
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGFzaC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImhhc2gudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxJQUFJLEVBQUUsRUFDWCxXQUFXLElBQUksVUFBVSxFQUV6QixXQUFXLElBQUksVUFBVSxFQUN6QixNQUFNLEVBQ04sV0FBVyxJQUFJLFVBQVUsR0FDMUIsTUFBTSxXQUFXLENBQUM7QUFFbkIsT0FBTyxLQUFLLEdBQUcsTUFBTSx1QkFBdUIsQ0FBQztBQUM3QyxPQUFPLEtBQUssTUFBTSxNQUFNLDBCQUEwQixDQUFDO0FBR25ELE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBRW5CLE1BQU0sY0FBYyxHQUFHLDhCQUE4QixDQUFDO0FBRXRELE1BQU0sT0FBTyxJQUFJO0lBQ2YsS0FBSyxDQUFXO0lBQ2hCLFNBQVMsQ0FBVTtJQUVuQixZQUFZLFNBQWlCO1FBQzNCLElBQUksQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ25DLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0lBQ3pCLENBQUM7SUFNRCxNQUFNLENBQUMsSUFBYTtRQUNsQixJQUFJLEdBQWUsQ0FBQztRQUVwQixJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRTtZQUM1QixHQUFHLEdBQUcsSUFBSSxXQUFXLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBYyxDQUFDLENBQUM7U0FDaEQ7YUFBTSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRTtZQUNuQyxJQUFJLElBQUksWUFBWSxXQUFXLElBQUksV0FBVyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDM0QsR0FBRyxHQUFHLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzVCO2lCQUFNO2dCQUNMLE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7YUFDakM7U0FDRjthQUFNO1lBQ0wsTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztTQUNqQztRQUVELFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRTVCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUdELE1BQU07UUFDSixJQUFJLElBQUksQ0FBQyxTQUFTO1lBQUUsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO1FBRTlELElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQ3RCLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztJQUNoQyxDQUFDO0lBTUQsUUFBUSxDQUFDLFNBQXVCLEtBQUs7UUFDbkMsTUFBTSxTQUFTLEdBQUcsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFFaEQsUUFBUSxNQUFNLEVBQUU7WUFDZCxLQUFLLEtBQUs7Z0JBQ1IsT0FBTyxHQUFHLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3ZDLEtBQUssUUFBUTtnQkFDWCxPQUFPLE1BQU0sQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDbEM7Z0JBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1NBQzNDO0lBQ0gsQ0FBQztDQUNGIn0=