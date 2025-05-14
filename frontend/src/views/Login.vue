<template>
  <div class="login-container">
    <div id="particles-js" class="particles-container"></div>
    <div class="login-card">
      <div class="login-header">
        <img src="../assets/bitcoin-logo.png" alt="比特币标志" class="bitcoin-logo">
        <h2>比特币价格预测平台</h2>
      </div>
      <el-form :model="loginForm" :rules="rules" ref="loginForm" label-width="0px" class="login-form">
        <el-form-item prop="username">
          <el-input prefix-icon="el-icon-user" v-model="loginForm.username" placeholder="用户名"></el-input>
        </el-form-item>
        <el-form-item prop="password">
          <el-input prefix-icon="el-icon-lock" v-model="loginForm.password" type="password" placeholder="密码" @keyup.enter.native="handleLogin"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" class="login-button pulse" @click="handleLogin">登录</el-button>
        </el-form-item>
        <div class="register-link">
          还没有账号？<router-link to="/register">立即注册</router-link>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script>
import 'particles.js'

export default {
  name: 'Login',
  data() {
    return {
      loginForm: {
        username: '',
        password: ''
      },
      rules: {
        username: [
          { required: true, message: '请输入用户名', trigger: 'blur' }
        ],
        password: [
          { required: true, message: '请输入密码', trigger: 'blur' }
        ]
      },
      loading: false
    }
  },
  mounted() {
    this.initParticles()
  },
  methods: {
    initParticles() {
      window.particlesJS('particles-js', {
        particles: {
          number: {
            value: 60,
            density: {
              enable: true,
              value_area: 800
            }
          },
          color: {
            value: '#f7931a'  // 比特币标志色
          },
          shape: {
            type: ['circle', 'image'],
            image: {
              src: require('../assets/bitcoin-icon.png'),
              width: 100,
              height: 100
            }
          },
          opacity: {
            value: 0.7,
            random: true
          },
          size: {
            value: 15,
            random: true
          },
          line_linked: {
            enable: true,
            distance: 150,
            color: '#f7931a',
            opacity: 0.4,
            width: 1
          },
          move: {
            enable: true,
            speed: 3,
            direction: 'none',
            random: false,
            straight: false,
            out_mode: 'out',
            bounce: false
          }
        },
        interactivity: {
          detect_on: 'canvas',
          events: {
            onhover: {
              enable: true,
              mode: 'grab'
            },
            onclick: {
              enable: true,
              mode: 'push'
            },
            resize: true
          },
          modes: {
            grab: {
              distance: 140,
              line_linked: {
                opacity: 1
              }
            },
            push: {
              particles_nb: 4
            }
          }
        },
        retina_detect: true
      })
    },
    handleLogin() {
      this.$refs.loginForm.validate(valid => {
        if (valid) {
          this.loading = true
          
          // 调用真实的登录API
          this.$store.dispatch('login', {
            username: this.loginForm.username,
            password: this.loginForm.password
          })
          .then(() => {
            this.$router.push('/dashboard')
          })
          .catch(error => {
            let errorMessage = '登录失败，请稍后重试';
            if (error.response && error.response.data && error.response.data.message) {
              errorMessage = error.response.data.message;
            }
            this.$message.error(errorMessage);
          })
          .finally(() => {
            this.loading = false;
          });
        }
      })
    }
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  background: linear-gradient(135deg, #121212 0%, #2d2d2d 100%);
  overflow: hidden;
}

.particles-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.login-card {
  position: relative;
  z-index: 2;
  width: 400px;
  padding: 40px;
  border-radius: 15px;
  background-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.bitcoin-logo {
  width: 80px;
  animation: float 3s ease-in-out infinite;
}

.login-form {
  margin-top: 20px;
}

.login-button {
  width: 100%;
  margin-top: 10px;
  height: 45px;
  border-radius: 22px;
  font-size: 16px;
  background: linear-gradient(45deg, #f7931a, #ffb74d);
  border: none;
  transition: all 0.3s ease;
}

.login-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 7px 14px rgba(247, 147, 26, 0.3);
}

.register-link {
  text-align: center;
  margin-top: 15px;
  font-size: 14px;
}

@keyframes float {
  0% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
  100% {
    transform: translateY(0px);
  }
}

.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(247, 147, 26, 0.7);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(247, 147, 26, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(247, 147, 26, 0);
  }
}
</style> 