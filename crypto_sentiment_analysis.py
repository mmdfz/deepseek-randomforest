import os
import json
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error, r2_score
import joblib
import logging
import matplotlib.pyplot as plt
import seaborn as sns

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('model_training.log'),
        logging.StreamHandler()
    ]
)

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei']  # 用来正常显示中文标签
plt.rcParams['axes.unicode_minus'] = False  # 用来正常显示负号

def load_and_prepare_data(price_file, sentiment_file):
    """加载并准备数据"""
    try:
        # 第一步：先把整个CSV文件作为单列读入
        price_raw = pd.read_csv(price_file, header=None, names=['raw_data'])
        logging.info(f"读取原始价格数据，行数: {len(price_raw)}")
        
        # 第二步：拆分每一行的内容
        # 先去掉首尾的引号
        price_raw['raw_data'] = price_raw['raw_data'].str.strip('"')
        
        # 然后按分号拆分
        # 创建新的DataFrame来存储拆分后的数据
        price_df = pd.DataFrame()
        
        # 定义列名
        cols = ['timeOpen', 'timeClose', 'timeHigh', 'timeLow', 'name', 
                'open', 'high', 'low', 'close', 'volume', 'marketCap', 'timestamp']
        
        # 拆分每一行
        for i, col in enumerate(cols):
            price_df[col] = price_raw['raw_data'].str.split(';').str[i]
            
            # 对于数值列，确保是浮点数
            if col in ['open', 'high', 'low', 'close', 'volume', 'marketCap']:
                price_df[col] = pd.to_numeric(price_df[col], errors='coerce')
        
        # 提取日期
        price_df['Date'] = pd.to_datetime(price_df['timeOpen'].str.split('T').str[0]).dt.date
        
        # 过滤掉未来日期的数据
        current_date = datetime.now().date()
        price_df = price_df[price_df['Date'] <= current_date]
        logging.info(f"过滤掉未来日期后的价格数据大小: {price_df.shape}")
        
        price_df.set_index('Date', inplace=True)
        
        # 重命名列
        price_df = price_df.rename(columns={
            'open': 'Open',
            'high': 'High',
            'low': 'Low',
            'close': 'Close',
            'volume': 'Volume',
            'marketCap': 'MarketCap'
        })
        
        # 加载情绪数据（只有日期和情绪指数两列）
        sentiment_df = pd.read_csv(sentiment_file, header=None, names=['date', 'sentiment_score'])
        logging.info(f"原始情绪数据大小: {sentiment_df.shape}")
        
        # 转换日期格式
        sentiment_df['Date'] = pd.to_datetime(sentiment_df['date']).dt.date
        sentiment_df.set_index('Date', inplace=True)
        
        # 合并数据
        df = price_df.join(sentiment_df, how='inner')
        logging.info(f"合并后的数据大小: {df.shape}")
        
        # 检查是否存在必要的列
        required_cols = ['Open', 'High', 'Low', 'Close', 'Volume', 'sentiment_score']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            logging.error(f"缺少以下必要列: {missing_cols}")
            raise ValueError(f"缺少必要列: {missing_cols}")
        
        # 确保数据不为空
        if df.empty:
            logging.error("合并后的数据为空")
            raise ValueError("合并后的数据为空")
        
        # 确保数据按日期排序
        df.sort_index(inplace=True)
        
        # 显示数据的前几行，帮助调试
        logging.info(f"数据前5行:\n{df.head()}")
        
        logging.info(f"数据加载完成，共 {len(df)} 条记录")
        logging.info(f"数据列: {df.columns.tolist()}")
        
        # 检查数据是否包含NaN
        nan_counts = df.isna().sum()
        if nan_counts.sum() > 0:
            logging.warning(f"数据中包含NaN值: {nan_counts}")
            # 填充缺失值
            df.fillna(method='ffill', inplace=True)
            logging.info("已使用前向填充(ffill)处理NaN值")
        
        return df
        
    except Exception as e:
        logging.error(f"数据加载失败: {str(e)}")
        raise

def create_features(df):
    """创建特征"""
    try:
        logging.info(f"开始创建特征，数据框大小: {df.shape}")
        
        # 检查必要的列是否存在
        required_cols = ['Open', 'High', 'Low', 'Close', 'Volume', 'sentiment_score']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            logging.error(f"缺少以下列: {missing_cols}")
            raise ValueError(f"缺少列: {missing_cols}")
        
        # 检查数据是否为空
        if df.empty:
            logging.error("数据框为空，无法创建特征")
            raise ValueError("数据框为空")
        
        # 计算价格变化
        df['Price_Change'] = df['Close'].pct_change()
        df['Price_Change_Pct'] = df['Price_Change'] * 100
        
        # 计算移动平均
        df['MA5'] = df['Close'].rolling(window=5).mean()
        df['MA10'] = df['Close'].rolling(window=10).mean()
        
        # 计算波动率
        df['Volatility'] = df['Price_Change'].rolling(window=5).std()
        
        # 使用情绪指数作为特征
        df['Sentiment_Score'] = df['sentiment_score']
        
        # 删除包含NaN的行（只在必要的特征列中检查NaN）
        feature_cols = ['Open', 'High', 'Low', 'Close', 'Volume', 'MA5', 'MA10', 'Volatility', 'Sentiment_Score']
        rows_before = len(df)
        
        # 替代方案：先填充NaN，而不是删除它们
        # 这可能比直接删除NaN行保留更多数据
        for col in feature_cols:
            if df[col].isna().any():
                logging.info(f"在 {col} 列中填充 {df[col].isna().sum()} 个NaN值")
                if col in ['MA5', 'MA10', 'Volatility']:  # 对于计算出的指标，使用前向填充
                    df[col] = df[col].fillna(method='ffill')
                else:  # 对于原始数据，可以考虑更复杂的填充方法
                    df[col] = df[col].fillna(df[col].mean())
        
        # 删除仍然含有NaN的行
        df_cleaned = df.dropna(subset=feature_cols)
        rows_after = len(df_cleaned)
        
        logging.info(f"删除NaN后，行数从 {rows_before} 减少到 {rows_after}")
        
        # 确保数据不为空
        if df_cleaned.empty:
            logging.error("删除NaN后数据框为空")
            raise ValueError("删除NaN后数据框为空")
        
        logging.info("特征创建完成")
        return df_cleaned
        
    except Exception as e:
        logging.error(f"特征创建失败: {str(e)}")
        raise

