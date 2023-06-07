export { Page }

import { css } from 'cssed'
import React from 'react'
import { Counter } from './Counter'
import { red } from './some'

const a = (some: any) => ''
const styles: any = css`
  .red {
    ${a('')}
    color: ${red};
  }
`

function Page() {
  return (
    <>
      <h1 className={styles.red}>Welcome</h1>
      This page is:
      <ul>
        <li>Rendered to HTML.</li>
        <li>
          Interactive. <Counter />
        </li>
      </ul>
    </>
  )
}
