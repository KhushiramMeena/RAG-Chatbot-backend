-- Initialize database for RAG News Chatbot
-- This script creates the necessary tables and indexes

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS news_chatbot;

USE news_chatbot;

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    message_count INT DEFAULT 0,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_agent TEXT,
    ip_address VARCHAR(45),
    INDEX idx_created_at (created_at),
    INDEX idx_last_activity (last_activity),
    INDEX idx_message_count (message_count)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    role ENUM('user', 'assistant') NOT NULL,
    content TEXT NOT NULL,
    sources JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
    INDEX idx_session_id (session_id),
    INDEX idx_created_at (created_at),
    INDEX idx_role (role)
);

-- Articles table for persistence
CREATE TABLE IF NOT EXISTS articles (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    url VARCHAR(1000) NOT NULL,
    source VARCHAR(255) NOT NULL,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_title (title (100)),
    INDEX idx_source (source),
    INDEX idx_published_at (published_at),
    INDEX idx_created_at (created_at),
    UNIQUE KEY unique_url (url (191))
);

-- Query cache table (optional)
CREATE TABLE IF NOT EXISTS query_cache (
    id VARCHAR(255) PRIMARY KEY,
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT NOT NULL,
    response_data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    INDEX idx_query_hash (query_hash),
    INDEX idx_expires_at (expires_at),
    INDEX idx_created_at (created_at)
);

-- System metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10, 4) NOT NULL,
    metric_unit VARCHAR(20),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metric_name (metric_name),
    INDEX idx_recorded_at (recorded_at)
);

-- Create views for common queries
CREATE OR REPLACE VIEW session_summary AS
SELECT
    s.id,
    s.created_at,
    s.updated_at,
    s.message_count,
    s.last_activity,
    COUNT(m.id) as actual_message_count,
    MAX(m.created_at) as last_message_at
FROM sessions s
    LEFT JOIN messages m ON s.id = m.session_id
GROUP BY
    s.id,
    s.created_at,
    s.updated_at,
    s.message_count,
    s.last_activity;

CREATE OR REPLACE VIEW daily_stats AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as sessions_created,
    SUM(message_count) as total_messages,
    AVG(message_count) as avg_messages_per_session
FROM sessions
GROUP BY
    DATE(created_at)
ORDER BY date DESC;

-- Insert sample data (optional)
INSERT IGNORE INTO
    system_metrics (
        metric_name,
        metric_value,
        metric_unit
    )
VALUES ('system_startup', 1, 'count'),
    (
        'database_initialized',
        1,
        'count'
    );

-- Create stored procedures for cleanup
DELIMITER /
/

CREATE PROCEDURE CleanupExpiredSessions(IN days_old INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Delete messages from old sessions
    DELETE m FROM messages m
    INNER JOIN sessions s ON m.session_id = s.id
    WHERE s.last_activity < DATE_SUB(NOW(), INTERVAL days_old DAY);
    
    -- Delete old sessions
    DELETE FROM sessions 
    WHERE last_activity < DATE_SUB(NOW(), INTERVAL days_old DAY);
    
    -- Clean up expired cache entries
    DELETE FROM query_cache 
    WHERE expires_at < NOW();
    
    COMMIT;
END
/
/

CREATE PROCEDURE GetSessionStats()
BEGIN
    SELECT 
        COUNT(*) as total_sessions,
        SUM(message_count) as total_messages,
        COUNT(DISTINCT DATE(created_at)) as active_days,
        AVG(message_count) as avg_messages_per_session,
        MAX(message_count) as max_messages_in_session
    FROM sessions;
END$$

DELIMITER ;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON news_chatbot.* TO 'chatbot_user'@'%';
-- FLUSH PRIVILEGES;