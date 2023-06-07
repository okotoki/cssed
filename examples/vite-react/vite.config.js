import react from '@vitejs/plugin-react'
import ssr from 'vite-plugin-ssr/plugin'
import cssedVitePlugin from 'cssed/vite-plugin'

export default {
  plugins: [cssedVitePlugin(), react(), ssr()]
}
