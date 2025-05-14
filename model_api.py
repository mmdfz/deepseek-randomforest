import os
import json
import pandas as pd
import numpy as np
import requests
import joblib
from datetime import datetime, timedelta
from dotenv import load_dotenv
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('api_model.log'),
        logging.StreamHandler()
    ]
)

# 加载环境变量
load_dotenv('1.env')

# API配置
# 从环境变量中获取API令牌，处理特殊格式
def get_env_value(key):
    try:
        with open('1.env', 'r') as file:
            for line in file:
                if line.strip().startswith(key):
                    parts = line.strip().split(':', 1)
                    if len(parts) > 1:
                        value = parts[1].strip()
                        logging.info(f"读取环境变量 {key}: {value}")
                        return value
        logging.error(f"在环境文件中未找到 {key}")
        return None
    except Exception as e:
        logging.error(f"读取环境变量失败: {str(e)}")
        return None

# 直接从1.env文件中读取API令牌
CRYPTOPANIC_API_TOKEN = os.getenv('CRYPTOPANIC_API_TOKEN')
logging.info(f"CryptoPanic API令牌: {CRYPTOPANIC_API_TOKEN}")
DEEPSEEK_API_KEY = os.getenv('OPENAI_API_KEY')
DEEPSEEK_BASE_URL = os.getenv('OPENAI_BASE_URL')

# 模型和数据路径
MODEL_PATH = 'models/crypto_model.joblib'
SCALER_PATH = 'price_scaler.joblib'
PRICE_DATA_PATH = 'reversed_bitcoin_data.csv'
SENTIMENT_DATA_PATH = 'sentiment_scores.csv'

def load_model_and_scaler():
    """加载模型和数据标准化器"""
    try:
        # 检查模型文件是否存在
        if not os.path.exists(MODEL_PATH):
            logging.error(f"模型文件不存在: {MODEL_PATH}")
            return None, None
            
        if not os.path.exists(SCALER_PATH):
            logging.error(f"标准化器文件不存在: {SCALER_PATH}")
            return None, None
            
        logging.info(f"加载模型文件: {MODEL_PATH}")
        model = joblib.load(MODEL_PATH)
        logging.info(f"加载标准化器文件: {SCALER_PATH}")
        scaler = joblib.load(SCALER_PATH)
        logging.info("模型和标准化器加载成功")
        return model, scaler
    except Exception as e:
        logging.error(f"加载模型或标准化器失败: {str(e)}")
        return None, None

def load_price_data():
    """加载价格数据"""
    try:
        # 读取价格数据
        price_raw = pd.read_csv(PRICE_DATA_PATH, header=None, names=['raw_data'])
        price_df = pd.DataFrame()
        
        # 定义列名
        cols = ['timeOpen', 'timeClose', 'timeHigh', 'timeLow', 'name', 
                'open', 'high', 'low', 'close', 'volume', 'marketCap', 'timestamp']
        
        # 拆分每一行
        price_raw['raw_data'] = price_raw['raw_data'].str.strip('"')
        for i, col in enumerate(cols):
            price_df[col] = price_raw['raw_data'].str.split(';').str[i]
            
            # 对于数值列，确保是浮点数
            if col in ['open', 'high', 'low', 'close', 'volume', 'marketCap']:
                price_df[col] = pd.to_numeric(price_df[col], errors='coerce')
        
        # 提取日期
        price_df['Date'] = pd.to_datetime(price_df['timeOpen'].str.split('T').str[0]).dt.date
        price_df.set_index('Date', inplace=True)
        
        return price_df
    except Exception as e:
        logging.error(f"加载价格数据失败: {str(e)}")
        return None

def load_sentiment_data():
    """加载情感分析数据"""
    try:
        # 读取情感数据
        sentiment_df = pd.read_csv(SENTIMENT_DATA_PATH, header=None, names=['date', 'sentiment_score'])
        sentiment_df['Date'] = pd.to_datetime(sentiment_df['date']).dt.date
        sentiment_df.set_index('Date', inplace=True)
        return sentiment_df
    except Exception as e:
        logging.error(f"加载情感数据失败: {str(e)}")
        return None

