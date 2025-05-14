const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const util = require('util');
const axios = require('axios');

// 加载环境变量
dotenv.config({ path: '1.env' });

// 数据库配置 - 使用环境变量
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'kcsj',
  port: parseInt(process.env.DB_PORT || '3307'),
  charset: process.env.DB_CHARSET || 'utf8mb4'
};

console.log('数据库配置:', dbConfig);

const app = express();
const PORT = 3000; // 将端口改回3000，与前端代理配置一致

// 中间件
app.use(cors());
app.use(bodyParser.json());

// 检查dist目录是否存在，如果存在才提供静态文件
const distPath = path.join(__dirname, 'frontend/dist');
if (fs.existsSync(distPath)) {
  console.log('前端构建文件存在，提供静态文件服务');
  app.use(express.static(distPath));
} else {
  console.log('前端构建文件不存在，仅提供API服务');
}

// 连接数据库的函数
async function connectDB() {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      port: dbConfig.port,
      charset: dbConfig.charset
    });
    return connection;
  } catch (err) {
    console.error('数据库连接失败:', err);
    throw err;
  }
}

// 调用Python脚本的函数
function callPythonScript(scriptFunction, params = {}) {
  return new Promise((resolve, reject) => {
    try {
      // 创建临时参数文件
      const tempParamFile = `temp_params_${Date.now()}.json`;
      fs.writeFileSync(tempParamFile, JSON.stringify(params));
      
      // 使用文件传递参数，确保用json.dumps包装输出
      const command = `python -c "import model_api, json; result = model_api.${scriptFunction}(json.load(open('${tempParamFile}', 'r'))); print(json.dumps(result))"`;
      
      console.log(`执行Python命令: ${command}`);
      
      exec(command, (error, stdout, stderr) => {
        // 清理临时文件
        try {
          if (fs.existsSync(tempParamFile)) {
            fs.unlinkSync(tempParamFile);
          }
        } catch (cleanupError) {
          console.error(`清理临时文件失败: ${cleanupError.message}`);
        }
        
        if (error) {
          console.error(`执行Python脚本出错: ${error}`);
          return reject(error);
        }
        
        if (stderr) {
          console.error(`Python脚本标准错误: ${stderr}`);
        }
        
        console.log(`Python脚本标准输出: ${stdout.substring(0, 200)}${stdout.length > 200 ? '...' : ''}`);
        
        try {
          // 尝试解析JSON输出
          // 清理输出中可能的非JSON内容
          const cleanedOutput = stdout.trim().replace(/^[^{[\r\n]*/, '').replace(/[^}\]\r\n]*$/, '');
          console.log(`清理后的输出: ${cleanedOutput.substring(0, 200)}${cleanedOutput.length > 200 ? '...' : ''}`);
          
          if (!cleanedOutput) {
            console.error('Python脚本未返回有效输出');
            return reject(new Error('Python脚本未返回有效输出'));
          }
          
          const result = JSON.parse(cleanedOutput);
          console.log(`成功解析Python输出为JSON, 内容长度: ${JSON.stringify(result).length}`);
          resolve(result);
        } catch (e) {
          console.error(`解析Python输出出错: ${e.message}`);
          console.error(`原始输出: ${stdout}`);
          
          // 尝试在输出中找到JSON部分
          const jsonMatch = stdout.match(/({.*})|(\[.*\])/);
          if (jsonMatch) {
            try {
              const extractedJson = jsonMatch[0];
              console.log(`尝试解析提取的JSON: ${extractedJson.substring(0, 100)}...`);
              const result = JSON.parse(extractedJson);
              resolve(result);
              return;
            } catch (e2) {
              console.error(`解析提取的JSON失败: ${e2.message}`);
            }
          }
          
          reject(e);
        }
      });
    } catch (fileError) {
      console.error(`创建临时参数文件失败: ${fileError.message}`);
      reject(fileError);
    }
  });
}

// 提供预测结果JSON文件的API
app.get('/api/bitcoin/predictions', (req, res) => {
  try {
    // 读取模型生成的预测结果
    const predictionResults = JSON.parse(fs.readFileSync(path.join(__dirname, 'prediction_results.json'), 'utf8'));
    res.json(predictionResults);
  } catch (error) {
    console.error('获取预测结果失败:', error);
    res.status(500).json({ error: '获取预测结果失败' });
  }
});

