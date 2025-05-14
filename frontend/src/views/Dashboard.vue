<template>
  <div class="dashboard-container">
    <el-header class="header">
      <div class="logo">
        <img src="../assets/bitcoin-logo.png" alt="比特币标志" class="bitcoin-logo">
        <span>比特币价格预测平台</span>
      </div>
      <div class="user-info">
        <span>欢迎，{{ currentUser.username }}</span>
        <el-button type="text" @click="logout">退出登录</el-button>
      </div>
    </el-header>
    
    <el-main class="main-content">
      <!-- 价格走势图 -->
      <el-card class="chart-card">
        <div slot="header" class="chart-header">
          <span>比特币价格走势（最近7天）</span>
          <div>
            <el-radio-group v-model="timeRange" size="small" @change="changeTimeRange" style="margin-right: 15px;">
              <el-radio-button label="1d">1天</el-radio-button>
              <el-radio-button label="7d">7天</el-radio-button>
              <el-radio-button label="30d">30天</el-radio-button>
            </el-radio-group>
            <el-button type="primary" size="small" @click="refreshData" icon="el-icon-refresh" :loading="loading.prices">刷新数据</el-button>
          </div>
        </div>
        <div ref="priceChart" class="price-chart"></div>
      </el-card>
      
      <!-- 对话框区域 -->
      <div class="chat-section">
        <el-card class="chat-card">
          <div slot="header" class="chat-header">
            <span>加密货币新闻助手</span>
            <el-tooltip content="获取最新的加密货币新闻和市场动态" placement="top">
              <i class="el-icon-question"></i>
            </el-tooltip>
          </div>
          <div class="chat-messages" ref="chatMessages">
            <div v-for="(message, index) in aiMessages" :key="index" 
                 :class="['message', message.role === 'user' ? 'user-message' : 'ai-message']">
              <div class="message-content">{{ message.content }}</div>
              <div class="message-time">{{ message.time }}</div>
            </div>
          </div>
          <div class="chat-input">
            <el-input
              v-model="aiInputMessage"
              placeholder="询问最新加密货币新闻，例如：'比特币最新消息'"
              :disabled="aiLoading"
              @keyup.enter.native="sendAiMessage"
            >
              <el-button slot="append" :loading="aiLoading" @click="sendAiMessage">发送</el-button>
            </el-input>
          </div>
        </el-card>
        
        <el-card class="chat-card">
          <div slot="header" class="chat-header">
            <span>价格预测</span>
            <el-tooltip content="使用AI模型预测比特币未来价格走势" placement="top">
              <i class="el-icon-question"></i>
            </el-tooltip>
          </div>
          <div class="chat-messages" ref="predictionMessages">
            <div v-for="(message, index) in predictionMessages" :key="index" 
                 :class="['message', message.role === 'user' ? 'user-message' : 'ai-message']">
              <div class="message-content">{{ message.content }}</div>
              <div class="message-time">{{ message.time }}</div>
            </div>
          </div>
          <div class="chat-input">
            <el-input
              v-model="predictionInputMessage"
              placeholder="请输入预测参数，例如：'预测未来3天的BTC价格'"
              :disabled="predictionLoading"
              @keyup.enter.native="sendPredictionRequest"
            >
              <el-button slot="append" :loading="predictionLoading" @click="sendPredictionRequest">预测</el-button>
            </el-input>
          </div>
        </el-card>
      </div>
    </el-main>
  </div>
</template>

<script>
import * as echarts from 'echarts'
import axios from 'axios'

