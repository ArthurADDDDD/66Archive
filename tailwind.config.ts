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
        muted: '#8B8FA3',
        faint: '#5A5F73',
        // 时期色：由「她换过三个家」这一内容事实决定，不是装饰。见 src/lib/covers.ts 的 ERAS。
        video: '#E0A244', // 视频期 2010–2015 · 优酷 · 琥珀金
        live: '#5BC8E8', // 斗鱼期 2016–2023 · 冰青
        now: '#FF6B75', // 抖音期 2024– · 珊瑚
        today: '#E5568A', // 那年今日 · 品红
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
      gridTemplateColumns: {
        // 封面墙用的列数：都能被 1 / 2 / 3 整除，三个时期的格子才能各自铺满一行。
        18: 'repeat(18, minmax(0, 1fr))',
        24: 'repeat(24, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
}

export default config
