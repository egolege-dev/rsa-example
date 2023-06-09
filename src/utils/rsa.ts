import { base64EncArr, deterministicReplacer, strToUTF8Arr } from "./helpers"

const PUBLIC_KEY = process.env.NEXT_PUBLIC_PUBLIC_KEY

export const HAS_PUBLIC_KEY = !!PUBLIC_KEY

const keyConfig = {
  name: "RSASSA-PKCS1-v1_5",
  hash: {
    name: "SHA-256"
  },
  modulusLength: 3072, //The same number of bits used to create the key
  extractable: false,
  publicExponent: new Uint8Array([0x01, 0x00, 0x01])
}

function textToUi8Arr(text: string): Uint8Array {
  let bufView = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    bufView[i] = text.charCodeAt(i)
  }
  return bufView
}

function base64StringToArrayBuffer(b64str: string): ArrayBufferLike {
  const byteStr = window.atob(b64str)
  return textToUi8Arr(byteStr).buffer
}

function convertPemToArrayBuffer(pem: string): ArrayBufferLike {
  const lines = pem.split('\n')
  let encoded = ''
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0 &&
      lines[i].indexOf('-BEGIN RSA PUBLIC KEY-') < 0 &&
      lines[i].indexOf('-BEGIN RSA PRIVATE KEY-') < 0 &&
      lines[i].indexOf('-BEGIN PUBLIC KEY-') < 0 &&
      lines[i].indexOf('-BEGIN PRIVATE KEY-') < 0 &&
      lines[i].indexOf('-END RSA PUBLIC KEY-') < 0 &&
      lines[i].indexOf('-END RSA PRIVATE KEY-') < 0 &&
      lines[i].indexOf('-END PUBLIC KEY-') < 0 &&
      lines[i].indexOf('-END PRIVATE KEY-') < 0
    ) {
      encoded += lines[i].trim()
    }
  }
  return base64StringToArrayBuffer(encoded)
}

async function importPublicKey(): Promise<CryptoKey | null> {
  if (!PUBLIC_KEY) {
    return null
  }
  const arrBufPublicKey = convertPemToArrayBuffer(PUBLIC_KEY)
  const key = await crypto.subtle.importKey(
    "spki", //has to be spki for importing public keys
    arrBufPublicKey,
    keyConfig,
    false, //false because we aren't exporting the key, just using it
    ["verify"] //has to be "verify" because public keys can't "sign"
  ).catch((e) => {
    console.log(e)
    return null
  })
  return key
}

const stringifyAndBufferifyData = (data: any): ArrayBufferLike => {
  const stringified = JSON.stringify(data, deterministicReplacer)
  const toUtf8 = strToUTF8Arr(stringified)
  const toBase64 = base64EncArr(toUtf8)
  const toArrayBuffer = textToUi8Arr(toBase64)
  return toArrayBuffer.buffer
}

async function verifyIfIsValid(pub: CryptoKey, sig: ArrayBufferLike, data: ArrayBufferLike) {
  return crypto.subtle.verify(keyConfig, pub, sig, data).catch((e) => {
    console.log('error validation:', e)
    return false
  })
}

export const verifySignature = async (message: any, signature: string) => {
  const publicKey = await importPublicKey()

  if (!publicKey) {
    return false
  }

  const msgArrBuf = stringifyAndBufferifyData(message)
  const sigArrBuf = base64StringToArrayBuffer(signature)

  const isValid = await verifyIfIsValid(publicKey, sigArrBuf, msgArrBuf)

  return isValid
}