def get_cryptopanic_news(limit=10):
    """获取CryptoPanic最新新闻"""
    try:
        if not CRYPTOPANIC_API_TOKEN:
            logging.error("CryptoPanic API令牌未设置")
            return []
            
        url = f"https://cryptopanic.com/api/v1/posts/?auth_token={CRYPTOPANIC_API_TOKEN}&currencies=BTC&kind=news&limit={limit}"
        logging.info(f"请求CryptoPanic API: {url}")
        
        response = requests.get(url)
        logging.info(f"CryptoPanic API响应状态码: {response.status_code}")
        
        if response.status_code != 200:
            logging.error(f"CryptoPanic API请求失败，状态码: {response.status_code}, 响应: {response.text}")
            return []
            
        data = response.json()
        logging.info(f"CryptoPanic API响应数据: {json.dumps(data)[:200]}...")
        
        news_list = []
        if 'results' in data:
            for item in data['results']:
                news_list.append({
                    'title': item['title'],
                    'url': item['url'],
                    'source': item['source']['title'],
                    'created_at': item['created_at']
                })
            logging.info(f"成功获取 {len(news_list)} 条新闻")
        else:
            logging.error(f"CryptoPanic API响应中没有 'results' 字段: {data}")
            
        return news_list
    except Exception as e:
        logging.error(f"获取CryptoPanic新闻失败: {str(e)}")
        return []

def analyze_sentiment_with_deepseek(news_list):
    """使用DeepSeek API分析新闻情感"""
    try:
        # 构建请求正文
        news_text = "\n\n".join([f"标题: {news['title']}\n来源: {news['source']}" for news in news_list])
        
        prompt = f"""请分析以下比特币相关新闻的情感倾向，并给出一个从-1到1的情感分数：
        -1表示极度负面
        0表示中性
        1表示极度正面
        
        新闻内容:
        {news_text}
        
        请只返回一个数字，表示整体情感分数。"""
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}"
        }
        
        payload = {
            "model": "deepseek-chat",
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1,
            "max_tokens": 10
        }
        
        response = requests.post(
            f"{DEEPSEEK_BASE_URL}/v1/chat/completions",
            headers=headers,
            json=payload
        )
        
        result = response.json()
        sentiment_text = result['choices'][0]['message']['content'].strip()
        
        # 提取数字
        try:
            sentiment_score = float(sentiment_text)
            # 确保分数在-1到1之间
            sentiment_score = max(-1, min(1, sentiment_score))
            return sentiment_score
        except:
            logging.error(f"无法从DeepSeek响应中提取情感分数: {sentiment_text}")
            return 0  # 默认中性
    except Exception as e:
        logging.error(f"DeepSeek情感分析失败: {str(e)}")
        return 0  # 默认中性

def create_features(df):
    """创建预测特征"""
    try:
        # 计算价格变化
        df['Price_Change'] = df['close'].pct_change()
        df['Price_Change_Pct'] = df['Price_Change'] * 100
        
        # 计算移动平均
        df['MA5'] = df['close'].rolling(window=5).mean()
        df['MA10'] = df['close'].rolling(window=10).mean()
        
        # 计算波动率
        df['Volatility'] = df['Price_Change'].rolling(window=5).std()
        
        # 重命名列以匹配训练数据的格式
        df = df.rename(columns={
            'open': 'Open',
            'high': 'High',
            'low': 'Low',
            'close': 'Close',
            'volume': 'Volume',
            'marketCap': 'MarketCap',
            'sentiment_score': 'Sentiment_Score'
        })
        
        # 填充NaN值
        for col in ['MA5', 'MA10', 'Volatility']:
            df[col] = df[col].fillna(method='ffill')
        
        return df
    except Exception as e:
        logging.error(f"创建特征失败: {str(e)}")
        return df

