export function bigNumberToLEBuffer(value: BigNumber, bytes = 8): Buffer {
    const hex = value.toString(16).padStart(bytes * 2, '0');
    const buffer = Buffer.from(hex, 'hex');
    return Buffer.from(buffer).reverse(); // little-endian
}