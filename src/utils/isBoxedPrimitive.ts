// There is a problem with using boxed numbers and strings in TS,
// so we cannot just use `instanceof` here

const constructors = ['Number', 'String']
// eslint-disable-next-line @typescript-eslint/ban-types
export default function isBoxedPrimitive(o: any): o is Number | String {
  return (
    constructors.includes(o.constructor.name) &&
    typeof o?.valueOf() !== 'object'
  )
}