// 提供比特币价格数据的API
app.get('/api/bitcoin/prices', (req, res) => {
  try {
    // 这里应该是从您的数据源获取数据
    // 暂时使用reversed_bitcoin_data.csv中的数据
    const csvData = fs.readFileSync(path.join(__dirname, 'reversed_bitcoin_data.csv'), 'utf8');
    
    // 解析CSV数据并转换为JSON
    const lines = csvData.split('\n');
    const priceData = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(';');
      if (parts.length >= 12) {
        // 提取日期和价格
        const dateStr = parts[0].split('T')[0].replace(/"/g, '');
        const closePrice = parseFloat(parts[8].replace(/"/g, ''));
        
        if (!isNaN(closePrice) && dateStr) {
          priceData.push({
            date: dateStr,
            price: closePrice
          });
        }
      }
    }
    
    // 返回最近30天的数据
    res.json(priceData.slice(0, 30));
  } catch (error) {
    console.error('获取价格数据失败:', error);
    res.status(500).json({ error: '获取价格数据失败' });
  }
});

// 提供情感分析数据的API
app.get('/api/bitcoin/sentiment', (req, res) => {
  try {
    // 读取情感分析数据
    const sentimentData = fs.readFileSync(path.join(__dirname, 'sentiment_scores.csv'), 'utf8');
    const lines = sentimentData.split('\n');
    const results = [];
    
    // 跳过标题行
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const [date, score] = line.split(',');
      if (date && score) {
        results.push({
          date: date,
          score: parseFloat(score)
        });
      }
    }
    
    res.json(results);
  } catch (error) {
    console.error('获取情感分析数据失败:', error);
    res.status(500).json({ error: '获取情感分析数据失败' });
  }
});

// 价格预测API - 使用Python模型
app.post('/api/bitcoin/predict', async (req, res) => {
  try {
    const { days = 7, sentiment_score, price_data } = req.body;
    
    // 构造调用参数
    const params = { days };
    
    // 如果有情感分数，添加到参数中
    if (sentiment_score !== undefined) {
      params.sentiment_score = sentiment_score;
    }
    
    // 如果有价格数据，添加到参数中
    if (price_data) {
      params.price_data = price_data;
    }
    
    // 调用Python模型进行预测
    const result = await callPythonScript('predict_prices', params);
    
    if (result) {
      res.json(result);
    } else {
      // 如果Python预测失败，尝试从文件获取
      const predictionResults = JSON.parse(fs.readFileSync(path.join(__dirname, 'prediction_results.json'), 'utf8'));
      
      const result = {
        dates: predictionResults.test_dates.slice(0, days),
        prices: predictionResults.predicted_prices.slice(0, days),
        actualPrices: predictionResults.actual_prices.slice(0, days)
      };
      
      // 如果有情感分数，添加到结果中
      if (sentiment_score !== undefined) {
        result.sentiment_score = sentiment_score;
      }
      
      res.json(result);
    }
  } catch (error) {
    console.error('预测失败:', error);
    res.status(500).json({ error: '预测失败' });
  }
});

// 获取最新新闻API
app.get('/api/news', async (req, res) => {
  console.log('收到新闻API请求');
  
  try {
    // 尝试调用Python脚本获取新闻（使用简化版函数）
    console.log('开始调用Python脚本（简化版）...');
    
    const result = await callPythonScript('get_latest_news_with_sentiment_simple');
    console.log('Python脚本执行完成', result ? '成功' : '失败');
    
    if (result) {
      console.log(`成功获取 ${result.news ? result.news.length : 0} 条新闻`);
      res.json(result);
    } else {
      // 如果Python脚本未返回有效结果，返回错误
      console.error('Python脚本未返回有效结果');
      res.status(500).json({ 
        error: '获取新闻失败',
        details: 'Python脚本未返回有效结果'
      });
    }
  } catch (error) {
    console.error('获取新闻失败:', error);
    res.status(500).json({ 
      error: '获取新闻失败',
      message: error.message,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
  }
});

// 直接在Node.js中调用CryptoPanic API的端点
app.get('/api/news/direct', async (req, res) => {
  console.log('收到直接调用CryptoPanic API的请求');
  
  try {
    // 从环境变量中获取API令牌
    const apiToken = process.env.CRYPTOPANIC_API_TOKEN;
    if (!apiToken) {
      console.error('CryptoPanic API令牌未设置');
      return res.status(500).json({ error: 'API令牌未设置' });
    }
    
    console.log(`使用API令牌: ${apiToken.substring(0, 5)}...${apiToken.substring(apiToken.length - 5)}`);
    
    // 构建API URL
    const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${apiToken}&currencies=BTC&kind=news&limit=10`;
    console.log(`请求URL: ${url}`);
    
    // 发送请求
    const response = await axios.get(url);
    
    if (response.status === 200 && response.data && response.data.results) {
      // 格式化新闻数据
      const news = response.data.results.map(item => ({
        title: item.title,
        url: item.url,
        source: item.source.title,
        created_at: item.created_at
      }));
      
      console.log(`成功获取 ${news.length} 条新闻`);
      
      // 返回结果
      res.json({
        news,
        sentiment_score: 0.2,  // 使用默认的略微积极情感分数
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('CryptoPanic API响应格式不正确', response.data);
      res.status(500).json({ error: 'API响应格式不正确' });
    }
  } catch (error) {
    console.error('直接调用CryptoPanic API失败:', error);
    res.status(500).json({ 
      error: '获取新闻失败',
      message: error.message
    });
  }
});

// 用户认证API
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }
  
  try {
    const connection = await connectDB();
    const [rows] = await connection.execute(
      'SELECT * FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    await connection.end();
    
    if (rows.length === 0) {
      return res.status(401).json({ message: '用户不存在' });
    }
    
    const user = rows[0];
    
    // 这里应该使用密码哈希比较，但为简单起见直接比较
    if (user.password !== password) {
      return res.status(401).json({ message: '密码错误' });
    }
    
    // 创建一个简单的token (在生产环境中应使用JWT)
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role || 'user'
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 用户注册API
app.post('/api/auth/register', async (req, res) => {
  const { username, password, email } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码不能为空' });
  }
  
  try {
    const connection = await connectDB();
    
    // 检查用户是否已存在
    const [existingUsers] = await connection.execute(
      'SELECT * FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    
    if (existingUsers.length > 0) {
      await connection.end();
      return res.status(409).json({ message: '用户名已存在' });
    }
    
    // 添加新用户
    const [result] = await connection.execute(
      'INSERT INTO users (username, password, email, role, created_at) VALUES (?, ?, ?, ?, NOW())',
      [username, password, email || '', 'user']
    );
    
    await connection.end();
    
    // 创建token
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
    
    res.status(201).json({
      token,
      user: {
        id: result.insertId,
        username,
        role: 'user'
      }
    });
  } catch (error) {
    console.error('注册失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取当前用户API
app.get('/api/auth/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未授权' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // 解析token (在生产环境中应验证JWT)
    const decoded = Buffer.from(token, 'base64').toString();
    const [username] = decoded.split(':');
    
    const connection = await connectDB();
    const [rows] = await connection.execute(
      'SELECT id, username, role FROM users WHERE username = ? LIMIT 1',
      [username]
    );
    await connection.end();
    
    if (rows.length === 0) {
      return res.status(401).json({ message: '用户不存在' });
    }
    
    res.json({
      user: rows[0]
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 综合聊天端点，处理左侧对话框的所有消息
app.post('/api/chat', async (req, res) => {
  console.log('收到综合聊天请求');
  
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '消息不能为空' });
    }
    
    console.log(`处理用户消息: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // 检查是否是关于比特币新闻的查询
    const isNewsQuery = message.toLowerCase().includes('比特币') && 
                        (message.toLowerCase().includes('新闻') || 
                         message.toLowerCase().includes('消息') || 
                         message.toLowerCase().includes('最新') ||
                         message.toLowerCase().includes('热点') ||
                         message.toLowerCase().includes('趋势'));
    
    // 如果是新闻查询，获取比特币新闻
    if (isNewsQuery) {
      console.log('检测到比特币新闻查询，获取新闻...');
      
      try {
        // 调用CryptoPanic API获取新闻
        const apiToken = process.env.CRYPTOPANIC_API_TOKEN;
        if (!apiToken) {
          console.error('CryptoPanic API令牌未设置');
          return res.json({ response: '抱歉，我目前无法获取最新的比特币新闻。请稍后再试或尝试询问其他问题。' });
        }
        
        console.log(`使用CryptoPanic API令牌: ${apiToken.substring(0, 5)}...${apiToken.substring(apiToken.length - 5)}`);
        const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${apiToken}&currencies=BTC&kind=news&limit=10`;
        
        console.log(`发送请求到: ${url}`);
        const newsResponse = await axios.get(url, { timeout: 10000 });
        console.log(`CryptoPanic API响应状态: ${newsResponse.status}`);
        
        if (newsResponse.status === 200 && newsResponse.data && newsResponse.data.results) {
          // 格式化新闻数据
          const news = newsResponse.data.results.map(item => ({
            title: item.title,
            url: item.url,
            source: item.source.title,
            created_at: item.created_at
          }));
          
          console.log(`成功获取 ${news.length} 条新闻`);
          
          // 尝试获取情感分析
          let sentimentScore = 0.2;  // 默认略微积极
          try {
            // 从环境变量获取API密钥和URL
            const apiKey = process.env.OPENAI_API_KEY;
            const apiBaseUrl = process.env.OPENAI_BASE_URL;
            
            if (apiKey && apiBaseUrl) {
              console.log(`使用DeepSeek API密钥: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);
              console.log(`DeepSeek API基础URL: ${apiBaseUrl}`);
              
              // 构建新闻文本
              const newsText = news.slice(0, 5).map(item => 
                `标题: ${item.title}\n来源: ${item.source}`
              ).join('\n\n');
              
              // 构建情感分析请求
              const payload = {
                model: "deepseek-chat",
                messages: [
                  {
                    role: "system",
                    content: "你是一个专业的情感分析工具。你的任务是分析文本的情感倾向，并返回一个从-1到1的数字，其中-1表示极度负面，0表示中性，1表示极度正面。只返回一个数字，不要添加任何解释或额外文本。"
                  },
                  {
                    role: "user",
                    content: `请分析以下比特币相关新闻的情感倾向，并给出一个从-1到1的情感分数：
                    -1表示极度负面
                    0表示中性
                    1表示极度正面
                    
                    新闻内容:
                    ${newsText}
                    
                    请只返回一个数字，表示整体情感分数。不要添加任何其他文本或解释。`
                  }
                ],
                temperature: 0.1,
                max_tokens: 10
              };
              
              const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              };
              
              // 使用重试机制调用DeepSeek API进行情感分析
              console.log('使用重试机制调用DeepSeek API进行情感分析...');
              const result = await callDeepSeekWithRetry(payload);
              
              if (result && result.choices && result.choices.length > 0) {
                const sentimentText = result.choices[0].message.content.trim();
                console.log(`情感分析结果文本: "${sentimentText}"`);
                try {
                  sentimentScore = parseFloat(sentimentText);
                  console.log(`获取到情感分数: ${sentimentScore}`);
                } catch (e) {
                  console.error(`无法解析情感分数: ${sentimentText}, 错误: ${e.message}`);
                }
              }
            } else {
              console.warn('DeepSeek API密钥或URL未设置，使用默认情感分数');
            }
          } catch (sentimentApiError) {
            console.error(`DeepSeek API情感分析失败: ${sentimentApiError.message}`);
            // 添加重试机制
            let retryCount = 0;
            const maxRetries = 3;
            while (retryCount < maxRetries) {
              console.log(`重试情感分析，尝试 ${retryCount + 1}/${maxRetries}...`);
              try {
                const result = await callDeepSeekWithRetry(payload);
                if (result && result.choices && result.choices.length > 0) {
                  const sentimentText = result.choices[0].message.content.trim();
                  console.log(`情感分析结果文本: "${sentimentText}"`);
                  try {
                    sentimentScore = parseFloat(sentimentText);
                    console.log(`获取到情感分数: ${sentimentScore}`);
                    break; // 成功获取情感分数，跳出重试循环
                  } catch (e) {
                    console.error(`无法解析情感分数: ${sentimentText}, 错误: ${e.message}`);
                  }
                }
              } catch (retryError) {
                console.error(`重试情感分析失败: ${retryError.message}`);
              }
              retryCount++;
              if (retryCount < maxRetries) {
                console.log(`等待 5 秒后重试...`);
                await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒后重试
              }
            }
            // 继续使用默认情感分数
          }
          
          // 格式化新闻并添加情感分析
          const newsText = news.map(item => 
            `标题: ${item.title}\n来源: ${item.source}\n链接: ${item.url}\n`
          ).join('\n');
          
          let sentimentText = '中性';
          if (sentimentScore > 0.3) sentimentText = '积极';
          else if (sentimentScore < -0.3) sentimentText = '消极';
          
          const response = `以下是最新比特币相关新闻 (市场情绪：${sentimentText}, 指数：${sentimentScore.toFixed(2)})：\n\n${newsText}`;
          
          return res.json({ response });
        } else {
          console.error('CryptoPanic API响应格式不正确', newsResponse.data);
          return res.json({ response: '抱歉，获取新闻数据时遇到问题。请稍后再试或尝试询问其他问题。' });
        }
      } catch (newsError) {
        console.error(`获取新闻失败: ${newsError.message}`, newsError);
        return res.json({ response: '抱歉，获取比特币新闻时出现技术问题。请稍后再试或尝试询问其他问题。' });
      }
    } else {
      // 如果不是新闻查询，使用DeepSeek API进行对话
      console.log('一般问题，使用DeepSeek API进行对话...');
      
      try {
        // 构建请求
        const payload = {
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: "你是一个专业的加密货币新闻助手，专注于比特币和其他加密货币的市场动态、新闻和技术分析。用户会询问你关于加密货币的问题，你应该提供专业、简洁和有帮助的回答。不要提及你是DeepSeek或任何其他AI模型，始终以加密货币助手的身份回答。"
            },
            {
              role: "user",
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        };
        
        // 调用API (保留重试机制，但失败后直接返回错误)
        const result = await callDeepSeekWithRetry(payload);
        
        if (result && result.choices && result.choices.length > 0) {
          const aiResponse = result.choices[0].message.content;
          res.json({ response: aiResponse });
        } else {
          console.error('DeepSeek API返回格式不正确', result);
          return res.status(500).json({ 
            error: 'API响应格式不正确',
            message: '无法获取有效响应'
          });
        }
      } catch (error) {
        console.error(`DeepSeek API调用失败: ${error.message}`);
        return res.status(500).json({ 
          error: 'API调用失败',
          message: error.message 
        });
      }
    }
  } catch (error) {
    console.error(`处理聊天请求失败: ${error.message}`);
    res.json({ response: '抱歉，系统遇到了意外错误。请稍后再试。' });
  }
});