export default {
  name: 'Dashboard',
  data() {
    return {
      priceChart: null,
      aiMessages: [
        {
          role: 'ai',
          content: '您好！我是您的加密货币新闻助手。您可以询问我比特币相关新闻和市场动态。例如，尝试输入"比特币最新消息"或"今日加密货币热点"。',
          time: this.formatTime(new Date())
        }
      ],
      predictionMessages: [
        {
          role: 'ai',
          content: '欢迎使用比特币价格预测功能。我将结合实时价格数据和新闻情感分析，使用训练好的模型为您提供预测结果。请输入您想要预测的时间范围，例如"预测未来3天的比特币价格"。',
          time: this.formatTime(new Date())
        }
      ],
      aiInputMessage: '',
      predictionInputMessage: '',
      aiLoading: false,
      predictionLoading: false,
      bitcoinPrices: [],
      currentUser: {
        username: '用户'
      },
      timeRange: '7d', // 默认显示7天数据
      loading: {
        prices: false,
        prediction: false
      },
      error: null
    }
  },
  mounted() {
    // 从store获取用户信息
    this.currentUser = this.$store.getters.currentUser || { username: '用户' }
    
    // 初始化价格图表
    this.initPriceChart()
    
    // 获取比特币价格数据
    this.fetchBitcoinPrices()
    
    // 滚动聊天框到底部
    this.$nextTick(() => {
      this.scrollChatToBottom('chatMessages')
      this.scrollChatToBottom('predictionMessages')
    })
  },
  updated() {
    // 在组件更新后也滚动到底部
    this.scrollChatToBottom('chatMessages')
    this.scrollChatToBottom('predictionMessages')
  },
  methods: {
    initPriceChart() {
      this.priceChart = echarts.init(this.$refs.priceChart)
      
      const option = {
        tooltip: {
          trigger: 'axis',
          formatter: '{b}<br />{a}: {c} USD'
        },
        xAxis: {
          type: 'category',
          data: [],
          axisTick: {
            alignWithLabel: true
          }
        },
        yAxis: {
          type: 'value',
          scale: true,
          name: '价格 (USD)',
          nameLocation: 'middle',
          nameGap: 30,
          axisLabel: {
            formatter: '{value} USD'
          }
        },
        series: [{
          name: '比特币价格',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          data: [],
          itemStyle: {
            color: '#f7931a'
          },
          lineStyle: {
            width: 3,
            shadowColor: 'rgba(247, 147, 26, 0.5)',
            shadowBlur: 10
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                offset: 0, color: 'rgba(247, 147, 26, 0.5)'
              }, {
                offset: 1, color: 'rgba(247, 147, 26, 0.1)'
              }]
            }
          }
        }]
      }
      
      this.priceChart.setOption(option)
      
      // 响应式调整图表大小
      window.addEventListener('resize', () => {
        this.priceChart.resize()
      })
    },
    async fetchBitcoinPrices() {
      this.loading.prices = true
      
      try {
        // 从Binance API获取数据
        let limit = 30
        let interval = '1d'
        
        if (this.timeRange === '1d') {
          interval = '1h'
          limit = 24
        } else if (this.timeRange === '7d') {
          interval = '4h'
          limit = 42 // 7天 * 6个4小时时段
        } else if (this.timeRange === '30d') {
          interval = '1d'
          limit = 30
        }
        
        const response = await axios.get(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`)
        
        // 处理Binance返回的数据
        const prices = response.data.map(item => {
          const timestamp = item[0]
          const closePrice = parseFloat(item[4])
          const date = new Date(timestamp)
          
          // 根据时间范围格式化日期
          let formattedDate
          if (this.timeRange === '1d') {
            formattedDate = `${date.getHours()}:00`
          } else {
            formattedDate = date.toISOString().split('T')[0]
          }
          
          return {
            date: formattedDate,
            price: closePrice
          }
        })
        
        this.bitcoinPrices = prices
        
        // 更新价格图表
        const dates = prices.map(item => item.date)
        const priceValues = prices.map(item => item.price)
        
        this.priceChart.setOption({
          xAxis: {
            data: dates
          },
          series: [{
            data: priceValues
          }]
        })
        
      } catch (error) {
        console.error('获取比特币价格数据失败:', error)
        this.error = '获取价格数据失败，请稍后重试'
        // 使用模拟数据作为备选
        await this.$store.dispatch('fetchBitcoinPrices')
        const prices = this.$store.getters.bitcoinPrices
        
        if (prices && prices.length) {
          this.bitcoinPrices = prices
          const dates = prices.map(item => item.date)
          const priceValues = prices.map(item => item.price)
          
          this.priceChart.setOption({
            xAxis: {
              data: dates
            },
            series: [{
              data: priceValues
            }]
          })
        }
      } finally {
        this.loading.prices = false
      }
    },
    refreshData() {
      this.fetchBitcoinPrices()
      this.$message({
        message: '数据已刷新',
        type: 'success'
      })
    },
    changeTimeRange(range) {
      this.timeRange = range
      this.fetchBitcoinPrices()
    },
    formatTime(date) {
      const hours = date.getHours().toString().padStart(2, '0')
      const minutes = date.getMinutes().toString().padStart(2, '0')
      return `${hours}:${minutes}`
    },
    scrollChatToBottom(ref) {
      const element = this.$refs[ref];
      if (element) {
        // 使用setTimeout确保DOM更新后再滚动
        setTimeout(() => {
          element.scrollTop = element.scrollHeight;
        }, 100);
      }
    },
    async sendAiMessage() {
      if (!this.aiInputMessage.trim()) return
      
      // 添加用户消息
      this.aiMessages.push({
        role: 'user',
        content: this.aiInputMessage,
        time: this.formatTime(new Date())
      })
      
      // 清空输入框并滚动到底部
      const userMessage = this.aiInputMessage
      this.aiInputMessage = ''
      this.$nextTick(() => {
        this.scrollChatToBottom('chatMessages')
      })
      
      this.aiLoading = true
      
      // 显示一条等待消息
      const waitingMessageIndex = this.aiMessages.length;
      this.aiMessages.push({
        role: 'ai',
        content: '正在处理您的请求...',
        time: this.formatTime(new Date())
      });
      
      // 确保滚动到底部
      this.$nextTick(() => {
        this.scrollChatToBottom('chatMessages')
      });
      
      try {
        // 直接调用后端API
        console.log('发送请求到后端API:', userMessage);
        const response = await axios({
          method: 'post',
          url: '/api/chat',
          data: { message: userMessage },
          timeout: 30000
        });
        
        console.log('收到后端API响应:', response.data);
        
        // 更新等待消息
        if (response.data && response.data.response) {
          this.aiMessages[waitingMessageIndex] = {
            role: 'ai',
            content: response.data.response,
            time: this.formatTime(new Date())
          };
        } else {
          throw new Error('API响应格式不正确: ' + JSON.stringify(response.data));
        }
      } catch (error) {
        console.error('处理消息失败:', error);
        
        let errorMessage = '抱歉，处理您的请求时出现了问题。请稍后重试。';
        
        // 如果有API返回的错误信息，则使用它
        if (error.response && error.response.data) {
          const errorData = error.response.data;
          console.error('API错误响应:', errorData);
          
          if (errorData.error && errorData.message) {
            errorMessage = `抱歉，${errorData.error}: ${errorData.message}`;
          }
        }
        
        // 更新等待消息为错误信息
        this.aiMessages[waitingMessageIndex] = {
          role: 'ai',
          content: errorMessage,
          time: this.formatTime(new Date())
        };
      } finally {
        this.aiLoading = false;
        this.$nextTick(() => {
          this.scrollChatToBottom('chatMessages');
        });
      }
    },
    async sendPredictionRequest() {
      if (!this.predictionInputMessage.trim()) return
      
      // 添加用户消息
      this.predictionMessages.push({
        role: 'user',
        content: this.predictionInputMessage,
        time: this.formatTime(new Date())
      })
      
      // 清空输入框并滚动到底部
      const userMessage = this.predictionInputMessage
      this.predictionInputMessage = ''
      this.$nextTick(() => {
        this.scrollChatToBottom('predictionMessages')
      })
      
      this.predictionLoading = true
      
      // 显示一条等待消息
      const waitingMessageIndex = this.predictionMessages.length;
      this.predictionMessages.push({
        role: 'ai',
        content: '正在进行价格预测...',
        time: this.formatTime(new Date())
      });
      
      // 确保滚动到底部
      this.$nextTick(() => {
        this.scrollChatToBottom('predictionMessages')
      });
      
      try {
        // 直接调用后端的预测API
        console.log('发送预测请求到后端API:', userMessage);
        const response = await axios({
          method: 'post',
          url: '/api/predict',
          data: { message: userMessage },
          timeout: 60000
        });
        
        console.log('收到预测API响应:', response.data);
        
        // 更新等待消息
        if (response.data && response.data.response) {
          this.predictionMessages[waitingMessageIndex] = {
            role: 'ai',
            content: response.data.response,
            time: this.formatTime(new Date())
          };
        } else {
          throw new Error('预测API响应格式不正确: ' + JSON.stringify(response.data));
        }
      } catch (error) {
        console.error('预测请求失败:', error);
        
        let errorMessage = '抱歉，预测服务暂时不可用。请稍后重试。';
        
        // 如果有API返回的错误信息，则使用它
        if (error.response && error.response.data) {
          const errorData = error.response.data;
          console.error('API错误响应:', errorData);
          
          if (errorData.error && errorData.message) {
            errorMessage = `抱歉，${errorData.error}: ${errorData.message}`;
          }
        }
        
        // 更新等待消息为错误信息
        this.predictionMessages[waitingMessageIndex] = {
          role: 'ai',
          content: errorMessage,
          time: this.formatTime(new Date())
        };
      } finally {
        this.predictionLoading = false;
        this.$nextTick(() => {
          this.scrollChatToBottom('predictionMessages');
        });
      }
    },
    logout() {
      this.$store.dispatch('logout')
      this.$router.push('/')
    }
  }
}
</script>

<style scoped>
.dashboard-container {
  min-height: 100vh;
  background-color: #f5f7fa;
}

.header {
  background-color: #1e1e1e;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.logo {
  display: flex;
  align-items: center;
}

.bitcoin-logo {
  height: 30px;
  margin-right: 10px;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-info span {
  margin-right: 15px;
}

.main-content {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.chart-card {
  margin-bottom: 20px;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.price-chart {
  height: 350px;
  width: 100%;
}

.chat-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: 20px;
}

.chat-card {
  height: 500px;
  display: flex;
  flex-direction: column;
  min-height: 500px;
}

.chat-header {
  display: flex;
  align-items: center;
}

.chat-header i {
  margin-left: 8px;
  color: #909399;
  cursor: pointer;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 4px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  max-height: 350px;
}

.message {
  max-width: 80%;
  margin-bottom: 12px;
  padding: 10px;
  border-radius: 10px;
  position: relative;
}

.user-message {
  align-self: flex-end;
  background-color: #ecf5ff;
  border: 1px solid #d9ecff;
}

.ai-message {
  align-self: flex-start;
  background-color: #f4f4f5;
  border: 1px solid #e9e9eb;
}

.message-content {
  word-wrap: break-word;
  white-space: pre-line;
}

.message-time {
  font-size: 11px;
  color: #909399;
  margin-top: 4px;
  text-align: right;
}

.chat-input {
  margin-top: auto;
}

@media (max-width: 768px) {
  .chat-section {
    grid-template-columns: 1fr;
  }
}
</style> 