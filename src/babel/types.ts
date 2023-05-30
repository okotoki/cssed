import type { BabelFileMetadata, TransformOptions } from '@babel/core'

export interface ITransformFileResult {
  metadata?: BabelFileMetadata
  code: string
}

export type StrictOptions = {
  babelOptions: TransformOptions
  evaluate: boolean
  extensions: string[]
}
