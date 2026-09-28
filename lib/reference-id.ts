// Excludes 0/O, 1/I/L -- characters that look alike in most fonts, so a
// reference id can be read off an email and typed back without ambiguity.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
const LENGTH = 6

export function generateReferenceId(): string {
  let code = ""
  for (let i = 0; i < LENGTH; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}
