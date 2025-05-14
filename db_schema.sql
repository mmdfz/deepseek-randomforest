-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email VARCHAR(100),
  role VARCHAR(20) DEFAULT 'user',
  created_at DATETIME NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 创建预测历史表
CREATE TABLE IF NOT EXISTS prediction_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  prediction_date DATE NOT NULL,
  days INT NOT NULL,
  request_text TEXT,
  result_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 创建新闻缓存表
CREATE TABLE IF NOT EXISTS news_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  news_data JSON NOT NULL,
  sentiment_score FLOAT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);

-- 创建样例用户数据
INSERT INTO users (username, password, email, role, created_at)
VALUES 
  ('admin', 'admin123', 'admin@example.com', 'admin', NOW()),
  ('user', 'user123', 'user@example.com', 'user', NOW()); 