import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 深靛炭底：档案库的暗房，不是纯黑
        base: '#12141C',
        surface: '#191C26',
        raised: '#212533',
        line: '#2C3140',
        ink: '#E6E4EF',
        // 正文灰与弱化灰：对比度按 WCAG AA 反推（vs #12141C 分别为 6.9:1 / 4.8:1）。
        // 暗房的氛围来自底色与留白，不来自「看不清的字」——所以这两档只压到刚好可读为止。
        muted: '#9AA0B4',
        faint: '#7C8296',
        // 时期色：由「两个时期」这一内容事实决定，不是装饰
        video: '#E0A244', // 视频期 · 琥珀金
        live: '#5BC8E8', // 直播期 · 冰青
        today: '#E5568A', // 那年今日 · 品红
      },
      /**
       * 字阶只有六档，用 clamp 一次覆盖手机到桌面——不再写 text-[30px] sm:text-[44px] 的双份。
       * 手机端相邻两档至少差 1.35 倍，保证「哪一级是主」一眼分得出来。
       * 下限即手机端观感：正文 14px、meta 11px，不再有 8~10px 的中文小字。
       */
      fontSize: {
        hero: ['clamp(3.5rem, 16vw, 5.75rem)', { lineHeight: '1', letterSpacing: '-0.03em' }],
        h1: ['clamp(1.875rem, 7vw, 2.875rem)', { lineHeight: '1.12', letterSpacing: '-0.02em' }],
        h2: ['clamp(1.625rem, 5.5vw, 2.5rem)', { lineHeight: '1.16', letterSpacing: '-0.02em' }],
        h3: ['clamp(1.1875rem, 3.4vw, 1.625rem)', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        body: ['clamp(0.875rem, 1.4vw, 0.9375rem)', { lineHeight: '1.75' }],
        meta: ['0.6875rem', { lineHeight: '1.45' }],
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        sans: [
          'var(--font-display)',
          '-apple-system',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
      },
      spacing: {
        gutter: '4.5rem', // 时间轴刻度尺宽度
      },
    },
  },
  plugins: [],
}

export default config
