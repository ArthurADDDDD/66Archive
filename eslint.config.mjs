import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default [
  ...nextCoreWebVitals,
  ...nextTs,
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'scripts/**'] },
]