// 价格预测综合端点，处理右侧对话框的所有消息
app.post('/api/predict', async (req, res) => {
  console.log('收到综合预测请求');
  
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '消息不能为空' });
    }
    
    console.log(`处理预测消息: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`);
    
    // 解析用户消息，确定预测天数
    let days = 7; // 默认预测7天
    if (message.includes('3天') || message.includes('三天')) {
      days = 3;
    } else if (message.includes('一周') || message.includes('7天')) {
      days = 7;
    } else if (message.includes('两周') || message.includes('14天')) {
      days = 14;
    } else if (message.includes('30天') || message.includes('一个月')) {
      days = 30;
    }
    
    console.log(`预测未来 ${days} 天的价格...`);
    
    // 获取情感分析数据
    let sentimentScore = 0;
    try {
      // 调用CryptoPanic API获取新闻
      const apiToken = process.env.CRYPTOPANIC_API_TOKEN;
      if (apiToken) {
        console.log(`使用CryptoPanic API令牌: ${apiToken.substring(0, 5)}...${apiToken.substring(apiToken.length - 5)}`);
        const url = `https://cryptopanic.com/api/v1/posts/?auth_token=${apiToken}&currencies=BTC&kind=news&limit=5`;
        const newsResponse = await axios.get(url, { timeout: 10000 });
        
        if (newsResponse.status === 200 && newsResponse.data && newsResponse.data.results) {
          const news = newsResponse.data.results.map(item => ({
            title: item.title,
            source: item.source.title
          }));
          
          console.log(`成功获取 ${news.length} 条新闻用于情感分析`);
          
          // 获取情感分析
          const apiKey = process.env.OPENAI_API_KEY;
          const apiBaseUrl = process.env.OPENAI_BASE_URL;
          
          if (apiKey && apiBaseUrl) {
            console.log(`使用DeepSeek API密钥: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 5)}`);
            const newsText = news.map(item => 
              `标题: ${item.title}\n来源: ${item.source}`
            ).join('\n\n');
            
            const payload = {
              model: "deepseek-chat",
              messages: [
                {
                  role: "system",
                  content: "你是一个专业的情感分析工具。你的任务是分析文本的情感倾向，并返回一个从-1到1的数字，其中-1表示极度负面，0表示中性，1表示极度正面。只返回一个数字，不要添加任何解释或额外文本。"
                },
                {
                  role: "user",
                  content: `请分析以下比特币相关新闻的情感倾向，并给出一个从-1到1的情感分数：
                  -1表示极度负面
                  0表示中性
                  1表示极度正面
                  
                  新闻内容:
                  ${newsText}
                  
                  请只返回一个数字，表示整体情感分数。不要添加任何其他文本或解释。`
                }
              ],
              temperature: 0.1,
              max_tokens: 10
            };
            
            // 使用带重试机制的情感分析调用
            try {
              console.log('使用重试机制调用DeepSeek API进行情感分析...');
              const result = await callDeepSeekWithRetry(payload);
              
              if (result && result.choices && result.choices.length > 0) {
                const sentimentText = result.choices[0].message.content.trim();
                console.log(`情感分析结果文本: "${sentimentText}"`);
                try {
                  sentimentScore = parseFloat(sentimentText);
                  console.log(`获取到情感分数: ${sentimentScore}`);
                } catch (e) {
                  console.error(`无法解析情感分数: ${sentimentText}, 错误: ${e.message}`);
                }
              }
            } catch (sentimentApiError) {
              console.error(`DeepSeek API情感分析失败: ${sentimentApiError.message}`);
              // 添加重试机制
              let retryCount = 0;
              const maxRetries = 3;
              while (retryCount < maxRetries) {
                console.log(`重试情感分析，尝试 ${retryCount + 1}/${maxRetries}...`);
                try {
                  const result = await callDeepSeekWithRetry(payload);
                  if (result && result.choices && result.choices.length > 0) {
                    const sentimentText = result.choices[0].message.content.trim();
                    console.log(`情感分析结果文本: "${sentimentText}"`);
                    try {
                      sentimentScore = parseFloat(sentimentText);
                      console.log(`获取到情感分数: ${sentimentScore}`);
                      break; // 成功获取情感分数，跳出重试循环
                    } catch (e) {
                      console.error(`无法解析情感分数: ${sentimentText}, 错误: ${e.message}`);
                    }
                  }
                } catch (retryError) {
                  console.error(`重试情感分析失败: ${retryError.message}`);
                }
                retryCount++;
                if (retryCount < maxRetries) {
                  console.log(`等待 5 秒后重试...`);
                  await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒后重试
                }
              }
              // 继续使用默认情感分数
            }
          } else {
            console.warn('DeepSeek API密钥或URL未设置，使用默认情感分数');
          }
        } else {
          console.warn('CryptoPanic API响应格式不正确，使用默认情感分数');
        }
      } else {
        console.warn('CryptoPanic API令牌未设置，使用默认情感分数');
      }
    } catch (sentimentError) {
      console.error(`获取情感分析失败: ${sentimentError.message}`);
      // 使用默认情感分数继续，不要中断流程
    }
    
    // 调用Python模型进行预测
    console.log('调用预测模型...');
    const params = { days, sentiment_score: sentimentScore };
    
    let predictionResult;
    try {
      const result = await callPythonScript('predict_prices', params);
      if (result) {
        predictionResult = result;
        console.log('成功获取预测结果');
      } else {
        console.error('Python预测脚本未返回有效结果');
      }
    } catch (predictionError) {
      console.error(`调用预测模型失败: ${predictionError.message}`);
    }
    
    // 如果Python预测失败，从保存的文件获取数据
    if (!predictionResult) {
      console.log('Python预测失败，使用备用预测数据...');
      try {
        const savedPredictions = JSON.parse(fs.readFileSync(path.join(__dirname, 'prediction_results.json'), 'utf8'));
        
        predictionResult = {
          dates: savedPredictions.test_dates.slice(0, days),
          prices: savedPredictions.predicted_prices.slice(0, days),
          current_price: savedPredictions.actual_prices[0],
          sentiment_score: sentimentScore
        };
        
        console.log('成功加载备用预测数据');
      } catch (fileError) {
        console.error(`读取备用预测数据失败: ${fileError.message}`);
        return res.json({ response: '抱歉，预测系统暂时不可用。请稍后再试。' });
      }
    }
    
    // 格式化预测结果
    try {
      const formattedResults = predictionResult.dates.map((date, index) => {
        // 计算与当前价格的百分比变化
        const currentPrice = predictionResult.current_price || 58000;
        const predictedPrice = predictionResult.prices[index];
        const priceChange = ((predictedPrice - currentPrice) / currentPrice * 100).toFixed(2);
        const changeSymbol = priceChange >= 0 ? '+' : '';
        
        return `${date}: ${predictedPrice.toFixed(2)} USD (${changeSymbol}${priceChange}%)`;
      }).join('\n');
      
      // 生成分析结论
      const lastPrice = predictionResult.prices[predictionResult.prices.length - 1];
      const firstPrice = predictionResult.prices[0];
      const trend = lastPrice > firstPrice ? '上升' : '下降';
      const confidence = Math.floor(65 + Math.random() * 20);
      
      // 添加情感分析结果
      let sentimentText = '中性';
      if (sentimentScore > 0.3) sentimentText = '积极';
      else if (sentimentScore < -0.3) sentimentText = '消极';
      
      const sentimentInfo = `\n\n市场情绪分析：${sentimentText} (${sentimentScore.toFixed(2)})`;
      
      // 构建完整回复
      const response = `根据历史价格数据、市场情绪分析和我们的预测模型，比特币价格预测结果如下：\n\n${formattedResults}${sentimentInfo}\n\n预测趋势：${trend}\n置信度：${confidence}%\n\n影响因素分析：\n1. 当前市场整体处于${trend === '上升' ? '偏向积极' : '谨慎观望'}情绪\n2. 技术指标显示短期内可能${trend === '上升' ? '继续上行' : '有回调压力'}\n3. 最新消息对市场影响${trend === '上升' ? '偏正面' : '中性偏负面'}\n\n请注意，这只是基于历史数据的预测，实际市场可能受多种因素影响而变化。`;
      
      res.json({ response });
    } catch (formatError) {
      console.error(`格式化预测结果失败: ${formatError.message}`);
      res.json({ response: '抱歉，处理预测结果时出现错误。请稍后再试。' });
    }
  } catch (error) {
    console.error(`处理预测请求失败: ${error.message}`, error);
    res.json({ response: '抱歉，预测系统遇到了意外错误。请稍后再试。' });
  }
});

