// ZIP sem compressão (método "store"): chega para juntar fotografias já comprimidas, sem depender de uma biblioteca.
export type ZipEntry = { name: string; data: Uint8Array<ArrayBuffer> }

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

export function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// Data fixa (1980-01-01): o conteúdo do ZIP fica igual para as mesmas fotografias.
const dosTime = 0
const dosDate = (0 << 9) | (1 << 5) | 1
const utf8Flag = 0x0800

export function makeZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder()
  const parts: BlobPart[] = []
  const central: Uint8Array<ArrayBuffer>[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, utf8Flag, true)
    local.setUint16(8, 0, true)
    local.setUint16(10, dosTime, true)
    local.setUint16(12, dosDate, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, size, true)
    local.setUint32(22, size, true)
    local.setUint16(26, name.length, true)
    local.setUint16(28, 0, true)
    parts.push(local.buffer, name, entry.data)

    const header = new DataView(new ArrayBuffer(46 + name.length))
    header.setUint32(0, 0x02014b50, true)
    header.setUint16(4, 20, true)
    header.setUint16(6, 20, true)
    header.setUint16(8, utf8Flag, true)
    header.setUint16(10, 0, true)
    header.setUint16(12, dosTime, true)
    header.setUint16(14, dosDate, true)
    header.setUint32(16, crc, true)
    header.setUint32(20, size, true)
    header.setUint32(24, size, true)
    header.setUint16(28, name.length, true)
    header.setUint32(42, offset, true)
    new Uint8Array(header.buffer).set(name, 46)
    central.push(new Uint8Array(header.buffer))

    offset += 30 + name.length + size
  }

  const centralSize = central.reduce((sum, item) => sum + item.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, centralSize, true)
  end.setUint32(16, offset, true)

  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' })
}
