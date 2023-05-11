import * as babel from '@babel/core'
import { createMacro, MacroError } from 'babel-plugin-macros'
import { createHash } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname, join, relative, resolve } from 'path'
import taggedTemplateExpression from './visitors/taggedTemplateExpression'
const { addDefault } = require('@babel/helper-module-imports')

import type { NodePath } from '@babel/core'
import type { Node, TaggedTemplateExpression } from '@babel/types'
import type { EvalRule, Evaluator } from './types'
import type { State } from './visitors/taggedTemplateExpression'

const IMPORT_NAME = 'css'
const CACHE_DIR = join(process.cwd(), '.cssed')

const createHashFn = (data: string, len: number) => {
  return createHash("shake256", { outputLength: len })
    .update(data)
    .digest("hex");
}

const hash = (data: string) => createHashFn(data, 8)

const assertType = (path: NodePath<Node>, type: string) => {
  if (!path.parentPath || path.parentPath.type !== type)
    throw new Error(
      `cssed/macro can only be used as ${type}. You tried ${path.parentPath?.type}.`
    )
}

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
  mkdirSync(CACHE_DIR, { recursive: true })
  const cwd = process.cwd()
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

  const dir = dirname(filename)
  const cleanFilename = basename(filename).replace(/\?.*$/, '')
  const relativeDirname = relative(cwd, dir)
  const relativeFilenamePath = join(relativeDirname, cleanFilename)

  /**
   * For each reference do:
   * - add import statement
   * - generate CSS file in the cache directory .cssed
   */
  state.cssed.forEach(({ importName, cssText }, i, self) => {
    const multiple = self.length > 1

    // output css file
    const outFile = hash(relativeFilenamePath) + (multiple ? importName : '') + '.module.css'
    const outFilePath = join(CACHE_DIR, outFile)
    const importFilePath = relative(dir, outFilePath)

    /**
     * include this file as an import to the referenced module,
     * so that css-loader can pick it up at bundle - time.
     *
     * Macros runs in single file mode, so we can pass ['0'] reference.
     */
    addDefault(cssRefs[0], importFilePath, {
      nameHint: '_cssed' + importName
    })

    // Read the file first to compare the content
    // Write the new content only if it's changed
    // This will prevent unnecessary reloads
    let currentCssText

    try {
      currentCssText = readFileSync(outFilePath, 'utf-8')
    } catch (e) {
      // Ignore error
    }

    const warning = '/* AUTO GENERATED FILE. DO NOT EDIT  */\n'
    const content = warning + rebaseUrlInCss(cssText, dir, CACHE_DIR)
    // if the files hasn't changed, nothing more to do

    if (currentCssText === content) return
    writeFileSync(outFilePath, content)
  })
})

const rebaseUrlInCss = (cssText: string, cssFileDir: string, cacheDir: string) => {
  const regex = /url\((["']?)(.*?)\1\)/g

  const rebasedCSS = cssText.replace(regex, (match, quote, url) => {
    if (!/^(\/|data:|http[s]?)/i.test(url)) {
      const absolutePath = relative(cacheDir, resolve(cssFileDir, url))
      // console.log('rebaseUrlInCss', resolve(cssFileDir, url), cacheDir, absolutePath, url)
      return `url(${quote}${absolutePath}${quote})`
    }
    return match
  })

  return rebasedCSS
}

type CSSProperties = {
  [key: string]: string | number | CSSProperties
}
// Exporting css function for proper typings when using it
export function css(
  _strings: TemplateStringsArray,
  ..._exprs: Array<string | number | CSSProperties>
): { [ket: string]: string } {
  throw new Error(
    'Using the "css" tag in runtime is not supported. Make sure you have set up the Babel plugin correctly.'
  )
}
