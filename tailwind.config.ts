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
        // 时期色：由「两个时期」这一内容事实决定，不是装饰
        video: '#E0A244', // 视频期 · 琥珀金
        live: '#5BC8E8', // 直播期 · 冰青
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
    },
  },
  plugins: [],
}

export default config
