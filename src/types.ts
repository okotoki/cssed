export type Value = Function | string | number

export type Location = {
  line: number
  column: number
}

interface JSONObject {
  [x: string]: JSONValue
}

type JSONArray = Array<JSONValue>

export type JSONValue = string | number | boolean | JSONObject | JSONArray

export type Serializable = JSONArray | JSONObject
