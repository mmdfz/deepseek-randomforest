import Vue from 'vue'
import Vuex from 'vuex'
import api from '../utils/api'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    user: null,
    token: localStorage.getItem('token') || null,
    bitcoinPrices: [],
    sentimentScores: [],
    predictionResults: null,
    loading: {
      prices: false,
      sentiment: false,
      prediction: false
    },
    error: null
  },
  mutations: {
    setUser(state, user) {
      state.user = user
    },
    setToken(state, token) {
      state.token = token
      localStorage.setItem('token', token)
    },
    clearUserData(state) {
      state.user = null
      state.token = null
      localStorage.removeItem('token')
    },
    setBitcoinPrices(state, prices) {
      state.bitcoinPrices = prices
    },
    setSentimentScores(state, scores) {
      state.sentimentScores = scores
    },
    setPredictionResults(state, results) {
      state.predictionResults = results
    },
    setLoading(state, { type, status }) {
      state.loading[type] = status
    },
    setError(state, error) {
      state.error = error
    },
    clearError(state) {
      state.error = null
    }
  },
  actions: {
    async login({ commit }, credentials) {
      try {
        const response = await api.user.login(credentials)
        const { token, user } = response.data
        commit('setToken', token)
        commit('setUser', user)
        return user
      } catch (error) {
        commit('setError', error.response ? error.response.data.message : '登录失败')
        throw error
      }
    },
    logout({ commit }) {
      commit('clearUserData')
    },
    async register({ commit }, userData) {
      try {
        const response = await api.user.register(userData)
        const { token, user } = response.data
        commit('setToken', token)
        commit('setUser', user)
        return user
      } catch (error) {
        commit('setError', error.response ? error.response.data.message : '注册失败')
        throw error
      }
    },
    async fetchBitcoinPrices({ commit }) {
      commit('setLoading', { type: 'prices', status: true })
      commit('clearError')
      
      try {
        // 首先尝试从后端API获取数据
        const response = await api.bitcoin.getPrices()
        const priceData = response.data
        
        commit('setBitcoinPrices', priceData)
        commit('setLoading', { type: 'prices', status: false })
        return priceData
      } catch (error) {
        console.error('获取比特币价格数据失败:', error)
        
        // 如果API调用失败，使用模拟数据（开发阶段使用）
        const mockPrices = [
          { date: '2023-05-07', price: 28500 },
          { date: '2023-05-08', price: 29200 },
          { date: '2023-05-09', price: 29800 },
          { date: '2023-05-10', price: 28900 },
          { date: '2023-05-11', price: 30200 },
          { date: '2023-05-12', price: 31500 },
          { date: '2023-05-13', price: 30800 }
        ]
        
        commit('setBitcoinPrices', mockPrices)
        commit('setLoading', { type: 'prices', status: false })
        commit('setError', '获取实时价格数据失败，显示的是模拟数据')
        return mockPrices
      }
    },
    async fetchSentimentScores({ commit }) {
      commit('setLoading', { type: 'sentiment', status: true })
      commit('clearError')
      
      try {
        const response = await api.bitcoin.getSentimentScores()
        const sentimentData = response.data
        
        commit('setSentimentScores', sentimentData)
        commit('setLoading', { type: 'sentiment', status: false })
        return sentimentData
      } catch (error) {
        console.error('获取情感分析数据失败:', error)
        commit('setLoading', { type: 'sentiment', status: false })
        commit('setError', '获取情感分析数据失败')
        throw error
      }
    },
    async getPrediction({ commit }, params) {
      commit('setLoading', { type: 'prediction', status: true })
      commit('clearError')
      
      try {
        const response = await api.bitcoin.getPrediction(params)
        const predictionData = response.data
        
        commit('setPredictionResults', predictionData)
        commit('setLoading', { type: 'prediction', status: false })
        return predictionData
      } catch (error) {
        console.error('获取预测数据失败:', error)
        commit('setLoading', { type: 'prediction', status: false })
        commit('setError', '获取预测数据失败')
        throw error
      }
    }
  },
  getters: {
    isLoggedIn: state => !!state.token,
    currentUser: state => state.user,
    bitcoinPrices: state => state.bitcoinPrices,
    sentimentScores: state => state.sentimentScores,
    predictionResults: state => state.predictionResults,
    isLoading: state => type => state.loading[type],
    error: state => state.error
  }
}) 