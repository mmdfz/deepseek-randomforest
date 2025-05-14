<template>
  <div class="register-container">
    <div id="particles-js" class="particles-container"></div>
    <div class="register-card">
      <div class="register-header">
        <img src="../assets/bitcoin-logo.png" alt="比特币标志" class="bitcoin-logo">
        <h2>注册新账号</h2>
      </div>
      <el-form :model="registerForm" :rules="rules" ref="registerForm" label-width="0px" class="register-form">
        <el-form-item prop="username">
          <el-input prefix-icon="el-icon-user" v-model="registerForm.username" placeholder="用户名"></el-input>
        </el-form-item>
        <el-form-item prop="password">
          <el-input prefix-icon="el-icon-lock" v-model="registerForm.password" type="password" placeholder="密码"></el-input>
        </el-form-item>
        <el-form-item prop="confirmPassword">
          <el-input prefix-icon="el-icon-lock" v-model="registerForm.confirmPassword" type="password" placeholder="确认密码"></el-input>
        </el-form-item>
        <el-form-item prop="email">
          <el-input prefix-icon="el-icon-message" v-model="registerForm.email" placeholder="电子邮箱"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" class="register-button coin-flip" @click="handleRegister">注册</el-button>
        </el-form-item>
        <div class="login-link">
          已有账号？<router-link to="/">立即登录</router-link>
        </div>
      </el-form>
    </div>
  </div>
</template>

<script>
import 'particles.js'

export default {
  name: 'Register',
  data() {
    // 密码一致性验证
    const validatePass = (rule, value, callback) => {
      if (value !== this.registerForm.password) {
        callback(new Error('两次输入密码不一致'))
      } else {
        callback()
      }
    }
    return {
      registerForm: {
        username: '',
        password: '',
        confirmPassword: '',
        email: ''
      },
      rules: {
        username: [
          { required: true, message: '请输入用户名', trigger: 'blur' },
          { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
        ],
        password: [
          { required: true, message: '请输入密码', trigger: 'blur' },
          { min: 6, message: '密码长度不能小于6个字符', trigger: 'blur' }
        ],
        confirmPassword: [
          { required: true, message: '请再次输入密码', trigger: 'blur' },
          { validator: validatePass, trigger: 'blur' }
        ],
        email: [
          { required: true, message: '请输入邮箱地址', trigger: 'blur' },
          { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
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
    handleRegister() {
      this.$refs.registerForm.validate(valid => {
        if (valid) {
          this.loading = true
          
          // 调用真实的注册API
          this.$store.dispatch('register', {
            username: this.registerForm.username,
            password: this.registerForm.password,
            email: this.registerForm.email
          })
          .then(() => {
            this.$message.success('注册成功，即将跳转到仪表盘')
            setTimeout(() => {
              this.$router.push('/dashboard')
            }, 1500)
          })
          .catch(error => {
            let errorMessage = '注册失败，请稍后重试'
            if (error.response && error.response.data && error.response.data.message) {
              errorMessage = error.response.data.message
            }
            this.$message.error(errorMessage)
          })
          .finally(() => {
            this.loading = false
          })
        }
      })
    }
  }
}
</script>

<style scoped>
.register-container {
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

.register-card {
  position: relative;
  z-index: 2;
  width: 400px;
  padding: 40px;
  border-radius: 15px;
  background-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
}

.register-header {
  text-align: center;
  margin-bottom: 20px;
}

.bitcoin-logo {
  width: 80px;
  animation: float 3s ease-in-out infinite;
}

.register-form {
  margin-top: 20px;
}

.register-button {
  width: 100%;
  margin-top: 10px;
  height: 45px;
  border-radius: 22px;
  font-size: 16px;
  background: linear-gradient(45deg, #f7931a, #ffb74d);
  border: none;
  transition: all 0.3s ease;
}

.register-button:hover {
  transform: translateY(-3px);
  box-shadow: 0 7px 14px rgba(247, 147, 26, 0.3);
}

.login-link {
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

.coin-flip {
  perspective: 1000px;
}

.coin-flip:active {
  animation: flip 0.4s ease-in-out;
}

@keyframes flip {
  0% {
    transform: rotateY(0);
  }
  50% {
    transform: rotateY(180deg);
  }
  100% {
    transform: rotateY(360deg);
  }
}
</style> 