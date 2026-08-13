import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default [
  ...nextCoreWebVitals,
  ...nextTs,
  // workers/ 有自己的运行时与 tsconfig（Cloudflare Workers），不适用主站这套规则
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'scripts/**', 'workers/**'] },
]
