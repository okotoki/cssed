// eslint-disable-next-line @typescript-eslint/ban-types
export type Value = Function | string | number

export type Location = {
  line: number
  column: number
}

export type JSONValue = string | number | boolean | JSONObject | JSONArray

export interface JSONObject {
  [x: string]: JSONValue
}

export type JSONArray = Array<JSONValue>

export type Serializable = JSONArray | JSONObject

export type Evaluator = (
  filename: string,
  rules: EvalRule[],
  text: string,
  only: string[] | null
) => [string, Map<string, string[]> | null]

export type EvalRule = {
  test?: RegExp | ((path: string) => boolean)
  action: Evaluator | 'ignore' | string
}
