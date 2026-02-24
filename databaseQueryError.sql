create database backend_exam;
use backend_exam;

CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name ENUM('MANAGER','SUPPORT','USER') NOT NULL UNIQUE
);

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED') DEFAULT 'OPEN',
    priority ENUM('LOW','MEDIUM','HIGH') DEFAULT 'MEDIUM',
    created_by INT NOT NULL,
    assigned_to INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id)
);


CREATE TABLE ticket_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT,
    user_id INT,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);


CREATE TABLE ticket_status_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT,
    old_status ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED'),
    new_status ENUM('OPEN','IN_PROGRESS','RESOLVED','CLOSED'),
    changed_by INT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

INSERT INTO roles (name) VALUES 
('MANAGER'),
('SUPPORT'),
('USER');