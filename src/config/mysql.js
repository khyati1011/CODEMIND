import mysql from 'mysql2/promise';
import { env } from './env.js';

export const pool = mysql.createPool({
  host: env.mysql.host,
  port: env.mysql.port,
  user: env.mysql.user,
  password: env.mysql.password,
  database: env.mysql.database,
  waitForConnections: true,
  connectionLimit: 10,
});

export async function initMySQL() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      display_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      source_type ENUM('zip', 'github') NOT NULL,
      source_url VARCHAR(512) NULL,
      default_branch VARCHAR(128) NULL,
      total_files INT DEFAULT 0,
      total_lines INT DEFAULT 0,
      total_symbols INT DEFAULT 0,
      languages_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_projects_user (user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS analysis_jobs (
      id VARCHAR(36) PRIMARY KEY,
      project_id VARCHAR(36) NOT NULL,
      status ENUM('queued', 'ingesting', 'scanning', 'parsing', 'graphing', 'indexing', 'onboarding', 'completed', 'failed') DEFAULT 'queued',
      progress INT DEFAULT 0,
      current_stage VARCHAR(128) DEFAULT 'queued',
      error_message TEXT NULL,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      finished_at TIMESTAMP NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      INDEX idx_jobs_project (project_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS file_metadata (
      id INT AUTO_INCREMENT PRIMARY KEY,
      project_id VARCHAR(36) NOT NULL,
      file_path VARCHAR(512) NOT NULL,
      directory VARCHAR(512) NOT NULL,
      language VARCHAR(64) NOT NULL,
      lines_count INT DEFAULT 0,
      size_bytes INT DEFAULT 0,
      symbol_count INT DEFAULT 0,
      symbols_json JSON NULL,
      imports_json JSON NULL,
      exports_json JSON NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      INDEX idx_file_meta_project (project_id)
    )
  `);

  await pool.query(
    `INSERT IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)`,
    ['00000000-0000-0000-0000-000000000001', 'developer@codemind.local', 'Default Developer']
  );
}
