import * as babel from '@babel/core'
import { createMacro, MacroError } from 'babel-plugin-macros'
import { readFileSync, writeFileSync } from 'fs'
import { basename, dirname, join, relative } from 'path'

import taggedTemplateExpression, { State } from './visitors/taggedTemplateExpression'

const { addDefault } = require('@babel/helper-module-imports')

import type { Node, TaggedTemplateExpression } from '@babel/types'
import type { NodePath } from '@babel/core'
import type { Evaluator, EvalRule } from './types'

const assertType = (path: NodePath<Node>, type: string) => {
  if (path.parentPath.type !== type)
    throw new Error(
      `cssed/macro can only be used as ${type}. You tried ${path.parentPath.type}.`
    )
}

const IMPORT_NAME = 'css'
const assertName = (refName: string) => {
  if (refName !== IMPORT_NAME) {
    throw new MacroError(
      `Imported an invalid named import: ${refName}. Please import: ${IMPORT_NAME}`
    )
  }
}

const evaluator: Evaluator = (filename, _options, text) => {
  const { code } = babel.transformSync(text, {
    filename
  })!

  return [code!, null]
}

const rules: EvalRule[] = [
  {
    action: evaluator
  },
  {
    test: /\/node_modules\//,
    action: 'ignore'
  }
]

export default createMacro(({ references, state: s, babel }) => {
  const state = s as State
  /**
   * Enforce`css` as named import so people
   * can only import { css } from 'cssed/macro'
   * or an alias of it eg. { css as foo }
   */
  Object.keys(references).forEach(assertName)

  const cssRefs = references[IMPORT_NAME]
  if (!cssRefs) return

  state.cssed = []
  state.index = 0
  /**
   * Each usage content would be stored in a separate file.
   *
   * const a = css`.a { color: red; }`
   * const b = css`.a { color: green; }`
   *
   * Above example will generate 2 css files,
   * this way class names won't conflict.
   */
  cssRefs.forEach((ref) => {
    // Only allow usage as tagged templates
    assertType(ref, 'TaggedTemplateExpression')

    taggedTemplateExpression(
      ref.parentPath as NodePath<TaggedTemplateExpression>,
      state,
      rules
    )
  })

  const filename = state.file.opts.filename

  // never
  if (!filename) return

  /**
   * For each reference do:
   * - add import statement
   * - generate CSS file next to file where function was called
   */
  const makeFilesHidden = true
  const filenamePrefix = makeFilesHidden ? '.' : ''

  state.cssed.forEach(({ importName, cssText }, i, self) => {
    const multiple = self.length > 1

    const fn = join(
      dirname(filename),
      filenamePrefix +
        basename(
          filename.replace(
            /\.[^.]+$/,
            (multiple ? '.' + importName.replace('_', '') : '') + '.module.css'
          )
        )
    )

    // output css file
    const out = relative(process.cwd(), fn)

    /**
     * include this file as an import to the referenced module,
     * so that css-loader can pick it up at bundle - time.
     *
     * Macros runs in single file mode, so we can pass ['0'] reference.
     */
    addDefault(cssRefs[0], './' + basename(out), {
      nameHint: '_cssed' + importName
    })

    // Read the file first to compare the content
    // Write the new content only if it's changed
    // This will prevent unnecessary reloads
    let currentCssText

    try {
      currentCssText = readFileSync(out, 'utf-8')
    } catch (e) {
      // Ignore error
    }

    const warning = '/* AUTO GENERATED FILE. DO NOT EDIT  */\n'
    const content = warning + cssText
    // if the files hasn't changed, nothing more to do

    if (currentCssText === content) return
    writeFileSync(out, content)
  })
})

type CSSProperties = {
  [key: string]: string | number | CSSProperties
}
// Exporting css function for proper typings when using it
export function css(
  _strings: TemplateStringsArray,
  ..._exprs: Array<string | number | CSSProperties>
): string {
  throw new Error(
    'Using the "css" tag in runtime is not supported. Make sure you have set up the Babel plugin correctly.'
  )
}
