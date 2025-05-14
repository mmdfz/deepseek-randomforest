import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.VUE_APP_API_URL || '',
  headers: {
    'Content-Type': 'application/json'
  }
});

// 添加请求拦截器
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

export default {
  // 用户相关API
  user: {
    login(credentials) {
      return apiClient.post('/api/auth/login', credentials);
    },
    register(userData) {
      return apiClient.post('/api/auth/register', userData);
    },
    getCurrentUser() {
      return apiClient.get('/api/auth/me');
    }
  },
  
  // 比特币价格和预测相关API
  bitcoin: {
    getPrices() {
      return apiClient.get('/api/bitcoin/prices');
    },
    getSentimentScores() {
      return apiClient.get('/api/bitcoin/sentiment');
    },
    getPrediction(params) {
      return apiClient.post('/api/bitcoin/predict', params);
    }
  },
  
  // AI聊天相关API
  chat: {
    // 发送消息到聊天API
    sendMessage(message) {
      return apiClient.post('/api/chat', { message });
    },
    
    // 获取比特币相关新闻
    getNews() {
      return apiClient.get('/api/news/direct');
    }
  },
  
  // 综合预测API
  predict: {
    // 发送预测请求
    sendRequest(message) {
      return apiClient.post('/api/predict', { message });
    }
  }
}; 