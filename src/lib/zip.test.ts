import { describe, expect, it } from 'vitest'
import { crc32, makeZip } from './zip'

const bytes = (text: string) => new TextEncoder().encode(text)

describe('crc32', () => {
  it('bate com o valor de referência', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926)
    expect(crc32(new Uint8Array())).toBe(0)
  })
})

describe('makeZip', () => {
  it('escreve cabeçalhos, diretório central e fim com o número de ficheiros', async () => {
    const zip = makeZip([
      { name: '01-sala.jpg', data: bytes('aaaa') },
      { name: '02-cozinha.jpg', data: bytes('bbbbbb') },
    ])
    const view = new DataView(await zip.arrayBuffer())
    expect(view.getUint32(0, true)).toBe(0x04034b50)

    const end = view.byteLength - 22
    expect(view.getUint32(end, true)).toBe(0x06054b50)
    expect(view.getUint16(end + 10, true)).toBe(2)

    const centralOffset = view.getUint32(end + 16, true)
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50)
    // o segundo ficheiro começa depois do primeiro: 30 + nome (11) + dados (4)
    const secondEntry = centralOffset + 46 + '01-sala.jpg'.length
    expect(view.getUint32(secondEntry + 42, true)).toBe(30 + 11 + 4)
  })

  it('guarda o CRC e o tamanho de cada ficheiro', async () => {
    const zip = makeZip([{ name: 'a.txt', data: bytes('123456789') }])
    const view = new DataView(await zip.arrayBuffer())
    expect(view.getUint32(14, true)).toBe(0xcbf43926)
    expect(view.getUint32(18, true)).toBe(9)
    expect(view.getUint32(22, true)).toBe(9)
  })

  it('sem ficheiros devolve só o registo final', async () => {
    const zip = makeZip([])
    expect(zip.size).toBe(22)
  })
})