def prepare_training_data(df):
    """准备训练数据"""
    try:
        logging.info(f"开始准备训练数据，数据框大小: {df.shape}")
        
        # 检查数据是否为空
        if df.empty:
            logging.error("数据框为空，无法准备训练数据")
            raise ValueError("数据框为空")
        
        # 选择特征
        features = ['Open', 'High', 'Low', 'Close', 'Volume', 
                   'MA5', 'MA10', 'Volatility', 'Sentiment_Score']
        
        # 检查是否所有特征都存在
        missing_features = [f for f in features if f not in df.columns]
        if missing_features:
            logging.error(f"缺少以下特征: {missing_features}")
            raise ValueError(f"缺少特征: {missing_features}")
        
        # 准备特征矩阵
        X = df[features].values
        logging.info(f"特征矩阵大小: {X.shape}")
        
        # 准备目标变量（下一天的收盘价）
        y = df['Close'].shift(-1)
        
        # 删除含有NaN的行
        mask = ~y.isna()
        X = X[:-1]  # 删除最后一行，因为没有对应的目标值
        y = y[:-1]  # 删除最后一行的NaN值
        
        logging.info(f"删除NaN后，特征矩阵大小: {X.shape}, 目标变量大小: {y.shape}")
        
        # 确保数据不为空
        if len(X) == 0 or len(y) == 0:
            logging.error("处理后的数据为空")
            raise ValueError("处理后的数据为空")
        
        # 数据标准化
        scaler = MinMaxScaler()
        X_scaled = scaler.fit_transform(X)
        
        # 保存scaler
        joblib.dump(scaler, 'price_scaler.joblib')
        
        logging.info("训练数据准备完成")
        return X_scaled, y, scaler
        
    except Exception as e:
        logging.error(f"训练数据准备失败: {str(e)}")
        raise

def train_model(X, y, df):
    """顺序切分训练和测试集，训练模型"""
    try:
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y.iloc[:split_idx], y.iloc[split_idx:]
        test_dates = df.index[split_idx:split_idx+len(y_test)]

        # 创建并训练模型
        model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42
        )
        model.fit(X_train, y_train)

        # 评估模型
        y_pred = model.predict(X_test)
        mse = mean_squared_error(y_test, y_pred)
        r2 = r2_score(y_test, y_pred)

        logging.info(f"模型训练完成")
        logging.info(f"均方误差: {mse:.2f}")
        logging.info(f"R2分数: {r2:.2f}")

        # 保存模型
        joblib.dump(model, 'crypto_model.joblib')

        return model, X_test, y_test, y_pred, X_train, y_train, test_dates

    except Exception as e:
        logging.error(f"模型训练失败: {str(e)}")
        raise

def plot_results(df, y_train, y_test, y_pred, test_dates):
    """绘制结果图表"""
    try:
        plt.figure(figsize=(15, 8))
        # 原始数据
        plt.plot(df.index, df['Close'], label='原始数据', color='gray', alpha=0.5)
        # 训练数据
        plt.plot(df.index[:len(y_train)], y_train, label='训练数据', color='blue')
        # 测试数据
        plt.plot(test_dates, y_test, label='实际测试数据', color='green')
        # 预测数据
        plt.plot(test_dates, y_pred, label='预测数据', color='red', linestyle='--')

        plt.title('比特币价格预测结果')
        plt.xlabel('日期')
        plt.ylabel('价格 (USD)')
        plt.legend()
        plt.grid(True)
        plt.savefig('prediction_results.png', dpi=300, bbox_inches='tight')
        plt.close()
        logging.info("结果图表已保存")
    except Exception as e:
        logging.error(f"图表生成失败: {str(e)}")
        raise

def main():
    """主函数"""
    try:
        df = load_and_prepare_data(
            'reversed_bitcoin_data.csv',
            'sentiment_scores.csv'
        )
        df = create_features(df)
        X, y, scaler = prepare_training_data(df)
        model, X_test, y_test, y_pred, X_train, y_train, test_dates = train_model(X, y, df)
        plot_results(df, y_train, y_test, y_pred, test_dates)
        results = {
            'test_dates': pd.to_datetime(test_dates).strftime('%Y-%m-%d').tolist(),
            'actual_prices': y_test.tolist(),
            'predicted_prices': y_pred.tolist()
        }
        with open('prediction_results.json', 'w') as f:
            json.dump(results, f)
        logging.info("所有处理完成")
    except Exception as e:
        logging.error(f"程序执行失败: {str(e)}")
        raise

if __name__ == "__main__":
    main() 