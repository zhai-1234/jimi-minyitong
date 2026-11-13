import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'

const isDemo = import.meta.env.VITE_DEMO_MODE === 'true'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue')
  }
]

const router = createRouter({
  history: isDemo ? createWebHashHistory(import.meta.env.BASE_URL) : createWebHistory(),
  routes
})

export default router