def predict_prices(params=None):
    """预测未来几天的价格"""
    try:
        logging.info(f"收到的原始参数: {params}")
        # 解析JSON参数
        if isinstance(params, str):
            try:
                # 处理可能的三重引号
                params_str = params.strip()
                if params_str.startswith('"""') and params_str.endswith('"""'):
                    params_str = params_str[3:-3]  # 去除三重引号
                elif params_str.startswith('"') and params_str.endswith('"'):
                    params_str = params_str[1:-1]  # 去除单引号
                
                logging.info(f"准备解析的JSON字符串: {params_str}")
                params = json.loads(params_str)
                logging.info(f"解析后的JSON参数: {params}")
            except Exception as e:
                logging.error(f"解析JSON参数失败: {str(e)}")
                params = {}
        # 处理已经是字典类型的参数
        elif isinstance(params, dict):
            logging.info(f"参数已经是字典类型: {params}")
        elif params is None:
            params = {}
            
        # 获取参数
        days = int(params.get('days', 7))  # 确保转为整数
        sentiment_score_input = params.get('sentiment_score', None)
        
        logging.info(f"预测参数 - 天数: {days}, 情感分数: {sentiment_score_input}")
        
        # 加载模型和数据
        model, scaler = load_model_and_scaler()
        if model is None or scaler is None:
            return None
        
        price_df = load_price_data()
        sentiment_df = load_sentiment_data()
        if price_df is None or sentiment_df is None:
            return None
        
        # 获取最新新闻并分析情感
        today = datetime.now().date()
        news_list = get_cryptopanic_news()
        
        # 如果传入了情感分数，使用传入的值
        sentiment_score = sentiment_score_input if sentiment_score_input is not None else analyze_sentiment_with_deepseek(news_list)
        
        # 合并数据
        df = price_df.join(sentiment_df, how='left')
        
        # 对于缺失的情感数据，使用API获取的数据
        if today not in df.index:
            # 添加今天的数据行
            latest_row = price_df.iloc[-1].copy()
            df.loc[today] = latest_row
            
        # 为了简化，我们使用最新的情感分数作为所有预测日的情感分数
        df.loc[today, 'sentiment_score'] = sentiment_score
        
        # 创建特征
        df = create_features(df)
        
        # 获取最新的特征数据
        latest_features = df.iloc[-1][['Open', 'High', 'Low', 'Close', 'Volume', 'MA5', 'MA10', 'Volatility', 'Sentiment_Score']]
        
        # 确保没有NaN值
        for col in latest_features.index:
            if pd.isna(latest_features[col]):
                if col in ['MA5', 'MA10', 'Volatility']:
                    latest_features[col] = df[col].dropna().iloc[-1]
                else:
                    latest_features[col] = df[col].mean()
        
        # 标准化特征
        X = scaler.transform([latest_features.values])
        
        # 预测结果
        future_dates = []
        predicted_prices = []
        
        # 递归预测
        current_features = latest_features.values
        current_price = latest_features['Close']
        
        for i in range(days):
            future_date = today + timedelta(days=i+1)
            future_dates.append(future_date.strftime('%Y-%m-%d'))
            
            # 标准化当前特征并预测
            X_current = scaler.transform([current_features])
            predicted_price = model.predict(X_current)[0]
            predicted_prices.append(float(predicted_price))
            
            # 更新特征用于下一次预测
            # 这里简化为直接使用预测价格更新Close价格，其他特征保持不变
            current_features[3] = predicted_price  # Close 价格
            
        return {
            'dates': future_dates,
            'prices': predicted_prices,
            'current_price': float(current_price),
            'sentiment_score': sentiment_score
        }
    except Exception as e:
        logging.error(f"价格预测失败: {str(e)}")
        return None

def get_latest_news_with_sentiment():
    """获取最新新闻并分析情感"""
    try:
        # 获取新闻
        print("开始获取新闻...")
        news_list = get_cryptopanic_news(limit=20)
        print(f"获取到 {len(news_list)} 条新闻")
        
        if not news_list:
            logging.error("无法获取新闻数据")
            print("无法获取新闻数据")
            return None
        
        # 分析情感
        print("开始分析情感...")
        try:
            sentiment_score = analyze_sentiment_with_deepseek(news_list)
            print(f"情感分数: {sentiment_score}")
        except Exception as e:
            print(f"情感分析失败，使用默认值: {str(e)}")
            logging.error(f"情感分析失败，使用默认值: {str(e)}")
            # 使用默认的略微积极情感分数
            sentiment_score = 0.2
        
        result = {
            'news': news_list[:10],  # 只返回前10条新闻
            'sentiment_score': sentiment_score,
            'timestamp': datetime.now().isoformat()
        }
        print(f"返回结果: {len(result['news'])} 条新闻")
        return result
    except Exception as e:
        error_msg = f"获取新闻和情感分析失败: {str(e)}"
        print(error_msg)
        logging.error(error_msg)
        return None

def get_latest_news_with_sentiment_simple(params=None):
    """获取最新新闻（简化版，跳过情感分析）"""
    try:
        # 解析JSON参数
        if isinstance(params, str):
            try:
                params = json.loads(params)
                logging.info(f"解析JSON参数: {params}")
            except Exception as e:
                logging.error(f"解析JSON参数失败: {str(e)}")
                params = {}
        elif params is None:
            params = {}
            
        # 获取参数
        limit = params.get('limit', 10)
        
        # 获取新闻
        print("开始获取新闻（简化版）...")
        news_list = get_cryptopanic_news(limit=limit)
        print(f"获取到 {len(news_list)} 条新闻")
        
        if not news_list:
            print("无法获取新闻数据")
            return None
        
        # 返回结果，使用默认情感分数
        result = {
            'news': news_list,
            'sentiment_score': 0.2,  # 使用默认的略微积极情感分数
            'timestamp': datetime.now().isoformat()
        }
        print(f"返回结果: {len(result['news'])} 条新闻")
        return result
    except Exception as e:
        print(f"获取新闻失败: {str(e)}")
        return None

if __name__ == "__main__":
    # 测试预测功能
    result = predict_prices(params='{"days": 7}')
    if result:
        print(json.dumps(result, indent=2))
    
    # 测试新闻和情感分析
    news_result = get_latest_news_with_sentiment()
    print(json.dumps(news_result, indent=2)) 