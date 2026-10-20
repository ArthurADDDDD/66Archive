import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const signup = readFileSync('src/components/LiveAlertSignup.tsx', 'utf8')
const confirm = readFileSync('src/components/LiveAlertAction.tsx', 'utf8')

// The POST response only means an application was accepted. It can be identical
// for active / pending / new addresses and cannot prove mail delivery.
assert.match(signup, /result\.status !== 'confirmation_required'/)
assert.match(signup, /申请已提交，别忘了去邮箱确认/)
assert.match(signup, /尚未完成订阅/)
assert.match(signup, /确认邮件可能稍晚到达/)
assert.match(signup, /再到网页点击「确认订阅」/)
assert.match(signup, /24 小时/)
assert.match(signup, /我去邮箱完成确认/)
assert.match(signup, /发送确认邮件（还需确认）/)
assert.doesNotMatch(signup, /确认邮件已发送到/)
assert.doesNotMatch(signup, />知道了<\/button>/)

// Retain explicit, unchecked marketing consent and independent browser push.
assert.match(signup, /const \[consent, setConsent\] = useState\(false\)/)
assert.match(signup, /type="checkbox" required checked=\{consent\}/)
assert.match(signup, /我自愿订阅女流档案馆的开播邮件提醒/)
assert.match(signup, /onUseEmail=\{\(\) => chooseTab\('email'\)\}/)
assert.match(signup, /const emailStatus = mailSent \? '需确认' : ''/)

// Opening a confirmation link is read-only; an explicit user click performs the POST.
assert.match(confirm, /最后一步：确认订阅/)
assert.match(confirm, /打开邮件链接还不算订阅成功/)
assert.match(confirm, /关闭页面不会自动确认订阅/)
assert.match(confirm, /onClick=\{act\}/)
assert.match(confirm, /method:'POST'/)
assert.match(confirm, /邮箱已确认|订阅成功，开播时见/)
console.log('email confirmation guidance tests passed')
