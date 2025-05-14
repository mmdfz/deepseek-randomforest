import pandas as pd
import logging
from tqdm import tqdm
import time
import requests

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 配置情绪指数日志
sentiment_logger = logging.getLogger('sentiment')
sentiment_logger.setLevel(logging.INFO)
sentiment_handler = logging.FileHandler('sentiment_scores.log', encoding='utf-8')
sentiment_handler.setFormatter(logging.Formatter('%(asctime)s - %(message)s'))
sentiment_logger.addHandler(sentiment_handler)

class SentimentAnalyzer:
    def __init__(self):
        self.api_key = "sk-812d1f6f07344ad08d31d237273b69fc"
        self.base_url = "https://api.deepseek.com/v1/chat/completions"
        
    def analyze_daily_news(self, news_text):
        """分析当天的新闻情感"""
        prompt = f"""请分析以下BTC相关新闻的整体市场情绪，给出一个-1到1之间的分数。
-1表示极度悲观，0表示中性，1表示极度乐观。

新闻内容：
{news_text}

请直接返回一个数字，不要有任何其他文字。例如：0.5 或 -0.3 或 0.0"""
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        data = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": "你是一个加密货币市场分析专家。请只返回一个-1到1之间的数字，表示市场情绪。"},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3,
            "max_tokens": 50
        }
        
        try:
            response = requests.post(self.base_url, headers=headers, json=data)
            response.raise_for_status()
            result = response.json()
            
            if 'choices' in result and len(result['choices']) > 0:
                score_text = result['choices'][0]['message']['content'].strip()
                logger.info(f"大模型原始返回内容: {score_text}")
                try:
                    score = float(score_text)
                    score = max(min(score, 1), -1)
                    logger.info(f"情绪分析成功，分数: {score}")
                    return score
                except:
                    logger.error(f"情绪分析失败，无法解析分数: {score_text}")
                    return 0
            else:
                logger.error("API返回格式错误")
                return 0
                
        except Exception as e:
            logger.error(f"情绪分析失败: {str(e)}")
            return 0

def main():
    # 加载新闻数据
    logger.info("加载新闻数据...")
    news_data = pd.read_csv('bitcoin_sentiments_21_24.csv')

    # 按日期组织新闻数据
    news_by_date = {}
    for _, row in news_data.iterrows():
        date = str(row['Date'])[:10]  # 只取日期部分
        if date not in news_by_date:
            news_by_date[date] = []
        news_by_date[date].append(row['Short Description'])

    # 创建情绪分析器
    analyzer = SentimentAnalyzer()
    
    # 存储结果
    results = []
    
    # 分析每天的新闻
    logger.info("开始分析每日新闻情绪...")
    for date, descriptions in tqdm(news_by_date.items(), desc="分析每日新闻情绪"):
        news_text = "\n".join([f"新闻{i+1}: {desc}" for i, desc in enumerate(descriptions)])
        try:
            score = analyzer.analyze_daily_news(news_text)
            # 记录到情绪指数日志文件
            sentiment_logger.info(f"日期: {date}, 情绪指数: {score:.2f}, 新闻数量: {len(descriptions)}")
            logger.info(f"{date} 的情绪指数: {score:.2f} (共{len(descriptions)}条新闻)")
            # 保存结果
            results.append({
                'date': date,
                'sentiment_score': score,
                'news_count': len(descriptions)
            })
        except Exception as e:
            sentiment_logger.error(f"日期: {date}, 情绪分析失败: {str(e)}")
            logger.error(f"{date} 的情绪分析失败: {str(e)}")
        # 添加延迟以避免API限制
        time.sleep(1)
    
    # 保存结果到CSV文件
    results_df = pd.DataFrame(results)
    results_df.to_csv('sentiment_scores.csv', index=False)
    logger.info("情绪指数已保存到 sentiment_scores.csv")

if __name__ == "__main__":
    main() 