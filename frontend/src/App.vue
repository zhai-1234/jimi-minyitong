<template>
  <div id="app">
    <!-- 全局导航栏 - 固定在顶部 -->
    <nav class="global-navbar">
      <div class="navbar-container">
        <div class="navbar-brand">基米民易通</div>
        <div class="navbar-menu">
          <a href="#home" class="menu-item">首页</a>
          <a href="#features" class="menu-item">功能</a>
          <a href="#about" class="menu-item">关于</a>
          <a href="#contact" class="menu-item">联系我们</a>
        </div>
      </div>
    </nav>

    <!-- 主内容区域 - 为导航栏留出空间 -->
    <div class="main-content">
      <router-view />
    </div>
  </div>
</template>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #333;
  background-color: #f5f5f5;
}

#app {
  height: 100vh;
  overflow: hidden;
}

/* 全局导航栏样式 - 固定在顶部 */
.global-navbar {
  width: 100%;
  height: 60px;
  background-color: #2c3e50;
  color: white;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.navbar-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.navbar-brand {
  font-size: 20px;
  font-weight: bold;
}

.navbar-menu {
  display: flex;
  gap: 24px;
}

.menu-item {
  color: white;
  text-decoration: none;
  font-size: 16px;
  transition: opacity 0.3s;
}

.menu-item:hover {
  opacity: 0.8;
}

/* 主内容区域 - 为导航栏留出空间，内部由聊天组件自行滚动 */
.main-content {
  padding-top: 60px; /* 等于导航栏高度 */
  height: 100%;
  overflow: hidden;
}
</style>