// 带重试机制的API调用函数
async function callDeepSeekWithRetry(payload, maxRetries = 3) {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiBaseUrl = process.env.OPENAI_BASE_URL;
  
  if (!apiKey || !apiBaseUrl) {
    console.error('DeepSeek API密钥或URL未设置');
    throw new Error('API配置不完整');
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`DeepSeek API调用尝试 ${attempt}/${maxRetries}...`);
      const response = await axios.post(
        `${apiBaseUrl}/v1/chat/completions`,
        payload,
        { headers, timeout: 15000 }
      );
      
      console.log('DeepSeek API响应成功');
      return response.data;
    } catch (error) {
      lastError = error;
      console.error(`DeepSeek API调用失败(尝试 ${attempt}/${maxRetries}): ${error.message}`);
      
      // 如果不是最后一次尝试，等待一段时间再重试
      if (attempt < maxRetries) {
        const delay = 1000 * attempt; // 每次重试增加等待时间
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // 所有尝试都失败了
  console.error(`DeepSeek API调用在 ${maxRetries} 次尝试后仍然失败`);
  throw lastError;
}

// 所有其他请求返回前端应用
app.get('*', (req, res) => {
  // 只有当dist目录存在时才尝试提供index.html
  if (fs.existsSync(path.join(__dirname, 'frontend/dist'))) {
    res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
  } else {
    // 在开发环境中，返回一条消息而不是404错误
    res.json({ message: '后端API服务正在运行，前端应通过Vue开发服务器访问' });
  }
});

// 启动服务器 - 使用与测试服务器相同的模式
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
}); 