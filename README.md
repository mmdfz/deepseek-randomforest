# 比特币价格预测平台

这是一个基于机器学习模型的比特币价格预测平台，结合了实时价格数据和情感分析，提供比特币价格预测功能。

## 功能特点

- 实时显示比特币价格走势图表
- 获取最新加密货币新闻资讯
- 基于机器学习模型的价格预测
- 响应式设计，适配各种设备

## 技术栈

- **前端**：Vue.js, Element UI, ECharts
- **后端**：Express.js, Node.js
- **数据分析**：Python, Pandas, Scikit-learn
- **数据库**：MySQL
- **API**：Binance API, CryptoPanic API, DeepSeek API

## 安装和运行

### 前提条件

- Node.js (>= 12.x)
- npm 或 yarn
- Python 3.7+
- MySQL 数据库

### 安装步骤

1. 克隆仓库
```bash
git clone <仓库地址>
cd twitterpredict
```

2. 安装Node.js依赖
```bash
npm install
```

3. 安装Python依赖
```bash
pip install pandas numpy scikit-learn joblib requests python-dotenv
```

4. 配置数据库
```bash
# 创建MySQL数据库
mysql -u root -p
CREATE DATABASE kcsj;
USE kcsj;

# 运行SQL脚本创建表结构
mysql -u root -p kcsj < db_schema.sql
```

5. 添加图像资源
将比特币logo和icon图片添加到`frontend/src/assets`目录下，具体要求参见该目录的README.md文件。

6. 安装前端依赖并构建
```bash
cd frontend
npm install
npm run build
```

7. 启动服务器
```bash
npm server.js
```

服务器将在 http://localhost:3000 运行

### 开发模式

```bash
# 启动后端开发服务器（带热重载）
npm run dev

# 在另一个终端启动前端开发服务器
cd frontend
npm run serve
```

前端开发服务器将在 http://localhost:8080 运行

## 使用指南

1. 登录系统（可使用测试帐号：用户名 `user`，密码 `user123`）
2. 查看比特币价格走势图
3. 在"加密货币新闻助手"中询问最新的加密货币新闻
4. 在"价格预测"对话框中输入预测请求，例如"预测未来3天的比特币价格"

## 数据来源

- 价格数据：Binance API
- 新闻情感分析：CryptoPanic API + DeepSeek API
- 预测模型：基于历史价格和情感分析的随机森林模型

## 环境变量配置

所有API密钥和数据库配置都在`1.env`文件中，确保此文件包含以下配置：

```
# Binance API配置
BINANCE_API_KEY=你的Binance API密钥
BINANCE_API_SECRET=你的Binance API密钥

# DeepSeek API配置
OPENAI_API_KEY=你的DeepSeek API密钥
OPENAI_BASE_URL=https://api.deepseek.com

# CryptoPanic API配置
api-auth-token=你的CryptoPanic API密钥

# 数据库配置
database:mysql={
  host='localhost',
  user='root',
  password='你的MySQL密码',
  database='kcsj',
  port=3306,
  charset='utf8mb4'
}
``` 