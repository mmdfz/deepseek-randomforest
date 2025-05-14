import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import axios from 'axios'

Vue.config.productionTip = false
Vue.use(ElementUI)

// 配置axios
axios.defaults.baseURL = process.env.VUE_APP_API_URL || ''  // 空字符串表示使用相对路径
axios.defaults.timeout = 30000 // 30秒超时

// 添加请求拦截器
axios.interceptors.request.use(
  config => {
    console.log('发送请求:', config.url, config.data)
    return config
  },
  error => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 添加响应拦截器
axios.interceptors.response.use(
  response => {
    console.log('收到响应:', response.config.url, response.status, response.data)
    return response
  },
  error => {
    if (error.response) {
      console.error('响应错误:', error.response.status, error.response.data)
    } else if (error.request) {
      console.error('未收到响应:', error.request)
    } else {
      console.error('请求配置错误:', error.message)
    }
    return Promise.reject(error)
  }
)

Vue.prototype.$http = axios

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app') 