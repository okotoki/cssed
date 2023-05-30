export { Page }

import React from 'react'
import { Counter } from './Counter'
import { css } from 'cssed'
import { red } from './some'

const styles = css`
  .red {
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
