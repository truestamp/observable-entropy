export class TooManyTries extends Error {
    constructor() {
        super("function did not complete within allowed number of attempts");
    }
    tooManyTries = true;
}
export function isTooManyTries(error) {
    return error.tooManyTries === true;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidG9vTWFueVRyaWVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidG9vTWFueVRyaWVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE1BQU0sT0FBTyxZQUFhLFNBQVEsS0FBSztJQUNyQztRQUNFLEtBQUssQ0FBQyw2REFBNkQsQ0FBQyxDQUFDO0lBQ3ZFLENBQUM7SUFDRCxZQUFZLEdBQUcsSUFBSSxDQUFDO0NBQ3JCO0FBRUQsTUFBTSxVQUFVLGNBQWMsQ0FBQyxLQUFZO0lBQ3pDLE9BQVEsS0FBc0IsQ0FBQyxZQUFZLEtBQUssSUFBSSxDQUFDO0FBQ3ZELENBQUMifQ==