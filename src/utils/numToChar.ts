export default function numToChar(num: number) {
  var s = '',
    t

  while (num > 0) {
    t = (num - 1) % 26
    s = String.fromCharCode(97 + t) + s
    num = ((num - t) / 26) | 0
  }
  return s || undefined
}
