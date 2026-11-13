import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_DIFY_PROXY_TARGET || 'http://localhost'
  const backendTarget = env.VITE_BACKEND_PROXY_TARGET || 'http://localhost:8081'

  return {
    // GitHub Pages 部署时通过 VITE_BASE=/<repo>/ 指定子路径
    base: process.env.VITE_BASE || env.VITE_BASE || '/',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      proxy: {
        // 浏览器请求 /v1/* 时转发到 Dify 服务器，避免跨域并隐藏 API 密钥的来源限制
        '/v1': {
          target: proxyTarget,
          changeOrigin: true
        },
        // 可选：问答记录上报后端时，开发环境经代理转发到 Spring Boot
        '/api': {
          target: backendTarget,
          changeOrigin: true
        }
      }
    },
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // 将体积较大的第三方库拆分为独立 chunk，利于浏览器缓存与首屏加载
          // （rolldown 要求 manualChunks 为函数形式）
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('element-plus') || id.includes('@element-plus')) return 'element-plus'
            if (id.includes('marked') || id.includes('dompurify')) return 'markdown'
            if (id.includes('pinia') || id.includes('vue-router') || id.includes('/vue/')) return 'vue'
          }
        }
      }
    }
  }
})
